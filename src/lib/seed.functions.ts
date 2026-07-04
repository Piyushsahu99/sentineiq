// Deterministic seed data generator for SentinelQ smoke tests.
//
// Every row uses a stable v5-style UUID derived from a fixed namespace + key,
// so re-running the seed is idempotent (ON CONFLICT DO UPDATE) and produces
// byte-identical primary keys across environments. Timestamps are anchored to
// SEED_ANCHOR (a fixed instant, NOT `now()`), and all PRNG calls go through a
// mulberry32 stream seeded with a constant. Two smoke runs against a fresh
// database → identical composite risk, identical investigation payload,
// identical alert titles.
//
// Scenarios:
//   - "baseline"  : quiet tenant, low-risk telemetry + tx (composite < 40)
//   - "high_risk" : critical telemetry burst + $47,500 wire to RU
//                   (composite must be >= 85 → BLOCKED + investigation + alert)
//   - "reset"     : deletes everything tagged `seed:*` and returns
//
// The generator ONLY touches rows it owns (source starts with `seed:` or
// merchant starts with `seed:`), so it is safe to run against a tenant that
// also has live data.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  scenario: z.enum(["baseline", "high_risk", "reset"]).default("high_risk"),
});

// Fixed anchor: 2026-01-01T12:00:00Z. All seeded rows are offset from this.
const SEED_ANCHOR = Date.parse("2026-01-01T12:00:00Z");
const SEED_NAMESPACE = "sentinelq-seed-v1";

