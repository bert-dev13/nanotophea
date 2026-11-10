import type { PredictionFeatures } from "@/lib/predictions/types"
import {
  clamp01,
  countElementAtoms,
  demonstrationFactor,
  hill,
  mix,
  numericDescriptor,
  round,
} from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

/** Study-design in-silico DPPH grid (µM). Blank at 0; working range 3.13–100. */
const CONCENTRATIONS_UM = [0, 3.13, 6.25, 12.5, 25, 50, 100]

export const DPPH_ASSUMPTIONS =
  "Exploratory SIMULATION of DPPH radical-scavenging potential from compound identity and physicochemical cues (molecular weight, formula oxygen count, optional H-bond donor / TPSA descriptors when recorded). Docking affinities are intentionally excluded: ligand–receptor ΔG does not measure antioxidant radical scavenging. The Hill midpoint is not an experimentally fitted IC50. The maximum-response ratio is not Trolox Equivalent Antioxidant Capacity (TEAC). Not a validated QSAR. Not experimental DPPH (µg/mL T1–T6)."

/**
 * Antioxidant-oriented 0–1 potency score.
 * Higher ≈ more radical-scavenging-like physicochemical profile.
 * Does not use docking affinities.
 */
export function antioxidantPotencyFactor(features: PredictionFeatures): number {
  const identity = demonstrationFactor([
    "dpph-antioxidant",
    features.phytochemicalId,
    features.phytochemicalName,
    features.pubchemCid,
    features.formula,
    features.molecularWeight,
  ])

  const mw = features.molecularWeight
  let mwScore = 0.5
  if (mw != null && mw > 0) {
    if (mw >= 180 && mw <= 650) mwScore = 0.78
    else if (mw < 180) mwScore = 0.42
    else mwScore = 0.32
  }

  const oxygenAtoms = countElementAtoms(features.formula, "O")
  const oxygenScore = mix(clamp01(oxygenAtoms / 12), 0.22, 0.92)

  const hbd = numericDescriptor(features, ["hBondDonors", "HBondDonorCount", "nHBDon", "hbd"])
  const hbdScore = hbd != null ? mix(clamp01(hbd / 10), 0.28, 0.95) : 0.5

  const tpsa = numericDescriptor(features, ["tpsa", "TPSA"])
  const tpsaScore = tpsa != null ? mix(clamp01(tpsa / 220), 0.28, 0.92) : 0.5

  const phenolicName = /flavon|phenol|catechin|quercetin|rutin|luteolin|gallic|tannin|ellagic|kaempferol|apigenin/i.test(
    features.phytochemicalName,
  )
  const nameBoost = phenolicName ? 0.12 : 0

  return clamp01(
    0.28 * identity + 0.18 * mwScore + 0.2 * oxygenScore + 0.16 * hbdScore + 0.14 * tpsaScore + nameBoost,
  )
}

export function simulateDpph(features: PredictionFeatures): PrototypePredictionResult {
  const potency = antioxidantPotencyFactor(features)
  // Stronger scavenger profile → lower µM midpoint, higher maximum % scavenging.
  const midpoint = round(mix(1 - potency, 6, 58), 2)
  const slope = round(mix(potency, 1.05, 1.85), 2)
  const maximum = round(mix(potency, 58, 96), 2)
  const series = CONCENTRATIONS_UM.map((concentration) => ({
    concentration,
    concentrationUnit: "uM",
    metric: "predicted_scavenging",
    value: round(hill(concentration, midpoint, slope, maximum)),
    unit: "%",
  }))
  const at100 = series[series.length - 1]?.value ?? 0
  return finishPrototype({
    endpoint: "dpph",
    modelName: "HEPATOTEA DPPH (exploratory)",
    features,
    series,
    assumptions: DPPH_ASSUMPTIONS,
    outputs: {
      "Scavenging response": { value: at100, unit: "% at 100 µM" },
      "Exploratory Hill midpoint (µM)": { value: midpoint, unit: "µM (not fitted IC50)" },
      "Maximum scavenging": { value: maximum, unit: "%" },
      "Exploratory maximum response ratio": { value: round(maximum / 100, 3), unit: "ratio (not TEAC)" },
      "Relative potency index": { value: round(20 / Math.max(midpoint, 0.01), 3), unit: "vs 20 µM reference" },
    },
  })
}
