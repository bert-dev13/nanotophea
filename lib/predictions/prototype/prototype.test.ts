import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { simulateBax } from "@/lib/predictions/prototype/bax"
import { antioxidantPotencyFactor, simulateDpph } from "@/lib/predictions/prototype/dpph"
import { hippoPathwayEngagement, simulateHippoYap } from "@/lib/predictions/prototype/hippo-yap"
import { simulateLdh } from "@/lib/predictions/prototype/ldh"
import { simulateMtt } from "@/lib/predictions/prototype/mtt"
import { simulateRos } from "@/lib/predictions/prototype/ros"
import { exploratoryIdentityFactor } from "@/lib/predictions/prototype/math"
import { runPrototype } from "@/lib/predictions/prototype"
import { isPrototypePredictionResult } from "@/lib/predictions/prototype/types"
import { storedSimulationFromPrototype } from "@/lib/predictions/store"
import { hasPredictionModel, runPrediction } from "@/lib/predictions/engine"
import type { PredictionFeatures } from "@/lib/predictions/types"

const compoundFeatures: PredictionFeatures = {
  studyId: "study-1",
  phytochemicalId: "rutin",
  phytochemicalName: "Rutin",
  pubchemCid: 5280805,
  molecularWeight: 610.5,
  formula: "C27H30O16",
  cellLineId: "hepg2",
  cellLineName: "HepG2",
  targetProteinIds: ["yap-1"],
  docking: [{ proteinId: "yap-1", proteinName: "YAP1", affinityKcalMol: -7.2 }],
  admeDescriptors: { hBondDonors: 10, TPSA: 269.4 },
}

const baxFeatures: PredictionFeatures = {
  ...compoundFeatures,
  targetProteinIds: ["bax-1"],
  docking: [{ proteinId: "bax-1", proteinName: "BAX", affinityKcalMol: -8.1 }],
}

