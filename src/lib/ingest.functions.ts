// Bank data ingestion + AI narrative
// Accepts raw bank JSON (transactions + cyber events), persists them,
// runs the shared correlation engine per tx (correlation-core.server), and
// generates a plain-English AI explanation via the Lovable AI Gateway.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TxIn = z.object({
  txn_id: z.string().min(1).max(64).optional(),
  user_id: z.string().min(1).max(64),
  amount: z.number().finite(),
  merchant: z.string().max(120).optional(),
  location: z.string().max(64).optional(),
  country: z.string().max(4).optional(),
  device: z.string().max(80).optional(),
  channel: z.string().max(24).optional(),
  currency: z.string().min(3).max(4).optional(),
  ts: z.string().optional(),
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

const CITY_TO_COUNTRY: Record<string, string> = {
  mumbai: "IN", delhi: "IN", bangalore: "IN", bengaluru: "IN", chennai: "IN", pune: "IN",
  london: "GB", manchester: "GB", "new york": "US", "san francisco": "US", chicago: "US",
  dubai: "AE", singapore: "SG", moscow: "RU", lagos: "NG", tehran: "IR", beijing: "CN", hanoi: "VN",
};

function severityFor(event: string): "info" | "medium" | "high" | "critical" {
  const s = event.toLowerCase();
  if (/malware|beacon|c2|ransomware|infostealer|sim.?swap/.test(s)) return "critical";
  if (/impossible travel|tor|mfa fatigue|credential stuff|brute|phish/.test(s)) return "high";
  if (/vpn|login|auth|new device/.test(s)) return "medium";
  return "info";
}

