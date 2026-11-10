import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readStudyUiPrefs } from "@/lib/workflow/studyUiPrefs"

describe("studyUiPrefs", () => {
  it("returns fallbacks when window/sessionStorage is unavailable", () => {
    const prefs = readStudyUiPrefs(null, "docking", { pairId: "a", filter: "all" })
    assert.equal(prefs.pairId, "a")
    assert.equal(prefs.filter, "all")
  })
})
