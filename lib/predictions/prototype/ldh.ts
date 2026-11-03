import type { PredictionFeatures } from "@/lib/predictions/types"
import { hill, mix, prototypeFactor, round } from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [50, 100, 250, 500]

export function simulateLdh(features: PredictionFeatures): PrototypePredictionResult {
  const factor = prototypeFactor("ldh", features)
  const midpoint = round(mix(factor, 80, 400), 2)
  const slope = round(mix(factor, 1, 1.7), 2)
  const maximum = round(mix(factor, 40, 85), 2)
  const series = CONCENTRATIONS.map((concentration) => ({
    concentration,
    concentrationUnit: "ug_per_mL",
    metric: "predicted_cytotoxicity",
    value: round(hill(concentration, midpoint, slope, maximum)),
    unit: "%",
  }))
  const at250 = series.find((point) => point.concentration === 250)?.value ?? 0
  return finishPrototype({
    endpoint: "ldh",
    modelName: "NANO-HEPATOTEA LDH",
    features,
    series,
    outputs: {
      "Predicted OD": { value: round(0.12 + 0.9 * (at250 / 100), 3), unit: "AU" },
      "LDH release": { value: at250, unit: "% at 250 µg/mL" },
      "Cytotoxicity %": { value: at250, unit: "%" },
      "Membrane disruption estimate": { value: round(at250 / 100, 3), unit: "score" },
    },
  })
}
