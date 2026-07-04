import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { session } from "@/lib/session";
import { GlassCard } from "@/components/sq/glass-card";
import { KeyRound, Mail, ShieldCheck, Fingerprint, Building2 } from "lucide-react";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("j.watson@bank.com");
  const [pw, setPw] = useState("••••••••••••");
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      session.setPassword(email);
      nav({ to: "/auth/mfa" });
    }, 700);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <GlassCard className="p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Sign in to <span className="text-gradient-cyber">SentinelQ</span></h1>
          <p className="text-xs text-muted-foreground mt-2">Enterprise banking cyber &amp; fraud correlation platform</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { name: "Okta", icon: ShieldCheck },
            { name: "Azure AD", icon: Building2 },
            { name: "Ping", icon: Fingerprint },
          ].map((sso) => (
            <button
              key={sso.name}
              onClick={() => { session.setPassword("sso@" + sso.name.toLowerCase().replace(" ","") + ".com"); nav({ to: "/auth/mfa" }); }}
              className="flex items-center justify-center gap-1.5 rounded-lg hairline bg-white/3 hover:bg-white/6 px-2 py-2 text-xs font-medium transition"
            >
              <sso.icon className="h-3.5 w-3.5 text-cyan-300" />
              {sso.name}
            </button>
          ))}
        </div>

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
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400/40" />
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</span>
            <div className="mt-1 relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400/40" />
            </div>
          </label>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-muted-foreground">
              <input type="checkbox" className="rounded" defaultChecked /> Trust this device (7d)
            </label>
            <Link to="/auth/forgot-password" className="text-cyan-300 hover:underline">Forgot password?</Link>
          </div>

          <button disabled={loading} className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold py-2.5 text-sm hover:brightness-110 disabled:opacity-60 transition">
            {loading ? "Authenticating…" : "Continue"}
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
