/**
 * Orchestrate Prediction vs Experimental comparison (Phase 9).
 * Never invents values, never auto-converts µM ↔ µg/mL, never claims validation.
 */

import type {
  LabDataset,
  LabReplicate,
  PredictionResultPoint,
  PredictionRun,
  StatisticsRecord,
} from "@/lib/domain/models"
import {
  assessCompatibility,
  type CompatibilityResult,
  type CompatibilityStatus,
  isComparisonEligibleEndpoint,
} from "@/lib/comparison/compatibility"
import {
  computeDifferences,
  metricsAreCompatible,
  resolveExperimentalKeyForPredictionMetric,
  type ComparisonEndpoint,
} from "@/lib/comparison/metrics"
import { getLabAssayConfig, LOCKED_TREATMENT_CONCENTRATIONS } from "@/lib/lab/labAssayConfig"
import { numericMeasurement, summarizeMetricByTreatment } from "@/lib/lab/labCalculations"
import { getPredictionEndpoint } from "@/lib/insilico/predictionEndpoints"

export const COMPARISON_CALCULATION_METHOD = "PRED_VS_EXP_SIDE_BY_SIDE_ALIGNED"
export const COMPARISON_CALCULATION_VERSION = "1.0.0"

export type ComparisonMode = "SIDE_BY_SIDE" | "ALIGNED"

export interface AlignedComparisonPoint {
  concentration: number
  concentrationUnit: "ug_per_mL"
  predictionMetric: string
  experimentalMetricKey: string
  predictedValue: number
  predictedValueUnit: string
  experimentalMean: number
  experimentalSd: number | undefined
  experimentalN: number
  treatmentCode: string
  signedDifference: number | null
  absoluteDifference: number | null
  percentDifference: number | null
  differencesComputed: boolean
  note?: string
}

export interface ComparisonComputation {
  endpoint: ComparisonEndpoint
  compatibility: CompatibilityResult
  comparisonMode: ComparisonMode
  predictionEvidenceClass: "PREDICTED" | "SIMULATION"
  predictionPoints: PredictionResultPoint[]
  experimentalSummaries: {
    treatmentCode: string
    concentrationUgPerMl: number | undefined
    metric: string
    mean: number | undefined
    sd: number | undefined
    n: number
  }[]
  alignedPoints: AlignedComparisonPoint[]
  statisticsRef?: {
    analysisId: string
    freshness: "CURRENT" | "STALE"
    measurementKey: string
    warning?: string
  }
  notices: string[]
  canPersist: boolean
  blockReason?: string
}

const EXP_TREATMENT_CONCS = LOCKED_TREATMENT_CONCENTRATIONS

export function buildComparisonFingerprint(input: {
  predictionUpdatedAt: string
  predictionId: string
  predictionPoints: PredictionResultPoint[]
  labDatasetUpdatedAt: string
  labDatasetId: string
  replicates: LabReplicate[]
  statisticsId?: string
  statisticsUpdatedAt?: string
  statisticsFingerprint?: string
}): string {
  const pts = input.predictionPoints
    .map(
      (p) =>
        `${p.concentration}:${p.concentrationUnit}:${p.metric}:${p.value}:${p.valueUnit}`
    )
    .sort()
    .join("|")
  const reps = input.replicates
    .slice()
    .sort((a, b) =>
      `${a.treatmentCode}${a.replicateCode}`.localeCompare(`${b.treatmentCode}${b.replicateCode}`)
    )
    .map(
      (r) =>
        `${r.id}:${r.treatmentCode}:${r.replicateCode}:${r.updatedAt}:${JSON.stringify(r.measurements)}`
    )
    .join("|")
  const stats = input.statisticsId
    ? `stats:${input.statisticsId}:${input.statisticsUpdatedAt ?? ""}:${input.statisticsFingerprint ?? ""}`
    : "stats:none"
  return [
    `pred:${input.predictionId}:${input.predictionUpdatedAt}`,
    `pts:${pts}`,
    `lab:${input.labDatasetId}:${input.labDatasetUpdatedAt}`,
    `reps:${reps}`,
    stats,
  ].join("||")
}

