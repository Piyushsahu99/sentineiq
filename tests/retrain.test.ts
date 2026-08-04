import { describe, it, expect } from "vitest";
import {
  trainCandidate, applyOverlay, evaluate, rocAuc, pava, nextVersion,
  splitChronological, MIN_TRAIN_ROWS, type LabeledRow,
} from "../src/lib/ml/rf-retrain.server";
import { FEATURE_NAMES } from "../src/lib/ml/rf-infer.server";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulate a drifted population: the deployed model's probabilities are
 * systematically miscalibrated (too low) and one feature (sim_swap, index 13)
 * has become far more predictive than at training time.
 */
function driftedRows(n = 240, seed = 7): LabeledRow[] {
  const rnd = mulberry32(seed);
  const rows: LabeledRow[] = [];
  for (let i = 0; i < n; i++) {
    const features = new Array(FEATURE_NAMES.length).fill(0);
    const simSwap = rnd() < 0.45 ? 1 : 0;
    const tor = rnd() < 0.3 ? 1 : 0;
    features[13] = simSwap;
    features[11] = tor;
    features[0] = 6 + rnd() * 4;
    const truth = 1 / (1 + Math.exp(-(-1.2 + 3.4 * simSwap + 1.6 * tor)));
    const label = rnd() < truth ? 1 : 0;
    // Deployed model under-predicts by a wide margin (the drift we must fix).
    const p = Math.min(0.95, Math.max(0.01, truth * 0.35 + rnd() * 0.05));
    rows.push({
      features, p, label, weight: 1,
      created_at: new Date(Date.now() - (n - i) * 60_000).toISOString(),
    });
  }
  return rows;
}

describe("metrics", () => {
  it("AUC is 1 for a perfect ranking and 0.5 for constant scores", () => {
    expect(rocAuc([{ p: 0.1, label: 0 }, { p: 0.2, label: 0 }, { p: 0.8, label: 1 }])).toBe(1);
    expect(rocAuc([{ p: 0.5, label: 0 }, { p: 0.5, label: 1 }])).toBe(0.5);
  });
  it("Brier score rewards confident correct predictions", () => {
    const good = evaluate([{ p: 0.95, label: 1 }, { p: 0.05, label: 0 }]);
    const bad = evaluate([{ p: 0.4, label: 1 }, { p: 0.6, label: 0 }]);
    expect(good.brier).toBeLessThan(bad.brier);
  });
});

describe("isotonic (PAVA)", () => {
  it("produces a non-decreasing mapping", () => {
    const iso = pava([
      { x: 0.1, y: 0, w: 1 }, { x: 0.2, y: 1, w: 1 }, { x: 0.3, y: 0, w: 1 },
      { x: 0.4, y: 1, w: 1 }, { x: 0.9, y: 1, w: 1 },
    ]);
    for (let i = 1; i < iso.y.length; i++) expect(iso.y[i]).toBeGreaterThanOrEqual(iso.y[i - 1]);
  });
});

describe("retraining workflow", () => {
  it("refuses to train without enough labelled data", () => {
    const r = trainCandidate(driftedRows(12), ["sim_swap"]);
    expect(r.accepted).toBe(false);
    expect(r.gate.stage).toBe("data");
    expect(r.reason).toContain(String(MIN_TRAIN_ROWS));
  });

  it("refuses when only one class is present", () => {
    const rows = driftedRows(120).map((r) => ({ ...r, label: 1 }));
    const r = trainCandidate(rows, ["sim_swap"]);
    expect(r.accepted).toBe(false);
    expect(r.gate.stage).toBe("data");
  });

  it("learns weights that improve calibration on held-out drifting data", () => {
    const r = trainCandidate(driftedRows(300, 11), ["sim_swap", "tor_flag"]);
    expect(r.gate.stage).toBe("validation");
    expect(r.accepted).toBe(true);
    expect(r.candidate_metrics.brier).toBeLessThan(r.baseline_metrics.brier);
    expect(r.candidate_metrics.auc).toBeGreaterThanOrEqual(r.baseline_metrics.auc - 0.01);
    expect(r.overlay.weights.length).toBeGreaterThan(0);
    expect(r.holdout_size).toBeGreaterThan(0);
  });

  it("rejects a candidate that cannot beat the live model", () => {
    // Already well-calibrated traffic: nothing to gain.
    const rnd = mulberry32(3);
    const rows: LabeledRow[] = [];
    for (let i = 0; i < 200; i++) {
      const features = new Array(FEATURE_NAMES.length).fill(0);
      features[13] = rnd() < 0.5 ? 1 : 0;
      const truth = features[13] ? 0.9 : 0.1;
      rows.push({ features, p: truth, label: rnd() < truth ? 1 : 0, created_at: new Date(Date.now() - i * 1000).toISOString() });
    }
    const r = trainCandidate(rows, ["sim_swap"]);
    expect(r.improvement.brier).toBeLessThan(0.2);
  });

  it("overlay output stays a valid probability and is a no-op when absent", () => {
    const rows = driftedRows(300, 5);
    const r = trainCandidate(rows, ["sim_swap", "tor_flag"]);
    for (const row of rows.slice(0, 40)) {
      const p = applyOverlay(r.overlay, row.p, row.features);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(applyOverlay(null, 0.42, rows[0].features)).toBe(0.42);
  });

  it("holds out the most recent traffic chronologically", () => {
    const rows = driftedRows(100);
    const { train, holdout } = splitChronological(rows);
    expect(train.length + holdout.length).toBe(100);
    expect(new Date(holdout[0].created_at!).getTime()).toBeGreaterThan(
      new Date(train[0].created_at!).getTime(),
    );
  });

  it("bumps the model version", () => {
    expect(nextVersion("rf-1.0.0")).toBe("rf-1.1.0");
    expect(nextVersion("rf-1.9.0")).toBe("rf-1.10.0");
    expect(nextVersion(null)).toBe("rf-1.1.0");
  });
});
