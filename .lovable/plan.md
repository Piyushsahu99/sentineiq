
## Goal
Add a polished, presentation-style **About** page at `/about` that walks an evaluator through SentinelQ end-to-end — the problem, our solution, features, technical architecture, AI models/APIs, metrics, and business impact. Visually consistent with the existing landing page (aurora bg, glass cards, cyan→violet gradient, Logo, `GlassCard`).

## Route
- New file: `src/routes/about.tsx` (TanStack file route, `ssr: false` to match `/`).
- Own `head()` with unique title/description/OG/twitter tags + canonical `https://sentinel-q.today/about`.
- Add "About" link in the landing header nav (`src/routes/index.tsx`) alongside Platform/Modules/Workflow/FAQ.
- Add footer link too.

## Page structure (slide-like sections, one idea per section)

1. **Hero** — Kicker "About SentinelQ", H1 "Unified Cyber + Fraud Intelligence for Modern Banks", 1-line subtitle, CTA buttons ("Launch demo console" → `ctaEnter`, "View architecture" → scroll to #architecture).

2. **The Problem** — 3 GlassCards:
   - Siloed SOC vs Fraud teams
   - Alert fatigue + slow decisions
   - Emerging quantum ("Harvest Now, Decrypt Later") risk
   Each with icon, stat, short body.

3. **Our Solution** — Split layout: left = narrative ("One correlation plane across cyber telemetry, transactions, behavior, threat intel, quantum posture"); right = mini architecture visual (SVG: Ingest → Enrich → Correlate → Investigate → Respond) reusing workflow style.

4. **Key Features & Innovation** — 6-card grid (Weighted correlation engine, Combo escalators / kill-chain detection, Explainable AI with risk breakdown, Behavioral baselines + z-score anomalies, Post-quantum readiness scoring, Analyst feedback loop / auto-suppression).

5. **Technical Architecture** (`#architecture`) — Layered diagram (as styled divs, not an image):
   - Presentation: React 19 + TanStack Start + Tailwind v4
   - Server: TanStack `createServerFn` on Cloudflare Workers
   - Data: Lovable Cloud (Postgres + RLS + Realtime + Storage + Auth)
   - AI: Lovable AI Gateway → Gemini 2.5 Flash
   - Observability: Playwright smoke tests + Vitest accuracy suite
   Each layer = one row of pill-badges listing the pieces.

6. **AI Models & APIs** — Table/grid of cards:
   - `google/gemini-2.5-flash` — narrative synthesis, copilot Q&A
   - Deterministic correlation core (in-house, `correlation-core.server.ts`) — weighted signals + combo escalators
   - Behavioral baseline model — 90-day rolling z-score on amount / hour / merchant
   - Post-quantum scorer — TLS + key-lifetime HNDL exposure
   - Data APIs: Supabase PostgREST + Realtime, OpenStreetMap tiles for threat map
   Each card shows purpose, inputs, outputs, latency.

7. **Metrics** — GlassCard band with the actual test-suite numbers from this project:
   - **40/40** accuracy tests passing
   - **100%** within-1-band accuracy
   - **0%** false-positive rate on normal traffic
   - **0** missed blocks on high-risk chains
   - **94ms** median decision latency
   - **21** labeled fraud/cyber scenarios in eval corpus
   Plus a small note: numbers come from `tests/correlation-accuracy.test.ts` and the correlation engine benchmark.

8. **Scalability** — 3 cards: stateless server functions on edge Workers, Postgres partitioning-ready schema + indices on `(customer_id, created_at desc)`, Realtime fan-out via Supabase channels.

9. **Security & Compliance** — 3 cards + compliance pill row (SOC 2 Type II, ISO 27001, PCI DSS 4.0, PSD2 SCA, DORA, NIST CSF 2.0): RLS per role, real TOTP MFA via Supabase, PII minimisation + no external model retention.

10. **Business Impact** — 4 KPI tiles: fraud prevented, analyst hours saved / week, MTTD reduction, coverage vs legacy SIEM-only stack.

11. **Closing CTA** — Reuse landing CTA block ("See correlation live" → demo console + Sign in).

## Visual/UX rules
- Reuse `Logo`, `GlassCard`, `bg-aurora`, `bg-grid`, `text-gradient-cyber`, `hairline`, `glass` utilities — do NOT introduce new colors.
- lucide-react icons already in use.
- Framer-motion fade-up on section entry (same pattern as landing).
- Section spacing `py-20`, container `max-w-7xl mx-auto px-4 sm:px-6 md:px-10`.
- Fully responsive: single column on mobile, 2–3 columns md+, no horizontal overflow.
- No new dependencies, no backend changes, no schema changes.

## Non-goals
- No new server functions, no DB migrations, no auth changes.
- Metrics are presentational (sourced from existing test output); no live queries added on this page.

## Files touched
- Add: `src/routes/about.tsx`
- Edit: `src/routes/index.tsx` (add "About" link in header nav + footer)