export const ingestBankBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAnalyst } = await context.supabase.rpc("is_analyst", { _user_id: context.userId });
    if (!isAnalyst) throw new Error("Forbidden: analyst role required to ingest bank data");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { scoreAndPersist } = await import("@/lib/correlation-core.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("region, currency").eq("id", context.userId).maybeSingle();
    const defaultCurrency = profile?.currency || "INR";
    const defaultCountry = profile?.region || "IN";

    // ---------- 1. Upsert customers by bank user_id ----------
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
        created_at: t.ts ?? new Date().toISOString(),
      };
    });
    let insertedTx: Array<{ id: string; created_at: string }> = [];
    if (txRows.length) {
      const { data: inserted, error } = await supabaseAdmin
        .from("transactions").insert(txRows).select("id, created_at");
      if (error) throw new Error(`transactions insert failed: ${error.message}`);
      insertedTx = inserted ?? [];
    }

    // ---------- 4. Score every tx through the shared engine ----------
    const results: Array<{
      txn_id: string; db_id: string; composite: number; verdict: string; band: string;
      dominant_kind: string; top_signals: string[]; investigation_id: string | null;
      risk_breakdown: any; timeline: any; escalations: any;
    }> = [];
    for (let i = 0; i < insertedTx.length; i++) {
      const dbId = insertedTx[i].id;
      const src = data.transactions[i];
      try {
        const r = await scoreAndPersist(supabaseAdmin, dbId);
        results.push({
          txn_id: src.txn_id || dbId.slice(0, 8),
          db_id: dbId,
          composite: r.composite,
          verdict: r.status,
          band: r.band,
          dominant_kind: r.dominant_kind,
          top_signals: r.signals
            .slice()
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 3)
            .map((s) => s.name),
          investigation_id: r.investigation_id,
          risk_breakdown: r.risk_breakdown,
          timeline: r.timeline,
          escalations: r.escalations,
        });
      } catch (err) {
        results.push({
          txn_id: src.txn_id || dbId.slice(0, 8), db_id: dbId, composite: 0,
          verdict: "error", band: "Approved", dominant_kind: "n/a",
          top_signals: [(err as Error).message], investigation_id: null,
          risk_breakdown: [], timeline: [], escalations: [],
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

async function generateNarrative(adm: any, key: string, investigationId: string, currency: string) {
  const { data: inv } = await adm.from("ai_investigations").select("*").eq("id", investigationId).maybeSingle();
  if (!inv) return;
  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content:
        `You are SentinelQ's explainable-AI analyst producing bank-grade investigation write-ups (JPMorgan / Visa / Mastercard style). ` +
        `Return STRICT JSON with keys: summary (2-3 sentences, plain English), why_flagged (3-5 short bullets citing the specific signals and combo escalations), ` +
        `recommended_actions (3-5 concrete bullets aligned to the risk band), confidence_rationale (1 sentence). ` +
        `Use ${currency} for all amounts. Keep the total under 220 words.` },
      { role: "user", content: JSON.stringify({
        title: inv.title, band: inv.band, attack_type: inv.attack_type,
        business_impact: inv.business_impact, risk_factors: inv.risk_factors,
        risk_breakdown: inv.risk_breakdown, timeline: inv.timeline,
        explanation: inv.explanation,
      }) },
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

// ---------- Categorized demo datasets ----------
// Presets used by the /ingest "Demo Datasets" tab. Each preset feeds
// ingestBankBatch and reports actual vs expected band for validation.
export type DemoPreset = {
  category: string;
  label: string;
  description: string;
  transactions: z.infer<typeof TxIn>[];
  cyberEvents: z.infer<typeof EventIn>[];
  expected: { band: string; composite_min: number; decision: string; explanation: string };
};

function uid(prefix: string) { return `${prefix}${Math.floor(Math.random() * 900 + 100)}`; }
const now = () => new Date().toISOString();
const past = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export function buildDemoPresets(currency = "INR"): DemoPreset[] {
  const large = currency === "USD" ? 25000 : currency === "EUR" ? 23000 : 500000;
  const mid = currency === "USD" ? 800 : currency === "EUR" ? 750 : 60000;
  const small = currency === "USD" ? 45 : currency === "EUR" ? 40 : 3500;

  const u = (n: number) => `DEMO-U${String(n).padStart(3, "0")}`;

  return [
    { category: "normal", label: "✅ Normal Customer", description: "Routine domestic card purchase, trusted device.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(1), amount: small, merchant: "Grocery", location: "Mumbai", device: "iPhone", channel: "card", currency }],
      cyberEvents: [{ user: u(1), event: "Routine authentication event", device: "iPhone", ip: "203.0.113.10" }],
      expected: { band: "Approved", composite_min: 0, decision: "approved", explanation: "No risk signals fire." } },

    { category: "low_risk", label: "🟡 Low Risk", description: "Higher-than-usual amount but same country + trusted device.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(2), amount: mid, merchant: "Electronics", location: "Delhi", device: "Android", channel: "card", currency }],
      cyberEvents: [{ user: u(2), event: "GeoIP mismatch on login", device: "Android", ip: "203.0.113.20" }],
      expected: { band: "Monitor", composite_min: 30, decision: "approved", explanation: "One medium signal, no combo." } },

    { category: "medium_risk", label: "🟠 Medium Risk", description: "New device + higher amount.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(3), amount: mid * 3, merchant: "Jewellery", location: "Mumbai", device: "New-Android", channel: "card", currency }],
      cyberEvents: [{ user: u(3), event: "New device registered for MFA", device: "New-Android", ip: "203.0.113.30" }],
      expected: { band: "Pending Review", composite_min: 50, decision: "pending", explanation: "New device + elevated amount." } },

    { category: "high_risk", label: "🔴 High Risk", description: "Wire abroad + VPN + new device.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(4), amount: large, merchant: "Foreign beneficiary", location: "Dubai", device: "Android", channel: "wire", currency, country: "AE" }],
      cyberEvents: [
        { user: u(4), event: "VPN Login", ip: "185.220.101.50", device: "Android", ts: past(10) },
        { user: u(4), event: "New device registered for MFA", device: "Android", ts: past(8) },
      ],
      expected: { band: "High Risk", composite_min: 70, decision: "pending", explanation: "Cyber + wire + high-risk geo." } },

    { category: "critical_fraud", label: "⛔ Critical Fraud", description: "Full kill chain: malware → wire abroad.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(5), amount: large * 2, merchant: "Unknown beneficiary", location: "Moscow", device: "Windows", channel: "wire", currency, country: "RU" }],
      cyberEvents: [
        { user: u(5), event: "RedLine infostealer executed on endpoint", device: "Windows", ts: past(20) },
        { user: u(5), event: "Impossible travel: London → Amsterdam in 4 min", ts: past(5) },
      ],
      expected: { band: "Block", composite_min: 85, decision: "blocked", explanation: "Malware forces block + xcorr chain." } },

    { category: "international", label: "🌍 International Transactions", description: "Cross-border wire, no cyber signals.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(6), amount: mid * 5, merchant: "Overseas vendor", location: "Singapore", device: "iPhone", channel: "wire", currency, country: "SG" }],
      cyberEvents: [],
      expected: { band: "Pending Review", composite_min: 40, decision: "pending", explanation: "Geo drift + wire large amount." } },

    { category: "card_fraud", label: "💳 Card Fraud", description: "Card-not-present enumeration burst.",
      transactions: [
        { txn_id: uid("TXN"), user_id: u(7), amount: small * 3, merchant: "Test1", location: "Chicago", channel: "card", currency, ts: past(9) },
        { txn_id: uid("TXN"), user_id: u(7), amount: small * 4, merchant: "Test2", location: "Chicago", channel: "card", currency, ts: past(6) },
        { txn_id: uid("TXN"), user_id: u(7), amount: small * 5, merchant: "Test3", location: "Chicago", channel: "card", currency, ts: past(3) },
      ],
      cyberEvents: [{ user: u(7), event: "Bot / automated client signature", ip: "5.5.5.5" }],
      expected: { band: "High Risk", composite_min: 65, decision: "pending", explanation: "Rapid velocity + bot signature." } },

    { category: "wire_fraud", label: "🏦 Wire Transfer Fraud", description: "Large wire to untrusted beneficiary.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(8), amount: large, merchant: "New beneficiary", location: "Lagos", device: "Windows", channel: "wire", currency, country: "NG" }],
      cyberEvents: [{ user: u(8), event: "OAuth consent to unverified 3rd-party app" }],
      expected: { band: "High Risk", composite_min: 70, decision: "pending", explanation: "Wire + high-risk geo + large." } },

    { category: "sim_swap", label: "📱 SIM Swap", description: "SIM swap → immediate wire out.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(9), amount: large, merchant: "Foreign wire", location: "Dubai", device: "New-Android", channel: "wire", currency, country: "AE" }],
      cyberEvents: [
        { user: u(9), event: "SIM swap detected on carrier port", ts: past(15) },
        { user: u(9), event: "New device registered for MFA", ts: past(10) },
      ],
      expected: { band: "Block", composite_min: 85, decision: "blocked", explanation: "SIM swap force-blocks + ATO chain." } },

    { category: "account_takeover", label: "🛡️ Account Takeover", description: "VPN + impossible travel + new device + wire.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(10), amount: large, merchant: "Foreign vendor", location: "Beijing", device: "New-Windows", channel: "wire", currency, country: "CN" }],
      cyberEvents: [
        { user: u(10), event: "VPN Login", ts: past(20) },
        { user: u(10), event: "Impossible travel detected", ts: past(12) },
        { user: u(10), event: "New device registered for MFA", ts: past(8) },
        { user: u(10), event: "MFA fatigue: 14 push denials in 3 minutes", ts: past(5) },
      ],
      expected: { band: "Block", composite_min: 85, decision: "blocked", explanation: "ATO combo + xcorr precedes tx." } },

    { category: "malware_device", label: "🦠 Malware-Infected Device", description: "C2 beacon on customer endpoint.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(11), amount: mid * 4, merchant: "Vendor", location: "London", device: "Windows", channel: "wire", currency, country: "GB" }],
      cyberEvents: [{ user: u(11), event: "Beaconing pattern to known C2 (jitter 30s)", ts: past(10) }],
      expected: { band: "Block", composite_min: 85, decision: "blocked", explanation: "Malware signal force-blocks." } },

    { category: "vpn_tor", label: "🌐 VPN/TOR Login", description: "Session via Tor exit before transaction.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(12), amount: mid * 2, merchant: "Vendor", location: "Amsterdam", device: "Linux", channel: "card", currency, country: "NL" }],
      cyberEvents: [{ user: u(12), event: "Tor exit node login", ts: past(6) }],
      expected: { band: "Pending Review", composite_min: 50, decision: "pending", explanation: "Tor session + geo drift." } },

    { category: "impossible_travel", label: "✈️ Impossible Travel", description: "Two logins from far-apart geos in minutes.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(13), amount: mid * 3, merchant: "ATM cashout", location: "Dubai", device: "iPhone", channel: "card", currency, country: "AE" }],
      cyberEvents: [{ user: u(13), event: "Impossible travel: London → Dubai in 5 min", ts: past(4) }],
      expected: { band: "High Risk", composite_min: 65, decision: "pending", explanation: "Impossible travel + xcorr + foreign." } },

    { category: "money_laundering", label: "💰 Money Laundering (Structuring)", description: "Multiple sub-threshold transfers.",
      transactions: [
        { txn_id: uid("TXN"), user_id: u(14), amount: large * 0.9, merchant: "Beneficiary A", channel: "wire", currency, ts: past(30) },
        { txn_id: uid("TXN"), user_id: u(14), amount: large * 0.92, merchant: "Beneficiary B", channel: "wire", currency, ts: past(15) },
        { txn_id: uid("TXN"), user_id: u(14), amount: large * 0.95, merchant: "Beneficiary C", channel: "wire", currency, ts: past(2) },
      ],
      cyberEvents: [],
      expected: { band: "High Risk", composite_min: 65, decision: "pending", explanation: "Structuring pattern near reporting threshold." } },

    { category: "crypto_exchange", label: "🪙 Crypto Exchange", description: "Wire to crypto exchange abroad.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(15), amount: large, merchant: "Binance deposit", location: "Dubai", device: "Android", channel: "crypto", currency, country: "AE" }],
      cyberEvents: [{ user: u(15), event: "VPN Login" }],
      expected: { band: "High Risk", composite_min: 70, decision: "pending", explanation: "Crypto + large + VPN + foreign." } },

    { category: "quantum_threat", label: "⚛️ Quantum Threat Simulation", description: "Sensitive wire over weak TLS on legacy asset.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(16), amount: large, merchant: "Legacy corp banking", location: "London", channel: "wire", currency, country: "GB" }],
      cyberEvents: [],
      expected: { band: "Pending Review", composite_min: 45, decision: "pending", explanation: "HNDL + weak-cipher endpoint on wire." } },

    { category: "insider_threat", label: "👥 Insider Threat", description: "Off-hours large transfer from new device.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(17), amount: large, merchant: "Personal account", channel: "wire", currency, ts: new Date(new Date().setUTCHours(2, 30, 0, 0)).toISOString() }],
      cyberEvents: [{ user: u(17), event: "Unusual sudo escalation off-hours", ts: past(20) }],
      expected: { band: "High Risk", composite_min: 65, decision: "pending", explanation: "Off-hours + large + escalation." } },

    { category: "bot_attack", label: "🤖 Bot / Automated Attack", description: "Headless client hammering payment API.",
      transactions: Array.from({ length: 4 }, (_, i) => ({ txn_id: uid("TXN"), user_id: u(18), amount: small * (i + 1), merchant: `Test${i}`, channel: "card", currency, ts: past(9 - i * 2) })),
      cyberEvents: [{ user: u(18), event: "Bot / automated client signature (puppeteer)" }],
      expected: { band: "High Risk", composite_min: 65, decision: "pending", explanation: "Rapid velocity + bot signature." } },

    { category: "phishing", label: "🎣 Phishing Compromise", description: "Credential harvest followed by wire.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(19), amount: mid * 4, merchant: "Attacker wallet", channel: "wire", currency, country: "RU" }],
      cyberEvents: [{ user: u(19), event: "Phishing credential harvest confirmed", ts: past(25) }],
      expected: { band: "High Risk", composite_min: 70, decision: "pending", explanation: "Phishing + xcorr + high-risk geo." } },

    { category: "credential_stuffing", label: "🔐 Credential Stuffing", description: "Failed login burst preceding tx.",
      transactions: [{ txn_id: uid("TXN"), user_id: u(20), amount: mid * 2, merchant: "Vendor", channel: "card", currency }],
      cyberEvents: [
        { user: u(20), event: "Credential stuffing attempt failed login", ts: past(30) },
        { user: u(20), event: "Credential stuffing attempt failed login", ts: past(29) },
        { user: u(20), event: "Credential stuffing attempt failed login", ts: past(28) },
      ],
      expected: { band: "Pending Review", composite_min: 45, decision: "pending", explanation: "Credential stuffing burst." } },

    { category: "high_velocity", label: "⚡ High-Velocity Transactions", description: "5 transactions in under 10 minutes.",
      transactions: Array.from({ length: 5 }, (_, i) => ({ txn_id: uid("TXN"), user_id: u(21), amount: mid, merchant: `V${i}`, channel: "card", currency, ts: past(9 - i * 2) })),
      cyberEvents: [],
      expected: { band: "Pending Review", composite_min: 50, decision: "pending", explanation: "Rapid velocity signal fires." } },
  ];
}

export const listDemoPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("currency").eq("id", context.userId).maybeSingle();
    return buildDemoPresets(profile?.currency || "INR");
  });
