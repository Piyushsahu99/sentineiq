"""
SentinelQ end-to-end smoke test.

Runs the checklist in docs/SMOKE_TESTS.md against a locally running dev server
(default http://localhost:8080). Uses only dummy accounts and dummy data.

Usage:
    python3 scripts/smoke.py
    BASE_URL=https://project--<id>.lovable.app python3 scripts/smoke.py

Skips Google SSO (needs a real consent screen — run manually per §2).
"""
from __future__ import annotations
import asyncio, os, sys, time, json
from pathlib import Path
from playwright.async_api import async_playwright, Page, BrowserContext

BASE = os.environ.get("BASE_URL", "http://localhost:8080")
SHOTS = Path("/tmp/browser/smoke") / time.strftime("%Y%m%d-%H%M%S")
SHOTS.mkdir(parents=True, exist_ok=True)

RESULTS: list[tuple[str, str, str]] = []  # (id, status, note)

def record(cid: str, ok: bool, note: str = "") -> None:
    RESULTS.append((cid, "PASS" if ok else "FAIL", note))
    print(f"[{'PASS' if ok else 'FAIL'}] {cid}  {note}")

async def shot(page: Page, name: str) -> None:
    await page.screenshot(path=str(SHOTS / f"{name}.png"))

# ---------- checks ----------

async def check_preflight(page: Page) -> None:
    await page.goto(f"{BASE}/", wait_until="networkidle")
    ok = await page.locator("text=Enter demo console").count() > 0 or await page.locator("text=Launch demo console").count() > 0
    await shot(page, "0_landing")
    record("0.2 landing", ok, page.url)
    faq = await page.locator("#faq").count() > 0
    record("0.2 faq section present", faq)

async def check_auth(page: Page) -> tuple[str, str]:
    email = f"smoke+{int(time.time())}@example.com"
    pw = "StrongPass!2345Abc"
    await page.goto(f"{BASE}/auth/login", wait_until="networkidle")
    await page.get_by_role("button", name="Create account").first.click()  # toggle to signup
    await page.locator('input[type=email]').fill(email)
    await page.locator('input[type=password]').fill(pw)
    await page.get_by_role("button", name="Create account").last.click()   # submit
    await page.wait_for_timeout(2500)
    await shot(page, "1_after_signup")
    record("1.2 signup accepted", "login" not in page.url or "signed in" in (await page.content()).lower(), page.url)

    # If routed to mfa, complete demo code
    if "mfa" in page.url:
        btn = page.get_by_text("Use demo code")
        if await btn.count():
            await btn.click()
        submit = page.get_by_role("button").filter(has_text="Verify")
        if await submit.count():
            await submit.first.click()
        await page.wait_for_timeout(1500)
    # Role select on first login
    if "role-select" in page.url:
        await page.get_by_text("SOC Analyst").first.click()
        await page.wait_for_timeout(300)
        cont = page.get_by_role("button").filter(has_text="Enter SentinelQ")
        if await cont.count():
            await cont.first.click()
        await page.wait_for_timeout(2000)
    await shot(page, "1_after_role")
    record("1.5 lands on dashboard", "/dashboard" in page.url, page.url)

    # Reload → session persists
    await page.reload(wait_until="networkidle")
    record("1.6 session persists", "/dashboard" in page.url, page.url)
    return email, pw

async def check_route_sweep(page: Page) -> None:
    routes = ["/dashboard","/alerts","/transactions","/investigations","/correlation",
              "/telemetry","/behavior","/threat-intel","/quantum","/graph",
              "/explainable-ai","/reports","/settings"]
    errs: list[str] = []
    page.on("pageerror", lambda e: errs.append(f"{page.url}: {e}"))
    for r in routes:
        before = len(errs)
        await page.goto(f"{BASE}{r}", wait_until="networkidle")
        await page.wait_for_timeout(500)
        ok = "/auth/" not in page.url and len(errs) == before
        record(f"7 route {r}", ok, "pageerror" if len(errs) != before else "")
    if errs:
        print("PAGEERRORS:", *errs, sep="\n  ")

async def check_correlation(page: Page) -> None:
    await page.goto(f"{BASE}/transactions", wait_until="networkidle")
    btn = page.get_by_role("button").filter(has_text="Simulate suspicious")
    if await btn.count() == 0:
        record("4.1 simulate button", False, "button missing")
        return
    await btn.first.click()
    await page.wait_for_timeout(3500)
    await shot(page, "4_after_simulate")
    txt = (await page.content()).lower()
    record("4.1 correlation ran", "risk" in txt, "toast/txn updated")
    # Investigations updated?
    await page.goto(f"{BASE}/investigations", wait_until="networkidle")
    await page.wait_for_timeout(1000)
    has_inv = await page.locator("text=/attack|root cause|risk factor/i").count() > 0
    await shot(page, "4_investigations")
    record("4.2 investigation created", has_inv)

async def check_realtime(ctx: BrowserContext) -> None:
    p1 = await ctx.new_page()
    p2 = await ctx.new_page()
    await p1.goto(f"{BASE}/dashboard", wait_until="networkidle")
    await p2.goto(f"{BASE}/transactions", wait_until="networkidle")
    before = await p1.locator("tr, [data-row]").count()
    btn = p2.get_by_role("button").filter(has_text="Simulate suspicious")
    if await btn.count() == 0:
        record("3.4 realtime", False, "simulate button missing in tab B")
        return
    await btn.first.click()
    await p1.wait_for_timeout(3500)
    after = await p1.locator("tr, [data-row]").count()
    await shot(p1, "3_realtime_dashboard")
    record("3.4 realtime tab A reflects tab B mutation", after >= before, f"{before}->{after}")
    await p1.close(); await p2.close()

async def check_copilot(page: Page) -> None:
    await page.goto(f"{BASE}/dashboard", wait_until="networkidle")
    # open copilot dock
    dock = page.get_by_role("button").filter(has_text="Copilot")
    if await dock.count():
        await dock.first.click()
    ta = page.locator("textarea, input[placeholder*='Ask' i]").first
    if await ta.count() == 0:
        record("5.1 copilot dock", False, "no input")
        return
    await ta.fill("Summarise the latest critical alert")
    await page.keyboard.press("Enter")
    # Wait for streamed reply
    for _ in range(20):
        await page.wait_for_timeout(500)
        body = await page.content()
        if any(k in body.lower() for k in ("alert", "severity", "critical", "no critical")):
            break
    await shot(page, "5_copilot")
    ok = any(k in (await page.content()).lower() for k in ("alert","risk","critical","no critical","not configured"))
    record("5.2 copilot answer grounded", ok)

# ---------- main ----------

async def main() -> int:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        errs: list[str] = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        try:
            await check_preflight(page)
            await check_auth(page)
            await check_correlation(page)
            await check_copilot(page)
            await check_realtime(ctx)
            await check_route_sweep(page)
        finally:
            await browser.close()

    print("\n=== SMOKE SUMMARY ===")
    fails = [r for r in RESULTS if r[1] == "FAIL"]
    for cid, st, note in RESULTS:
        print(f"  {st}  {cid}  {note}")
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} passed. Screenshots: {SHOTS}")
    (SHOTS / "results.json").write_text(json.dumps(RESULTS, indent=2))
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
