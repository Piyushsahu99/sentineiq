// AI Correlation Engine — typed rule pipeline covering fraud, cyber,
// cross-correlation, and quantum indicators. Persists a full explanation
// tree onto ai_investigations for the Explainable AI page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ transactionId: z.string().uuid() });

type SignalKind = "fraud" | "cyber" | "xcorr" | "quantum";
type Signal = {
  id: string;
  kind: SignalKind;
  name: string;
  weight: number;
  confidence: number;
  evidence: Array<{ source: string; ref_id?: string; ts?: string; note: string }>;
};

const HIGH_RISK_GEO = ["RU", "NG", "AE", "IR", "CN", "VN"];

async function loadContext(supabaseAdmin: any, tx: any) {
  const [{ data: cust }, { data: telem }, { data: iocs }, { data: sessions }, { data: devices }, { data: recentTx }, { data: quantum }] = await Promise.all([
    supabaseAdmin.from("customers").select("*").eq("id", tx.customer_id).maybeSingle(),
    supabaseAdmin.from("cyber_telemetry").select("*").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("iocs").select("*").limit(20),
    supabaseAdmin.from("sessions").select("*").eq("customer_id", tx.customer_id).order("started_at", { ascending: false }).limit(10),
    supabaseAdmin.from("devices").select("*").eq("customer_id", tx.customer_id).limit(10),
    supabaseAdmin.from("transactions").select("id, amount, country, channel, created_at").eq("customer_id", tx.customer_id).order("created_at", { ascending: false }).limit(30),
    supabaseAdmin.from("quantum_assets").select("*"),
  ]);
  return { cust, telem: telem ?? [], iocs: iocs ?? [], sessions: sessions ?? [], devices: devices ?? [], recentTx: recentTx ?? [], quantum: quantum ?? [] };
}

