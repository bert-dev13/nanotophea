import type { PredictionFeatures } from "@/lib/predictions/types"
import { hill, mix, prototypeFactor, round } from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [50, 100, 250, 500]

export function simulateHippoYap(features: PredictionFeatures): PrototypePredictionResult {
  const factor = prototypeFactor("hippo_yap", features)
  const midpoint = round(mix(factor, 80, 340), 2)
  const slope = round(mix(factor, 0.9, 1.6), 2)
  const maximum = round(mix(factor, 20, 75), 2)
  const series = CONCENTRATIONS.map((concentration) => ({
    concentration,
    concentrationUnit: "ug_per_mL",
    metric: "yap1_response",
    value: round(hill(concentration, midpoint, slope, maximum)),
    unit: "%",
  }))
  const yap = series.find((point) => point.concentration === 250)?.value ?? 0
  return finishPrototype({
    endpoint: "hippo_yap",
    modelName: "NANOTOPHEA Hippo–YAP",
    features,
    series,
    note: yap >= 40
      ? "The response is higher at the upper concentrations."
      : "The response stays lower across the concentrations.",
    outputs: {
      "YAP1 response": { value: yap, unit: "% at 250 µg/mL" },
      "p-YAP response": { value: round(yap * 0.8), unit: "%" },
      "LATS1 response": { value: round(yap * 0.7), unit: "%" },
      "TEAD4 response": { value: round(yap * 0.5), unit: "%" },
      "Pathway response": { value: yap, unit: "% YAP1 response at 250 µg/mL" },
    },
  })
}
