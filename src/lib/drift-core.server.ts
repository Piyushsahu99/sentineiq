// Shared drift-scan logic: compute, persist, and alert. Server-only.
import { computeDrift } from "./ml/rf-drift.server";

export async function runDriftScanCore(supabaseAdmin: any, days = 7) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data: snaps } = await supabaseAdmin
    .from("model_feature_snapshots")
    .select("features, rf_probability, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  const report = computeDrift((snaps ?? []) as any);

  const { data: saved } = await supabaseAdmin
    .from("model_drift_reports")
    .insert({
      window_start: report.window_start,
      window_end: report.window_end,
      sample_size: report.sample_size,
      overall_psi: report.overall_psi,
      prediction_psi: report.prediction_psi,
      drifted_features: report.drifted_features,
      feature_psi: report.features.slice(0, 24),
      status: report.status,
      retrain_recommended: report.retrain_recommended,
      notes: report.notes,
    })
    .select("id")
    .single();

  // Alert once per scan when the model has moved off its training distribution.
  if (report.retrain_recommended) {
    await supabaseAdmin.from("notifications").insert({
      title: "Model drift: retraining recommended",
      body: `RF correlation model · overall PSI ${report.overall_psi} · prediction PSI ${report.prediction_psi} · drifted: ${report.drifted_features.slice(0, 4).join(", ") || "none"}`,
      severity: "high",
    });
  } else if (report.status === "watch") {
    await supabaseAdmin.from("notifications").insert({
      title: "Model drift watch",
      body: `RF correlation model showing moderate shift (overall PSI ${report.overall_psi}) over ${report.sample_size} scored transactions.`,
      severity: "medium",
    });
  }

  return { ...report, report_id: saved?.id ?? null, window_days: days };
}
