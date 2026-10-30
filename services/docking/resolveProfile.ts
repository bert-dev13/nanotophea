import { materializeDockingProfile, profileSpecForProtein, type ResolvedDockingProfile } from "@/lib/docking/profiles"
import { assessTargetStructure, expectationFromRecord } from "@/lib/docking/targetVerification"
import { CATALOG_PROTEINS } from "@/lib/catalog/reusableResearchCatalog"
import { getRcsbCoordinates, getRcsbStructure } from "@/lib/scientific/rcsb"
import { getAlphaFoldCoordinates } from "@/lib/scientific/alphafold"
import type { RcsbPolymer } from "@/lib/scientific/types"

export async function resolveDockingProfile(
  protein: Record<string, any>,
): Promise<{ ok: true; profile: ResolvedDockingProfile } | { ok: false; reason: string }> {
  const spec = profileSpecForProtein({
    pdbId: typeof protein.pdbId === "string" ? protein.pdbId : undefined,
    uniprotIds: Array.isArray(protein.uniprotIds)
      ? protein.uniprotIds.filter((id): id is string => typeof id === "string")
      : [],
    name: typeof protein.name === "string" ? protein.name : undefined,
    targetId: typeof protein.targetId === "string" ? protein.targetId : undefined,
  })
  if (!spec) return { ok: false, reason: "No curated docking profile matches this target" }

  if (spec.verificationSource === "AlphaFold DB") {
    let pdb: string
    try {
      pdb = await getAlphaFoldCoordinates(spec.structureId ?? "AF-O95835-F1")
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "AlphaFold DB coordinates unavailable" }
    }
    const polymers: RcsbPolymer[] = [
      {
        chains: ["A"],
        uniprotIds: [spec.receptorUniprotId],
        description: spec.dockingReceptor,
        length: 300,
      },
    ]
    return materializeDockingProfile(spec, pdb, polymers, new Date().toISOString())
  }

  let structure
  try {
    structure = await getRcsbStructure(spec.pdbId)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "RCSB structure unavailable" }
  }
  const proteinExpectation = expectationFromRecord(protein)
  const catalogMatch = CATALOG_PROTEINS.find(
    (item) => item.pdbId?.toUpperCase() === spec.pdbId.toUpperCase() || item.key === spec.targetId,
  )
  const expectation =
    proteinExpectation && protein.pdbId === spec.pdbId
      ? proteinExpectation
      : catalogMatch
        ? expectationFromRecord(catalogMatch as unknown as Record<string, unknown>)
        : proteinExpectation

  if (expectation) {
    const verdict = assessTargetStructure({
      expectation,
      retrieved: true,
      title: structure.title,
      method: structure.method,
      resolution: structure.resolution,
      polymers: structure.polymers,
    })
    if (verdict.status !== "verified") return { ok: false, reason: `RCSB verification is ${verdict.status} for ${spec.pdbId}` }
  } else {
    const hasReceptorUniProt = (structure.polymers ?? []).some((polymer) =>
      polymer.uniprotIds.some((id) => id.trim().toUpperCase() === spec.receptorUniprotId.trim().toUpperCase()),
    )
    if (!hasReceptorUniProt) {
      return { ok: false, reason: `Structure ${spec.pdbId} does not contain receptor UniProt ${spec.receptorUniprotId}` }
    }
  }
  let pdb
  try {
    pdb = await getRcsbCoordinates(spec.pdbId)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "RCSB coordinates unavailable" }
  }
  return materializeDockingProfile(spec, pdb, structure.polymers ?? [], new Date().toISOString())
}