function runRules(tx: any, ctx: Awaited<ReturnType<typeof loadContext>>): Signal[] {
  const signals: Signal[] = [];
  const amt = Number(tx.amount);
  const baseline = ctx.cust?.risk_baseline ?? 20;

  // ---------- FRAUD signals ----------
  const amounts = ctx.recentTx.map((t: any) => Number(t.amount)).filter((n: number) => Number.isFinite(n));
  const mean = amounts.length ? amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length : amt;
  const std = amounts.length > 1 ? Math.sqrt(amounts.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / amounts.length) : 0;
  const z = std > 0 ? (amt - mean) / std : 0;
  if (z > 2) {
    signals.push({
      id: "fraud.amount_zscore", kind: "fraud", name: `Amount z-score ${z.toFixed(1)}σ above baseline`,
      weight: Math.min(20, Math.round(z * 4)), confidence: 80,
      evidence: [{ source: "transactions", note: `mean $${mean.toFixed(0)}, tx $${amt.toLocaleString()}` }],
    });
  }

  // velocity: >3 txs in last hour
  const oneHourAgo = new Date(new Date(tx.created_at).getTime() - 3600_000);
  const recentHour = ctx.recentTx.filter((t: any) => new Date(t.created_at) > oneHourAgo);
  if (recentHour.length >= 3) {
    signals.push({
      id: "fraud.velocity_1h", kind: "fraud", name: `Velocity: ${recentHour.length} txs in the last hour`,
      weight: 10 + recentHour.length, confidence: 85,
      evidence: recentHour.slice(0, 5).map((t: any) => ({ source: "transactions", ref_id: t.id, ts: t.created_at, note: `$${t.amount} ${t.channel}` })),
    });
  }

  // structuring: multiple txs just under $10k
  const structuring = ctx.recentTx.filter((t: any) => Number(t.amount) >= 8500 && Number(t.amount) < 10000);
  if (structuring.length >= 2) {
    signals.push({
      id: "fraud.structuring_9k", kind: "fraud", name: `Structuring pattern: ${structuring.length} txs at $8.5k–$10k`,
      weight: 15, confidence: 82,
      evidence: structuring.slice(0, 4).map((t: any) => ({ source: "transactions", ref_id: t.id, ts: t.created_at, note: `$${t.amount}` })),
    });
  }

  // geo drift vs customer home country
  if (tx.country && ctx.cust?.country && tx.country !== ctx.cust.country) {
    const w = HIGH_RISK_GEO.includes(tx.country) ? 15 : 6;
    signals.push({
      id: "fraud.geo_drift", kind: "fraud", name: `Geo drift: ${ctx.cust.country} → ${tx.country}`,
      weight: w, confidence: 75,
      evidence: [{ source: "customers", note: `home ${ctx.cust.country}, tx ${tx.country}` }],
    });
  }

  // device change: no trusted device or recent session flagged
  const untrusted = ctx.devices.filter((d: any) => !d.trusted).length;
  if (untrusted > 0 && ctx.devices.length > 0) {
    signals.push({
      id: "fraud.device_untrusted", kind: "fraud", name: `${untrusted} untrusted device(s) on customer`,
      weight: 8, confidence: 65,
      evidence: ctx.devices.filter((d: any) => !d.trusted).slice(0, 3).map((d: any) => ({ source: "devices", ref_id: d.id, note: `${d.os}/${d.browser}` })),
    });
  }

  // ---------- CYBER telemetry signals ----------
  const critical = ctx.telem.filter((t: any) => t.severity === "critical");
  const high = ctx.telem.filter((t: any) => t.severity === "high");
  if (critical.length > 0) {
    signals.push({
      id: "cyber.critical_telemetry", kind: "cyber", name: `${critical.length} critical telemetry events (last 50)`,
      weight: Math.min(18, 6 + critical.length * 2), confidence: 88,
      evidence: critical.slice(0, 4).map((t: any) => ({ source: t.source, ref_id: t.id, ts: t.created_at, note: t.message })),
    });
  }
  const authBurst = ctx.telem.filter((t: any) => /mfa|login|auth|credential/i.test(t.message ?? ""));
  if (authBurst.length >= 3) {
    signals.push({
      id: "cyber.credential_stuffing", kind: "cyber", name: `Auth anomaly burst: ${authBurst.length} events`,
      weight: 12, confidence: 78,
      evidence: authBurst.slice(0, 4).map((t: any) => ({ source: t.source, ref_id: t.id, ts: t.created_at, note: t.message })),
    });
  }
  const impossibleTravel = ctx.telem.find((t: any) => /impossible travel/i.test(t.message ?? ""));
  if (impossibleTravel) {
    signals.push({
      id: "cyber.impossible_login", kind: "cyber", name: "Impossible travel detected",
      weight: 14, confidence: 92,
      evidence: [{ source: impossibleTravel.source, ref_id: impossibleTravel.id, ts: impossibleTravel.created_at, note: impossibleTravel.message }],
    });
  }
  const malware = ctx.telem.find((t: any) => /beacon|c2|infostealer|ransomware/i.test(t.message ?? ""));
  if (malware) {
    signals.push({
      id: "cyber.malware_beacon", kind: "cyber", name: "Malware / C2 activity on customer's device",
      weight: 16, confidence: 90,
      evidence: [{ source: malware.source, ref_id: malware.id, ts: malware.created_at, note: malware.message }],
    });
  }
  if (high.length >= 3 && signals.every((s) => s.id !== "cyber.critical_telemetry")) {
    signals.push({
      id: "cyber.high_volume", kind: "cyber", name: `${high.length} high-severity telemetry events`,
      weight: 8, confidence: 70,
      evidence: high.slice(0, 3).map((t: any) => ({ source: t.source, ref_id: t.id, ts: t.created_at, note: t.message })),
    });
  }

  // ---------- CROSS-CORRELATION signals ----------
  if (ctx.iocs.length > 0 && tx.country && HIGH_RISK_GEO.includes(tx.country)) {
    const hit = ctx.iocs[0];
    signals.push({
      id: "xcorr.ioc_touches_tx", kind: "xcorr", name: `IOC observed in tenant; tx destination in high-risk geo ${tx.country}`,
      weight: 12, confidence: 84,
      evidence: [{ source: "iocs", ref_id: hit.id, note: `${hit.type} ${hit.value}` }],
    });
  }
  const txTs = new Date(tx.created_at).getTime();
  const cyberPrecedes = ctx.telem.find((t: any) => {
    const dt = txTs - new Date(t.created_at).getTime();
    return t.severity === "critical" && dt > 0 && dt < 30 * 60_000;
  });
  if (cyberPrecedes) {
    signals.push({
      id: "xcorr.cyber_precedes_tx", kind: "xcorr", name: "Critical cyber event within 30 min before transaction",
      weight: 18, confidence: 91,
      evidence: [{ source: cyberPrecedes.source, ref_id: cyberPrecedes.id, ts: cyberPrecedes.created_at, note: cyberPrecedes.message }],
    });
  }
  if (ctx.sessions.some((s: any) => s.is_tor || s.is_vpn)) {
    const s = ctx.sessions.find((x: any) => x.is_tor || x.is_vpn);
    signals.push({
      id: "xcorr.anonymizer_session", kind: "xcorr", name: `Session via ${s.is_tor ? "Tor" : "VPN"}`,
      weight: 7, confidence: 72,
      evidence: [{ source: "sessions", ref_id: s.id, ts: s.started_at, note: `${s.country}/${s.city}` }],
    });
  }

  // ---------- QUANTUM signals ----------
  const legacyRsa = ctx.quantum.filter((q: any) => /^RSA-/i.test(q.algo ?? "") || /3DES/i.test(q.algo ?? ""));
  const hndl = legacyRsa.filter((q: any) => (q.sensitivity ?? 0) >= 70);
  if (hndl.length > 0 && amt >= 5000) {
    signals.push({
      id: "quantum.hndl_exposure", kind: "quantum", name: `HNDL exposure: ${hndl.length} legacy asset(s) may protect this session`,
      weight: 10, confidence: 68,
      evidence: hndl.slice(0, 3).map((q: any) => ({ source: "quantum_assets", ref_id: q.id, note: `${q.asset} · ${q.algo} · sens ${q.sensitivity}` })),
    });
  }
  const weakTls = ctx.quantum.find((q: any) => /TLS 1\.[01]$|TLS 1\.2/.test(q.tls_version ?? ""));
  if (weakTls && tx.channel === "wire") {
    signals.push({
      id: "quantum.weak_cipher_endpoint", kind: "quantum", name: `Weak TLS on wire endpoint (${weakTls.tls_version})`,
      weight: 6, confidence: 60,
      evidence: [{ source: "quantum_assets", ref_id: weakTls.id, note: `${weakTls.asset} · ${weakTls.algo}` }],
    });
  }

  // baseline nudge
  if (baseline > 40) {
    signals.push({
      id: "fraud.customer_baseline", kind: "fraud", name: `Customer risk baseline ${baseline}`,
      weight: Math.round(baseline / 8), confidence: 55,
      evidence: [{ source: "customers", ref_id: ctx.cust?.id, note: `baseline ${baseline}` }],
    });
  }

  return signals;
}

