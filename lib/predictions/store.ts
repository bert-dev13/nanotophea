import type { PredictionConcentrationUnit, PredictionRunInput } from "@/lib/domain/models"
import { defaultProvenance } from "@/lib/domain/provenance"
import type { PrototypePredictionResult } from "@/lib/predictions/prototype/types"
import type { PredictionEngineResult } from "@/lib/predictions/types"

export const PROTOTYPE_DISCLAIMER =
  "Computational prediction from the recorded compound, docking, and descriptor inputs."

/** Maps a real model result onto a study prediction record. Unconfigured runs are not stored. */
export function storedPredictionFromEngine(result: PredictionEngineResult): PredictionRunInput | null {
  if (result.status !== "predicted") return null
  const { output, features, generatedAt, endpoint } = result
  const inputParameters: Record<string, string | number | boolean | null> = {
    phytochemicalId: features.phytochemicalId,
  }
  if (features.cellLineId) inputParameters.cellLineId = features.cellLineId
  features.targetProteinIds.forEach((id, index) => {
    inputParameters[`targetProteinId.${index}`] = id
  })
  for (const [key, item] of Object.entries(output.values)) {
    inputParameters[`output.${key}`] = item.value
    inputParameters[`unit.${key}`] = item.unit
  }
  for (const [key, value] of Object.entries(features.admeDescriptors)) {
    inputParameters[`adme.${key}`] = value
  }
  const points: PredictionRunInput["resultPoints"] = (output.series ?? []).flatMap((point) => {
    if (!Number.isFinite(point.value) || !Number.isFinite(point.concentration)) return []
    const unit: PredictionConcentrationUnit = point.concentrationUnit === "uM" || point.concentrationUnit === "ug_per_mL"
      ? point.concentrationUnit
      : "other"
    return [{
      concentration: point.concentration,
      concentrationUnit: unit,
      metric: point.metric,
      value: point.value,
      valueUnit: point.unit,
    }]
  })
  const pointUnits = new Set(points.map((point) => point.concentrationUnit))
  const concentrationUnit: PredictionConcentrationUnit = pointUnits.size === 1 ? [...pointUnits][0]! : "other"
  const ic50 = Object.entries(output.values).find(([key]) => /ic50/i.test(key))
  return {
    endpoint,
    module: endpoint,
    runName: `${output.modelName} · ${features.phytochemicalName}`,
    compoundId: features.phytochemicalId,
    ...(features.cellLineId ? { cellLineId: features.cellLineId } : {}),
    ...(features.targetProteinIds[0] ? { proteinId: features.targetProteinIds[0] } : {}),
    ...(ic50 ? { summaryIc50: ic50[1].value, summaryIc50Unit: ic50[1].unit } : {}),
    methodName: output.modelName,
    methodVersion: output.modelVersion,
    methodType: "documented_model",
    source: output.modelMethod,
    referenceIds: [],
    concentrationUnit,
    dateGenerated: generatedAt,
    inputParameters,
    ...(output.uncertainty ? { limitations: output.uncertainty } : {}),
    resultPoints: pointUnits.size === 1 ? points : [],
    status: "final",
    provenance: {
      ...defaultProvenance("PREDICTED", {
        methodName: output.modelName,
        methodVersion: output.modelVersion,
        source: output.modelMethod,
        recordedAt: generatedAt,
      }),
      evidenceClass: "PREDICTED",
      methodName: output.modelName,
    },
  }
}

/** Persists a prototype simulation. Never stored as PREDICTED. */
export function storedSimulationFromPrototype(
  result: PrototypePredictionResult,
  features: { phytochemicalId: string; cellLineId?: string; targetProteinIds: string[] },
): PredictionRunInput {
  const { concentrationUnit, points } = seriesPoints(result.series)
  const ic50 = Object.entries(result.outputs).find(([key]) => /ic50/i.test(key))
  const maximum = Object.entries(result.outputs).find(([key]) => /maximum/i.test(key))
  const teac = result.outputs.TEAC
  const selectivity = Object.entries(result.outputs).find(([key]) => /selectivity/i.test(key))
  const inputParameters: Record<string, string | number | boolean | null> = {}
  for (const [key, item] of Object.entries(result.outputs)) {
    inputParameters[`output:${key}`] = item.value
    inputParameters[`unit:${key}`] = item.unit
  }
  return {
    endpoint: result.endpoint,
    module: result.endpoint,
    runName: result.modelName,
    compoundId: features.phytochemicalId,
    ...(features.cellLineId && result.endpoint !== "dpph" ? { cellLineId: features.cellLineId } : {}),
    ...((result.endpoint === "bax" || result.endpoint === "hippo_yap") && features.targetProteinIds[0]
      ? { proteinId: features.targetProteinIds[0] }
      : {}),
    ...(ic50 ? { summaryIc50: ic50[1].value, summaryIc50Unit: ic50[1].unit } : {}),
    ...(maximum ? { summaryMaximum: maximum[1].value, summaryMaximumUnit: maximum[1].unit } : {}),
    ...(teac ? { teac: `${teac.value} ${teac.unit}` } : {}),
    ...(selectivity ? { selectivityIndex: `${selectivity[1].value} ${selectivity[1].unit}` } : {}),
    ...(result.note ? { pathwayEffect: result.note } : {}),
    methodName: result.modelName,
    methodVersion: result.modelVersion,
    methodType: "exploratory_math",
    source: result.method,
    referenceIds: [],
    assumptions: result.assumptions,
    limitations: PROTOTYPE_DISCLAIMER,
    concentrationUnit,
    dateGenerated: result.generatedAt,
    inputParameters,
    resultPoints: points,
    status: "final",
    provenance: {
      ...defaultProvenance("SIMULATION", {
        methodName: result.modelName,
        methodVersion: result.modelVersion,
        source: result.method,
        recordedAt: result.generatedAt,
        assumptions: result.assumptions,
      }),
      evidenceClass: "SIMULATION",
      methodName: result.modelName,
    },
  }
}

function seriesPoints(series: PrototypePredictionResult["series"]): {
  concentrationUnit: PredictionConcentrationUnit
  points: PredictionRunInput["resultPoints"]
} {
  const points: PredictionRunInput["resultPoints"] = series.flatMap((point) => {
    if (!Number.isFinite(point.value) || !Number.isFinite(point.concentration)) return []
    const unit: PredictionConcentrationUnit = point.concentrationUnit === "uM" || point.concentrationUnit === "ug_per_mL"
      ? point.concentrationUnit
      : "other"
    return [{
      concentration: point.concentration,
      concentrationUnit: unit,
      metric: point.metric,
      value: point.value,
      valueUnit: point.unit,
    }]
  })
  const units = new Set(points.map((point) => point.concentrationUnit))
  return {
    concentrationUnit: units.size === 1 ? [...units][0]! : "other",
    points: units.size === 1 ? points : [],
  }
}