// ---------- deterministic UUID (name-based, v5-like using SHA-1) ----------
async function seedUuid(key: string): Promise<string> {
  const enc = new TextEncoder().encode(`${SEED_NAMESPACE}:${key}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", enc));
  // Force version 5 + RFC-4122 variant so Postgres accepts it as a valid uuid.
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ---------- deterministic PRNG ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rng: () => number, arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];
const iso = (offsetMinutes: number) => new Date(SEED_ANCHOR + offsetMinutes * 60_000).toISOString();

export const seedDeterministic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ---- 1. Wipe prior seed rows (marker: source or merchant prefix "seed:") ----
    await supabaseAdmin.from("alerts").delete().eq("source", "seed:correlation");
    await supabaseAdmin.from("ai_investigations").delete().like("title", "seed:%");
    await supabaseAdmin.from("risk_scores").delete().in(
      "transaction_id",
      // subquery workaround: fetch seeded tx ids first
      (await supabaseAdmin.from("transactions").select("id").like("merchant", "seed:%")).data?.map((r) => r.id) ?? ["00000000-0000-0000-0000-000000000000"],
    );
    await supabaseAdmin.from("transactions").delete().like("merchant", "seed:%");
    await supabaseAdmin.from("cyber_telemetry").delete().like("source", "seed:%");
    await supabaseAdmin.from("iocs").delete().like("value", "seed:%");
    await supabaseAdmin.from("threat_intel").delete().like("name", "seed:%");
    await supabaseAdmin.from("customers").delete().like("email", "seed+%@sentinelq.test");

    if (data.scenario === "reset") return { scenario: "reset", cleared: true };

    // ---- 2. Fixed customers ----
    const rng = mulberry32(data.scenario === "high_risk" ? 0xC0FFEE : 0xBADA55);

    const customerA = {
      id: await seedUuid("customer:a"),
      full_name: "Jonathan Watson",
      email: "seed+watson@sentinelq.test",
      country: "GB",
      segment: "Wealth",
      risk_baseline: data.scenario === "high_risk" ? 55 : 15,
      created_at: iso(-60 * 24 * 90),
    };
    const customerB = {
      id: await seedUuid("customer:b"),
      full_name: "Priya Ramanathan",
      email: "seed+priya@sentinelq.test",
      country: "IN",
      segment: "Retail",
      risk_baseline: 20,
      created_at: iso(-60 * 24 * 30),
    };
    await supabaseAdmin.from("customers").upsert([customerA, customerB]);

    // ---- 3. Threat intel + IOC (deterministic) ----
    const threat = {
      id: await seedUuid("threat:fin7"),
      kind: "campaign",
      name: "seed:FIN7-Wire-24Q4",
      origin_country: "RU",
      severity: "critical",
      description: "Seeded threat campaign used by smoke tests.",
      first_seen: iso(-60 * 24 * 14),
    };
    await supabaseAdmin.from("threat_intel").upsert(threat);
    await supabaseAdmin.from("iocs").upsert({
      id: await seedUuid("ioc:ip1"),
      type: "IP",
      value: "seed:185.220.101.44",
      severity: "high",
      threat_id: threat.id,
      seen_count: 42,
      last_seen: iso(-30),
    });

    // ---- 4. Telemetry burst ----
    const telemetryCount = data.scenario === "high_risk" ? 12 : 6;
    const telemetry = Array.from({ length: telemetryCount }, (_, i) => {
      const severity = data.scenario === "high_risk"
        ? (i < 3 ? "critical" : i < 7 ? "high" : "medium")
        : pick(rng, ["low", "medium", "info"] as const);
      return {
        id: undefined as unknown as string, // let DB assign; telemetry is append-only
        source: `seed:${pick(rng, ["EDR", "IAM", "VPN", "Firewall"] as const)}`,
        severity,
        user_ref: customerA.email,
        device: `seed-dev-${i}`,
        ip: "185.220.101.44",
        message: data.scenario === "high_risk"
          ? pick(rng, [
              "RedLine infostealer executed on endpoint",
              "MFA fatigue: 14 push denials in 3 minutes",
              "Impossible travel: London → Amsterdam in 4 min",
              "Beaconing pattern to known C2 (jitter 30s)",
            ] as const)
          : "Routine authentication event",
        risk_score: severity === "critical" ? 95 : severity === "high" ? 78 : 30,
        metadata: { seeded: true, scenario: data.scenario, index: i },
        created_at: iso(-i * 2),
      };
    });
    // strip undefined id so DB generates a fresh one (idempotent because we deleted first)
    await supabaseAdmin.from("cyber_telemetry").insert(telemetry.map(({ id: _id, ...rest }) => rest));

    // ---- 5. Deterministic transactions ----
    const txs = data.scenario === "high_risk"
      ? [
          {
            id: await seedUuid("tx:high"),
            customer_id: customerA.id,
            amount: 47500,
            currency: "USD",
            channel: "wire",
            merchant: "seed:Unknown NL beneficiary",
            country: "RU",
            status: "pending",
            created_at: iso(0),
          },
          {
            id: await seedUuid("tx:mid"),
            customer_id: customerA.id,
            amount: 8200,
            currency: "USD",
            channel: "crypto",
            merchant: "seed:Binance deposit",
            country: "AE",
            status: "pending",
            created_at: iso(-5),
          },
        ]
      : [
          {
            id: await seedUuid("tx:baseline-1"),
            customer_id: customerB.id,
            amount: 120,
            currency: "USD",
            channel: "card",
            merchant: "seed:Amazon",
            country: "US",
            status: "approved",
            created_at: iso(-2),
          },
        ];
    await supabaseAdmin.from("transactions").upsert(txs);

    return {
      scenario: data.scenario,
      anchor: new Date(SEED_ANCHOR).toISOString(),
      customers: [customerA.id, customerB.id],
      transactions: txs.map((t) => ({ id: t.id, amount: t.amount, country: t.country, channel: t.channel })),
      telemetry_count: telemetry.length,
      // Expected composite risk when correlateTransaction is called on the
      // high-risk transaction with the deterministic scoring path:
      //   amount weight (min 25) + country RU (15) + wire >5k (10)
      //   + baseline 55 (8) + critical telem (12) + high telem>2 (8)
      //   + baseline/5 (11) = 89  →  BLOCKED + critical alert.
      expected_high_risk_composite: data.scenario === "high_risk" ? 89 : null,
    };
  });