async function applySuppressions(supabaseAdmin: any, signals: Signal[], customerId: string) {
  const { data: sups } = await supabaseAdmin
    .from("suppressions").select("signal_id, weight_multiplier, expires_at, customer_id")
    .gt("expires_at", new Date().toISOString());
  const active = (sups ?? []).filter((s: any) => !s.customer_id || s.customer_id === customerId);
  const suppressed: string[] = [];
  const adjusted = signals.map((sig) => {
    const s = active.find((a: any) => a.signal_id === sig.id);
    if (!s) return sig;
    suppressed.push(sig.id);
    return { ...sig, weight: Math.round(sig.weight * Number(s.weight_multiplier)) };
  });
  return { adjusted, suppressed };
}

export const correlateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden: analyst role required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx, error: txErr } = await supabaseAdmin.from("transactions").select("*").eq("id", data.transactionId).maybeSingle();
    if (txErr || !tx) throw new Error("Transaction not found");

    const ctx = await loadContext(supabaseAdmin, tx);
    const rawSignals = runRules(tx, ctx);
    const { adjusted: signals, suppressed } = await applySuppressions(supabaseAdmin, rawSignals, tx.customer_id);

    const baseline = ctx.cust?.risk_baseline ?? 20;
    const composite = Math.min(99, signals.reduce((s, x) => s + x.weight, 0) + Math.round(baseline / 5));
    const kindWeights = signals.reduce<Record<SignalKind, number>>((acc, s) => { acc[s.kind] = (acc[s.kind] ?? 0) + s.weight; return acc; }, { fraud: 0, cyber: 0, xcorr: 0, quantum: 0 });
    const dominant: SignalKind = (Object.entries(kindWeights).sort((a, b) => b[1] - a[1])[0]?.[0] as SignalKind) ?? "fraud";
    const avgConf = signals.length ? Math.round(signals.reduce((s, x) => s + x.confidence, 0) / signals.length) : 50;
    const calibrated = Math.round(avgConf * 0.6 + composite * 0.4);

    const explanation = { signals, composite, calibrated_confidence: calibrated, kind_weights: kindWeights, dominant_kind: dominant, suppressed };

    await supabaseAdmin.from("risk_scores").insert({
      transaction_id: tx.id, customer_id: tx.customer_id, composite,
      contributors: signals.map((s) => ({ name: s.name, weight: s.weight, kind: s.kind, id: s.id })),
    });

    await supabaseAdmin.from("transactions").update({
      risk_score: composite,
      status: composite >= 80 ? "blocked" : composite >= 60 ? "pending" : "approved",
    }).eq("id", tx.id);

    if (composite >= 60) {
      const severity = composite >= 85 ? "critical" : composite >= 70 ? "high" : "medium";
      const attackType =
        dominant === "quantum" ? "Post-quantum exposure on live payment path"
        : dominant === "cyber" ? "Cyber-led compromise preceding financial action"
        : dominant === "xcorr" ? "Correlated cyber + fraud attack chain"
        : composite >= 85 ? "Suspected Account Takeover / APP fraud" : "Anomalous transaction";

      const title = composite >= 85
        ? `${ctx.cust?.full_name ?? "Customer"} — $${Number(tx.amount).toLocaleString()} ${tx.channel} to ${tx.country ?? "unknown"} BLOCKED`
        : `${ctx.cust?.full_name ?? "Customer"} — $${Number(tx.amount).toLocaleString()} ${tx.channel} flagged (risk ${composite})`;

      const { data: inv } = await supabaseAdmin.from("ai_investigations").insert({
        transaction_id: tx.id, customer_id: tx.customer_id,
        title: `Risk ${composite} · ${dominant.toUpperCase()} · ${tx.channel} → ${tx.country ?? "?"}`,
        confidence: Math.min(99, composite + 3),
        calibrated_confidence: calibrated,
        attack_type: attackType,
        business_impact: Number(tx.amount),
        root_cause: `Composite ${composite} from ${signals.length} typed signals (${dominant} dominant). Suppressed: ${suppressed.length}.`,
        evidence: signals.map((s) => ({ ts: s.evidence[0]?.ts ?? new Date().toISOString(), source: s.evidence[0]?.source ?? s.kind, event: s.name, weight: s.weight, signal_id: s.id })),
        explanation,
        risk_factors: signals.map((s) => s.name),
        recommended_actions: composite >= 85
          ? ["Freeze account for 24h", "Force credential reset", "Notify customer via secondary channel", "File SAR"]
          : ["Manual analyst review", "Enrich with device history", "Contact customer for confirmation"],
        compliance: composite >= 85 ? ["PSD2 SCA review", "AML SAR filing", "DORA incident report"] : ["Manual review"],
        status: "open",
      }).select("id").single();

      await supabaseAdmin.from("alerts").insert({
        transaction_id: tx.id, customer_id: tx.customer_id, investigation_id: inv?.id,
        severity, title, source: "correlation-engine", status: "open",
        sla_minutes: severity === "critical" ? 15 : 60,
      });

      await supabaseAdmin.from("notifications").insert({
        title: severity === "critical" ? "Critical alert" : "New alert",
        body: title, severity,
      });
    }

    // Persist to per-user transaction-checking history so users see every
    // correlation performed against a tx (Profile → Checking history).
    await supabaseAdmin.from("tx_check_history").insert({
      user_id: context.userId,
      transaction_id: tx.id,
      verdict: composite >= 80 ? "blocked" : composite >= 60 ? "flagged" : "clean",
      risk_score: composite,
      signals: signals.map((s) => ({ id: s.id, kind: s.kind, name: s.name, weight: s.weight })),
      currency: tx.currency,
      amount_local: tx.amount,
      merchant: tx.merchant,
      country: tx.country,
    });

    return { composite, calibrated, contributors: signals, blocked: composite >= 80, dominant_kind: dominant, suppressed };
  });


