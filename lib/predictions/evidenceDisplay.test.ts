import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { PredictionRun } from "@/lib/domain/models"
import {
  dockingIndependenceNote,
  resolvePredictionEvidenceDisplay,
} from "@/lib/predictions/evidenceDisplay"

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

describe("prediction evidence display", () => {
  it("labels exploratory assays as SIMULATION with exploratory title", () => {
    const display = resolvePredictionEvidenceDisplay("mtt", run({ endpoint: "mtt", module: "mtt" }))
    assert.equal(display.class, "SIMULATION")
    assert.equal(display.title, "Exploratory Computational Result")
    assert.match(display.summary, /not scientifically validated predictions/i)
    assert.ok(display.showAssumptionsLink)
    assert.ok(display.dockingNote)
  })

  it("does not promote unverified PREDICTED labels without a registered model", () => {
    const display = resolvePredictionEvidenceDisplay(
      "dpph",
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
      }),
    )
    assert.equal(display.class, "NOT_AVAILABLE")
    assert.notEqual(display.class, "PREDICTED")
  })

  it("keeps EXPERIMENTAL only for laboratory evidence class", () => {
    const display = resolvePredictionEvidenceDisplay(
      "ldh",
      run({
        endpoint: "ldh",
        module: "ldh",
        methodType: "documented_model",
        provenance: {
          evidenceClass: "EXPERIMENTAL",
          recordedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    )
    assert.equal(display.class, "EXPERIMENTAL")
  })

  it("includes docking independence notes for DPPH/MTT/LDH/ROS/BAX", () => {
    for (const endpoint of ["dpph", "mtt", "ldh", "ros", "bax"] as const) {
      assert.match(dockingIndependenceNote(endpoint) ?? "", /Docking ΔG/i)
    }
    assert.match(dockingIndependenceNote("hippo_yap") ?? "", /exploratory pathway proxy/i)
  })

  it("defaults pre-run modules without registered models to SIMULATION", () => {
    const display = resolvePredictionEvidenceDisplay("ros", null)
    assert.equal(display.class, "SIMULATION")
    assert.equal(display.title, "Exploratory Computational Result")
  })
})
