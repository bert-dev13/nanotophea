import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  continueAdvisory,
  continueRequirements,
  emptyReadiness,
  parseWorkspaceSlug,
  stepIdFromPathname,
  stepRecordStatus,
  studyPath,
  WORKFLOW_STEPS,
} from "./studyFlow"

describe("study workspace routing", () => {
  it("opens Research Setup on the formulation tab", () => {
    const parsed = parseWorkspaceSlug([])
    assert.equal(parsed.step.id, "setup")
    assert.equal(parsed.tab, "formulation")
    assert.equal(studyPath("abc", "setup"), "/study/abc/setup/formulation")
  })

  it("keeps docking as a single workspace without a tab segment", () => {
    assert.equal(studyPath("abc", "docking"), "/study/abc/docking")
    const parsed = parseWorkspaceSlug(["docking"])
    assert.equal(parsed.step.id, "docking")
    assert.equal(parsed.tab, "")
  })

  it("falls back when a tab id is unknown", () => {
    const parsed = parseWorkspaceSlug(["predictions", "not-a-tab"])
    assert.equal(parsed.step.id, "predictions")
    assert.equal(parsed.tab, "dpph")
  })

  it("exposes the six locked workflow steps", () => {
    assert.deepEqual(
      WORKFLOW_STEPS.map((s) => s.label),
      [
        "Research Setup",
        "In-Silico Screening",
        "Molecular Docking",
        "Biological Predictions",
        "Laboratory Validation",
        "Analysis & Interpretation",
      ]
    )
  })
})

describe("guided continue requirements", () => {
  it("names each missing setup record", () => {
    assert.deepEqual(continueRequirements("setup", emptyReadiness()), [
      "Add a formulation before continuing to In-Silico Screening.",
      "Add a phytochemical before continuing to In-Silico Screening.",
      "Add a target protein before continuing to In-Silico Screening.",
      "Add a cell line before continuing to In-Silico Screening.",
    ])
  })

  it("requires a phytochemical before molecular docking", () => {
    const messages = continueRequirements(
      "insilico",
      emptyReadiness({ proteins: 1 })
    )
    assert.deepEqual(messages, [
      "Select a phytochemical before continuing to Molecular Docking.",
    ])
  })

  it("allows predictions without a recorded docking run and says so", () => {
    const readiness = emptyReadiness({ compounds: 1, proteins: 1 })
    assert.deepEqual(continueRequirements("docking", readiness), [])
    assert.match(continueAdvisory("docking", readiness) || "", /No docking run is recorded yet/)
  })

  it("does not block laboratory entry when predictions are empty", () => {
    assert.deepEqual(continueRequirements("predictions", emptyReadiness()), [])
    assert.equal(continueAdvisory("analysis", emptyReadiness()), null)
  })
})

describe("record-backed step status", () => {
  const setupRecords = emptyReadiness({
    formulations: 1,
    compounds: 1,
    proteins: 1,
    cellLines: 1,
  })

  it("leaves status unknown until records are loaded", () => {
    assert.equal(stepRecordStatus("setup", null), "unknown")
    assert.equal(stepRecordStatus("docking", null), "unknown")
  })

  it("completes setup only when formulation, compound, protein, and cell line exist", () => {
    assert.equal(stepRecordStatus("setup", setupRecords), "complete")
    assert.equal(stepRecordStatus("setup", emptyReadiness()), "incomplete")
  })

  it("does not treat a catalog compound as a completed in-silico screen", () => {
    assert.equal(stepRecordStatus("insilico", setupRecords), "incomplete")
    assert.equal(
      stepRecordStatus("insilico", emptyReadiness({ admetRuns: 1 })),
      "complete"
    )
  })

  it("completes docking, predictions, and laboratory only from their records", () => {
    assert.equal(stepRecordStatus("docking", setupRecords), "incomplete")
    assert.equal(stepRecordStatus("docking", emptyReadiness({ dockingRuns: 2 })), "complete")
    assert.equal(stepRecordStatus("predictions", emptyReadiness()), "incomplete")
    assert.equal(
      stepRecordStatus("predictions", emptyReadiness({ predictionRuns: 1 })),
      "complete"
    )
    assert.equal(stepRecordStatus("laboratory", emptyReadiness({ labDpph: 1 })), "complete")
  })

  it("marks analysis review-required when a stored freshness check is STALE", () => {
    assert.equal(
      stepRecordStatus("analysis", emptyReadiness({ statistics: 1, staleStatistics: 1 })),
      "review"
    )
    assert.equal(
      stepRecordStatus("analysis", emptyReadiness({ comparisons: 1, staleComparisons: 1 })),
      "review"
    )
    assert.equal(
      stepRecordStatus(
        "analysis",
        emptyReadiness({ interpretations: 1, staleInterpretations: 1 })
      ),
      "review"
    )
    assert.equal(
      stepRecordStatus("analysis", emptyReadiness({ statistics: 1 })),
      "complete"
    )
    assert.equal(stepRecordStatus("docking", emptyReadiness({ staleStatistics: 1 })), "incomplete")
  })

  it("reads the open step from the study path", () => {
    assert.equal(stepIdFromPathname("/study/abc/docking", "abc"), "docking")
    assert.equal(stepIdFromPathname("/study/abc/predictions/ldh", "abc"), "predictions")
    assert.equal(stepIdFromPathname("/", "abc"), null)
    assert.equal(stepIdFromPathname("/study/other/setup/formulation", "abc"), null)
  })
})
