# HEPATOTEA – Final Scientific Integrity Verification Audit

**Audit type:** Independent READ-ONLY verification  
**Date:** 2026-11-11  
**Claims under review:** [`HEPATOTEA_SCIENTIFIC_INTEGRITY_REMEDIATION.md`](./HEPATOTEA_SCIENTIFIC_INTEGRITY_REMEDIATION.md) · status table in [`HEPATOTEA_SCIENTIFIC_VALIDATION_AUDIT.md`](./HEPATOTEA_SCIENTIFIC_VALIDATION_AUDIT.md)  
**Contract:** [`STUDY_DESIGN_CONTRACT.md`](./STUDY_DESIGN_CONTRACT.md)  

**Rules followed:** No application code, schema, records, or calculation changes. Statuses require source evidence (and tests where available). Documentation alone is insufficient for `VERIFIED FIXED`.

**Status vocabulary**

| Status | Meaning |
|--------|---------|
| **VERIFIED FIXED** | Confirmed in current source and supported by automated tests and/or unambiguous runtime path inspection |
| **PARTIALLY VERIFIED** | Core fix present, but important gaps remain (UI/history/docs/persistence) |
| **NOT FIXED** | Issue still present in live path |
| **NOT VERIFIABLE** | Cannot confirm without runtime DB state, browser E2E, or unavailable environment |

---

## 1. Executive Summary

The remediation **is largely implemented in source**. P0 docking independence, BAX de-fabrication, API/UI exploratory consent, and P1 metric/label corrections are present in the prototype engines, store, API route, and Biological Predictions workspace. Automated integrity tests **pass (52/52)** for the prediction + lab suites executed in this verification.

HEPATOTEA is **ready for researcher acceptance testing of the exploratory-simulation UX and laboratory experimental paths**, with clear caveats:

1. Modules remain **exploratory simulations**, not validated predictive models.  
2. **Historical** `biological_predictions` rows may still display old TEAC / SI / fabricated output keys via legacy UI fallbacks.  
3. Acknowledgement is enforced at API/UI time but **not persisted as a dedicated per-run consent field**.  
4. Spec `outputLabels` (especially BAX) and root `README.md` still describe outdated/aspirational behavior.  
5. Treatment duration remains absent; DPPH HBD/TPSA usually do not flow from normalized ADME descriptors.

**Blocking for “validated prediction” claims:** none of the six engines has a registered model (`*Model = null`). That is correct behavior under the remediation, not a regression.

---

## 2. Verification Matrix

### P0

| ID | Claim | Status | Evidence summary |
|----|-------|--------|------------------|
| **P0-1** | BAX no fabricated populations / BCL-2 / caspase | **VERIFIED FIXED** (new path) · **PARTIALLY VERIFIED** (legacy display) | `simulateBax` outputs only context index + Hill midpoint; unavailable without targets. Tests assert absence of populations/markers. Spec `baxSpec.outputLabels` still lists populations. Historical `input_parameters` / `storedOutputs` can still surface old keys if present in DB. |
| **P0-2** | Docking does not drive MTT/LDH/ROS/BAX; DPPH independent; Hippo docking-as-proxy OK | **VERIFIED FIXED** | `exploratoryIdentityFactor` omits docking; `prototypeFactor` aliases it; `featuresForSubject` sets `includeDocking` only for `hippo_yap`. Tests prove docking affinity changes do not alter MTT/LDH/ROS/BAX/DPPH; Hippo remains affinity-sensitive. |
| **P0-3** | Explicit exploratory consent; validated never falls back | **PARTIALLY VERIFIED** | API requires `acknowledgeExploratory === true` for exploratory modes; default/validated returns 404 `not_configured`. UI confirmation dialog + sends acknowledgement. **Gaps:** consent not stored on the run (`meta:acknowledge*` absent); confirm dialog is batch-generic; no HTTP route integration test; empty-state copy still says “Run Prediction”. |

### P1

