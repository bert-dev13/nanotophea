import type { PredictionFeatures } from "@/lib/predictions/types"
import { exploratoryIdentityFactor, hill, mix, round } from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [50, 100, 250, 500]

export const MTT_ASSUMPTIONS =
  "Exploratory SIMULATION of metabolic viability context for a selected compound × cell line. Built only from recorded identity fields (compound + cell line). Docking affinities are excluded: ligand–receptor ΔG does not measure MTT metabolic activity. The Hill midpoint is not an experimentally fitted IC50. No selectivity index is reported without paired normal/cancer IC50 data. MTT reflects metabolic activity, not definitive cell death. Not experimental MTT absorbance processing."

export function simulateMtt(features: PredictionFeatures): PrototypePredictionResult {
  const factor = exploratoryIdentityFactor("mtt", features)
  const midpoint = round(mix(factor, 60, 350), 2)
  const slope = round(mix(factor, 1, 1.6), 2)
  const ceiling = round(mix(factor, 55, 90), 2)
  const series = CONCENTRATIONS.map((concentration) => {
    const inhibition = hill(concentration, midpoint, slope, ceiling)
    return {
      concentration,
      concentrationUnit: "ug_per_mL",
      metric: "exploratory_metabolic_viability",
      value: round(Math.max(0, 100 - inhibition)),
      unit: "%",
    }
  })
  const maxInhibition = round(hill(500, midpoint, slope, ceiling))
  return finishPrototype({
    endpoint: "mtt",
    modelName: "HEPATOTEA MTT (exploratory)",
    features,
    series,
    assumptions: MTT_ASSUMPTIONS,
    outputs: {
      "Metabolic viability": { value: series[0]?.value ?? 0, unit: "% at 50 µg/mL" },
      "Exploratory Hill midpoint (µg/mL)": { value: midpoint, unit: "µg/mL (not fitted IC50)" },
      "Maximum metabolic inhibition (exploratory)": { value: maxInhibition, unit: "%" },
    },
  })
}
