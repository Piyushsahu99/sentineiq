// Server-only Random Forest inference for the SentinelQ correlation engine.
// The model JSON is trained offline in ml/train_rf.py and imported at build time —
// no Python at runtime, safe in Cloudflare Workers.

import model from "./rf-model.json";

// Node: [feature, threshold, left, right, leaf_prob]. Leaf if feature === -1.
type TreeNode = [number, number, number, number, number];
type Tree = TreeNode[];

const TREES: Tree[] = (model as any).trees as Tree[];
const ISO_X: number[] = (model as any).isotonic.x;
const ISO_Y: number[] = (model as any).isotonic.y;
export const FEATURE_NAMES: string[] = (model as any).features;
export const N_FEATURES: number = (model as any).n_features;

function traverse(tree: Tree, x: Float32Array | number[]): number {
  let i = 0;
  // Guard against pathological loops
  for (let step = 0; step < 128; step++) {
    const node = tree[i];
    if (node[0] === -1) return node[4];
    i = x[node[0]] <= node[1] ? node[2] : node[3];
  }
  return tree[i][4];
}

function isotonicApply(p: number): number {
  // Piecewise-linear interpolation over the isotonic knots.
  if (ISO_X.length === 0) return p;
  if (p <= ISO_X[0]) return ISO_Y[0];
  if (p >= ISO_X[ISO_X.length - 1]) return ISO_Y[ISO_Y.length - 1];
  // binary search
  let lo = 0, hi = ISO_X.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ISO_X[mid] <= p) lo = mid; else hi = mid;
  }
  const x0 = ISO_X[lo], x1 = ISO_X[hi];
  const y0 = ISO_Y[lo], y1 = ISO_Y[hi];
  if (x1 === x0) return y0;
  return y0 + ((p - x0) * (y1 - y0)) / (x1 - x0);
}

/** Raw forest probability (mean over trees). Public for parity tests. */
export function rfRawProbability(x: Float32Array | number[]): number {
  let sum = 0;
  for (const t of TREES) sum += traverse(t, x);
  return sum / TREES.length;
}

/** Calibrated probability (isotonic-corrected). Use this for scoring. */
export function rfProbability(x: Float32Array | number[]): number {
  return isotonicApply(rfRawProbability(x));
}

/** Per-feature contribution estimate: mean split gain along each tree path. */
export function rfTopFeatures(x: Float32Array | number[], k = 5): Array<{ feature: string; contribution: number }> {
  const contrib = new Array<number>(N_FEATURES).fill(0);
  for (const tree of TREES) {
    let i = 0;
    let parentProb = tree[0][0] === -1 ? tree[0][4] : 0.5;
    for (let step = 0; step < 128; step++) {
      const node = tree[i];
      if (node[0] === -1) break;
      const nextIdx = x[node[0]] <= node[1] ? node[2] : node[3];
      const nextNode = tree[nextIdx];
      const nextProb = nextNode[0] === -1 ? nextNode[4] : (tree[nextNode[2]][4] + tree[nextNode[3]][4]) / 2;
      contrib[node[0]] += nextProb - parentProb;
      parentProb = nextProb;
      i = nextIdx;
    }
  }
  const scaled = contrib.map((v, i) => ({ feature: FEATURE_NAMES[i], contribution: v / TREES.length }));
  return scaled
    .filter((f) => Math.abs(f.contribution) > 1e-4)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, k)
    .map((f) => ({ feature: f.feature, contribution: Math.round(f.contribution * 1000) / 1000 }));
}