| ID | Claim | Status | Evidence summary |
|----|-------|--------|------------------|
| **P1-1** | No LDH Predicted OD | **VERIFIED FIXED** (new) · **PARTIALLY VERIFIED** (legacy) | `ldh.ts` has no OD output; tests assert absence. Historical rows / generic display of old `output:Predicted OD` possible. |
| **P1-2** | No MTT fabricated SI | **VERIFIED FIXED** (new) · **PARTIALLY VERIFIED** (legacy) | SI removed from `mtt.ts`. UI `storedOutputs` still renders `run.selectivityIndex` if old DB value exists. |
| **P1-3** | No uncalibrated TEAC label | **VERIFIED FIXED** (new) · **PARTIALLY VERIFIED** (legacy) | DPPH uses “Exploratory maximum response ratio (not TEAC)”. `storedOutputs` still labels `run.teac` as “TEAC” for legacy rows. |
| **P1-4** | Hill midpoint not presented as fitted IC50 | **VERIFIED FIXED** (new) · **PARTIALLY VERIFIED** (legacy) | Output keys/units say “not fitted IC50”; store no longer promotes `summaryIc50`. Legacy `summaryIc50` still displays as “IC50” via `storedOutputs`. |
| **P1-5** | Experimental LDH needs spont/max controls | **VERIFIED FIXED** | `deriveExperimentalResults("ldh")` requires T1 & T2; zero/missing denominator skips derivation. Lab tests cover missing controls. Prototype LDH is separate and does not claim experimental %. |
| **P1-6** | MTT metabolic viability terminology | **VERIFIED FIXED** | HERO, banners, metric `exploratory_metabolic_viability`, assumptions deny definitive cell death. |

### P2 / P3

| ID | Topic | Status | Evidence summary |
|----|-------|--------|------------------|
| **P2-1** | Endpoint-specific assumptions | **VERIFIED FIXED** | Dedicated `*_ASSUMPTIONS` in dpph/mtt/ldh/ros/bax/hippo-yap |
| **P2-2** | Method = Exploratory simulation | **VERIFIED FIXED** | `finishPrototype` sets method/version; store `source`/`methodType` |
| **P2-3** | MTT/LDH/ROS banners | **VERIFIED FIXED** | Present in `BiologicalPredictionsWorkspace` |
| **P2-4** | Treatment duration | **NOT FIXED** | No `duration`/`incubation`/`treatmentDuration` on prediction domain models or features (repo-wide TS search) |
| **P2-5** | DPPH HBD/TPSA path | **PARTIALLY VERIFIED** | `numericDescriptor` can read HBD/TPSA **if** present on `admeDescriptors`; ADME normalize **intentionally excludes** physchem from descriptor map (`normalize.ts` comment). Workspace passes `admet.descriptors` only — so HBD/TPSA usually missing; factor falls back to identity/MW/formula/name without disclosing “descriptor missing” as a first-class flag |
| **P2-6** | Progress not “Querying bioactivity model” | **VERIFIED FIXED** | Stages say exploratory demonstration language |
| **P3-1** | Spec outputLabels vs actual outputs | **NOT FIXED** | e.g. `lib/predictions/bax.ts` still lists BCL-2, caspase, populations; Hippo/MTT specs also aspirational |
| **P3-2** | README / study docs drift | **NOT FIXED** | `README.md` still Firebase / import-only docking narrative |
| **P3-3** | Chart titles/units | **VERIFIED FIXED** (workspace charts) | Endpoint-specific titles + metric/unit caption for completed sims |

---

## 3. Source files and functions inspected

| Area | Paths / symbols |
|------|-----------------|
| Shared math | `lib/predictions/prototype/math.ts` — `exploratoryIdentityFactor`, `prototypeFactor`, `numericDescriptor` |
| Engines | `prototype/{dpph,mtt,ldh,ros,bax,hippo-yap}.ts`, `prototype/index.ts`, `prototype/types.ts` |
| Validated engine | `lib/predictions/engine.ts`, `lib/predictions/{dpph,mtt,ldh,ros,bax,hippo-yap}.ts` (`*Model = null`) |
| Persistence | `lib/predictions/store.ts` — `storedSimulationFromPrototype` |
| API | `app/api/scientific/predictions/route.ts` |
| UI | `components/study/BiologicalPredictionsWorkspace.tsx` — `featuresForSubject`, `executePrediction`, `requestExploratoryRun`, confirm dialog, banners, `storedOutputs`/`simulationOutputs` |
| Lab | `lib/lab/derivedAssays.ts` (+ tests) |
| ADME physchem path | `lib/adme/normalize.ts`, PubChem client fields in `lib/scientific/pubchem.ts` |
| Docs claims | remediation + validation audit status tables, `README.md` |

