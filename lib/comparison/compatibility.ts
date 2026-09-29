/**
 * Compatibility rules for Prediction vs Experimental (Phase 9).
 * Binding: STUDY_DESIGN_CONTRACT.md §10
 */

import type { LabDataset, PredictionRun } from "@/lib/domain/models"
import type { ComparisonEndpoint } from "@/lib/comparison/metrics"
import { getPredictionEndpoint } from "@/lib/insilico/predictionEndpoints"

export type CompatibilityStatus = "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE"

export interface CompatibilityResult {
  status: CompatibilityStatus
  reasons: string[]
  /** Whether concentration-aligned numeric comparison is scientifically allowed */
  allowAlignedComparison: boolean
  comparisonModeHint: "SIDE_BY_SIDE" | "ALIGNED"
}

export const COMPARISON_ELIGIBLE_ENDPOINTS = ["dpph", "ldh"] as const

export function isComparisonEligibleEndpoint(v: string): v is ComparisonEndpoint {
  return v === "dpph" || v === "ldh"
}

export function assessCompatibility(input: {
  endpoint: ComparisonEndpoint
  prediction: PredictionRun
  dataset: LabDataset
  experimentalHasMeasurements: boolean
  matchingConcentrationCount: number
  predictionPointCount: number
}): CompatibilityResult {
  const reasons: string[] = []
  const { endpoint, prediction, dataset } = input

  if (!isComparisonEligibleEndpoint(endpoint)) {
    return {
      status: "INCOMPATIBLE",
      reasons: [`Endpoint "${endpoint}" has no experimental counterpart under the Study Design Contract.`],
      allowAlignedComparison: false,
      comparisonModeHint: "SIDE_BY_SIDE",
    }
  }

  const predEndpoint = prediction.endpoint ?? prediction.module
  if (predEndpoint !== endpoint) {
    return {
      status: "INCOMPATIBLE",
      reasons: [
        `Prediction endpoint (${predEndpoint}) does not match selected comparison endpoint (${endpoint}).`,
      ],
      allowAlignedComparison: false,
      comparisonModeHint: "SIDE_BY_SIDE",
    }
  }

  if (dataset.assayType !== endpoint) {
    return {
      status: "INCOMPATIBLE",
      reasons: [
        `Experimental dataset assay (${dataset.assayType}) does not match endpoint (${endpoint}).`,
      ],
      allowAlignedComparison: false,
      comparisonModeHint: "SIDE_BY_SIDE",
    }
  }

  const evidence = prediction.provenance?.evidenceClass
  if (evidence !== "PREDICTED" && evidence !== "SIMULATION") {
    return {
      status: "INCOMPATIBLE",
      reasons: [
        `Prediction evidence class must be PREDICTED or SIMULATION (got ${evidence ?? "missing"}).`,
      ],
      allowAlignedComparison: false,
      comparisonModeHint: "SIDE_BY_SIDE",
    }
  }

  if (dataset.provenance?.evidenceClass !== "EXPERIMENTAL") {
    return {
      status: "INCOMPATIBLE",
      reasons: ["Laboratory dataset must use evidence class EXPERIMENTAL."],
      allowAlignedComparison: false,
      comparisonModeHint: "SIDE_BY_SIDE",
    }
  }

  if (!input.experimentalHasMeasurements) {
    return {
      status: "INCOMPATIBLE",
      reasons: ["Experimental dataset has no usable measurement values for comparison."],
      allowAlignedComparison: false,
      comparisonModeHint: "SIDE_BY_SIDE",
    }
  }

  if (input.predictionPointCount < 1) {
    return {
      status: "INCOMPATIBLE",
      reasons: ["Prediction run has no stored result points."],
      allowAlignedComparison: false,
      comparisonModeHint: "SIDE_BY_SIDE",
    }
  }

  const cfg = getPredictionEndpoint(endpoint)

  // LDH-specific context
  if (endpoint === "ldh") {
    const cellName = (dataset.cellLineName || "").toLowerCase()
    if (!/hepg2/i.test(cellName)) {
      reasons.push("Experimental LDH requires HepG2 under the Study Design Contract.")
      return {
        status: "INCOMPATIBLE",
        reasons,
        allowAlignedComparison: false,
        comparisonModeHint: "SIDE_BY_SIDE",
      }
    }
    if (prediction.concentrationUnit !== "ug_per_mL") {
      reasons.push(
        `LDH prediction concentration unit is ${prediction.concentrationUnit}; experimental LDH uses µg/mL. Aligned comparison blocked.`
      )
      return {
        status: "PARTIAL",
        reasons: [
          ...reasons,
          "Side-by-side display allowed; concentration-aligned comparison requires µg/mL on both sides.",
        ],
        allowAlignedComparison: false,
        comparisonModeHint: "SIDE_BY_SIDE",
      }
    }

    if (input.matchingConcentrationCount === 0) {
      reasons.push(
        "No matching µg/mL concentrations between prediction points and experimental T3–T6 (50/100/250/500)."
      )
      return {
        status: "PARTIAL",
        reasons: [...reasons, "Side-by-side comparison only — do not invent matching points."],
        allowAlignedComparison: false,
        comparisonModeHint: "SIDE_BY_SIDE",
      }
    }

    if (input.matchingConcentrationCount < 4) {
      reasons.push(
        `Partial concentration alignment: ${input.matchingConcentrationCount} matching µg/mL point(s). Missing concentrations are not fabricated.`
      )
      return {
        status: "PARTIAL",
        reasons,
        allowAlignedComparison: true,
        comparisonModeHint: "ALIGNED",
      }
    }

    reasons.push("LDH units match (µg/mL), HepG2 context OK, and concentrations align for T3–T6.")
    return {
      status: "COMPATIBLE",
      reasons,
      allowAlignedComparison: true,
      comparisonModeHint: "ALIGNED",
    }
  }

  // DPPH — different units and subjects by contract
  if (endpoint === "dpph") {
    reasons.push(
      "In-silico DPPH is compound-level (µM); Experimental DPPH is formulation-level (µg/mL T3–T6)."
    )
    reasons.push(
      "50 µM is not automatically equivalent to 50 µg/mL. No automatic µM ↔ µg/mL conversion is applied."
    )
    if (prediction.concentrationUnit === "uM" && cfg.concentrationUnit === "uM") {
      reasons.push("Prediction unit µM confirmed; experimental unit µg/mL — side-by-side only.")
    } else {
      reasons.push(
        `Prediction concentration unit: ${prediction.concentrationUnit}; experimental: µg/mL.`
      )
    }
    return {
      status: "PARTIAL",
      reasons,
      allowAlignedComparison: false,
      comparisonModeHint: "SIDE_BY_SIDE",
    }
  }

  return {
    status: "INCOMPATIBLE",
    reasons: ["Unhandled endpoint."],
    allowAlignedComparison: false,
    comparisonModeHint: "SIDE_BY_SIDE",
  }
}
