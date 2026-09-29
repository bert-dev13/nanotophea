# Phase 9 — Prediction vs Experimental Comparison Summary

**Date:** 2026-09-29  
**Binding source of truth:** `docs/STUDY_DESIGN_CONTRACT.md` §10  
**Scope:** Transparent comparison of computational predictions with experimental results for **DPPH** and **LDH** only  
**Route:** `/analysis/compare`  
**Collection:** `studies/{studyId}/comparisons/{comparisonId}`  

**Build:** `npm run build` succeeds  
**Tests:** `npm test` — 31/31 pass (Phase 8 + Phase 9)

---

## 1. Architecture

| Piece | Role |
|-------|------|
| `lib/comparison/compatibility.ts` | COMPATIBLE / PARTIAL / INCOMPATIBLE rules |
| `lib/comparison/metrics.ts` | Metric pairing + signed/abs/% difference |
| `lib/comparison/runComparison.ts` | Orchestration, fingerprints, chart helpers |
| `lib/repositories/comparisonRepository.ts` | CRUD + preview + stale detection |
| `components/analysis/ComparisonWorkspace.tsx` | Scientific comparison UI |

Sources:

- Prediction: `predictionRuns/{runId}` (PREDICTED | SIMULATION)
- Experimental: `labDatasets/{datasetId}` + replicates (EXPERIMENTAL)
- Optional: `statistics/{analysisId}` (reference only — no ANOVA recomputation)

---

## 2. Allowed comparisons

| Computational | Experimental |
|---------------|--------------|
| DPPH prediction | Experimental DPPH |
| LDH prediction | Experimental LDH |

**Not allowed:** MTT, ROS, BAX, Hippo–YAP, ADMET, docking, characterization.

---

## 3. DPPH behavior (unit / subject separation)

| Side | Subject | Unit | Grid |
|------|---------|------|------|
| In-silico | Compound-level | µM | 0, 3.13–100 |
| Experimental | Formulation-level | µg/mL | T3–T6 = 50 / 100 / 250 / 500 |

- Compatibility: **PARTIAL** (side-by-side only)
- **No** automatic µM ↔ µg/mL conversion
- **No** shared concentration axis by default
- Separate charts: Computational (µM) vs Experimental (µg/mL)
- Aligned difference table is **not** produced for DPPH under current contract units

---

## 4. LDH behavior (aligned when compatible)

| Side | Subject | Unit | Context |
|------|---------|------|---------|
| In-silico | Formulation | µg/mL | HepG2 |
| Experimental | Formulation | µg/mL | HepG2, T3–T6 |

- Full T3–T6 concentration match → **COMPATIBLE** + **ALIGNED**
- Partial match → **PARTIAL** + aligned points only where concentrations exist
- Zero overlap → **PARTIAL**, side-by-side only (no fabricated points)
- Overlay chart: predicted vs experimental mean ± SD at matching µg/mL

---

## 5. Compatibility states

| Status | Meaning |
|--------|---------|
| COMPATIBLE | LDH units/context/concentrations align for numeric comparison |
| PARTIAL | Side-by-side valid; aligned comparison limited or blocked (e.g. DPPH units) |
| INCOMPATIBLE | Wrong endpoint/evidence/empty data — cannot save |

---

## 6. Evidence separation

Persistent UI notice:

> Computational predictions and experimental measurements are distinct evidence layers. Agreement does not by itself establish experimental validation of the computational method.

Badges always separate:

- Computational: **PREDICTED** or **SIMULATION**
- Laboratory: **EXPERIMENTAL**
- Researcher notes: **INTERPRETATION**

Never merged into one evidence class. Never labeled “model validation.”

---

## 7. Comparison calculations

Only when aligned + metric meanings compatible (e.g. predicted cytotoxicity vs % cytotoxicity):

- signed difference  
- absolute difference  
- percent difference  

**Not implemented:** correlation, R², RMSE, accuracy/confidence scores.

Metric pairs are explicit allow-lists — incompatible pairs (e.g. predicted % vs absorbance) skip difference columns.

---

## 8. Firestore schema (`comparisons/{comparisonId}`)

| Field | Role |
|-------|------|
| `endpoint` | `dpph` \| `ldh` |
| `predictionRunId`, `predictionEvidenceClass` | Computational source |
| `labDatasetId`, `experimentalMetricKey` | Experimental source |
| `statisticsAnalysisId?`, `statisticsFreshnessAtSave?` | Optional Phase 8 link |
| `compatibilityStatus`, `compatibilityReasons[]` | Validation outcome |
| `comparisonMode` | `SIDE_BY_SIDE` \| `ALIGNED` |
| `alignedPoints[]` | Matched concentrations + differences (when valid) |
| `researcherNotes`, `concordanceFlag` | Human INTERPRETATION |
| `sourcePredictionUpdatedAt`, `sourceLabUpdatedAt`, `sourceStatisticsUpdatedAt?` | Trace timestamps |
| `sourceFingerprint` | Stale detection |
| `calculationMethod` / `calculationVersion` | `PRED_VS_EXP_SIDE_BY_SIDE_ALIGNED` / `1.0.0` |

Raw prediction/lab datasets are **not** duplicated wholesale.

---

## 9. Stale detection

Fingerprint covers:

- prediction updatedAt + result points  
- lab dataset updatedAt  
- all replicate measurements/timestamps  
- optional statistics id + fingerprint  

Mismatch or stale linked statistics → **STALE / REQUIRES REVIEW**.  
Never silently presented as current.

---

## 10. Researcher notes

Optional human notes + concordance judgment (`consistent` / `partially_consistent` / `divergent` / `not_assessed`).

Evidence class: **INTERPRETATION**.

Does **not** auto-decide:

- hypothesis accept/reject  
- efficacy / safety / mechanism  
- formulation success  

---

## 11. Permissions & audit

| Role | Access |
|------|--------|
| OWNER / COLLABORATOR | create · update notes · delete |
| ADVISER / VIEWER | read-only |

Audit: `comparison.create` · `comparison.update` · `comparison.delete`

Helpers: `canEditComparisons` / `comparisonRoleLabel`

---

## 12. Tests (`lib/comparison/comparison.test.ts`)

- DPPH side-by-side; no µM↔µg/mL matching  
- Evidence separation notice  
- Compatible / partial / empty LDH alignment  
- No fabricated missing concentrations  
- Incompatible endpoints (MTT-style, DPPH vs LDH)  
- Metric compatibility guards  
- Fingerprint change on prediction/replicate edits  
- Stale statistics warning  

---

## 13. Limitations

- No documented µM↔µg/mL conversion path yet (must be explicit provenance later)  
- No correlation / R² / RMSE  
- Statistics are referenced, never recomputed  
- Concordance flag is researcher judgment only  

---

## 14. Files created / modified

### Created
- `lib/comparison/compatibility.ts`
- `lib/comparison/metrics.ts`
- `lib/comparison/runComparison.ts`
- `lib/comparison/comparison.test.ts`
- `lib/repositories/comparisonRepository.ts`
- `components/analysis/ComparisonWorkspace.tsx`
- `docs/PHASE9_COMPARISON_SUMMARY.md`

### Modified
- `lib/domain/models.ts` — full ComparisonRecord / create / update schemas  
- `lib/permissions/researchAccess.ts` — comparison write helpers  
- `lib/repositories/interpretationRepository.ts` — removed obsolete comparison stub  
- `app/analysis/compare/page.tsx` — wired workspace  
- `package.json` — `npm test` includes comparison tests  

---

## 15. Stop point

Phase 9 complete for review.  
**Do not begin Researcher Interpretation** until accepted.
