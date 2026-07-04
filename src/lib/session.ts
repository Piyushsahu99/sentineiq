// Real Supabase-backed session helpers with a small in-memory cache
// so sync components (sidebar/topbar) can read email + role instantly.
import { supabase } from "@/integrations/supabase/client";

export type Role = "SOC Analyst" | "Fraud Analyst" | "Risk Manager" | "Executive";
export type RoleEnum = "soc_analyst" | "fraud_analyst" | "risk_manager" | "executive";

export const ROLE_TO_ENUM: Record<Role, RoleEnum> = {
  "SOC Analyst": "soc_analyst",
  "Fraud Analyst": "fraud_analyst",
  "Risk Manager": "risk_manager",
  "Executive": "executive",
};
export const ENUM_TO_ROLE: Record<RoleEnum, Role> = {
  soc_analyst: "SOC Analyst",
  fraud_analyst: "Fraud Analyst",
  risk_manager: "Risk Manager",
  executive: "Executive",
};

let cachedEmail: string | null = null;
let cachedRole: Role | null = null;
const listeners = new Set<() => void>();

async function refreshCache() {
  const { data } = await supabase.auth.getUser();
  cachedEmail = data.user?.email ?? null;
  if (data.user) {
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).limit(1).maybeSingle();
    cachedRole = r?.role ? (ENUM_TO_ROLE[r.role as RoleEnum] ?? null) : null;
  } else {
    cachedRole = null;
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  refreshCache();
  supabase.auth.onAuthStateChange(() => { refreshCache(); });
}

export const session = {
  getEmail(): string { return cachedEmail ?? "analyst@sentinelq.io"; },
  getRole(): Role | null { return cachedRole; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  refresh: refreshCache,
  async signOut() { await supabase.auth.signOut(); cachedEmail = null; cachedRole = null; listeners.forEach((l) => l()); },
};

export async function getCurrentRole(): Promise<Role | null> {
  await refreshCache();
  return cachedRole;
}

export async function setRoleForCurrentUser(role: Role) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  await supabase.from("user_roles").delete().eq("user_id", data.user.id);
  const { error } = await supabase.from("user_roles").insert({ user_id: data.user.id, role: ROLE_TO_ENUM[role] });
  if (error) throw error;
  await refreshCache();
}
