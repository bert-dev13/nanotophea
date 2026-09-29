/**
 * Deterministic derived statistics from experimental replicates.
 * Never invents missing values — only computes from provided numbers.
 */
import type { LabReplicate, LabTreatmentCode, LabTreatmentSummary } from "@/lib/domain/models"

export function mean(values: number[]): number | undefined {
  if (!values.length) return undefined
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Sample standard deviation (n − 1). Undefined if fewer than 2 values. */
export function sampleSd(values: number[]): number | undefined {
  if (values.length < 2) return undefined
  const m = mean(values)
  if (m === undefined) return undefined
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function numericMeasurement(rep: LabReplicate, key: string): number | undefined {
  const raw = rep.measurements[key]
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

export function summarizeMetricByTreatment(
  replicates: LabReplicate[],
  metric: string
): LabTreatmentSummary[] {
  const codes: LabTreatmentCode[] = ["T1", "T2", "T3", "T4", "T5", "T6"]
  return codes.map((treatmentCode) => {
    const values = replicates
      .filter((r) => r.treatmentCode === treatmentCode)
      .map((r) => numericMeasurement(r, metric))
      .filter((v): v is number => v !== undefined)
    return {
      treatmentCode,
      metric,
      mean: mean(values),
      sd: sampleSd(values),
      n: values.length,
      dataClass: "DERIVED_FROM_EXPERIMENTAL" as const,
    }
  })
}

export function chartPointsFromSummaries(
  summaries: LabTreatmentSummary[],
  concentrationByCode: Partial<Record<LabTreatmentCode, number | undefined>>
): { concentration: number; mean: number; treatmentCode: string }[] {
  return summaries
    .filter((s) => s.mean !== undefined && concentrationByCode[s.treatmentCode] !== undefined)
    .map((s) => ({
      concentration: concentrationByCode[s.treatmentCode] as number,
      mean: s.mean as number,
      treatmentCode: s.treatmentCode,
    }))
    .sort((a, b) => a.concentration - b.concentration)
}
