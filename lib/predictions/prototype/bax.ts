import type { PredictionFeatures } from "@/lib/predictions/types"
import { exploratoryIdentityFactor, hill, mix, round } from "@/lib/predictions/prototype/math"
import {
  finishPrototype,
  type PrototypePredictionResult,
  type PrototypeRunResult,
} from "@/lib/predictions/prototype/types"

const CONCENTRATIONS = [50, 100, 250, 500]

export const BAX_ASSUMPTIONS =
  "Exploratory SIMULATION of a BAX-target context response index for a selected phytochemical × BAX-named target. Built only from recorded identity fields (compound + target). Docking affinities are excluded as apoptosis drivers. This is not BAX protein/gene expression, not BCL-2, not caspase-3, not Annexin V/PI, and not flow-cytometry population percentages. Not Western blot. Not a validated apoptosis model."

/**
 * Exploratory BAX-target context curve only.
 * Does not invent expression folds for BCL-2/caspase or Annexin populations.
 * Requires a BAX-associated target id in features.
 */
export function simulateBax(features: PredictionFeatures): PrototypeRunResult {
  if (!features.targetProteinIds.length) {
    return {
      status: "unavailable",
      endpoint: "bax",
      evidenceClass: "SIMULATION",
      reason: "A BAX-associated target protein must be selected before an exploratory BAX-target context simulation can run.",
      missing: ["targetProteinIds"],
    }
  }

  const factor = exploratoryIdentityFactor("bax", features)
  const midpoint = round(mix(factor, 90, 360), 2)
  const slope = round(mix(factor, 1, 1.5), 2)
  const maximum = round(mix(factor, 25, 70), 2)
  const series = CONCENTRATIONS.map((concentration) => ({
    concentration,
    concentrationUnit: "ug_per_mL",
    metric: "exploratory_bax_target_context",
    value: round(hill(concentration, midpoint, slope, maximum)),
    unit: "index",
  }))
  const at250 = series.find((point) => point.concentration === 250)?.value ?? 0
  return finishPrototype({
    endpoint: "bax",
    modelName: "HEPATOTEA BAX (exploratory)",
    features,
    series,
    assumptions: BAX_ASSUMPTIONS,
    note: "Only an exploratory BAX-target context index is shown. Expression markers and cytometry populations are not generated.",
    outputs: {
      "Exploratory BAX-target context response": {
        value: at250,
        unit: "index at 250 µg/mL (not expression fold)",
      },
      "Exploratory Hill midpoint (µg/mL)": { value: midpoint, unit: "µg/mL (demonstration only)" },
    },
  })
}

/** Narrow helper for callers that already checked availability. */
export function simulateBaxOrThrow(features: PredictionFeatures): PrototypePredictionResult {
  const result = simulateBax(features)
  if (result.status === "unavailable") throw new Error(result.reason)
  return result
}
