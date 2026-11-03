import type { PredictionFeatures } from "@/lib/predictions/types"
import { hill, mix, prototypeFactor, round } from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [50, 100, 250, 500]

export function simulateRos(features: PredictionFeatures): PrototypePredictionResult {
  const factor = prototypeFactor("ros", features)
  const midpoint = round(mix(factor, 70, 320), 2)
  const slope = round(mix(factor, 0.9, 1.5), 2)
  const maximum = round(mix(factor, 30, 80), 2)
  const series = CONCENTRATIONS.map((concentration) => ({
    concentration,
    concentrationUnit: "ug_per_mL",
    metric: "ros_response",
    value: round(1 + hill(concentration, midpoint, slope, maximum) / 100),
    unit: "fold",
  }))
  const stress = round(hill(250, midpoint, slope, maximum))
  const mitochondrial = round(hill(250, midpoint, round(slope + 0.2, 2), maximum * 0.8))
  return finishPrototype({
    endpoint: "ros",
    modelName: "NANO-HEPATOTEA ROS",
    features,
    series,
    outputs: {
      "ROS response": { value: series.find((point) => point.concentration === 250)?.value ?? 0, unit: "fold at 250 µg/mL" },
      "Oxidative stress estimate": { value: stress, unit: "score" },
      "Mitochondrial response": { value: mitochondrial, unit: "score" },
    },
  })
}
