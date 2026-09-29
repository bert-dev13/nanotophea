/**
 * Orchestrate experimental statistics from raw lab replicates.
 * Source of truth: raw replicates only — never predictionRuns / SIMULATION.
 */

import type { LabAssay, LabReplicate, LabTreatmentCode } from "@/lib/domain/models"
import { getLabAssayConfig } from "@/lib/lab/labAssayConfig"
import { numericMeasurement } from "@/lib/lab/labCalculations"
import { oneWayAnova, type AnovaResult } from "@/lib/statistics/anova"
import { mean, sampleSd, sampleVariance } from "@/lib/statistics/descriptive"
import { scheffePostHoc, type ScheffeResult } from "@/lib/statistics/scheffe"

export const STATISTICS_CALCULATION_METHOD = "ONE_WAY_ANOVA_SCHEFFE"
export const STATISTICS_CALCULATION_VERSION = "1.0.0"
export const STATISTICS_ALPHA = 0.05

export const STATISTICS_ELIGIBLE_ASSAYS = ["dpph", "ldh"] as const
export type StatisticsEligibleAssay = (typeof STATISTICS_ELIGIBLE_ASSAYS)[number]

export function isStatisticsEligibleAssay(assay: string): assay is StatisticsEligibleAssay {
  return assay === "dpph" || assay === "ldh"
}

export function measurementKeysForAssay(assay: StatisticsEligibleAssay) {
  return getLabAssayConfig(assay).measurementKeys
}

export function isValidMeasurementKey(assay: StatisticsEligibleAssay, key: string): boolean {
  return measurementKeysForAssay(assay).some((m) => m.key === key)
}

export interface TreatmentDescriptive {
  treatmentCode: LabTreatmentCode
  label: string
  n: number
  mean: number | undefined
  sd: number | undefined
  variance: number | undefined
  values: number[]
  missingReplicateSlots: number
  dataClass: "DERIVED_FROM_EXPERIMENTAL"
}

export interface CompletenessReport {
  expectedCells: number
  observedCells: number
  missingCells: number
  incomplete: boolean
  warnings: string[]
}

export interface RawGridCell {
  treatmentCode: LabTreatmentCode
  replicateCode: "R1" | "R2" | "R3"
  value: number | null
  present: boolean
}

export interface ExperimentalStatsComputation {
  assayType: StatisticsEligibleAssay
  measurementKey: string
  measurementLabel: string
  alpha: number
  rawGrid: RawGridCell[]
  treatmentSummaries: TreatmentDescriptive[]
  completeness: CompletenessReport
  anova: AnovaResult
  scheffe: ScheffeResult
  calculationMethod: typeof STATISTICS_CALCULATION_METHOD
  calculationVersion: typeof STATISTICS_CALCULATION_VERSION
  canPersist: boolean
  blockReason?: string
}

const TREATMENTS: LabTreatmentCode[] = ["T1", "T2", "T3", "T4", "T5", "T6"]
const REPS: Array<"R1" | "R2" | "R3"> = ["R1", "R2", "R3"]

export function buildRawGrid(
  replicates: LabReplicate[],
  measurementKey: string
): RawGridCell[] {
  const cells: RawGridCell[] = []
  for (const t of TREATMENTS) {
    for (const r of REPS) {
      const rep = replicates.find((x) => x.treatmentCode === t && x.replicateCode === r)
      const value = rep ? numericMeasurement(rep, measurementKey) : undefined
      cells.push({
        treatmentCode: t,
        replicateCode: r,
        value: value ?? null,
        present: value !== undefined,
      })
    }
  }
  return cells
}

export function computeCompleteness(rawGrid: RawGridCell[]): CompletenessReport {
  const expectedCells = TREATMENTS.length * REPS.length
  const observedCells = rawGrid.filter((c) => c.present).length
  const missingCells = expectedCells - observedCells
  const warnings: string[] = []
  if (missingCells > 0) {
    warnings.push(
      `Dataset incomplete for this measurement: ${missingCells} of ${expectedCells} T1–T6 × R1–R3 cells are missing. Missing values were not replaced with zeros.`
    )
    for (const c of rawGrid) {
      if (!c.present) {
        warnings.push(`Missing: ${c.treatmentCode} ${c.replicateCode}`)
      }
    }
  }
  return {
    expectedCells,
    observedCells,
    missingCells,
    incomplete: missingCells > 0,
    warnings,
  }
}

