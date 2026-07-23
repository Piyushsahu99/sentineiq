# Strengthen Correlation Engine + Accuracy Testing + Live Metrics

Goal: make the correlation engine more accurate on large, varied data, prove it with a repeatable accuracy test, and ensure every dashboard/graph reflects the new results.

## 1. Expand "training" dataset (labeled scenarios)

Add a curated labeled corpus in `src/lib/mock/labeled-scenarios.ts` covering ~200 cases across the categories we already sketched:
- Normal / low-risk baselines (spending patterns, recurring merchants, trusted device)
- Fraud: card-not-present, account takeover, SIM swap chain, mule payouts, wire to sanctioned country, dormant reactivation, velocity abuse, merchant category anomaly, structuring
- Cyber: VPN + impossible travel, MFA fatigue, new-device + high-value, credential-stuffing → payment, malware beacon + wire
- Quantum: HNDL harvest, weak-TLS session on payment endpoint
- Adversarial edge cases: legit VPN traveler, expected large payroll, new merchant but small amount

Each case: `{ id, category, expected_band, expected_min_score, expected_max_score, transactions[], cyberEvents[], notes }`.

## 2. Tune the correlation core against the labeled set

In `src/lib/correlation-core.server.ts`:
- Recalibrate signal weights and combo escalators using the labeled corpus (grid search over weight multipliers offline via the test runner in step 3, commit the tuned constants).
- Add missing signals surfaced by the corpus: velocity (N tx / 10 min), structuring (just-under-threshold), sanctioned-country list, merchant-category-code drift, dormant-reactivation, mule-payout fanout.
- Strengthen behavioral baselines: per-customer rolling z-score on amount, hour-of-day KDE, merchant novelty, device/IP entropy over 90 days.
- Combo escalators: enforce hard floors (e.g. SIM swap + new device + wire ≥ 85 = Block) instead of averaging.
- Add a `confidence` calculation based on signal count + evidence density, not just weight sum.

## 3. Accuracy test harness

Add `tests/correlation-accuracy.test.ts` (vitest):
- Load labeled corpus, run the pure scoring function (`scoreOnly`, extracted from `scoreAndPersist` so it doesn't need Supabase) against each case.
- Assert per-case: predicted band == expected band, score within expected range.
- Aggregate metrics: precision/recall per category, confusion matrix across bands, false-positive rate on "normal" cases, block-rate on "fraud" cases.
- Fail the suite if overall accuracy < 90% or FPR on normal > 5%.
- Print a summary table on run.

Add `bun run test:accuracy` script in `package.json`.

## 4. Large-data performance

- Batch context loads in `loadContext` (single query per customer window instead of per-signal).
- Cap history windows and add indices via migration: `transactions(customer_id, created_at desc)`, `cyber_telemetry(customer_id, created_at desc)`.
- Stream batch ingest in chunks of 50 with `Promise.all`, so 200-tx uploads stay under a few seconds.

## 5. Propagate results to every dashboard

Ensure the following pages read live aggregates from `ai_investigations` / `alerts` / `tx_check_history` (not mocks):
- `_app.dashboard.tsx`: KPI cards (block rate, avg risk, alerts/hr, FPR from feedback), sparkline from last 24h investigations, band distribution donut.
- `_app.correlation.tsx`: signal-kind breakdown, top escalations, weighted contributor chart from real investigations.
- `_app.behavior.tsx`: anomaly counts derived from behavioral signals in latest investigations.
- `_app.explainable-ai.tsx`: risk breakdown + timeline already wired — verify with new signals.
- `_app.transactions.tsx`: verdict pill + composite score column from `tx_check_history`.
- `_app.threat-intel.tsx` / threat map: mark IPs/countries appearing in cyber signals of recent investigations.
- `_app.quantum.tsx`: counts from quantum-kind signals.
- `_app.reports.tsx`: totals recomputed from live tables in chosen currency.

Add a shared `src/lib/live-queries.ts` helper (already exists) with new aggregators the pages consume via `useSuspenseQuery`.

## 6. Load Demo Dataset button

In `/ingest` and `/settings → Demo Data`, add "Load labeled dataset" that ingests the full corpus, then shows a mini accuracy report (predicted vs expected band per case) so users can see the engine's accuracy live in-app.

## Technical notes

- Keep `scoreAndPersist` as the persistence wrapper; extract pure `scoreOnly(ctx, input)` for tests.
- Migration: new indices only, no schema changes beyond that.
- No new npm deps; vitest and existing Supabase/AI stack are enough.
- All currency in aggregates goes through `formatMoney` + `usePrefs`.

## Out of scope

- No FastAPI or external ML service.
- No changes to auth, RLS policies, or role model.
- No visual redesign — only data-source swaps and new small chart tiles where a metric is missing.
