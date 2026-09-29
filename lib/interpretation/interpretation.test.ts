/**
 * Unit tests for Researcher Interpretation helpers (Phase 10).
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertValidEvidenceClassForSource,
  buildInterpretationFingerprint,
  evaluateInterpretationFreshness,
} from "./evidenceCatalog"
import { CONTRACT_INTERPRETATION_PRESETS, getInterpretationPreset } from "./presets"

describe("interpretation fingerprints", () => {
  it("is stable for same links", () => {
    const links = [
      { sourceType: "labDataset", sourceId: "a", sourceUpdatedAt: "t1" },
      { sourceType: "statistics", sourceId: "b", sourceUpdatedAt: "t2" },
    ]
    assert.equal(buildInterpretationFingerprint(links), buildInterpretationFingerprint(links))
  })

  it("changes when a source updatedAt changes", () => {
    const a = buildInterpretationFingerprint([
      { sourceType: "predictionRun", sourceId: "p1", sourceUpdatedAt: "t0" },
    ])
    const b = buildInterpretationFingerprint([
      { sourceType: "predictionRun", sourceId: "p1", sourceUpdatedAt: "t1" },
    ])
    assert.notEqual(a, b)
  })

  it("marks STALE when fingerprint mismatches or source missing", () => {
    const stored = buildInterpretationFingerprint([
      { sourceType: "labDataset", sourceId: "lab1", sourceUpdatedAt: "t0" },
    ])
    assert.equal(
      evaluateInterpretationFreshness(stored, [
        { sourceType: "labDataset", sourceId: "lab1", sourceUpdatedAt: "t0" },
      ]),
      "CURRENT"
    )
    assert.equal(
      evaluateInterpretationFreshness(stored, [
        { sourceType: "labDataset", sourceId: "lab1", sourceUpdatedAt: "t9" },
      ]),
      "STALE"
    )
    assert.equal(
      evaluateInterpretationFreshness(stored, [
        { sourceType: "labDataset", sourceId: "lab1", sourceUpdatedAt: "t0", missing: true },
      ]),
      "STALE"
    )
  })
})

describe("evidence class guards", () => {
  it("keeps PREDICTED/SIMULATION on prediction runs", () => {
    assert.equal(assertValidEvidenceClassForSource("predictionRun", "PREDICTED"), true)
    assert.equal(assertValidEvidenceClassForSource("predictionRun", "SIMULATION"), true)
    assert.equal(assertValidEvidenceClassForSource("predictionRun", "EXPERIMENTAL"), false)
  })

  it("requires EXPERIMENTAL for lab datasets and statistics", () => {
    assert.equal(assertValidEvidenceClassForSource("labDataset", "EXPERIMENTAL"), true)
    assert.equal(assertValidEvidenceClassForSource("labDataset", "PREDICTED"), false)
    assert.equal(assertValidEvidenceClassForSource("statistics", "EXPERIMENTAL"), true)
  })

  it("does not allow INTERPRETATION to become EXPERIMENTAL on research refs", () => {
    assert.equal(assertValidEvidenceClassForSource("reference", "LITERATURE"), true)
    assert.equal(assertValidEvidenceClassForSource("reference", "EXPERIMENTAL"), false)
  })
})

describe("contract presets", () => {
  it("exposes DPPH and LDH presets without rewriting meaning", () => {
    assert.ok(CONTRACT_INTERPRETATION_PRESETS.length >= 2)
    const dpph = getInterpretationPreset("contract-dpph-treatments")
    const ldh = getInterpretationPreset("contract-ldh-treatments")
    assert.ok(dpph?.researchQuestion.includes("DPPH"))
    assert.ok(ldh?.researchQuestion.includes("LDH"))
    assert.ok(dpph?.hypothesisText.includes("Null"))
  })
})

describe("no automatic conclusions", () => {
  it("does not provide an auto-assessment function", () => {
    // Structural guard: presets never include efficacy conclusions
    for (const p of CONTRACT_INTERPRETATION_PRESETS) {
      assert.equal(/proven effective|clinically|cures|validated treatment/i.test(p.hypothesisText), false)
      assert.equal(/proven effective|clinically|cures/i.test(p.researchObjective), false)
    }
  })
})
