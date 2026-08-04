// End-to-end retraining workflow: gather the latest drifting + labelled data,
// validate drift thresholds, fit a candidate model version, validate it on a
// hold-out, and promote it automatically when it wins. Server-only.

import { computeDrift } from "./ml/rf-drift.server";
import { trainCandidate, nextVersion, type LabeledRow } from "./ml/rf-retrain.server";
import { invalidateActiveModel, BASE_MODEL_VERSION } from "./ml/rf-active.server";

export type RetrainOptions = {
  days?: number;
  /** Train even when drift thresholds say the model is stable. */
  force?: boolean;
  /** Persist the candidate but never promote it. */
  dryRun?: boolean;
  trigger?: string;
  userId?: string | null;
};

/** Pull scored snapshots and attach the strongest available label for each. */
export async function collectLabeledRows(supabaseAdmin: any, days: number) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data: snaps } = await supabaseAdmin
    .from("model_feature_snapshots")
    .select("transaction_id, features, rf_probability, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = (snaps ?? []) as Array<{ transaction_id: string | null; features: number[]; rf_probability: number; created_at: string }>;
  const txIds = rows.map((r) => r.transaction_id).filter(Boolean) as string[];

  // Strong labels: analyst verdicts on the investigation for that transaction.
  const labels = new Map<string, { label: number; weight: number; source: string }>();
  if (txIds.length) {
    const { data: invs } = await supabaseAdmin
      .from("ai_investigations")
      .select("id, transaction_id, status")
      .in("transaction_id", txIds.slice(0, 1000));
    const invList = (invs ?? []) as Array<{ id: string; transaction_id: string; status: string }>;
    const invByTx = new Map(invList.map((i) => [i.transaction_id, i]));

    if (invList.length) {
      const { data: fb } = await supabaseAdmin
        .from("analyst_feedback")
        .select("investigation_id, verdict, created_at")
        .in("investigation_id", invList.map((i) => i.id));
      const byInv = new Map<string, { tp: number; fp: number }>();
      for (const f of (fb ?? []) as Array<{ investigation_id: string; verdict: string }>) {
        const acc = byInv.get(f.investigation_id) ?? { tp: 0, fp: 0 };
        if (f.verdict === "true_positive") acc.tp++;
        else acc.fp++;
        byInv.set(f.investigation_id, acc);
      }
      for (const inv of invList) {
        const acc = byInv.get(inv.id);
        if (acc && acc.tp + acc.fp > 0) {
          labels.set(inv.transaction_id, { label: acc.tp >= acc.fp ? 1 : 0, weight: 1, source: "analyst_verdict" });
        } else if (inv.status === "confirmed" || inv.status === "escalated") {
          labels.set(inv.transaction_id, { label: 1, weight: 0.6, source: "investigation_status" });
        } else if (inv.status === "dismissed" || inv.status === "closed") {
          labels.set(inv.transaction_id, { label: 0, weight: 0.6, source: "investigation_status" });
        }
      }
      void invByTx;
    }

    // Weak outcome labels for the remainder: settled transaction status.
    const { data: txs } = await supabaseAdmin
      .from("transactions")
      .select("id, status")
      .in("id", txIds.slice(0, 1000));
    for (const t of (txs ?? []) as Array<{ id: string; status: string }>) {
      if (labels.has(t.id)) continue;
      if (t.status === "blocked") labels.set(t.id, { label: 1, weight: 0.3, source: "outcome" });
      else if (t.status === "approved") labels.set(t.id, { label: 0, weight: 0.3, source: "outcome" });
    }
  }

  const labeled: LabeledRow[] = [];
  const sources: Record<string, number> = {};
  for (const r of rows) {
    const l = r.transaction_id ? labels.get(r.transaction_id) : undefined;
    if (!l) continue;
    sources[l.source] = (sources[l.source] ?? 0) + 1;
    labeled.push({
      features: r.features, p: Number(r.rf_probability) || 0,
      label: l.label, weight: l.weight, created_at: r.created_at,
    });
  }
  return { snapshots: rows, labeled, sources };
}

/**
 * Full workflow: drift check → threshold gate → fit → validate → promote.
 * Returns a structured audit record; never throws for "no work to do".
 */
