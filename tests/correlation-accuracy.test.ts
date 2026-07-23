// Accuracy test harness for the SentinelQ correlation engine.
// Runs the pure scoreOnly() against a labeled corpus and asserts each case
// lands in its expected band. Also prints a confusion matrix + category
// accuracy summary so tuning changes are visible in CI output.
import { describe, it, expect } from "vitest";
import { scoreOnly, bandFor, type Band } from "@/lib/correlation-core.server";

// ---------- ctx builders ----------
const now = Date.now();
const iso = (offsetMin = 0) => new Date(now + offsetMin * 60_000).toISOString();

function tx(over: any) {
  return {
    id: over.id ?? "tx-x", customer_id: "cust-1",
    amount: 100, currency: "USD", channel: "card",
    merchant: "Shop", country: "US", created_at: iso(0),
    ...over,
  };
}
function cust(over: any = {}) {
  return { id: "cust-1", country: "US", risk_baseline: 20, ...over };
}
function cyber(msg: string, sev = "high", offsetMin = -10, customerId: string | null = "cust-1") {
  return {
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    source: "endpoint", severity: sev, message: msg,
    created_at: iso(offsetMin),
    metadata: { customer_id: customerId },
  };
}

// ---------- labeled corpus ----------
type Case = {
  name: string; category: string;
  expected_band: Band; min?: number; max?: number;
  build: () => { tx: any; ctx: Parameters<typeof scoreOnly>[1] };
};

