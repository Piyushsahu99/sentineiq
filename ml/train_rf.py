"""SentinelQ Random Forest trainer.

Trains a calibrated RandomForest fraud classifier on a synthetic bank corpus
that mirrors PaySim / IEEE-CIS distributions and the 24-feature schema used by
the TypeScript rules engine. Exports a compact JSON model + metrics that ship
inside the app bundle (no Python at runtime).

Run:  python ml/train_rf.py
Outputs:
  src/lib/ml/rf-model.json     — tree arrays for TS inference
  src/lib/ml/rf-metrics.json   — ROC/AUC, PR-AUC, confusion, importances
  src/lib/ml/rf-parity.json    — held-out rows + probs for TS parity test
"""

from __future__ import annotations
import json, os, math, random
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
try:
    from sklearn.frozen import FrozenEstimator  # sklearn >= 1.6
except Exception:  # pragma: no cover
    FrozenEstimator = None  # type: ignore
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    roc_auc_score, average_precision_score, confusion_matrix,
    precision_recall_curve, roc_curve,
)

RNG = np.random.default_rng(42)
random.seed(42)

FEATURES = [
    "amount_log", "amount_zscore", "is_wire", "is_foreign", "is_offhours",
    "is_weekend", "geo_drift", "new_device", "untrusted_device", "device_count_30d",
    "vpn_flag", "tor_flag", "impossible_travel", "sim_swap", "mfa_fatigue",
    "malware_beacon", "phishing_recent", "credential_stuffing_count",
    "tx_velocity_1h", "tx_velocity_24h", "structuring_score", "dormant_days",
    "merchant_novelty", "quantum_hndl_exposure",
]

N_FEATURES = len(FEATURES)


def sample_row(kind: str) -> tuple[np.ndarray, int]:
    """Sample a single labeled feature vector. kind ∈ {normal, low, mid, high, block}."""
    f = np.zeros(N_FEATURES, dtype=np.float32)
    # base defaults
    amt = 50 + RNG.exponential(200)
    f[0] = math.log1p(amt)
    f[1] = RNG.normal(0, 0.6)
    f[2] = 0
    f[3] = 0
    hour = int(RNG.integers(6, 22))
    f[4] = 1 if hour < 5 else 0
    f[5] = 1 if RNG.random() < 0.28 else 0
    f[6] = 0
    f[7] = 1 if RNG.random() < 0.15 else 0
    f[8] = 0
    f[9] = int(RNG.integers(1, 4))
    # cyber
    f[10] = 0; f[11] = 0; f[12] = 0; f[13] = 0; f[14] = 0; f[15] = 0; f[16] = 0; f[17] = 0
    # velocity / behavioral
    f[18] = int(RNG.integers(0, 2))
    f[19] = int(RNG.integers(0, 5))
    f[20] = 0
    f[21] = int(RNG.integers(0, 45))
    f[22] = 1 if RNG.random() < 0.3 else 0
    f[23] = 0

    label = 0

    if kind == "normal":
        label = 0
    elif kind == "low":
        # small anomalies
        if RNG.random() < 0.5:
            f[10] = 1  # vpn
        if RNG.random() < 0.4:
            f[6] = RNG.uniform(300, 1500)
            f[3] = 1
        f[1] = abs(RNG.normal(1.0, 0.5))
        label = 0
    elif kind == "mid":
        amt = 1000 + RNG.exponential(3000)
        f[0] = math.log1p(amt)
        f[1] = abs(RNG.normal(2.2, 0.6))
        if RNG.random() < 0.6: f[7] = 1
        if RNG.random() < 0.5: f[10] = 1
        if RNG.random() < 0.3: f[4] = 1
        if RNG.random() < 0.4: f[3] = 1; f[6] = RNG.uniform(2000, 6000)
        if RNG.random() < 0.35: f[2] = 1
        label = 1 if RNG.random() < 0.35 else 0
    elif kind == "high":
        amt = 3000 + RNG.exponential(8000)
        f[0] = math.log1p(amt)
        f[1] = abs(RNG.normal(3.5, 0.8))
        f[2] = 1 if RNG.random() < 0.7 else 0
        f[3] = 1
        f[6] = RNG.uniform(3000, 9000)
        f[7] = 1
        f[8] = 1 if RNG.random() < 0.6 else 0
        f[10] = 1 if RNG.random() < 0.7 else 0
        f[12] = 1 if RNG.random() < 0.55 else 0
        f[14] = 1 if RNG.random() < 0.35 else 0
        f[16] = 1 if RNG.random() < 0.4 else 0
        f[17] = int(RNG.integers(0, 6))
        f[18] = int(RNG.integers(1, 5))
        f[20] = RNG.uniform(0, 1.2)
        label = 1 if RNG.random() < 0.85 else 0
    elif kind == "block":
        amt = 8000 + RNG.exponential(20000)
        f[0] = math.log1p(amt)
        f[1] = abs(RNG.normal(4.5, 1.0))
        f[2] = 1
        f[3] = 1
        f[6] = RNG.uniform(5000, 15000)
        f[7] = 1; f[8] = 1
        f[9] = int(RNG.integers(3, 8))
        # cyber kill chain
        f[10] = 1 if RNG.random() < 0.85 else 0
        f[11] = 1 if RNG.random() < 0.3 else 0
        f[12] = 1 if RNG.random() < 0.8 else 0
        f[13] = 1 if RNG.random() < 0.35 else 0
        f[14] = 1 if RNG.random() < 0.5 else 0
        f[15] = 1 if RNG.random() < 0.4 else 0
        f[16] = 1 if RNG.random() < 0.55 else 0
        f[17] = int(RNG.integers(3, 15))
        f[18] = int(RNG.integers(2, 8))
        f[19] = int(RNG.integers(5, 20))
        f[20] = RNG.uniform(0.5, 1.0)
        f[21] = int(RNG.integers(0, 15))
        f[23] = 1 if RNG.random() < 0.3 else 0
        label = 1

    # clip / cleanup
    return f, label


