import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canonicalDockingPairDocId,
  canonicalDockingPairKey,
  DockingPairSchema,
  DockingRunSchema,
  type Compound,
  type DockingMode,
  type DockingPair,
  type DockingRun,
  type Protein,
  type SkippedDockingPair,
} from "@/lib/domain/models"
import { DOCKING_PROFILE_SPECS, profileSpecForProtein } from "@/lib/docking/profiles"
import { dockingPairStatus } from "@/lib/docking/pairStatus"

function mockMode(mode: number, affinity: number): DockingMode {
  return {
    mode,
    affinityKcalMol: affinity,
    rmsdLowerBound: mode === 1 ? 0 : 1.2,
    rmsdUpperBound: mode === 1 ? 0 : 2.5,
  }
}

function mockRun(params: {
  id: string
  compoundId: string
  proteinId: string
  affinity: number
  timestamp: string
  structureSource?: "EXPERIMENTAL_STRUCTURE" | "PREDICTED_STRUCTURE"
  structureId?: string
  receptorPdbId?: string
}): DockingRun {
  const pairId = canonicalDockingPairDocId(params.compoundId, params.proteinId)
  return DockingRunSchema.parse({
    id: params.id,
    pairId,
    studyId: "study_test",
    runName: "Mock × Target",
    compoundId: params.compoundId,
    proteinId: params.proteinId,
    modes: [mockMode(1, params.affinity), mockMode(2, params.affinity + 0.5)],
    bestBindingAffinityKcalMol: params.affinity,
    vinaVersion: "AutoDock Vina v1.2.5",
    structureSource: params.structureSource ?? "EXPERIMENTAL_STRUCTURE",
    structureId: params.structureId,
    receptorPdbId: params.receptorPdbId,
    createdAt: params.timestamp,
    updatedAt: params.timestamp,
    completedAt: params.timestamp,
    createdBy: "user1",
    updatedBy: "user1",
    status: "final",
    provenance: {
      evidenceClass: "PREDICTED",
      methodName: "AutoDock Vina",
      recordedAt: params.timestamp,
    },
  })
}

// Logic matching buildPairs in DockingPairsWorkspace
function buildPairs(
  compounds: Compound[],
  proteins: Protein[],
  runs: DockingRun[],
  skips: SkippedDockingPair[] = [],
  runsByPair: Record<string, DockingRun[]> = {},
) {
  return [...compounds]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((compound) =>
      [...proteins]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((protein) => {
          const pairKey = canonicalDockingPairDocId(compound.id, protein.id)
          const pairRuns = (
            runsByPair[pairKey] ||
            runs.filter((run) => run.compoundId === compound.id && run.proteinId === protein.id)
          ).filter((run) => run.modes && run.modes.length > 0 && Number.isFinite(run.bestBindingAffinityKcalMol))

          pairRuns.sort((a, b) => {
            const timeA = a.completedAt || a.updatedAt || a.createdAt
            const timeB = b.completedAt || b.updatedAt || b.createdAt
            return timeB.localeCompare(timeA)
          })

          const latestRun = pairRuns[0]
          const skip = skips.find((s) => s.compoundId === compound.id && s.proteinId === protein.id)

          return {
            id: pairKey,
            compound,
            protein,
            run: latestRun,
            runs: pairRuns,
            skip,
          }
        }),
    )
}

