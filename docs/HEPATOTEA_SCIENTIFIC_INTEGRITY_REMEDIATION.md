# HEPATOTEA Scientific Integrity Remediation

**Date:** 2026-11-11  
**Reference audit:** [`HEPATOTEA_SCIENTIFIC_VALIDATION_AUDIT.md`](./HEPATOTEA_SCIENTIFIC_VALIDATION_AUDIT.md)  
**Contract:** [`STUDY_DESIGN_CONTRACT.md`](./STUDY_DESIGN_CONTRACT.md)  
**Preserved revision:** [`HEPATOTEA_REVISION_01_DPPH_HIPPO_YAP_FIX.md`](./HEPATOTEA_REVISION_01_DPPH_HIPPO_YAP_FIX.md)

---

## 1. Confirmed root causes (re-verified before coding)

| ID | Still present before this remediation? | Evidence |
|----|----------------------------------------|----------|
| P0-1 BAX populations / multi-marker | Yes | `bax.ts` derived viable/early/late/necrotic + BCL-2/caspase from one Hill |
| P0-2 Docking drives MTT/LDH/ROS/BAX | Yes | `prototypeFactor` averaged docking affinity |
| P0-3 Silent prototype on Run | Yes | API `mode: "prototype"` without acknowledgement; UI always used it |
| P1-1 LDH Predicted OD | Yes | `0.12 + 0.9*(%)` AU |
| P1-2 MTT Selectivity index | Yes | `250/midpoint` |
| P1-3 DPPH TEAC | Yes | `maximum/100` labeled TEAC |
| P1-4 IC50 = Hill midpoint | Yes | Output key `IC50` |
| P1-5/6 LDH controls / MTT cytotoxicity wording | Yes (wording + missing experimental structure in prototype) | UI heroes / LDH sim |
| P2 transparency | Yes | Generic assumptions, “Computational prediction”, progress “Querying bioactivity model” |

Revision 01 DPPH↔Hippo separation was intact and **preserved**.

---

## 2. Files modified

| File | Change |
|------|--------|
| `lib/predictions/prototype/math.ts` | `exploratoryIdentityFactor` (no docking); `prototypeFactor` alias without docking |
| `lib/predictions/prototype/types.ts` | `Exploratory simulation` / `exploratory-v1`; `PrototypeUnavailableResult` |
| `lib/predictions/prototype/dpph.ts` | Rename TEAC/IC50; keep docking-free antioxidant factor |
| `lib/predictions/prototype/mtt.ts` | Identity-only; metabolic labels; remove SI |
| `lib/predictions/prototype/ldh.ts` | Identity-only; remove Predicted OD; membrane-damage index |
| `lib/predictions/prototype/ros.ts` | Identity-only; remove mitochondrial ΔΨm-like score |
| `lib/predictions/prototype/bax.ts` | Remove populations/BCL-2/caspase; unavailable without target; context index only |
| `lib/predictions/prototype/hippo-yap.ts` | Exploratory modelName; Rev01 logic kept |
| `lib/predictions/prototype/index.ts` | Returns `PrototypeRunResult` |
| `lib/predictions/store.ts` | Do not promote IC50/TEAC/SI summaries |
| `app/api/scientific/predictions/route.ts` | Validated vs exploratory modes; acknowledgement required |
| `components/study/BiologicalPredictionsWorkspace.tsx` | Confirm dialog; docking only for Hippo features; banners; copy; chart titles |
| `lib/predictions/prototype/prototype.test.ts` | Integrity tests |
| `lib/predictions/predictionApi.mode.test.ts` | Mode contract tests |
| `docs/HEPATOTEA_SCIENTIFIC_VALIDATION_AUDIT.md` | Implementation status section |
| `docs/HEPATOTEA_SCIENTIFIC_INTEGRITY_REMEDIATION.md` | This document |

**Unchanged (intentionally):** Research Setup, ADME, docking worker, laboratory `derivedAssays.ts` experimental formulas, ANOVA/Scheffé, comparison engines, AI assistant, DB schema.

---

## 3. Corrections implemented

### P0

1. **Docking independence:** MTT/LDH/ROS/BAX use `exploratoryIdentityFactor` (compound/cell/target identity only). Feature assembly sends docking **only** for Hippo–YAP.
2. **BAX:** Removed viable/early/late/necrotic %, BCL-2, caspase, BAX/BCL-2 ratio. Retained only exploratory BAX-target context index. Unavailable without `targetProteinIds`.
3. **Simulation gate:** API default/validated mode returns `not_configured` (404) when models are null. Exploratory requires `mode: "exploratory_simulation"` **and** `acknowledgeExploratory: true`. UI confirmation dialog before run.