function experimentalHasAnyMeasurement(
  replicates: LabReplicate[],
  metricKeys: string[]
): boolean {
  return replicates.some((r) =>
    metricKeys.some((k) => numericMeasurement(r, k) !== undefined)
  )
}

function countMatchingConcentrations(
  prediction: PredictionRun,
  experimentalMeansByConc: Map<number, { mean: number; sd?: number; n: number; treatmentCode: string }>
): number {
  if (prediction.concentrationUnit !== "ug_per_mL") return 0
  let n = 0
  const seen = new Set<number>()
  for (const p of prediction.resultPoints) {
    if (p.concentrationUnit !== "ug_per_mL") continue
    if (experimentalMeansByConc.has(p.concentration) && !seen.has(p.concentration)) {
      seen.add(p.concentration)
      n++
    }
  }
  return n
}

function buildExperimentalMeans(
  endpoint: ComparisonEndpoint,
  replicates: LabReplicate[],
  experimentalKey: string
) {
  const summaries = summarizeMetricByTreatment(replicates, experimentalKey)
  const byConc = new Map<
    number,
    { mean: number; sd?: number; n: number; treatmentCode: string }
  >()
  const rows: ComparisonComputation["experimentalSummaries"] = []

  for (const s of summaries) {
    const conc =
      s.treatmentCode === "T3" ||
      s.treatmentCode === "T4" ||
      s.treatmentCode === "T5" ||
      s.treatmentCode === "T6"
        ? EXP_TREATMENT_CONCS[s.treatmentCode]
        : undefined
    rows.push({
      treatmentCode: s.treatmentCode,
      concentrationUgPerMl: conc,
      metric: experimentalKey,
      mean: s.mean,
      sd: s.sd,
      n: s.n ?? 0,
    })
    if (conc != null && s.mean != null && (s.n ?? 0) > 0) {
      byConc.set(conc, {
        mean: s.mean,
        sd: s.sd,
        n: s.n ?? 0,
        treatmentCode: s.treatmentCode,
      })
    }
  }
  return { rows, byConc }
}

