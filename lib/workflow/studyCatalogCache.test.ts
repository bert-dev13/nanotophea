import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getCachedCompounds,
  invalidateStudyCatalog,
  peekStudyCatalogStats,
} from "@/lib/workflow/studyCatalogCache"

describe("studyCatalogCache", () => {
  it("deduplicates concurrent fetches for the same study", async () => {
    invalidateStudyCatalog()
    let calls = 0
    const fetcher = async () => {
      calls += 1
      await new Promise((r) => setTimeout(r, 20))
      return [{ id: "c1" }]
    }
    const [a, b] = await Promise.all([
      getCachedCompounds("study-a", fetcher),
      getCachedCompounds("study-a", fetcher),
    ])
    assert.equal(calls, 1)
    assert.deepEqual(a, b)
    assert.equal(peekStudyCatalogStats().compounds, 1)
  })

  it("returns cached data within TTL without refetch", async () => {
    invalidateStudyCatalog()
    let calls = 0
    const fetcher = async () => {
      calls += 1
      return [{ id: "c2" }]
    }
    await getCachedCompounds("study-b", fetcher)
    await getCachedCompounds("study-b", fetcher)
    assert.equal(calls, 1)
    await getCachedCompounds("study-b", fetcher, { force: true })
    assert.equal(calls, 2)
  })

  it("isolates cache entries by study id", async () => {
    invalidateStudyCatalog()
    await getCachedCompounds("s1", async () => [{ id: "1" }])
    await getCachedCompounds("s2", async () => [{ id: "2" }])
    assert.equal(peekStudyCatalogStats().compounds, 2)
    invalidateStudyCatalog("s1")
    assert.equal(peekStudyCatalogStats().compounds, 1)
  })
})
