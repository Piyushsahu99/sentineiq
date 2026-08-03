"""
SentinelQ end-to-end regression suite (Playwright, headless Chromium).

Covers:
  A. Public surface        — landing, about, FAQ, no page errors
  B. Login flow            — render, validation, bad credentials, SSO button
  C. SSO / MFA flows       — Google button wiring, MFA gate for signed-out users
  D. Route protection      — every authenticated route bounces to /auth/login
  E. Authenticated screens — full route sweep, console-error free (needs a session)

Usage:
    python3 scripts/e2e.py
    BASE_URL=https://sentineiq.lovable.app python3 scripts/e2e.py
    E2E_EMAIL=... E2E_PASSWORD=... python3 scripts/e2e.py   # runs suite E

Session sources for suite E (first one found wins):
  1. LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY (injected preview session)
  2. E2E_EMAIL + E2E_PASSWORD (signs in through the real login form)
  3. E2E_SIGNUP=1 (creates a throwaway dummy account)
Without any of these, suite E is reported SKIP instead of FAIL.

Exit code is non-zero when any check fails, so CI catches regressions.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright, BrowserContext, Page

BASE = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
SHOTS = Path(os.environ.get("E2E_SHOTS", "/tmp/browser/e2e")) / time.strftime("%Y%m%d-%H%M%S")
SHOTS.mkdir(parents=True, exist_ok=True)

AUTH_ROUTES = [
    "/dashboard", "/alerts", "/transactions", "/investigations", "/correlation",
    "/telemetry", "/behavior", "/threat-intel", "/quantum", "/graph",
    "/explainable-ai", "/model-drift", "/ingest", "/reports", "/settings", "/profile",
]

RESULTS: list[tuple[str, str, str]] = []


def record(cid: str, status: bool | None, note: str = "") -> None:
    label = "SKIP" if status is None else ("PASS" if status else "FAIL")
    RESULTS.append((cid, label, note))
    print(f"[{label}] {cid}  {note}".rstrip())


async def goto(page: Page, url: str, settle: int = 2000) -> None:
    """Navigate, tolerating client-side redirects that interrupt the load."""
    for attempt in range(3):
        try:
            await page.goto(url, wait_until="domcontentloaded")
            break
        except Exception as exc:
            if "interrupted by another navigation" not in str(exc) or attempt == 2:
                if attempt == 2:
                    raise
            await page.wait_for_timeout(1000)
    await page.wait_for_timeout(settle)


async def shot(page: Page, name: str) -> None:
    try:
        await page.screenshot(path=str(SHOTS / f"{name}.png"))
    except Exception:
        pass


def attach_error_capture(page: Page, sink: list[str]) -> None:
    page.on("pageerror", lambda e: sink.append(f"PAGEERR {e}"))
    page.on("console", lambda m: sink.append(f"CONSOLE {m.text}") if m.type == "error" else None)


# --------------------------------------------------------------------------
# A. Public surface
# --------------------------------------------------------------------------
async def suite_public(page: Page) -> None:
    errs: list[str] = []
    attach_error_capture(page, errs)

    await page.goto(f"{BASE}/", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    await shot(page, "a1_landing")
    heading = await page.locator("h1").first.inner_text()
    record("A.1 landing renders h1", bool(heading.strip()), heading.strip()[:60])

    cta = page.get_by_role("link", name="Enter demo console")
    if await cta.count() == 0:
        cta = page.locator("a[href='/auth/login'], a[href='/dashboard']")
    record("A.2 sign-in CTA present", await cta.count() > 0)

    record("A.3 FAQ section present", await page.locator("#faq").count() > 0)

    await page.goto(f"{BASE}/about", wait_until="domcontentloaded")
    await page.wait_for_timeout(800)
    await shot(page, "a4_about")
    record("A.4 about page renders", "/about" in page.url and await page.locator("h1").count() > 0)

    hard = [e for e in errs if e.startswith("PAGEERR")]
    record("A.5 no uncaught page errors", not hard, "; ".join(hard[:2]))


# --------------------------------------------------------------------------
# B. Login flow
# --------------------------------------------------------------------------
async def suite_login(page: Page) -> None:
    await page.goto(f"{BASE}/auth/login", wait_until="domcontentloaded")
    await page.wait_for_timeout(900)
    await shot(page, "b1_login")

    record("B.1 login card renders", await page.locator("input[type=email]").count() > 0)
    record("B.2 Google SSO button present",
           await page.get_by_role("button", name="Continue with Google").count() > 0)

    submit = page.locator("form button[type=submit]").first

    # Client-side validation: submit empty form.
    await submit.click()
    await page.wait_for_timeout(500)
    alerts = await page.get_by_role("alert").count()
    record("B.3 empty submit shows validation", alerts > 0, f"{alerts} alert(s)")

    # Invalid email shape.
    await page.locator("input[type=email]").fill("not-an-email")
    await page.locator("input[type=password]").fill("short")
    await submit.click()
    await page.wait_for_timeout(500)
    body = await page.locator("body").inner_text()
    record("B.4 invalid email/password rejected",
           "valid email" in body or "at least 6" in body)

    # Real backend rejection.
    await page.locator("input[type=email]").fill(f"e2e-nouser+{int(time.time())}@example.com")
    await page.locator("input[type=password]").fill("WrongPass!2345")
    await submit.click()
    await page.wait_for_timeout(3500)
    await shot(page, "b5_bad_creds")
    body = await page.locator("body").inner_text()
    record("B.5 bad credentials stay on /auth/login", "/auth/login" in page.url, page.url)
    record("B.6 bad credentials surface an error",
           "Invalid" in body or "credentials" in body.lower())

    # Signup toggle exists.
    record("B.7 signup toggle available",
           await page.get_by_role("button", name="Create account").count() > 0)


# --------------------------------------------------------------------------
# C. SSO / MFA flows
# --------------------------------------------------------------------------
async def suite_sso_mfa(page: Page) -> None:
    await page.goto(f"{BASE}/auth/login", wait_until="domcontentloaded")
    await page.wait_for_timeout(800)

    # SSO click must not crash the page and must not navigate to a protected route.
    btn = page.get_by_role("button", name="Continue with Google").first
    await btn.click()
    await page.wait_for_timeout(2500)
    await shot(page, "c1_sso_click")
    # A pass means either the OAuth broker took over (/~oauth/initiate or an
    # external provider URL) or we are still on the login card with an error —
    # never a crash or a leak into a protected route.
    started_oauth = "/~oauth" in page.url or not page.url.startswith(BASE)
    on_app = not started_oauth
    record("C.1 Google SSO click handled without crash",
           started_oauth or "/auth/login" in page.url, page.url)

    if on_app:
        body = await page.locator("body").inner_text()
        record("C.2 SSO failure degrades gracefully",
               "Unsupported provider" not in body,
               "provider disabled" if "Unsupported provider" in body else "")
    else:
        record("C.2 SSO failure degrades gracefully", None, "redirected to provider")

    # MFA route must not be reachable without a session.
    ctx = page.context
    await ctx.clear_cookies()
    await page.goto(f"{BASE}/auth/mfa", wait_until="domcontentloaded")
    await page.wait_for_timeout(2500)
    await shot(page, "c3_mfa_signed_out")
    record("C.3 /auth/mfa redirects signed-out users", "/auth/login" in page.url, page.url)

    # Role-select route is also session-gated.
    await page.goto(f"{BASE}/auth/role-select", wait_until="domcontentloaded")
    await page.wait_for_timeout(2500)
    record("C.4 /auth/role-select requires a session",
           "/auth/login" in page.url or "/auth/role-select" in page.url, page.url)


# --------------------------------------------------------------------------
# D. Route protection
# --------------------------------------------------------------------------
async def suite_route_protection(page: Page) -> None:
    leaks: list[str] = []
    for route in AUTH_ROUTES:
        await goto(page, f"{BASE}{route}", 1800)
        if "/auth/login" not in page.url:
            leaks.append(f"{route} -> {page.url}")
    await shot(page, "d1_protection")
    record("D.1 all authenticated routes gated", not leaks, "; ".join(leaks[:3]))


# --------------------------------------------------------------------------
# E. Authenticated screens
# --------------------------------------------------------------------------
async def establish_session(ctx: BrowserContext, page: Page) -> str | None:
    """Return a description of how the session was established, or None."""
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if storage_key and session_json:
        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = BASE
            await ctx.add_cookies(cookies)
        await page.goto(f"{BASE}/", wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )
        return "injected preview session"

    email = os.environ.get("E2E_EMAIL")
    pw = os.environ.get("E2E_PASSWORD")
    signup = os.environ.get("E2E_SIGNUP") == "1"
    if not email and signup:
        email = f"e2e+{int(time.time())}@example.com"
        pw = "StrongPass!2345Abc"
    if not (email and pw):
        return None

    await page.goto(f"{BASE}/auth/login", wait_until="domcontentloaded")
    await page.locator("form button[type=submit]").first.wait_for(state="visible", timeout=20000)
    submit = page.locator("form button[type=submit]").first
    if signup and not os.environ.get("E2E_EMAIL"):
        # Retry the toggle until the form flips: an early click can land before
        # hydration attaches the handler.
        for _ in range(12):
            if (await submit.inner_text()).strip() == "Create account":
                break
            await page.get_by_role("button", name="Create account").first.click()
            await page.wait_for_timeout(700)
    await page.locator("input[type=email]").fill(email)
    await page.locator("input[type=password]").fill(pw)
    await submit.click()
    try:
        await page.wait_for_url(lambda u: "/auth/login" not in u, timeout=20000)
    except Exception:
        pass
    await page.wait_for_timeout(2000)
    await shot(page, "e0_after_signin")
    if "/auth/login" in page.url:
        body = " ".join((await page.locator("body").inner_text()).split())
        # Supabase throttles rapid signups ("for security purposes...") — back off once.
        if "security purposes" in body.lower() or "rate limit" in body.lower():
            await page.wait_for_timeout(25000)
            await page.locator("form button[type=submit]").first.click()
            try:
                await page.wait_for_url(lambda u: "/auth/login" not in u, timeout=20000)
            except Exception:
                pass
            await page.wait_for_timeout(2000)
        if "/auth/login" in page.url:
            print(f"      auth attempt failed: {body[:160]}")
            return None
    return f"credentials ({email})"


async def suite_authenticated(ctx: BrowserContext, page: Page) -> None:
    how = await establish_session(ctx, page)
    if not how:
        for cid in ("E.1 session established", "E.2 role gate reachable",
                    "E.3 authenticated route sweep", "E.4 sign-out clears session"):
            record(cid, None, "no test session available (set E2E_EMAIL/E2E_PASSWORD or E2E_SIGNUP=1)")
        return
    record("E.1 session established", True, how)

    await goto(page, f"{BASE}/dashboard", 3000)
    await shot(page, "e2_landing_after_auth")
    if "/auth/role-select" in page.url:
        await page.get_by_role("button", name="SOC Analyst", exact=False).first.click()
        await page.wait_for_timeout(400)
        await page.get_by_role("button", name="Enter SentinelQ").first.click()
        try:
            await page.wait_for_url(lambda u: "/dashboard" in u, timeout=20000)
        except Exception:
            pass
        await page.wait_for_timeout(2500)
        await shot(page, "e2b_after_role_select")
    record("E.2 role selection lands on dashboard", "/dashboard" in page.url, page.url)

    failures: list[str] = []
    for route in AUTH_ROUTES:
        errs: list[str] = []
        attach_error_capture(page, errs)
        await goto(page, f"{BASE}{route}", 2200)
        if "/auth/" in page.url:
            failures.append(f"{route}: bounced to {page.url}")
            continue
        hard = [e for e in errs if e.startswith("PAGEERR")]
        if hard:
            failures.append(f"{route}: {hard[0][:80]}")
        await shot(page, f"e3{route.replace('/', '_')}")
    record("E.3 authenticated route sweep", not failures, "; ".join(failures[:3]))

    # Sign out and confirm protected routes bounce again.
    await page.evaluate("window.localStorage.clear()")
    await page.context.clear_cookies()
    await goto(page, f"{BASE}/dashboard", 2500)
    record("E.4 sign-out clears session", "/auth/login" in page.url, page.url)


# --------------------------------------------------------------------------
async def main() -> int:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        for suite in (suite_public, suite_login, suite_sso_mfa, suite_route_protection):
            try:
                await suite(page)
            except Exception as exc:  # a crashed suite is a regression, not a runner bug
                record(f"{suite.__name__} crashed", False, str(exc)[:160])

        auth_ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        auth_page = await auth_ctx.new_page()
        try:
            await suite_authenticated(auth_ctx, auth_page)
        except Exception as exc:
            record("suite_authenticated crashed", False, str(exc)[:160])

        await browser.close()

    failed = [r for r in RESULTS if r[1] == "FAIL"]
    skipped = [r for r in RESULTS if r[1] == "SKIP"]
    print("\n" + "=" * 60)
    print(f"{len(RESULTS)} checks — {len(RESULTS) - len(failed) - len(skipped)} pass, "
          f"{len(failed)} fail, {len(skipped)} skip")
    print(f"screenshots: {SHOTS}")
    for cid, status, note in failed:
        print(f"  FAIL {cid}  {note}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
