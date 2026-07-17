
# Bank Data Ingestion + AI Analysis Upgrade

Goal: let a bank paste/upload real transaction + telemetry data, run the full correlation + Gemini-powered AI analysis on it, and see real, per-row results (risk score, signals, verdict, recommended actions) in a clean, user-friendly workflow.

## 1. New "Ingest" workspace (`/ingest`)
A single page under `_authenticated` with three tabs:

- **Paste JSON** — textarea accepting either a single object or an array of `{ txn_id, user_id, amount, merchant, location, device, currency? }` for transactions, and `{ user, event, ip, device, ts? }` for cyber events. Sample payloads prefilled.
- **Upload CSV** — drag-and-drop `.csv` for `transactions.csv` and `cyber_events.csv`. Client parses with `papaparse`, previews first 10 rows, maps columns, then submits.
- **Bulk demo** — reuses existing `seedDeterministic` for one-click demos.

After submit, page shows a live **Analysis Results** table: each row = one ingested transaction with composite score, dominant kind (fraud/cyber/xcorr/quantum), verdict badge (approved/pending/blocked), top 3 signals, and a "View investigation" link into `/explainable-ai`.

## 2. Server functions (all in `src/lib/ingest.functions.ts`)
- `ingestBankBatch({ transactions[], cyberEvents[] })` — analyst-only, uses `requireSupabaseAuth`:
  1. Upsert customers by `user_id` (creates minimal customer row if missing, respecting user's `region`/`currency` from profile).
  2. Insert `cyber_telemetry` rows from events (map `event`→message, severity heuristic: VPN/Tor/impossible travel → high; malware/beacon → critical; else medium).
  3. Insert `transactions` rows, then invoke existing `correlateTransaction` per tx.
  4. Collect results and return `{ results: [{ txn_id, composite, verdict, dominant_kind, top_signals, investigation_id }] }`.
- `explainWithAI({ investigationId })` — calls Lovable AI Gateway (Gemini 2.5 Flash) with the signals + evidence, returns a natural-language narrative + recommended next steps, persisted onto `ai_investigations.ai_narrative` (new nullable column).

## 3. AI enhancement
Extend the correlation output with a Gemini pass that turns the signal tree into:
- Plain-English "what happened" paragraph
- Ranked recommended actions tuned to the region/bank/currency
- Confidence rationale
Rendered as a collapsible "AI Explanation" card in the results table and on the Explainable AI investigation detail.

## 4. Schema change (single migration)
- `ALTER TABLE ai_investigations ADD COLUMN ai_narrative jsonb` (nullable). No new tables. Grants unchanged.

## 5. UX polish
- Sidebar: add "Ingest" entry with upload icon, above Transactions.
- Empty states on Dashboard/Transactions link to `/ingest` when zero rows exist for the tenant.
- Toasts for per-row success/failure, with a downloadable JSON of results.
- Non-analyst roles see a read-only view with a "Request analyst access" note (avoids silent 403s).

## 6. Non-goals
- No FastAPI, no new external services.
- No changes to auth, RLS on existing tables, or currency logic beyond reading `profiles.currency` when creating customers.
- No changes to Threat Map, Quantum, or Reports pages (they already consume the same tables and will light up automatically once real data flows in).

## Technical notes
- CSV parsing: `bun add papaparse` (client-only import).
- AI call: use existing `LOVABLE_API_KEY` via `google/gemini-2.5-flash` (fast tier). Wrapped in try/catch — correlation still succeeds if AI narrative fails.
- Batch size cap: 200 transactions per request to stay inside Worker CPU budget; larger uploads chunked client-side with progress bar.
- All inserts go through `supabaseAdmin` (loaded inside handler) after `is_analyst` check, so RLS on `transactions` INSERT policy is unaffected.
