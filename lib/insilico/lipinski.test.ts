import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { screenLipinski } from "./lipinski"

describe("Lipinski screening", () => {
  it("passes when the four retrieved descriptors meet the thresholds", () => {
    const result = screenLipinski({
      molecularWeight: 302.24,
      xLogP: 1.5,
      hBondDonors: 5,
      hBondAcceptors: 7,
    })
    assert.equal(result.overall, "pass")
    assert.equal(result.overallLabel, "Passes Lipinski screening")
    assert.deepEqual(
      result.rules.map((rule) => rule.pass),
      [true, true, true, true],
    )
    assert.equal(result.rules[0].value, "302.24 g/mol")
  })

  it("fails a rule from the retrieved value and does not pass overall", () => {
    const result = screenLipinski({
      molecularWeight: 610.52,
      xLogP: 1.2,
      hBondDonors: 10,
      hBondAcceptors: 16,
    })
    assert.equal(result.overall, "fail")
    assert.equal(result.rules[0].pass, false)
    assert.equal(result.rules[2].pass, false)
    assert.equal(result.rules[3].pass, false)
  })

  it("does not mark a missing descriptor as pass or fail", () => {
    const result = screenLipinski({
      molecularWeight: 302.24,
      hBondDonors: 5,
      hBondAcceptors: 7,
    })
    assert.equal(result.overall, "incomplete")
    assert.equal(result.rules[1].pass, null)
    assert.equal(result.rules[1].value, null)
  })
})
