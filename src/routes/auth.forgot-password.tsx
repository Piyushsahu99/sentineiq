import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import { GlassCard } from "@/components/sq/glass-card";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPage,
});

const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Corporate email is required" })
  .email({ message: "Enter a valid email address" })
  .max(255, { message: "Email must be under 255 characters" });

function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const errId = `${id}-err`;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = emailSchema.safeParse(email);
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }
    setError(null);
    setSent(true);
  }

  return (
    <div className="w-full max-w-md">
      <GlassCard className="p-6 sm:p-8">
        <Link to="/auth/login" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Back to sign in
        </Link>
        {!sent ? (
          <>
            <h1 className="mt-4 text-xl font-bold">Reset your password</h1>
            <p className="text-xs text-muted-foreground mt-2">We'll email a secure reset link to your corporate address.</p>
            <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
              <div>
                <label htmlFor={id} className="sr-only">Corporate email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    id={id}
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                    onBlur={() => {
                      const r = emailSchema.safeParse(email);
                      setError(r.success ? null : r.error.issues[0]?.message ?? null);
                    }}
                    aria-invalid={!!error}
                    aria-describedby={error ? errId : undefined}
                    placeholder="you@bank.com"
                    className={`w-full bg-white/5 hairline rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400/40 ${error ? "border-red-400/60" : ""}`}
                  />
                </div>
                {error && (
                  <p id={errId} role="alert" className="mt-1.5 flex items-center gap-1 text-[11px] text-red-300">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    {error}
                  </p>
                )}
              </div>
              <button className="w-full rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold py-2.5 text-sm hover:brightness-110">Send reset link</button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl grid place-items-center bg-emerald-500/15">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" aria-hidden="true" />
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
