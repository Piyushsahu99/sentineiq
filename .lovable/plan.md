
# Upgrade Correlation Engine + Add Categorized Demo Datasets

Improve the existing engine in place — no rebuild. Everything lands in `src/lib/correlation.functions.ts`, `src/lib/ingest.functions.ts`, `src/lib/seed.functions.ts`, the ingest UI, and one small schema addition. Currency/RLS/auth/routing untouched.

## 1. Unified weighted engine (shared, no duplicated inline copy)

Today the correlation logic exists twice: once in `correlation.functions.ts` and a hand-copied clone inside `ingest.functions.ts::importInline()`. They drift. Fix:

- Extract `loadContext`, `runRules`, `applySuppressions`, and a new `scoreAndPersist(tx)` into a plain server-only helper `src/lib/correlation-core.server.ts` (no `createServerFn` wrapper, safe to call from other server handlers).
- Both `correlateTransaction` (single tx RPC) and `ingestBankBatch` (loop) call `scoreAndPersist` — one source of truth.

## 2. Weighted scoring + combo escalation (the accuracy fix)

Replace naive `sum(weight) + baseline/5` with a two-stage model:

**Stage A — expanded typed signals** (all bank-grade indicators the user listed):

| Signal id | Weight | Notes |
|---|---|---|
| `cyber.vpn_login` | 8 | session or event marked VPN |
| `cyber.tor_login` | 14 | Tor exit / anonymizer |
| `cyber.impossible_travel` | 16 | already exists, weight bumped |
| `cyber.sim_swap` | 20 | regex `/sim.?swap|carrier port/i` on telemetry |
| `cyber.malware_beacon` | 18 | existing |
| `cyber.mfa_fatigue` | 14 | `/mfa fatigue|push denials/i` |
| `cyber.credential_stuffing` | 12 | existing auth-burst |
| `cyber.phishing_hit` | 12 | `/phish|credential harvest/i` |
| `fraud.new_device` | 10 | first-seen device for this customer within 24h |
| `fraud.dormant_reactivation` | 12 | no tx in 60d then large tx |
| `fraud.off_hours` | 6 | tx at customer local 00:00–05:00 |
| `fraud.rapid_velocity` | 12 | ≥3 tx in 10 min |
| `fraud.structuring_9k` | 15 | existing |
| `fraud.amount_zscore` | dynamic | existing |
| `fraud.large_amount` | 14 | existing (ingest) |
| `fraud.geo_drift` | 6/15 | existing |
| `fraud.foreign_high_risk` | 12 | tx to `HIGH_RISK_GEO` |
| `fraud.wire_or_crypto_high` | 10 | wire/crypto ≥ threshold (currency-aware via FX table) |
| `fraud.unusual_mcc` | 6 | merchant category never seen before for customer |
| `fraud.new_beneficiary_untrusted` | 10 | beneficiary marked untrusted / first-seen |
| `xcorr.cyber_precedes_tx` | 18 | existing, widened window to 60 min |
| `xcorr.multi_event_chain` | dynamic (see combos) | |
| `quantum.hndl_exposure` / `quantum.weak_cipher_endpoint` | existing |

**Stage B — combo escalators** (fix "averaging hides attacks"):

Given the fired signal set S:
- `combo.ato_chain` = any 3 of `{vpn_login, tor_login, impossible_travel, new_device, sim_swap, mfa_fatigue}` present → **+25** and force `dominant_kind = "xcorr"`.
- `combo.wire_out_of_country` = `{fraud.large_amount|amount_zscore, fraud.geo_drift|foreign_high_risk, fraud.wire_or_crypto_high}` all present → **+20**.
- `combo.full_kill_chain` = cyber signal + xcorr precedes + fraud amount signal → **+30**, `composite = max(composite, 90)`.

`composite = clamp(sum(weights) + escalation_bonus + baseline/5, 0, 100)`.

**Threshold bands** (used everywhere — engine, badges, ingest UI):

| Band | Range | Status | UI label |
|---|---|---|---|
| Approved | 0–29 | `approved` | green |
| Monitor | 30–49 | `approved` (tag "monitor") | teal |
| Pending Review | 50–69 | `pending` | amber |
| High Risk | 70–84 | `pending` (tag "high-risk") | orange |
| Block | 85–100 | `blocked` | red |

Force-block guard: if any of `sim_swap`, `malware_beacon`, `combo.full_kill_chain` fire, status is `blocked` regardless of numeric score.

## 3. Behavior/time analysis (multi-event, not single-event)

`loadContext` extended to pull:
- last 90 days of tx for the customer (not just 30)
- customer's typical local hour distribution (rolling)
- distinct merchants and MCCs seen
- distinct devices/session countries seen
- last-active timestamp for dormancy

