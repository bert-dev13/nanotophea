import type { PredictionFeatures } from "@/lib/predictions/types"
import { hill, mix, prototypeFactor, round } from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [50, 100, 250, 500]

export function simulateBax(features: PredictionFeatures): PrototypePredictionResult {
  const factor = prototypeFactor("bax", features)
  const midpoint = round(mix(factor, 90, 360), 2)
  const slope = round(mix(factor, 1, 1.5), 2)
  const maximum = round(mix(factor, 25, 70), 2)
  const series = CONCENTRATIONS.map((concentration) => ({
    concentration,
    concentrationUnit: "ug_per_mL",
    metric: "bax_response",
    value: round(1 + hill(concentration, midpoint, slope, maximum) / 50),
    unit: "fold",
  }))
  const signal = hill(250, midpoint, slope, maximum)
  const bax = round(1 + signal / 50, 3)
  const bcl2 = round(Math.max(0.2, 1 - signal / 150), 3)
  const early = round(signal * 0.25, 1)
  const late = round(signal * 0.35, 1)
  const necrotic = round(signal * 0.1, 1)
  const viable = round(Math.max(0, 100 - early - late - necrotic), 1)
  return finishPrototype({
    endpoint: "bax",
    modelName: "NANO-HEPATOTEA BAX",
    features,
    series,
    outputs: {
      "BAX response": { value: bax, unit: "fold at 250 µg/mL" },
      "BCL-2 response": { value: bcl2, unit: "fold at 250 µg/mL" },
      "BAX/BCL-2 ratio": { value: round(bax / bcl2, 3), unit: "ratio" },
      "Caspase-3 response": { value: round(1 + signal / 80, 3), unit: "fold at 250 µg/mL" },
      Viable: { value: viable, unit: "%" },
      "Early apoptotic": { value: early, unit: "%" },
      "Late apoptotic": { value: late, unit: "%" },
      Necrotic: { value: necrotic, unit: "%" },
    },
  })
}
