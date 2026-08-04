// Online retraining engine for the SentinelQ Random Forest correlation model.
//
// The forest itself is trained offline (ml/train_rf.py) and shipped as JSON.
// What this module does is fit an *adaptive overlay* on top of the frozen
// forest, using the most recent drifting production data and analyst labels:
//
//   logit(p_adj) = a * logit(p_rf) + b + Σ w_j · z_j     (z = standardised drifted feature)
//   p_final      = isotonic(p_adj)                       (PAVA recalibration)
//
// That is a genuine weight update — the model version's `a`, `b`, `w_j` and the
// isotonic knots are learned from labelled traffic — while staying fast and
// dependency-free enough to run inside a Cloudflare Worker.
//
// Every candidate is validated on a chronological hold-out before it can go
// live: it must beat the current model on Brier score without losing ranking
// power (ROC-AUC). Otherwise it is persisted as `rejected` for the audit trail.

import { FEATURE_NAMES } from "./rf-infer.server";
import { BASELINE_FEATURE_STATS } from "./rf-drift.server";

export type LabeledRow = {
  features: number[];
  /** Calibrated probability the *current* model produced for this row. */
  p: number;
  /** 1 = confirmed fraud / true positive, 0 = benign / false positive. */
  label: number;
  /** Label trust: analyst verdicts 1.0, weak outcome labels lower. */
  weight?: number;
  created_at?: string;
};

export type Overlay = {
  a: number;
  b: number;
  /** Learned weights on standardised feature inputs. */
  weights: Array<{ index: number; feature: string; weight: number }>;
  /** Isotonic recalibration knots applied last. */
  iso: { x: number[]; y: number[] };
};

export type Metrics = {
  auc: number;
  brier: number;
  logloss: number;
  accuracy: number;
  mean_probability: number;
};

export type RetrainResult = {
  accepted: boolean;
  reason: string;
  overlay: Overlay;
  train_size: number;
  holdout_size: number;
  positive_labels: number;
  drifted_features: string[];
  baseline_metrics: Metrics;
  candidate_metrics: Metrics;
  improvement: { brier: number; auc: number; logloss: number };
  gate: Record<string, number | boolean | string>;
};

/** Minimum labelled rows required before a retrain is even attempted. */
export const MIN_TRAIN_ROWS = 40;
/** Minimum rows of each class. */
export const MIN_CLASS_ROWS = 6;
/** Candidate must cut Brier score by at least this relative amount. */
export const MIN_BRIER_GAIN = 0.01;
/** Candidate may not lose more than this much ROC-AUC. */
export const MAX_AUC_LOSS = 0.01;
/** Learned feature weights are clamped so one noisy window cannot flip the model. */
export const MAX_FEATURE_WEIGHT = 1.5;

/** Share of the isotonic recalibration vs the raw corrected score. */
export const ISO_BLEND = 0.85;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
const sigmoid = (z: number) => 1 / (1 + Math.exp(-clamp(z, -30, 30)));
const logit = (p: number) => {
  const q = clamp(p, 1e-5, 1 - 1e-5);
  return Math.log(q / (1 - q));
};

/** Standardise a raw feature value against the training baseline. */
function standardise(index: number, value: number): number {
  const stat = BASELINE_FEATURE_STATS[index];
  if (!stat) return 0;
  const std = stat.std > 1e-6 ? stat.std : 1;
  return clamp((value - stat.mean) / std, -6, 6);
}

// ---------- metrics ----------

export function rocAuc(rows: Array<{ p: number; label: number }>): number {
  const pos = rows.filter((r) => r.label === 1);
  const neg = rows.filter((r) => r.label === 0);
  if (!pos.length || !neg.length) return 0.5;
  // Rank-based (Mann-Whitney U) with tie handling.
  const sorted = [...rows].sort((x, y) => x.p - y.p);
  const ranks = new Array<number>(sorted.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].p === sorted[i].p) j++;
    const avg = (i + j + 2) / 2; // 1-indexed average rank
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }
  let rankSumPos = 0;
  sorted.forEach((r, idx) => { if (r.label === 1) rankSumPos += ranks[idx]; });
  const auc = (rankSumPos - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
  return round(clamp(auc, 0, 1));
}

