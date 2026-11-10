import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { PredictionRun } from "@/lib/domain/models"
import { classifyPredictionProvenance } from "@/lib/predictions/provenanceClassification"
import { sanitizePredictionDisplay } from "@/lib/predictions/displaySanitization"

function run(patch: Partial<PredictionRun> = {}): PredictionRun {
  return {
    id: "r1",
    studyId: "s1",
    endpoint: "dpph",
    module: "dpph",
    runName: "test",
    methodName: "HEPATOTEA DPPH (exploratory)",
    methodType: "exploratory_math",
    source: "Exploratory simulation",
    referenceIds: [],
    concentrationUnit: "uM",
    dateGenerated: "2026-11-11T00:00:00.000Z",
    resultPoints: [],
    status: "final",
    provenance: {
      evidenceClass: "SIMULATION",
      methodName: "HEPATOTEA DPPH (exploratory)",
      recordedAt: "2026-11-11T00:00:00.000Z",
    },
    createdAt: "2026-11-11T00:00:00.000Z",
    updatedAt: "2026-11-11T00:00:00.000Z",
    createdBy: "u1",
    updatedBy: "u1",
    ...patch,
  } as PredictionRun
}

describe("prediction provenance classification", () => {
  it("classifies exploratory simulations distinctly from documented predictions", () => {
    const assessment = classifyPredictionProvenance(run())
    assert.equal(assessment.class, "exploratory_simulation")
    assert.equal(assessment.hasRegisteredModel, false)
  })

  it("does not treat PREDICTED label alone as validated science when no model is registered", () => {
    const assessment = classifyPredictionProvenance(
      run({
        methodType: "documented_model",
        source: "Imported QSAR",
        methodName: "Legacy import",
        methodVersion: "1",
        provenance: {
          evidenceClass: "PREDICTED",
          methodName: "Legacy import",
          recordedAt: "2026-01-01T00:00:00.000Z",
        },
        summaryIc50: 12,
        teac: "1.2",
      }),
    )
    assert.equal(assessment.class, "historical_unverified_provenance")
    assert.ok(assessment.warning)

    const display = sanitizePredictionDisplay(
      run({
        methodType: "documented_model",
        source: "Imported QSAR",
        methodName: "Legacy import",
        provenance: {
          evidenceClass: "PREDICTED",
          methodName: "Legacy import",
          recordedAt: "2026-01-01T00:00:00.000Z",
        },
        summaryIc50: 12,
        teac: "1.2",
        inputParameters: {},
      }),
    )
    assert.equal(display.isUnverifiedPredicted, true)
    assert.ok(display.legacy.some((row) => /IC50|TEAC/i.test(row.label)))
    assert.ok(!display.primary.some((row) => row.label === "IC50" || row.label === "TEAC"))
  })

  it("flags historical exploratory runs missing acknowledgement", () => {
    const assessment = classifyPredictionProvenance(run({ inputParameters: { "output:TEAC": 1 } }))
    assert.equal(assessment.class, "exploratory_simulation")
    assert.equal(assessment.historicalMissingConsent, true)
    assert.ok(assessment.warning)
  })
})
