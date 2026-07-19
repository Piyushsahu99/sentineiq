// Bank data ingestion + AI narrative
// Accepts raw bank JSON (transactions + cyber events), persists them,
// runs the correlation engine per tx, and generates a plain-English AI
// explanation via the Lovable AI Gateway.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TxIn = z.object({
  txn_id: z.string().min(1).max(64).optional(),
  user_id: z.string().min(1).max(64),
  amount: z.number().finite(),
  merchant: z.string().max(120).optional().default(""),
  location: z.string().max(64).optional().default(""),
  country: z.string().max(4).optional(),
  device: z.string().max(80).optional().default(""),
  channel: z.string().max(24).optional().default("card"),
  currency: z.string().min(3).max(4).optional(),
});
const EventIn = z.object({
  user: z.string().min(1).max(64),
  event: z.string().min(1).max(200),
  ip: z.string().max(64).optional(),
  device: z.string().max(80).optional(),
  ts: z.string().optional(),
});
const Input = z.object({
  transactions: z.array(TxIn).max(200).default([]),
  cyberEvents: z.array(EventIn).max(500).default([]),
});

// Very small country-of-city heuristic; falls back to profile.region.
const CITY_TO_COUNTRY: Record<string, string> = {
  mumbai: "IN", delhi: "IN", bangalore: "IN", bengaluru: "IN", chennai: "IN", pune: "IN",
  london: "GB", manchester: "GB", "new york": "US", "san francisco": "US", chicago: "US",
  dubai: "AE", singapore: "SG", moscow: "RU", lagos: "NG", tehran: "IR", beijing: "CN", hanoi: "VN",
};

function severityFor(event: string): "info" | "medium" | "high" | "critical" {
  const s = event.toLowerCase();
  if (/malware|beacon|c2|ransomware|infostealer/.test(s)) return "critical";
  if (/impossible travel|vpn|tor|mfa fail|credential stuff|brute/.test(s)) return "high";
  if (/login|auth|new device/.test(s)) return "medium";
  return "info";
}

