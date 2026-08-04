# SentinelQ Random Forest

Offline trainer that ships a calibrated RandomForest fraud classifier as JSON
into the app bundle. TypeScript inference runs on Cloudflare Workers — no
Python at runtime.

## Retrain

```bash
python -m pip install scikit-learn numpy
python ml/train_rf.py
```

Trains on a 250,000-row synthetic bank corpus (200k train / 50k held-out test),
200 trees, depth 12. Produces:
- `src/lib/ml/rf-model.json`   — tree arrays + isotonic calibration table
- `src/lib/ml/rf-metrics.json` — ROC/AUC, PR-AUC, confusion matrix, feature importances
- `src/lib/ml/rf-parity.json`  — 400 held-out rows for TS parity test
- `src/lib/ml/rf-baseline.json` — 20k-row reference distribution for PSI drift monitoring

## Feature schema (24)

`amount_log, amount_zscore, is_wire, is_foreign, is_offhours, is_weekend,
geo_drift, new_device, untrusted_device, device_count_30d, vpn_flag,
tor_flag, impossible_travel, sim_swap, mfa_fatigue, malware_beacon,
phishing_recent, credential_stuffing_count, tx_velocity_1h, tx_velocity_24h,
structuring_score, dormant_days, merchant_novelty, quantum_hndl_exposure`

Mirrored in `src/lib/ml/rf-features.server.ts`.

## Runtime blend

`correlation-core.server.ts` combines rule score + RF probability:

```
composite = max(round(0.7 * rfDecisionScore + 0.3 * rulesScore),
                round(0.8 * rulesScore))
```

The Random Forest is the primary decider (70%). `rfDecisionScore` is a
monotone curve that maps the calibrated probability onto the 0-100 band
scale. Rule signals contribute 30% plus a soft review floor, so strong
analyst-facing evidence can never be scored all the way down to `Approved`
by a confident model — that keeps the decision auditable for regulated
banks without deterministic hard blocks.

## Drift monitoring

Every scored transaction writes its 24-feature vector + calibrated probability
to `model_feature_snapshots`. `src/lib/ml/rf-drift.server.ts` compares that live
population against `src/lib/ml/rf-baseline.json` (binned reference distribution
extracted from the held-out training rows) using the Population Stability Index:

- PSI < 0.10 → stable
- 0.10–0.25 → watch
- ≥ 0.25 → drifted

A scan is drifted (and `retrain_recommended`) when 2+ features, the prediction
distribution, or the mean feature PSI cross 0.25 over at least 30 scored
transactions. Results are stored in `model_drift_reports` and a notification is
raised. Run it from `/model-drift` in the app, or let the daily 07:00 UTC cron
job hit `/api/public/hooks/drift-scan`.

Regenerate the baseline after retraining:

```bash
python ml/train_rf.py   # also rewrites rf-parity.json and rf-baseline.json
```

## Automated retraining

The forest stays frozen; retraining fits an **adaptive overlay** on top of it
from recent labelled traffic (`src/lib/ml/rf-retrain.server.ts`):

```
logit(p_adj) = a · logit(p_rf) + b + Σ wⱼ · zⱼ      (z = standardised drifted feature)
p_final      = 0.85 · isotonic(p_adj) + 0.15 · p_adj
```

Workflow (`src/lib/retrain-core.server.ts`):

1. Pull `model_feature_snapshots` for the window and label them —
   analyst verdicts (weight 1.0) > investigation status (0.6) > settled
   transaction outcome (0.3).
2. Drift gate: skip unless the PSI scan says `retrain_recommended` (or `force`).
3. Fit `a`, `b`, `wⱼ` by weighted logistic descent + PAVA recalibration on a
   chronological 70/30 split.
4. Validate on the most recent hold-out: accept only when Brier improves ≥1%
   and ROC-AUC drops ≤0.01.
5. Persist to `model_versions` (`active` / `candidate` / `rejected`), retire the
   previous active version, and notify.

Scoring reads the active version through `rf-active.server.ts` (60s cache);
with no active row it serves the frozen base `rf-1.0.0`. Trigger it from
`/model-drift` (Run / Force retrain, Activate, Roll back to base) or let the
daily drift cron chain into it via `/api/public/hooks/drift-scan`;
`/api/public/hooks/retrain` runs it standalone.

Tests: `tests/retrain.test.ts`.
