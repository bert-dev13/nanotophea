import type { PredictionEndpoint } from "@/lib/domain/models"

export type { PredictionEndpoint }

/** Inputs assembled from study records. Missing values stay absent. */
export interface PredictionFeatures {
  studyId: string
  phytochemicalId: string
  phytochemicalName: string
  pubchemCid?: number
  molecularWeight?: number
  formula?: string
  cellLineId?: string
  cellLineName?: string
  targetProteinIds: string[]
  docking: Array<{ proteinId: string; proteinName?: string; affinityKcalMol: number }>
  admeDescriptors: Record<string, string | number | boolean>
}

export interface PredictionOutputValue {
  value: number
  unit: string
}

/** Concentration-response points returned by a model. Absent unless the model provides them. */
export interface PredictionSeriesPoint {
  concentration: number
  concentrationUnit: string
  metric: string
  value: number
  unit: string
}

/**
 * Result of a validated model. The engine must not construct this
 * unless a registered model returns it.
 */
export interface PredictionOutput {
  modelName: string
  modelVersion: string
  modelMethod: string
  values: Record<string, PredictionOutputValue>
  series?: PredictionSeriesPoint[]
  uncertainty?: string
}

export type PredictionEngineResult =
  | {
      status: "not_configured"
      endpoint: PredictionEndpoint
      features: PredictionFeatures
      evidenceClass: "PREDICTED"
    }
  | {
      status: "predicted"
      endpoint: PredictionEndpoint
      features: PredictionFeatures
      evidenceClass: "PREDICTED"
      generatedAt: string
      output: PredictionOutput
    }

export interface PredictionModel {
  endpoint: PredictionEndpoint
  modelName: string
  modelVersion: string
  modelMethod: string
  predict: (features: PredictionFeatures) => PredictionOutput | null
}

export interface EndpointSpec {
  endpoint: PredictionEndpoint
  label: string
  /** Names a validated model would be expected to report. Not values. */
  outputLabels: string[]
  context: string
}
