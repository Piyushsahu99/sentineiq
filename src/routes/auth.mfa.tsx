import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/sq/glass-card";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/mfa")({
  ssr: false,
  component: MfaPage,
});

function MfaPage() {
  const nav = useNavigate();
  const [digits, setDigits] = useState<string[]>(["","","","","",""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const complete = digits.every((d) => /^[0-9]$/.test(d));
  const groupId = useId();
  const errId = `${groupId}-err`;

  // Bootstrap: require a signed-in user, an enrolled verified TOTP factor,
  // and issue a server-side challenge. Without all three we cannot verify a
  // real second factor, so bounce back to sign-in instead of pretending.
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { nav({ to: "/auth/login", replace: true }); return; }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.currentLevel === aal.nextLevel) {
        // MFA not required for this session — skip the step entirely.
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).limit(1).maybeSingle();
        nav({ to: r?.role ? "/dashboard" : "/auth/role-select", replace: true });
        return;
      }
      const { data: fs, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) { setBootError(fErr.message); return; }
      const totp = fs?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        setBootError("No verified authenticator is enrolled on this account. Enroll a TOTP factor before signing in.");
        return;
      }
      setFactorId(totp.id);
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (cErr) { setBootError(cErr.message); return; }
      setChallengeId(ch.id);
    })();
  }, [nav]);

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (!clean && v !== "") { setError("Only digits 0–9 are allowed"); return; }
    if (error) setError(null);
    const next = [...digits];
    next[i] = clean.slice(-1);
    setDigits(next);
    if (clean && i < 5) refs.current[i+1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ["","","","","",""];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    setError(null);
    refs.current[Math.min(text.length, 5)]?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) {
      setError("Enter all 6 digits of your verification code");
      refs.current[digits.findIndex((d) => !d)]?.focus();
      return;
    }
    if (!factorId || !challengeId) {
      setError("MFA challenge not ready. Refresh and try again.");
      return;
    }
    setSubmitting(true);
    try {
      const code = digits.join("");
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
      if (vErr) {
        setError(vErr.message || "Invalid verification code.");
        // Rotate the challenge so a fresh code is required on retry.
        const { data: ch } = await supabase.auth.mfa.challenge({ factorId });
        if (ch) setChallengeId(ch.id);
        setSubmitting(false);
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      const { data: r } = u.user
        ? await supabase.from("user_roles").select("role").eq("user_id", u.user.id).limit(1).maybeSingle()
        : { data: null };
      nav({ to: r?.role ? "/dashboard" : "/auth/role-select" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <GlassCard className="p-6 sm:p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl grid place-items-center bg-gradient-to-br from-cyan-400/20 to-violet-500/20 hairline">
          <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold">Multi-factor verification</h1>
        <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
          Enter the 6-digit code from your authenticator app.
        </p>

        {bootError && (
          <p className="mt-4 flex items-center justify-center gap-1 text-[11px] text-red-300">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {bootError}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <fieldset
            aria-labelledby={groupId}
            aria-describedby={error ? errId : undefined}
            aria-invalid={!!error}
            disabled={!challengeId}
            className="border-0 p-0 m-0 disabled:opacity-50"
          >
            <legend id={groupId} className="sr-only">6-digit verification code</legend>
            <div className="flex justify-center gap-1.5 sm:gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  value={d}
                  aria-label={`Digit ${i + 1} of 6`}
                  aria-invalid={!!error}
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onPaste={onPaste}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i-1]?.focus(); }}
                  className={`h-12 w-9 sm:w-10 text-center text-lg font-mono bg-white/5 hairline rounded-lg outline-none focus:border-cyan-400/50 focus:bg-white/8 ${error ? "border-red-400/60" : ""}`}
                  maxLength={1}
                  inputMode="numeric"
                  pattern="[0-9]"
                />
              ))}
            </div>
          </fieldset>

          {error && (
            <p id={errId} role="alert" aria-live="assertive" className="flex items-center justify-center gap-1 text-[11px] text-red-300">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!complete || submitting || !challengeId}
            aria-busy={submitting}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold py-2.5 text-sm hover:brightness-110 disabled:opacity-50 transition"
          >
            {submitting ? "Verifying…" : "Verify & continue"}
          </button>
        </form>
      </GlassCard>
    </motion.div>
  );
}
