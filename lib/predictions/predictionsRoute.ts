import { NextResponse } from "next/server"
import { studyAccessAllowed } from "@/lib/ai/access"
import {
  handlePredictionRequest,
  type PredictionRequestAccess,
  type PredictionRequestBody,
} from "@/lib/predictions/predictionRequest"

export interface PredictionsRouteDeps {
  getSessionUser: (request: Request) => Promise<{ id: string } | null>
  loadStudyAccess: (studyId: string) => Promise<PredictionRequestAccess | null>
}

/**
 * Actual Predictions API route boundary with injectable auth/DB adapters.
 * Production route wires MySQL + session; tests inject fakes.
 */
export async function postScientificPredictions(
  request: Request,
  deps: PredictionsRouteDeps,
): Promise<NextResponse> {
  const user = await deps.getSessionUser(request)

  let body: PredictionRequestBody | null = null
  try {
    body = (await request.json()) as PredictionRequestBody
  } catch {
    body = null
  }

  const studyId = (body?.studyId ?? body?.features?.studyId)?.trim()
  let studyAccess: PredictionRequestAccess | null = null
  if (studyId && user?.id) {
    try {
      studyAccess = await deps.loadStudyAccess(studyId)
    } catch {
      // Do not leak DB internals; treat as inaccessible.
      studyAccess = null
    }
  }

  const result = handlePredictionRequest({
    body,
    actor: user ? { id: user.id } : null,
    studyAccess,
    studyAccessAllowed,
  })

  // Strip accidental stack traces if any dependency leaked them into body.
  const safeBody = sanitizePublicErrorBody(result.body)
  return NextResponse.json(safeBody, { status: result.httpStatus })
}

function sanitizePublicErrorBody(body: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...body }
  for (const key of Object.keys(clone)) {
    if (/stack|sql|password|secret|token/i.test(key)) delete clone[key]
  }
  if (typeof clone.error === "string" && /SQL|ECONNREFUSED|mysql|password/i.test(clone.error)) {
    clone.error = "The prediction service could not complete this request."
  }
  if (typeof clone.message === "string" && /SQL|ECONNREFUSED|mysql|password/i.test(clone.message)) {
    clone.message = "The prediction service could not complete this request."
  }
  return clone
}
