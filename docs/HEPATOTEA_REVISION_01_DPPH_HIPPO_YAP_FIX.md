# HEPATOTEA Revision 01 — DPPH vs Hippo–YAP Identical Results Fix

**Date:** 2026-11-11  
**Revision source:** Researcher feedback — *“The DPPH and Hippo-YAP results are identical. They should not produce the same results because they represent different biological activities.”*  
**Contract:** [`STUDY_DESIGN_CONTRACT.md`](./STUDY_DESIGN_CONTRACT.md)  
**Status:** Implemented and verified with automated tests

---

## 1. Confirmed root cause

Both endpoints previously used the **same generic exploratory pipeline**:

1. Shared `prototypeFactor(endpoint, features)` blended compound identity with the **first available docking affinity**.
2. Shared `hill()` / `mix()` concentration–response construction produced **percentage curves** for both modules.
3. Overlapping numeric doses (**50, 100**) appeared in both grids (DPPH µM and Hippo µg/mL), so charts looked interchangeable.
4. Feature assembly for DPPH included **all study docking rows** when `subject.proteinId` was absent, so DPPH scavenging was often driven by the same YAP/Hippo affinity used for Hippo–YAP.
5. Hippo outputs (`p-YAP`, `LATS1`, `TEAD4`) were **linear multiples** of a single Hill percentage (`yap`, `yap*0.8`, …), not pathway-distinct logic.
6. Frontend always showed `EvidenceBadge type="PREDICTED"` even for `SIMULATION` runs, and preferred **IC50** as the primary highlight for every endpoint — further collapsing Hippo into a scavenging-like presentation.

This was **not** primarily a database cross-wiring bug: `biological_predictions.endpoint` filtering already existed. The scientific calculation path itself was insufficiently separated.

---

## 2. Files modified

| File | Change |
|------|--------|
| `lib/predictions/prototype/dpph.ts` | Independent antioxidant potency factor; µM scavenging grid; docking excluded |
| `lib/predictions/prototype/hippo-yap.ts` | Independent pathway engagement from Hippo-target docking; residual YAP–TEAD series |
| `lib/predictions/prototype/math.ts` | Shared utils (`clamp01`, `countElementAtoms`, `numericDescriptor`); documented that DPPH/Hippo must not use `prototypeFactor` |
| `lib/predictions/prototype/types.ts` | `finishPrototype` accepts endpoint-specific `assumptions` |
| `lib/predictions/store.ts` | Endpoint-aware persistence; Hippo never gets scavenging IC50/TEAC; explicit `proteinId` option; `meta:endpoint` |
| `components/study/BiologicalPredictionsWorkspace.tsx` | DPPH features exclude docking; endpoint mismatch guards; SIMULATION badge; endpoint-specific copy/chart/primary metrics |
| `lib/predictions/prototype/prototype.test.ts` | DPPH, Hippo, and cross-endpoint isolation tests |
| `docs/HEPATOTEA_REVISION_01_DPPH_HIPPO_YAP_FIX.md` | This report |

**Not modified:** setup, ADME, docking worker, laboratory, statistics, comparison engines, AI assistant, DB schema.

---

## 3. Scientific calculation changes

### A. DPPH (antioxidant / radical scavenging)

- Grid: **0, 3.13, 6.25, 12.5, 25, 50, 100 µM** (contract in-silico DPPH).
- Metric: `predicted_scavenging` (%).
- Potency from compound identity + MW band + formula oxygen count + optional H-bond donor / TPSA descriptors + phenolic name cues.
- **Docking affinities are never used** (ΔG ≠ antioxidant activity).
- Outputs: scavenging at 100 µM, exploratory IC50 (µM midpoint), maximum scavenging, TEAC ratio, relative potency.
- Evidence class remains **`SIMULATION`** / `exploratory_math`.
- Assumptions text states these limits explicitly.

### B. Hippo–YAP (signaling pathway)

- Grid: **50, 100, 250, 500 µg/mL** (contract formulation-oriented Hippo–YAP).
- Metric: `yap_tead_transcriptional_residual` (% residual activity; **decreases** with dose).
- Engagement from selected Hippo-related target docking affinity + compound–target identity; role bias for YAP/TEAD vs LATS.
- Outputs: YAP–TEAD residual, estimated YAP suppression, p-YAP Ser127 proxy, nuclear YAP residual proxy, TEAD transcriptional proxy.
- **No IC50 / TEAC scavenging fields.**
- Assumptions text states proxies ≠ WB/qPCR and ≠ DPPH logic.

