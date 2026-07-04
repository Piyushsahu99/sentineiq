import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { ProgressRing } from "@/components/sq/progress-ring";
import { shapFactors } from "@/lib/mock/data";
import { ArrowUpRight, ArrowDownRight, Brain } from "lucide-react";

export const Route = createFileRoute("/_app/explainable-ai")({
  component: XAIPage,
});

function XAIPage() {
  return (
    <div>
      <PageHeader
        title="Explainable AI"
        subtitle="Every SentinelQ decision is auditable, cited, and human-readable. Regulators and analysts can trace the exact reasoning."
        actions={<select className="text-xs bg-white/5 hairline rounded-lg px-3 py-1.5"><option>Decision: TX-880120 · BLOCK</option><option>Decision: INV-2447 · Correlate</option></select>}
      />

      <div className="grid grid-cols-12 gap-6 mb-6">
        <GlassCard className="col-span-12 md:col-span-4 flex items-center gap-6 justify-center">
          <ProgressRing value={94} label="Risk" size={130} color="var(--risk-critical)" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Model Confidence</div>
            <div className="text-2xl font-mono">97%</div>
            <div className="text-[11px] text-muted-foreground mt-1">ensemble v2.4.1 · 12 features · SHAP-explained</div>
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-8">
          <div className="flex items-center gap-2 mb-2"><Brain className="h-4 w-4 text-violet-300" /><span className="text-sm font-semibold">Natural-language explanation</span></div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            SentinelQ scored this SWIFT MT103 as <b className="text-foreground">Critical (94/100)</b> because the beneficiary IBAN is on the
            Europol EMPACT mule-account feed (largest single contributor), the amount is <b className="text-foreground">33.87× the customer's 90-day median</b>,
            the session originated from a <b className="text-foreground">new unenrolled device anchored to a commercial VPN</b> within 5 minutes of login,
            and the endpoint was compromised by the <b className="text-foreground">RedLine info-stealer</b>. Positive signals (verified MFA, long-tenured account)
            were insufficient to offset the negative signals. Recommended action: <b className="text-foreground">BLOCK + revoke session</b>.
          </p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 lg:col-span-6">
          <SectionHeader title="Feature Importance" description="SHAP values · direction indicates fraud contribution" />
          <div className="space-y-2">
            {shapFactors.map((f) => {
              const pct = Math.min(100, Math.abs(f.value) * 250);
              const color = f.positive ? "var(--risk-low)" : "var(--risk-critical)";
              return (
                <div key={f.name} className="rounded-lg hairline bg-white/3 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>{f.name}</span>
                    <span className={`font-mono inline-flex items-center gap-1 ${f.positive ? "text-emerald-300" : "text-rose-300"}`}>
                      {f.positive ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                      {f.value > 0 ? "+" : ""}{f.value.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <div className="col-span-12 lg:col-span-6 grid grid-cols-1 gap-6">
          <GlassCard>
            <SectionHeader title="Negative Factors" description="Pushed decision toward BLOCK" />
            <ul className="space-y-2 text-sm">
              {shapFactors.filter((f) => !f.positive).map((f) => (
                <li key={f.name} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {f.name}</li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard>
            <SectionHeader title="Positive Factors" description="Pushed decision toward APPROVE" />
            <ul className="space-y-2 text-sm">
              {shapFactors.filter((f) => f.positive).map((f) => (
                <li key={f.name} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {f.name}</li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard>
            <SectionHeader title="Recommended Actions" />
            <div className="space-y-1.5 text-sm">
              {["Auto-block payment (executed)","Force MFA re-enrolment","Notify customer via secure channel","Add IBAN to internal deny-list","Update model feature: reset→beneficiary velocity"].map((a) => (
                <div key={a} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_var(--cyber-cyan)]" />{a}</div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
