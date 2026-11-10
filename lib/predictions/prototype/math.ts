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

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * Exploratory identity factor for MTT / LDH / ROS / BAX demonstration curves.
 * Uses only recorded compound / cell-line / target identity fields.
 * Docking affinities are intentionally excluded — ligand–receptor ΔG must not
 * manufacture viability, LDH release, ROS, or apoptosis assay outcomes.
 * DPPH and Hippo–YAP use their own endpoint-specific factor functions.
 */
export function exploratoryIdentityFactor(endpoint: string, features: PredictionFeatures): number {
  return demonstrationFactor([
    `${endpoint}-exploratory-identity`,
    features.phytochemicalId,
    features.phytochemicalName,
    features.pubchemCid,
    features.molecularWeight,
    features.formula,
    features.cellLineId,
    features.cellLineName,
    features.targetProteinIds.join(","),
  ])
}

/** @deprecated Prefer exploratoryIdentityFactor — kept as an alias without docking. */
export function prototypeFactor(endpoint: string, features: PredictionFeatures): number {
  return exploratoryIdentityFactor(endpoint, features)
}

export const PROTOTYPE_ASSUMPTIONS =
  "Exploratory Hill-style demonstration curve from recorded compound/cell-line/target identity only. Not a validated assay model. Docking affinities are not used as assay drivers."

/** Count atoms for an element symbol in a molecular formula (e.g. O in C15H10O5 → 5). */
export function countElementAtoms(formula: string | undefined, element: string): number {
  if (!formula) return 0
  const escaped = element.replace(/[^A-Za-z]/g, "")
  if (!escaped) return 0
  const match = formula.match(new RegExp(`${escaped}(\\d*)`))
  if (!match) return 0
  return match[1] ? Number(match[1]) : 1
}

/** Read a numeric ADME / descriptor value under any of the accepted keys. */
export function numericDescriptor(
  features: PredictionFeatures,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const direct = features.admeDescriptors[key]
    if (typeof direct === "number" && Number.isFinite(direct)) return direct
    if (typeof direct === "string") {
      const parsed = Number.parseFloat(direct)
      if (Number.isFinite(parsed)) return parsed
    }
    const found = Object.entries(features.admeDescriptors).find(
      ([name]) => name.toLowerCase() === key.toLowerCase(),
    )
    if (!found) continue
    const value = found[1]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

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
