import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/sq/glass-card";
import { KeyRound, Mail, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      nav({ to: "/auth/mfa" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally { setLoading(false); }
  }

  async function google() {
    try {
      const { lovable } = await import("@/integrations/lovable/index");
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) { toast.error("Google sign-in failed"); return; }
      if (result.redirected) return;
      nav({ to: "/auth/mfa" });
    } catch {
      toast.error("Google sign-in unavailable");
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <GlassCard className="p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Sign in to" : "Create your"} <span className="text-gradient-cyber">SentinelQ</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-2">Enterprise banking cyber &amp; fraud correlation platform</p>
        </div>

        <button onClick={google} className="w-full flex items-center justify-center gap-2 rounded-lg hairline bg-white/3 hover:bg-white/6 px-3 py-2.5 text-sm font-medium transition mb-6">
          <Fingerprint className="h-4 w-4 text-cyan-300" />
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="h-px bg-white/6" />
          <span className="absolute inset-0 -top-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="bg-background/40 px-2 backdrop-blur-sm">or with corporate credentials</span>
          </span>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Corporate email</span>
            <div className="mt-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="analyst@bank.com" className="w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400/40" />
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</span>
            <div className="mt-1 relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input required minLength={6} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" className="w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400/40" />
            </div>
          </label>

          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-cyan-300 hover:underline">
              {mode === "signin" ? "Create account" : "Have an account? Sign in"}
            </button>
            <Link to="/auth/forgot-password" className="text-cyan-300 hover:underline">Forgot password?</Link>
          </div>

          <button disabled={loading} className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold py-2.5 text-sm hover:brightness-110 disabled:opacity-60 transition">
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
