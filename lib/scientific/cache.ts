type Entry = { value: unknown; expires: number }

const store = new Map<string, Entry>()

const DAY = 24 * 60 * 60 * 1000

/** Process cache for normalized scientific records. Failures are not stored. */
export function cached<T>(key: string, load: () => Promise<T>, ttlMs = DAY): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T)
  return load().then((value) => {
    store.set(key, { value, expires: Date.now() + ttlMs })
    return value
  })
}

export function dropCached(key: string) {
  store.delete(key)
}
