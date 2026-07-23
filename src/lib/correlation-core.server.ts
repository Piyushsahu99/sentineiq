// Shared correlation engine — single source of truth for both the on-demand
// `correlateTransaction` RPC and the batch `ingestBankBatch` ingest path.
// Server-only (imports supabaseAdmin dynamically at the call site).

export type SignalKind = "fraud" | "cyber" | "xcorr" | "quantum";
export type Signal = {
  id: string;
  kind: SignalKind;
  name: string;
  weight: number;
  confidence: number;
  evidence: Array<{ source: string; ref_id?: string; ts?: string; note: string }>;
};

export type ScoreResult = {
  composite: number;
  calibrated: number;
  band: Band;
  status: "approved" | "pending" | "blocked";
  dominant_kind: SignalKind;
  signals: Signal[];
  escalations: Array<{ id: string; bonus: number; reason: string }>;
  risk_breakdown: Array<{ component: string; value: number }>;
  timeline: Array<{ ts: string; kind: "cyber" | "tx"; event: string; delta_min: number; severity?: string }>;
  recommended_action: string;
  suppressed: string[];
  force_block: boolean;
  investigation_id: string | null;
};

export type Band = "Approved" | "Monitor" | "Pending Review" | "High Risk" | "Block";

export const HIGH_RISK_GEO = ["RU", "NG", "AE", "IR", "CN", "VN"] as const;

// Currency-aware "large amount" thresholds (rough FX peg to $1,000 base = "large")
const LARGE_AMOUNT: Record<string, number> = {
  USD: 5000, EUR: 4600, GBP: 4000, INR: 100000, AED: 18000, SGD: 6700, JPY: 750000,
};
const HUGE_AMOUNT: Record<string, number> = {
  USD: 25000, EUR: 23000, GBP: 20000, INR: 500000, AED: 90000, SGD: 33000, JPY: 3750000,
};

export function bandFor(composite: number): Band {
  if (composite >= 85) return "Block";
  if (composite >= 70) return "High Risk";
  if (composite >= 50) return "Pending Review";
  if (composite >= 30) return "Monitor";
  return "Approved";
}

export function statusFor(band: Band, forceBlock: boolean): "approved" | "pending" | "blocked" {
  if (forceBlock || band === "Block") return "blocked";
  if (band === "High Risk" || band === "Pending Review") return "pending";
  return "approved";
}

// ---------- context loader ----------
export async function loadContext(supabaseAdmin: any, tx: any) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();
  const [
    { data: cust },
    { data: telem },
    { data: iocs },
    { data: sessions },
    { data: devices },
    { data: recentTx },
    { data: quantum },
    { data: beneficiaries },
  ] = await Promise.all([
    supabaseAdmin.from("customers").select("*").eq("id", tx.customer_id).maybeSingle(),
    supabaseAdmin.from("cyber_telemetry").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("iocs").select("*").limit(20),
    supabaseAdmin.from("sessions").select("*").eq("customer_id", tx.customer_id).order("started_at", { ascending: false }).limit(15),
    supabaseAdmin.from("devices").select("*").eq("customer_id", tx.customer_id).limit(20),
    supabaseAdmin.from("transactions").select("id, amount, currency, country, channel, merchant, created_at").eq("customer_id", tx.customer_id).gte("created_at", ninetyDaysAgo).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("quantum_assets").select("*"),
    supabaseAdmin.from("beneficiaries").select("*").eq("customer_id", tx.customer_id).limit(20),
  ]);
  return {
    cust, telem: telem ?? [], iocs: iocs ?? [], sessions: sessions ?? [],
    devices: devices ?? [], recentTx: recentTx ?? [], quantum: quantum ?? [],
    beneficiaries: beneficiaries ?? [],
  };
}

