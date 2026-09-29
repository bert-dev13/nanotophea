# Phase 7 — Laboratory Results Summary

**Date:** 2026-09-29  
**Binding source of truth:** `docs/STUDY_DESIGN_CONTRACT.md`  
**Scope:** Experimental laboratory data entry for DPPH, LDH, and characterization  
**Collections:**  
`studies/{studyId}/labDatasets/{datasetId}`  
`studies/{studyId}/labDatasets/{datasetId}/replicates/{replicateId}`  

**Build:** `npm run build` succeeds

---

## 1. Reports removal (architecture change)

Reports is **no longer part of NANOTOPHEA**.

| Action | Detail |
|--------|--------|
| Navigation | Removed Reports group from `data/navigation.ts` |
| Route | Deleted `app/reports/` |
| Dashboard | Removed Reports quick link; Analysis card no longer mentions reports |
| ModuleShell / PlaceholderModule | Removed `reports` phase |
| AppNav | Removed Reports special-case expansion |

Analysis modules (Statistics, Compare, Interpretation) were not changed.

---

## 2. Laboratory architecture

Reusable experimental workspaces:

| Piece | Role |
|-------|------|
| `lib/lab/labAssayConfig.ts` | Locked T1–T6 designs, units, measurement keys |
| `lib/lab/labCalculations.ts` | Deterministic mean / sample SD only |
| `components/lab/AssayWorkspace.tsx` | Shared Experimental DPPH / LDH CRUD UI |
| `components/lab/AssayParts.tsx` | Treatment design, raw table, derived summary, chart, provenance |
| `components/lab/CharacterizationWorkspace.tsx` | Type-specific characterization forms |
| `lib/repositories/labRepository.ts` | Full create / list / get / update / delete + validation |

Evidence class is always **EXPERIMENTAL**.  
Prediction runs (`predictionRuns`) are never read as laboratory measurements.

---

## 3. Routes

| Module | Route |
|--------|-------|
| Experimental DPPH | `/lab/dpph` |
| Experimental LDH | `/lab/ldh` |
| Characterization | `/lab/characterization` |

---

## 4. Experimental DPPH

- Banner: **EXPERIMENTAL DPPH — Laboratory**
- Treatments: T1 solvent; T2 ascorbic acid (protocol detail recorded, not invented); T3–T6 at **50 / 100 / 250 / 500 µg/mL**
- Replicates: **R1, R2, R3**
- Measurements: absorbance (A517), % radical scavenging
- Default wavelength: **517 nm**
- Incomplete replicate grids allowed — blanks are not filled

---

## 5. Experimental LDH

- Banner: **EXPERIMENTAL LDH — Laboratory**
- Cell line: **HepG2** enforced
- Treatments: T1 spontaneous/vehicle; T2 max lysis (protocol detail recorded); T3–T6 same µg/mL grid
- Measurements: A490, LDH release, % cytotoxicity
- Separate from In-Silico LDH (`predictionRuns`)

---

## 6. Characterization

Type-specific forms (not one generic text blob):

| Type | Key fields |
|------|------------|
| HPLC | marker, retention time, peak area, calibration, R², LOD, LOQ, quercetin conc. |
| Proximate | moisture, ash, protein, fat, fiber |
| Nutritive | carbs, energy, fat, protein, serving, net weight |
| Pb | measured value, unit (mg/kg or ppm), limit **only with researcher-provided source** |
| Sensory | timepoint, appearance, odor, taste, acceptability, scale |
| Microbial | APC, yeast/mold, units, timepoint, acceptance criteria when documented |
| Stability | timepoint, storage, observations, linked notes |

No invented acceptance limits or reference criteria.

---

## 7. Firestore schema

### `labDatasets/{datasetId}`

Identity: `id`, `studyId`, `assay` / `assayType`, `datasetName`  
Subject: `formulationId?`, `cellLineId?`, `cellLineName?`  
Lab metadata: `laboratoryName`, `datePerformed`, `protocolReference`, `kitName?`, `kitManufacturer?`, `instrument?`, `wavelengthNm?`, `operatorName?`, `outsourcedLab`  
Controls: `controlT1Detail?`, `controlT2Detail?`  
Derived: `treatmentSummaries[]` (mean/SD/n, labeled `DERIVED_FROM_EXPERIMENTAL`)  
IC50: optional externally calculated record with method provenance  
Characterization: typed `characterization` payload  
Evidence: provenance `EXPERIMENTAL` only  
Audit: `createdAt/By`, `updatedAt/By`, `status`

### `replicates/{replicateId}`

`treatmentCode` (T1–T6), `replicateCode` (R1–R3), locked µg/mL for T3–T6,  
`measurements` (raw only), `dataClass: RAW_EXPERIMENTAL`, audit fields.

Raw replicate documents are **not overwritten** when summaries are recomputed.

---

## 8. Evidence & derived-data rules

| Layer | Label |
|-------|-------|
| Raw replicates | **RAW EXPERIMENTAL DATA** |
| Mean / SD / stored summaries | **DERIVED FROM EXPERIMENTAL DATA** |
| IC50 | Allowed only with external method provenance — never auto-fitted |

Charts (Recharts) use stored/entered experimental means only.  
Empty state: “No laboratory results recorded for charting.”

---

## 9. Validation (Zod + repository)

- Experimental assays: µg/mL only (rejects µM treatment misuse)
- T3–T6 concentrations locked to 50 / 100 / 250 / 500
- LDH requires HepG2
- Evidence class must be EXPERIMENTAL (blocks PREDICTED/SIMULATION as lab data)
- MTT / ROS / BAX / Hippo–YAP cannot be stored as lab datasets
- Pb acceptance limit requires a documented source if entered

---

## 10. Permissions

OWNER / COLLABORATOR: create · edit · delete  
ADVISER / VIEWER: read-only  

Audit logs: `labDataset.create|update|delete`, `labReplicate.create|update|delete`

---

## 11. Legacy / out of scope

Not implemented (deferred):

- ANOVA / Scheffé (Phase 8)
- Prediction vs experimental comparison (Phase 9)
- Automatic hypothesis decisions / Researcher Interpretation
- PDF / Excel / report generation
- Firebase Storage uploads
- Internal prediction algorithms / Vina execution

---

## 12. Files created / modified / removed

### Created
- `lib/lab/labAssayConfig.ts`
- `lib/lab/labCalculations.ts`
- `components/lab/AssayWorkspace.tsx`
- `components/lab/AssayParts.tsx`
- `components/lab/CharacterizationWorkspace.tsx`
- `docs/PHASE7_LAB_RESULTS_SUMMARY.md`

### Modified
- `lib/domain/models.ts` — full LabDataset / LabReplicate / characterization schemas
- `lib/repositories/labRepository.ts` — full CRUD + validation
- `lib/permissions/researchAccess.ts` — `canEditLabData` / `labRoleLabel`
- `app/lab/dpph/page.tsx`, `app/lab/ldh/page.tsx`, `app/lab/characterization/page.tsx`
- `data/navigation.ts`, `components/layout/AppNav.tsx`
- `components/panels/DashboardPanel.tsx`
- `components/ui/ModuleShell.tsx`, `components/panels/PlaceholderModule.tsx`

### Removed
- `app/reports/` (entire Reports page)

---

## 13. Limitations

- No automated % scavenging / % cytotoxicity formulas beyond entered values + mean/SD
- No IC50 curve fitting
- No lab PDF attachments (Storage deferred)
- Statistics and comparison modules remain placeholders

---

## 14. Stop point

Phase 7 complete for review. Do **not** begin Statistics or Comparison until accepted.
