import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GlassCard } from "@/components/sq/glass-card";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPage,
});

function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  return (
    <div className="w-full max-w-md">
      <GlassCard className="p-8">
        <Link to="/auth/login" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to sign in
        </Link>
        {!sent ? (
          <>
            <h1 className="mt-4 text-xl font-bold">Reset your password</h1>
            <p className="text-xs text-muted-foreground mt-2">We'll email a secure reset link to your corporate address.</p>
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="mt-5 space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@bank.com" className="w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400/40" />
              </div>
              <button className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold py-2.5 text-sm hover:brightness-110">Send reset link</button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl grid place-items-center bg-emerald-500/15">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold">Check your inbox</h1>
            <p className="text-xs text-muted-foreground mt-2">
              If <b className="text-foreground">{email}</b> is a valid corporate account, a signed reset link is on its way.
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
