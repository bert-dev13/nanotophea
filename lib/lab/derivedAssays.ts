/**
 * Derived experimental results from recorded absorbances.
 *
 * DPPH % scavenging uses the project method
 * (A_control − A_sample) / A_control × 100,
 * where A_control is the mean T1 solvent-control absorbance.
 *
 * LDH % cytotoxicity uses the project method
 * (OD_sample − OD_spontaneous) / (OD_max − OD_spontaneous) × 100,
 * where OD_spontaneous is the mean T1 absorbance and OD_max is the mean T2 absorbance.
 *
 * IC50 is not fitted here. No documented fitting method is applied to partial curves.
 * Raw absorbance is never replaced by a calculated percentage.
 */
import type { LabObservation, LabReplicate, LabTreatmentCode, LabTreatmentSummary } from "@/lib/domain/models"
import { mean, numericMeasurement, sampleSd } from "@/lib/lab/labCalculations"

export const DPPH_SCAVENGING_FORMULA = "(A_control − A_sample) / A_control × 100"
export const LDH_CYTOTOXICITY_FORMULA =
  "(OD_sample − OD_spontaneous) / (OD_max − OD_spontaneous) × 100"

const TREATMENT_CODES: LabTreatmentCode[] = ["T1", "T2", "T3", "T4", "T5", "T6"]
const DOSE_CODES: LabTreatmentCode[] = ["T3", "T4", "T5", "T6"]

export function formatLabNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—"
  const rounded = Math.round(value * 10000) / 10000
  return String(rounded)
}

function valuesFor(
  replicates: LabReplicate[],
  code: LabTreatmentCode,
  metric: string,
): number[] {
  return replicates
    .filter((row) => row.treatmentCode === code)
    .map((row) => numericMeasurement(row, metric))
    .filter((value): value is number => value !== undefined)
}

function summaryFor(
  replicates: LabReplicate[],
  code: LabTreatmentCode,
  metric: string,
): LabTreatmentSummary | null {
  const values = valuesFor(replicates, code, metric)
  if (!values.length) return null
  return {
    treatmentCode: code,
    metric,
    mean: mean(values),
    sd: sampleSd(values),
    n: values.length,
    dataClass: "DERIVED_FROM_EXPERIMENTAL",
  }
}

export function deriveExperimentalResults(
  assay: "dpph" | "ldh",
  replicates: LabReplicate[],
): { replicates: LabReplicate[]; summaries: LabTreatmentSummary[] } {
  const rawKey = assay === "dpph" ? "absorbance" : "absorbanceA490"
  const derivedKey = assay === "dpph" ? "radicalScavengingPercent" : "percentCytotoxicity"
  const spontaneous = mean(valuesFor(replicates, "T1", rawKey))
  const maximum = assay === "ldh" ? mean(valuesFor(replicates, "T2", rawKey)) : undefined
  const denominator =
    spontaneous !== undefined && maximum !== undefined ? maximum - spontaneous : undefined

  const next = replicates.map((row) => {
    const absorbance = numericMeasurement(row, rawKey)
    const measurements = { ...row.measurements }
    delete measurements[derivedKey]
    if (absorbance === undefined) return { ...row, measurements }

    let derived: number | undefined
    if (assay === "dpph" && spontaneous !== undefined && spontaneous !== 0 && row.treatmentCode !== "T1") {
      derived = ((spontaneous - absorbance) / spontaneous) * 100
    }
    if (
      assay === "ldh" &&
      spontaneous !== undefined &&
      denominator !== undefined &&
      denominator !== 0 &&
      DOSE_CODES.includes(row.treatmentCode)
    ) {
      derived = ((absorbance - spontaneous) / denominator) * 100
    }
    if (derived !== undefined && Number.isFinite(derived)) measurements[derivedKey] = derived
    return { ...row, measurements }
  })

  const summaries = TREATMENT_CODES.flatMap((code) => {
    const raw = summaryFor(next, code, rawKey)
    const derived = summaryFor(next, code, derivedKey)
    return [raw, derived].filter((row): row is LabTreatmentSummary => row !== null)
  })

  return { replicates: next, summaries }
}

/** Mean and sample SD from entered replicates. Does not replace the raw value or replicates. */
export function summarizeObservations(rows: LabObservation[]): LabObservation[] {
  return rows.map((row) => {
    const replicates = row.replicates.filter((value) => Number.isFinite(value))
    return {
      ...row,
      replicates,
      mean: mean(replicates),
      sd: sampleSd(replicates),
    }
  })
}

export const MTT_VIABILITY_FORMULA = "(A_sample / A_control) × 100"
export const MTT_INHIBITION_FORMULA = "100 − cell viability %"

/**
 * MTT viability and growth inhibition from raw absorbance.
 * The control is the mean absorbance of untreated rows, or vehicle rows when no untreated mean exists.
 * Percentages are omitted when that control is missing or zero. IC50 is not fitted.
 */
export function deriveMttObservations(rows: LabObservation[]): LabObservation[] {
  const summarized = summarizeObservations(rows).map((row) => {
    const next = { ...row }
    delete next.viabilityPercent
    delete next.inhibitionPercent
    return next
  })
  const untreated = summarized
    .filter((row) => row.role === "untreated" && row.mean !== undefined)
    .map((row) => row.mean as number)
  const vehicle = summarized
    .filter((row) => row.role === "vehicle" && row.mean !== undefined)
    .map((row) => row.mean as number)
  const controlValues = untreated.length ? untreated : vehicle
  const control = mean(controlValues)
  if (control === undefined || control === 0) return summarized
  const controlRole = untreated.length ? "untreated" : "vehicle"
  return summarized.map((row) => {
    if (row.mean === undefined || row.role === controlRole) return row
    const viabilityPercent = (row.mean / control) * 100
    if (!Number.isFinite(viabilityPercent)) return row
    return {
      ...row,
      viabilityPercent,
      inhibitionPercent: 100 - viabilityPercent,
    }
  })
}
