/**
 * Browser-side cache for PubChem depictions and SDF payloads.
 * Avoids repeated network requests when switching compounds in Combined view.
 * Failures are not cached so researchers can retry.
 */

const IMAGE_URL_CACHE = new Map<number, string>()
const IMAGE_INFLIGHT = new Map<number, Promise<string>>()
const SDF_CACHE = new Map<number, { sdf: string; conformer: "3d" | "2d" }>()
const SDF_INFLIGHT = new Map<number, Promise<{ sdf: string; conformer: "3d" | "2d" }>>()

const IMAGE_TIMEOUT_MS = 20_000
const SDF_TIMEOUT_MS = 25_000

function assertPositiveCid(cid: number) {
  if (!Number.isInteger(cid) || cid <= 0) {
    throw new Error("Invalid PubChem CID")
  }
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Returns an object URL (or cached URL) for the PubChem 2D PNG. */
export function loadPubChemImageUrl(cid: number): Promise<string> {
  assertPositiveCid(cid)
  const hit = IMAGE_URL_CACHE.get(cid)
  if (hit) return Promise.resolve(hit)
  const pending = IMAGE_INFLIGHT.get(cid)
  if (pending) return pending

  const request = (async () => {
    const response = await fetchWithTimeout(`/api/scientific/pubchem/${cid}/image`, IMAGE_TIMEOUT_MS)
    if (!response.ok) {
      throw new Error(`PubChem image unavailable (${response.status})`)
    }
    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      throw new Error("PubChem image unavailable")
    }
    const blob = await response.blob()
    if (!blob.size || (blob.type && !blob.type.startsWith("image/"))) {
      throw new Error("PubChem image unavailable")
    }
    // Verify PNG magic bytes when possible
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
    const isPng =
      head.length >= 8 &&
      head[0] === 0x89 &&
      head[1] === 0x50 &&
      head[2] === 0x4e &&
      head[3] === 0x47
    if (!isPng && blob.type && !blob.type.startsWith("image/")) {
      throw new Error("PubChem image unavailable")
    }
    const url = URL.createObjectURL(blob)
    IMAGE_URL_CACHE.set(cid, url)
    return url
  })()
    .catch((error) => {
      IMAGE_INFLIGHT.delete(cid)
      throw error
    })
    .then((url) => {
      IMAGE_INFLIGHT.delete(cid)
      return url
    })

  IMAGE_INFLIGHT.set(cid, request)
  return request
}

export function peekPubChemImageUrl(cid: number): string | undefined {
  return IMAGE_URL_CACHE.get(cid)
}

export function loadPubChemStructure(cid: number): Promise<{ sdf: string; conformer: "3d" | "2d" }> {
  assertPositiveCid(cid)
  const hit = SDF_CACHE.get(cid)
  if (hit) return Promise.resolve(hit)
  const pending = SDF_INFLIGHT.get(cid)
  if (pending) return pending

  const request = (async () => {
    const response = await fetchWithTimeout(`/api/scientific/pubchem/${cid}/structure`, SDF_TIMEOUT_MS)
    if (!response.ok) throw new Error("PubChem structure unavailable")
    const body = (await response.json()) as { sdf?: string; conformer?: string }
    if (!body.sdf || typeof body.sdf !== "string") throw new Error("PubChem structure unavailable")
    const value = { sdf: body.sdf, conformer: body.conformer === "2d" ? ("2d" as const) : ("3d" as const) }
    SDF_CACHE.set(cid, value)
    return value
  })()
    .catch((error) => {
      SDF_INFLIGHT.delete(cid)
      throw error
    })
    .then((value) => {
      SDF_INFLIGHT.delete(cid)
      return value
    })

  SDF_INFLIGHT.set(cid, request)
  return request
}
