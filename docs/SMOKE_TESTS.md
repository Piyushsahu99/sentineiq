# SentinelQ — End-to-End Smoke Test Checklist

Run before every demo, publish, or release. Each check has a **manual UI path** and, where possible, an **automated script**. All checks operate against **dummy data only** — no real customer PII should ever be needed.

**Automated runner:** `python3 scripts/smoke.py` (Playwright-based, headless).

---

## 0. Pre-flight

| # | Check | How | Pass criteria |
|---|---|---|---|
| 0.1 | Dev server up | `curl -sI http://localhost:8080` | `HTTP/1.1 200` |
| 0.2 | Public landing renders | Open `/` | Hero, FAQ, and "Enter demo console" CTA visible, no console errors |
| 0.3 | Cloud env present | Check `.env` has `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Both set |
| 0.4 | AI Gateway key present | Backend secrets include `LOVABLE_API_KEY` | Present |

---

## 1. Authentication — Email + Password

Dummy account: `smoke+<timestamp>@example.com` / `StrongPass!2345Abc`

| # | Step | Pass criteria |
|---|---|---|
| 1.1 | Go to `/auth/login` | Login card renders, "Continue with Google" button visible |
| 1.2 | Click **Create account**, enter dummy email + password, submit | Toast: `Account created. You are signed in.` |
| 1.3 | Auto-navigate to `/auth/mfa` | 6-digit code form renders |
| 1.4 | Click **Use demo code** → **Verify & continue** | Navigates to `/auth/role-select` (first login) or `/dashboard` |
| 1.5 | Pick **SOC Analyst** → **Enter SentinelQ** | Lands on `/dashboard`; sidebar shows email + role |
| 1.6 | Reload `/dashboard` | Session persists — no redirect to `/auth/login` |
| 1.7 | Sign out (topbar menu) | Redirects to `/auth/login`, protected routes bounce back |

**Negative:** wrong password → toast `Invalid login credentials`, stays on `/auth/login`.

---

## 2. SSO — Google (Managed Lovable Cloud OAuth)

Only run in a real browser (headed) — Google's consent screen blocks headless.

| # | Step | Pass criteria |
|---|---|---|
| 2.1 | On `/auth/login`, click **Continue with Google** | Google account chooser opens (popup in preview, full-page in prod) |
| 2.2 | Pick a test Google account | Returns to app origin; toast/console shows session set |
| 2.3 | After callback | Routes to `/auth/mfa` → `/auth/role-select` (first time) or `/dashboard` |
| 2.4 | `supabase.auth.getUser()` in console | Returns a user with `app_metadata.provider === "google"` |

**Fail modes to watch for:**
- `Unsupported provider` → Google not enabled in Cloud auth settings.
- Redirect loop back to `/auth/login` → `redirect_uri` was set to a protected route (must be `window.location.origin`).

---

## 3. Realtime Tables

Realtime is enabled on `alerts`, `transactions`, `ai_investigations`, `notifications`.

| # | Step | Pass criteria |
|---|---|---|
| 3.1 | Open two browser tabs on `/alerts` (same signed-in user) | Both show identical live queue |
| 3.2 | In tab A, click **Acknowledge** on the top alert | Tab B updates the row status within ~1s **without reload** |
| 3.3 | Open `/dashboard` in tab A, `/transactions` in tab B | Both render |
| 3.4 | In tab B click **Simulate suspicious transaction** | New row appears in tab B's table AND in tab A's dashboard "Live transactions" panel within ~2s |
| 3.5 | DevTools → Network → WS | One `realtime` websocket per tab, no reconnect loop |

**Automated check:** `scripts/smoke.py` opens two contexts, mutates in one, asserts DOM change in the other.

---

## 4. Correlation Engine

Triggered by `correlateTransaction` server fn (`src/lib/correlation.functions.ts`). Fires on the **Simulate suspicious transaction** button and on any manual `POST /_serverFn/*` call.

| # | Step | Pass criteria |
|---|---|---|
| 4.1 | Go to `/transactions`, click **Simulate suspicious transaction** | Toast: `Correlation complete · risk XX` |
| 4.2 | Check `/investigations` | A new investigation appears at the top; `attack_type`, `root_cause`, `risk_factors[]`, `recommended_actions[]` populated |
| 4.3 | If reported risk ≥ 80 → check `/alerts` | New alert row with matching title, severity `critical` or `high` |
| 4.4 | Open `/correlation` | Kill-chain timeline shows the new event linked to txn/customer/device |
| 4.5 | SQL sanity: | See below |

```sql
-- last correlation run
select id, risk_score, status, created_at from risk_scores order by created_at desc limit 1;
select id, title, confidence, attack_type from ai_investigations order by created_at desc limit 1;
select id, severity, title, status from alerts order by created_at desc limit 1;
```

**Fail modes:**
- No investigation → check server-function logs for `Transaction not found` or RLS 401.
- Risk score always 0 → seed data missing (`customers`, `cyber_telemetry`); re-run seed migration.

---

## 5. AI Copilot

Backed by `askCopilot` server fn → Lovable AI Gateway (`gemini-2.5-flash`), grounded on live alerts / investigations / transactions / telemetry.

| # | Step | Pass criteria |
|---|---|---|
| 5.1 | Open Copilot dock (bottom-right) | Input focused, greeting message visible |
| 5.2 | Ask: `Summarise the latest critical alert` | Streamed answer references a real alert title from `/alerts` |
| 5.3 | Ask: `Give me an executive briefing for the last 24h` | Mentions numeric counts consistent with dashboard KPIs |
| 5.4 | Ask: `What triggered the most recent investigation?` | Names the attack type and lists at least one risk factor from `ai_investigations` |
| 5.5 | Force-fail: temporarily unset `LOVABLE_API_KEY` and ask anything | Returns graceful `AI Gateway is not configured…` message, no crash |
| 5.6 | Rate-limit path: send 10 questions in quick succession | No unhandled 429; toast surfaces backoff message |

**Grounding sanity:** every factual claim in an answer should map to a row visible in the UI. If the copilot invents entities not in the tables, the grounding context is empty — check the server-fn logs and confirm the tenant has seed data.

---

## 6. Data Integrity

| # | Check | SQL / UI |
|---|---|---|
| 6.1 | RLS enforced | Sign in as user A, `select * from alerts` from user B's session returns only B's rows |
| 6.2 | Role isolation | `SOC Analyst` sees Alerts + Telemetry; switching to `Executive` reshapes dashboard KPIs |
| 6.3 | Seed data present | `select count(*) from transactions` ≥ 50, `customers` ≥ 20, `cyber_telemetry` ≥ 200 |
| 6.4 | No orphaned FKs | `select count(*) from transactions where customer_id not in (select id from customers)` = 0 |

---

## 7. Regression sweep (all routes render)

Signed in, visit each and assert no `PAGEERR` in console:

`/dashboard`, `/alerts`, `/transactions`, `/investigations`, `/correlation`,
`/telemetry`, `/behavior`, `/threat-intel`, `/quantum`, `/graph`,
`/explainable-ai`, `/reports`, `/settings`.

Automated in `scripts/smoke.py` (§ `route_sweep`).

---

## 8. Sign-off

- [ ] All sections 0–7 green
- [ ] No `console.error` other than known hydration warnings
- [ ] Screenshots archived under `/tmp/browser/smoke/<date>/`
- [ ] Tag the commit `smoke-ok-YYYYMMDD`

Owner: on-call SOC engineer. Cadence: every merge to `main` + pre-demo.
