import type { PredictionFeatures } from "@/lib/predictions/types"

/** Stable 0–1 factor from recorded identity fields. Same inputs always return the same factor. */
export function demonstrationFactor(parts: Array<string | number | undefined>): number {
  const text = parts.filter((part) => part != null && String(part).trim() !== "").join("|")
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967296
}

export function mix(factor: number, min: number, max: number): number {
  const span = Math.min(1, Math.max(0, factor))
  return min + span * (max - min)
}

/** Generic Hill curve. Parameters are demonstration inputs, not fitted biological constants. */
export function hill(concentration: number, midpoint: number, slope: number, maximum: number): number {
  if (!(concentration > 0) || !(midpoint > 0) || !(maximum > 0)) return 0
  const ratio = (concentration / midpoint) ** slope
  return (maximum * ratio) / (1 + ratio)
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function prototypeFactor(endpoint: string, features: PredictionFeatures): number {
  const affinity = features.docking.find((row) => Number.isFinite(row.affinityKcalMol))?.affinityKcalMol
  const identity = demonstrationFactor([
    endpoint,
    features.phytochemicalName,
    features.pubchemCid,
    features.molecularWeight,
    features.formula,
    features.cellLineName,
    features.targetProteinIds.join(","),
    ...Object.keys(features.admeDescriptors).sort(),
  ])
  if (affinity == null) return identity
  const scaled = Math.min(1, Math.max(0, (-affinity - 4) / 8))
  return (identity + scaled) / 2
}

export const PROTOTYPE_ASSUMPTIONS =
  "Hill-style concentration response scaled from the compound identity and recorded descriptors or docking affinity."

export function inputFeatureLines(features: PredictionFeatures): string[] {
  const lines = [`Compound ${features.phytochemicalName}`]
  if (features.pubchemCid != null) lines.push(`PubChem CID ${features.pubchemCid}`)
  if (features.molecularWeight != null) lines.push(`Molecular weight ${features.molecularWeight}`)
  if (features.formula) lines.push(features.formula)
  if (features.cellLineName) lines.push(`Cell line ${features.cellLineName}`)
  if (features.targetProteinIds.length) lines.push(`Targets ${features.targetProteinIds.join(", ")}`)
  for (const row of features.docking) lines.push(`Docking ${row.proteinName ?? row.proteinId} ${row.affinityKcalMol} kcal/mol`)
  for (const [key, value] of Object.entries(features.admeDescriptors)) lines.push(`ADME ${key} ${String(value)}`)
  return lines
}
