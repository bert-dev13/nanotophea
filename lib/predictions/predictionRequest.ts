import { hasPredictionModel, runPrediction } from "@/lib/predictions/engine"
import { runPrototype } from "@/lib/predictions/prototype"
import {
  stampExploratoryAcknowledgement,
  type ExploratoryAcknowledgementRecord,
} from "@/lib/predictions/acknowledgement"
import type { PredictionEndpoint, PredictionFeatures } from "@/lib/predictions/types"

export const PREDICTION_ENDPOINTS = new Set<PredictionEndpoint>([
  "dpph",
  "mtt",
  "ldh",
  "ros",
  "bax",
  "hippo_yap",
])

export interface PredictionRequestBody {
  endpoint?: string
  features?: PredictionFeatures
  mode?: string
  acknowledgeExploratory?: boolean
  studyId?: string
  /** Ignored — actor always comes from authenticated session. */
  actorId?: string
  acknowledgedBy?: string
}

export interface PredictionRequestActor {
  id: string
}

export interface PredictionRequestAccess {
  ownerId?: string
  memberIds?: string[]
}

export type PredictionRequestResult =
  | { httpStatus: 400; body: Record<string, unknown> }
  | { httpStatus: 401; body: Record<string, unknown> }
  | { httpStatus: 403; body: Record<string, unknown> }
  | { httpStatus: 404; body: Record<string, unknown> }
  | { httpStatus: 422; body: Record<string, unknown> }
  | { httpStatus: 200; body: Record<string, unknown> }

function normalizeFeatures(features: PredictionFeatures): PredictionFeatures {
  return {
    ...features,
    docking: (features.docking ?? []).filter((row) => Number.isFinite(row.affinityKcalMol)),
    admeDescriptors: features.admeDescriptors ?? {},
    targetProteinIds: features.targetProteinIds ?? [],
  }
}

/**
 * Pure request handler for /api/scientific/predictions.
 * Auth and study access are injected so unit tests do not need MySQL.
 */
export function handlePredictionRequest(input: {
  body: PredictionRequestBody | null
  actor: PredictionRequestActor | null
  studyAccess?: PredictionRequestAccess | null
  studyAccessAllowed: (study: PredictionRequestAccess | null | undefined, uid: string) => boolean
}): PredictionRequestResult {
  const { body, actor, studyAccess, studyAccessAllowed } = input

  if (!actor?.id) {
    return { httpStatus: 401, body: { error: "Sign in to run biological predictions." } }
  }

  if (!body || !body.endpoint || !PREDICTION_ENDPOINTS.has(body.endpoint as PredictionEndpoint) || !body.features?.phytochemicalId) {
    return { httpStatus: 400, body: { error: "Prediction request is incomplete." } }
  }

  const endpoint = body.endpoint as PredictionEndpoint
  const features = normalizeFeatures(body.features)
  const mode = (body.mode ?? "validated").trim().toLowerCase()
  const exploratory =
    mode === "exploratory_simulation" || mode === "prototype" || mode === "exploratory"

  if (exploratory) {
    const studyId = (body.studyId ?? features.studyId)?.trim()
    if (!studyId) {
      return { httpStatus: 400, body: { error: "Study is required for exploratory simulation." } }
    }
    if (!studyAccessAllowed(studyAccess ?? null, actor.id)) {
      return { httpStatus: 403, body: { error: "You do not have access to this study." } }
    }
    if (body.acknowledgeExploratory !== true) {
      return {
        httpStatus: 400,
        body: {
          status: "acknowledgement_required",
          endpoint,
          evidenceClass: "SIMULATION",
          error:
            "Exploratory simulation requires explicit acknowledgement. No validated prediction model is registered for this endpoint.",
          hasValidatedModel: hasPredictionModel(endpoint),
        },
      }
    }

    const result = runPrototype(endpoint, features)
    if (result.status === "unavailable") {
      return { httpStatus: 422, body: { ...result } }
    }

    const acknowledgement: ExploratoryAcknowledgementRecord = stampExploratoryAcknowledgement({
      endpoint,
      actorId: actor.id,
    })

    return {
      httpStatus: 200,
      body: {
        ...result,
        acknowledgement,
        // Explicitly ignore any client-supplied actor identity.
        acknowledgedByServer: actor.id,
      },
    }
  }

  // Validated path — never silently fall through to prototype.
  // Study access still required when a study id is present.
  const studyId = (body.studyId ?? features.studyId)?.trim()
  if (studyId && !studyAccessAllowed(studyAccess ?? null, actor.id)) {
    return { httpStatus: 403, body: { error: "You do not have access to this study." } }
  }

  const validated = runPrediction(endpoint, features)
  if (validated.status === "not_configured") {
    return {
      httpStatus: 404,
      body: {
        ...validated,
        hasValidatedModel: false,
        message:
          "No validated computational model is registered for this endpoint. Use exploratory_simulation with acknowledgeExploratory=true for a clearly labeled demonstration, or record experimental data in the Laboratory module.",
      },
    }
  }
  return { httpStatus: 200, body: { ...validated } }
}
