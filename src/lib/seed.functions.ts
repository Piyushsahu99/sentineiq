// Deterministic seed data generator for SentinelQ.
//
// Idempotent: re-running clears prior `seed:*`-tagged rows and re-inserts.
// Produces enough data across every table for the dashboard, alerts,
// investigations, telemetry, transactions, threat-intel, correlation, and
// behaviour pages to look fully populated on first login.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  scenario: z.enum(["baseline", "high_risk", "reset", "demo"]).default("demo"),
});

// Fixed anchor: 2026-01-01T12:00:00Z. All seeded rows are offset from this.
const SEED_ANCHOR = Date.parse("2026-01-01T12:00:00Z");
const SEED_NAMESPACE = "sentinelq-seed-v1";

// ---------- deterministic UUID (name-based, v5-like using SHA-1) ----------
async function seedUuid(key: string): Promise<string> {
  const enc = new TextEncoder().encode(`${SEED_NAMESPACE}:${key}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", enc));
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

// ---------- data pools ----------
const COUNTRIES = ["US", "GB", "DE", "FR", "JP", "IN", "BR", "RU", "CN", "NG", "AE", "NL", "IR", "VN"] as const;
const HIGH_RISK = ["RU", "CN", "NG", "AE", "IR", "VN"] as const;
const CHANNELS = ["wire", "crypto", "card", "ach", "swift"] as const;
const MERCHANTS = [
  "Amazon", "Apple", "Uber", "Airbnb", "Shell", "Costco", "Walmart",
  "Binance deposit", "Unknown NL beneficiary", "OFX FX transfer",
  "Netflix", "Stripe", "Deliveroo", "Steam", "PayPal cashout",
] as const;
const SOURCES = ["EDR", "IAM", "VPN", "Firewall", "DNS", "Email", "Cloud", "Auth"] as const;
const TELEM_MSGS = {
  critical: [
    "RedLine infostealer executed on endpoint",
    "MFA fatigue: 14 push denials in 3 minutes",
    "Impossible travel: London → Amsterdam in 4 min",
    "Beaconing pattern to known C2 (jitter 30s)",
    "Kerberoasting attempt on domain controller",
    "Ransomware precursor: vssadmin delete shadows",
  ],
  high: [
    "Suspicious PowerShell base64 payload",
    "Unusual sudo escalation off-hours",
    "OAuth consent to unverified 3rd-party app",
    "Large outbound transfer to Tor exit node",
    "Multiple failed logins from datacenter ASN",
  ],
  medium: [
    "New device registered for MFA",
    "GeoIP mismatch on login",
    "Firewall block: inbound SMB scan",
    "DNS request to newly-registered domain",
  ],
  low: ["Password changed", "Session refreshed from mobile", "Cloud storage share extended"],
  info: ["Routine authentication event", "Scheduled backup completed", "Cert renewed"],
} as const;
const INVESTIGATIONS = [
  { attack: "Account Takeover", cause: "Credential stuffing succeeded from residential proxy" },
  { attack: "APP Fraud", cause: "Social-engineered wire to attacker-controlled account" },
  { attack: "Insider Data Exfil", cause: "Analyst downloaded 8GB customer PII to personal cloud" },
  { attack: "Ransomware Precursor", cause: "Cobalt Strike beacon on finance-team laptop" },
  { attack: "BEC / Invoice Fraud", cause: "Spoofed CFO email redirecting AP payment" },
  { attack: "Card-not-present Fraud", cause: "Enumeration attack against payment API" },
];

export const seedDeterministic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ---- 1. Wipe prior seed rows (markers) ----
    const priorTxIds =
      (await supabaseAdmin.from("transactions").select("id").like("merchant", "seed:%")).data?.map((r) => r.id) ?? [];
    const idFilter = priorTxIds.length ? priorTxIds : ["00000000-0000-0000-0000-000000000000"];
    await supabaseAdmin.from("notifications").delete().like("body", "seed:%");
    await supabaseAdmin.from("alerts").delete().in("transaction_id", idFilter);
    await supabaseAdmin.from("alerts").delete().like("source", "seed:%");
    await supabaseAdmin.from("ai_investigations").delete().in("transaction_id", idFilter);
    await supabaseAdmin.from("risk_scores").delete().in("transaction_id", idFilter);
    await supabaseAdmin.from("transactions").delete().like("merchant", "seed:%");
    await supabaseAdmin.from("cyber_telemetry").delete().like("source", "seed:%");
    await supabaseAdmin.from("iocs").delete().like("value", "seed:%");
    await supabaseAdmin.from("threat_intel").delete().like("name", "seed:%");
    await supabaseAdmin.from("knowledge_edges").delete().eq("src_type", "seed");
    await supabaseAdmin.from("quantum_assets").delete().like("asset", "seed:%");
    await supabaseAdmin.from("sessions").delete().like("city", "seed:%");
    await supabaseAdmin.from("devices").delete().like("fingerprint", "seed:%");
    await supabaseAdmin.from("beneficiaries").delete().like("name", "seed:%");
    await supabaseAdmin.from("customers").delete().like("email", "seed+%@sentinelq.test");

    if (data.scenario === "reset") return { scenario: "reset", cleared: true };

    const rng = mulberry32(
      data.scenario === "high_risk" ? 0xc0ffee : data.scenario === "baseline" ? 0xbada55 : 0x5eed01,
    );

    // ---- 2. Customers ----
    const customers = await Promise.all(
      Array.from({ length: 8 }, async (_, i) => ({
        id: await seedUuid(`customer:${i}`),
        full_name: pick(rng, [
          "Jonathan Watson", "Priya Ramanathan", "Marco Bianchi", "Aiko Tanaka",
          "Sofia Alvarez", "Liam O'Connor", "Fatima Al-Zahra", "Chen Wei",
        ]),
        email: `seed+cust${i}@sentinelq.test`,
        country: pick(rng, COUNTRIES),
        segment: pick(rng, ["Retail", "Wealth", "SMB", "Corporate"]),
        risk_baseline: 15 + Math.floor(rng() * 60),
        created_at: iso(-60 * 24 * (30 + i * 15)),
      })),
    );
    await supabaseAdmin.from("customers").upsert(customers);

    // ---- 3. Threat intel + IOCs ----
    const threats = await Promise.all(
      [
        { name: "seed:FIN7-Wire-24Q4", country: "RU", sev: "critical" },
        { name: "seed:Scattered-Spider-2026", country: "US", sev: "high" },
        { name: "seed:Lazarus-Crypto-Ops", country: "CN", sev: "critical" },
        { name: "seed:LockBit-Reboot", country: "RU", sev: "high" },
      ].map(async (t, i) => ({
        id: await seedUuid(`threat:${i}`),
        kind: "campaign",
        name: t.name,
        origin_country: t.country,
        severity: t.sev,
        description: `Seeded ${t.name} campaign tracked by SentinelQ.`,
        first_seen: iso(-60 * 24 * (7 + i * 3)),
      })),
    );
    await supabaseAdmin.from("threat_intel").upsert(threats);

    const iocs = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => ({
        id: await seedUuid(`ioc:${i}`),
        type: pick(rng, ["IP", "domain", "hash", "url"] as const),
        value: `seed:${pick(rng, ["185.220.101.44", "malicious.example.ru", "a1b2c3d4e5f6", "phish.co/login"] as const)}-${i}`,
        severity: pick(rng, ["critical", "high", "medium"] as const),
        threat_id: threats[i % threats.length].id,
        seen_count: 10 + Math.floor(rng() * 200),
        last_seen: iso(-i * 30),
      })),
    );
    await supabaseAdmin.from("iocs").upsert(iocs);

    // ---- 4. Telemetry (40 rows across severities) ----
    const telemetry = Array.from({ length: 40 }, (_, i) => {
      const sev = pick(
        rng,
        ["critical", "critical", "high", "high", "high", "medium", "medium", "low", "info"] as const,
      );
      const msg = pick(rng, TELEM_MSGS[sev]);
      return {
        source: `seed:${pick(rng, SOURCES)}`,
        severity: sev,
        user_ref: pick(rng, customers).email,
        device: `seed-dev-${Math.floor(rng() * 20)}`,
        ip: `185.220.101.${20 + i}`,
        message: msg,
        risk_score: sev === "critical" ? 90 + Math.floor(rng() * 9) : sev === "high" ? 70 + Math.floor(rng() * 15) : sev === "medium" ? 40 + Math.floor(rng() * 20) : 10 + Math.floor(rng() * 20),
        metadata: { seeded: true, scenario: data.scenario, index: i },
        created_at: iso(-i * 7),
      };
    });
    await supabaseAdmin.from("cyber_telemetry").insert(telemetry);

    // ---- 5. Transactions (30) + risk_scores + investigations + alerts ----
    const txRows = await Promise.all(
      Array.from({ length: 30 }, async (_, i) => {
        const cust = customers[i % customers.length];
        const isHighRisk = i < 8;
        const amount = isHighRisk ? 15000 + Math.floor(rng() * 40000) : 50 + Math.floor(rng() * 4000);
        const country = isHighRisk ? pick(rng, HIGH_RISK) : pick(rng, COUNTRIES);
        const channel = pick(rng, CHANNELS);
        const risk = isHighRisk ? 70 + Math.floor(rng() * 29) : Math.floor(rng() * 55);
        const status = risk >= 80 ? "blocked" : risk >= 60 ? "pending" : "approved";
        return {
          id: await seedUuid(`tx:${i}`),
          customer_id: cust.id,
          amount,
          currency: "USD",
          channel,
          merchant: `seed:${pick(rng, MERCHANTS)}`,
          country,
          status,
          risk_score: risk,
          created_at: iso(-i * 15),
        };
      }),
    );
    await supabaseAdmin.from("transactions").upsert(txRows);

    // risk_scores for every tx
    const riskScoreRows = txRows.map((t) => ({
      transaction_id: t.id,
      customer_id: t.customer_id,
      composite: t.risk_score,
      contributors: [
        { name: `Amount $${t.amount.toLocaleString()}`, weight: Math.min(25, Math.round(t.amount / 2000)) },
        { name: `Country ${t.country}`, weight: HIGH_RISK.includes(t.country as (typeof HIGH_RISK)[number]) ? 15 : 3 },
        { name: `Channel ${t.channel}`, weight: t.channel === "crypto" ? 12 : t.channel === "wire" ? 8 : 2 },
      ],
    }));
    await supabaseAdmin.from("risk_scores").insert(riskScoreRows);

    // Investigations for top-risk txs
    const invRows = await Promise.all(
      txRows
        .filter((t) => (t.risk_score ?? 0) >= 60)
        .slice(0, 8)
        .map(async (t, i) => {
          const meta = INVESTIGATIONS[i % INVESTIGATIONS.length];
          const contrib = riskScoreRows.find((r) => r.transaction_id === t.id)?.contributors ?? [];
          return {
            id: await seedUuid(`inv:${i}`),
            transaction_id: t.id,
            customer_id: t.customer_id,
            title: `Risk ${t.risk_score}: ${t.channel} to ${t.country}`,
            confidence: Math.min(99, (t.risk_score ?? 0) + 3),
            attack_type: meta.attack,
            business_impact: t.amount,
            root_cause: meta.cause,
            evidence: contrib.map((c) => ({ ts: t.created_at, source: "correlation", event: c.name, weight: c.weight })),
            risk_factors: contrib.map((c) => c.name),
            recommended_actions:
              (t.risk_score ?? 0) >= 85
                ? ["Freeze account for 24h", "Force credential reset", "Notify customer via secondary channel", "File SAR"]
                : ["Manual analyst review", "Enrich with device history", "Contact customer for confirmation"],
            compliance: (t.risk_score ?? 0) >= 85 ? ["PSD2 SCA review", "AML SAR filing", "DORA incident report"] : ["Manual review"],
            status: "open",
          };
        }),
    );
    if (invRows.length) await supabaseAdmin.from("ai_investigations").upsert(invRows);

    // Alerts across every severity + status bucket
    const alertRows = await Promise.all(
      Array.from({ length: 24 }, async (_, i) => {
        const t = txRows[i % txRows.length];
        const inv = invRows[i % Math.max(1, invRows.length)];
        const severity = pick(rng, ["critical", "critical", "high", "high", "medium", "medium", "low"] as const);
        const status = i < 14 ? "open" : i < 20 ? "acknowledged" : "resolved";
        return {
          id: await seedUuid(`alert:${i}`),
          transaction_id: t.id,
          customer_id: t.customer_id,
          investigation_id: inv?.id ?? null,
          severity,
          title: `${severity.toUpperCase()}: ${t.channel} $${t.amount.toLocaleString()} to ${t.country}`,
          source: "seed:correlation-engine",
          status,
          sla_minutes: severity === "critical" ? 15 : severity === "high" ? 30 : 60,
          created_at: iso(-i * 20),
          updated_at: iso(-i * 20 + 5),
        };
      }),
    );
    await supabaseAdmin.from("alerts").upsert(alertRows);

    // Notifications (analyst inbox)
    const notifRows = alertRows.slice(0, 8).map((a) => ({
      title: a.severity === "critical" ? "Critical alert" : "New alert",
      body: `seed:${a.title}`,
      severity: a.severity,
    }));
    await supabaseAdmin.from("notifications").insert(notifRows);

    // Devices + sessions + beneficiaries + quantum + knowledge_edges (light)
    const devices = await Promise.all(
      customers.slice(0, 6).map(async (c, i) => ({
        id: await seedUuid(`device:${i}`),
        customer_id: c.id,
        fingerprint: `seed:fp-${i}`,
        os: pick(rng, ["iOS", "Android", "macOS", "Windows"]),
        first_seen: iso(-60 * 24 * 20),
        last_seen: iso(-i * 30),
        trust_score: 40 + Math.floor(rng() * 60),
      })),
    );
    await supabaseAdmin.from("devices").upsert(devices);

    const sessions = await Promise.all(
      customers.slice(0, 6).map(async (c, i) => ({
        id: await seedUuid(`session:${i}`),
        customer_id: c.id,
        device_id: devices[i]?.id ?? null,
        ip: `seed:203.0.113.${i}`,
        country: c.country,
        started_at: iso(-i * 60),
        ended_at: iso(-i * 60 + 45),
        risk_score: 20 + Math.floor(rng() * 60),
      })),
    );
    await supabaseAdmin.from("sessions").upsert(sessions);

    const beneficiaries = await Promise.all(
      customers.slice(0, 4).map(async (c, i) => ({
        id: await seedUuid(`ben:${i}`),
        customer_id: c.id,
        name: `seed:Beneficiary ${i}`,
        iban: `NL${20 + i}RABO0${1000000 + i}`,
        country: pick(rng, HIGH_RISK),
        first_seen: iso(-60 * 24 * 5),
      })),
    );
    await supabaseAdmin.from("beneficiaries").upsert(beneficiaries);

    const quantum = await Promise.all(
      [
        ["RSA-2048 signing key", "signing", "RSA-2048", "critical"],
        ["TLS 1.2 endpoint", "TLS", "ECDHE-RSA", "high"],
        ["Hybrid Kyber-1024", "KEM", "Kyber-1024 + X25519", "low"],
        ["Legacy 3DES vault", "encryption", "3DES", "critical"],
        ["Dilithium roadmap slot", "signing", "Dilithium-3", "medium"],
      ].map(async ([name, kind, algo, risk], i) => ({
        id: await seedUuid(`quantum:${i}`),
        name: `seed:${name}`,
        kind,
        algorithm: algo,
        pqc_risk: risk,
        exposure_usd: 1_000_000 * (i + 1),
        migration_deadline: iso(60 * 24 * 365 * (i + 1)),
        owner: "PKI Team",
        notes: `Seeded quantum asset: ${name}`,
      })),
    );
    await supabaseAdmin.from("quantum_assets").upsert(quantum);

    const edges = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => ({
        id: await seedUuid(`edge:${i}`),
        src_type: "customer",
        src_id: customers[i % customers.length].id,
        dst_type: "transaction",
        dst_id: txRows[i % txRows.length].id,
        relation: `seed:${pick(rng, ["initiated", "linked", "co-located", "shared-device"])}`,
        weight: Math.round(rng() * 100),
      })),
    );
    await supabaseAdmin.from("knowledge_edges").upsert(edges);

    return {
      scenario: data.scenario,
      anchor: new Date(SEED_ANCHOR).toISOString(),
      customers: customers.length,
      transactions: txRows.map((t) => ({ id: t.id, amount: t.amount, country: t.country, channel: t.channel })),
      alerts: alertRows.length,
      investigations: invRows.length,
      telemetry_count: telemetry.length,
      iocs: iocs.length,
      threats: threats.length,
      quantum: quantum.length,
      expected_high_risk_composite: null,
    };
  });