Signals `fraud.off_hours`, `fraud.dormant_reactivation`, `fraud.unusual_mcc`, `fraud.new_device`, `fraud.rapid_velocity` all use these — that's the "multiple events over time" requirement.

## 4. Explanation payload (Risk Breakdown + Timeline)

`ai_investigations.explanation` (jsonb, already exists) extended to:

```json
{
  "composite": 92,
  "band": "Block",
  "calibrated_confidence": 88,
  "dominant_kind": "xcorr",
  "signals": [ ... existing ... ],
  "escalations": [{ "id": "combo.ato_chain", "bonus": 25, "reason": "vpn+impossible+new_device fired together" }],
  "risk_breakdown": [
    { "component": "Base signals", "value": 62 },
    { "component": "Combo escalations", "value": 25 },
    { "component": "Customer baseline", "value": 5 }
  ],
  "timeline": [
    { "ts": "…", "kind": "cyber", "event": "VPN Login", "delta_min": -12 },
    { "ts": "…", "kind": "cyber", "event": "Impossible travel", "delta_min": -6 },
    { "ts": "…", "kind": "tx", "event": "Wire ₹2.5L → AE", "delta_min": 0 },
    { "ts": "…", "kind": "tx", "event": "Wire ₹9.8k → AE", "delta_min": 4 }
  ],
  "recommended_action": "BLOCK — freeze account, force reset, notify customer via secondary channel"
}
```

Timeline uses ±60 min around the tx across `cyber_telemetry` (customer-scoped via metadata) + prior/subsequent transactions.

Gemini narrative prompt updated to consume `risk_breakdown` + `escalations` + `timeline` so the "AI Explanation" card in `/ingest` returns the enterprise-style write-up. Falls back to a deterministic template if `LOVABLE_API_KEY` is missing or the call errors.

## 5. UI updates (small, in place)

- **`/ingest` result rows**: show band pill, composite, confidence %, "Risk Breakdown" expandable (bars per component), "Timeline" expandable (vertical event log with cyber/tx icons and `±min` offsets), existing AI Explanation panel below.
- **`/correlation` page**: same Risk Breakdown block above kill chain; badge uses new bands.
- **`/investigations` cards**: band pill instead of raw score.

No new routes. Uses existing `GlassCard`, `RiskBar`, `RiskBadge`, `formatMoney`.

## 6. Categorized demo dataset generator

Add `loadDemoDataset({ category })` server fn in `src/lib/seed.functions.ts` (analyst-gated). 20 categories with realistic JSON payloads + expected outcome, matching the user list:

`normal`, `low_risk`, `medium_risk`, `high_risk`, `critical_fraud`, `international`, `card_fraud`, `wire_fraud`, `sim_swap`, `account_takeover`, `malware_device`, `vpn_tor`, `impossible_travel`, `money_laundering`, `crypto_exchange`, `quantum_threat`, `insider_threat`, `bot_attack`, `phishing`, `credential_stuffing`, `high_velocity`.

Each preset:
```ts
{
  category: "sim_swap",
  label: "📱 SIM Swap",
  transactions: [ /* realistic tx JSON */ ],
  cyberEvents: [ /* realistic event JSON */ ],
  expected: { band: "Block", composite_min: 85, decision: "blocked",
              explanation: "SIM swap + new device + large wire → ATO chain escalation" }
}
```

New tab **"Demo Datasets"** in `/ingest` renders a 4-column grid of category cards. Each card shows label + expected band + "Load & analyze" button which:
1. Prefills the JSON tab with the preset payload.
2. Calls `ingestBankBatch` immediately.
3. Renders results table with actual vs expected composite side-by-side (green tick if band matches, red cross otherwise) — this is the built-in validation the user asked for.

## 7. Schema (single migration)

Only additive:

```sql
ALTER TABLE public.ai_investigations
  ADD COLUMN IF NOT EXISTS risk_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS timeline jsonb,
  ADD COLUMN IF NOT EXISTS band text;
```

No RLS/grant changes (table already gated). Existing rows unaffected (nullable).

## 8. Out of scope

- No changes to auth, RLS on other tables, currency helpers, sidebar, threat map, quantum page internals.
- No FastAPI, no new external service.
- No changes to `_authenticated` gate or profile schema.

## Technical notes

- Combo detection is O(n) over the fired signal set — cheap.
- FX threshold table reused from `seed.functions.ts` so "large amount" is currency-correct (₹1L, $1.2k equivalent, etc.).
- Force-block signals bypass suppressions (`sim_swap`, `malware_beacon` cannot be suppressed to below block band).
- `loadDemoDataset` reuses `ingestBankBatch` — no duplicate ingestion code path, so demo results and real bank results score identically.
- `.server.ts` core file imported dynamically inside handlers to keep the client bundle clean.
- After migration approves, types regenerate and UI can read `band`/`risk_breakdown`/`timeline` directly.