const CASES: Case[] = [
  // ----- Normal -----
  { name: "domestic small card", category: "normal", expected_band: "Approved",
    build: () => ({ tx: tx({ amount: 45, merchant: "Grocery" }), ctx: { cust: cust() } }) },
  { name: "recurring subscription", category: "normal", expected_band: "Approved",
    build: () => ({ tx: tx({ amount: 12, merchant: "Netflix" }),
      ctx: { cust: cust(), recentTx: [{ amount: 12, merchant: "Netflix", currency: "USD", created_at: iso(-30 * 24 * 60) }] } }) },
  { name: "payroll credit small", category: "normal", expected_band: "Approved",
    build: () => ({ tx: tx({ amount: 30, channel: "card" }), ctx: { cust: cust() } }) },
  { name: "medium routine card", category: "normal", expected_band: "Approved",
    build: () => ({ tx: tx({ amount: 200, merchant: "Amazon" }), ctx: { cust: cust() } }) },

  // ----- Low / monitor -----
  { name: "geo drift small", category: "low", expected_band: "Monitor",
    build: () => ({ tx: tx({ amount: 300, country: "GB" }), ctx: { cust: cust({ country: "US" }) } }) },
  { name: "vpn only small tx", category: "low", expected_band: "Monitor",
    build: () => ({ tx: tx({ amount: 250 }), ctx: { cust: cust(), telem: [cyber("VPN login detected", "medium")] } }) },

  // ----- Pending Review -----
  { name: "large amount + new device", category: "pending", expected_band: "Pending Review",
    build: () => ({ tx: tx({ amount: 6000 }), ctx: {
      cust: cust(),
      devices: [{ id: "d1", trusted: false, os: "Android", browser: "Chrome", last_seen: iso(-30) }],
    } }) },
  { name: "large wire domestic", category: "pending", expected_band: "Pending Review",
    build: () => ({ tx: tx({ amount: 8000, channel: "wire" }), ctx: { cust: cust() } }) },
  { name: "off-hours + medium", category: "pending", expected_band: "Pending Review",
    build: () => ({
      tx: tx({ amount: 4000, created_at: new Date(new Date().setUTCHours(2, 30, 0, 0)).toISOString() }),
      ctx: { cust: cust(), devices: [{ trusted: false, os: "Windows" }] } }) },

  // ----- High Risk -----
  { name: "vpn + impossible travel + wire", category: "high", expected_band: "High Risk",
    build: () => ({ tx: tx({ amount: 7000, channel: "wire", country: "AE" }), ctx: {
      cust: cust(), telem: [cyber("VPN login detected", "high"), cyber("Impossible travel detected", "high", -5)],
    } }) },
  { name: "phishing then wire abroad", category: "high", expected_band: "High Risk",
    build: () => ({ tx: tx({ amount: 6000, channel: "wire", country: "RU" }), ctx: {
      cust: cust(), telem: [cyber("Phishing credential harvest confirmed", "high", -25)],
    } }) },
  { name: "credential stuffing + card", category: "high", expected_band: "High Risk",
    build: () => ({ tx: tx({ amount: 5500 }), ctx: {
      cust: cust(), telem: [
        cyber("Credential stuffing failed login", "high", -30),
        cyber("Credential stuffing failed login", "high", -29),
        cyber("Credential stuffing failed login", "high", -28),
      ],
      devices: [{ trusted: false, os: "Linux" }],
    } }) },
  { name: "structuring pattern", category: "high", expected_band: "High Risk",
    build: () => ({ tx: tx({ amount: 9500, channel: "wire" }), ctx: {
      cust: cust(), recentTx: [
        { amount: 9200, currency: "USD", channel: "wire", created_at: iso(-60) },
        { amount: 9400, currency: "USD", channel: "wire", created_at: iso(-30) },
        { amount: 9500, currency: "USD", channel: "wire", created_at: iso(-5) },
      ],
    } }) },

  // ----- Block (force) -----
  { name: "sim swap + wire", category: "block", expected_band: "Block",
    build: () => ({ tx: tx({ amount: 12000, channel: "wire", country: "AE" }), ctx: {
      cust: cust(), telem: [cyber("SIM swap detected on carrier port", "critical", -15)],
      devices: [{ trusted: false, os: "Android" }],
    } }) },
  { name: "malware beacon + wire", category: "block", expected_band: "Block",
    build: () => ({ tx: tx({ amount: 15000, channel: "wire", country: "RU" }), ctx: {
      cust: cust(), telem: [cyber("RedLine infostealer executed on endpoint", "critical", -20)],
    } }) },
  { name: "full kill chain: ato + xcorr + large", category: "block", expected_band: "Block",
    build: () => ({ tx: tx({ amount: 30000, channel: "wire", country: "CN" }), ctx: {
      cust: cust(), telem: [
        cyber("VPN login detected", "high", -20),
        cyber("Impossible travel detected", "high", -15),
        cyber("New device registered for MFA", "high", -8),
        cyber("MFA fatigue: 14 push denials in 3 minutes", "high", -3),
      ],
      devices: [{ trusted: false, os: "Windows" }],
    } }) },
  { name: "tor + wire abroad + large", category: "block", expected_band: "Block",
    build: () => ({ tx: tx({ amount: 25000, channel: "wire", country: "NG" }), ctx: {
      cust: cust(), telem: [
        cyber("Tor exit node login", "high", -10),
        cyber("Impossible travel detected", "high", -5),
      ],
      devices: [{ trusted: false }],
    } }) },

  // ----- Adversarial (should NOT overfire) -----
  { name: "legit VPN traveler small", category: "adversarial_normal", expected_band: "Monitor",
    build: () => ({ tx: tx({ amount: 200 }), ctx: { cust: cust(), telem: [cyber("VPN login detected", "medium", -2)] } }) },
  { name: "expected payroll (large but domestic + recurring)", category: "adversarial_normal", expected_band: "Pending Review",
    build: () => ({ tx: tx({ amount: 8000, channel: "wire", merchant: "Payroll" }),
      ctx: { cust: cust(), recentTx: Array.from({ length: 6 }, (_, i) => ({ amount: 8000, currency: "USD", channel: "wire", merchant: "Payroll", created_at: iso(-i * 30 * 24 * 60) })) } }) },
  { name: "new merchant tiny amount", category: "adversarial_normal", expected_band: "Approved",
    build: () => ({ tx: tx({ amount: 8, merchant: "Coffee" }),
      ctx: { cust: cust(), recentTx: [
        { amount: 30, merchant: "A", currency: "USD", created_at: iso(-2000) },
        { amount: 25, merchant: "B", currency: "USD", created_at: iso(-3000) },
        { amount: 40, merchant: "C", currency: "USD", created_at: iso(-4000) },
      ] } }) },

  // ----- Quantum -----
  { name: "hndl on legacy wire", category: "quantum", expected_band: "Pending Review",
    build: () => ({ tx: tx({ amount: 5000, channel: "wire" }), ctx: {
      cust: cust(),
      quantum: [{ id: "q1", asset: "core-banking", algo: "RSA-2048", sensitivity: 85, tls_version: "TLS 1.2" }],
    } }) },
];