### Docking dependency path check (P0-2)

Possible paths examined:

1. Factor function → **no docking** for MTT/LDH/ROS/BAX/DPPH.  
2. Feature assembly → docking array empty except Hippo.  
3. `inputFeatureLines` may still *list* docking if present on features, but Hippo-only assembly prevents that for assay endpoints.  
4. API still accepts client-supplied docking JSON, but MTT/LDH/ROS/BAX engines ignore `features.docking` in factor math; DPPH uses `antioxidantPotencyFactor` without docking. **Confirmed:** changing docking affinity cannot change those outputs even if a malicious client sends docking in the payload (unit-tested for factor/outputs).

Hippo: `hippoPathwayEngagement` still uses affinity — allowed as exploratory proxy; assumptions deny WB/qPCR proof.

### Consent path check (P0-3)

| Step | Behavior |
|------|----------|
| UI Run | `requestExploratoryRun` → modal → `runJobs` → `acknowledgeExploratory: true` |
| API exploratory without ack | 400 `acknowledgement_required` |
| API validated / default | `runPrediction` → 404 `not_configured` (models null); **no** prototype fallback |
| Persist | `SIMULATION`, `exploratory_math`, `meta:method`, assumptions — **no** `meta:acknowledgedExploratory` / timestamp / actor consent field |

---

## 4. Laboratory experimental workflows

| Check | Status | Notes |
|-------|--------|-------|
| Experimental DPPH formula separate from prototype | **VERIFIED FIXED** | `(A_control − A_sample)/A_control×100`; T1 required |
| Experimental LDH formula + controls | **VERIFIED FIXED** | Spont T1 + max T2; zero denom skipped |
| Missing controls safe | **VERIFIED FIXED** | Covered by `derivedAssays.test.ts` |
| Prototype cannot overwrite experimental class | **VERIFIED FIXED** | Different modules/tables/evidence paths; store forces SIMULATION for prototypes |
| IC50 not auto-fitted in lab derivation | **VERIFIED FIXED** | Explicit comment + no fit in `derivedAssays.ts` |

Experimental DPPH/LDH laboratory processing is **ready for researcher use** relative to the contract formulas inspected here.

---

## 5. Automated verification

### Commands executed

```bash
npx tsx --tsconfig tsconfig.json --test \
  lib/predictions/prototype/prototype.test.ts \
  lib/predictions/engine.test.ts \
  lib/predictions/modules.test.ts \
  lib/predictions/predictionApi.mode.test.ts \
  lib/lab/derivedAssays.test.ts
```

### Results

| Suite focus | Result |
|-------------|--------|
| Prototype integrity (docking independence, DPPH/MTT/LDH/ROS/BAX/Hippo, cross-endpoint) | Pass |
| Engine not_configured | Pass |
| Modules / evidence gates / filters | Pass |
| Mode contract unit tests | Pass |
| Lab derived assays | Pass |
| **Totals** | **52 passed / 0 failed / 0 skipped** |

### Coverage vs scientific-integrity requirements

| Requirement | Covered by tests? |
|-------------|-------------------|
| Docking independence MTT/LDH/ROS/BAX/DPPH | Yes |
| BAX no populations / markers; unavailable without target | Yes |
| No TEAC/IC50/SI/Predicted OD in new prototype outputs | Yes |
| Hippo Rev01 isolation + docking sensitivity | Yes |
| Lab missing controls | Yes |
| Validated models null | Yes |
| API HTTP acknowledgement enforcement | **No** (logic inspected; no Next route HTTP test) |
| UI dialog / badge / banners | **No E2E** (source inspected) |
| Historical row display sanitization | **No** |
| HBD/TPSA end-to-end from PubChem→features | **No** |
| Treatment duration | N/A (absent) |