### P1

1. **LDH:** Removed Predicted OD; exploratory membrane-damage index only; experimental formula remains in Laboratory.
2. **MTT:** Removed Selectivity Index; metabolic viability terminology; Hill midpoint labeled exploratory.
3. **DPPH:** TEAC → “Exploratory maximum response ratio”; IC50 → “Exploratory Hill midpoint (µM)”; docking independence preserved.
4. **ROS:** Removed mitochondrial response score; relative ROS index labeled not fluorescence.

### P2

1. Endpoint-specific assumptions for MTT/LDH/ROS/BAX.  
2. Method string → “Exploratory simulation”.  
3. MTT/LDH/ROS banners; BAX copy corrected.  
4. Progress text no longer “Querying bioactivity model”.  
5. Chart titles/units per endpoint; SIMULATION badge retained.

---

## 4. Removed or renamed metrics

| Old | New / disposition |
|-----|-------------------|
| TEAC | Exploratory maximum response ratio (not TEAC) |
| IC50 (DPPH/MTT) | Exploratory Hill midpoint (… not fitted IC50) |
| Selectivity index (MTT) | **Removed** |
| Predicted OD (LDH) | **Removed** |
| LDH release / Cytotoxicity % (prototype) | Exploratory membrane-damage index |
| Mitochondrial response (ROS) | **Removed** |
| BAX/BCL-2/caspase/populations | **Removed** |
| BAX response fold | Exploratory BAX-target context response (index) |

---

## 5. Experimental vs simulation behavior

| Path | Behavior |
|------|----------|
| Validated prediction API | `runPrediction` → `not_configured` (all models null) |
| Exploratory simulation API | Requires acknowledgement; returns `SIMULATION` or `unavailable` |
| Laboratory DPPH/LDH/MTT derivation | Unchanged experimental absorbance formulas in `lib/lab/derivedAssays.ts` |
| Persistence | Exploratory runs stored as `exploratory_math` + `SIMULATION`; unavailable results **not** stored |

---

## 6. Model availability behavior

- `hasPredictionModel(*) === false` for all six endpoints.  
- UI states: no validated model registered; confirmation required for exploratory run.  
- Hippo–YAP may still use docking affinities **only** as labeled pathway-engagement proxies (Rev01).

---

## 7. Tests performed

```bash
npx tsx --tsconfig tsconfig.json --test \
  lib/predictions/prototype/prototype.test.ts \
  lib/predictions/engine.test.ts \
  lib/predictions/modules.test.ts \
  lib/predictions/predictionApi.mode.test.ts \
  lib/lab/derivedAssays.test.ts
```

**Result:** 52 passed / 0 failed  
**Typecheck:** `tsc --noEmit` clean after UI payload typing fix

---

## 8. Remaining scientific limitations

- Exploratory identity/Hill curves are still **not** validated QSAR or assay models.  
- DPPH physchem heuristics remain weak proxies.  
- Hippo docking→pathway proxies remain exploratory.  
- Treatment duration still not in prediction features (P2-4 open).  
- Spec `outputLabels` in `lib/predictions/*.ts` may still list aspirational metrics (P3).  
- Historical DB rows generated before this remediation may still contain old keys (TEAC, Predicted OD, populations) — see §9.

---

## 9. Historical data considerations

**Do not delete research records.**

Recommended safe strategy:

1. Leave historical `biological_predictions` rows intact.  
2. Ask researchers to **re-run exploratory simulations** (with acknowledgement) for active studies so new labels/metrics replace subject-matched runs via `updatePredictionRun`.  
3. Optional later audit query: flag rows whose `input_parameters` contain `output:Predicted OD`, `output:TEAC`, `output:Early apoptotic`, or `output:Selectivity index`.  
4. No schema migration required for this remediation.

---

## 10. Items needing researcher / domain-expert approval

1. Whether exploratory simulations should remain available at all once acknowledgement exists, or be disabled entirely until validated models are registered.  
2. Whether Hippo–YAP should continue using docking as a pathway proxy.  
3. Whether any residual BAX-target context index should be removed in favor of unavailable-only until expression assays exist.  
4. Archival / UI banner policy for pre-remediation stored runs.
