# SentinelQ → Real Backend (Lovable Cloud + Supabase + Gemini)

Move SentinelQ from a mock-data prototype to a live, Supabase-powered app with real auth, realtime updates, an AI Copilot backed by Gemini, and a working Correlation Engine. Frontend stays as-is visually; data layer swaps from `src/lib/mock/data.ts` to Supabase queries.

## Phase 0 — Enable backend

- Enable **Lovable Cloud** (Supabase under the hood: DB, Auth, Realtime, Storage, Edge/server functions).
- Enable **Lovable AI Gateway** for Gemini calls (no API key handling for you).

## Phase 1 — Auth (replace localStorage session)

- Supabase Auth: email + password, plus Google sign-in.
- `profiles` table (id → auth.users, display_name, email).
- Roles via separate `user_roles` table + `app_role` enum (`soc_analyst`, `fraud_analyst`, `risk_manager`, `executive`) + `has_role()` security-definer function.
- Auto-create profile on signup via trigger; first user optionally promoted to `executive` for demo.
- Rewire `/auth/login`, `/auth/mfa` (kept as UI-only OTP step, optional), `/auth/role-select` (writes role via server fn), and `_app` guard to real session — remove `sq_auth` / `sq_mfa` / `sq_role` localStorage.
- Add `/reset-password` route.

## Phase 2 — Database schema

Normalized tables in `public`, all with GRANTs + RLS + policies:

`customers, accounts, devices, sessions, transactions, beneficiaries, cyber_telemetry, threat_intel, iocs, alerts, ai_investigations, risk_scores, quantum_assets, reports, knowledge_edges, notifications`.

- FKs, indexes on hot columns (customer_id, created_at, risk_score, severity).
- RLS: analyst/executive roles can `SELECT` operational tables via `has_role()`; only service_role writes for ingestion tables. Users can read their own `profiles`.
- Seed migration inserts a realistic demo dataset (customers, 500 transactions, telemetry, threat intel, one full correlated incident) so the dashboard is populated on first login.

## Phase 3 — Realtime dashboards

- Subscribe to `transactions`, `alerts`, `risk_scores`, `ai_investigations`, `notifications` via `supabase.channel(...).on('postgres_changes', ...)`.
- Dashboard KPIs, Live Threat Timeline, Alert Center, Risk charts, Correlation feed all update without refresh.
- Replace every `src/lib/mock/data.ts` consumer with TanStack Query + Supabase; keep the mock module only as a seed helper (or delete).

## Phase 4 — Correlation Engine (server function)

- `createServerFn` `correlateTransaction({ transactionId })`:
  1. Load transaction + customer baseline, recent sessions, device fingerprint, geo, telemetry in the last 24h, matching IOCs, recent alerts.
  2. Compute weighted composite risk score (0–100) with named contributors (device change, geo anomaly, velocity, IOC hit, off-hours, amount z-score, telemetry severity).
  3. Insert into `risk_scores`, insert `ai_investigations` row (root cause, evidence JSON, recommended actions), insert `alert` if score ≥ 80, insert `knowledge_edges` for entities touched, insert `notifications`.
- Postgres trigger on `INSERT INTO transactions` → calls a server route `/api/public/hooks/tx-correlate` (signed with `CORRELATION_SECRET`) that invokes the server fn. Alternative: call the server fn directly from the client after insert (simpler for hackathon).

## Phase 5 — AI Copilot (Gemini via Lovable AI Gateway)

- `createServerFn` `askCopilot({ prompt, contextIds })` with `requireSupabaseAuth`.
- Server fn pulls live rows (recent txns, alerts, target investigation), builds a compact context, calls Gemini `gemini-2.5-flash` through the AI Gateway, streams the answer.
- Suggestion chips map to canned intents but responses are real LLM output grounded in live data.

## Phase 6 — Reports

- Report definitions in `reports` table; server fn assembles data → returns structured JSON → client renders with existing PDF export (`jspdf`/`html2canvas`).
- SOC, Fraud, Executive, Compliance variants, all from live data.

## Phase 7 — Quantum module

- `quantum_assets` table (asset, algo, key_size, tls_version, expires_at, migration_status, sensitivity).
- Readiness score = weighted % of assets on PQC-ready algorithms; HNDL exposure = Σ sensitivity of long-lived RSA/ECC assets.
- Charts/tables read live rows; “Migrate” action updates status.

## Phase 8 — Knowledge Graph

- `knowledge_edges(src_type, src_id, dst_type, dst_id, weight, created_at)` populated by Correlation Engine.
- Replace SVG mock graph with **react-force-graph-2d** (already planned) reading edges live; realtime subscribe for new edges.

## Phase 9 — Alerts

- Trigger already created in Phase 4. Alert Center reads `alerts` live; analyst can acknowledge / assign / resolve — updates gated by RLS (analyst roles only). Realtime badge on topbar via `notifications`.

## Phase 10 — Cleanup

- Delete `src/lib/mock/data.ts` and every import.
- Confirm no route reads from localStorage for data.
- Loading skeletons + `errorComponent` / `notFoundComponent` on every route with a loader.

## Technical Details

- Stack stays TanStack Start; all server logic uses `createServerFn` (or `/api/public/*` route for the DB webhook). No FastAPI, no Supabase Edge Functions unless a DB trigger truly needs one.
- Clients: browser `@/integrations/supabase/client` for reads/subscriptions; `requireSupabaseAuth` for user-scoped server fns; `supabaseAdmin` only inside the correlation route (verified via secret).
- Public routes (`/`, `/auth/*`) stay SSR; the entire app shell moves under `src/routes/_authenticated/` (integration-managed layout) — the current `_app.tsx` `beforeLoad` localStorage check is removed.
- Realtime enabled per table via `alter publication supabase_realtime add table ...`.
- Secrets needed: `CORRELATION_SECRET` (generated) if we wire the DB-trigger webhook.

## Out of scope (say the word to add)

- Real MFA (kept as UI step or removed).
- SSO (Okta/Azure/Ping) — Google only for now.
- SIEM ingestion connectors — telemetry stays synthetic/seeded.
- Actual PDF templating polish beyond current export.

Approve and I'll execute Phase 0 → 10 in order. Say if you'd rather skip MFA UI entirely or want the DB-trigger webhook path over client-invoked correlation.