Browser E2E and live DB inspection were **not** run in this verification (`NOT VERIFIABLE` for full UI/runtime product acceptance beyond source + unit tests).

---

## 6. Remaining scientific-integrity risks

1. **Legacy records:** Old TEAC / SI / Predicted OD / population keys can still render via `storedOutputs` / `simulationOutputs` if stored in MySQL.  
2. **Aspirational specs:** `baxSpec.outputLabels` (and peers) contradict the remediated engine — risk if any UI/docs consume them as capability claims (`spec.label` is shown as “Endpoint”).  
3. **Consent audit trail:** Acknowledgement not bound to persisted run metadata.  
4. **Stale empty-state copy:** “Run Prediction” understates exploratory-only path.  
5. **README drift:** Still describes Firebase / non-Vina stack — onboarding risk.  
6. **Descriptor opacity:** DPPH may look “descriptor-informed” while HBD/TPSA are usually absent from `admet.descriptors`.  
7. **Scientific validity:** Passing tests ≠ biological validation of Hill/identity heuristics.

---

## 7. Recommended next actions (no code changed in this audit)

1. Sanitize legacy display: do not show TEAC/SI/`summaryIc50` as assay truth for `methodType === "exploratory_math"` / SIMULATION without relabeling.  
2. Persist `meta:acknowledgedExploratory`, actor, and timestamp on new runs.  
3. Align or deprecate `lib/predictions/*.ts` `outputLabels` with actual exploratory outputs.  
4. Rewrite `README.md` to MySQL + exploratory simulation + real Vina reality.  
5. Optionally map PubChem HBD/TPSA into prediction features (or disclose “physchem descriptors unavailable”).  
6. Add HTTP tests for predictions route acknowledgement / validated 404.  
7. Researcher policy: re-run exploratory sims on active studies; decide whether exploratory mode stays enabled long-term.

---

## 8. Final readiness classification

### Six biological prediction modules

| Module | Classification | Reasoning |
|--------|----------------|-----------|
| **DPPH** | **Exploratory simulation only — RAT ready** | Docking-free; labels corrected; SIMULATION; not validated QSAR |
| **MTT** | **Exploratory simulation only — RAT ready** | No SI; metabolic wording; docking-independent |
| **LDH** | **Exploratory simulation only — RAT ready** | No Predicted OD; distinct from experimental LDH |
| **ROS** | **Exploratory simulation only — RAT ready** | No fluorescence/ΔΨm claims in new outputs |
| **BAX** | **Exploratory simulation only — RAT ready with caveat** | Fabricated apoptosis panel removed; context index only; update stale `baxSpec` labels |
| **Hippo–YAP** | **Exploratory simulation only — RAT ready** | Rev01 preserved; docking proxy explicitly limited |

**None** qualify as “Validated computational prediction.”

### Experimental laboratory workflows

| Workflow | Classification |
|----------|----------------|
| **Experimental DPPH** | **Ready for researcher experimental data processing** (contract formula + control gating verified) |
| **Experimental LDH** | **Ready for researcher experimental data processing** (spont/max controls verified) |

---

## 9. Concise acceptance verdict

**Ready for researcher acceptance testing?** **Yes**, for:

- Exploring the consent-gated exploratory simulation UX,  
- Confirming SIMULATION labeling and cleaned metrics,  
- Entering experimental DPPH/LDH laboratory data.

**Blocking issues for RAT of exploratory modules:** none that prevent testing the remediated happy path.

**Blocking issues for claiming scientific predictive validity:** all six prediction engines (by design — no validated models).

**Should fix soon (non-blocking but high confusion risk):** legacy TEAC/SI/IC50 display fallbacks, BAX `outputLabels`, README drift, empty-state “Run Prediction” wording, missing acknowledgement persistence.

---

*End of verification. No application source was modified for this audit.*