export const ingestBankBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden: analyst role required to ingest bank data");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("region, currency").eq("id", context.userId).maybeSingle();
    const defaultCurrency = profile?.currency || "INR";
    const defaultCountry = profile?.region || "IN";

    // ---------- 1. Upsert customers by bank user_id (stored in email column) ----------
    const userIds = Array.from(new Set([
      ...data.transactions.map((t) => t.user_id),
      ...data.cyberEvents.map((e) => e.user),
    ]));
    const customerByUserId: Record<string, string> = {};
    for (const uid of userIds) {
      const email = `${uid}@bank.local`;
      const { data: existing } = await supabaseAdmin
        .from("customers").select("id").eq("email", email).maybeSingle();
      if (existing?.id) { customerByUserId[uid] = existing.id; continue; }
      const { data: created, error: cErr } = await supabaseAdmin
        .from("customers").insert({
          full_name: `Customer ${uid}`, email, country: defaultCountry,
          segment: "retail", risk_baseline: 25,
        }).select("id").single();
      if (cErr) throw new Error(`customer upsert failed for ${uid}: ${cErr.message}`);
      customerByUserId[uid] = created.id;
    }

    // ---------- 2. Insert cyber telemetry ----------
    const telemetryRows = data.cyberEvents.map((e) => ({
      source: "bank-ingest",
      severity: severityFor(e.event),
      user_ref: e.user,
      device: e.device ?? null,
      ip: e.ip ?? null,
      message: e.event,
      metadata: { customer_id: customerByUserId[e.user], ingested_at: new Date().toISOString() },
      created_at: e.ts ?? new Date().toISOString(),
    }));
    if (telemetryRows.length) {
      const { error } = await supabaseAdmin.from("cyber_telemetry").insert(telemetryRows);
      if (error) throw new Error(`telemetry insert failed: ${error.message}`);
    }

    // ---------- 3. Insert transactions ----------
    const txRows = data.transactions.map((t) => {
      const country = t.country || CITY_TO_COUNTRY[(t.location || "").toLowerCase()] || defaultCountry;
      return {
        customer_id: customerByUserId[t.user_id],
        amount: t.amount,
        currency: t.currency || defaultCurrency,
        channel: t.channel || "card",
        merchant: t.merchant || null,
        country,
        status: "pending",
      };
    });
    let insertedTx: Array<{ id: string; created_at: string }> = [];
    if (txRows.length) {
      const { data: inserted, error } = await supabaseAdmin
        .from("transactions").insert(txRows).select("id, created_at");
      if (error) throw new Error(`transactions insert failed: ${error.message}`);
      insertedTx = inserted ?? [];
    }

    // ---------- 4. Run correlation per tx ----------
    const { correlateTransaction } = await import("@/lib/correlation.functions");
    const results: Array<{
      txn_id: string; db_id: string; composite: number; verdict: string;
      dominant_kind: string; top_signals: string[]; investigation_id: string | null;
    }> = [];
    for (let i = 0; i < insertedTx.length; i++) {
      const dbId = insertedTx[i].id;
      const src = data.transactions[i];
      try {
        // Call the inner handler by re-invoking the exported server fn on the server side
        // via its handler is not exposed; instead re-issue the correlate call through admin.
        // Simplest: replicate a compact scoring path — but we already have the full engine.
        // Server fns aren't callable server-side directly; run a fetch to ourselves is heavy.
        // Instead: import the RAW handler by calling correlation logic through supabaseAdmin here.
        void correlateTransaction; // keep tree-shaker happy
        const r = await runCorrelationInline(supabaseAdmin, dbId);
        const inv = r.composite >= 60 ? await supabaseAdmin
          .from("ai_investigations").select("id").eq("transaction_id", dbId).maybeSingle() : null;
        results.push({
          txn_id: src.txn_id || dbId.slice(0, 8),
          db_id: dbId,
          composite: r.composite,
          verdict: r.composite >= 80 ? "blocked" : r.composite >= 60 ? "pending" : "approved",
          dominant_kind: r.dominant_kind,
          top_signals: r.contributors.slice(0, 3).map((s: any) => s.name),
          investigation_id: inv?.data?.id ?? null,
        });
      } catch (err) {
        results.push({
          txn_id: src.txn_id || dbId.slice(0, 8), db_id: dbId, composite: 0,
          verdict: "error", dominant_kind: "n/a",
          top_signals: [(err as Error).message], investigation_id: null,
        });
      }
    }

    // ---------- 5. AI narrative for each investigation (best-effort) ----------
    const key = process.env.LOVABLE_API_KEY;
    if (key) {
      for (const r of results) {
        if (!r.investigation_id) continue;
        try {
          await generateNarrative(supabaseAdmin, key, r.investigation_id, defaultCurrency);
        } catch { /* narrative failure never blocks ingestion */ }
      }
    }

    return {
      customers_created_or_matched: Object.keys(customerByUserId).length,
      telemetry_ingested: telemetryRows.length,
      transactions_ingested: insertedTx.length,
      results,
    };
  });

