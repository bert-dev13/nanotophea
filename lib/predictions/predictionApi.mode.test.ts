import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hasPredictionModel } from "@/lib/predictions/engine"
import { runPrototype } from "@/lib/predictions/prototype"
import { isPrototypePredictionResult } from "@/lib/predictions/prototype/types"
import type { PredictionEndpoint } from "@/lib/predictions/types"

/**
 * Documents the intended API mode contract without spinning up Next.js.
 * Route behavior: validated → not_configured; exploratory requires acknowledgement.
 */
describe("prediction mode contract", () => {
  const endpoints: PredictionEndpoint[] = ["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"]

  it("reports no validated models for all six endpoints", () => {
    for (const endpoint of endpoints) assert.equal(hasPredictionModel(endpoint), false)
  })

  it("exploratory runners return SIMULATION or typed unavailable", () => {
    const features = {
      studyId: "s",
      phytochemicalId: "c1",
      phytochemicalName: "Compound",
      targetProteinIds: ["bax-1"],
      docking: [] as Array<{ proteinId: string; proteinName?: string; affinityKcalMol: number }>,
      admeDescriptors: {},
    }
    for (const endpoint of endpoints) {
      const result = runPrototype(endpoint, {
        ...features,
        targetProteinIds: endpoint === "bax" || endpoint === "hippo_yap" ? ["t1"] : [],
        cellLineId: "h",
        cellLineName: "HepG2",
      })
      if (result.status === "unavailable") {
        assert.equal(result.evidenceClass, "SIMULATION")
        assert.ok(result.reason.length > 0)
        continue
      }
      assert.equal(isPrototypePredictionResult(result), true)
      assert.equal(result.evidenceClass, "SIMULATION")
      assert.equal(result.method, "Exploratory simulation")
    }
  })
})
