import type { PredictionFeatures } from "@/lib/predictions/types"
import { exploratoryIdentityFactor, hill, mix, round } from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [50, 100, 250, 500]

export const LDH_ASSUMPTIONS =
  "Exploratory SIMULATION of a membrane-damage index for a selected compound × cell line. Built only from recorded identity fields. Docking affinities are excluded. No spectrophotometer absorbance (OD) is invented. Experimental LDH % cytotoxicity requires measured sample, spontaneous, and maximum-release controls via the laboratory module formula (OD_sample − OD_spontaneous) / (OD_max − OD_spontaneous) × 100. This module is not that experimental calculation."

export function simulateLdh(features: PredictionFeatures): PrototypePredictionResult {
  const factor = exploratoryIdentityFactor("ldh", features)
  const midpoint = round(mix(factor, 80, 400), 2)
  const slope = round(mix(factor, 1, 1.7), 2)
  const maximum = round(mix(factor, 40, 85), 2)
  const series = CONCENTRATIONS.map((concentration) => ({
    concentration,
    concentrationUnit: "ug_per_mL",
    metric: "exploratory_membrane_damage_index",
    value: round(hill(concentration, midpoint, slope, maximum)),
    unit: "%",
  }))
  const at250 = series.find((point) => point.concentration === 250)?.value ?? 0
  return finishPrototype({
    endpoint: "ldh",
    modelName: "HEPATOTEA LDH (exploratory)",
    features,
    series,
    assumptions: LDH_ASSUMPTIONS,
    outputs: {
      "Exploratory membrane-damage index": { value: at250, unit: "% at 250 µg/mL" },
      "Exploratory Hill midpoint (µg/mL)": { value: midpoint, unit: "µg/mL (not fitted IC50)" },
    },
  })
}
