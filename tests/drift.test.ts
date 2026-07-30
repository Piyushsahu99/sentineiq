import { describe, it, expect } from "vitest";
import { computeDrift, psi, levelFor, MIN_SAMPLE } from "../src/lib/ml/rf-drift.server";
import parity from "../src/lib/ml/rf-parity.json";

const rows = (parity as any).rows as Array<{ x: number[]; p: number }>;
const asSnapshots = (r: typeof rows) =>
  r.map((row, i) => ({
    features: row.x,
    rf_probability: row.p,
    created_at: new Date(Date.now() - i * 60_000).toISOString(),
  }));

describe("PSI", () => {
  it("is zero for identical distributions", () => {
    expect(psi([0.5, 0.5], [0.5, 0.5])).toBe(0);
  });
  it("grows as distributions diverge", () => {
    const small = psi([0.5, 0.5], [0.45, 0.55]);
    const large = psi([0.5, 0.5], [0.05, 0.95]);
    expect(large).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(0);
  });
  it("maps to the standard bands", () => {
    expect(levelFor(0.05)).toBe("stable");
    expect(levelFor(0.15)).toBe("watch");
    expect(levelFor(0.4)).toBe("drifted");
  });
});

describe("computeDrift", () => {
  it("reports stable when live traffic matches the reference population", () => {
    const report = computeDrift(asSnapshots(rows));
    expect(report.sample_size).toBe(rows.length);
    expect(report.sufficient_data).toBe(true);
    expect(report.status).toBe("stable");
    expect(report.retrain_recommended).toBe(false);
    expect(report.overall_psi).toBeLessThan(0.1);
  });

  it("flags drift and recommends retraining when the population shifts", () => {
    // Force every cyber flag on and push probabilities to the top bucket.
    const shifted = asSnapshots(rows).map((s) => {
      const f = [...s.features];
      for (let i = 10; i <= 16; i++) f[i] = 1;
      f[0] = f[0] + 4; // amount_log shift
      f[3] = 1; f[6] = 12_000; // foreign + geo drift
      return { ...s, features: f, rf_probability: 0.97 };
    });
    const report = computeDrift(shifted);
    expect(report.status).toBe("drifted");
    expect(report.retrain_recommended).toBe(true);
    expect(report.drifted_features.length).toBeGreaterThanOrEqual(2);
    expect(report.prediction_psi).toBeGreaterThan(0.25);
    expect(report.notes).toMatch(/Retraining recommended/);
  });

  it("never recommends retraining on a thin sample", () => {
    const report = computeDrift(asSnapshots(rows).slice(0, MIN_SAMPLE - 1).map((s) => ({ ...s, rf_probability: 0.99 })));
    expect(report.sufficient_data).toBe(false);
    expect(report.retrain_recommended).toBe(false);
    expect(report.status).toBe("stable");
  });

  it("ignores malformed snapshots", () => {
    const report = computeDrift([{ features: [1, 2, 3], rf_probability: 0.5 } as any]);
    expect(report.sample_size).toBe(0);
  });
});
