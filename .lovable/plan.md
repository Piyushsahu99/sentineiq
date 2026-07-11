## Goal
Add region/bank/currency preferences (India + INR default), rebuild Profile with a transaction checking history, upgrade Settings, and refresh Landing + Settings + Profile copy to match.

## 1. Database
New migration:
- `public.profiles`: add `region text default 'IN'`, `bank text default 'HDFC Bank'`, `currency text default 'INR'` (NOT NULL with defaults). Backfill existing rows.
- New `public.tx_check_history` table: `id, user_id, transaction_id, verdict, risk_score, signals jsonb, currency, amount_local, created_at`. RLS: user reads own; analysts read all. GRANT to authenticated + service_role.
- Trigger (or explicit insert from `correlateTransaction`) writes a row every time a correlation runs.

## 2. Currency engine
- `src/lib/currency.ts`: static rate table (USD base) for INR, USD, EUR, GBP, AED, SGD, JPY. Helpers `formatMoney(amount, currency)`, `convert(amount, from, to)`. Symbols: ₹ default.
- `src/lib/prefs.ts` + React `usePrefs()` hook: loads region/bank/currency from `profiles`, caches like `session.ts`, exposes `format(amount)`.
- Replace every hardcoded `$` / `USD` in dashboard KPIs, transactions table, reports, alerts, investigations with `format()`.
- Extend `seedDeterministic` to accept `{ currency, region }`; seeded amounts stored in tenant currency. Re-seed on currency change with a confirm dialog.

## 3. Settings — new "Region & Currency" tab (first tab)
- Region select (India default, 10 countries). Bank select filtered by region (India: HDFC, ICICI, SBI, Axis, Kotak; US: Chase, BoA, Wells Fargo; etc.). Currency select (auto-suggests region's currency; user can override).
- Save button → updates `profiles`, invalidates prefs, offers "Re-seed demo data in new currency".
- Reorder tabs: Region & Currency → Demo Data → Roles → Notifications → API → SIEM → Feeds → Quantum.
- Polish existing tabs: consistent spacing, real switches wired to local state, remove `Math.random()` in feeds/SIEM (use deterministic seeded values).

## 4. Profile page (new route `/_app/profile`)
Tabs:
- **Overview**: avatar, name, email, role, region/bank/currency chips, edit display name.
- **Checking history**: paginated table from `tx_check_history` — timestamp, tx id, merchant, amount (formatted in tenant currency), risk, verdict, signals count. Filters: verdict, date range. Row click → opens Explainable AI for that check.
- **Security**: last login, MFA status, sign-out all sessions button.
Add Profile link to sidebar + topbar user menu.

## 5. Landing page content refresh
- Hero subhead mentions "Built for Indian banks with multi-region support (INR default, USD/EUR/GBP/AED ready)".
- New FAQ entries: "Which currencies and regions are supported?", "Does it work for Indian banks (RBI/UPI context)?", "How is checking history retained?".
- Update pillar copy to reflect India-first framing without removing global capability.

## 6. Workflow tightening
- Auth flow: after role-select, if profile has no region → route to `/auth/region-select` (new lightweight step) → dashboard. Existing users skip (India/INR default already backfilled).
- Correlation server fn writes to `tx_check_history` after each run.
- Sidebar: add "Profile" and rename "Settings" section grouping.

## Files touched
```
supabase migration (profiles cols + tx_check_history + policies + grants)
src/lib/currency.ts                 (new)
src/lib/prefs.ts                    (new)
src/lib/seed.functions.ts           (currency-aware)
src/lib/correlation.functions.ts    (write tx_check_history)
src/routes/_app.settings.tsx        (new tab, reorder, polish)
src/routes/_app.profile.tsx         (new)
src/routes/auth.region-select.tsx   (new, optional gate)
src/routes/_app.tsx                 (region gate check)
src/routes/_app.dashboard.tsx       (format money)
src/routes/_app.transactions.tsx    (format money)
src/routes/_app.reports.tsx         (format money)
src/routes/_app.alerts.tsx          (format money)
src/routes/_app.investigations.tsx  (format money)
src/routes/index.tsx                (landing copy + FAQ)
src/components/shell/sidebar.tsx    (Profile link)
src/components/shell/topbar.tsx     (Profile in user menu)
```

## Not in scope
- Live FX rates (using static table; documented in Settings).
- Full content rewrite of the other 10 protected routes — only money formatting there.
- Admin UI to change another user's region.

Approve to build.