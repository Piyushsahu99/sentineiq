import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/sq/glass-card";
import { session } from "@/lib/session";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth/mfa")({
  component: MfaPage,
});

function MfaPage() {
  const nav = useNavigate();
  const [digits, setDigits] = useState<string[]>(["","","","","",""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const complete = digits.every((d) => d);

  function setDigit(i: number, v: string) {
    const next = [...digits];
    next[i] = v.slice(-1);
    setDigits(next);
    if (v && i < 5) refs.current[i+1]?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    session.setMfa();
    nav({ to: "/auth/role-select" });
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <GlassCard className="p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl grid place-items-center bg-gradient-to-br from-cyan-400/20 to-violet-500/20 hairline">
          <ShieldCheck className="h-6 w-6 text-cyan-300" />
        </div>
        <h1 className="text-xl font-bold">Multi-factor verification</h1>
        <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
          Enter the 6-digit code from your authenticator app. Push approval also sent to your enrolled device.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="flex justify-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i-1]?.focus(); }}
                className="h-12 w-10 text-center text-lg font-mono bg-white/5 hairline rounded-lg outline-none focus:border-cyan-400/50 focus:bg-white/8"
                maxLength={1}
                inputMode="numeric"
              />
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Push sent to <b className="text-foreground">iPhone 15 · Watson</b> · resend in <span className="tabular-nums">28s</span>
          </div>
          <button disabled={!complete} className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold py-2.5 text-sm hover:brightness-110 disabled:opacity-50 transition">
            Verify
          </button>
          <button type="button" onClick={() => { setDigits(["1","2","3","4","5","6"]); }} className="text-xs text-cyan-300 hover:underline">
            Use demo code
          </button>
        </form>
      </GlassCard>
    </motion.div>
  );
}