describe("prototype simulations", () => {
  it("repeats the same numbers for the same inputs", () => {
    const first = runPrototype("dpph", compoundFeatures)
    const second = runPrototype("dpph", compoundFeatures)
    assert.equal(isPrototypePredictionResult(first), true)
    assert.equal(isPrototypePredictionResult(second), true)
    if (!isPrototypePredictionResult(first) || !isPrototypePredictionResult(second)) return
    assert.deepEqual(first.outputs, second.outputs)
    assert.deepEqual(first.series, second.series)
    assert.equal(first.evidenceClass, "SIMULATION")
    assert.match(first.modelName, /DPPH/)
    assert.equal(first.modelVersion, "exploratory-v1")
    assert.equal(first.method, "Exploratory simulation")
  })

  it("stores a simulation record, not a predicted one", () => {
    const result = runPrototype("ldh", compoundFeatures)
    assert.equal(isPrototypePredictionResult(result), true)
    if (!isPrototypePredictionResult(result)) return
    const stored = storedSimulationFromPrototype(result, compoundFeatures)
    assert.equal(stored.provenance.evidenceClass, "SIMULATION")
    assert.equal(stored.methodType, "exploratory_math")
    assert.match(stored.methodName, /LDH/)
    assert.ok(stored.assumptions && stored.assumptions.length > 0)
    assert.ok(stored.resultPoints.every((point) => point.metric === "exploratory_membrane_damage_index"))
  })

  it("leaves the validated engine unconfigured", () => {
    assert.equal(hasPredictionModel("dpph"), false)
    const result = runPrediction("mtt", compoundFeatures)
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

describe("docking independence for assay endpoints", () => {
  it("does not change MTT/LDH/ROS/BAX identity factors when docking affinity changes", () => {
    const weakDock = {
      ...compoundFeatures,
      docking: [{ proteinId: "x", proteinName: "X", affinityKcalMol: -3.5 }],
    }
    const strongDock = {
      ...compoundFeatures,
      docking: [{ proteinId: "x", proteinName: "X", affinityKcalMol: -12 }],
    }
    for (const endpoint of ["mtt", "ldh", "ros", "bax"] as const) {
      assert.equal(
        exploratoryIdentityFactor(endpoint, weakDock),
        exploratoryIdentityFactor(endpoint, strongDock),
        endpoint,
      )
    }
    assert.deepEqual(simulateMtt(weakDock).outputs, simulateMtt(strongDock).outputs)
    assert.deepEqual(simulateLdh(weakDock).outputs, simulateLdh(strongDock).outputs)
    assert.deepEqual(simulateRos(weakDock).outputs, simulateRos(strongDock).outputs)
    const baxWeak = simulateBax({ ...baxFeatures, docking: weakDock.docking })
    const baxStrong = simulateBax({ ...baxFeatures, docking: strongDock.docking })
    assert.equal(isPrototypePredictionResult(baxWeak), true)
    assert.equal(isPrototypePredictionResult(baxStrong), true)
    if (isPrototypePredictionResult(baxWeak) && isPrototypePredictionResult(baxStrong)) {
      assert.deepEqual(baxWeak.outputs, baxStrong.outputs)
    }
  })
})

describe("DPPH antioxidant simulation", () => {
  it("uses the µM scavenging grid without TEAC or fitted IC50 labels", () => {
    const result = simulateDpph(compoundFeatures)
    assert.equal(result.endpoint, "dpph")
    assert.ok(result.series.every((point) => point.concentrationUnit === "uM"))
    assert.ok(result.outputs["Exploratory Hill midpoint (µM)"])
    assert.ok(result.outputs["Exploratory maximum response ratio"])
    assert.equal(result.outputs.TEAC, undefined)
    assert.equal(result.outputs.IC50, undefined)
    assert.match(result.assumptions, /not Trolox/i)
  })

  it("ignores docking affinity changes for antioxidant potency", () => {
    const withoutDock: PredictionFeatures = { ...compoundFeatures, docking: [], targetProteinIds: [] }
    const withStrongDock: PredictionFeatures = {
      ...compoundFeatures,
      docking: [{ proteinId: "yap-1", proteinName: "YAP1", affinityKcalMol: -12 }],
    }
    assert.equal(antioxidantPotencyFactor(withoutDock), antioxidantPotencyFactor(withStrongDock))
    assert.deepEqual(simulateDpph(withoutDock).outputs, simulateDpph(withStrongDock).outputs)
  })

  it("persists DPPH without summaryIc50/TEAC promotion", () => {
    const stored = storedSimulationFromPrototype(simulateDpph(compoundFeatures), compoundFeatures, { proteinId: "yap-1" })
    assert.equal(stored.endpoint, "dpph")
    assert.equal(stored.proteinId, undefined)
    assert.equal(stored.summaryIc50, undefined)
    assert.equal(stored.teac, undefined)
    assert.equal(stored.selectivityIndex, undefined)
    assert.equal(stored.concentrationUnit, "uM")
  })
})

describe("MTT metabolic viability simulation", () => {
  it("omits selectivity index and uses metabolic terminology", () => {
    const result = simulateMtt(compoundFeatures)
    assert.equal(result.outputs["Selectivity index"], undefined)
    assert.ok(result.outputs["Metabolic viability"])
    assert.ok(result.outputs["Exploratory Hill midpoint (µg/mL)"])
    assert.ok(result.series.every((point) => point.metric === "exploratory_metabolic_viability"))
    assert.match(result.assumptions, /Docking affinities are excluded/i)
  })
})

describe("LDH membrane-damage simulation", () => {
  it("does not invent predicted OD absorbance", () => {
    const result = simulateLdh(compoundFeatures)
    assert.equal(result.outputs["Predicted OD"], undefined)
    assert.ok(result.outputs["Exploratory membrane-damage index"])
    assert.ok(result.series.every((point) => point.metric === "exploratory_membrane_damage_index"))
    assert.match(result.assumptions, /No spectrophotometer absorbance/i)
  })
})

describe("ROS oxidative-stress simulation", () => {
  it("does not claim fluorescence or mitochondrial membrane potential", () => {
    const result = simulateRos(compoundFeatures)
    assert.equal(result.outputs["Mitochondrial response"], undefined)
    assert.ok(result.outputs["Exploratory relative ROS index"])
    assert.match(result.outputs["Exploratory relative ROS index"].unit, /not fluorescence/i)
    assert.match(result.assumptions, /not mitochondrial membrane potential/i)
  })
})

describe("BAX exploratory simulation", () => {
  it("refuses fabricated populations and multi-marker expression", () => {
    const result = simulateBax(baxFeatures)
    assert.equal(isPrototypePredictionResult(result), true)
    if (!isPrototypePredictionResult(result)) return
    assert.equal(result.outputs.Viable, undefined)
    assert.equal(result.outputs["Early apoptotic"], undefined)
    assert.equal(result.outputs["Late apoptotic"], undefined)
    assert.equal(result.outputs.Necrotic, undefined)
    assert.equal(result.outputs["BCL-2 response"], undefined)
    assert.equal(result.outputs["Caspase-3 response"], undefined)
    assert.ok(result.outputs["Exploratory BAX-target context response"])
    assert.match(result.assumptions, /not Annexin/i)
  })

  it("returns unavailable without a BAX target protein", () => {
    const result = simulateBax({ ...compoundFeatures, targetProteinIds: [], docking: [] })
    assert.equal(result.status, "unavailable")
    if (result.status !== "unavailable") return
    assert.ok(result.missing.includes("targetProteinIds"))
  })
})

describe("Hippo–YAP pathway simulation", () => {
  it("preserves Revision 01 pathway metrics and docking sensitivity", () => {
    const result = simulateHippoYap(compoundFeatures)
    assert.equal(result.endpoint, "hippo_yap")
    assert.ok(result.series.every((point) => point.metric === "yap_tead_transcriptional_residual"))
    assert.ok(result.outputs["YAP–TEAD residual activity"])
    assert.equal(result.outputs.TEAC, undefined)
    assert.equal(result.outputs.IC50, undefined)
    const weak = simulateHippoYap({
      ...compoundFeatures,
      docking: [{ proteinId: "yap-1", proteinName: "YAP1", affinityKcalMol: -4.0 }],
    })
    const strong = simulateHippoYap({
      ...compoundFeatures,
      docking: [{ proteinId: "yap-1", proteinName: "YAP1", affinityKcalMol: -9.5 }],
    })
    assert.notDeepEqual(weak.outputs, strong.outputs)
    assert.ok(
      hippoPathwayEngagement({
        ...compoundFeatures,
        docking: [{ proteinId: "yap-1", proteinName: "YAP1", affinityKcalMol: -9.5 }],
      }).engagement >
        hippoPathwayEngagement({
          ...compoundFeatures,
          docking: [{ proteinId: "yap-1", proteinName: "YAP1", affinityKcalMol: -4.0 }],
        }).engagement,
    )
  })
})

describe("cross-endpoint integrity", () => {
  it("keeps independent metrics and SIMULATION classification", () => {
    const dpph = runPrototype("dpph", compoundFeatures)
    const hippo = runPrototype("hippo_yap", compoundFeatures)
    const mtt = runPrototype("mtt", compoundFeatures)
    assert.ok(isPrototypePredictionResult(dpph) && isPrototypePredictionResult(hippo) && isPrototypePredictionResult(mtt))
    if (!isPrototypePredictionResult(dpph) || !isPrototypePredictionResult(hippo) || !isPrototypePredictionResult(mtt)) return
    assert.notEqual(dpph.series[0]?.metric, hippo.series[0]?.metric)
    assert.notEqual(dpph.series[0]?.concentrationUnit, hippo.series[0]?.concentrationUnit)
    assert.notEqual(mtt.series[0]?.metric, dpph.series[0]?.metric)
    for (const result of [dpph, hippo, mtt]) {
      assert.equal(result.evidenceClass, "SIMULATION")
      assert.equal(result.method, "Exploratory simulation")
    }
  })
})
