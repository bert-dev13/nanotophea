import type { PredictionEndpoint } from "@/lib/domain/models"
import { baxModel, baxSpec } from "@/lib/predictions/bax"
import { dpphModel, dpphSpec } from "@/lib/predictions/dpph"
import { hippoYapModel, hippoYapSpec } from "@/lib/predictions/hippo-yap"
import { ldhModel, ldhSpec } from "@/lib/predictions/ldh"
import { mttModel, mttSpec } from "@/lib/predictions/mtt"
import { rosModel, rosSpec } from "@/lib/predictions/ros"
import type { EndpointSpec, PredictionEngineResult, PredictionFeatures, PredictionModel } from "@/lib/predictions/types"

const MODELS: Record<PredictionEndpoint, PredictionModel | null> = {
  dpph: dpphModel,
  mtt: mttModel,
  ldh: ldhModel,
  ros: rosModel,
  bax: baxModel,
  hippo_yap: hippoYapModel,
}

export const ENDPOINT_SPECS: Record<PredictionEndpoint, EndpointSpec> = {
  dpph: dpphSpec,
  mtt: mttSpec,
  ldh: ldhSpec,
  ros: rosSpec,
  bax: baxSpec,
  hippo_yap: hippoYapSpec,
}

export function hasPredictionModel(endpoint: PredictionEndpoint): boolean {
  return MODELS[endpoint] != null
}

/**
 * Runs a registered validated model.
 * When none is registered, returns not_configured and no numeric output.
 */
export function runPrediction(endpoint: PredictionEndpoint, features: PredictionFeatures): PredictionEngineResult {
  const model = MODELS[endpoint]
  if (!model) {
    return { status: "not_configured", endpoint, features, evidenceClass: "PREDICTED" }
  }
  const output = model.predict(features)
  if (!output || !Object.keys(output.values).length) {
    return { status: "not_configured", endpoint, features, evidenceClass: "PREDICTED" }
  }
  return {
    status: "predicted",
    endpoint,
    features,
    evidenceClass: "PREDICTED",
    generatedAt: new Date().toISOString(),
    output,
  }
}