def build_dataset(n: int = 40000):
    """Class-balanced multi-band mixture."""
    mix = {"normal": 0.45, "low": 0.15, "mid": 0.15, "high": 0.15, "block": 0.10}
    X, y = [], []
    for kind, frac in mix.items():
        for _ in range(int(n * frac)):
            f, lab = sample_row(kind)
            X.append(f); y.append(lab)
    X = np.asarray(X, dtype=np.float32)
    y = np.asarray(y, dtype=np.int32)
    idx = RNG.permutation(len(y))
    return X[idx], y[idx]


def tree_to_json(tree):
    """Compact array-of-arrays for TS tree traversal."""
    t = tree.tree_
    # nodes as [feature, threshold, left, right, value_pos_prob]
    nodes = []
    for i in range(t.node_count):
        if t.children_left[i] == -1:  # leaf
            # value shape (1, n_classes) — take P(class=1)
            vals = t.value[i][0]
            total = float(vals.sum()) or 1.0
            prob1 = float(vals[1] / total) if len(vals) > 1 else 0.0
            nodes.append([-1, 0.0, -1, -1, round(prob1, 5)])
        else:
            nodes.append([
                int(t.feature[i]),
                round(float(t.threshold[i]), 5),
                int(t.children_left[i]),
                int(t.children_right[i]),
                0.0,
            ])
    return nodes


def export_forest(forest: RandomForestClassifier) -> list:
    return [tree_to_json(est) for est in forest.estimators_]


def bandFor(score: int) -> str:
    if score >= 85: return "Block"
    if score >= 70: return "High Risk"
    if score >= 50: return "Pending Review"
    if score >= 30: return "Monitor"
    return "Approved"


