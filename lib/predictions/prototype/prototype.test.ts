import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { simulateBax } from "@/lib/predictions/prototype/bax"
import { runPrototype } from "@/lib/predictions/prototype"
import { storedSimulationFromPrototype } from "@/lib/predictions/store"
import { hasPredictionModel, runPrediction } from "@/lib/predictions/engine"
import type { PredictionFeatures } from "@/lib/predictions/types"

const features: PredictionFeatures = {
  studyId: "study-1",
  phytochemicalId: "rutin",
  phytochemicalName: "Rutin",
  pubchemCid: 5280805,
  molecularWeight: 610.5,
  formula: "C27H30O16",
  cellLineId: "hepg2",
  cellLineName: "HepG2",
  targetProteinIds: ["bax-1"],
  docking: [],
  admeDescriptors: {},
}

describe("prototype simulations", () => {
  it("repeats the same numbers for the same inputs", () => {
    const first = runPrototype("dpph", features)
    const second = runPrototype("dpph", features)
    assert.deepEqual(first.outputs, second.outputs)
    assert.deepEqual(first.series, second.series)
    assert.equal(first.evidenceClass, "SIMULATION")
    assert.equal(first.modelName, "HEPATOTEA DPPH")
    assert.equal(first.modelVersion, "prototype-v1")
    assert.equal(first.method, "Computational prediction")
  })

  it("stores a simulation record, not a predicted one", () => {
    const result = runPrototype("ldh", features)
    const stored = storedSimulationFromPrototype(result, features)
    assert.equal(stored.provenance.evidenceClass, "SIMULATION")
    assert.equal(stored.methodType, "exploratory_math")
    assert.equal(stored.methodName, "HEPATOTEA LDH")
    assert.ok(stored.assumptions && stored.assumptions.length > 0)
    assert.ok(stored.resultPoints.every((point) => point.metric === "predicted_cytotoxicity"))
  })

  it("keeps the BAX population shares at 100", () => {
    const result = simulateBax(features)
    const shares = ["Viable", "Early apoptotic", "Late apoptotic", "Necrotic"]
      .map((key) => result.outputs[key]?.value ?? 0)
      .reduce((sum, value) => sum + value, 0)
    assert.ok(Math.abs(shares - 100) < 0.05)
  })

  it("leaves the validated engine unconfigured", () => {
    assert.equal(hasPredictionModel("dpph"), false)
    const result = runPrediction("mtt", features)
    assert.equal(result.status, "not_configured")
    assert.equal("output" in result, false)
  })

  it("does not use a random generator", () => {
    const source = [
      "math.ts",
      "dpph.ts",
      "mtt.ts",
      "ldh.ts",
      "ros.ts",
      "bax.ts",
      "hippo-yap.ts",
      "index.ts",
    ].map((name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8")).join("\n")
    assert.equal(source.includes("Math.random"), false)
    assert.equal(source.includes("seededRand"), false)
  })
})