// Inline runner mirroring correlateTransaction so we can call it in a loop
// without going through the RPC layer (server fns aren't callable server-side).
async function runCorrelationInline(supabaseAdmin: any, txId: string) {
  const [helpers] = await importInline();
  const { loadCtx, rules, applyS } = helpers;
  const { data: tx } = await supabaseAdmin.from("transactions").select("*").eq("id", txId).maybeSingle();
  if (!tx) throw new Error("tx not found post-insert");
  const ctx = await loadCtx(supabaseAdmin, tx);
  const raw = rules(tx, ctx);
  const { adjusted: signals, suppressed } = await applyS(supabaseAdmin, raw, tx.customer_id);
  const baseline = ctx.cust?.risk_baseline ?? 20;
  const composite = Math.min(99, signals.reduce((s: number, x: any) => s + x.weight, 0) + Math.round(baseline / 5));
  const kindWeights = signals.reduce((acc: any, s: any) => { acc[s.kind] = (acc[s.kind] ?? 0) + s.weight; return acc; }, { fraud: 0, cyber: 0, xcorr: 0, quantum: 0 });
  const dominant = (Object.entries(kindWeights).sort((a: any, b: any) => b[1] - a[1])[0]?.[0]) as string ?? "fraud";
  const avgConf = signals.length ? Math.round(signals.reduce((s: number, x: any) => s + x.confidence, 0) / signals.length) : 50;
  const calibrated = Math.round(avgConf * 0.6 + composite * 0.4);
  const explanation = { signals, composite, calibrated_confidence: calibrated, kind_weights: kindWeights, dominant_kind: dominant, suppressed };

  await supabaseAdmin.from("risk_scores").insert({
    transaction_id: tx.id, customer_id: tx.customer_id, composite,
    contributors: signals.map((s: any) => ({ name: s.name, weight: s.weight, kind: s.kind, id: s.id })),
  });
  await supabaseAdmin.from("transactions").update({
    risk_score: composite,
    status: composite >= 80 ? "blocked" : composite >= 60 ? "pending" : "approved",
  }).eq("id", tx.id);

  if (composite >= 60) {
    const severity = composite >= 85 ? "critical" : composite >= 70 ? "high" : "medium";
    const { data: inv } = await supabaseAdmin.from("ai_investigations").insert({
      transaction_id: tx.id, customer_id: tx.customer_id,
      title: `Risk ${composite} · ${dominant.toUpperCase()} · ${tx.channel} → ${tx.country ?? "?"}`,
      confidence: Math.min(99, composite + 3),
      calibrated_confidence: calibrated,
      attack_type: dominant === "quantum" ? "Post-quantum exposure"
        : dominant === "cyber" ? "Cyber-led compromise"
        : dominant === "xcorr" ? "Correlated cyber + fraud attack chain"
        : "Anomalous transaction",
      business_impact: Number(tx.amount),
      root_cause: `Composite ${composite} from ${signals.length} typed signals (${dominant} dominant). Suppressed: ${suppressed.length}.`,
      evidence: signals.map((s: any) => ({ ts: s.evidence[0]?.ts ?? new Date().toISOString(), source: s.evidence[0]?.source ?? s.kind, event: s.name, weight: s.weight, signal_id: s.id })),
      explanation, risk_factors: signals.map((s: any) => s.name),
      recommended_actions: composite >= 85
        ? ["Freeze account for 24h", "Force credential reset", "Notify customer via secondary channel", "File SAR"]
        : ["Manual analyst review", "Enrich with device history", "Contact customer for confirmation"],
      compliance: composite >= 85 ? ["PSD2 SCA review", "AML SAR filing", "DORA incident report"] : ["Manual review"],
      status: "open",
    }).select("id").single();
    await supabaseAdmin.from("alerts").insert({
      transaction_id: tx.id, customer_id: tx.customer_id, investigation_id: inv?.id,
      severity, title: `Ingest · risk ${composite} on ${tx.channel} ${tx.currency} ${tx.amount}`,
      source: "bank-ingest", status: "open",
      sla_minutes: severity === "critical" ? 15 : 60,
    });
  }
  return { composite, dominant_kind: dominant, contributors: signals };
}

