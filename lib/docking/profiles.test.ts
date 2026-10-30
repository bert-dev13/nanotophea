import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { dockingProfileReport, dockingSystemLabels, dockingUnavailableText, isCompleteDockingProfile, materializeDockingProfile, profileSpecForProtein, PROFILE_MISSING, DOCKING_PROFILE_SPECS } from "@/lib/docking/profiles"
import { describeDockingSetup, unsupportedTargetsNeedWarning, type DockingTargetConfiguration } from "@/lib/docking/targetSetup"
import { receptorChainPdb } from "@/services/docking/receptor-preparation"
import { researcherDockingError, PREPARATION_FAILED, DOCKING_FAILED, CONFIGURATION_UNAVAILABLE } from "@/services/docking/types"
import type { RcsbPolymer } from "@/lib/scientific/types"

function pdbLine(record: "ATOM" | "HETATM", residue: string, chain: string, sequence: number, x: number, y: number, z: number): string {
  const line = Array.from({ length: 66 }, () => " ")
  write(line, 0, record.padEnd(6))
  write(line, 17, residue.padStart(3).slice(0, 3))
  write(line, 21, chain)
  write(line, 22, String(sequence).padStart(4))
  write(line, 30, x.toFixed(3).padStart(8))
  write(line, 38, y.toFixed(3).padStart(8))
  write(line, 46, z.toFixed(3).padStart(8))
  return line.join("")
}

function write(line: string[], start: number, value: string) {
  for (let index = 0; index < value.length; index += 1) line[start + index] = value[index] ?? " "
}

const polymers: RcsbPolymer[] = [
  { description: "Kelch-like ECH-associated protein 1", uniprotIds: ["Q14145"], chains: ["A"], length: 336 },
  { description: "Linear peptide from Nuclear factor erythroid 2-related factor 2", uniprotIds: ["Q16236"], chains: ["C"], length: 9 },
]

const pdb = [
  pdbLine("ATOM", "ALA", "A", 1, 0, 0, 0),
  pdbLine("ATOM", "ALA", "A", 2, 30, 0, 0),
  pdbLine("ATOM", "GLY", "C", 1, 10, 2, 3),
  pdbLine("ATOM", "GLU", "C", 2, 14, 6, 9),
  pdbLine("HETATM", "NH2", "C", 3, 15, 7, 10),
  pdbLine("HETATM", "HOH", "A", 9, 1, 1, 1),
].join("\n")