export async function runRetrainingWorkflow(supabaseAdmin: any, opts: RetrainOptions = {}) {
  const days = opts.days ?? 7;
  const trigger = opts.trigger ?? "manual";
  const { snapshots, labeled, sources } = await collectLabeledRows(supabaseAdmin, days);

  const drift = computeDrift(snapshots as any);

  const { data: current } = await supabaseAdmin
    .from("model_versions")
    .select("version")
    .eq("status", "active")
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const parentVersion: string = current?.version ?? BASE_MODEL_VERSION;

  // ---- drift threshold gate ----
  if (!opts.force && !drift.retrain_recommended) {
    return {
      stage: "gated" as const,
      promoted: false, accepted: false,
      version: null as string | null,
      parent_version: parentVersion,
      drift, labeled_rows: labeled.length, label_sources: sources,
      reason: drift.sufficient_data
        ? `Drift thresholds not breached (status ${drift.status}, overall PSI ${drift.overall_psi}). No retraining required.`
        : drift.notes,
    };
  }

  const result = trainCandidate(labeled, drift.drifted_features);

  if (result.gate.stage === "data") {
    return {
      stage: "insufficient_labels" as const,
      promoted: false, accepted: false,
      version: null as string | null,
      parent_version: parentVersion,
      drift, labeled_rows: labeled.length, label_sources: sources,
      reason: result.reason,
    };
  }

  const version = nextVersion(parentVersion);
  const promote = result.accepted && !opts.dryRun;

  const { data: saved } = await supabaseAdmin
    .from("model_versions")
    .insert({
      version,
      parent_version: parentVersion,
      status: promote ? "active" : result.accepted ? "candidate" : "rejected",
      trigger,
      sample_size: result.train_size,
      holdout_size: result.holdout_size,
      positive_labels: result.positive_labels,
      calibration: { a: result.overlay.a, b: result.overlay.b, iso: result.overlay.iso },
      feature_weights: result.overlay.weights,
      metrics: {
        baseline: result.baseline_metrics,
        candidate: result.candidate_metrics,
        improvement: result.improvement,
        label_sources: sources,
        drift: {
          status: drift.status, overall_psi: drift.overall_psi,
          prediction_psi: drift.prediction_psi, drifted_features: drift.drifted_features,
        },
      },
      gate: result.gate,
      accepted: result.accepted,
      notes: result.reason,
      created_by: opts.userId ?? null,
      activated_at: promote ? new Date().toISOString() : null,
    })
    .select("id, version, status")
    .single();

  if (promote) {
    await supabaseAdmin
      .from("model_versions")
      .update({ status: "retired", retired_at: new Date().toISOString() })
      .eq("status", "active")
      .neq("version", version);
    invalidateActiveModel();
    await supabaseAdmin.from("notifications").insert({
      title: `Model retrained → ${version}`,
      body: `Drift-triggered retrain promoted ${version} (from ${parentVersion}). Brier ${result.baseline_metrics.brier} → ${result.candidate_metrics.brier}, ROC-AUC ${result.baseline_metrics.auc} → ${result.candidate_metrics.auc} on ${result.holdout_size} held-out rows.`,
      severity: "medium",
    });
  } else if (!result.accepted) {
    await supabaseAdmin.from("notifications").insert({
      title: "Retraining candidate rejected",
      body: `${version} did not beat ${parentVersion} on held-out data — current model kept live. ${result.reason}`,
      severity: "low",
    });
  }

  return {
    stage: "trained" as const,
    promoted: promote,
    accepted: result.accepted,
    version: saved?.version ?? version,
    version_id: saved?.id ?? null,
    parent_version: parentVersion,
    drift,
    labeled_rows: labeled.length,
    label_sources: sources,
    metrics: { baseline: result.baseline_metrics, candidate: result.candidate_metrics, improvement: result.improvement },
    feature_weights: result.overlay.weights,
    gate: result.gate,
    reason: result.reason,
  };
}

/** Promote or roll back a stored model version. */
export async function setActiveVersion(supabaseAdmin: any, version: string) {
  const { data: target } = await supabaseAdmin
    .from("model_versions").select("id, version, accepted").eq("version", version).maybeSingle();
  if (!target) throw new Error(`Unknown model version ${version}`);

  await supabaseAdmin
    .from("model_versions")
    .update({ status: "retired", retired_at: new Date().toISOString() })
    .eq("status", "active");
  await supabaseAdmin
    .from("model_versions")
    .update({ status: "active", activated_at: new Date().toISOString(), retired_at: null })
    .eq("id", target.id);
  invalidateActiveModel();
  return { active_version: version };
}

/** Roll back to the frozen base forest (no overlay). */
export async function rollbackToBase(supabaseAdmin: any) {
  await supabaseAdmin
    .from("model_versions")
    .update({ status: "retired", retired_at: new Date().toISOString() })
    .eq("status", "active");
  invalidateActiveModel();
  return { active_version: BASE_MODEL_VERSION };
}