// ---------- rules ----------
export function runRules(tx: any, ctx: Awaited<ReturnType<typeof loadContext>>): Signal[] {
  const signals: Signal[] = [];
  const amt = Number(tx.amount);
  const baseline = ctx.cust?.risk_baseline ?? 20;
  const currency = tx.currency || "USD";
  const large = LARGE_AMOUNT[currency] ?? 5000;
  const huge = HUGE_AMOUNT[currency] ?? 25000;
  const txTs = new Date(tx.created_at).getTime();

  // Customer-scoped telemetry (linked via metadata.customer_id from ingest)
  const mine = ctx.telem.filter((t: any) => t.metadata?.customer_id === tx.customer_id);
  const mineNear = mine.filter((t: any) => {
    const dt = txTs - new Date(t.created_at).getTime();
    return dt >= -5 * 60_000 && dt < 60 * 60_000;
  });

  // ---------- CYBER (customer-linked, prioritized) ----------
  const push = (s: Signal) => signals.push(s);
  const findCustomerEvent = (re: RegExp) => mine.find((t: any) => re.test(t.message ?? ""));
  const anyEvent = (re: RegExp) => ctx.telem.find((t: any) => re.test(t.message ?? ""));

  const vpnEvent = findCustomerEvent(/\bvpn\b/i) || ctx.sessions.find((s: any) => s.is_vpn);
  if (vpnEvent) push({
    id: "cyber.vpn_login", kind: "cyber", name: "VPN login detected",
    weight: 8, confidence: 78,
    evidence: [{ source: vpnEvent.source ?? "sessions", ref_id: vpnEvent.id, ts: vpnEvent.created_at ?? vpnEvent.started_at, note: vpnEvent.message ?? `VPN session ${vpnEvent.ip ?? ""}` }],
  });

  const torEvent = findCustomerEvent(/\btor\b/i) || ctx.sessions.find((s: any) => s.is_tor);
  if (torEvent) push({
    id: "cyber.tor_login", kind: "cyber", name: "Tor / anonymizer login",
    weight: 14, confidence: 84,
    evidence: [{ source: torEvent.source ?? "sessions", ref_id: torEvent.id, ts: torEvent.created_at ?? torEvent.started_at, note: torEvent.message ?? "Tor exit node" }],
  });

  const impossible = findCustomerEvent(/impossible travel/i) || anyEvent(/impossible travel/i);
  if (impossible) push({
    id: "cyber.impossible_travel", kind: "cyber", name: "Impossible travel detected",
    weight: 16, confidence: 92,
    evidence: [{ source: impossible.source, ref_id: impossible.id, ts: impossible.created_at, note: impossible.message }],
  });

  const simSwap = findCustomerEvent(/sim.?swap|carrier port|number port/i) || anyEvent(/sim.?swap/i);
  if (simSwap) push({
    id: "cyber.sim_swap", kind: "cyber", name: "SIM swap / carrier port detected",
    weight: 22, confidence: 90,
    evidence: [{ source: simSwap.source, ref_id: simSwap.id, ts: simSwap.created_at, note: simSwap.message }],
  });

  const malware = findCustomerEvent(/malware|beacon|c2|infostealer|ransomware|redline/i) || anyEvent(/malware|beacon|c2|infostealer|ransomware|redline/i);
  if (malware) push({
    id: "cyber.malware_beacon", kind: "cyber", name: "Malware / C2 activity on device",
    weight: 20, confidence: 90,
    evidence: [{ source: malware.source, ref_id: malware.id, ts: malware.created_at, note: malware.message }],
  });

  const mfaFatigue = findCustomerEvent(/mfa fatigue|push denials|mfa bombing/i) || anyEvent(/mfa fatigue|push denials/i);
  if (mfaFatigue) push({
    id: "cyber.mfa_fatigue", kind: "cyber", name: "MFA fatigue attack",
    weight: 14, confidence: 86,
    evidence: [{ source: mfaFatigue.source, ref_id: mfaFatigue.id, ts: mfaFatigue.created_at, note: mfaFatigue.message }],
  });

  const phishing = findCustomerEvent(/phish|credential harvest/i) || anyEvent(/phish|credential harvest/i);
  if (phishing) push({
    id: "cyber.phishing_hit", kind: "cyber", name: "Phishing / credential harvest",
    weight: 12, confidence: 80,
    evidence: [{ source: phishing.source, ref_id: phishing.id, ts: phishing.created_at, note: phishing.message }],
  });

  const authBurst = ctx.telem.filter((t: any) => /credential stuff|brute|failed login/i.test(t.message ?? ""));
  if (authBurst.length >= 3) push({
    id: "cyber.credential_stuffing", kind: "cyber", name: `Credential stuffing burst (${authBurst.length})`,
    weight: 12, confidence: 78,
    evidence: authBurst.slice(0, 3).map((t: any) => ({ source: t.source, ref_id: t.id, ts: t.created_at, note: t.message })),
  });

  const botLike = findCustomerEvent(/bot|automat|headless|selenium|puppeteer/i);
  if (botLike) push({
    id: "cyber.bot_signature", kind: "cyber", name: "Bot / automated client signature",
    weight: 10, confidence: 74,
    evidence: [{ source: botLike.source, ref_id: botLike.id, ts: botLike.created_at, note: botLike.message }],
  });

  // ---------- FRAUD ----------
  const amounts = ctx.recentTx.map((t: any) => Number(t.amount)).filter((n: number) => Number.isFinite(n));
  const mean = amounts.length ? amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length : amt;
  const std = amounts.length > 1 ? Math.sqrt(amounts.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / amounts.length) : 0;
  const z = std > 0 ? (amt - mean) / std : 0;
  if (z > 2) push({
    id: "fraud.amount_zscore", kind: "fraud", name: `Amount ${z.toFixed(1)}σ above customer baseline`,
    weight: Math.min(20, Math.round(z * 4)), confidence: 80,
    evidence: [{ source: "transactions", note: `mean ${mean.toFixed(0)}, tx ${amt}` }],
  });

  if (amt >= huge) push({
    id: "fraud.huge_amount", kind: "fraud", name: `Very large amount (${currency} ${amt.toLocaleString()})`,
    weight: 18, confidence: 82,
    evidence: [{ source: "transactions", note: `tx ${currency} ${amt}` }],
  });
  else if (amt >= large) push({
    id: "fraud.large_amount", kind: "fraud", name: `Large amount (${currency} ${amt.toLocaleString()})`,
    weight: 12, confidence: 76,
    evidence: [{ source: "transactions", note: `tx ${currency} ${amt}` }],
  });

  // rapid velocity: ≥3 tx in 10 min
  const tenMin = ctx.recentTx.filter((t: any) => Math.abs(txTs - new Date(t.created_at).getTime()) < 10 * 60_000);
  if (tenMin.length >= 3) push({
    id: "fraud.rapid_velocity", kind: "fraud", name: `${tenMin.length} transactions in 10 minutes`,
    weight: 12 + Math.min(6, tenMin.length), confidence: 88,
    evidence: tenMin.slice(0, 4).map((t: any) => ({ source: "transactions", ref_id: t.id, ts: t.created_at, note: `${t.currency ?? ""} ${t.amount} ${t.channel ?? ""}`.trim() })),
  });

  // hourly velocity (existing)
  const oneHourAgo = new Date(txTs - 3600_000);
  const recentHour = ctx.recentTx.filter((t: any) => new Date(t.created_at) > oneHourAgo);
  if (recentHour.length >= 3 && tenMin.length < 3) push({
    id: "fraud.velocity_1h", kind: "fraud", name: `Velocity: ${recentHour.length} txs in the last hour`,
    weight: 10 + recentHour.length, confidence: 82,
    evidence: recentHour.slice(0, 5).map((t: any) => ({ source: "transactions", ref_id: t.id, ts: t.created_at, note: `${t.currency ?? ""} ${t.amount} ${t.channel ?? ""}`.trim() })),
  });

  // structuring: multiple txs just under a round threshold (currency-scaled 9k boundary)
  const structFloor = large * 1.7;   // ~8.5k USD-equiv
  const structCeil = large * 2;      // ~10k USD-equiv
  const structuring = ctx.recentTx.filter((t: any) => Number(t.amount) >= structFloor && Number(t.amount) < structCeil);
  const structuringMatch = structuring.length + (amt >= structFloor && amt < structCeil ? 1 : 0);
  if (structuringMatch >= 2) push({
    id: "fraud.structuring", kind: "fraud", name: `Structuring: ${structuringMatch} txs just under reporting threshold`,
    weight: 20 + Math.min(8, structuringMatch * 2), confidence: 86,
    evidence: structuring.slice(0, 4).map((t: any) => ({ source: "transactions", ref_id: t.id, ts: t.created_at, note: `${t.currency ?? ""} ${t.amount}` })),
  });

  // dormant reactivation: no tx in 60d then large
  if (amounts.length <= 1 && amt >= large) push({
    id: "fraud.dormant_reactivation", kind: "fraud", name: "Dormant account reactivated with large transaction",
    weight: 12, confidence: 74,
    evidence: [{ source: "transactions", note: "no prior activity in 90 days" }],
  });

  // off-hours: 00:00–05:00 UTC (simple, no per-customer TZ yet)
  const hour = new Date(tx.created_at).getUTCHours();
  if (hour >= 0 && hour < 5 && amt >= large / 2) push({
    id: "fraud.off_hours", kind: "fraud", name: `Off-hours transaction (${String(hour).padStart(2, "0")}:00 UTC)`,
    weight: 6, confidence: 62,
    evidence: [{ source: "transactions", note: `hour ${hour}` }],
  });

  // new device: any untrusted or first-seen device in last 24h
  const dayAgo = Date.now() - 24 * 3600_000;
  const newDevice = ctx.devices.find((d: any) => !d.trusted || (d.last_seen && new Date(d.last_seen).getTime() > dayAgo));
  if (newDevice) push({
    id: "fraud.new_device", kind: "fraud", name: "New / untrusted device on account",
    weight: 10, confidence: 72,
    evidence: [{ source: "devices", ref_id: newDevice.id, note: `${newDevice.os ?? "?"}/${newDevice.browser ?? "?"} trusted=${!!newDevice.trusted}` }],
  });

  // geo drift
  if (tx.country && ctx.cust?.country && tx.country !== ctx.cust.country) {
    const inHigh = (HIGH_RISK_GEO as readonly string[]).includes(tx.country);
    push({
      id: inHigh ? "fraud.foreign_high_risk" : "fraud.geo_drift", kind: "fraud",
      name: inHigh ? `Transaction to high-risk geography ${tx.country}` : `Geo drift: ${ctx.cust.country} → ${tx.country}`,
      weight: inHigh ? 14 : 6, confidence: 78,
      evidence: [{ source: "customers", note: `home ${ctx.cust.country}, tx ${tx.country}` }],
    });
  }

  // wire/crypto + large
  if ((tx.channel === "wire" || tx.channel === "crypto" || tx.channel === "swift") && amt >= large) push({
    id: "fraud.wire_or_crypto_high", kind: "fraud", name: `${tx.channel.toUpperCase()} transfer at large amount`,
    weight: 10, confidence: 78,
    evidence: [{ source: "transactions", note: `${tx.channel} ${currency} ${amt}` }],
  });

  // unusual merchant
  const merchants = new Set(ctx.recentTx.map((t: any) => (t.merchant ?? "").toLowerCase()).filter(Boolean));
  if (tx.merchant && merchants.size >= 3 && !merchants.has((tx.merchant as string).toLowerCase())) push({
    id: "fraud.unusual_merchant", kind: "fraud", name: `First-seen merchant "${tx.merchant}"`,
    weight: 6, confidence: 60,
    evidence: [{ source: "transactions", note: `${merchants.size} prior distinct merchants` }],
  });

  // untrusted beneficiary
  const untrustedBen = ctx.beneficiaries.find((b: any) => b.trusted === false);
  if (untrustedBen && (tx.channel === "wire" || tx.channel === "swift")) push({
    id: "fraud.new_beneficiary_untrusted", kind: "fraud", name: `Untrusted beneficiary "${untrustedBen.name}"`,
    weight: 10, confidence: 74,
    evidence: [{ source: "beneficiaries", ref_id: untrustedBen.id, note: `${untrustedBen.country ?? "?"} ${untrustedBen.iban ?? ""}` }],
  });

  // ---------- CROSS-CORRELATION ----------
  if (ctx.iocs.length > 0 && tx.country && (HIGH_RISK_GEO as readonly string[]).includes(tx.country)) {
    const hit = ctx.iocs[0];
    push({
      id: "xcorr.ioc_touches_tx", kind: "xcorr", name: `Active IOC in tenant; tx destination in high-risk geo ${tx.country}`,
      weight: 12, confidence: 82,
      evidence: [{ source: "iocs", ref_id: hit.id, note: `${hit.type} ${hit.value}` }],
    });
  }
  const precedes = mineNear.find((t: any) => (t.severity === "critical" || t.severity === "high") && txTs - new Date(t.created_at).getTime() >= 0);
  if (precedes) push({
    id: "xcorr.cyber_precedes_tx", kind: "xcorr", name: "High/critical cyber event within 60 min before tx",
    weight: 18, confidence: 91,
    evidence: [{ source: precedes.source, ref_id: precedes.id, ts: precedes.created_at, note: precedes.message }],
  });

  // ---------- QUANTUM ----------
  const legacyRsa = ctx.quantum.filter((q: any) => (/^RSA-/i.test(q.algo ?? "") || /3DES/i.test(q.algo ?? "")) && (q.sensitivity ?? 0) >= 70);
  if (legacyRsa.length > 0 && amt >= large / 2) push({
    id: "quantum.hndl_exposure", kind: "quantum", name: `HNDL exposure: ${legacyRsa.length} legacy asset(s)`,
    weight: 10, confidence: 68,
    evidence: legacyRsa.slice(0, 3).map((q: any) => ({ source: "quantum_assets", ref_id: q.id, note: `${q.asset} · ${q.algo} · sens ${q.sensitivity}` })),
  });
  const weakTls = ctx.quantum.find((q: any) => /TLS 1\.[012]$/.test(q.tls_version ?? ""));
  if (weakTls && (tx.channel === "wire" || tx.channel === "swift")) push({
    id: "quantum.weak_cipher_endpoint", kind: "quantum", name: `Weak TLS on wire endpoint (${weakTls.tls_version})`,
    weight: 6, confidence: 60,
    evidence: [{ source: "quantum_assets", ref_id: weakTls.id, note: `${weakTls.asset} · ${weakTls.algo}` }],
  });

  // Baseline nudge
  if (baseline > 40) push({
    id: "fraud.customer_baseline", kind: "fraud", name: `Elevated customer risk baseline (${baseline})`,
    weight: Math.round(baseline / 10), confidence: 55,
    evidence: [{ source: "customers", ref_id: ctx.cust?.id, note: `baseline ${baseline}` }],
  });

  return signals;
}

