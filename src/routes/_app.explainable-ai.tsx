import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { ProgressRing } from "@/components/sq/progress-ring";
import { Brain, Shield, DollarSign, Link2, Atom, ThumbsUp, ThumbsDown, MinusCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { submitFeedback } from "@/lib/correlation.functions";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/explainable-ai")({
  ssr: false,
  component: XAIPage,
});

type Signal = {
  id: string;
  kind: "fraud" | "cyber" | "xcorr" | "quantum";
  name: string;
  weight: number;
  confidence: number;
  evidence: Array<{ source: string; ref_id?: string; ts?: string; note: string }>;
};

type Explanation = {
  signals: Signal[];
  composite: number;
  calibrated_confidence: number;
  kind_weights: Record<Signal["kind"], number>;
  dominant_kind: Signal["kind"];
  suppressed: string[];
};

const KIND_META: Record<Signal["kind"], { label: string; icon: any; color: string }> = {
  fraud:   { label: "Fraud",         icon: DollarSign, color: "text-amber-300" },
  cyber:   { label: "Cyber",         icon: Shield,     color: "text-cyan-300" },
  xcorr:   { label: "Cross-signal",  icon: Link2,      color: "text-violet-300" },
  quantum: { label: "Quantum",       icon: Atom,       color: "text-emerald-300" },
};

function XAIPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();
  const submit = useServerFn(submitFeedback);

  const { data: investigations } = useQuery({
    queryKey: ["xai-investigations"],
    queryFn: async () => {
      const { data } = await supabase.from("ai_investigations")
        .select("id, title, confidence, calibrated_confidence, attack_type, business_impact, explanation, root_cause, recommended_actions")
        .order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const active = investigations?.find((i) => i.id === selectedId) ?? investigations?.[0];
  const explanation = (active?.explanation ?? null) as Explanation | null;

  const mutate = useMutation({
    mutationFn: (input: Parameters<typeof submitFeedback>[0]["data"]) => submit({ data: input }),
    onSuccess: () => { toast.success("Feedback recorded"); qc.invalidateQueries({ queryKey: ["xai-investigations"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (!investigations?.length) {
    return <div className="p-6 text-sm text-muted-foreground">No investigations yet. Trigger a correlation from the Transactions page or run a proactive scan from the Alerts page.</div>;
  }

  const composite = explanation?.composite ?? active?.confidence ?? 0;
  const calibrated = explanation?.calibrated_confidence ?? active?.calibrated_confidence ?? active?.confidence ?? 0;

  return (
    <div>
      <PageHeader
        title="Explainable AI"
        subtitle="Every decision is auditable: typed signals, evidence citations, calibrated confidence, and analyst feedback."
        actions={
          <select value={active?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)} className="text-xs bg-white/5 hairline rounded-lg px-3 py-1.5 max-w-[420px]">
            {investigations.map((i) => (<option key={i.id} value={i.id}>{i.title}</option>))}
          </select>
        }
      />

      <div className="grid grid-cols-12 gap-6 mb-6">
        <GlassCard className="col-span-12 md:col-span-4 flex items-center gap-6 justify-center">
          <ProgressRing value={composite} label="Risk" size={130} color="var(--risk-critical)" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Calibrated confidence</div>
            <div className="text-2xl font-mono">{calibrated}%</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              rule pipeline v3 · {explanation?.signals.length ?? 0} signals · dominant: {explanation?.dominant_kind ?? "—"}
            </div>
            {explanation?.suppressed?.length ? (
              <div className="text-[10px] text-amber-300 mt-1">↓ {explanation.suppressed.length} signal(s) suppressed by analyst feedback</div>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-8">
          <div className="flex items-center gap-2 mb-2"><Brain className="h-4 w-4 text-violet-300" /><span className="text-sm font-semibold">Natural-language explanation</span></div>
          <p className="text-sm text-muted-foreground leading-relaxed">{active?.root_cause}</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(Object.keys(KIND_META) as Signal["kind"][]).map((k) => {
              const Icon = KIND_META[k].icon;
              const w = explanation?.kind_weights?.[k] ?? 0;
              return (
                <div key={k} className="rounded-lg hairline p-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground"><Icon className={`h-3 w-3 ${KIND_META[k].color}`} />{KIND_META[k].label}</div>
                  <div className="text-lg font-mono mt-1">{w}</div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 lg:col-span-8">
          <SectionHeader title="Signals" description="Typed contributions with evidence citations" />
          <div className="space-y-2">
            {(explanation?.signals ?? []).map((s) => {
              const Icon = KIND_META[s.kind].icon;
              const pct = Math.min(100, s.weight * 5);
              return (
                <div key={s.id} className="rounded-lg hairline bg-white/3 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><Icon className={`h-3.5 w-3.5 ${KIND_META[s.kind].color}`} />{s.name}</span>
                    <span className="font-mono text-rose-300">+{s.weight} · {s.confidence}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--risk-critical)" }} />
                  </div>
                  {s.evidence?.length ? (
                    <ul className="mt-2 space-y-0.5">
                      {s.evidence.slice(0, 3).map((e, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground font-mono">↳ {e.source}{e.ref_id ? `#${String(e.ref_id).slice(0,8)}` : ""} — {e.note}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-2 flex items-center gap-1.5">
                    <button onClick={() => mutate.mutate({ investigationId: active!.id, signalId: s.id, verdict: "true_positive" })} className="text-[10px] px-2 py-1 rounded hairline hover:bg-emerald-500/10 flex items-center gap-1"><ThumbsUp className="h-3 w-3" />True positive</button>
                    <button onClick={() => mutate.mutate({ investigationId: active!.id, signalId: s.id, verdict: "false_positive" })} className="text-[10px] px-2 py-1 rounded hairline hover:bg-rose-500/10 flex items-center gap-1"><ThumbsDown className="h-3 w-3" />False positive</button>
                    <button onClick={() => mutate.mutate({ investigationId: active!.id, signalId: s.id, verdict: "benign" })} className="text-[10px] px-2 py-1 rounded hairline hover:bg-white/5 flex items-center gap-1"><MinusCircle className="h-3 w-3" />Benign</button>
                  </div>
                </div>
              );
            })}
            {!explanation?.signals?.length && <div className="text-xs text-muted-foreground">This investigation predates the typed-signal pipeline. Trigger a new correlation to see grouped signals.</div>}
          </div>
        </GlassCard>

        <div className="col-span-12 lg:col-span-4 grid grid-cols-1 gap-6">
          <GlassCard>
            <SectionHeader title="Recommended actions" />
            <div className="space-y-1.5 text-sm">
              {(active?.recommended_actions as string[] | null ?? []).map((a: string) => (
                <div key={a} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_var(--cyber-cyan)]" />{a}</div>
              ))}
            </div>
          </GlassCard>
          <GlassCard>
            <SectionHeader title="False-positive loop" description="3+ FP verdicts on same signal + customer auto-suppress its weight by 80% for 7 days." />
            <p className="text-[11px] text-muted-foreground">Analyst feedback closes the loop: repeated benign verdicts calibrate future scores down without silencing the signal globally.</p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
