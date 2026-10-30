/**
 * Server-side address of the hosted ADMET-AI service.
 * ADMET_API_URL is never read from a NEXT_PUBLIC_ variable.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

export interface AdmetServiceConfig {
  base: string
  apiKey?: string
  timeoutMs: number
}

export function readAdmetServiceConfig(env: NodeJS.ProcessEnv = process.env): AdmetServiceConfig | null {
  const raw = env.ADMET_API_URL?.trim()
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  const host = url.hostname.toLowerCase()
  if (env.NODE_ENV === "production" && (LOCAL_HOSTS.has(host) || host.endsWith(".local"))) return null
  return {
    base: raw.replace(/\/$/, ""),
    ...(env.ADMET_API_KEY?.trim() ? { apiKey: env.ADMET_API_KEY.trim() } : {}),
    timeoutMs: timeoutMs(env.ADMET_TIMEOUT_SECONDS),
  }
}

export function normalizeAdmeSmiles(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim().replace(/\s+/g, "")
  if (!text || text.length > 5000) return undefined
  return text
}

function timeoutMs(value: string | undefined): number {
  const seconds = Number(value || 240)
  if (!Number.isFinite(seconds)) return 240_000
  return Math.min(Math.max(seconds, 15), 280) * 1000
}
