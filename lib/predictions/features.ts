import type { PredictionFeatures } from "@/lib/predictions/types"

export interface FeatureSource {
  studyId: string
  compound: {
    id: string
    name: string
    pubchemCid?: number
    molecularWeight?: number
    formula?: string
  }
  cellLine?: { id: string; name: string }
  proteins: Array<{ id: string; name: string }>
  docking: Array<{ proteinId: string; proteinName?: string; affinityKcalMol?: number }>
  admeDescriptors?: Record<string, string | number | boolean | null | undefined>
}

/** Copies only values that already exist on the study. */
export function assembleFeatures(source: FeatureSource): PredictionFeatures {
  const docking = source.docking.flatMap((row) => {
    if (row.affinityKcalMol == null || !Number.isFinite(row.affinityKcalMol)) return []
    return [{ proteinId: row.proteinId, proteinName: row.proteinName, affinityKcalMol: row.affinityKcalMol }]
  })
  const admeDescriptors: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(source.admeDescriptors ?? {})) {
    if (typeof value === "number" && Number.isFinite(value)) admeDescriptors[key] = value
    else if (typeof value === "string" && value.trim()) admeDescriptors[key] = value.trim()
    else if (typeof value === "boolean") admeDescriptors[key] = value
  }
  return {
    studyId: source.studyId,
    phytochemicalId: source.compound.id,
    phytochemicalName: source.compound.name,
    ...(source.compound.pubchemCid != null ? { pubchemCid: source.compound.pubchemCid } : {}),
    ...(source.compound.molecularWeight != null && Number.isFinite(source.compound.molecularWeight)
      ? { molecularWeight: source.compound.molecularWeight }
      : {}),
    ...(source.compound.formula ? { formula: source.compound.formula } : {}),
    ...(source.cellLine ? { cellLineId: source.cellLine.id, cellLineName: source.cellLine.name } : {}),
    targetProteinIds: source.proteins.map((protein) => protein.id),
    docking,
    admeDescriptors,
  }
}