describe("curated docking profiles", () => {
  it("resolves the KEAP1 profile from reference peptide atoms", () => {
    const spec = profileSpecForProtein({ pdbId: "8ejr", uniprotIds: ["Q14145", "Q16236"] })
    assert.ok(spec)
    const resolved = materializeDockingProfile(spec, pdb, polymers, "2026-10-02T00:00:00.000Z")
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.profile.id, "KEAP1_NRF2_PROFILE")
    assert.deepEqual(resolved.profile.receptorChains, ["A"])
    assert.equal(resolved.profile.referenceChain, "C")
    assert.equal(resolved.profile.centerX, 12)
    assert.equal(resolved.profile.centerY, 4)
    assert.equal(resolved.profile.centerZ, 6)
    assert.equal(resolved.profile.sizeX, 14)
    assert.equal(resolved.profile.sizeY, 14)
    assert.equal(resolved.profile.sizeZ, 16)
    assert.equal(resolved.profile.exhaustiveness, 8)
    assert.equal(resolved.profile.numModes, 9)
    assert.equal(resolved.profile.energyRange, 3)
    const receptor = receptorChainPdb(pdb, resolved.profile.receptorChains)
    assert.ok(receptor)
    assert.match(receptor ?? "", /ATOM/)
    assert.doesNotMatch(receptor ?? "", /HETATM/)
    assert.doesNotMatch(receptor ?? "", / NH2 /)
    assert.equal((receptor ?? "").includes(" C "), false)
  })

  it("derives the YAP1 box from the TEAD palmitoyl cysteine, not from another target", () => {
    const spec = profileSpecForProtein({ pdbId: "3KYS", uniprotIds: ["P28347", "P46937"] })
    assert.equal(spec?.id, "YAP1_PROFILE")
    assert.equal(spec?.dockingReceptor, "TEAD1 YAP-binding domain")
    const polymers: RcsbPolymer[] = [
      { description: "Transcriptional enhancer factor TEF-1", uniprotIds: ["P28347"], chains: ["A", "C"], length: 219 },
      { description: "Yes-associated protein", uniprotIds: ["P46937"], chains: ["B", "D"], length: 125 },
    ]
    const pdb = [
      pdbLine("ATOM", "ALA", "B", 1, 40, 40, 40),
      pdbLine("ATOM", "ALA", "B", 2, 50, 40, 40),
      pdbLine("HETATM", "P1L", "A", 344, 0, 0, 0),
      pdbLine("HETATM", "P1L", "A", 344, 4, 2, 6),
      pdbLine("HETATM", "P1L", "C", 344, 80, 0, 0),
      pdbLine("HETATM", "P1L", "C", 344, 90, 0, 0),
    ].join("\n")
    const resolved = materializeDockingProfile(spec!, pdb, polymers, "2026-10-02T00:00:00.000Z")
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.deepEqual(resolved.profile.receptorChains, ["A"])
    assert.equal(resolved.profile.referenceEntity, "S-palmitoyl-L-cysteine")
    assert.equal(resolved.profile.centerX, 2)
    assert.equal(resolved.profile.centerY, 1)
    assert.equal(resolved.profile.centerZ, 3)
    assert.equal(resolved.profile.sizeX, 14)
    assert.equal(resolved.profile.sizeY, 12)
    assert.equal(resolved.profile.sizeZ, 16)
    assert.notEqual(resolved.profile.centerX, -23.164)
  })

  it("restores the palmitoyl cysteine and drops a residue that lacks a backbone atom", () => {
    const pdb = [
      "ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 20.00           N",
      "ATOM      2  CA  ALA A   1       1.000   0.000   0.000  1.00 20.00           C",
      "ATOM      3  C   ALA A   1       2.000   0.000   0.000  1.00 20.00           C",
      "ATOM      4  O   ALA A   1       2.500   1.000   0.000  1.00 20.00           O",
      "HETATM 1138  N   P1L A 344      -1.685   8.425  15.893  1.00 76.73           N",
      "HETATM 1139  CA  P1L A 344      -0.347   8.130  16.477  1.00 76.68           C",
      "HETATM 1140  CB  P1L A 344      -0.406   8.258  17.990  1.00 78.24           C",
      "HETATM 1141  SG  P1L A 344      -2.084   8.067  18.641  1.00 76.73           S",
      "HETATM 1157  C   P1L A 344       0.096   6.713  16.101  1.00 82.08           C",
      "HETATM 1137  O   P1L A 344      -0.782   5.866  15.841  1.00 95.57           O",
      "HETATM 1142  C7  P1L A 344      -2.682   9.715  18.490  1.00 76.73           C",
      pdbLine("ATOM", "ASP", "A", 411, 2, 2, 2),
    ].join("\n")
    const receptor = receptorChainPdb(pdb, ["A"], { residue: "P1L", as: "CYS", atomNames: ["N", "CA", "C", "O", "CB", "SG"] })
    assert.ok(receptor)
    assert.match(receptor ?? "", /CYS A 344/)
    assert.doesNotMatch(receptor ?? "", /P1L/)
    assert.doesNotMatch(receptor ?? "", / C7 /)
    assert.doesNotMatch(receptor ?? "", /ASP A 411/)
    assert.match(receptor ?? "", /ALA A   1/)
  })

  it("does not invent a profile when the structure has no curated reference", () => {
    assert.equal(profileSpecForProtein({ pdbId: "1ABC", uniprotIds: ["P46937"] }), null)
    assert.equal(profileSpecForProtein({ pdbId: "4S0O", uniprotIds: ["Q07812"] }), null)
    assert.equal(PROFILE_MISSING, "Docking profile not configured for this target.")
    const bax = dockingProfileReport({ pdbId: "4S0O", uniprotIds: ["Q07812"] })
    assert.equal(bax.ready, false)
    assert.equal(bax.status, "REFERENCE_REQUIRED")
    assert.equal(bax.label, "⚠ Binding-site reference required")
    assert.equal(bax.missing.includes("Binding-site reference"), true)
    assert.equal(bax.missing.some((item) => /TQ8|NFH|ADP|grid coordinate/i.test(item)), false)
    const unassigned = dockingProfileReport({})
    assert.equal(unassigned.pdbId, null)
    assert.equal(unassigned.status, "STRUCTURE_REQUIRED")
    assert.equal(dockingProfileReport({ name: "UNKNOWN_TARGET" }).status, "STRUCTURE_REQUIRED")
    assert.equal(dockingProfileReport({ pdbId: "1IVO", name: "EGFR" }).status, "STRUCTURE_REQUIRED")
    assert.match(dockingUnavailableText("UNKNOWN_TARGET"), /UNKNOWN_TARGET docking unavailable/)
    assert.match(dockingUnavailableText("UNKNOWN_TARGET"), /not currently available/)

    const readyTargets = [
      { name: "YAP1", pdbId: "3KYS" },
      { name: "KEAP1", pdbId: "8EJR" },
      { name: "Caspase-3", pdbId: "2XYG" },
      { name: "EGFR", pdbId: "1M17" },
      { name: "MMP-9", pdbId: "1GKC" },
      { name: "BCL-2", pdbId: "4LVT" },
      { name: "BAX", pdbId: "4ZIE" },
      { name: "mTOR", pdbId: "4JT5" },
      { name: "Caspase-9", pdbId: "1JXQ" },
      { name: "p53", pdbId: "2VUK" },
      { name: "LATS1", pdbId: "LATS1_AF" },
      { name: "Cyclin D1", pdbId: "5L2I" },
    ]
    for (const target of readyTargets) {
      const report = dockingProfileReport(target)
      assert.equal(report.ready, true, `${target.name} should be ready`)
      assert.equal(report.status, "READY", `${target.name} status should be READY`)
      assert.deepEqual(report.missing, [])
    }
    for (const spec of DOCKING_PROFILE_SPECS) {
      assert.equal(isCompleteDockingProfile(spec), true)
    }
  })

  it("describes YAP1 as a TEAD1 docking receptor and remembers an acknowledged target", () => {
    const spec = DOCKING_PROFILE_SPECS.find((item) => item.id === "YAP1_PROFILE")
    assert.ok(spec)
    const labels = dockingSystemLabels({ name: "YAP1", pathway: "Hippo–YAP", biologicalTarget: "YAP1", spec: spec! })
    assert.equal(labels.researchTarget, "YAP1 / Hippo–YAP signaling")
    assert.equal(labels.structuralSystem, "YAP–TEAD1 complex")
    assert.equal(labels.pdbId, "3KYS")
    assert.equal(labels.dockingReceptor, "TEAD1 YAP-binding domain")
    assert.equal(labels.referenceSite, "P1L on TEAD1")
    assert.match(labels.affinityNote ?? "", /isolated YAP1/)
    assert.equal(unsupportedTargetsNeedWarning(["BAX"], ["BAX"]), false)
    assert.equal(unsupportedTargetsNeedWarning(["EGFR"], ["BAX"]), true)
    assert.equal(unsupportedTargetsNeedWarning([], undefined), false)
  })

  it("does not treat a filled configuration or the search defaults as a ready profile", () => {
    const drafted: DockingTargetConfiguration = {
      targetId: "casp3",
      pdbId: "2XYG",
      receptorUniProt: "P42574",
      receptorChains: ["A", "B"],
      referenceType: "ligand",
      referenceIdentifier: "TQ8",
      referenceChains: ["A"],
      preparationRule: null,
      padding: 5,
      exhaustiveness: 8,
      numModes: 9,
      energyRange: 3,
      structureGap: null,
      issue: "Reference is recorded, but the profile is not in DOCKING_PROFILE_SPECS.",
    }
    const incomplete = describeDockingSetup({ pdbId: "2XYG", specComplete: false, configuration: drafted })
    assert.equal(incomplete.status, "PROFILE_INCOMPLETE")
    assert.equal(incomplete.ready, false)
    assert.equal(incomplete.missing.includes("Receptor preparation rule"), true)
    assert.equal(incomplete.missing.includes("DOCKING_PROFILE_SPECS entry"), true)
    const blocked = describeDockingSetup({
      pdbId: "1IVO",
      specComplete: false,
      configuration: { ...drafted, pdbId: "1IVO", structureGap: "wrong_domain" },
    })
    assert.equal(blocked.status, "STRUCTURE_REQUIRED")
    assert.equal(blocked.ready, false)
  })

  it("translates preparation failures for the researcher", () => {
    assert.equal(researcherDockingError("receptor preparation failure"), PREPARATION_FAILED)
    assert.equal(researcherDockingError("mk_prepare_receptor.py not found"), DOCKING_FAILED)
    assert.equal(researcherDockingError("PubChem structure unavailable"), CONFIGURATION_UNAVAILABLE)
    assert.equal(researcherDockingError(PROFILE_MISSING), PROFILE_MISSING)
  })
})
