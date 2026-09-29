# Phase 3 — Research Data Summary

**Date:** 2026-09-29  
**Binding source of truth:** `docs/STUDY_DESIGN_CONTRACT.md`  
**Scope:** Firestore-backed Formulation, Phytochemicals, Target Proteins, Cell Lines, References  
**Out of scope (deferred):** ADMET, SwissADME, AutoDock Vina, predictions, DPPH/LDH entry, statistics, comparison, AI interpretation, Firebase Storage, Admin SDK  

**Build:** `npm run build` succeeded  

---

## 1. Implemented modules

| Module | Route | Collection path |
|--------|-------|-----------------|
| Formulation | `/research/formulation` | `studies/{studyId}/formulations/{id}` |
| Phytochemicals | `/research/phytochemicals` | `studies/{studyId}/compounds/{id}` |
| Target Proteins | `/research/proteins` | `studies/{studyId}/proteins/{id}` |
| Cell Lines | `/research/cell-lines` | `studies/{studyId}/cellLines/{id}` |
| References | `/research/references` | `studies/{studyId}/references/{id}` |

All five support **list / view / add / edit / delete (with confirmation)**, search, filtering where useful, empty states, EvidenceBadge + provenance panel, and reference ID linkage.

---

## 2. Firestore fields

### Shared envelope (every Research Data record)

- `id`, `studyId`
- `provenance` (`evidenceClass`, `source`, `citation`, `retrievedAt`, `recordedAt`, `operatorId`, optional method/limitations/artifacts)
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- `notes` (optional)

### Formulation

- `name`, `plantMaterial`, `scientificName`
- `leafMassG`, `nanocarrierMassG`, `totalMassG`
- `methodNotes`, `storageNotes`
- `markerCompound`, `markerCompoundId`
- `referenceIds[]`, `isCanonical`

**Locked seed:** NanoHepatoTea — 2 g dried *Phyllanthus niruri* leaf + 1 g Chitosan–TPP; Evidence `REFERENCE` (+ optional LITERATURE refs). No dosage/clinical instructions.

### Compound (phytochemical)

- `name`, `pubchemCid`, `smiles`, `isomericSmiles`
- `formula`, `molecularWeight`
- `chemicalClass`, `plantPart`, `source`
- `isPrimaryMarker`, `referenceIds[]`

**Primary marker seed:** Quercetin (PubChem CID 5280343).

### Protein

- `name`, `gene`, `pdbId`, `pathway`, `role`, `functionNotes`, `source`, `referenceIds[]`

Docking metrics are **not** on Protein documents (belong in `dockingRuns`).

### Cell line

- `name`, `fullName`, `organism`, `tissueOrigin`, `diseaseContext`
- `lineType` (`cancer` | `normal` | `other`)
- `p53Status`, `hbvStatus`, `sourceDatabase`
- `isPrimaryExperimental`, `referenceIds[]`

**Primary experimental seed:** HepG2. L02 and WRL-68 seeded as optional REFERENCE context only.

### Reference

- `title`, `authors`, `year`, `journal`
- `doi`, `pmid`, `url`, `retrievedAt`, `citationText`

---

## 3. Provenance handling

- Every record displays an **EvidenceBadge** + **ProvenanceCard**.
- Create/edit forms require provenance:
  - **REFERENCE:** source database/protocol + retrieval/record date
  - **LITERATURE:** citation (DOI/PMID/URL/accession) — not free-typed unsupported claims alone
- Research Data UI restricts evidence classes to `REFERENCE` | `LITERATURE` (no PREDICTED/EXPERIMENTAL inventing on these pages).
- Linked `referenceIds` resolve to study References with DOI/PMID/URL links.

---

## 4. CRUD + roles

| Role | Research Data |
|------|----------------|
| OWNER | edit |
| COLLABORATOR | edit |
| ADVISER | read-only |
| VIEWER | read-only |

Enforced in UI (`canEditResearchData`) and Firestore rules (`canWriteResearch`). Mutations go through `lib/repositories/researchDataRepository.ts` and write audit logs.

**Study isolation:** all queries are under `studies/{studyId}/…`. Switching active study reloads that study’s records only.

**Seeding:** `seedDefaultResearchData` runs on study create and idempotently when Research Data pages load if no formulations exist yet (covers Phase 2 studies created before Phase 3).

---

## 5. Legacy data — retained vs discarded

### Retained (justified identity / REFERENCE only)