// Grab the (non-exported) helper closures from correlation.functions by re-importing
// its named exports and reusing the same context. We recreate mini versions here to
// avoid coupling; kept identical to the engine's semantics.
async function importInline() {
  const HIGH_RISK_GEO = ["RU", "NG", "AE", "IR", "CN", "VN"];
  return [{
    loadCtx: async (adm: any, tx: any) => {
      const [{ data: cust }, { data: telem }, { data: iocs }, { data: sessions }, { data: devices }, { data: recentTx }, { data: quantum }] = await Promise.all([
        adm.from("customers").select("*").eq("id", tx.customer_id).maybeSingle(),
        adm.from("cyber_telemetry").select("*").order("created_at", { ascending: false }).limit(50),
        adm.from("iocs").select("*").limit(20),
        adm.from("sessions").select("*").eq("customer_id", tx.customer_id).order("started_at", { ascending: false }).limit(10),
        adm.from("devices").select("*").eq("customer_id", tx.customer_id).limit(10),
        adm.from("transactions").select("id, amount, country, channel, currency, created_at").eq("customer_id", tx.customer_id).order("created_at", { ascending: false }).limit(30),
        adm.from("quantum_assets").select("*"),
      ]);
      return { cust, telem: telem ?? [], iocs: iocs ?? [], sessions: sessions ?? [], devices: devices ?? [], recentTx: recentTx ?? [], quantum: quantum ?? [] };
    },
    rules: (tx: any, ctx: any) => {
      const signals: any[] = [];
      const amt = Number(tx.amount);
      const baseline = ctx.cust?.risk_baseline ?? 20;
      const amounts = ctx.recentTx.map((t: any) => Number(t.amount)).filter((n: number) => Number.isFinite(n));
      const mean = amounts.length ? amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length : amt;
      const std = amounts.length > 1 ? Math.sqrt(amounts.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / amounts.length) : 0;
      const z = std > 0 ? (amt - mean) / std : 0;
      if (z > 2) signals.push({ id: "fraud.amount_zscore", kind: "fraud", name: `Amount ${z.toFixed(1)}σ above customer baseline`, weight: Math.min(20, Math.round(z * 4)), confidence: 80, evidence: [{ source: "transactions", note: `mean ${mean.toFixed(0)}, tx ${amt}` }] });
      // Large amount heuristic — bank ingest often has no prior history
      if (amt >= 100000) signals.push({ id: "fraud.large_amount", kind: "fraud", name: `Large amount (${tx.currency} ${amt.toLocaleString()})`, weight: 14, confidence: 78, evidence: [{ source: "transactions", note: `single tx ${tx.currency} ${amt}` }] });
      if (tx.country && ctx.cust?.country && tx.country !== ctx.cust.country) {
        const w = HIGH_RISK_GEO.includes(tx.country) ? 15 : 6;
        signals.push({ id: "fraud.geo_drift", kind: "fraud", name: `Geo drift: ${ctx.cust.country} → ${tx.country}`, weight: w, confidence: 75, evidence: [{ source: "customers", note: `home ${ctx.cust.country}, tx ${tx.country}` }] });
      }
      const critical = ctx.telem.filter((t: any) => t.severity === "critical");
      const high = ctx.telem.filter((t: any) => t.severity === "high");
      // Cyber events tied to this customer via metadata
      const mineHigh = ctx.telem.filter((t: any) => t.metadata?.customer_id === tx.customer_id && (t.severity === "high" || t.severity === "critical"));
      if (mineHigh.length) {
        signals.push({ id: "cyber.customer_events", kind: "cyber", name: `${mineHigh.length} high/critical cyber event(s) on this customer`, weight: 10 + mineHigh.length * 2, confidence: 88, evidence: mineHigh.slice(0, 4).map((t: any) => ({ source: t.source, ref_id: t.id, ts: t.created_at, note: t.message })) });
      }
      if (critical.length && !mineHigh.length) signals.push({ id: "cyber.critical_telemetry", kind: "cyber", name: `${critical.length} critical telemetry events (tenant)`, weight: Math.min(14, 4 + critical.length), confidence: 80, evidence: critical.slice(0, 3).map((t: any) => ({ source: t.source, ref_id: t.id, ts: t.created_at, note: t.message })) });
      if (high.length >= 3 && !mineHigh.length) signals.push({ id: "cyber.high_volume", kind: "cyber", name: `${high.length} high-severity events`, weight: 8, confidence: 70, evidence: high.slice(0, 3).map((t: any) => ({ source: t.source, ref_id: t.id, ts: t.created_at, note: t.message })) });
      // xcorr: cyber event on this customer just before tx
      const txTs = new Date(tx.created_at).getTime();
      const precedes = mineHigh.find((t: any) => { const dt = txTs - new Date(t.created_at).getTime(); return dt >= -60_000 && dt < 30 * 60_000; });
      if (precedes) signals.push({ id: "xcorr.cyber_precedes_tx", kind: "xcorr", name: "Cyber event within 30 min of transaction", weight: 18, confidence: 91, evidence: [{ source: precedes.source, ref_id: precedes.id, ts: precedes.created_at, note: precedes.message }] });
      // Quantum
      const legacy = ctx.quantum.filter((q: any) => /^RSA-|3DES/i.test(q.algo ?? "") && (q.sensitivity ?? 0) >= 70);
      if (legacy.length && amt >= 5000) signals.push({ id: "quantum.hndl_exposure", kind: "quantum", name: `HNDL exposure on ${legacy.length} legacy asset(s)`, weight: 8, confidence: 65, evidence: legacy.slice(0, 3).map((q: any) => ({ source: "quantum_assets", ref_id: q.id, note: `${q.asset} · ${q.algo}` })) });
      if (baseline > 40) signals.push({ id: "fraud.customer_baseline", kind: "fraud", name: `Customer risk baseline ${baseline}`, weight: Math.round(baseline / 8), confidence: 55, evidence: [{ source: "customers", note: `baseline ${baseline}` }] });
      return signals;
    },
    applyS: async (adm: any, signals: any[], customerId: string) => {
      const { data: sups } = await adm.from("suppressions").select("signal_id, weight_multiplier, expires_at, customer_id").gt("expires_at", new Date().toISOString());
      const active = (sups ?? []).filter((s: any) => !s.customer_id || s.customer_id === customerId);
      const suppressed: string[] = [];
      const adjusted = signals.map((sig: any) => {
        const s = active.find((a: any) => a.signal_id === sig.id);
        if (!s) return sig;
        suppressed.push(sig.id);
        return { ...sig, weight: Math.round(sig.weight * Number(s.weight_multiplier)) };
      });
      return { adjusted, suppressed };
    },
  }];
}

