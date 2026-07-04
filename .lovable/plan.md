# SentinelQ — Implementation Plan

A premium, dark-mode, glassmorphic enterprise cybersecurity platform for banks. Built entirely as a polished frontend prototype with rich mock data (no backend/auth persistence unless you ask). Every screen from your spec will be built.

## Scope decisions (defaults — tell me to change any)

- **No Lovable Cloud / real auth.** Login, SSO, MFA, forgot-password, and role selection are UI flows with mock validation. Selected role is stored in `localStorage` and drives sidebar/dashboards. Say the word and I'll wire real auth + Postgres.
- **No real AI backend.** The AI Copilot and AI Investigation pages use scripted, realistic mock responses with typing/streaming animation. Can be upgraded to Lovable AI Gateway later.
- **All data is mock** (generated with seeded randomness so charts/tables feel real and consistent across reloads).
- **Desktop-first**, responsive down to tablet. Mobile is usable but not the focus.
- **Charts:** Recharts. **Graph:** react-force-graph-2d. **Map:** react-simple-maps (world topojson). **Animations:** framer-motion. **Icons:** lucide-react. **Command palette:** `cmdk` (already via shadcn).

## Design system

- Dark-by-default theme in `src/styles.css` using OKLCH tokens: deep navy background (`#0a0f1e`-ish), elevated glass surfaces with `backdrop-blur`, hairline borders (`white/8`), electric blue (`#3b82f6`), cyan (`#22d3ee`), violet (`#8b5cf6`) accents, plus semantic risk tokens (`--risk-critical/high/medium/low/info`).
- Typography: Inter (body) + JetBrains Mono (numbers/telemetry), loaded via `<link>` in `__root.tsx`.
- Gradients: subtle radial/linear gradients on hero cards, glow rings on KPI numbers, animated grid background on auth pages.
- Reusable primitives: `GlassCard`, `KpiCard` (animated count-up), `RiskBadge`, `ThreatBadge`, `SeverityDot`, `Sparkline`, `ProgressRing`, `Heatmap`, `Timeline`, `DataTable` (sortable/filterable), `SectionHeader`, `EmptyState`, `Skeleton` variants, `Shimmer`.
- Micro-interactions: hover lift, gradient border on focus, framer `AnimatePresence` page transitions, staggered card entrance.

## Route architecture (TanStack Start)

```
src/routes/
  __root.tsx                  # dark theme, fonts, HeadContent, global providers
  index.tsx                   # redirects to /auth/login or /dashboard based on mock session
  auth/
    login.tsx                 # email+password, SSO buttons (Okta/Azure/Google), "Continue"
    mfa.tsx                   # 6-digit OTP UI + trust-device
    forgot-password.tsx
    role-select.tsx           # SOC / Fraud / Risk / Executive cards
  _app.tsx                    # authenticated layout: sidebar + topbar + Copilot dock + <Outlet/>
  _app/
    dashboard.tsx             # Executive Security Dashboard
    correlation.tsx           # Correlation Engine (flagship)
    correlation.$caseId.tsx   # deep-link into a specific correlated case
    investigations.tsx        # list
    investigations.$id.tsx    # AI Investigation report
    transactions.tsx
    telemetry.tsx             # Firewall/VPN/IAM/Endpoint/Email/Cloud/DNS/Auth tabs
    threat-intel.tsx
    quantum.tsx
    behavior.tsx              # customer list -> profile
    behavior.$customerId.tsx
    explainable-ai.tsx
    graph.tsx                 # knowledge graph
    alerts.tsx
    reports.tsx
    settings.tsx              # tabs: Roles / Notifications / API / SIEM / Feeds / Quantum policy
```

Global overlays mounted in `_app.tsx`: `CommandPalette` (⌘K), `NotificationCenter` (slide-over), `CopilotDock` (floating button → side panel with streaming chat).

## Page-by-page contents

**Auth flows** — animated grid + aurora background, SentinelQ logo mark, glass card. Login → MFA → Role Select → `/dashboard`. Forgot-password shows success state.

**Executive Dashboard** — 7 animated KPI cards (Total Threats, Critical, Fraud Prevented $, Tx Monitored, Avg Risk, FP Reduction %, Quantum Readiness ring). Grid below: Live Threat Timeline (streaming feed), Risk Distribution (donut), Threat Heatmap (7×24 hours), Top Attack Categories (horizontal bars), Fraud Trends (area chart), Transaction Monitoring (live sparkline + counters), Live Security Feed (auto-scrolling), Recent AI Investigations / Alerts / Blocked Transactions (three compact lists).

**Correlation Engine** — top summary strip (Correlation Score gauge, Attack Type, Confidence, Business Impact $, Fraud Prob %, Cyber Threat Prob %). Center: vertical connected timeline of the exact 9 events you listed, each a clickable node with severity glow. Right rail: detail panel for selected node (timestamp, source, risk contribution %, evidence JSON, confidence bar). Bottom: "Final AI Decision" card with recommended actions and one-click "Open Investigation".

**AI Investigation** — hero with Attack Summary + AI Confidence ring. Sections: Root Cause, Evidence (log snippets), Risk Factors (chips), Timeline (mini), Recommended Actions (checklist). Expandable accordions: Technical Details, Business Summary, Compliance Notes (PSD2/GDPR/PCI-DSS/NIS2 tags). "Download PDF" uses `jspdf` + `html2canvas` to export the current report.

