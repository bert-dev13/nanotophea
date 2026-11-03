import type { PredictionFeatures } from "@/lib/predictions/types"
import { hill, mix, prototypeFactor, round } from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [50, 100, 250, 500]

export function simulateMtt(features: PredictionFeatures): PrototypePredictionResult {
  const factor = prototypeFactor("mtt", features)
  const midpoint = round(mix(factor, 60, 350), 2)
  const slope = round(mix(factor, 1, 1.6), 2)
  const ceiling = round(mix(factor, 55, 90), 2)
  const series = CONCENTRATIONS.map((concentration) => {
    const inhibition = hill(concentration, midpoint, slope, ceiling)
    return {
      concentration,
      concentrationUnit: "ug_per_mL",
      metric: "predicted_viability",
      value: round(Math.max(0, 100 - inhibition)),
      unit: "%",
    }
  })
  const maxInhibition = round(hill(500, midpoint, slope, ceiling))
  return finishPrototype({
    endpoint: "mtt",
    modelName: "NANO-HEPATOTEA MTT",
    features,
    series,
    outputs: {
      IC50: { value: midpoint, unit: "µg/mL" },
      Viability: { value: series[0]?.value ?? 0, unit: "% at 50 µg/mL" },
      "Maximum inhibition": { value: maxInhibition, unit: "%" },
      "Selectivity index": { value: round(250 / midpoint, 3), unit: "250 µg/mL reference ÷ midpoint" },
    },
  })
}
