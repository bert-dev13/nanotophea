/**
 * Hosted ADMET-AI provider.
 *
 * Next.js calls ADMET_API_URL. It does not start Python, read a local
 * interpreter path, or spawn a prediction process.
 */
import { AdmePredictionError } from "@/lib/adme/errors"
import { readAdmetServiceConfig, type AdmetServiceConfig } from "@/lib/adme/hosted"
import { toAdmeResult } from "@/lib/adme/normalize"
import {
  ADME_ENGINE_UNAVAILABLE,
  ADME_METHOD_LABEL,
  ADME_MODEL_NAME,
  ADME_PROVIDER_NAME,
  type AdmeBatchItem,
  type AdmePredictInput,
  type AdmeProvider,
  type AdmeResult,
} from "@/lib/adme/types"

const HEALTH_TTL_MS = 10 * 60 * 1000

let healthCache: { base: string; version: string; model: string; at: number } | null = null

export async function loadAdmetAiProvider(): Promise<AdmeProvider> {
  const config = readAdmetServiceConfig()
  if (!config) throw new AdmePredictionError("engine_unavailable", ADME_ENGINE_UNAVAILABLE)
  const identity = await readIdentity(config)
  return {
    name: ADME_PROVIDER_NAME,
    version: identity.version,
    method: ADME_METHOD_LABEL,
    model: identity.model,
    predict: (input) => predictOne(config, identity, input),
    predictBatch: (inputs) => predictMany(config, identity, inputs),
  }
}

async function predictOne(
  config: AdmetServiceConfig,
  identity: { version: string; model: string },
  input: AdmePredictInput,
): Promise<AdmeResult> {
  const [item] = await predictMany(config, identity, [input])
  if (!item?.result) throw new AdmePredictionError("assessment_failed", "The prediction service did not return a result for this compound.")
  return item.result
}

async function predictMany(
  config: AdmetServiceConfig,
  identity: { version: string; model: string },
  inputs: AdmePredictInput[],
): Promise<AdmeBatchItem[]> {
  if (inputs.length === 0) return []
  const payload = await postPredict(config, {
    compounds: inputs.map((input) => ({ id: input.compoundId, smiles: input.smiles })),
  })
  const version = versionOf(payload.providerVersion) || identity.version
  const model = typeof payload.model === "string" && payload.model.trim() ? payload.model.trim() : identity.model
  const byId = new Map((payload.results ?? []).map((item) => [item.id, item]))
  return inputs.map((input) => {
    const item = byId.get(input.compoundId)
    if (!item?.ok || !item.values) return { compoundId: input.compoundId, failed: true }
    const normalized = toAdmeResult(input, item.values, {
      name: ADME_PROVIDER_NAME,
      version,
      method: ADME_METHOD_LABEL,
      model,
    })
    return normalized
      ? { compoundId: input.compoundId, result: normalized }
      : { compoundId: input.compoundId, failed: true }
  })
}

async function readIdentity(config: AdmetServiceConfig): Promise<{ version: string; model: string }> {
  const cached = healthCache
  if (cached && cached.base === config.base && Date.now() - cached.at < HEALTH_TTL_MS) {
    return { version: cached.version, model: cached.model }
  }
  const deadline = Date.now() + 90_000
  let lastDetail: string | undefined
  while (Date.now() < deadline) {
    try {
      const { status, body } = await requestJson(`${config.base}/health`, {
        method: "GET",
        headers: authHeaders(config.apiKey),
      }, 15_000)
      const health = asRecord(body)
      const version = versionOf(health?.version)
      if (status === 503) {
        throw new AdmePredictionError("engine_unavailable", detailOf(health) || ADME_ENGINE_UNAVAILABLE)
      }
      if (status < 500 && version) {
        const model = typeof health?.model === "string" && health.model.trim() ? health.model.trim() : ADME_MODEL_NAME
        healthCache = { base: config.base, version, model, at: Date.now() }
        return { version, model }
      }
      lastDetail = detailOf(health)
      if (status === 401) {
        throw new AdmePredictionError("assessment_failed", lastDetail || "The ADME prediction service rejected the request.")
      }
    } catch (error) {
      if (error instanceof AdmePredictionError) throw error
      lastDetail = error instanceof Error && error.name === "TimeoutError"
        ? "The ADME service has not finished starting."
        : lastDetail
    }
    await delay(2_000)
  }
  throw new AdmePredictionError("engine_unavailable", lastDetail || ADME_ENGINE_UNAVAILABLE)
}

async function postPredict(config: AdmetServiceConfig, body: unknown): Promise<PredictBody> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now()
    try {
      const { status, body: payload } = await requestJson(`${config.base}/predict`, {
        method: "POST",
        headers: { ...authHeaders(config.apiKey), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, config.timeoutMs)
      const record = asRecord(payload)
      if (status >= 200 && status < 300 && record?.ok !== false) return record as PredictBody
      const detail = detailOf(record)
      const code = record?.error === "engine_unavailable" ? "engine_unavailable" : "assessment_failed"
      if (attempt === 0 && status >= 500 && Date.now() - started < 20_000) {
        lastError = new AdmePredictionError(code, detail)
        await delay(1_000)
        continue
      }
      throw new AdmePredictionError(code, detail)
    } catch (error) {
      if (error instanceof AdmePredictionError) throw error
      lastError = error
      if (attempt === 0 && Date.now() - started < 20_000) {
        await delay(1_000)
        continue
      }
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
      throw new AdmePredictionError(
        "assessment_failed",
        timedOut
          ? "The prediction service did not respond in time. Retry the assessment; a service that has already loaded the model is faster."
          : "The ADME prediction service could not be reached.",
      )
    }
  }
  if (lastError instanceof AdmePredictionError) throw lastError
  throw new AdmePredictionError("engine_unavailable", ADME_ENGINE_UNAVAILABLE)
}

async function requestJson(url: string, init: RequestInit, timeoutMs: number): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

function authHeaders(apiKey: string | undefined): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } : { Accept: "application/json" }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null
}

function versionOf(value: unknown): string | null {
  return typeof value === "string" && /^\d+\.\d+/.test(value.trim()) ? value.trim() : null
}

function detailOf(value: Record<string, unknown> | null): string | undefined {
  const message = value?.message
  if (typeof message !== "string") return undefined
  const text = message.trim()
  if (!text || text.length > 220 || /traceback|stack|\\\\|\/home\/|C:\\/i.test(text)) return undefined
  return text
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface PredictBody extends Record<string, unknown> {
  ok?: boolean
  error?: string
  message?: string
  providerVersion?: string
  model?: string
  results?: Array<{ id?: string; ok?: boolean; values?: Record<string, unknown> }>
}
