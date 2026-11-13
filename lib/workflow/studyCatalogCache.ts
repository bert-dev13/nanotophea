/**
 * Browser-side short TTL cache for study catalog lists (compounds/proteins/cell lines).
 * Deduplicates repeated server-action fetches when navigating between workflow stages.
 * Never shares across study IDs. Invalidate after create/delete/update mutations.
 */

type CacheEntry<T> = { at: number; data: T; inflight?: Promise<T> }

const DEFAULT_TTL_MS = 45_000

const compounds = new Map<string, CacheEntry<unknown>>()
const proteins = new Map<string, CacheEntry<unknown>>()
const cellLines = new Map<string, CacheEntry<unknown>>()

function readCache<T>(map: Map<string, CacheEntry<unknown>>, studyId: string, ttlMs: number): T | null {
  const hit = map.get(studyId) as CacheEntry<T> | undefined
  if (!hit) return null
  if (hit.inflight) return null
  if (Date.now() - hit.at > ttlMs) {
    map.delete(studyId)
    return null
  }
  return hit.data
}

async function cachedFetch<T>(
  map: Map<string, CacheEntry<unknown>>,
  studyId: string,
  fetcher: () => Promise<T>,
  options?: { force?: boolean; ttlMs?: number },
): Promise<T> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS
  const existing = map.get(studyId) as CacheEntry<T> | undefined
  if (!options?.force && existing?.inflight) return existing.inflight
  if (!options?.force) {
    const hit = readCache<T>(map, studyId, ttlMs)
    if (hit) return hit
  }

  const inflight = fetcher()
    .then((data) => {
      map.set(studyId, { at: Date.now(), data })
      return data
    })
    .catch((error) => {
      map.delete(studyId)
      throw error
    })

  map.set(studyId, { at: Date.now(), data: (existing?.data as T) ?? (null as T), inflight })
  return inflight
}

export function getCachedCompounds<T>(
  studyId: string,
  fetcher: () => Promise<T>,
  options?: { force?: boolean; ttlMs?: number },
): Promise<T> {
  return cachedFetch(compounds, studyId, fetcher, options)
}

export function getCachedProteins<T>(
  studyId: string,
  fetcher: () => Promise<T>,
  options?: { force?: boolean; ttlMs?: number },
): Promise<T> {
  return cachedFetch(proteins, studyId, fetcher, options)
}

export function getCachedCellLines<T>(
  studyId: string,
  fetcher: () => Promise<T>,
  options?: { force?: boolean; ttlMs?: number },
): Promise<T> {
  return cachedFetch(cellLines, studyId, fetcher, options)
}

export function invalidateStudyCatalog(studyId?: string | null) {
  if (!studyId) {
    compounds.clear()
    proteins.clear()
    cellLines.clear()
    return
  }
  compounds.delete(studyId)
  proteins.delete(studyId)
  cellLines.delete(studyId)
}

export function peekStudyCatalogStats() {
  return {
    compounds: compounds.size,
    proteins: proteins.size,
    cellLines: cellLines.size,
  }
}