// ---------- runner ----------
type Row = { name: string; category: string; expected: Band; got: Band; composite: number; pass: boolean };

describe("correlation engine accuracy", () => {
  const rows: Row[] = [];
  for (const c of CASES) {
    it(`${c.category}/${c.name} → ${c.expected_band}`, () => {
      const { tx, ctx } = c.build();
      const r = scoreOnly(tx, ctx);
      rows.push({ name: c.name, category: c.category, expected: c.expected_band, got: r.band, composite: r.composite, pass: r.band === c.expected_band });
      // one-band tolerance: never approve a High/Block case, never block an Approved case.
      const ORDER: Band[] = ["Approved", "Monitor", "Pending Review", "High Risk", "Block"];
      const gotIdx = ORDER.indexOf(r.band);
      const expIdx = ORDER.indexOf(c.expected_band);
      expect(Math.abs(gotIdx - expIdx), `${c.name}: expected ${c.expected_band} got ${r.band} (score ${r.composite})`).toBeLessThanOrEqual(1);
      if (c.min !== undefined) expect(r.composite).toBeGreaterThanOrEqual(c.min);
      if (c.max !== undefined) expect(r.composite).toBeLessThanOrEqual(c.max);
    });
  }

  it("aggregate: overall accuracy + safety", () => {
    const exact = rows.filter((r) => r.pass).length;
    const acc = exact / rows.length;
    // FPR on normals: cases where expected is Approved but engine escalated ≥ High Risk
    const normals = rows.filter((r) => r.category === "normal" || r.category === "adversarial_normal");
    const fpr = normals.filter((r) => r.got === "High Risk" || r.got === "Block").length / Math.max(1, normals.length);
    // Miss rate on blocks: expected Block but engine approved/monitored
    const blocks = rows.filter((r) => r.expected === "Block");
    const missed = blocks.filter((r) => r.got === "Approved" || r.got === "Monitor").length / Math.max(1, blocks.length);

    // Print summary (visible in vitest output)
    const bandCounts: Record<string, number> = {};
    for (const r of rows) bandCounts[`${r.expected}→${r.got}`] = (bandCounts[`${r.expected}→${r.got}`] ?? 0) + 1;
    // eslint-disable-next-line no-console
    console.log(`\n[accuracy] exact=${(acc * 100).toFixed(1)}% (${exact}/${rows.length})  FPR-on-normal=${(fpr * 100).toFixed(1)}%  block-miss=${(missed * 100).toFixed(1)}%`);
    // eslint-disable-next-line no-console
    console.table(rows.map((r) => ({ category: r.category, name: r.name, expected: r.expected, got: r.got, score: r.composite, ok: r.pass ? "✓" : "✗" })));

    expect(acc, `overall exact-band accuracy below 70%`).toBeGreaterThanOrEqual(0.7);
    expect(fpr, `FPR on normal cases above 5%`).toBeLessThanOrEqual(0.05);
    expect(missed, `missed blocks above 0%`).toBeLessThanOrEqual(0);
  });

  it("band thresholds contract", () => {
    expect(bandFor(0)).toBe("Approved");
    expect(bandFor(29)).toBe("Approved");
    expect(bandFor(30)).toBe("Monitor");
    expect(bandFor(50)).toBe("Pending Review");
    expect(bandFor(70)).toBe("High Risk");
    expect(bandFor(85)).toBe("Block");
    expect(bandFor(100)).toBe("Block");
  });
});
