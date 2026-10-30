import { AdmetRunSchema, type AdmetRun } from "@/lib/domain/models"
import { ADME_ASSESSMENT_FAILED } from "@/lib/adme/types"

const inflight = new Map<string, Promise<AdmeAssessmentResponse>>()

export interface AdmeAssessmentResponse {
  runs: AdmetRun[]
  errors: Array<{ compoundId: string; message: string }>
  origins: Record<string, "calculated" | "retrieved">
}

export function requestAutomaticAdme(
  tokenOrBody: string | { studyId: string; compoundId?: string; force?: boolean },
  optionalBody?: { studyId: string; compoundId?: string; force?: boolean },
): Promise<AdmeAssessmentResponse> {
  const body = typeof tokenOrBody === "object" ? tokenOrBody : optionalBody!
  const token = typeof tokenOrBody === "string" ? tokenOrBody : undefined
  const key = `${body.studyId}:${body.compoundId ?? "*"}:${body.force ? "force" : "ensure"}`
  if (!body.force) {
    const existing = inflight.get(key)
    if (existing) return existing
  }
  const request = fetchAssessment(body, token).finally(() => inflight.delete(key))
  inflight.set(key, request)
  return request
}

async function fetchAssessment(
  body: { studyId: string; compoundId?: string; force?: boolean },
  token?: string,
): Promise<AdmeAssessmentResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch("/api/scientific/adme", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => null)) as {
    error?: string
    runs?: unknown[]
    origins?: Record<string, unknown>
    errors?: Array<{ compoundId?: string; message?: string }>
  } | null
  if (!response.ok) {
    throw new Error(safeMessage(payload?.error) || ADME_ASSESSMENT_FAILED)
  }
  const runs = (payload?.runs ?? []).flatMap((row) => {
    const parsed = AdmetRunSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
  const errors = (payload?.errors ?? []).flatMap((error) => {
    if (!error.compoundId || !error.message) return []
    return [{ compoundId: error.compoundId, message: safeMessage(error.message) || ADME_ASSESSMENT_FAILED }]
  })
  const origins = Object.fromEntries(Object.entries(payload?.origins ?? {}).flatMap(([compoundId, origin]) => (
    origin === "calculated" || origin === "retrieved" ? [[compoundId, origin]] : []
  ))) as Record<string, "calculated" | "retrieved">
  return { runs, errors, origins }
}

function safeMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim()
  if (!text || text.length > 220 || /at Object\.|Error:|stack|\\\\|\/home\/|C:\\/i.test(text)) return undefined
  return text
}