describe("Docking Pairs & Persistence Data Model", () => {
  const quercetin: Compound = {
    id: "cmp_quercetin",
    studyId: "study_test",
    name: "Quercetin",
    pubchemCid: 5280343,
    isPrimaryMarker: false,
    referenceIds: [],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    createdBy: "user1",
    updatedBy: "user1",
    provenance: { evidenceClass: "REFERENCE" },
  }

  const yap1: Protein = {
    id: "prot_yap1",
    studyId: "study_test",
    name: "YAP1",
    pdbId: "3KYS",
    biologicalTarget: "YAP1",
    pathway: "Hippo–YAP",
    referenceIds: [],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    createdBy: "user1",
    updatedBy: "user1",
    provenance: { evidenceClass: "REFERENCE" },
  }

  const bax: Protein = {
    id: "prot_bax",
    studyId: "study_test",
    name: "BAX",
    pdbId: "4ZIE",
    biologicalTarget: "BAX",
    pathway: "Intrinsic apoptosis",
    referenceIds: [],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    createdBy: "user1",
    updatedBy: "user1",
    provenance: { evidenceClass: "REFERENCE" },
  }

  const lats1: Protein = {
    id: "prot_lats1",
    studyId: "study_test",
    name: "LATS1",
    pdbId: "LATS1_AF",
    biologicalTarget: "LATS1",
    pathway: "Hippo–YAP",
    referenceIds: [],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    createdBy: "user1",
    updatedBy: "user1",
    provenance: { evidenceClass: "REFERENCE" },
  }

  const bcl2: Protein = {
    id: "prot_bcl2",
    studyId: "study_test",
    name: "BCL-2",
    pdbId: "4LVT",
    biologicalTarget: "BCL-2",
    pathway: "Intrinsic apoptosis",
    referenceIds: [],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    createdBy: "user1",
    updatedBy: "user1",
    provenance: { evidenceClass: "REFERENCE" },
  }

  const mmp9: Protein = {
    id: "prot_mmp9",
    studyId: "study_test",
    name: "MMP-9",
    pdbId: "1GKC",
    biologicalTarget: "MMP-9",
    pathway: "Invasion",
    referenceIds: [],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    createdBy: "user1",
    updatedBy: "user1",
    provenance: { evidenceClass: "REFERENCE" },
  }

  it("1. Canonical pair identity is deterministic and safe", () => {
    const pairId = canonicalDockingPairDocId(quercetin.id, yap1.id)
    const pairKey = canonicalDockingPairKey("study_test", quercetin.id, yap1.id)
    assert.equal(pairId, "cmp_quercetin__prot_yap1")
    assert.equal(pairKey, "study_test:cmp_quercetin:prot_yap1")
  })

  it("2. Running Quercetin x YAP1 20 times produces 1 docking pair with 20 historical runs", () => {
    const runs: DockingRun[] = []
    for (let i = 1; i <= 20; i++) {
      const pad = String(i).padStart(2, "0")
      runs.push(
        mockRun({
          id: `run_yap_${pad}`,
          compoundId: quercetin.id,
          proteinId: yap1.id,
          affinity: -7.5 - i * 0.005, // e.g. -7.505, -7.510, ...
          timestamp: `2026-10-08T19:${pad}:00.000Z`,
        }),
      )
    }

    assert.equal(runs.length, 20)

    const workspacePairs = buildPairs([quercetin], [yap1], runs)

    // Main workspace must display exactly 1 card, not 20!
    assert.equal(workspacePairs.length, 1)
    const pair = workspacePairs[0]!
    assert.equal(pair.id, "cmp_quercetin__prot_yap1")
    assert.equal(pair.runs.length, 20)

    // Latest run must be the newest run (run 20)
    assert.equal(pair.run?.id, "run_yap_20")
    assert.equal(pair.run?.bestBindingAffinityKcalMol, -7.6)
  })

  it("3. Pair counters and completion counters count unique canonical pairs, not historical runs", () => {
    const selectedProteins = [bax, bcl2, lats1, mmp9, yap1] // 5 targets
    const runs: DockingRun[] = [
      mockRun({ id: "run_bax_1", compoundId: quercetin.id, proteinId: bax.id, affinity: -5.679, timestamp: "2026-10-08T19:01:00Z" }),
      mockRun({ id: "run_bax_2", compoundId: quercetin.id, proteinId: bax.id, affinity: -5.681, timestamp: "2026-10-08T19:02:00Z" }),
      mockRun({ id: "run_bax_3", compoundId: quercetin.id, proteinId: bax.id, affinity: -5.679, timestamp: "2026-10-08T19:02:30Z" }),
      mockRun({ id: "run_bcl2", compoundId: quercetin.id, proteinId: bcl2.id, affinity: -7.067, timestamp: "2026-10-08T19:03:00Z" }),
      mockRun({ id: "run_lats1_1", compoundId: quercetin.id, proteinId: lats1.id, affinity: -8.232, timestamp: "2026-10-08T19:04:00Z" }),
      mockRun({ id: "run_lats1_2", compoundId: quercetin.id, proteinId: lats1.id, affinity: -8.237, timestamp: "2026-10-08T19:05:00Z" }),
      mockRun({ id: "run_mmp9", compoundId: quercetin.id, proteinId: mmp9.id, affinity: -9.421, timestamp: "2026-10-08T19:06:00Z" }),
      ...Array.from({ length: 27 }, (_, i) =>
        mockRun({
          id: `run_yap_${i + 1}`,
          compoundId: quercetin.id,
          proteinId: yap1.id,
          affinity: -7.516 - i * 0.001,
          timestamp: `2026-10-08T19:${String(i + 10).padStart(2, "0")}:00Z`,
        }),
      ),
    ]

    // Total 34 historical runs
    assert.equal(runs.length, 34)

    const workspacePairs = buildPairs([quercetin], selectedProteins, runs)

    // Must have exactly 5 canonical pair cards
    assert.equal(workspacePairs.length, 5)

    const completedPairs = workspacePairs.filter((p) => p.run != null)
    assert.equal(completedPairs.length, 5)

    // Check individual pairs
    const baxPair = workspacePairs.find((p) => p.protein.name === "BAX")!
    assert.equal(baxPair.runs.length, 3)
    assert.equal(baxPair.run?.bestBindingAffinityKcalMol, -5.679)

    const lats1Pair = workspacePairs.find((p) => p.protein.name === "LATS1")!
    assert.equal(lats1Pair.runs.length, 2)
    assert.equal(lats1Pair.run?.bestBindingAffinityKcalMol, -8.237)

    const yap1Pair = workspacePairs.find((p) => p.protein.name === "YAP1")!
    assert.equal(yap1Pair.runs.length, 27)
  })

  it("4. Deselecting a target excludes it from active pairs without losing historical runs", () => {
    const runs: DockingRun[] = [
      mockRun({ id: "run_bax_1", compoundId: quercetin.id, proteinId: bax.id, affinity: -5.679, timestamp: "2026-10-08T19:01:00Z" }),
      mockRun({ id: "run_yap_1", compoundId: quercetin.id, proteinId: yap1.id, affinity: -7.516, timestamp: "2026-10-08T19:02:00Z" }),
    ]

    // Active selection: only BAX (YAP1 is deselected in Research Setup)
    const activePairs = buildPairs([quercetin], [bax], runs)
    assert.equal(activePairs.length, 1)
    assert.equal(activePairs[0]!.protein.name, "BAX")

    // When YAP1 is selected again later, full history is restored
    const restoredPairs = buildPairs([quercetin], [bax, yap1], runs)
    assert.equal(restoredPairs.length, 2)
    const yapPair = restoredPairs.find((p) => p.protein.name === "YAP1")!
    assert.equal(yapPair.run?.id, "run_yap_1")
  })

  it("5. Provenance correctly distinguishes predicted structure (LATS1) vs experimental structure (BAX)", () => {
    const lats1Spec = profileSpecForProtein(lats1)
    assert.ok(lats1Spec)
    assert.equal(lats1Spec.structureSource, "PREDICTED_STRUCTURE")
    assert.equal(lats1Spec.verificationSource, "AlphaFold DB")
    assert.equal(lats1Spec.structureId, "AF-O95835-F1")
    assert.equal(lats1Spec.modelSource, "AlphaFold DB")
    assert.equal(lats1Spec.actualDockingReceptor, "LATS1 kinase domain")

    const baxSpec = profileSpecForProtein(bax)
    assert.ok(baxSpec)
    assert.equal(baxSpec.verificationSource, "RCSB PDB")
    assert.equal(baxSpec.pdbId, "4ZIE")
  })

  it("6. DockingPair schema validates correctly", () => {
    const pair: DockingPair = DockingPairSchema.parse({
      id: "cmp_quercetin__prot_bax",
      studyId: "study_test",
      compoundId: "cmp_quercetin",
      proteinId: "prot_bax",
      compoundName: "Quercetin",
      targetName: "BAX",
      status: "COMPLETED",
      latestRunId: "run_bax_1",
      latestBindingAffinity: -5.679,
      runsCount: 3,
      createdAt: "2026-10-08T19:00:00Z",
      updatedAt: "2026-10-08T19:05:00Z",
      createdBy: "user1",
      updatedBy: "user1",
      provenance: { evidenceClass: "PREDICTED" },
    })
    assert.equal(pair.id, "cmp_quercetin__prot_bax")
    assert.equal(pair.status, "COMPLETED")
    assert.equal(pair.runsCount, 3)
  })
})
