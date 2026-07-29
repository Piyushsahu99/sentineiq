# RF-dominant correlation engine

Shift the correlation engine from rules-first to Random Forest-first. Rules stay only as feature contributors and explainability aids — they no longer gate the verdict, and hard blocks are removed per your call.

## Changes

### 1. `src/lib/correlation-core.server.ts` — rewrite scoring block
- Keep signal detection (rules) intact — they still populate `contributors[]` and `evidence` so the UI stays explainable.
- Replace the blend:
  - Old: `composite = hardBlock ? max(88, rulesScore) : round(0.55*rules + 0.45*rf)`
  - New: `composite = round(0.80 * rfScore + 0.20 * rulesScore)` (RF-dominant, matches your 80/20 choice)
- Remove `hardBlock` short-circuit and the escalator overrides (SIM swap / kill chain / Tor+wire no longer force Block on their own — RF decides).
- Band still derived from `composite` using the existing 0–29 / 30–49 / 50–69 / 70–84 / 85–100 thresholds.
- `risk_breakdown` JSON: keep `rf_probability`, `rf_top_features`, `rules_score`, drop `hard_block` flag; add `weights: { rf: 0.8, rules: 0.2 }` so audits can see the mix.

### 2. `src/lib/ingest.functions.ts` — narrative prompt
- Reword the Gemini prompt: lead with "Random Forest classifier scored this X%, calibrated confidence Y%". Rule contributors are described as "supporting feature signals", not "the reason for the block".

### 3. `src/routes/about.tsx` — Model Performance section
- Update copy: "Random Forest is the primary decider (80% weight). Rule-based signals contribute 20% and provide human-readable explanations." Remove any "hard-block guarantee" language.

### 4. `src/routes/_app.explainable-ai.tsx`
- Reorder the investigation panel so the RF probability bar + top-5 features render first, rule contributors second.

### 5. `tests/correlation-accuracy.test.ts`
- Rebalance expectations: with rules only 20% of the score, some previously-hard-blocked cases will land in High Risk (70–84) instead of Block (85+). Update those case expectations. Keep the ≥95% within-1-band bar; drop the "0 missed blocks" assertion since deterministic blocks are gone (replace with "RF probability ≥ 0.8 → composite ≥ 70" sanity check).

## Not doing
- No retraining, no new model file, no LLM correlator (per your answers).
- Signal detection code, knowledge-graph writes, and UI shells untouched.

## Technical notes
- Weight change is a two-line edit; the ripple is in tests and copy.
- Removing hard blocks means a SIM-swap-only signal (rules ≈ 55, rf ≈ 0.3) will now score ~50 instead of forced 88. This is the tradeoff you approved.