// ---------- Proactive scan: no transaction required ----------
export const runProactiveScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const [{ data: telem }, { data: iocs }] = await Promise.all([
      supabaseAdmin.from("cyber_telemetry").select("*").gte("created_at", since).limit(200),
      supabaseAdmin.from("iocs").select("*").limit(20),
    ]);
    const critical = (telem ?? []).filter((t: any) => t.severity === "critical");
    const evidence = critical.slice(0, 10).map((t: any) => ({ source: t.source, ref_id: t.id, ts: t.created_at, note: t.message }));
    if (critical.length === 0) return { created: 0, message: "No critical telemetry in the last 15 minutes" };

    const severity = critical.length >= 3 ? "critical" : "high";
    const explanation = {
      signals: [{
        id: "cyber.proactive_sweep", kind: "cyber", name: `${critical.length} critical cyber events in 15 min window`,
        weight: 20 + critical.length * 2, confidence: 88, evidence,
      }, ...(iocs?.length ? [{
        id: "cyber.ioc_context", kind: "cyber", name: `${iocs.length} IOCs active in tenant`, weight: 8, confidence: 75,
        evidence: (iocs ?? []).slice(0, 3).map((i: any) => ({ source: "iocs", ref_id: i.id, note: `${i.type} ${i.value}` })),
      }] : [])],
      composite: Math.min(99, 30 + critical.length * 5),
      calibrated_confidence: 86,
      kind_weights: { fraud: 0, cyber: 30, xcorr: 0, quantum: 0 },
      dominant_kind: "cyber",
      suppressed: [],
    };

    const { data: inv } = await supabaseAdmin.from("ai_investigations").insert({
      transaction_id: null, customer_id: null,
      title: `Proactive cyber alert · ${critical.length} critical events (last 15 min)`,
      confidence: 90, calibrated_confidence: 86,
      attack_type: "Cyber-first: proactive detection",
      business_impact: 0,
      root_cause: `Proactive sweep found ${critical.length} critical cyber telemetry events within 15 minutes.`,
      evidence: evidence.map((e) => ({ ts: e.ts, source: e.source, event: e.note, weight: 5 })),
      explanation, risk_factors: evidence.map((e) => e.note),
      recommended_actions: ["Isolate affected endpoints", "Rotate credentials", "Enrich with SIEM context", "Notify SOC lead"],
      compliance: ["DORA incident report"], status: "open",
    }).select("id").single();

    await supabaseAdmin.from("alerts").insert({
      transaction_id: null, customer_id: null, investigation_id: inv?.id,
      severity, title: `Proactive cyber sweep · ${critical.length} critical events`,
      source: "proactive-scan", status: "open", sla_minutes: severity === "critical" ? 15 : 30,
    });
    await supabaseAdmin.from("notifications").insert({
      title: "Proactive cyber alert",
      body: `${critical.length} critical cyber events in the last 15 minutes`,
      severity,
    });
    return { created: 1, severity, evidence_count: evidence.length };
  });

