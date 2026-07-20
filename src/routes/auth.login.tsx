import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/sq/glass-card";
import { KeyRound, Mail, Fingerprint, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Corporate email is required" })
  .email({ message: "Enter a valid email address" })
  .max(255, { message: "Email must be under 255 characters" });

const pwSchema = z
  .string()
  .min(6, { message: "Password must be at least 6 characters" })
  .max(128, { message: "Password must be under 128 characters" });

type FieldErrors = { email?: string; password?: string; form?: string };

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const emailId = useId();
  const pwId = useId();
  const emailErrId = `${emailId}-err`;
  const pwErrId = `${pwId}-err`;
  const formErrId = `${emailId}-form-err`;

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const e = emailSchema.safeParse(email);
    if (!e.success) next.email = e.error.issues[0]?.message;
    const p = pwSchema.safeParse(pw);
    if (!p.success) next.password = p.error.issues[0]?.message;
    return next;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (next.email || next.password) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password: pw,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You are signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      }
      // Only route through MFA when Supabase reports an MFA factor is required.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        nav({ to: "/auth/mfa" });
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data: r } = u.user
          ? await supabase.from("user_roles").select("role").eq("user_id", u.user.id).limit(1).maybeSingle()
          : { data: null };
        nav({ to: r?.role ? "/dashboard" : "/auth/role-select" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setErrors({ form: msg });
      toast.error(msg);
    } finally { setLoading(false); }
  }

  async function google() {
    setSsoLoading(true);
    setErrors((prev) => ({ ...prev, form: undefined }));
    try {
      const { lovable } = await import("@/integrations/lovable/index");
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        const msg = "Google sign-in failed. Please try again or use corporate credentials.";
        setErrors({ form: msg });
        toast.error(msg);
        return;
      }
      if (result.redirected) return;
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        nav({ to: "/auth/mfa" });
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data: r } = u.user
          ? await supabase.from("user_roles").select("role").eq("user_id", u.user.id).limit(1).maybeSingle()
          : { data: null };
        nav({ to: r?.role ? "/dashboard" : "/auth/role-select" });
      }
    } catch {
      const msg = "Google sign-in is temporarily unavailable.";
      setErrors({ form: msg });
      toast.error(msg);
    } finally {
      setSsoLoading(false);
    }
  }

  const inputBase =
    "w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400/40 transition";
  const inputError = "border-red-400/60 focus:border-red-400/80";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <GlassCard className="p-6 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Sign in to" : "Create your"} <span className="text-gradient-cyber">SentinelQ</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-2">Enterprise banking cyber &amp; fraud correlation platform</p>
        </div>

        <button
          type="button"
          onClick={google}
          disabled={ssoLoading || loading}
          aria-busy={ssoLoading}
          className="w-full flex items-center justify-center gap-2 rounded-lg hairline bg-white/3 hover:bg-white/6 disabled:opacity-60 px-3 py-2.5 text-sm font-medium transition mb-6"
        >
          <Fingerprint className="h-4 w-4 text-cyan-300" />
          {ssoLoading ? "Connecting to Google…" : "Continue with Google"}
        </button>

        <div className="relative mb-6">
          <div className="h-px bg-white/6" />
          <span className="absolute inset-0 -top-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="bg-background/40 px-2 backdrop-blur-sm">or with corporate credentials</span>
          </span>
        </div>

        {errors.form && (
          <div
            role="alert"
            aria-live="assertive"
            id={formErrId}
            className="mb-4 flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{errors.form}</span>
          </div>
        )}

        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label htmlFor={emailId} className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Corporate email</span>
            </label>
            <div className="mt-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                id={emailId}
                required
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                onBlur={() => {
                  const r = emailSchema.safeParse(email);
                  setErrors((p) => ({ ...p, email: r.success ? undefined : r.error.issues[0]?.message }));
                }}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? emailErrId : undefined}
                placeholder="analyst@bank.com"
                className={`${inputBase} ${errors.email ? inputError : ""}`}
              />
            </div>
            {errors.email && (
              <p id={emailErrId} role="alert" className="mt-1.5 flex items-center gap-1 text-[11px] text-red-300">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={pwId} className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</span>
            </label>
            <div className="mt-1 relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                id={pwId}
                required
                minLength={6}
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={pw}
                onChange={(e) => { setPw(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                onBlur={() => {
                  const r = pwSchema.safeParse(pw);
                  setErrors((p) => ({ ...p, password: r.success ? undefined : r.error.issues[0]?.message }));
                }}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? pwErrId : undefined}
                placeholder="••••••••"
                className={`${inputBase} ${errors.password ? inputError : ""}`}
              />
            </div>
            {errors.password && (
              <p id={pwErrId} role="alert" className="mt-1.5 flex items-center gap-1 text-[11px] text-red-300">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErrors({}); }} className="text-cyan-300 hover:underline">
              {mode === "signin" ? "Create account" : "Have an account? Sign in"}
            </button>
            <Link to="/auth/forgot-password" className="text-cyan-300 hover:underline">Forgot password?</Link>
          </div>

          <button
            type="submit"
            disabled={loading || ssoLoading}
            aria-busy={loading}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold py-2.5 text-sm hover:brightness-110 disabled:opacity-60 transition"
          >
            {loading ? "Authenticating…" : mode === "signin" ? "Continue" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-[10px] text-muted-foreground/70 text-center">
          Access is logged and correlated. Unauthorized use is prosecuted under the Computer Fraud and Abuse Act.
        </p>
      </GlassCard>

      <div className="mt-4 text-center text-[10px] text-muted-foreground/70">
        Protected by SentinelQ Zero-Trust · Session integrity: <span className="text-emerald-400">verified</span>
      </div>
    </motion.div>
  );
}