export function evaluate(rows: Array<{ p: number; label: number }>): Metrics {
  if (!rows.length) return { auc: 0.5, brier: 1, logloss: 1, accuracy: 0, mean_probability: 0 };
  let brier = 0, ll = 0, correct = 0, sum = 0;
  for (const r of rows) {
    const p = clamp(r.p, 1e-6, 1 - 1e-6);
    brier += (p - r.label) ** 2;
    ll += -(r.label * Math.log(p) + (1 - r.label) * Math.log(1 - p));
    if ((p >= 0.5 ? 1 : 0) === r.label) correct++;
    sum += p;
  }
  const n = rows.length;
  return {
    auc: rocAuc(rows),
    brier: round(brier / n),
    logloss: round(ll / n),
    accuracy: round(correct / n),
    mean_probability: round(sum / n),
  };
}

// ---------- isotonic (pool adjacent violators) ----------

export function pava(points: Array<{ x: number; y: number; w: number }>, maxKnots = 48): { x: number[]; y: number[] } {
  const pts = [...points].sort((a, b) => a.x - b.x);
  if (!pts.length) return { x: [], y: [] };
  const vx: number[] = [], vy: number[] = [], vw: number[] = [];
  for (const p of pts) {
    vx.push(p.x); vy.push(p.y); vw.push(p.w || 1);
    while (vy.length > 1 && vy[vy.length - 2] > vy[vy.length - 1]) {
      const w1 = vw.pop()!, y1 = vy.pop()!, x1 = vx.pop()!;
      const w0 = vw.pop()!, y0 = vy.pop()!;
      vx.pop();
      vw.push(w0 + w1);
      vy.push((y0 * w0 + y1 * w1) / (w0 + w1));
      vx.push(x1);
    }
  }
  // Thin to at most maxKnots evenly spaced knots.
  if (vx.length <= maxKnots) return { x: vx.map((v) => round(v, 5)), y: vy.map((v) => round(v, 5)) };
  const x: number[] = [], y: number[] = [];
  for (let k = 0; k < maxKnots; k++) {
    const idx = Math.round((k * (vx.length - 1)) / (maxKnots - 1));
    if (x.length && vx[idx] === x[x.length - 1]) continue;
    x.push(round(vx[idx], 5)); y.push(round(vy[idx], 5));
  }
  return { x, y };
}

function isoApply(iso: { x: number[]; y: number[] }, p: number): number {
  const { x, y } = iso;
  if (!x.length) return p;
  if (p <= x[0]) return y[0];
  if (p >= x[x.length - 1]) return y[y.length - 1];
  let lo = 0, hi = x.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (x[mid] <= p) lo = mid; else hi = mid;
  }
  const dx = x[hi] - x[lo];
  if (dx === 0) return y[lo];
  return y[lo] + ((p - x[lo]) * (y[hi] - y[lo])) / dx;
}

/** Apply a trained overlay to a base model probability. Used at inference time. */
export function applyOverlay(overlay: Overlay | null | undefined, p: number, features: ArrayLike<number>): number {
  if (!overlay) return p;
  let z = overlay.a * logit(p) + overlay.b;
  for (const w of overlay.weights) {
    z += w.weight * standardise(w.index, Number(features[w.index]) || 0);
  }
  const raw = sigmoid(z);
  // Blend isotonic output with the raw score: isotonic pooling creates ties that
  // erode ranking power, the small raw share keeps the ordering strict.
  return clamp(ISO_BLEND * isoApply(overlay.iso, raw) + (1 - ISO_BLEND) * raw, 0, 1);
}

// ---------- fitting ----------

