
# Random Forest upgrade for SentinelQ correlation engine

Goal: raise output quality to a level a real bank (Bank of Maharashtra) would accept. Keep the current rules engine (it guarantees hard blocks and explainability), add a trained Random Forest for the ambiguous middle band, and show the accuracy story on the About page.

## 1. Offline training pipeline (Python, not shipped to runtime)

New folder `ml/` at repo root:

- `ml/train_rf.py` — scikit-learn `RandomForestClassifier` (400 trees, `max_depth=12`, `class_weight="balanced"`, calibrated with `CalibratedClassifierCV` for real probabilities).
- `ml/datasets/` — download + adapter scripts for PaySim (Kaggle mirror, no auth) and IEEE-CIS subset. Both mapped into our feature schema.
- `ml/features.py` — single source of truth mapping raw tx + telemetry → feature vector; mirrored 1:1 in TS.
- `ml/export_model.py` — dumps a compact `model.json` (arrays of trees: split feature, threshold, left, right, value) + `metrics.json` (ROC/AUC, PR-AUC, confusion matrix, per-band accuracy, feature importances).
- `ml/README.md` — one-command retrain: `python ml/train_rf.py && python ml/export_model.py`.

Outputs committed to repo: `src/lib/ml/rf-model.json`, `src/lib/ml/rf-metrics.json`. No Python at runtime.

## 2. Feature vector (24 features)

Numeric + boolean, all derivable from current `loadContext`:
amount_log, amount_zscore_vs_baseline, is_wire, is_foreign, is_offhours, is_weekend, geo_drift_km, new_device, untrusted_device, device_count_30d, vpn_flag, tor_flag, impossible_travel, sim_swap, mfa_fatigue, malware_beacon, phishing_recent, credential_stuffing_count, tx_velocity_1h, tx_velocity_24h, structuring_score, dormant_days, merchant_novelty, quantum_hndl_exposure.

## 3. TS inference on the edge

New `src/lib/ml/rf-infer.server.ts`:
- Loads `rf-model.json` once (import-time constant).
- `buildFeatures(tx, ctx)` — mirrors `ml/features.py`, unit-tested against a snapshot.
- `rfProbability(features): number` — pure tree traversal, ~2ms for 400 trees, safe in Cloudflare Workers.

## 4. Hybrid scoring (blend, not replace)

In `src/lib/correlation-core.server.ts`, extend `scoreOnly`:

1. Run existing typed signals + combos → `rulesScore`, `hardBlock` flag, `contributors[]`.
2. Build features, call `rfProbability` → `rfProb` (0..1), map to `rfScore = round(rfProb * 100)`.
3. `composite = hardBlock ? max(85, rulesScore) : round(0.55 * rulesScore + 0.45 * rfScore)`.
4. Never downgrade a hard block. Escalators (SIM swap, full kill chain, Tor+wire) still force Block.
5. Add `rf_probability`, `rf_top_features` (top 5 by contribution via per-tree path attribution) to `risk_breakdown` JSON.

Bands stay 0–29 / 30–49 / 50–69 / 70–84 / 85–100.

## 5. Explanations + UI

- `ingest.functions.ts` narrative prompt now includes RF probability, calibrated confidence, and top RF feature contributions alongside rule contributors — Gemini already renders these.
- `src/routes/_app.explainable-ai.tsx` — new "Model Signals" card showing RF probability bar + top-5 feature contributions per investigation.
- `src/routes/about.tsx` — new "Model Performance" section rendered from `rf-metrics.json`: ROC-AUC, PR-AUC, confusion matrix (SVG), per-band accuracy, top-15 feature importances (bar chart). Add a short "Trained on PaySim + IEEE-CIS, ~1.2M rows, calibrated Random Forest, 400 trees" caption.

## 6. Regression tests

Extend `tests/correlation-accuracy.test.ts`:
- Keep all 21 existing cases → must still meet ≥95% within-1-band, 0 missed blocks, ≤2% FPR.
- Add 30 harder cases mined from PaySim edge patterns (cash-out chains, merchant collusion, dormant reactivation).
- New `tests/rf-inference.test.ts` — asserts TS tree traversal matches Python predictions on 200 held-out rows (loaded from `src/lib/ml/rf-parity.json`) within 1e-6.

## 7. Deliverables checklist

- [ ] `ml/` training pipeline + README
- [ ] `src/lib/ml/rf-model.json`, `rf-metrics.json`, `rf-parity.json`
- [ ] `src/lib/ml/rf-infer.server.ts`
- [ ] Updated `correlation-core.server.ts` with hybrid blend + hard-block guard
- [ ] Extended narrative + XAI card
- [ ] About page "Model Performance" section
- [ ] Test suite: ≥95% within-1-band, 0 missed blocks, <2% FPR, parity test passes

## Technical notes

- No Python runs on Cloudflare Workers. Model is a JSON of tree arrays; TS inference is a plain loop, no deps.
- Model file target size: ≤600 KB gzipped (prune trees, quantize thresholds to float32).
- If PaySim download is blocked in the sandbox, the script falls back to a deterministic synthetic generator seeded from our 20+ demo presets so retraining always works.
- Rules still own hard blocks — RF only shifts scores inside the gray zone. This preserves auditability that regulated banks require.
