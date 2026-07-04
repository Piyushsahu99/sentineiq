// Real Supabase-backed session helpers.
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

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function getCurrentRole(): Promise<Role | null> {
  const u = await getUser();
  if (!u) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id).limit(1).maybeSingle();
  if (!data?.role) return null;
  return ENUM_TO_ROLE[data.role as RoleEnum] ?? null;
}

export async function setRoleForCurrentUser(role: Role) {
  const u = await getUser();
  if (!u) throw new Error("Not signed in");
  // clear existing, insert new
  await supabase.from("user_roles").delete().eq("user_id", u.id);
  const { error } = await supabase.from("user_roles").insert({ user_id: u.id, role: ROLE_TO_ENUM[role] });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