| Source | Fields kept | Why |
|--------|-------------|-----|
| Contract / protocol | NanoHepatoTea 2 g + 1 g composition | Locked in STUDY_DESIGN_CONTRACT |
| `compounds.ts` Quercetin | name, CID, SMILES, formula, MW, class, plant-part hint | PubChem-aligned identity; primary marker |
| `proteins.ts` (subset) | name, gene, PDB ID, pathway, role, short function text for YAP1, BAX, BCL-2, Caspase-3, Nrf2, LATS1 | Structural/target identity for future docking; no affinities |
| `celllines.ts` HepG2 | name, organism/tissue/disease context, p53/HBV identity notes | Primary experimental line per contract |
| `celllines.ts` L02, WRL-68 | name + normal-hepatocyte context labels | Optional REFERENCE context only |

### Discarded (not migrated)

| Source | Discarded | Why |
|--------|-----------|-----|
| `compounds.ts` | LogP, HBD, HBA, TPSA, rotatable bonds | Unverified descriptors → ADMET module later |
| `compounds.ts` | `activity[]`, `potency`, narrative `description` claims | Unsupported / promotional science |
| `compounds.ts` | Non-Quercetin catalog entries (rutin, luteolin, …) | Not auto-migrated; add manually with provenance |
| `compounds.ts` | Docking matrix (already stripped earlier) | Fake/demo docking |
| `proteins.ts` | `bindingScore`, `ki`, `rmsd`, `confidence`, `interactions`, `foldChange`, `effect`, colors | Docking/expression simulation — not Protein identity |
| `celllines.ts` | IC50, IC50Free, maxInhibition, SI, dose/viability/absorbance curves | Simulated 4PL — not LITERATURE/EXPERIMENTAL |
| `celllines.ts` | apoptosis %, ROS, BAX ratio, YAP suppression, clinicalRelevance narratives | Unverified claims |
| `celllines.ts` | Extra HCC lines (Huh7, Hep3B, …) | Not required; may be added later as REFERENCE only |

Archived copies (not imported by the app):

- `_archive/legacy-data/compounds.ts`
- `_archive/legacy-data/proteins.ts`
- `_archive/legacy-data/celllines.ts`

Active app no longer imports `@/data/compounds`, `@/data/proteins`, or `@/data/celllines`.

---

## 6. Files created / modified / removed

### Created

- `lib/seed/defaultResearchData.ts`
- `lib/permissions/researchAccess.ts`
- `components/research/ProvenanceCard.tsx`
- `components/research/ProvenanceForm.tsx`
- `components/research/ResearchToolbar.tsx`
- `components/research/ResearchEmptyState.tsx`
- `components/research/ConfirmDeleteDialog.tsx`
- `components/research/FormFields.tsx`
- `components/research/ReferenceLinks.tsx`
- `app/research/references/page.tsx`
- `components/panels/research/ReferencesCatalog.tsx`
- `docs/PHASE3_RESEARCH_DATA_SUMMARY.md`

### Modified

- `lib/repositories/researchDataRepository.ts` — full CRUD + audit
- `lib/repositories/studyRepository.ts` — seed on study create
- `lib/domain/models.ts` — Research Data field expansions (Phase 3 start)
- `lib/firebase/firestore.ts` — `deleteDocData`
- `components/panels/research/FormulationPanel.tsx`
- `components/panels/research/PhytochemicalsCatalog.tsx`
- `components/panels/research/ProteinsCatalog.tsx`
- `components/panels/research/CellLinesCatalog.tsx`
- `data/navigation.ts` — References link

### Removed from active app (moved to archive)

- `data/compounds.ts`
- `data/proteins.ts`
- `data/celllines.ts`

---

## 7. Verification checklist

| Check | Status |
|-------|--------|
| Create / edit / delete Research Data records | Implemented in UI + repository |
| Reload persistence | Firestore-backed |
| Study switch isolation | Study-scoped paths |
| VIEWER / ADVISER cannot modify | UI + `firestore.rules` |
| OWNER / COLLABORATOR can modify | UI + rules |
| `npm run build` | Succeeded |

Manual browser CRUD against a live Firebase project should be spot-checked with OWNER vs VIEWER accounts.

---

## 8. Remaining issues / notes

1. **Existing Phase 2 studies** without formulations are seeded on first Research Data page visit (idempotent). Studies that already have partial custom data are not overwritten.
2. **Reference orphan links:** deleting a Reference does not cascade-clear `referenceIds` on other records (UI shows “missing”).
3. **Canonical formulation edits:** OWNER/COLLABORATOR can still edit the seeded NanoHepatoTea record; discipline is by contract + `isCanonical` badge, not a hard lock.
4. **Types leftovers:** `types/index.ts` still declares legacy `CellLine` / `ProteinTarget` shapes (quarantined fields). Harmless for Phase 3; clean up when Laboratory/Docking modules land.
5. **Not started (by design):** ADMET, Vina, prediction models, lab replicate entry, statistics, comparison, interpretation, Storage.

---

## 9. Stop point

Phase 3 Research Data is complete for review. Do not proceed to engines / lab entry until this summary is accepted.
