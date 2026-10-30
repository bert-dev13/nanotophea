const hits = new Map<string, number[]>()

/** In-memory limit for a single server process. */
export function allowAiRequest(uid: string, now = Date.now(), limit = 12, windowMs = 60_000): boolean {
  const recent = (hits.get(uid) ?? []).filter((stamp) => now - stamp < windowMs)
  if (recent.length >= limit) {
    hits.set(uid, recent)
    return false
  }
  recent.push(now)
  hits.set(uid, recent)
  return true
}
