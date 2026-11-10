/**
 * Phytochemical analysis viewing modes for multi-compound tea formulations.
 * Combined view is compositional display + per-compound traceability only.
 * It must not average docking affinities, merge prediction curves, or claim synergy.
 */

export type PhytochemicalAnalysisViewMode = "individual" | "combined"

export const PHYTOCHEMICAL_ANALYSIS_VIEW_LABEL: Record<PhytochemicalAnalysisViewMode, string> = {
  individual: "Individual Phytochemical View",
  combined: "Combined Phytochemicals View (Tea Formulation)",
}

export const TEA_FORMULATION_COMPOSITION_TITLE = "Phyllanthus niruri tea phytochemical composition"

export const COMBINED_VIEW_SCIENTIFIC_NOTE =
  "Combined view lists the selected phytochemicals as the tea formulation composition. Each compound keeps its own identity and recorded results. Docking affinities and prediction outputs are not averaged or fused. Synergistic or combined biological activity is not claimed without appropriate experimental or validated computational methods."

const STORAGE_PREFIX = "hepatotea.phytochemicalAnalysisView."

export function isPhytochemicalAnalysisViewMode(value: unknown): value is PhytochemicalAnalysisViewMode {
  return value === "individual" || value === "combined"
}

export function readPhytochemicalAnalysisViewMode(studyId: string | null | undefined): PhytochemicalAnalysisViewMode {
  if (!studyId || typeof window === "undefined") return "individual"
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${studyId}`)
    return isPhytochemicalAnalysisViewMode(raw) ? raw : "individual"
  } catch {
    return "individual"
  }
}

export function writePhytochemicalAnalysisViewMode(
  studyId: string | null | undefined,
  mode: PhytochemicalAnalysisViewMode,
): void {
  if (!studyId || typeof window === "undefined") return
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${studyId}`, mode)
  } catch {
    // Ignore storage failures; mode still works in-session.
  }
}

export interface FormulationCompoundIdentity {
  id: string
  name: string
  pubchemCid?: number | null
  formula?: string | null
  chemicalClass?: string | null
  smiles?: string | null
}

export function formulationCompoundLine(compound: FormulationCompoundIdentity): string {
  const bits = [compound.name]
  if (compound.pubchemCid) bits.push(`CID ${compound.pubchemCid}`)
  if (compound.formula) bits.push(compound.formula)
  if (compound.chemicalClass) bits.push(compound.chemicalClass)
  return bits.join(" · ")
}

/** Honest composition count copy for the combined tea formulation view. */
export function formulationCompositionCaption(compoundCount: number): string {
  if (compoundCount <= 0) return "No phytochemicals are selected in Research Setup for this study."
  if (compoundCount === 1) {
    return "This tea formulation currently contains 1 selected phytochemical from Research Setup. Add more compounds in Research Setup to represent a multi-compound Phyllanthus niruri composition."
  }
  return `This tea formulation lists all ${compoundCount} phytochemicals selected in Research Setup. Each compound keeps its own identity and recorded results.`
}

/**
 * Combined docking rows for every Research Setup phytochemical × target protein.
 * Unscreened compounds remain visible with an explicit pending status — they are not dropped.
 */
export function buildCombinedDockingResultRows(input: {
  studyCompounds: Array<{ id: string; name: string }>
  proteins: Array<{ id: string; name: string; gene?: string | null }>
  pairs: Array<{
    compoundId: string
    proteinId: string
    proteinName: string
    proteinGene?: string | null
    affinityLabel: string
    statusLabel: string
    detail: string
  }>
  eligibleCompoundIds: Set<string>
}): Array<{
  compoundId: string
  context: string
  result: string
  detail?: string
  evidence?: string
}> {
  const byPair = new Map(input.pairs.map((pair) => [`${pair.compoundId}:${pair.proteinId}`, pair]))
  const rows: Array<{
    compoundId: string
    context: string
    result: string
    detail?: string
    evidence?: string
  }> = []
  const compounds = [...input.studyCompounds].sort((a, b) => a.name.localeCompare(b.name))
  const proteins = [...input.proteins].sort((a, b) => a.name.localeCompare(b.name))
  for (const compound of compounds) {
    if (!proteins.length) {
      rows.push({
        compoundId: compound.id,
        context: "No target proteins selected",
        result: "Awaiting target selection",
        detail: "Select target proteins in Research Setup to create docking pairs.",
        evidence: "Individual compound · no pair yet",
      })
      continue
    }
    for (const protein of proteins) {
      const hit = byPair.get(`${compound.id}:${protein.id}`)
      if (hit) {
        rows.push({
          compoundId: compound.id,
          context: `${hit.proteinName}${hit.proteinGene ? ` (${hit.proteinGene})` : ""}`,
          result: hit.affinityLabel,
          detail: hit.detail,
          evidence: "Individual ligand–receptor docking (not a formulation average)",
        })
        continue
      }
      const eligible = input.eligibleCompoundIds.has(compound.id)
      rows.push({
        compoundId: compound.id,
        context: `${protein.name}${protein.gene ? ` (${protein.gene})` : ""}`,
        result: eligible ? "Not yet docked" : "Not yet eligible for docking",
        detail: eligible
          ? `Pair ${compound.name} × ${protein.name} has no completed docking run.`
          : "Complete In-Silico screening for this phytochemical before docking pairs are created. The compound remains part of the tea formulation composition.",
        evidence: "Individual compound status (not omitted from formulation)",
      })
    }
  }
  return rows
}
