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
  modelVersion: "prototype-v1"
  method: "Computational prediction"
  outputs: Record<string, PrototypeOutput>
  units: Record<string, string>
  inputFeatures: string[]
  generatedAt: string
  evidenceClass: "SIMULATION"
  assumptions: string
  series: PredictionSeriesPoint[]
  note?: string
}

export function finishPrototype(input: {
  endpoint: PredictionEndpoint
  modelName: string
  features: PredictionFeatures
  outputs: Record<string, PrototypeOutput>
  series: PredictionSeriesPoint[]
  note?: string
}): PrototypePredictionResult {
  const units: Record<string, string> = {}
  for (const [key, item] of Object.entries(input.outputs)) units[key] = item.unit
  return {
    endpoint: input.endpoint,
    modelName: input.modelName,
    modelVersion: "prototype-v1",
    method: "Computational prediction",
    outputs: input.outputs,
    units,
    inputFeatures: inputFeatureLines(input.features),
    generatedAt: new Date().toISOString(),
    evidenceClass: "SIMULATION",
    assumptions: PROTOTYPE_ASSUMPTIONS,
    series: input.series,
    ...(input.note ? { note: input.note } : {}),
  }
}