// ---------- suppressions ----------
export async function applySuppressions(supabaseAdmin: any, signals: Signal[], customerId: string) {
  const { data: sups } = await supabaseAdmin
    .from("suppressions").select("signal_id, weight_multiplier, expires_at, customer_id")
    .gt("expires_at", new Date().toISOString());
  const active = (sups ?? []).filter((s: any) => !s.customer_id || s.customer_id === customerId);
  // Force-block signals cannot be suppressed below their threshold
  const UNSUPPRESSIBLE = new Set(["cyber.sim_swap", "cyber.malware_beacon"]);
  const suppressed: string[] = [];
  const adjusted = signals.map((sig) => {
    if (UNSUPPRESSIBLE.has(sig.id)) return sig;
    const s = active.find((a: any) => a.signal_id === sig.id);
    if (!s) return sig;
    suppressed.push(sig.id);
    return { ...sig, weight: Math.round(sig.weight * Number(s.weight_multiplier)) };
  });
  return { adjusted, suppressed };
}

// ---------- combo escalation ----------
function detectEscalations(signals: Signal[]) {
  const ids = new Set(signals.map((s) => s.id));
  const bonuses: Array<{ id: string; bonus: number; reason: string }> = [];

  const atoSignals = ["cyber.vpn_login", "cyber.tor_login", "cyber.impossible_travel", "cyber.sim_swap", "cyber.mfa_fatigue", "fraud.new_device"].filter((s) => ids.has(s));
  if (atoSignals.length >= 3) bonuses.push({
    id: "combo.ato_chain", bonus: 25,
    reason: `Account takeover chain: ${atoSignals.join(" + ")}`,
  });

  const hasLargeAmt = ids.has("fraud.large_amount") || ids.has("fraud.huge_amount") || ids.has("fraud.amount_zscore");
  const hasForeign = ids.has("fraud.geo_drift") || ids.has("fraud.foreign_high_risk");
  const hasWire = ids.has("fraud.wire_or_crypto_high");
  if (hasLargeAmt && hasForeign && hasWire) bonuses.push({
    id: "combo.wire_out_of_country", bonus: 20,
    reason: "Large amount + foreign destination + wire/crypto channel",
  });

  const hasCyber = signals.some((s) => s.kind === "cyber");
  const hasXcorr = ids.has("xcorr.cyber_precedes_tx");
  if (hasCyber && hasXcorr && hasLargeAmt) bonuses.push({
    id: "combo.full_kill_chain", bonus: 30,
    reason: "Full kill chain: cyber compromise → correlated timing → financial impact",
  });

  return bonuses;
}

