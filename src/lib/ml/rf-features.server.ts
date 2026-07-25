// Feature vector construction for the RF classifier. Mirrors ml/features.py
// (built inline in ml/train_rf.py). Kept in sync by the parity test.
// Server-only: uses the same PureContext shape as scoreOnly().

import type { PureContext } from "../correlation-core.server";
import { HIGH_RISK_GEO } from "../correlation-core.server";
import { N_FEATURES } from "./rf-infer.server";

const LARGE_AMOUNT: Record<string, number> = {
  USD: 5000, EUR: 4600, GBP: 4000, INR: 100000, AED: 18000, SGD: 6700, JPY: 750000,
};

function amountUsdEquiv(amount: number, currency: string): number {
  // rough peg to USD via LARGE_AMOUNT ratio (5000 USD ≈ 100000 INR)
  const base = LARGE_AMOUNT[currency] ?? 5000;
  return (amount / base) * 5000;
}

/** Returns a Float32Array of length N_FEATURES for RF inference. */
export function buildFeatures(tx: any, ctx: PureContext): Float32Array {
  const f = new Float32Array(N_FEATURES);
  const amt = Number(tx.amount) || 0;
  const currency = tx.currency || "USD";
  const usdAmt = amountUsdEquiv(amt, currency);

  const recentTx = ctx.recentTx ?? [];
  const telem = ctx.telem ?? [];
  const devices = ctx.devices ?? [];

  const mine = telem.filter((t: any) => t.metadata?.customer_id === tx.customer_id);
  const msgs = mine.map((t: any) => (t.message ?? "").toLowerCase());
  const hit = (re: RegExp) => msgs.some((m: string) => re.test(m)) ? 1 : 0;

  // 0 amount_log (USD equiv)
  f[0] = Math.log1p(usdAmt);
  // 1 amount_zscore vs 90-day history
  const amounts = recentTx.map((t: any) => Number(t.amount)).filter((n: number) => Number.isFinite(n));
  if (amounts.length > 1) {
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const std = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
    f[1] = std > 0 ? Math.max(-6, Math.min(6, (amt - mean) / std)) : 0;
  }
  // 2 is_wire
  f[2] = (tx.channel === "wire" || tx.channel === "swift" || tx.channel === "crypto") ? 1 : 0;
  // 3 is_foreign
  const home = ctx.cust?.country;
  f[3] = tx.country && home && tx.country !== home ? 1 : 0;
  // 4 is_offhours (00-05 UTC)
  const dt = new Date(tx.created_at);
  const hour = dt.getUTCHours();
  f[4] = hour >= 0 && hour < 5 ? 1 : 0;
  // 5 is_weekend
  const dow = dt.getUTCDay();
  f[5] = dow === 0 || dow === 6 ? 1 : 0;
  // 6 geo_drift proxy (USD amount if foreign, else 0 — no real km data)
  f[6] = f[3] === 1 ? usdAmt : 0;
  // 7 new_device
  const dayAgo = Date.now() - 24 * 3600_000;
  f[7] = devices.some((d: any) => !d.trusted || (d.last_seen && new Date(d.last_seen).getTime() > dayAgo)) ? 1 : 0;
  // 8 untrusted_device
  f[8] = devices.some((d: any) => d.trusted === false) ? 1 : 0;
  // 9 device_count_30d
  f[9] = devices.length;
  // 10-16 cyber flags
  f[10] = hit(/\bvpn\b/);
  f[11] = hit(/\btor\b/);
  f[12] = hit(/impossible travel/);
  f[13] = hit(/sim.?swap|carrier port|number port/);
  f[14] = hit(/mfa fatigue|push denials|mfa bombing/);
  f[15] = hit(/malware|beacon|c2|infostealer|ransomware|redline/);
  f[16] = hit(/phish|credential harvest/);
  // 17 credential_stuffing_count
  f[17] = telem.filter((t: any) => /credential stuff|brute|failed login/i.test(t.message ?? "")).length;
  // 18 tx_velocity_1h
  const txTs = new Date(tx.created_at).getTime();
  f[18] = recentTx.filter((t: any) => Math.abs(txTs - new Date(t.created_at).getTime()) < 3600_000).length;
  // 19 tx_velocity_24h
  f[19] = recentTx.filter((t: any) => Math.abs(txTs - new Date(t.created_at).getTime()) < 24 * 3600_000).length;
  // 20 structuring_score: ratio of prior txs in 8.5k-10k USD-equiv band
  const large = LARGE_AMOUNT[currency] ?? 5000;
  const floor = large * 1.7, ceil = large * 2;
  const struct = recentTx.filter((t: any) => Number(t.amount) >= floor && Number(t.amount) < ceil).length + (amt >= floor && amt < ceil ? 1 : 0);
  f[20] = Math.min(1, struct / 4);
  // 21 dormant_days: age of most recent tx
  const newest = recentTx.reduce((m: number, t: any) => Math.max(m, new Date(t.created_at).getTime()), 0);
  f[21] = newest ? Math.min(90, Math.round((txTs - newest) / (24 * 3600_000))) : 45;
  // 22 merchant_novelty: 1 if first-seen merchant
  const merchants = new Set(recentTx.map((t: any) => (t.merchant ?? "").toLowerCase()).filter(Boolean));
  f[22] = tx.merchant && !merchants.has((tx.merchant as string).toLowerCase()) ? 1 : 0;
  // 23 quantum_hndl_exposure: 1 if legacy RSA + wire + large
  const legacyQuantum = (ctx.quantum ?? []).some((q: any) => /^RSA-/i.test(q.algo ?? "") && (q.sensitivity ?? 0) >= 70);
  f[23] = legacyQuantum && f[2] === 1 && usdAmt >= 2500 ? 1 : 0;

  return f;
}

/** Convenience: is destination geo high-risk (used by callers, not the model). */
export function isHighRiskGeo(country?: string): boolean {
  return !!country && (HIGH_RISK_GEO as readonly string[]).includes(country);
}
