import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDriftReport, runDriftScan } from "@/lib/drift.functions";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/model-drift")({
  ssr: false,
  component: DriftPage,
  head: () => ({
    meta: [
      { title: "Model Drift Monitor · SentinelQ" },
      { name: "description", content: "Feature and prediction drift monitoring for the SentinelQ Random Forest correlation model, with retraining alerts." },
      { property: "og:title", content: "Model Drift Monitor · SentinelQ" },
      { property: "og:description", content: "Track PSI-based feature and prediction drift for the fraud correlation model." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const LEVEL_STYLE: Record<string, string> = {
  stable: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  watch: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  drifted: "text-rose-300 border-rose-400/30 bg-rose-400/10",
};

function Badge({ level }: { level: string }) {
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", LEVEL_STYLE[level] ?? LEVEL_STYLE.stable)}>
      {level}
    </span>
  );
}

function DriftPage() {
  const [days, setDays] = useState(7);
  const qc = useQueryClient();
  const fetchReport = useServerFn(getDriftReport);
  const scan = useServerFn(runDriftScan);

  const { data, isLoading, error } = useQuery({
    queryKey: ["drift-report", days],
    queryFn: () => fetchReport({ data: { days } }),
    refetchInterval: 60_000,
  });

  const scanMut = useMutation({
    mutationFn: () => scan({ data: { days } }),
    onSuccess: (r: any) => {
      toast[r.retrain_recommended ? "error" : r.status === "watch" ? "warning" : "success"](
        r.retrain_recommended ? "Drift detected — retraining recommended" : r.status === "watch" ? "Moderate drift detected" : "Model stable",
        { description: r.notes },
      );
      qc.invalidateQueries({ queryKey: ["drift-report"] });
    },
    onError: (e: any) => toast.error("Drift scan failed", { description: String(e?.message ?? e) }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model Drift Monitor"
        subtitle="Population Stability Index of live scoring traffic vs. the Random Forest training distribution"
      />

      <div className="flex flex-wrap items-center gap-2">
        {[1, 7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs transition",
              days === d ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-muted-foreground hover:text-foreground",
            )}
          >
            Last {d}d
          </button>
        ))}
        <Button size="sm" onClick={() => scanMut.mutate()} disabled={scanMut.isPending} className="ml-auto gap-2">
          <RefreshCw className={cn("h-3.5 w-3.5", scanMut.isPending && "animate-spin")} />
          Run drift scan
        </Button>
      </div>

      {error && (
        <GlassCard className="p-6 text-sm text-rose-300">Unable to load drift report: {String((error as any)?.message ?? error)}</GlassCard>
      )}

      {isLoading && <GlassCard className="p-6 text-sm text-muted-foreground">Computing drift…</GlassCard>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Overall status</span>
                <Badge level={data.status} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-lg font-semibold">
                {data.retrain_recommended ? <AlertTriangle className="h-4 w-4 text-rose-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                {data.retrain_recommended ? "Retrain recommended" : "No retraining needed"}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{data.notes}</p>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="text-xs text-muted-foreground">Overall feature PSI</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{data.overall_psi.toFixed(3)}</div>
              <p className="mt-2 text-xs text-muted-foreground">Mean PSI across {data.features.length} features · alert ≥ 0.25</p>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Prediction PSI</span>
                <Badge level={data.prediction_level} />
              </div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{data.prediction_psi.toFixed(3)}</div>
              <p className="mt-2 text-xs text-muted-foreground">
                Mean probability {data.live_prediction_mean.toFixed(3)} vs baseline {data.baseline_prediction_mean.toFixed(3)}
              </p>
            </GlassCard>

            <GlassCard className="p-4">
              <div className="text-xs text-muted-foreground">Scored population</div>
              <div className="mt-2 text-3xl font-semibold tabular-nums">{data.sample_size}</div>
              <p className="mt-2 text-xs text-muted-foreground">
                Last {data.window_days}d · reference set {data.baseline_size} rows{!data.sufficient_data && ` · need ${data.min_sample}+`}
              </p>
            </GlassCard>
          </div>

          <GlassCard className="p-4 sm:p-6">
            <SectionHeader title="Per-feature drift" description="PSI of each model input against its training distribution" />
            <div className="mt-4 space-y-2">
              {data.features.map((f: any) => (
                <div key={f.feature} className="flex items-center gap-3">
                  <div className="w-44 shrink-0 truncate font-mono text-[11px] text-muted-foreground">{f.feature}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        f.level === "drifted" ? "bg-rose-400" : f.level === "watch" ? "bg-amber-400" : "bg-emerald-400/70",
                      )}
                      style={{ width: `${Math.min(100, (f.psi / 0.5) * 100)}%` }}
                    />
                  </div>
                  <div className="w-14 text-right font-mono text-[11px] tabular-nums">{f.psi.toFixed(3)}</div>
                  <div className="hidden w-24 text-right text-[11px] text-muted-foreground sm:block">
                    μ {f.live_mean} / {f.baseline_mean}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-4 sm:p-6">
            <SectionHeader title="Scan history" description="Persisted drift checks and retraining decisions" />
            {data.history.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">No stored scans yet — run a drift scan to record one.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">When</th>
                      <th className="py-2 pr-4 font-medium">Samples</th>
                      <th className="py-2 pr-4 font-medium">Feature PSI</th>
                      <th className="py-2 pr-4 font-medium">Prediction PSI</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 font-medium">Retrain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h: any) => (
                      <tr key={h.id} className="border-t border-white/5">
                        <td className="py-2 pr-4">{new Date(h.created_at).toLocaleString()}</td>
                        <td className="py-2 pr-4 tabular-nums">{h.sample_size}</td>
                        <td className="py-2 pr-4 tabular-nums">{Number(h.overall_psi).toFixed(3)}</td>
                        <td className="py-2 pr-4 tabular-nums">{Number(h.prediction_psi).toFixed(3)}</td>
                        <td className="py-2 pr-4"><Badge level={h.status} /></td>
                        <td className="py-2">{h.retrain_recommended ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
