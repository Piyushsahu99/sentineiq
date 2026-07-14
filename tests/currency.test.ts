// Regression tests for the currency formatting helpers used across the
// dashboard, transactions, reports, and quantum pages. These lock the
// symbol and formatting for each supported region so a stray hardcoded
// "$" or "₹" in a page trips CI.
import { describe, it, expect } from "vitest";

// Stub the supabase client before importing currency.ts (which touches it at
// module scope for the auth listener).
import { vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  },
}));

const { REGIONS, formatMoney, formatCompact, DEFAULT_PREFS } = await import("../src/lib/currency");

// Symbol each region MUST render for a positive integer amount.
const SYMBOLS: Record<string, string[]> = {
  IN: ["₹"], US: ["$"], EU: ["€"], GB: ["£"], AE: ["AED"], SG: ["$"], JP: ["¥", "￥"],
};

describe("formatMoney symbol per region", () => {
  for (const [code, region] of Object.entries(REGIONS)) {
    it(`${code} → ${region.currency} uses one of ${SYMBOLS[code].join("/")}`, () => {
      const out = formatMoney(1234, { region: code as any, currency: region.currency, locale: region.locale, bank: region.banks[0] });
      expect(SYMBOLS[code].some((s) => out.includes(s))).toBe(true);
    });
  }
});

describe("formatCompact matches formatMoney currency", () => {
  for (const [code, region] of Object.entries(REGIONS)) {
    it(`${code} compact output carries the currency symbol`, () => {
      const out = formatCompact(2_500_000, { region: code as any, currency: region.currency, locale: region.locale, bank: region.banks[0] });
      expect(SYMBOLS[code].some((s) => out.includes(s))).toBe(true);
      expect(out.length).toBeLessThan(20);
    });
  }
});

describe("defaults", () => {
  it("defaults to INR / en-IN", () => {
    expect(DEFAULT_PREFS.currency).toBe("INR");
    expect(formatMoney(1000)).toContain("₹");
  });

  it("gracefully handles null / undefined / NaN", () => {
    expect(formatMoney(null)).toMatch(/[₹$€£¥]|AED|—/);
    expect(formatMoney(undefined)).toMatch(/[₹$€£¥]|AED|—/);
    expect(formatMoney("not-a-number")).toBe("—");
  });
});

describe("no page bypasses the helper", () => {
  // Guard against regressions where a page hardcodes "$1.2M" or "₹500" strings.
  // We scan the four pages the user called out and fail if a currency symbol
  // is present outside a formatMoney / formatCompact / prefs.currency call.
  it("dashboard / transactions / reports / quantum only render currency via helpers", async () => {
    const fs = await import("node:fs/promises");
    const files = [
      "src/routes/_app.dashboard.tsx",
      "src/routes/_app.transactions.tsx",
      "src/routes/_app.reports.tsx",
      "src/routes/_app.quantum.tsx",
    ];
    const offenders: string[] = [];
    for (const f of files) {
      const src = await fs.readFile(f, "utf8");
      src.split("\n").forEach((line, i) => {
        // Strip block-comment-y bits; look at raw JSX text.
        const stripped = line.replace(/\/\/.*$/, "");
        // Match hardcoded currency literals like $1, ₹500, €10, £3, ¥100 in JSX/strings.
        if (/[₹€£¥]\s*\d/.test(stripped) || /\$\s*\{?\s*\d/.test(stripped) || /\$\d/.test(stripped)) {
          offenders.push(`${f}:${i + 1}  ${stripped.trim()}`);
        }
      });
    }
    expect(offenders, `Hardcoded currency literals found:\n${offenders.join("\n")}`).toEqual([]);
  });
});
