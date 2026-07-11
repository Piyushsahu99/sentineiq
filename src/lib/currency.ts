// Currency + region presets and a tiny React hook that reads the current
// tenant preferences from the profiles row. Falls back to India / INR so
// nothing crashes before the profile is loaded.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RegionCode = "IN" | "US" | "EU" | "GB" | "AE" | "SG" | "JP";

export const REGIONS: Record<RegionCode, { label: string; currency: string; locale: string; banks: string[] }> = {
  IN: { label: "India", currency: "INR", locale: "en-IN", banks: ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra", "Yes Bank", "IDFC First"] },
  US: { label: "United States", currency: "USD", locale: "en-US", banks: ["JPMorgan Chase", "Bank of America", "Wells Fargo", "Citi", "US Bank"] },
  EU: { label: "European Union", currency: "EUR", locale: "en-IE", banks: ["Deutsche Bank", "BNP Paribas", "ING", "UniCredit", "Santander"] },
  GB: { label: "United Kingdom", currency: "GBP", locale: "en-GB", banks: ["Barclays", "HSBC UK", "Lloyds", "NatWest", "Santander UK"] },
  AE: { label: "United Arab Emirates", currency: "AED", locale: "en-AE", banks: ["Emirates NBD", "FAB", "ADCB", "Mashreq"] },
  SG: { label: "Singapore", currency: "SGD", locale: "en-SG", banks: ["DBS", "OCBC", "UOB", "Standard Chartered SG"] },
  JP: { label: "Japan", currency: "JPY", locale: "ja-JP", banks: ["MUFG", "SMBC", "Mizuho", "Resona"] },
};

export type TenantPrefs = { region: RegionCode; currency: string; bank: string; locale: string };

export const DEFAULT_PREFS: TenantPrefs = {
  region: "IN",
  currency: "INR",
  bank: "HDFC Bank",
  locale: "en-IN",
};

let cache: TenantPrefs = DEFAULT_PREFS;
const listeners = new Set<() => void>();

export async function refreshPrefs(): Promise<TenantPrefs> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return cache;
  const { data } = await supabase.from("profiles")
    .select("region, currency, bank")
    .eq("id", u.user.id)
    .maybeSingle();
  if (data) {
    const region = (data.region as RegionCode) in REGIONS ? (data.region as RegionCode) : "IN";
    cache = {
      region,
      currency: data.currency || REGIONS[region].currency,
      bank: data.bank || REGIONS[region].banks[0],
      locale: REGIONS[region].locale,
    };
    listeners.forEach((l) => l());
  }
  return cache;
}

if (typeof window !== "undefined") {
  refreshPrefs();
  supabase.auth.onAuthStateChange(() => { refreshPrefs(); });
}

export function usePrefs(): TenantPrefs {
  const [p, setP] = useState<TenantPrefs>(cache);
  useEffect(() => {
    const fn = () => setP({ ...cache });
    listeners.add(fn);
    refreshPrefs();
    return () => { listeners.delete(fn); };
  }, []);
  return p;
}

export function formatMoney(amount: number | string | null | undefined, prefs?: Partial<TenantPrefs>): string {
  const p = { ...cache, ...prefs };
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(p.locale, { style: "currency", currency: p.currency, maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
  } catch {
    return `${p.currency} ${n.toLocaleString()}`;
  }
}

export function formatCompact(amount: number | null | undefined, prefs?: Partial<TenantPrefs>): string {
  const p = { ...cache, ...prefs };
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(p.locale, { style: "currency", currency: p.currency, notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return `${p.currency} ${n.toLocaleString()}`;
  }
}

// Server-side helper mirror: fetches the acting user's prefs using an
// authenticated Supabase client (from requireSupabaseAuth context).
export async function loadPrefsServer(supabaseAuthed: { from: (t: string) => any }, userId: string): Promise<TenantPrefs> {
  const { data } = await supabaseAuthed.from("profiles").select("region, currency, bank").eq("id", userId).maybeSingle();
  if (!data) return DEFAULT_PREFS;
  const region = (data.region as RegionCode) in REGIONS ? (data.region as RegionCode) : "IN";
  return {
    region,
    currency: data.currency || REGIONS[region].currency,
    bank: data.bank || REGIONS[region].banks[0],
    locale: REGIONS[region].locale,
  };
}