function fitLogistic(
  rows: LabeledRow[],
  indices: number[],
  opts: { epochs?: number; lr?: number; l2?: number } = {},
): { a: number; b: number; w: number[] } {
  const epochs = opts.epochs ?? 400;
  const lr = opts.lr ?? 0.08;
  const l2 = opts.l2 ?? 0.02;
  let a = 1, b = 0;
  const w = new Array(indices.length).fill(0);
  const design = rows.map((r) => ({
    l: logit(r.p),
    z: indices.map((i) => standardise(i, Number(r.features[i]) || 0)),
    y: r.label,
    wt: r.weight ?? 1,
  }));
  const totalW = design.reduce((s, d) => s + d.wt, 0) || 1;

  for (let e = 0; e < epochs; e++) {
    let ga = 0, gb = 0;
    const gw = new Array(indices.length).fill(0);
    for (const d of design) {
      let zsum = a * d.l + b;
      for (let j = 0; j < w.length; j++) zsum += w[j] * d.z[j];
      const err = (sigmoid(zsum) - d.y) * d.wt;
      ga += err * d.l;
      gb += err;
      for (let j = 0; j < w.length; j++) gw[j] += err * d.z[j];
    }
    a -= lr * (ga / totalW + l2 * (a - 1));
    b -= lr * (gb / totalW + l2 * b);
    for (let j = 0; j < w.length; j++) w[j] -= lr * (gw[j] / totalW + l2 * w[j]);
    a = clamp(a, 0.2, 3);
    b = clamp(b, -3, 3);
    for (let j = 0; j < w.length; j++) w[j] = clamp(w[j], -MAX_FEATURE_WEIGHT, MAX_FEATURE_WEIGHT);
  }
  return { a: round(a, 5), b: round(b, 5), w: w.map((v) => round(v, 5)) };
}

/** Chronological split so the hold-out is always the most recent traffic. */
export function splitChronological(rows: LabeledRow[], trainFrac = 0.7) {
  const sorted = [...rows].sort((x, y) => String(x.created_at ?? "").localeCompare(String(y.created_at ?? "")));
  const cut = Math.max(1, Math.floor(sorted.length * trainFrac));
  return { train: sorted.slice(0, cut), holdout: sorted.slice(cut) };
}

/**
 * Fit + validate a candidate model version from labelled drifting traffic.
 * Pure (no DB) so it is unit-testable and reusable from cron and the UI.
 */
