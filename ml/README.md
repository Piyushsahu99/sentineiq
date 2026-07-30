# SentinelQ Random Forest

Offline trainer that ships a calibrated RandomForest fraud classifier as JSON
into the app bundle. TypeScript inference runs on Cloudflare Workers — no
Python at runtime.

## Retrain

```bash
python -m pip install scikit-learn numpy
python ml/train_rf.py
```

Produces:
- `src/lib/ml/rf-model.json`   — tree arrays + isotonic calibration table
- `src/lib/ml/rf-metrics.json` — ROC/AUC, PR-AUC, confusion matrix, feature importances
- `src/lib/ml/rf-parity.json`  — 200 held-out rows for TS parity test

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
python ml/train_rf.py   # refreshes rf-parity.json
# then rebuild rf-baseline.json from the new parity rows
```
