# Phase 6 — In-Silico Prediction Workspace Summary

**Date:** 2026-09-29  
**Binding source of truth:** `docs/STUDY_DESIGN_CONTRACT.md`  
**Scope:** Provenance-aware **import/record** workspaces for computational prediction endpoints  
**Collection:** `studies/{studyId}/predictionRuns/{runId}`  

**Build:** verify with `npm run build`

---

## 1. Architecture

Reusable workspace configured per endpoint:

| Piece | Role |
|-------|------|
| `lib/insilico/predictionEndpoints.ts` | Units, subject type, suggested grids, banners, forbidden claims |
| `components/insilico/prediction/PredictionWorkspace.tsx` | Shared CRUD UI |
| `components/insilico/prediction/PredictionParts.tsx` | Method card, results table, Recharts chart |
| `lib/repositories/scientificRunRepository.ts` | create / list / get / update / delete + validation |

No Hill-curve engines, random noise, or auto-generated scientific values.

---

## 2. Routes

| Endpoint | Route |
|----------|-------|
| DPPH | `/insilico/predictions/dpph` |
| MTT | `/insilico/predictions/mtt` |
| LDH | `/insilico/predictions/ldh` |
| ROS | `/insilico/predictions/ros` |
| BAX | `/insilico/predictions/bax` |
| Hippo–YAP | `/insilico/predictions/yap` |

Legacy `/insilico/predictions/hippo-yap` redirects to `/yap`.

---

## 3. Endpoint configurations

| Endpoint | Subject | Cell line | Unit | Suggested grid | Experimental counterpart |
|----------|---------|-----------|------|----------------|--------------------------|
| DPPH | compound | — | µM | 0, 3.13–100 | Yes (lab later, µg/mL T1–T6) |
| LDH | formulation | HepG2 | µg/mL | 50–500 | Yes (lab later) |
| MTT | formulation | HepG2 | µg/mL | 50–500 | **No** |
| ROS | formulation | HepG2 | µg/mL | 50–500 | **No** |
| BAX | formulation | HepG2 | µg/mL | 50–500 | **No** |
| Hippo–YAP | formulation | HepG2 | µg/mL | 50–500 | **No** |

“Prefill concentration grid” creates **blank value** rows only — never invents results.

---

## 4. Firestore schema (`predictionRuns`)

Identity: `id`, `studyId`, `endpoint` (+ synced `module`), `runName`  
Subject: `compoundId` | `formulationId`, `cellLineId` when required  
Method: `methodName`, `methodVersion`, `methodType`, `source`, `referenceIds`, `assumptions`, `limitations`  
Input: `concentrationUnit`, `inputParameters?`, `dateGenerated`, `operatorName`  
Results: `resultPoints[]` `{ concentration, concentrationUnit, metric, value, valueUnit, notes? }`  
Evidence: provenance `PREDICTED` | `SIMULATION`  
Audit: `createdAt/By`, `updatedAt/By`, `status`

---

## 5. Evidence rules

- **PREDICTED** — documented method name, source, date; not `exploratory_math`
- **SIMULATION** — requires assumptions; UI warning:  
  *“Exploratory simulation — not a validated predictive model and not an experimental result.”*
- Never auto-upgrade SIMULATION → PREDICTED  
- Never EXPERIMENTAL on these pages  

DPPH guard: rejects concentrations that look like experimental µg/mL T3–T6 (50/100/250/500 only) when unit is µM.

---

## 6. Charts

Recharts line chart uses **stored** `resultPoints` only.  
Empty: “No computational results recorded.”

---

## 7. Permissions

OWNER / COLLABORATOR: create · edit · delete  
ADVISER / VIEWER: read-only  

Audit logs on create / update / delete.

---

## 8. Legacy cleanup

Not restored: Hill generators, AssayLabSection, VirtualLabPanel, fake IC50 / AI confidence, Math.random science, canned pathway responses.

Active pages replaced placeholders with `PredictionWorkspace`.

---

## 9. Files created / modified

### Created
- `lib/insilico/predictionEndpoints.ts`
- `components/insilico/prediction/PredictionWorkspace.tsx`
- `components/insilico/prediction/PredictionParts.tsx`
- `app/insilico/predictions/yap/page.tsx`
- `docs/PHASE6_PREDICTIONS_SUMMARY.md`

### Modified
- `lib/domain/models.ts` — PredictionRun / result points / input schemas
- `lib/repositories/scientificRunRepository.ts` — full prediction CRUD + validation
- All six prediction pages (dpph/mtt/ldh/ros/bax + hippo-yap redirect)
- `data/navigation.ts`, `next.config.ts` — yap route

---

## 10. Limitations

- No internal prediction algorithms  
- No Experimental DPPH/LDH in this phase  
- No comparison / statistics / interpretation  
- Incomplete result tables allowed  

---

## 11. Stop point

Phase 6 complete for review. Do **not** begin Laboratory Results until accepted.