export function computeTreatmentDescriptives(
  assay: StatisticsEligibleAssay,
  replicates: LabReplicate[],
  measurementKey: string
): TreatmentDescriptive[] {
  const cfg = getLabAssayConfig(assay)
  return TREATMENTS.map((code) => {
    const def = cfg.treatments.find((t) => t.code === code)
    const values = replicates
      .filter((r) => r.treatmentCode === code)
      .map((r) => numericMeasurement(r, measurementKey))
      .filter((v): v is number => v !== undefined)
    const missingReplicateSlots = REPS.length - values.length
    return {
      treatmentCode: code,
      label: def?.label ?? code,
      n: values.length,
      mean: mean(values),
      sd: sampleSd(values),
      variance: sampleVariance(values),
      values,
      missingReplicateSlots,
      dataClass: "DERIVED_FROM_EXPERIMENTAL" as const,
    }
  })
}

/**
 * Fingerprint of source replicates for stale-analysis detection.
 * Includes replicate identity, timestamps, and the analyzed measurement values.
 */
export function buildSourceFingerprint(
  datasetUpdatedAt: string,
  replicates: LabReplicate[],
  measurementKey: string
): string {
  const parts = replicates
    .slice()
    .sort((a, b) => `${a.treatmentCode}${a.replicateCode}`.localeCompare(`${b.treatmentCode}${b.replicateCode}`))
    .map((r) => {
      const v = numericMeasurement(r, measurementKey)
      const raw = r.measurements[measurementKey]
      return [
        r.id,
        r.treatmentCode,
        r.replicateCode,
        r.updatedAt,
        v === undefined ? "∅" : String(v),
        raw === undefined || raw === null ? "" : String(raw),
      ].join(":")
    })
  return `ds:${datasetUpdatedAt}|n:${replicates.length}|m:${measurementKey}|${parts.join("|")}`
}

export function computeExperimentalStatistics(input: {
  assayType: LabAssay
  measurementKey: string
  replicates: LabReplicate[]
  alpha?: number
}): ExperimentalStatsComputation {
  if (!isStatisticsEligibleAssay(input.assayType)) {
    throw new Error(
      `Assay "${input.assayType}" is not eligible for experimental statistics. Only Experimental DPPH and LDH are allowed.`
    )
  }
  const assayType = input.assayType
  if (!isValidMeasurementKey(assayType, input.measurementKey)) {
    throw new Error(`Measurement "${input.measurementKey}" is not valid for ${assayType}.`)
  }

  const alpha = input.alpha ?? STATISTICS_ALPHA
  const cfg = getLabAssayConfig(assayType)
  const measurementLabel =
    cfg.measurementKeys.find((m) => m.key === input.measurementKey)?.label ?? input.measurementKey

  const rawGrid = buildRawGrid(input.replicates, input.measurementKey)
  const completeness = computeCompleteness(rawGrid)
  const treatmentSummaries = computeTreatmentDescriptives(
    assayType,
    input.replicates,
    input.measurementKey
  )

  const anovaGroups = treatmentSummaries
    .filter((t) => t.n > 0)
    .map((t) => ({ label: t.treatmentCode, values: t.values }))

  const anova = oneWayAnova(anovaGroups, alpha)
  const scheffe = scheffePostHoc(anova)

  const canPersist =
    anova.fStatistic != null && anova.pValue != null && anova.dfWithin >= 1 && anova.k >= 2

  return {
    assayType,
    measurementKey: input.measurementKey,
    measurementLabel,
    alpha,
    rawGrid,
    treatmentSummaries,
    completeness: {
      ...completeness,
      warnings: [...completeness.warnings, ...anova.warnings],
    },
    anova,
    scheffe,
    calculationMethod: STATISTICS_CALCULATION_METHOD,
    calculationVersion: STATISTICS_CALCULATION_VERSION,
    canPersist,
    blockReason: canPersist ? undefined : anova.message || "Insufficient usable experimental data.",
  }
}
