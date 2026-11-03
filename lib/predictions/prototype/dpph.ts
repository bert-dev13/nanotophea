import type { PredictionFeatures } from "@/lib/predictions/types"
import { hill, mix, prototypeFactor, round } from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [0, 3.13, 6.25, 12.5, 25, 50, 100]

export function simulateDpph(features: PredictionFeatures): PrototypePredictionResult {
  const factor = prototypeFactor("dpph", features)
  const midpoint = round(mix(factor, 8, 45), 2)
  const slope = round(mix(factor, 1, 1.8), 2)
  const maximum = round(mix(1 - factor, 65, 95), 2)
  const series = CONCENTRATIONS.map((concentration) => ({
    concentration,
    concentrationUnit: "uM",
    metric: "predicted_scavenging",
    value: round(hill(concentration, midpoint, slope, maximum)),
    unit: "%",
  }))
  return finishPrototype({
    endpoint: "dpph",
    modelName: "NANO-HEPATOTEA DPPH",
    features,
    series,
    outputs: {
      "Scavenging response": { value: series[series.length - 1]?.value ?? 0, unit: "%" },
      IC50: { value: midpoint, unit: "µM" },
      "Maximum scavenging": { value: maximum, unit: "%" },
      TEAC: { value: round(maximum / 100, 3), unit: "ratio" },
      "Relative potency": { value: round(20 / midpoint, 3), unit: "vs 20 µM reference" },
    },
  })
}