async function generateNarrative(adm: any, key: string, investigationId: string, currency: string) {
  const { data: inv } = await adm.from("ai_investigations").select("*").eq("id", investigationId).maybeSingle();
  if (!inv) return;
  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: `You are SentinelQ's explainable-AI analyst. Given a fraud/cyber investigation, produce concise plain-English output (<= 180 words). Use the provided currency ${currency} in amounts. Return STRICT JSON with keys: summary (string, 2-3 sentences), why_flagged (array of 3-5 short bullets), recommended_actions (array of 3-5 short bullets), confidence_rationale (1 sentence).` },
      { role: "user", content: JSON.stringify({ title: inv.title, attack_type: inv.attack_type, business_impact: inv.business_impact, risk_factors: inv.risk_factors, explanation: inv.explanation }) },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  };
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return;
  const json = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    await adm.from("ai_investigations").update({ ai_narrative: parsed }).eq("id", investigationId);
  } catch { /* ignore */ }
}

// Fetch stored AI narrative for an investigation
export const getInvestigationNarrative = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ investigationId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: inv, error } = await context.supabase
      .from("ai_investigations").select("id, ai_narrative, title")
      .eq("id", data.investigationId).maybeSingle();
    if (error) throw new Error(error.message);
    return inv;
  });

// Regenerate AI narrative on demand (used when the initial best-effort pass
// during ingestion was skipped or failed).
export const regenerateInvestigationNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ investigationId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden: analyst role required");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, reason: "AI Gateway is not configured on this deployment. Ask an admin to set LOVABLE_API_KEY." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("currency").eq("id", context.userId).maybeSingle();
    try {
      await generateNarrative(supabaseAdmin, key, data.investigationId, profile?.currency || "INR");
    } catch (e) {
      return { ok: false as const, reason: (e as Error).message || "AI gateway request failed" };
    }
    const { data: inv } = await supabaseAdmin
      .from("ai_investigations").select("id, ai_narrative, title").eq("id", data.investigationId).maybeSingle();
    if (!inv?.ai_narrative) return { ok: false as const, reason: "AI gateway returned no usable content. Try again shortly." };
    return { ok: true as const, narrative: inv.ai_narrative };
  });
