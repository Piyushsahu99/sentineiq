// Feature & prediction drift monitoring for the Random Forest correlation model.
// Compares the live scoring population against the reference (training/holdout)
// distribution shipped in rf-baseline.json using the Population Stability Index.
//
// PSI interpretation (industry standard for credit/fraud models):
//   < 0.10  stable
//   0.10-0.25 watch (moderate shift)
//   >= 0.25 drifted (retraining recommended)

import baseline from "./rf-baseline.json";
import { FEATURE_NAMES } from "./rf-infer.server";

export type DriftLevel = "stable" | "watch" | "drifted";

export type FeatureDrift = {
  feature: string;
  psi: number;
  level: DriftLevel;
  baseline_mean: number | null;
  live_mean: number;
  mean_shift: number | null;
};

export type DriftReport = {
  sample_size: number;
  min_sample: number;
  sufficient_data: boolean;
  overall_psi: number;
  prediction_psi: number;
  prediction_level: DriftLevel;
  status: DriftLevel;
  retrain_recommended: boolean;
  drifted_features: string[];
  features: FeatureDrift[];
  baseline_prediction_mean: number;
  live_prediction_mean: number;
  notes: string;
  window_start: string | null;
  window_end: string | null;
};

export const PSI_WATCH = 0.1;
export const PSI_DRIFT = 0.25;
export const MIN_SAMPLE = 30;

type BaselineFeature = {
  name: string; kind: "binary" | "numeric"; edges: number[];
  props: number[]; mean: number; std: number;
};

const BASE_FEATURES = (baseline as any).features as BaselineFeature[];
const BASE_PRED = (baseline as any).prediction as { edges: number[]; props: number[]; mean: number };
export const BASELINE_SIZE: number = (baseline as any).n_reference;

/** Per-feature reference mean/std, indexed like FEATURE_NAMES. Used by retraining. */
export const BASELINE_FEATURE_STATS: Array<{ name: string; mean: number; std: number }> =
  BASE_FEATURES.map((f) => ({ name: f.name, mean: f.mean, std: f.std }));

export function levelFor(psi: number): DriftLevel {
  if (psi >= PSI_DRIFT) return "drifted";
  if (psi >= PSI_WATCH) return "watch";
  return "stable";
}

/** Index of the bin a value falls into, given right-inclusive edges. */
function binIndex(value: number, edges: number[]): number {
  for (let i = 0; i < edges.length; i++) if (value <= edges[i]) return i;
  return edges.length;
}

function binaryProps(values: number[]): number[] {
  const n = values.length || 1;
  const hi = values.filter((v) => v > 0.5).length;
  return [(n - hi) / n, hi / n];
}

function bucketProps(values: number[], edges: number[]): number[] {
  const counts = new Array(edges.length + 1).fill(0);
  for (const v of values) counts[binIndex(v, edges)] += 1;
  const n = values.length || 1;
  return counts.map((c) => c / n);
}

/** Population Stability Index between an expected and an actual proportion vector. */
export function psi(expected: number[], actual: number[]): number {
  const eps = 1e-4;
  let total = 0;
  for (let i = 0; i < expected.length; i++) {
    const e = Math.max(expected[i] ?? 0, eps);
    const a = Math.max(actual[i] ?? 0, eps);
    total += (a - e) * Math.log(a / e);
  }
  return Math.round(total * 10000) / 10000;
}

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

export type Snapshot = { features: number[]; rf_probability: number; created_at?: string };

/**
 * Compute a full drift report for a batch of live scoring snapshots.
 * Pure — no DB access, so it is unit-testable and reusable from cron + UI.
 */
export function computeDrift(snapshots: Snapshot[]): DriftReport {
  const rows = snapshots.filter((s) => Array.isArray(s.features) && s.features.length === FEATURE_NAMES.length);
  const n = rows.length;
  const times = rows.map((r) => r.created_at).filter(Boolean).sort() as string[];

  const features: FeatureDrift[] = BASE_FEATURES.map((bf, i) => {
    const col = rows.map((r) => Number(r.features[i]) || 0);
    if (!n) {
      return { feature: bf.name, psi: 0, level: "stable" as DriftLevel, baseline_mean: bf.mean, live_mean: 0, mean_shift: null };
    }
    const actual = bf.kind === "binary" ? binaryProps(col) : bucketProps(col, bf.edges);
    const value = psi(bf.props, actual);
    const liveMean = round(mean(col));
    const denom = bf.std > 1e-6 ? bf.std : Math.max(1e-6, Math.abs(bf.mean));
    return {
      feature: bf.name,
      psi: value,
      level: levelFor(value),
      baseline_mean: bf.mean,
      live_mean: liveMean,
      mean_shift: round((liveMean - bf.mean) / denom, 3),
    };
  }).sort((a, b) => b.psi - a.psi);

  const probs = rows.map((r) => Number(r.rf_probability) || 0);
  const predictionPsi = n ? psi(BASE_PRED.props, bucketProps(probs, BASE_PRED.edges)) : 0;
  const overall = n ? round(mean(features.map((f) => f.psi))) : 0;
  const drifted = features.filter((f) => f.level === "drifted").map((f) => f.feature);
  const watching = features.filter((f) => f.level === "watch").length;

  const sufficient = n >= MIN_SAMPLE;
  let status: DriftLevel = "stable";
  if (sufficient) {
    if (drifted.length >= 2 || predictionPsi >= PSI_DRIFT || overall >= PSI_DRIFT) status = "drifted";
    else if (drifted.length >= 1 || watching >= 3 || predictionPsi >= PSI_WATCH || overall >= PSI_WATCH) status = "watch";
  }
  const retrain = sufficient && status === "drifted";

  const notes = !sufficient
    ? `Only ${n} scored transactions in window — need ${MIN_SAMPLE} for a reliable drift verdict.`
    : retrain
      ? `Retraining recommended: ${drifted.length} feature(s) past PSI ${PSI_DRIFT}${predictionPsi >= PSI_DRIFT ? ", plus prediction-distribution drift" : ""}.`
      : status === "watch"
        ? `Moderate shift detected (${watching} feature(s) in watch range). Monitor; no retraining required yet.`
        : "Live population matches the training distribution. Model is stable.";

  return {
    sample_size: n,
    min_sample: MIN_SAMPLE,
    sufficient_data: sufficient,
    overall_psi: overall,
    prediction_psi: predictionPsi,
    prediction_level: levelFor(predictionPsi),
    status,
    retrain_recommended: retrain,
    drifted_features: drifted,
    features,
    baseline_prediction_mean: BASE_PRED.mean,
    live_prediction_mean: round(mean(probs)),
    notes,
    window_start: times[0] ?? null,
    window_end: times[times.length - 1] ?? null,
  };
}