**Transaction Analytics** — filter bar (search, risk slider, amount range, country multi-select, device, payment method, date). Rich DataTable with row risk bar, country flag, device icon, status pill. Side charts: Transaction Timeline, Behaviour Comparison (radar: current vs baseline), Suspicious tab, Blocked tab.

**Cybersecurity Telemetry** — tabbed view (Firewall / VPN / IAM / Endpoint / Email / Cloud / DNS / Auth). Each tab: live-updating table with Severity, Source, Timestamp, User, Device, Risk Score, plus a small trend chart at top.

**Threat Intelligence** — Global Threat Map (world map with pulsing dots per origin country), Known Malicious IPs table, Threat Campaigns cards, Malware Families grid, MITRE ATT&CK matrix (tactics × techniques, highlighted cells), IOCs table, live Threat Feed.

**Quantum Risk** — Quantum Readiness Meter (large ring, 0–100), Cryptographic Asset Inventory table (TLS versions, RSA, ECC, legacy), HNDL Exposure card ($ value of long-term sensitive data at risk), Migration Priority list, Recommended Migration Strategy (PQC algorithm suggestions: Kyber/Dilithium/Falcon), Timeline for Quantum Readiness (Gantt-style).

**Customer Behaviour** — searchable customer list → profile page: typical login map, trusted devices, transaction behaviour (avg amount, active hours heatmap), Risk Trend line, Behaviour Timeline, Behaviour Change Detection callouts.

**Explainable AI** — decision picker at top. Displays Risk Score + Confidence rings, Positive/Negative Factor columns, Feature Importance bar chart, SHAP-style contribution cards (each feature with direction arrow and magnitude), natural-language explanation paragraph, Recommended Actions.

**Knowledge Graph** — full-viewport force-directed graph with node types (Customer, Account, Device, IP, Transaction, Merchant, Threat Actor, Malware, Location, VPN) colored by type. Click node → highlights connected subgraph + side panel with entity details and related alerts. Legend + node-type filter chips.

**AI Copilot** — floating bottom-right button. Opens right-side panel with conversation UI, suggestion chips ("Why was this blocked?", "Summarize this attack", "Show attack timeline", "Recommend actions", "Explain to executives", "Generate incident report"). Responses are pre-scripted per intent, streamed with a shimmer effect; can render inline mini-timelines or bullet actions.

**Alert Center** — Kanban-ish tabs (Critical / Medium / Low / Acknowledged / Resolved), each alert card shows severity, source, assignee avatar, SLA countdown. Detail drawer: Assign Analyst dropdown, Status Timeline, Add Note.

**Reports** — cards for SOC / Fraud / Executive / Compliance. Clicking opens a PDF-styled preview (rendered HTML) + Download button (jspdf).

**Settings** — tabs for User Roles (table + role permissions matrix), Notification Preferences (channel toggles), API Integrations (API keys mock, generate/rotate), SIEM Integrations (Splunk/Sentinel/QRadar/Elastic connectors), Threat Feed Settings (feed list with enable toggle), Quantum Policy Settings (min TLS version, deprecate RSA date, PQC target date).

## Global UX

- ⌘K command palette: jump to any page, search alerts/customers/transactions.
- Notification center: unread badge, grouped by severity.
- Framer-motion route transitions (fade+slide 200ms).
- Skeleton loaders on every data surface (first paint) — visible for ~400ms to feel real.
- Keyboard shortcuts: `?` shows shortcut sheet; `g d` → dashboard, `g c` → correlation, etc.
- Accessible: focus rings, aria labels on icon-only buttons, prefers-reduced-motion respected.

## Dependencies to add

`framer-motion`, `recharts`, `react-force-graph-2d`, `react-simple-maps`, `d3-scale`, `d3-geo`, `topojson-client`, `world-atlas`, `jspdf`, `html2canvas`, `date-fns`, `@faker-js/faker` (seeded, dev-time mock generator kept out of prod bundle by using it in a build-time module or lightweight custom generator — I'll use a small custom seeded generator to avoid bundle bloat).

## Delivery order (single build)

1. Theme tokens + fonts + `__root.tsx` + auth pages.
2. `_app` shell: sidebar, topbar, notifications, copilot dock, command palette.
3. Mock data layer (`src/lib/mock/*`): threats, transactions, telemetry, customers, graph, quantum inventory, alerts.
4. Executive Dashboard.
5. Correlation Engine (flagship polish pass).
6. AI Investigation + PDF export.
7. Transactions, Telemetry, Threat Intel (+ map), Quantum.
8. Behavior, Explainable AI, Knowledge Graph.
9. Alerts, Reports, Settings.
10. Copilot scripted responses + shortcuts + empty/loading polish pass.

## Out of scope (this plan)

- Real authentication, real database, real streaming from SIEMs.
- Real LLM calls for Copilot/Investigations.
- Mobile-first optimization beyond "usable".

Approve and I'll build it end-to-end. If you want real auth + AI wired in, say so before approving and I'll add Lovable Cloud + Lovable AI Gateway to the plan.