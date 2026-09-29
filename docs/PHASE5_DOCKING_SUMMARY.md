# Phase 5 — Molecular Docking / AutoDock Vina Summary

**Date:** 2026-09-29  
**Binding source of truth:** `docs/STUDY_DESIGN_CONTRACT.md`  
**Scope:** Provenance-aware Vina **import / record** workspace (no internal Vina execution)  
**Route:** `/insilico/docking`  
**Collection:** `studies/{studyId}/dockingRuns/{runId}`  

**Build:** `npm run build` (verify locally after this phase)

---

## 1. Docking workflow

```text
Select Ligand (study compounds)
        →
Select Target Protein (study proteins)
        →
Configure / record Vina parameters + search box
        →
Enter actual Vina modes (affinity kcal/mol, RMSD LB/UB)
        →
Optional manual interactions
        →
Provenance (PREDICTED · AutoDock Vina)
        →
Save docking run
        →
View previous runs (filter by ligand / protein)
```

NANOTOPHEA does **not** run AutoDock Vina. Affinities and RMSD values must come from real external Vina output. No simulated or random docking values.

---

## 2. Firestore schema (`dockingRuns`)

| Field | Type | Notes |
|-------|------|--------|
| `id`, `studyId` | string | Document identity |
| `runName` | string | Researcher label |
| `compoundId`, `proteinId` | string | Must exist in study Research Data |
| `vinaVersion` | string | Required |
| `receptorPdbId` | string | From protein or override |
| `ligandName`, `ligandPubchemCid` | string / number | Snapshotted from compound |
| `exhaustiveness` | number | Positive; from Vina config |
| `numModes`, `energyRange` | number? | Optional Vina params |
| `searchBox` | `{ centerX/Y/Z, sizeX/Y/Z }` | Å; all required numbers |
| `modes[]` | `{ mode, affinityKcalMol, rmsdLowerBound?, rmsdUpperBound? }` | ≥1 mode from Vina |
| `bestBindingAffinityKcalMol` | number | Min affinity among modes (kcal/mol) |
| `selectedMode` | number? | Highlighted pose |
| `interactions[]` | optional manual contacts | Never auto-generated |
| `status` | `draft` \| `imported` \| `final` | Default `imported` |
| `notes` | string? | |
| `provenance` | Provenance | See §4 |
| `createdAt/By`, `updatedAt/By` | audit | |

**Not stored (Phase 5):** PDBQT, Vina logs, pose files (no Firebase Storage). Schema leaves room for future `artifacts[]` on provenance.

---

## 3. Vina parameters recorded

- Version  
- Exhaustiveness  
- num_modes (optional)  
- energy_range (optional)  
- Search box center + size (Å)  

No invented scientific defaults (e.g. no hardcoded exhaustiveness=8 or fake ΔG).

---

## 4. Docking modes

Example:

```json
[
  { "mode": 1, "affinityKcalMol": -7.8, "rmsdLowerBound": 0, "rmsdUpperBound": 0 },
  { "mode": 2, "affinityKcalMol": -7.3, "rmsdLowerBound": 1.4, "rmsdUpperBound": 2.1 }
]
```

Entered/imported from actual Vina output only.

---

## 5. Evidence / provenance

- **Evidence class:** `PREDICTED` for genuine AutoDock Vina outputs  
- **Method:** AutoDock Vina (+ version)  
- **Required:** date generated, source description; assumptions/limitations encouraged  

UI statements:

- “AutoDock Vina computational prediction”  
- “Docking affinity is a computational prediction and does not constitute experimental evidence.”  

EvidenceBadge shown on module shell and each run.

---

## 6. Interaction model (optional)

Manual fields only:

- `residue`  
- `interactionType`: Hydrogen Bond | Hydrophobic | Pi-Pi | Pi-Cation | Electrostatic | Van der Waals | Other  
- `distanceAngstrom` (optional)  
- `notes` (optional)  

No automatic interaction generation.

---

## 7. 3D viewer behavior

- Uses `ProteinViewer3D` with receptor **PDB ID**  
- Labeled **receptor-only** + REFERENCE badge for structure identity  
- Explicit limitation: not a docked ligand–receptor complex  
- `DockingViewer3D` left in `lib/mol3d.tsx` with a Phase 5 comment — **not** used to imply fake complexes or decorative ΔG  
- Architecture ready for real pose visualization later (Storage + pose files)

---

## 8. Permissions

| Role | Docking runs |
|------|----------------|
| OWNER | create / edit / delete |
| COLLABORATOR | create / edit / delete |
| ADVISER | read-only |
| VIEWER | read-only |

Helper: `canEditScientificRuns` in `lib/permissions/researchAccess.ts`.  
Audit logs on create / update / delete.

---

## 9. Validation (Zod)

- Compound and protein must exist in the study  
- PDB ID required (protein or explicit)  
- Vina version required  
- Search box numeric; exhaustiveness positive  
- ≥1 mode with numeric affinity (kcal/mol)  
- Provenance: PREDICTED + method + date + source  

Repository: `lib/repositories/scientificRunRepository.ts`  
(`createDockingRun`, `listDockingRuns`, `getDockingRun`, `updateDockingRun`, `deleteDockingRun`)

---

## 10. Legacy cleanup

| Item | Status |
|------|--------|
| `DOCKING_MATRIX` / Math.random docking | Remains quarantined under `_archive/legacy-data/` — not imported by active app |
| Old Docking Lab / duplicate Vina pages | Already redirected to `/insilico/docking`; panels archived |
| Fake AI/CNN confidence, hardcoded affinities | Not present in Phase 5 UI |
| Active `types/index.ts` ProteinTarget/CellLine docking demo shapes | Removed from active export (EvidenceType only) |

---

## 11. Files created / modified

### Created

- `components/panels/insilico/DockingWorkspace.tsx`  
- `docs/PHASE5_DOCKING_SUMMARY.md`  
- `.cursor/rules/docking-vina.mdc`  

### Modified

- `lib/domain/models.ts` — full DockingRun / modes / interactions / search box / input schemas  
- `lib/repositories/scientificRunRepository.ts` — full docking CRUD + validation  
- `lib/permissions/researchAccess.ts` — `canEditScientificRuns`  
- `app/insilico/docking/page.tsx` — workspace  
- `lib/mol3d.tsx` — Phase 5 note on `DockingViewer3D`  
- `types/index.ts` — drop legacy docking demo types from active surface  

### Removed from active use

- Placeholder-only docking page content  
- Active reliance on legacy `ProteinTarget` bindingScore / confidence types  

---

## 12. Limitations (Phase 5)

- No local/cloud Vina execution  
- No PDBQT / log / pose upload (no Storage)  
- No Ki calculation from ΔG  
- No complex pose 3D  
- Prediction modules (DPPH, LDH, etc.) not started  

---

## 13. Future path for real Vina execution

1. Optional Storage artifacts for logs / PDBQT / poses (provenance `artifacts[]`)  
2. Server-side or documented CLI wrapper with method version + full parameter capture  
3. Pose visualization in 3Dmol from imported coordinates  
4. Still label all Vina affinities as **PREDICTED**

---

## 14. Stop point

Phase 5 Molecular Docking is complete for review. Do **not** begin prediction modules until this summary is accepted.
