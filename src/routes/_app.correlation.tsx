import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBadge, RiskBar, SeverityDot } from "@/components/sq/risk";
import { ProgressRing } from "@/components/sq/progress-ring";
import { correlationEvents, correlationSummary, type CorrelationEvent } from "@/lib/mock/data";
import { LogIn, Smartphone, Wifi, Bug, KeyRound, UserPlus, Banknote, Globe2, Zap, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/correlation")({
  component: CorrelationPage,
});

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  e1: LogIn, e2: Smartphone, e3: Wifi, e4: Bug, e5: KeyRound, e6: UserPlus, e7: Banknote, e8: Globe2, e9: Zap,
};

function CorrelationPage() {
  const [sel, setSel] = useState<CorrelationEvent>(correlationEvents[6]);

  return (
    <div>
      <PageHeader
        title="Correlation Engine"
        subtitle="One kill-chain, twelve data planes, one AI decision. Every event contributes evidence and risk."
        badge={<span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20 hairline">Flagship</span>}
        actions={
          <>
            <button className="text-xs px-3 py-1.5 rounded-lg hairline hover:bg-white/6">Case: SOC-90218</button>
            <Link to="/investigations" className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:brightness-110 inline-flex items-center gap-1">
              Open AI Investigation <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <GlassCard className="flex items-center gap-4 col-span-2 md:col-span-1">
          <ProgressRing value={correlationSummary.score} size={92} stroke={9} label="Score" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall Correlation</div>
            <div className="text-sm font-semibold">Critical</div>
            <div className="text-[10px] text-muted-foreground mt-1">AI ensemble v2.4.1</div>
          </div>
        </GlassCard>
        <SummaryCell label="Attack Type" value={correlationSummary.attackType} valueClass="text-sm" />
        <SummaryCell label="Confidence" value={`${correlationSummary.confidence}%`} bar={correlationSummary.confidence} />
        <SummaryCell label="Business Impact" value={`$${(correlationSummary.businessImpactUsd/1000).toFixed(0)}K`} valueClass="text-lg font-mono" />
        <SummaryCell label="Fraud Probability" value={`${correlationSummary.fraudProbability}%`} bar={correlationSummary.fraudProbability} color="var(--risk-critical)" />
        <SummaryCell label="Cyber Threat" value={`${correlationSummary.cyberThreatProbability}%`} bar={correlationSummary.cyberThreatProbability} color="var(--cyber-violet)" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Timeline */}
        <GlassCard className="col-span-12 lg:col-span-8">
          <SectionHeader
            title="Attack Timeline"
            description="Click any event to inspect its evidence and risk contribution"
            action={<span className="text-[10px] text-muted-foreground">11 minutes end-to-end</span>}
          />
          <ol className="relative">
            {/* connecting line */}
            <span className="absolute left-6 top-2 bottom-2 w-px bg-gradient-to-b from-cyan-400/40 via-violet-500/40 to-rose-500/40" />
            {correlationEvents.map((e, i) => {
              const Icon = iconMap[e.id] ?? Zap;
              const active = sel.id === e.id;
              return (
                <li key={e.id}>
                  <motion.button
                    onClick={() => setSel(e)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`relative w-full text-left flex items-start gap-4 rounded-xl p-3 pl-2 transition ${active ? "bg-white/6" : "hover:bg-white/3"}`}
                  >
                    <div className={`relative z-10 h-12 w-12 shrink-0 rounded-xl grid place-items-center hairline ${active ? "bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border-cyan-400/40" : "bg-background"}`}>
                      <Icon className="h-5 w-5 text-cyan-200" />
                      {active && <span className="absolute -inset-0.5 rounded-xl blur-md bg-gradient-to-br from-cyan-400/30 to-violet-500/30 -z-10" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{e.title}</span>
                        <RiskBadge severity={e.severity} />
                        <span className="text-[10px] text-muted-foreground">{e.source}</span>
                        <span className="ml-auto text-[10px] font-mono text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.details}</div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="uppercase tracking-wider">Risk contribution</span>
                        <RiskBar value={Math.min(100, e.riskContribution * 4)} className="max-w-[160px]" />
                        <span className="font-mono">+{e.riskContribution}</span>
                        <span className="ml-3 uppercase tracking-wider">Confidence</span>
                        <span className="font-mono">{e.confidence}%</span>
                      </div>
                    </div>
                  </motion.button>
                </li>
              );
            })}
          </ol>
        </GlassCard>

        {/* Detail rail */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <GlassCard>
            <SectionHeader title="Event Detail" action={<SeverityDot severity={sel.severity} pulse />} />
            <div className="text-sm font-semibold">{sel.title}</div>
            <div className="text-[11px] text-muted-foreground">{sel.source} · {new Date(sel.ts).toLocaleString()}</div>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{sel.details}</p>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Evidence</div>
              <div className="rounded-lg hairline bg-black/30 font-mono text-[11px] p-3 space-y-1">
                {Object.entries(sel.data).map(([k,v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-cyan-300">{k}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="truncate">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Risk Contribution</div>
                <div className="text-lg font-mono">+{sel.riskContribution}</div>
                <RiskBar value={Math.min(100, sel.riskContribution * 4)} />
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Confidence</div>
                <div className="text-lg font-mono">{sel.confidence}%</div>
                <RiskBar value={sel.confidence} />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border-cyan-400/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <div className="text-sm font-semibold">Final AI Decision</div>
              <RiskBadge severity="critical" label="BLOCK" className="ml-auto" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Correlated fraud + cyber attack. Payment held, session revoked, customer notified.
            </p>
            <div className="mt-3 space-y-1.5">
              {["Auto-hold SWIFT MT103 (€482,000)","Revoke all sessions for C-88214","Quarantine Win11-Fresh endpoint","Escalate to L2 SOC (SLA 15m)","File SAR referencing FIN7-Wire-24Q4"].map((a) => (
                <div key={a} className="flex items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_var(--cyber-cyan)]" />
                  {a}
                </div>
              ))}
            </div>
            <Link to="/investigations" className="mt-4 w-full inline-flex justify-center items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold py-2 text-xs hover:brightness-110">
              Open AI Investigation <ArrowRight className="h-3 w-3" />
            </Link>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, valueClass = "text-base font-semibold", bar, color = "var(--cyber-cyan)" }: { label: string; value: string; valueClass?: string; bar?: number; color?: string }) {
  return (
    <GlassCard>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 ${valueClass} leading-tight`}>{value}</div>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${bar}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
        </div>
      )}
    </GlassCard>
  );
}
