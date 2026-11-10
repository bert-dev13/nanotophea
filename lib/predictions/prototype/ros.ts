import type { PredictionFeatures } from "@/lib/predictions/types"
import { exploratoryIdentityFactor, hill, mix, round } from "@/lib/predictions/prototype/math"
import { finishPrototype, type PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [50, 100, 250, 500]

export const ROS_ASSUMPTIONS =
  "Exploratory SIMULATION of a relative oxidative-stress index for a selected compound × cell line. Built only from recorded identity fields. Docking affinities are excluded. Values are not DCFH-DA fluorescence, not spectrophotometer readings, and not mitochondrial membrane potential (ΔΨm). Chemical DPPH radical scavenging does not establish intracellular ROS. Not experimental ROS."

export function simulateRos(features: PredictionFeatures): PrototypePredictionResult {
  const factor = exploratoryIdentityFactor("ros", features)
  const midpoint = round(mix(factor, 70, 320), 2)
  const slope = round(mix(factor, 0.9, 1.5), 2)
  const maximum = round(mix(factor, 30, 80), 2)
  const series = CONCENTRATIONS.map((concentration) => ({
    concentration,
    concentrationUnit: "ug_per_mL",
    metric: "exploratory_relative_ros_index",
    value: round(1 + hill(concentration, midpoint, slope, maximum) / 100),
    unit: "fold-scale index",
  }))
  const at250 = series.find((point) => point.concentration === 250)?.value ?? 0
  return finishPrototype({
    endpoint: "ros",
    modelName: "HEPATOTEA ROS (exploratory)",
    features,
    series,
    assumptions: ROS_ASSUMPTIONS,
    outputs: {
      "Exploratory relative ROS index": { value: at250, unit: "fold-scale at 250 µg/mL (not fluorescence)" },
      "Exploratory Hill midpoint (µg/mL)": { value: midpoint, unit: "µg/mL (demonstration only)" },
    },
  })
}
