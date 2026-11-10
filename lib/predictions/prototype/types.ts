import type { PredictionEndpoint } from "@/lib/domain/models"
import type { PredictionFeatures, PredictionSeriesPoint } from "@/lib/predictions/types"
import { inputFeatureLines, PROTOTYPE_ASSUMPTIONS } from "@/lib/predictions/prototype/math"

export interface PrototypeOutput {
  value: number
  unit: string
}

export interface PrototypePredictionResult {
  endpoint: PredictionEndpoint
  modelName: string
  modelVersion: "exploratory-v1"
  method: "Exploratory simulation"
  outputs: Record<string, PrototypeOutput>
  units: Record<string, string>
  inputFeatures: string[]
  generatedAt: string
  evidenceClass: "SIMULATION"
  assumptions: string
  series: PredictionSeriesPoint[]
  note?: string
  status?: "ok"
}

/** Typed refusal when a scientifically defensible numeric path is unavailable. */
export interface PrototypeUnavailableResult {
  status: "unavailable"
  endpoint: PredictionEndpoint
  evidenceClass: "SIMULATION"
  reason: string
  missing: string[]
}

export type PrototypeRunResult = PrototypePredictionResult | PrototypeUnavailableResult

export function isPrototypePredictionResult(
  value: PrototypeRunResult,
): value is PrototypePredictionResult {
  return value.status !== "unavailable"
}

export function finishPrototype(input: {
  endpoint: PredictionEndpoint
  modelName: string
  features: PredictionFeatures
  outputs: Record<string, PrototypeOutput>
  series: PredictionSeriesPoint[]
  note?: string
  /** Endpoint-specific assumptions; falls back to the generic prototype note. */
  assumptions?: string
}): PrototypePredictionResult {
  const units: Record<string, string> = {}
  for (const [key, item] of Object.entries(input.outputs)) units[key] = item.unit
  return {
    endpoint: input.endpoint,
    modelName: input.modelName,
    modelVersion: "exploratory-v1",
    method: "Exploratory simulation",
    status: "ok",
    outputs: input.outputs,
    units,
    inputFeatures: inputFeatureLines(input.features),
    generatedAt: new Date().toISOString(),
    evidenceClass: "SIMULATION",
    assumptions: input.assumptions?.trim() || PROTOTYPE_ASSUMPTIONS,
    series: input.series,
    ...(input.note ? { note: input.note } : {}),
  }
}