// ---------- timeline ----------
function buildTimeline(tx: any, ctx: Awaited<ReturnType<typeof loadContext>>) {
  const txTs = new Date(tx.created_at).getTime();
  const events: ScoreResult["timeline"] = [];
  const windowMs = 60 * 60_000;

  // customer-scoped cyber
  for (const t of ctx.telem) {
    if (t.metadata?.customer_id !== tx.customer_id) continue;
    const ts = new Date(t.created_at).getTime();
    if (Math.abs(ts - txTs) > windowMs) continue;
    events.push({
      ts: t.created_at, kind: "cyber", event: t.message ?? "cyber event",
      delta_min: Math.round((ts - txTs) / 60_000), severity: t.severity,
    });
  }
  // this tx
  events.push({ ts: tx.created_at, kind: "tx", event: `${tx.channel ?? "tx"} ${tx.currency ?? ""} ${Number(tx.amount).toLocaleString()} → ${tx.country ?? "?"}`, delta_min: 0 });
  // neighboring txs
  for (const t of ctx.recentTx) {
    if (t.id === tx.id) continue;
    const ts = new Date(t.created_at).getTime();
    if (Math.abs(ts - txTs) > windowMs) continue;
    events.push({
      ts: t.created_at, kind: "tx",
      event: `${t.channel ?? "tx"} ${t.currency ?? ""} ${Number(t.amount).toLocaleString()} → ${t.country ?? "?"}`,
      delta_min: Math.round((ts - txTs) / 60_000),
    });
  }
  return events.sort((a, b) => a.delta_min - b.delta_min);
}

