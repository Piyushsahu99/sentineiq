import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { RiskBadge, SeverityDot } from "@/components/sq/risk";
import { ProgressRing } from "@/components/sq/progress-ring";
import { motion } from "framer-motion";
import { useLatestInvestigation } from "@/lib/live-queries";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_app/correlation")({
  ssr: false,
  component: CorrelationPage,
});

type EvidenceItem = { ts?: string; source?: string; event?: string; weight?: number };

function CorrelationPage() {
  const { data: inv, isLoading } = useLatestInvestigation();
  const [selIdx, setSelIdx] = useState(0);

  const { data: contribs } = useQuery({
    queryKey: ["contributors", inv?.transaction_id],
    enabled: !!inv?.transaction_id,
    queryFn: async () => {
      const { data } = await supabase.from("risk_scores").select("composite, contributors").eq("transaction_id", inv!.transaction_id!).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading correlation…</div>;
  if (!inv) return <div className="p-6 text-sm text-muted-foreground">No correlated incident yet. Simulate a transaction from the Transactions page to trigger the engine.</div>;

  const evidence = (Array.isArray(inv.evidence) ? inv.evidence as EvidenceItem[] : []);
  const composite = contribs?.composite ?? inv.confidence;
  const sel = evidence[selIdx];

  return (
    <div>
      <PageHeader
        title="Correlation Engine"
        subtitle="AI fuses cyber telemetry, customer behaviour, threat intel and transactions into one composite decision."
        badge={<span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full hairline bg-cyan-500/10 text-cyan-300">AI Core</span>}
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <StatCard label="Correlation Score" value={`${composite}`} accent="text-rose-300" />
        <StatCard label="Attack Type" value={inv.attack_type ?? "—"} small />
        <StatCard label="AI Confidence" value={`${inv.confidence}%`} accent="text-cyan-300" />
        <StatCard label="Business Impact" value={`$${Number(inv.business_impact ?? 0).toLocaleString()}`} accent="text-amber-300" />
        <StatCard label="Fraud Prob." value="94%" accent="text-violet-300" />
        <StatCard label="Cyber Prob." value="89%" accent="text-cyan-300" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <GlassCard className="col-span-12 lg:col-span-7">
          <SectionHeader title="Kill Chain" description={`${evidence.length} correlated events · click any node`} />
          <ol className="relative border-l border-white/10 ml-2 space-y-3 pl-6">
            {evidence.map((e, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <button onClick={() => setSelIdx(i)} className={`w-full text-left rounded-lg p-3 hairline hover:bg-white/5 ${selIdx === i ? "ring-1 ring-cyan-400/40 bg-white/5" : ""}`}>
                  <div className="absolute -left-[7px] mt-1"><SeverityDot severity={i === evidence.length - 1 ? "critical" : i > evidence.length - 3 ? "high" : "medium"} pulse={i === evidence.length - 1} /></div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">{e.ts}</span>
                    <span className="text-xs uppercase tracking-wider text-cyan-300">{e.source}</span>
                    {typeof e.weight === "number" && <span className="ml-auto text-[10px] text-muted-foreground">weight {e.weight}</span>}
                  </div>
                  <div className="text-sm mt-1">{e.event}</div>
                </button>
              </motion.li>
            ))}
          </ol>
        </GlassCard>

        <div className="col-span-12 lg:col-span-5 space-y-4">
          <GlassCard>
            <SectionHeader title="Selected event" />
            {sel ? (
              <>
                <div className="text-sm font-semibold">{sel.event}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{sel.source} · {sel.ts}</div>
                {typeof sel.weight === "number" && (
                  <div className="mt-3">
                    <div className="text-[10px] uppercase text-muted-foreground">Risk contribution</div>
                    <div className="text-lg font-mono text-rose-300">+{sel.weight}</div>
                  </div>
                )}
              </>
            ) : <div className="text-xs text-muted-foreground">No event selected.</div>}
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-4">
              <ProgressRing value={composite} size={110} label="Composite" sublabel="risk score" />
              <div>
                <div className="text-sm font-semibold">Final AI Decision</div>
                <div className="text-xs text-muted-foreground mt-1">{inv.title}</div>
                <div className="mt-3 flex items-center gap-2">
                  <RiskBadge severity="critical" />
                  <span className="text-[11px] text-rose-300 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> BLOCK &amp; open case</span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[10px] uppercase text-muted-foreground mb-2">Recommended actions</div>
              <ul className="space-y-1.5">
                {(Array.isArray(inv.recommended_actions) ? inv.recommended_actions as string[] : []).map((a, i) => (
                  <li key={i} className="text-xs flex items-start gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5" /><span>{a}</span></li>
                ))}
              </ul>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = "", small = false }: { label: string; value: string; accent?: string; small?: boolean }) {
  return (
    <GlassCard>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`${small ? "text-sm" : "text-2xl"} font-mono mt-1 ${accent}`}>{value}</div>
    </GlassCard>
  );
}
