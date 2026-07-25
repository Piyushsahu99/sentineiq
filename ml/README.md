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
composite = hardBlock ? max(88, rulesScore)
                      : round(0.55 * rulesScore + 0.45 * rfScore)
```

Hard-block signals (SIM swap, malware C2, full kill chain) still force
`Block` regardless of RF probability — RF only shifts scores in the gray
zone. This preserves auditability for regulated banks.
