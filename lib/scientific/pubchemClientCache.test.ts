import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { peekPubChemImageUrl } from "@/lib/scientific/pubchemClientCache"

describe("pubchem client cache", () => {
  it("starts empty for unknown CIDs", () => {
    assert.equal(peekPubChemImageUrl(5280343), undefined)
  })

  it("rejects invalid CIDs before network access", async () => {
    const { loadPubChemImageUrl, loadPubChemStructure } = await import("@/lib/scientific/pubchemClientCache")
    assert.throws(() => {
      void loadPubChemImageUrl(0)
    }, /Invalid PubChem CID/)
    assert.throws(() => {
      void loadPubChemStructure(-1)
    }, /Invalid PubChem CID/)
  })
})
