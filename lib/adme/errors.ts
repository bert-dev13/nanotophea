import { ADME_ASSESSMENT_FAILED, ADME_ENGINE_UNAVAILABLE } from "@/lib/adme/types"

export class AdmePredictionError extends Error {
  readonly detail?: string

  constructor(readonly code: "engine_unavailable" | "assessment_failed", detail?: string) {
    super(code)
    this.name = "AdmePredictionError"
    this.detail = detail
  }
}

export function publicAdmeError(error: unknown): string {
  if (!(error instanceof AdmePredictionError)) return ADME_ASSESSMENT_FAILED
  const detail = safeAdmeDetail(error.detail)
  if (error.code === "engine_unavailable") {
    if (detail && /still loading/i.test(detail)) return detail
    return ADME_ENGINE_UNAVAILABLE
  }
  return detail || ADME_ASSESSMENT_FAILED
}

function safeAdmeDetail(value: string | undefined): string | undefined {
  if (!value) return undefined
  const text = value.trim()
  if (!text || text === "engine_unavailable" || text === "assessment_failed") return undefined
  if (text.length > 220 || /traceback|at Object\.|Error:|\\\\|\/home\/|C:\\/i.test(text)) return undefined
  return text
}
