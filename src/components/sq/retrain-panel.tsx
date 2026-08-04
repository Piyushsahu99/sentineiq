// Retraining workflow panel for the model drift page: trigger a drift-gated
// retrain, review the candidate vs the live model, and promote or roll back.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GlassCard, SectionHeader } from "@/components/sq/glass-card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Brain, RotateCcw, ShieldCheck, Zap } from "lucide-react";
import { activateModelVersion, getModelVersions, runRetraining } from "@/lib/retrain.functions";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  active: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  candidate: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
  rejected: "text-rose-300 border-rose-400/30 bg-rose-400/10",
  retired: "text-muted-foreground border-white/10 bg-white/5",
};

function Pill({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", STATUS_STYLE[status] ?? STATUS_STYLE.retired)}>
      {status}
    </span>
  );
}

function Metric({ label, base, cand }: { label: string; base?: number; cand?: number }) {
  if (base === undefined || cand === undefined) return null;
  const better = label === "ROC-AUC" ? cand >= base : cand <= base;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm tabular-nums">
        <span className="text-muted-foreground">{base.toFixed(4)}</span>
        <span className="mx-1.5 text-muted-foreground">→</span>
        <span className={better ? "text-emerald-300" : "text-rose-300"}>{cand.toFixed(4)}</span>
      </p>
    </div>
  );
}

export function RetrainPanel({ days }: { days: number }) {
  const qc = useQueryClient();
  const fetchVersions = useServerFn(getModelVersions);
  const retrain = useServerFn(runRetraining);
  const activate = useServerFn(activateModelVersion);

  const { data, isLoading } = useQuery({
    queryKey: ["model-versions"],
    queryFn: () => fetchVersions({}),
    refetchInterval: 120_000,
  });

  const retrainMut = useMutation({
    mutationFn: (force: boolean) => retrain({ data: { days, force, dryRun: false } }),
    onSuccess: (r: any) => {
      if (r.stage === "gated") toast.info("No retraining needed", { description: r.reason });
      else if (r.stage === "insufficient_labels") toast.warning("Not enough labelled data", { description: r.reason });
      else if (r.promoted) toast.success(`Model updated → ${r.version}`, { description: r.reason });
      else if (r.accepted) toast.success(`Candidate ${r.version} passed validation`, { description: r.reason });
      else toast.error("Candidate rejected", { description: r.reason });
      qc.invalidateQueries({ queryKey: ["model-versions"] });
      qc.invalidateQueries({ queryKey: ["drift-report"] });
    },
    onError: (e: any) => toast.error("Retraining failed", { description: String(e?.message ?? e) }),
  });

  const activateMut = useMutation({
    mutationFn: (version: string) => activate({ data: { version } }),
    onSuccess: (r: any) => {
      toast.success(`Now serving ${r.active_version}`);
      qc.invalidateQueries({ queryKey: ["model-versions"] });
    },
    onError: (e: any) => toast.error("Could not switch version", { description: String(e?.message ?? e) }),
  });

  const versions: any[] = data?.versions ?? [];
  const active = data?.active ?? null;
  const latest = versions[0] ?? null;
  const busy = retrainMut.isPending || activateMut.isPending;

  return (
    <GlassCard className="p-4 sm:p-6">
      <SectionHeader
        title="Automated retraining"
        description="Drift-gated weight refresh: the latest labelled traffic fits an adaptive correction on the Random Forest, validated on a chronological hold-out before it goes live."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => retrainMut.mutate(false)} disabled={busy}>
          <Zap className="mr-2 h-4 w-4" />
          {retrainMut.isPending ? "Retraining…" : "Run retraining"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => retrainMut.mutate(true)} disabled={busy}>
          <Brain className="mr-2 h-4 w-4" /> Force retrain
        </Button>
        {active ? (
          <Button size="sm" variant="ghost" onClick={() => activateMut.mutate(data?.base_version ?? "rf-1.0.0")} disabled={busy}>
            <RotateCcw className="mr-2 h-4 w-4" /> Roll back to base
          </Button>
        ) : null}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Serving <span className="font-semibold text-foreground">{active?.version ?? data?.base_version ?? "rf-1.0.0"}</span>
        </span>
      </div>

      {latest?.metrics?.candidate ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Brier" base={latest.metrics.baseline?.brier} cand={latest.metrics.candidate?.brier} />
          <Metric label="ROC-AUC" base={latest.metrics.baseline?.auc} cand={latest.metrics.candidate?.auc} />
          <Metric label="Log loss" base={latest.metrics.baseline?.logloss} cand={latest.metrics.candidate?.logloss} />
          <Metric label="Accuracy" base={latest.metrics.baseline?.accuracy} cand={latest.metrics.candidate?.accuracy} />
        </div>
      ) : null}

      {latest?.feature_weights?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {latest.feature_weights.map((w: any) => (
            <span key={w.feature} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] tabular-nums">
              {w.feature}
              <span className={cn("ml-1.5 font-semibold", w.weight >= 0 ? "text-cyan-300" : "text-amber-300")}>
                {w.weight > 0 ? "+" : ""}{Number(w.weight).toFixed(3)}
              </span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading model registry…</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No retrained versions yet — the frozen base forest ({data?.base_version ?? "rf-1.0.0"}) is serving all traffic.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Version</th>
                <th className="py-2 pr-4 font-medium">Trained</th>
                <th className="py-2 pr-4 font-medium">Trigger</th>
                <th className="py-2 pr-4 font-medium">Labels</th>
                <th className="py-2 pr-4 font-medium">Brier gain</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-t border-white/5">
                  <td className="py-2 pr-4 font-medium">{v.version}</td>
                  <td className="py-2 pr-4">{new Date(v.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 capitalize">{v.trigger}</td>
                  <td className="py-2 pr-4 tabular-nums">{v.sample_size} ({v.positive_labels}+)</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {v.metrics?.improvement ? `${(v.metrics.improvement.brier * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 pr-4"><Pill status={v.status} /></td>
                  <td className="py-2">
                    {v.status !== "active" && v.accepted ? (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" disabled={busy} onClick={() => activateMut.mutate(v.version)}>
                        Activate
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {latest?.notes ? <p className="mt-3 text-[11px] text-muted-foreground">{latest.notes}</p> : null}
    </GlassCard>
  );
}
