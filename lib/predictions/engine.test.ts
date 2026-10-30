import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hasPredictionModel, runPrediction } from "@/lib/predictions/engine"
import { assembleFeatures } from "@/lib/predictions/features"
import { storedPredictionFromEngine } from "@/lib/predictions/store"
import type { PredictionEndpoint, PredictionEngineResult } from "@/lib/predictions/types"

const ENDPOINTS: PredictionEndpoint[] = ["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"]

describe("prediction engine", () => {
  it("does not invent outputs when no validated model is registered", () => {
    const features = assembleFeatures({
      studyId: "study",
      compound: { id: "c", name: "Luteolin", pubchemCid: 5280445, molecularWeight: 286.24 },
      cellLine: { id: "h", name: "HepG2" },
      proteins: [{ id: "b", name: "BAX" }],
      docking: [{ proteinId: "b", proteinName: "BAX", affinityKcalMol: -7.2 }, { proteinId: "y", affinityKcalMol: undefined }],
      admeDescriptors: { xlogp: 1.4, empty: "", missing: null },
    })
    assert.equal(features.docking.length, 1)
    assert.deepEqual(features.admeDescriptors, { xlogp: 1.4 })
    for (const endpoint of ENDPOINTS) {
      const result = runPrediction(endpoint, features)
      assert.equal(result.status, "not_configured")
      assert.equal("output" in result, false)
      assert.equal(result.evidenceClass, "PREDICTED")
      assert.equal(storedPredictionFromEngine(result), null)
    }
  })

  it("stores only values a model actually returned", () => {
    const features = assembleFeatures({
      studyId: "study",
      compound: { id: "c", name: "Luteolin" },
      proteins: [],
      docking: [],
    })
    const predicted: PredictionEngineResult = {
      status: "predicted",
      endpoint: "dpph",
      features,
      evidenceClass: "PREDICTED",
      generatedAt: "2026-10-02T00:00:00.000Z",
      output: {
        modelName: "Example QSAR",
        modelVersion: "1",
        modelMethod: "validated external model",
        values: { IC50: { value: 12.5, unit: "µM" } },
      },
    }
    const stored = storedPredictionFromEngine(predicted)
    assert.equal(stored?.summaryIc50, 12.5)
    assert.equal(stored?.inputParameters?.["output.IC50"], 12.5)
    assert.equal(stored?.provenance.evidenceClass, "PREDICTED")
    assert.equal(stored?.resultPoints.length, 0)
    assert.equal(storedPredictionFromEngine({ status: "not_configured", endpoint: "dpph", features, evidenceClass: "PREDICTED" }), null)
  })

  it("reports that no endpoint model is connected", () => {
    for (const endpoint of ENDPOINTS) assert.equal(hasPredictionModel(endpoint), false)
  })
})
