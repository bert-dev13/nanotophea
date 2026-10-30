import assert from "node:assert/strict"
import test from "node:test"
import type { AdmetRun } from "@/lib/domain/models"
import { admeSummaryCopy, presentAdmeGroups } from "./admeAssessment"

function run(partial: Partial<AdmetRun> & Pick<AdmetRun, "id" | "compoundId">): AdmetRun {
  return {
    studyId: "study",
    descriptors: {},
    status: "final",
    provider: "ADMET-AI",
    provenance: { evidenceClass: "PREDICTED", source: "ADMET-AI", methodName: "Computational ADME prediction" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "user",
    updatedBy: "user",
    ...partial,
  }
}

test("summary copy follows the automatic assessment phase", () => {
  assert.equal(admeSummaryCopy("running"), "Assessment running")
  assert.equal(admeSummaryCopy("failed"), "ADME assessment could not be completed.")
  assert.equal(admeSummaryCopy("load_error"), "Unable to load assessment")
  assert.equal(admeSummaryCopy("recorded"), "Computational assessment completed")
  assert.equal(admeSummaryCopy("idle"), "Run the assessment")
  assert.equal(admeSummaryCopy("unavailable"), "ADME data is not available for this compound.")
})

test("recorded assessment shows only stored fields", () => {
  const stored = run({
    id: "run-1",
    compoundId: "quercetin",
    toolName: "ADMET-AI",
    descriptors: {
      giAbsorption: "Absorbed (0.91)",
      bbbPermeability: "No (0.20)",
      cyp3a4Inhibitor: "Yes (0.80)",
      lipinski: "0 violations",
    },
  })
  const labels = presentAdmeGroups(stored).flatMap((group) => group.fields.map((field) => `${field.label}=${field.value}`))
  assert.deepEqual(labels, [
    "GI Absorption=Absorbed (0.91)",
    "BBB Permeability=No (0.20)",
    "CYP3A4 Inhibitor=Yes (0.80)",
  ])
})