export function trainCandidate(rows: LabeledRow[], driftedFeatures: string[]): RetrainResult {
  const valid = rows.filter(
    (r) => Array.isArray(r.features) && r.features.length === FEATURE_NAMES.length && (r.label === 0 || r.label === 1),
  );
  const positives = valid.filter((r) => r.label === 1).length;
  const negatives = valid.length - positives;

  // Learn weights on the drifted inputs first; if drift is diffuse, fall back
  // to the features that actually separate the labels in this window.
  let indices = driftedFeatures.map((f) => FEATURE_NAMES.indexOf(f)).filter((i) => i >= 0);
  // Only pad with discriminative features when drift gives us almost nothing —
  // padding a good drift signal with noisy inputs costs ranking power.
  if (indices.length < 2) {
    const scored = FEATURE_NAMES.map((_, i) => {
      const pos = valid.filter((r) => r.label === 1).map((r) => standardise(i, Number(r.features[i]) || 0));
      const neg = valid.filter((r) => r.label === 0).map((r) => standardise(i, Number(r.features[i]) || 0));
      const m = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
      return { i, sep: Math.abs(m(pos) - m(neg)) };
    }).sort((x, y) => y.sep - x.sep);
    for (const s of scored) {
      if (indices.length >= 4) break;
      if (!indices.includes(s.i) && s.sep > 0) indices.push(s.i);
    }
  }
  indices = indices.slice(0, 8);

  const emptyOverlay: Overlay = { a: 1, b: 0, weights: [], iso: { x: [], y: [] } };
  const baseAll = evaluate(valid.map((r) => ({ p: r.p, label: r.label })));

  const gate: Record<string, number | boolean | string> = {
    min_rows: MIN_TRAIN_ROWS,
    min_class_rows: MIN_CLASS_ROWS,
    rows: valid.length,
    positives,
    negatives,
    min_brier_gain: MIN_BRIER_GAIN,
    max_auc_loss: MAX_AUC_LOSS,
  };

  if (valid.length < MIN_TRAIN_ROWS || positives < MIN_CLASS_ROWS || negatives < MIN_CLASS_ROWS) {
    return {
      accepted: false,
      reason: `Insufficient labelled data: ${valid.length} rows (${positives} fraud / ${negatives} benign). Need ${MIN_TRAIN_ROWS}+ rows with ${MIN_CLASS_ROWS}+ of each class.`,
      overlay: emptyOverlay,
      train_size: valid.length,
      holdout_size: 0,
      positive_labels: positives,
      drifted_features: driftedFeatures,
      baseline_metrics: baseAll,
      candidate_metrics: baseAll,
      improvement: { brier: 0, auc: 0, logloss: 0 },
      gate: { ...gate, passed: false, stage: "data" },
    };
  }

  const { train, holdout } = splitChronological(valid);
  const { a, b, w } = fitLogistic(train, indices);

  // Isotonic recalibration on the corrected training probabilities.
  const corrected = (r: LabeledRow) => {
    let z = a * logit(r.p) + b;
    indices.forEach((idx, j) => { z += w[j] * standardise(idx, Number(r.features[idx]) || 0); });
    return sigmoid(z);
  };
  const iso = pava(train.map((r) => ({ x: corrected(r), y: r.label, w: r.weight ?? 1 })));

  const overlay: Overlay = {
    a, b,
    weights: indices.map((idx, j) => ({ index: idx, feature: FEATURE_NAMES[idx], weight: w[j] })),
    iso,
  };

  const evalRows = holdout.length >= 10 ? holdout : valid;
  const baseline_metrics = evaluate(evalRows.map((r) => ({ p: r.p, label: r.label })));
  const candidate_metrics = evaluate(
    evalRows.map((r) => ({ p: applyOverlay(overlay, r.p, r.features), label: r.label })),
  );

  const brierGain = baseline_metrics.brier > 0
    ? (baseline_metrics.brier - candidate_metrics.brier) / baseline_metrics.brier
    : 0;
  const aucDelta = candidate_metrics.auc - baseline_metrics.auc;
  const accepted = brierGain >= MIN_BRIER_GAIN && aucDelta >= -MAX_AUC_LOSS;

  return {
    accepted,
    reason: accepted
      ? `Validated on ${evalRows.length} held-out rows: Brier ${baseline_metrics.brier} → ${candidate_metrics.brier} (${(brierGain * 100).toFixed(1)}% better), ROC-AUC ${baseline_metrics.auc} → ${candidate_metrics.auc}.`
      : `Rejected: Brier gain ${(brierGain * 100).toFixed(1)}% (need ${(MIN_BRIER_GAIN * 100).toFixed(0)}%), ROC-AUC delta ${aucDelta.toFixed(4)} (max loss ${MAX_AUC_LOSS}). Current model kept live.`,
    overlay,
    train_size: train.length,
    holdout_size: evalRows.length,
    positive_labels: positives,
    drifted_features: overlay.weights.map((x) => x.feature),
    baseline_metrics,
    candidate_metrics,
    improvement: {
      brier: round(brierGain, 4),
      auc: round(aucDelta, 4),
      logloss: round(baseline_metrics.logloss - candidate_metrics.logloss, 4),
    },
    gate: { ...gate, brier_gain: round(brierGain, 4), auc_delta: round(aucDelta, 4), passed: accepted, stage: "validation" },
  };
}

/** Next semantic version string, e.g. rf-1.4.0 → rf-1.5.0. */
export function nextVersion(current: string | null | undefined): string {
  const m = /^rf-(\d+)\.(\d+)\.(\d+)$/.exec(current ?? "");
  if (!m) return "rf-1.1.0";
  return `rf-${m[1]}.${Number(m[2]) + 1}.0`;
}
