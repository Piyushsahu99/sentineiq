
# Make the six expected outcomes actually work

Today the Correlation Engine scores a transaction against a few heuristics (amount, geo, channel, off‑hours, baseline, some telemetry counts, one IOC rule). The six "expected outcomes" the judges will look for are only partially represented, and several pages (Behavior, Explainable AI, Quantum, Threat Intel) still read mock data. This plan closes those gaps end‑to‑end using the existing Lovable Cloud stack — no new services.

## Scope (only what the outcome list requires)

1. **Correlate cyber telemetry ↔ transactions** — real join, not just counts.
2. **Proactive cyber threat detection** — telemetry-only correlation path (no tx needed).
3. **Fraud pattern detection** — velocity, structuring, new-beneficiary, device/geo drift.
4. **Quantum attack indicators** — Harvest-Now-Decrypt-Later + downgrade + weak-cipher signals.
5. **False-positive reduction** — analyst feedback loop + suppression rules + confidence calibration.
6. **Explainable AI** — every alert carries typed contributors with weights + LLM narrative grounded in the same evidence.

## Backend changes (migrations + server fns)

**Schema (migration, with GRANTs + RLS):**
- `detection_rules(id, kind, name, weight, params jsonb, enabled)` — seeded with the rule catalog below.
- `analyst_feedback(id, alert_id, verdict enum['true_positive','false_positive','benign'], notes, user_id, created_at)` — writable by analysts.
- `suppressions(id, scope jsonb, reason, created_by, expires_at)` — auto-created from repeated FP feedback.
- Extend `ai_investigations` with `explanation jsonb` (typed contributor tree) and `calibrated_confidence numeric`.
- Extend `quantum_assets` seed with `hndl_exposure`, `downgrade_observed`, `weak_cipher` flags used by the quantum detector.

**`src/lib/correlation.functions.ts` — rewrite as a rule pipeline:**
Replace the current inline heuristics with a typed pipeline that runs on either a `transactionId` OR a `telemetryWindow` (proactive path):

```
Signal[] = [
  fraud.amount_zscore, fraud.velocity_1h, fraud.structuring_9k,
  fraud.new_beneficiary, fraud.geo_impossible_travel, fraud.device_change,
  cyber.credential_stuffing (auth telemetry burst),
  cyber.mfa_fatigue, cyber.impossible_login, cyber.malware_beacon (DNS/endpoint),
  cyber.phishing_click (email + url IOC),
  xcorr.cyber_precedes_tx (auth anomaly on same customer within 30m of tx),
  xcorr.ioc_touches_tx_channel,
  quantum.hndl_exposed_asset_touched,
  quantum.tls_downgrade_on_session,
  quantum.weak_cipher_on_payment_endpoint,
]
```
Each signal returns `{ id, kind, weight, evidence[], confidence }`. Composite = calibrated sum minus active suppressions. Persist the full tree into `ai_investigations.explanation` so Explainable AI reads real data.

**New server fns:**
- `runProactiveScan()` — sweeps last 15 min of telemetry, emits alerts with no transaction attached.
- `submitFeedback({alertId, verdict, notes})` — writes `analyst_feedback`; on 3× FP for the same rule+entity in 7d, inserts a `suppressions` row and lowers that rule's effective weight for that entity.
- `getExplanation({investigationId})` — returns the stored contributor tree; Copilot server fn already grounded on live data now also receives this tree so narratives cite the same evidence IDs.

## Frontend wiring (swap mock → live)

- **Correlation page** — already live; render new signal `kind` groups (fraud / cyber / xcorr / quantum) as colored lanes.
- **Explainable AI page** — read `explanation` tree; per-contributor bar chart with weight + evidence rows + "Ask Copilot about this signal" button (calls `askCopilot` with the contributor id).
- **Behavior page** — swap mock to `sessions` + `devices` + velocity/impossible-travel signals from the pipeline.
- **Threat Intel page** — keep OSM map; overlay live `iocs` + `threat_intel` rows and mark ones that fired via `xcorr.ioc_touches_tx_channel`.
- **Quantum page** — read `quantum_assets`; show HNDL exposure score, downgrade events, and any alerts produced by the quantum detectors.
- **Alerts page** — add Verdict buttons (TP / FP / Benign) calling `submitFeedback`; show suppression badge when a rule is currently suppressed for that entity.

## Deterministic demo

Extend `seedDeterministic({scenario})` with two new presets so judges can trigger each outcome on demand:
- `cyber_first` — auth burst + impossible login + malware beacon → proactive alert with no tx.
- `quantum` — TLS downgrade + weak cipher on a payment endpoint touching an HNDL-exposed asset → quantum alert.
Keep existing `high_risk` preset for the fraud+xcorr path (composite 89).

## Out of scope

- Real SIEM ingestion, real MFA, SSO providers beyond Google, PDF template polish, FastAPI sidecar. Say the word if you want any of these next.

## Technical details

- All new tables get `GRANT` + RLS + `is_analyst()` policies in the same migration.
- Pipeline runs inside `correlateTransaction` / `runProactiveScan` server fns behind `requireSupabaseAuth` + analyst check.
- Suppression + feedback affect the *next* score; historical alerts stay immutable.
- `explanation` JSON schema: `{ signals: [{id, kind, weight, confidence, evidence: [{source, ref_id, ts, note}]}], composite, calibrated_confidence, suppressed: [...] }`.
- Copilot prompt is extended to include the `explanation` tree so answers cite `signal.id` — no free-form hallucination.

Approve and I'll execute in this order: migration → pipeline rewrite → proactive scan + feedback fns → page rewires → new seed presets → run smoke script.