// ---------- Analyst feedback: FP loop ----------
const FeedbackInput = z.object({
  alertId: z.string().uuid().optional(),
  investigationId: z.string().uuid().optional(),
  signalId: z.string().optional(),
  verdict: z.enum(["true_positive", "false_positive", "benign"]),
  notes: z.string().max(1000).optional(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => FeedbackInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let customerId: string | null = null;
    if (data.alertId) {
      const { data: a } = await supabaseAdmin.from("alerts").select("customer_id").eq("id", data.alertId).maybeSingle();
      customerId = a?.customer_id ?? null;
    }

    await supabaseAdmin.from("analyst_feedback").insert({
      alert_id: data.alertId ?? null, investigation_id: data.investigationId ?? null,
      signal_id: data.signalId ?? null, verdict: data.verdict, notes: data.notes ?? null,
      user_id: context.userId,
    });

    // If 3+ FP verdicts for same signal on same customer within 7d, auto-suppress.
    if (data.verdict === "false_positive" && data.signalId && customerId) {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: fps } = await supabaseAdmin
        .from("analyst_feedback")
        .select("id, alert:alerts!inner(customer_id)")
        .eq("signal_id", data.signalId).eq("verdict", "false_positive").gte("created_at", since);
      const relevant = (fps ?? []).filter((f: any) => f.alert?.customer_id === customerId).length;
      if (relevant >= 3) {
        await supabaseAdmin.from("suppressions").insert({
          signal_id: data.signalId, customer_id: customerId,
          reason: `Auto-suppressed after ${relevant} false-positive verdicts in 7 days`,
          weight_multiplier: 0.2, created_by: context.userId,
        });
      }
    }
    return { ok: true };
  });