// ---------- main scorer ----------
export function score(tx: any, ctx: Awaited<ReturnType<typeof loadContext>>, adjustedSignals: Signal[], suppressed: string[]): ScoreResult {
  const baseSum = adjustedSignals.reduce((s, x) => s + x.weight, 0);
  const baseline = ctx.cust?.risk_baseline ?? 20;
  const baselineBonus = Math.round(baseline / 5);
  const escalations = detectEscalations(adjustedSignals);
  const escalationBonus = escalations.reduce((s, e) => s + e.bonus, 0);
  let composite = Math.min(100, Math.max(0, baseSum + baselineBonus + escalationBonus));

  // full-kill-chain sets a floor
  if (escalations.some((e) => e.id === "combo.full_kill_chain")) composite = Math.max(composite, 90);

  // force-block signals
  const ids = new Set(adjustedSignals.map((s) => s.id));
  const forceBlock = ids.has("cyber.sim_swap") || ids.has("cyber.malware_beacon") || escalations.some((e) => e.id === "combo.full_kill_chain");
  if (forceBlock) composite = Math.max(composite, 88);

  const kindWeights = adjustedSignals.reduce<Record<SignalKind, number>>(
    (acc, s) => { acc[s.kind] = (acc[s.kind] ?? 0) + s.weight; return acc; },
    { fraud: 0, cyber: 0, xcorr: 0, quantum: 0 },
  );
  let dominant: SignalKind = (Object.entries(kindWeights).sort((a, b) => b[1] - a[1])[0]?.[0] as SignalKind) ?? "fraud";
  if (escalations.some((e) => e.id === "combo.ato_chain")) dominant = "xcorr";

  const avgConf = adjustedSignals.length ? Math.round(adjustedSignals.reduce((s, x) => s + x.confidence, 0) / adjustedSignals.length) : 50;
  const calibrated = Math.round(avgConf * 0.6 + composite * 0.4);
  const band = bandFor(composite);
  const status = statusFor(band, forceBlock);

  const risk_breakdown = [
    { component: "Base signals", value: baseSum },
    { component: "Combo escalations", value: escalationBonus },
    { component: "Customer baseline", value: baselineBonus },
  ];

  const timeline = buildTimeline(tx, ctx);

  const recommended_action =
    band === "Block"
      ? "BLOCK transaction · freeze account 24h · force credential + MFA reset · notify customer via secondary channel · file SAR"
      : band === "High Risk"
        ? "HOLD for analyst review · request customer confirmation · step-up authentication before release"
        : band === "Pending Review"
          ? "Queue for analyst review · monitor next 3 transactions"
          : band === "Monitor"
            ? "Approve · flag customer for enhanced monitoring 24h"
            : "Approve — no action";

  return {
    composite, calibrated, band, status, dominant_kind: dominant,
    signals: adjustedSignals, escalations, risk_breakdown, timeline,
    recommended_action, suppressed, force_block: forceBlock,
    investigation_id: null,
  };
}

