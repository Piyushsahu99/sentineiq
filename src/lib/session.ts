// Mock session — role stored in localStorage. No real auth.
export type Role = "SOC Analyst" | "Fraud Analyst" | "Risk Manager" | "Executive";

const K_AUTH = "sq_auth";
const K_ROLE = "sq_role";
const K_MFA = "sq_mfa";
const K_USER = "sq_user";

export const session = {
  isAuthed(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(K_AUTH) === "1" && localStorage.getItem(K_MFA) === "1" && !!localStorage.getItem(K_ROLE);
  },
  hasPasswordStep(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(K_AUTH) === "1";
  },
  hasMfa(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(K_MFA) === "1";
  },
  setPassword(email: string) {
    localStorage.setItem(K_AUTH, "1");
    localStorage.setItem(K_USER, email);
  },
  setMfa() { localStorage.setItem(K_MFA, "1"); },
  setRole(r: Role) { localStorage.setItem(K_ROLE, r); },
  getRole(): Role | null {
    if (typeof window === "undefined") return null;
    return (localStorage.getItem(K_ROLE) as Role) ?? null;
  },
  getEmail(): string { return (typeof window !== "undefined" && localStorage.getItem(K_USER)) || "analyst@sentinelq.io"; },
  signOut() {
    localStorage.removeItem(K_AUTH);
    localStorage.removeItem(K_MFA);
    localStorage.removeItem(K_ROLE);
    localStorage.removeItem(K_USER);
  },
};