export function computeComparison(input: {
  endpoint: string
  prediction: PredictionRun
  dataset: LabDataset
  replicates: LabReplicate[]
  experimentalMetricKey?: string
  statistics?: StatisticsRecord | null
  statisticsFreshness?: "CURRENT" | "STALE" | null
}): ComparisonComputation {
  const notices = [
    "Computational predictions and experimental measurements are distinct evidence layers. Agreement does not by itself establish experimental validation of the computational method.",
  ]

  if (!isComparisonEligibleEndpoint(input.endpoint)) {
    return {
      endpoint: "dpph",
      compatibility: {
        status: "INCOMPATIBLE",
        reasons: [`Endpoint "${input.endpoint}" is not eligible for comparison.`],
        allowAlignedComparison: false,
        comparisonModeHint: "SIDE_BY_SIDE",
      },
      comparisonMode: "SIDE_BY_SIDE",
      predictionEvidenceClass: "PREDICTED",
      predictionPoints: [],
      experimentalSummaries: [],
      alignedPoints: [],
      notices,
      canPersist: false,
      blockReason: "Unsupported endpoint for Prediction vs Experimental.",
    }
  }

  const endpoint = input.endpoint
  const evidence = input.prediction.provenance.evidenceClass
  if (evidence !== "PREDICTED" && evidence !== "SIMULATION") {
    throw new Error("Prediction evidence must be PREDICTED or SIMULATION.")
  }

  const labCfg = getLabAssayConfig(endpoint)
  const metricKeys = labCfg.measurementKeys.map((m) => m.key)
  const hasExp = experimentalHasAnyMeasurement(input.replicates, metricKeys)

  // Choose experimental metric: explicit, or from first compatible prediction metric, or primary
  let experimentalKey =
    input.experimentalMetricKey ||
    labCfg.primaryMetricKey

  const firstPredMetric = input.prediction.resultPoints[0]?.metric
  if (!input.experimentalMetricKey && firstPredMetric) {
    const resolved = resolveExperimentalKeyForPredictionMetric(endpoint, firstPredMetric)
    if (resolved) experimentalKey = resolved.experimentalKey
  }

  const { rows: experimentalSummaries, byConc } = buildExperimentalMeans(
    endpoint,
    input.replicates,
    experimentalKey
  )

  const matchingConcentrationCount = countMatchingConcentrations(input.prediction, byConc)

  const compatibility = assessCompatibility({
    endpoint,
    prediction: input.prediction,
    dataset: input.dataset,
    experimentalHasMeasurements: hasExp,
    matchingConcentrationCount,
    predictionPointCount: input.prediction.resultPoints.length,
  })

  const alignedPoints: AlignedComparisonPoint[] = []

  if (compatibility.allowAlignedComparison && endpoint === "ldh") {
    for (const p of input.prediction.resultPoints) {
      if (p.concentrationUnit !== "ug_per_mL") continue
      const exp = byConc.get(p.concentration)
      if (!exp) continue

      const compatible = metricsAreCompatible(endpoint, p.metric, experimentalKey)
      const diffs = compatible
        ? computeDifferences(p.value, exp.mean)
        : { signedDifference: null, absoluteDifference: null, percentDifference: null }

      alignedPoints.push({
        concentration: p.concentration,
        concentrationUnit: "ug_per_mL",
        predictionMetric: p.metric,
        experimentalMetricKey: experimentalKey,
        predictedValue: p.value,
        predictedValueUnit: p.valueUnit,
        experimentalMean: exp.mean,
        experimentalSd: exp.sd,
        experimentalN: exp.n,
        treatmentCode: exp.treatmentCode,
        signedDifference: diffs.signedDifference,
        absoluteDifference: diffs.absoluteDifference,
        percentDifference: diffs.percentDifference,
        differencesComputed: compatible,
        note: compatible
          ? undefined
          : "Metric meanings are not compatible — difference not calculated.",
      })
    }
  }

  const comparisonMode: ComparisonMode =
    compatibility.allowAlignedComparison && alignedPoints.length > 0 ? "ALIGNED" : "SIDE_BY_SIDE"

  let statisticsRef: ComparisonComputation["statisticsRef"]
  if (input.statistics) {
    const freshness = input.statisticsFreshness ?? "CURRENT"
    statisticsRef = {
      analysisId: input.statistics.id,
      freshness,
      measurementKey: input.statistics.measurementKey,
      warning:
        freshness === "STALE"
          ? "Linked statistics are STALE / REQUIRE RECALCULATION. They are not treated as current."
          : undefined,
    }
    if (freshness === "STALE") {
      notices.push(statisticsRef.warning!)
    }
  }

  if (endpoint === "dpph") {
    notices.push(
      "DPPH charts use separate axes: computational µM (compound) vs experimental µg/mL (formulation)."
    )
  }

  const canPersist = compatibility.status !== "INCOMPATIBLE"

  return {
    endpoint,
    compatibility,
    comparisonMode,
    predictionEvidenceClass: evidence,
    predictionPoints: input.prediction.resultPoints,
    experimentalSummaries,
    alignedPoints,
    statisticsRef,
    notices,
    canPersist,
    blockReason: canPersist
      ? undefined
      : compatibility.reasons.join(" ") || "Comparison is incompatible.",
  }
}

export function predChartPoints(prediction: PredictionRun) {
  return prediction.resultPoints
    .slice()
    .sort((a, b) => a.concentration - b.concentration)
    .map((p) => ({
      concentration: p.concentration,
      value: p.value,
      metric: p.metric,
      unit: p.concentrationUnit,
    }))
}

export function expChartPoints(
  summaries: ComparisonComputation["experimentalSummaries"]
) {
  return summaries
    .filter((s) => s.concentrationUgPerMl != null && s.mean != null)
    .map((s) => ({
      concentration: s.concentrationUgPerMl as number,
      mean: s.mean as number,
      sd: s.sd ?? 0,
      treatment: s.treatmentCode,
    }))
    .sort((a, b) => a.concentration - b.concentration)
}

export function predictionUnitLabel(unit: string): string {
  if (unit === "uM") return "µM"
  if (unit === "ug_per_mL") return "µg/mL"
  return unit
}

export function comparisonEndpointLabel(endpoint: ComparisonEndpoint): string {
  return getPredictionEndpoint(endpoint).shortLabel
}

export type { CompatibilityStatus, CompatibilityResult }
