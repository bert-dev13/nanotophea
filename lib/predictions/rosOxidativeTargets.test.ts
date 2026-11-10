import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { simulateRos } from "@/lib/predictions/prototype/ros"
import {
  ROS_OXIDATIVE_STRESS_TARGETS,
  buildRosOxidativeTargetSelections,
  isRosOxidativeTargetProtein,
  matchStudyProteinForRosTarget,
  readRosOxidativeTargetKeysFromParameters,
  resolveRosOxidativeTargetViews,
  rosOxidativeTargetsToInputParameters,
} from "@/lib/predictions/rosOxidativeTargets"
import { storedSimulationFromPrototype } from "@/lib/predictions/store"

describe("ROS oxidative-stress protein targets", () => {
  it("curates the requested gene list without inventing non-KEAP1 PDB IDs", () => {
    const genes = ROS_OXIDATIVE_STRESS_TARGETS.map((row) => row.geneSymbol)
    assert.deepEqual(genes, ["KEAP1", "NFE2L2", "NQO1", "HMOX1", "SOD1", "CAT", "GPX1", "NOX4"])
    for (const row of ROS_OXIDATIVE_STRESS_TARGETS) {
      assert.ok(row.proteinName.trim())
      assert.ok(row.biologicalFunction.trim())
      assert.ok(row.uniprotIds.length)
      if (row.key === "keap1") {
        assert.equal(row.curatedPdbId, "8EJR")
        assert.equal(row.dockingSuitability, "curated_docking_receptor")
      } else {
        assert.equal(row.curatedPdbId, undefined)
        assert.notEqual(row.dockingSuitability, "curated_docking_receptor")
      }
    }
  })

  it("matches study proteins by gene alias and UniProt", () => {
    const nrf2 = ROS_OXIDATIVE_STRESS_TARGETS.find((row) => row.key === "nfe2l2")!
    const hit = matchStudyProteinForRosTarget(nrf2, [
      {
        id: "p1",
        name: "Nrf2",
        geneSymbol: "NRF2",
        uniprotIds: ["Q16236"],
      },
    ])
    assert.equal(hit?.id, "p1")
    assert.equal(isRosOxidativeTargetProtein({ name: "KEAP1", gene: "KEAP1" }), true)
    assert.equal(isRosOxidativeTargetProtein({ name: "YAP1", gene: "YAP1" }), false)
  })

  it("exposes curated KEAP1 docking context without treating docking as ROS", () => {
    const views = resolveRosOxidativeTargetViews({
      selectedKeys: ["keap1", "sod1"],
      proteins: [
        {
          id: "prot-keap1",
          name: "KEAP1",
          gene: "KEAP1",
          pdbId: "8EJR",
          uniprotIds: ["Q14145"],
        },
      ],
      docking: [{ compoundId: "c1", proteinId: "prot-keap1", bestBindingAffinityKcalMol: -8.4 }],
      compoundId: "c1",
    })
    const keap1 = views.find((row) => row.key === "keap1")!
    const sod1 = views.find((row) => row.key === "sod1")!
    assert.equal(keap1.selected, true)
    assert.equal(keap1.inStudy, true)
    assert.equal(keap1.dockingProfileId, "KEAP1_NRF2_PROFILE")
    assert.equal(keap1.dockingAffinityKcalMol, -8.4)
    assert.equal(sod1.selected, true)
    assert.equal(sod1.dockingProfileId, undefined)
    assert.equal(sod1.dockingSuitability, "not_suitable_without_curated_profile")
  })

  it("persists selected targets in run metadata without changing ROS simulation outputs", () => {
    const features = {
      studyId: "s1",
      phytochemicalId: "c1",
      phytochemicalName: "Quercetin",
      cellLineId: "cl1",
      cellLineName: "HepG2",
      targetProteinIds: [] as string[],
      docking: [],
      admeDescriptors: {},
    }
    const baseline = simulateRos(features)
    const withNoise = simulateRos({
      ...features,
      // If targets were wrongly fed into identity, this would change ROS outputs.
      targetProteinIds: ["should-not-affect-ros"],
    })
    // Identity factor includes targetProteinIds today for generic math — ROS UI must not pass them.
    // Guard: store path keeps ROS features targetProteinIds empty while still recording selections.
    assert.notEqual(
      baseline.outputs["Exploratory relative ROS index"].value,
      withNoise.outputs["Exploratory relative ROS index"].value,
    )

    const selections = buildRosOxidativeTargetSelections(
      resolveRosOxidativeTargetViews({
        selectedKeys: ["keap1", "hmox1"],
        proteins: [{ id: "prot-keap1", name: "KEAP1", gene: "KEAP1", pdbId: "8EJR", uniprotIds: ["Q14145"] }],
        docking: [{ compoundId: "c1", proteinId: "prot-keap1", bestBindingAffinityKcalMol: -7.1 }],
        compoundId: "c1",
      }),
    )
    const params = rosOxidativeTargetsToInputParameters(selections)
    assert.equal(params["meta:rosOxidativeTargetsDriveAssay"], false)
    assert.equal(params["meta:rosOxidativeTargetKeys"], "keap1,hmox1")
    assert.equal(params["meta:rosOxidativeTarget.0.dockingAffinityKcalMol"], -7.1)
    assert.match(String(params["meta:rosOxidativeTarget.0.dockingVsRos"]), /not a ROS measurement/i)

    const stored = storedSimulationFromPrototype(baseline, features, {
      cellLineId: "cl1",
      rosOxidativeTargets: selections,
    })
    assert.equal(stored.endpoint, "ros")
    assert.ok(stored.inputParameters)
    assert.equal(stored.inputParameters["meta:rosOxidativeTargetGenes"], "KEAP1,HMOX1")
    assert.deepEqual(readRosOxidativeTargetKeysFromParameters(stored.inputParameters), ["keap1", "hmox1"])
    // Features used for simulation remain protein-free for ROS.
    assert.deepEqual(features.targetProteinIds, [])
  })
})
