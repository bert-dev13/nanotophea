# HEPATOTEA — ROS oxidative-stress protein targets

## Outcome

Researchers can multi-select curated oxidative-stress proteins when configuring a ROS exploratory simulation, inspect available structure/docking context, and retain the selection on the stored run for traceability.

## Curated targets

| Gene | Protein | Structure in HEPATOTEA | Docking |
| --- | --- | --- | --- |
| KEAP1 | Kelch-like ECH-associated protein 1 | Curated PDB **8EJR** | Curated receptor profile `KEAP1_NRF2_PROFILE` |
| NFE2L2 (NRF2) | Nrf2 | Not curated (UniProt Q16236) | Pathway partner of KEAP1 docking — not a curated receptor |
| NQO1 | NAD(P)H dehydrogenase [quinone] 1 | Not curated (UniProt P15559) | No curated Vina profile |
| HMOX1 (HO-1) | Heme oxygenase 1 | Not curated (UniProt P09601) | No curated Vina profile |
| SOD1 | Superoxide dismutase [Cu-Zn] | Not curated (UniProt P00441) | No curated Vina profile |
| CAT | Catalase | Not curated (UniProt P04040) | No curated Vina profile |
| GPX1 | Glutathione peroxidase 1 | Not curated (UniProt P07203) | No curated Vina profile |
| NOX4 | NADPH oxidase 4 | Not curated (UniProt Q9NPH5) | No curated Vina profile |

No PDB IDs were invented for non-curated targets. Catalog entries were added under Research Setup so researchers can add study proteins without fabricating structures.

## Scientific boundaries

- ROS remains an **exploratory SIMULATION** (compound × cell line).
- Selected targets are **investigation context**, not experimental biomarkers.
- `simulateRos` formulas and identity inputs are unchanged; targets are **not** passed as `features.targetProteinIds`.
- Docking ΔG, when present for KEAP1, is stored as **separate docking context** (`meta:rosOxidativeTarget.*.dockingVsRos`) and does not drive the ROS index.
- Molecular docking results are visually and textually distinguished from ROS assay outputs.

## Implementation map

- `lib/predictions/rosOxidativeTargets.ts` — curated catalog, matching, persistence helpers
- `lib/catalog/reusableResearchCatalog.ts` — antioxidant catalog proteins (verified UniProt; KEAP1 PDB only)
- `lib/predictions/store.ts` — `rosOxidativeTargets` → `input_parameters` on ROS runs
- `components/study/RosOxidativeTargetPicker.tsx` — multi-select + structure/details UI
- `components/study/BiologicalPredictionsWorkspace.tsx` — ROS configuration + recorded-target section
- `lib/predictions/rosOxidativeTargets.test.ts` — catalog / persistence / non-driver guards

## Persistence keys

- `meta:rosOxidativeTargetKeys`, `meta:rosOxidativeTargetGenes`, `meta:rosOxidativeTargetCount`
- `meta:rosOxidativeTargetsDriveAssay = false`
- Per-target `meta:rosOxidativeTarget.{i}.*` (gene, name, structure availability, optional docking context)