def main():
    print("[1/5] Building synthetic bank corpus (40k rows) ...")
    X, y = build_dataset(40000)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print(f"      train={len(ytr)}  test={len(yte)}  positives={int(y.sum())}")

    print("[2/5] Training RandomForest (300 trees, depth=10) ...")
    base = RandomForestClassifier(
        n_estimators=300, max_depth=10, min_samples_leaf=8,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    base.fit(Xtr, ytr)

    print("[3/5] Calibrating probabilities (isotonic) ...")
    # Calibrate on a held-out slice for real probabilities
    Xtr2, Xcal, ytr2, ycal = train_test_split(Xtr, ytr, test_size=0.2, random_state=1)
    base2 = RandomForestClassifier(
        n_estimators=300, max_depth=10, min_samples_leaf=8,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    base2.fit(Xtr2, ytr2)
    frozen = FrozenEstimator(base2) if FrozenEstimator is not None else base2
    cal = CalibratedClassifierCV(frozen, method="isotonic")
    cal.fit(Xcal, ycal)

    # Metrics on test
    prob_raw = base.predict_proba(Xte)[:, 1]
    prob_cal = cal.predict_proba(Xte)[:, 1]

    auc = float(roc_auc_score(yte, prob_cal))
    pr_auc = float(average_precision_score(yte, prob_cal))
    yhat = (prob_cal >= 0.5).astype(int)
    cm = confusion_matrix(yte, yhat).tolist()
    tn, fp, fn, tp = cm[0][0], cm[0][1], cm[1][0], cm[1][1]
    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = 2 * precision * recall / max(1e-9, precision + recall)
    accuracy = (tp + tn) / max(1, tp + tn + fp + fn)
    fpr = fp / max(1, fp + tn)

    print(f"      ROC-AUC={auc:.4f}  PR-AUC={pr_auc:.4f}  F1={f1:.4f}  FPR={fpr:.4f}")

    # Per-band accuracy on synthetic bands
    # map rf_score = round(prob * 100)
    rf_scores = np.round(prob_cal * 100).astype(int)
    bands = [bandFor(int(s)) for s in rf_scores]
    band_counts: dict[str, int] = {}
    for b in bands:
        band_counts[b] = band_counts.get(b, 0) + 1

    # Feature importances
    importances = list(map(float, base.feature_importances_))
    importance_pairs = sorted(zip(FEATURES, importances), key=lambda p: -p[1])

    print("[4/5] Exporting model to src/lib/ml/*.json ...")
    out_dir = Path(__file__).resolve().parent.parent / "src" / "lib" / "ml"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Export the CALIBRATED model. It wraps trees inside .calibrated_classifiers_[0].estimator
    # For simplicity + edge speed, we ship the RAW forest and apply a piecewise-linear
    # isotonic calibration table extracted from the calibrator.
    calibrator = cal.calibrated_classifiers_[0].calibrators[0]
    # isotonic: expose X_thresholds_ and y_thresholds_ (piecewise linear)
    iso_x = list(map(float, calibrator.X_thresholds_))
    iso_y = list(map(float, calibrator.y_thresholds_))

    model = {
        "version": 1,
        "features": FEATURES,
        "n_features": N_FEATURES,
        "trees": export_forest(base),
        "isotonic": {"x": iso_x, "y": iso_y},
    }
    with open(out_dir / "rf-model.json", "w") as f:
        json.dump(model, f, separators=(",", ":"))

    # ROC + PR curves (sampled to ~40 points each)
    fpr_c, tpr_c, _ = roc_curve(yte, prob_cal)
    pre_c, rec_c, _ = precision_recall_curve(yte, prob_cal)
    def sample(arr, k=40):
        if len(arr) <= k: return arr.tolist()
        idx = np.linspace(0, len(arr) - 1, k).astype(int)
        return arr[idx].tolist()

    metrics = {
        "trained_at": None,
        "n_train": int(len(ytr)),
        "n_test": int(len(yte)),
        "n_trees": 300,
        "max_depth": 10,
        "roc_auc": round(auc, 4),
        "pr_auc": round(pr_auc, 4),
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "fpr": round(fpr, 4),
        "confusion_matrix": cm,
        "band_distribution": band_counts,
        "top_importances": [
            {"feature": name, "importance": round(imp, 4)}
            for name, imp in importance_pairs[:15]
        ],
        "roc_curve": {"fpr": sample(fpr_c), "tpr": sample(tpr_c)},
        "pr_curve": {"precision": sample(pre_c), "recall": sample(rec_c)},
        "datasets": ["Synthetic bank corpus (PaySim-inspired distributions)"],
        "notes": "Calibrated RandomForest, 300 trees, depth=10. Isotonic probability calibration.",
    }
    with open(out_dir / "rf-metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("[5/5] Emitting parity fixture (200 held-out rows) ...")
    idx = RNG.choice(len(Xte), size=200, replace=False)
    parity = {
        "features": FEATURES,
        "rows": [
            {"x": Xte[i].tolist(), "p": float(prob_cal[i])}
            for i in idx
        ],
    }
    with open(out_dir / "rf-parity.json", "w") as f:
        json.dump(parity, f)

    print("\nDone.")
    print(f"  ROC-AUC:  {auc:.4f}")
    print(f"  PR-AUC:   {pr_auc:.4f}")
    print(f"  Accuracy: {accuracy:.4f}")
    print(f"  FPR:      {fpr:.4f}")
    print(f"  Top features: {[n for n,_ in importance_pairs[:5]]}")


if __name__ == "__main__":
    main()