// ---------- pure scorer (no DB, no suppressions) ----------
// Used by tests and the in-app accuracy report to run the engine against
// synthetic contexts without hitting Supabase.
export type PureContext = {
  cust?: { id?: string; country?: string; risk_baseline?: number } | null;
  telem?: any[]; iocs?: any[]; sessions?: any[]; devices?: any[];
  recentTx?: any[]; quantum?: any[]; beneficiaries?: any[];
};
export function scoreOnly(tx: any, ctx: PureContext): ScoreResult {
  const fullCtx = {
    cust: ctx.cust ?? null, telem: ctx.telem ?? [], iocs: ctx.iocs ?? [],
    sessions: ctx.sessions ?? [], devices: ctx.devices ?? [],
    recentTx: ctx.recentTx ?? [], quantum: ctx.quantum ?? [],
    beneficiaries: ctx.beneficiaries ?? [],
  } as any;
  const signals = runRules(tx, fullCtx);
  return score(tx, fullCtx, signals, []);
}

// ---------- persist ----------
export async function scoreAndPersist(supabaseAdmin: any, txId: string): Promise<ScoreResult> {
  const { data: tx, error: txErr } = await supabaseAdmin.from("transactions").select("*").eq("id", txId).maybeSingle();
  if (txErr || !tx) throw new Error("Transaction not found");
  const ctx = await loadContext(supabaseAdmin, tx);
  const raw = runRules(tx, ctx);
  const { adjusted, suppressed } = await applySuppressions(supabaseAdmin, raw, tx.customer_id);
  const result = score(tx, ctx, adjusted, suppressed);

  await supabaseAdmin.from("risk_scores").insert({
    transaction_id: tx.id, customer_id: tx.customer_id, composite: result.composite,
    contributors: result.signals.map((s) => ({ name: s.name, weight: s.weight, kind: s.kind, id: s.id })),
  });

  await supabaseAdmin.from("transactions").update({
    risk_score: result.composite, status: result.status,
  }).eq("id", tx.id);

  let investigationId: string | null = null;
  if (result.composite >= 50 || result.force_block) {
    const severity = result.band === "Block" ? "critical" : result.band === "High Risk" ? "high" : "medium";
    const attackType =
      result.dominant_kind === "quantum" ? "Post-quantum exposure on live payment path"
      : result.dominant_kind === "cyber" ? "Cyber-led compromise preceding financial action"
      : result.dominant_kind === "xcorr" ? "Correlated cyber + fraud attack chain"
      : result.band === "Block" ? "Suspected Account Takeover / APP fraud" : "Anomalous transaction";

    const explanation = {
      composite: result.composite, band: result.band,
      calibrated_confidence: result.calibrated, dominant_kind: result.dominant_kind,
      signals: result.signals, escalations: result.escalations,
      risk_breakdown: result.risk_breakdown, timeline: result.timeline,
      recommended_action: result.recommended_action, suppressed,
    };

    const { data: inv } = await supabaseAdmin.from("ai_investigations").insert({
      transaction_id: tx.id, customer_id: tx.customer_id,
      title: `${result.band} · risk ${result.composite} · ${result.dominant_kind.toUpperCase()} · ${tx.channel ?? "?"} → ${tx.country ?? "?"}`,
      confidence: Math.min(99, result.composite + 3),
      calibrated_confidence: result.calibrated,
      attack_type: attackType,
      business_impact: Number(tx.amount),
      root_cause: `${result.band} · composite ${result.composite} from ${result.signals.length} signals + ${result.escalations.length} escalation(s). Dominant: ${result.dominant_kind}. Suppressed: ${suppressed.length}.`,
      evidence: result.signals.map((s) => ({ ts: s.evidence[0]?.ts ?? new Date().toISOString(), source: s.evidence[0]?.source ?? s.kind, event: s.name, weight: s.weight, signal_id: s.id })),
      explanation, risk_factors: result.signals.map((s) => s.name),
      recommended_actions: [result.recommended_action],
      compliance: result.band === "Block" ? ["PSD2 SCA review", "AML SAR filing", "DORA incident report"] : ["Manual review"],
      status: "open",
      band: result.band, risk_breakdown: result.risk_breakdown, timeline: result.timeline,
    }).select("id").single();

    investigationId = inv?.id ?? null;

    await supabaseAdmin.from("alerts").insert({
      transaction_id: tx.id, customer_id: tx.customer_id, investigation_id: investigationId,
      severity,
      title: `${result.band}: ${tx.channel ?? "tx"} ${tx.currency ?? ""} ${Number(tx.amount).toLocaleString()} → ${tx.country ?? "?"}`,
      source: "correlation-engine", status: "open",
      sla_minutes: severity === "critical" ? 15 : severity === "high" ? 30 : 60,
    });

    if (result.band === "Block" || result.band === "High Risk") {
      await supabaseAdmin.from("notifications").insert({
        title: result.band === "Block" ? "Critical alert" : "High-risk alert",
        body: `${result.band} · ${tx.currency ?? ""} ${Number(tx.amount).toLocaleString()} → ${tx.country ?? "?"}`,
        severity,
      });
    }
  }

  return { ...result, investigation_id: investigationId };
}