Shared utilities (`hill`, `mix`, `demonstrationFactor`) remain allowed only as generic math — each endpoint supplies its own biological parameters and metrics.

---

## 4. Database and result mapping corrections

- Persistence still writes `endpoint` from the simulation result (`dpph` vs `hippo_yap`).
- `storedSimulationFromPrototype` now:
  - Accepts explicit `{ proteinId, cellLineId }` from the subject.
  - Stores Hippo with `proteinId`; DPPH without protein id.
  - **Does not** copy Hippo pathway numbers into `summary_ic50` / `teac`.
  - Records `input_parameters["meta:endpoint"]` and `meta:evidenceClass`.
- Repository listing by `study_id` + `endpoint` unchanged and correct.
- Workspace rejects API bodies whose `endpoint` does not match the requested module before save.

### Historical records

Existing DPPH / Hippo–YAP rows generated before this revision may still reflect the **old shared Hill-% engine**.

**Safe correction strategy (no silent rewrite):**

1. Do **not** bulk-delete researcher data.
2. Ask researchers to **re-run** DPPH and Hippo–YAP predictions for affected studies.
3. Re-run updates the existing subject match via `updatePredictionRun` when a prior run exists, or creates a new run otherwise.
4. Optional follow-up: inventory studies where both endpoints share identical `result_points` metrics (`predicted_scavenging` on Hippo, or identical value arrays) and flag them in the UI as “generated with prior exploratory engine — re-run recommended.”

---

## 5. Frontend corrections

- DPPH feature assembly excludes proteins/docking.
- Evidence badge uses **`SIMULATION`** when provenance says so (no longer always `PREDICTED`).
- Endpoint context banners distinguish antioxidant µM DPPH vs Hippo–YAP pathway proxies.
- Charts titled/metric-labeled per endpoint; Hippo stroke color distinct.
- Primary metric prefers IC50/scavenging for DPPH and YAP–TEAD residual/suppression for Hippo.
- Assumption copy preserves exploratory/simulation wording instead of stripping it to look like a validated model.

---

## 6. Tests performed

```bash
npx tsx --tsconfig tsconfig.json --test \
  lib/predictions/prototype/prototype.test.ts \
  lib/predictions/engine.test.ts \
  lib/predictions/modules.test.ts
```

Coverage added/updated:

- DPPH µM grid, scavenging metrics, docking independence, persistence without protein id.
- Hippo µg/mL residual metric, pathway outputs, affinity sensitivity, persistence with protein id and without IC50/TEAC.
- Cross-endpoint isolation of outputs, series metrics/units, assumptions, and stored endpoint identity.
- Existing engine / modules / evidence-gate / filter suites retained.

---

## 7. Test results

**40 passed / 0 failed** (prediction prototype + engine + modules suites).

---

## 8. Remaining limitations

- Both endpoints remain **exploratory simulations** — validated QSAR / pathway models are still `null` in `lib/predictions/{dpph,hippo-yap}.ts`.
- Hippo proxies are **not** experimental biomarkers; they must not be cited as WB/qPCR evidence.
- DPPH IC50 is an exploratory Hill midpoint, not a fitted experimental IC50.
- Physicochemical HBD/TPSA improve DPPH only when those descriptors are present on the ADME descriptor map; otherwise identity/MW/formula cues dominate.
- Pre-revision stored runs are not auto-migrated (by design).
- Broader authz gaps from the system assessment are out of scope for this revision.

---

## 9. Confirmation — existing workflows

| Area | Impact |
|------|--------|
| Six-stage study workflow | Unchanged |
| Research Setup / ADME / Docking | Unchanged |
| MTT / LDH / ROS / BAX prototypes | Still use shared `prototypeFactor` (untouched by this revision’s scientific split) |
| Laboratory / ANOVA / Scheffé / comparison | Unchanged |
| AI assistant | Unchanged |
| DB schema / migrations | No schema change |

Researchers should **re-run** Biological Predictions for DPPH and Hippo–YAP on active studies to replace prior identical exploratory curves with the separated engines.

---

## Verification checklist for researchers

1. Open a study with at least one phytochemical and one Hippo-related protein (YAP/TEAD/LATS).
2. Run **DPPH** for a compound → expect µM scavenging curve + IC50 (µM); SIMULATION badge; no docking-driven change when affinity changes.
3. Run **Hippo–YAP** for compound × YAP1 → expect µg/mL **residual** YAP–TEAD activity curve; pathway proxy outputs; no TEAC/IC50 scavenging fields.
4. Confirm the two result panels show different metrics, units, and assumptions.
5. Confirm switching tabs does not show the other endpoint’s series under the wrong label.
