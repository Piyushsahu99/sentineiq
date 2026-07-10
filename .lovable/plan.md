# Make SentinelQ Fully Working — Feature-by-Feature Hardening

Goal: ship a demo-ready prototype where every sidebar module loads real data, reacts to user actions, and passes an automated Playwright smoke check before moving to the next one.

## Approach

Work module-by-module. For each: (1) fix data wiring, (2) fix interactions, (3) run a targeted Playwright script that logs in, seeds data, visits the route, screenshots, and asserts key DOM. Only move to the next module once the current one is green.

## Order of work (by demo importance)

1. **Auth + Role Select + Seed-on-login** — signup → MFA → role → auto-seed → dashboard lands populated.
2. **Dashboard** — KPIs, live transactions panel, threat map render with seeded data.
3. **Alerts** — list renders, tabs filter, Acknowledge/Resolve mutate + realtime updates second tab, "Run proactive scan" creates an alert.
4. **Transactions** — list renders, "Simulate suspicious" triggers `correlateTransaction`, toast shows risk, new investigation appears.
5. **Investigations** — list of AI investigations with attack_type, risk_factors, recommended_actions from live rows.
6. **Correlation** — kill-chain timeline links txn/customer/device from `knowledge_edges`.
7. **Explainable AI** — renders grouped signals from investigation `explanation`, feedback buttons write to `analyst_feedback`.
8. **Telemetry** — cyber_telemetry rows render + filters.
9. **Behavior** — sessions + devices live queries.
10. **Threat Intel** — iocs + threat_intel rows, external feed optional.
11. **Quantum** — quantum_assets list, migration status chart.
12. **Graph** — knowledge_edges visualization.
13. **Reports** — export/download of a real summary.
14. **Settings** — profile, demo-data buttons (Full / High-risk / Reset) all work.
15. **Copilot dock** — grounded answers referencing seeded rows; graceful 402/429.

## Per-module checklist

- Read the route + its live-queries hook.
- Confirm Supabase query returns rows for the seeded tenant (via `supabase--read_query`).
- Fix empty-state, loading skeleton, error boundary.
- Wire any button that currently no-ops.
- Add/adjust seed rows in `seedDeterministic` if the module needs specific shapes.
- Playwright script under `/tmp/browser/feat-<name>/` — login with a fresh dummy user, seed, navigate, screenshot, assert.
- View screenshot with `code--view` to visually confirm.
- Record PASS/FAIL in `docs/SMOKE_TESTS.md` results table.

## Final pass

- Run full `python3 scripts/smoke.py` → all sections green.
- Route sweep across all 13 protected routes → no `pageerror`, no auth bounce.
- Sign-out hygiene: no 401 storm in console.
- Publish reminder.

## Technical notes

- Use existing `requireSupabaseAuth` server fns; do not add FastAPI or edge functions.
- Any new query respects RLS via `is_analyst` (already covers all 4 roles).
- Seed via existing `seedDeterministic` server fn; extend it rather than adding a new one when a module lacks data.
- Screenshots go under `/tmp/browser/feat-<slug>/` — never committed.
- No Lovable branding introduced; keep README + FAQ copy neutral.

## Deliverables

- Each module visibly working in preview at 649px and desktop widths.
- Updated `docs/SMOKE_TESTS.md` with per-module PASS rows + date.
- One final screenshot per module archived in `/tmp/browser/final/`.
- Green `scripts/smoke.py` run captured in the results JSON.
