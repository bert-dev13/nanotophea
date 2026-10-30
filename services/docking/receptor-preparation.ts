import { getRcsbCoordinates } from "@/lib/scientific/rcsb"
import { getAlphaFoldCoordinates } from "@/lib/scientific/alphafold"
import { StructureError } from "@/services/docking/ligand-preparation"

export interface ReceptorRestore {
  /** Modified residue in the deposited file, such as a lipidated cysteine. */
  residue: string
  /** Standard residue written into the receptor after the modification is removed. */
  as: string
  /** Atom names copied from the modified residue. The rest of that residue is omitted. */
  atomNames: string[]
}

/**
 * ATOM records for the docking receptor chains.
 * Reference peptides, solvent, and caps stay out of the file Meeko receives.
 * A restored residue keeps only the requested atoms and is renamed.
 * Residues that still lack backbone N, CA, C, and O are omitted when a restore rule is set.
 */
export function receptorChainPdb(
  pdb: string,
  chains: string[],
  restore?: ReceptorRestore,
  residueRange?: [number, number],
): string | null {
  const keep = new Set(chains.map((chain) => chain.trim()).filter(Boolean))
  if (!keep.size) return null
  const wanted = new Set((restore?.atomNames ?? []).map((name) => name.trim().toUpperCase()))
  const lines: string[] = []
  for (const line of pdb.split(/\r?\n/)) {
    if (line.length < 54) continue
    const record = line.slice(0, 6).trim()
    const chain = line[21]?.trim()
    if (!chain || !keep.has(chain)) continue
    if (residueRange) {
      const seq = parseInt(line.slice(22, 26).trim(), 10)
      if (Number.isFinite(seq) && (seq < residueRange[0] || seq > residueRange[1])) {
        continue
      }
    }
    const residue = line.slice(17, 20).trim().toUpperCase()
    const atom = line.slice(12, 16).trim().toUpperCase()
    if (record === "ATOM" && residue !== restore?.residue.toUpperCase()) {
      lines.push(line)
      continue
    }
    if (restore && record === "HETATM" && residue === restore.residue.toUpperCase() && wanted.has(atom)) {
      lines.push(renameResidue(line, restore.as))
    }
  }
  const prepared = restore ? completeResidues(lines) : lines
  if (prepared.length < 2) return null
  return `${prepared.join("\n")}\nEND\n`
}

function renameResidue(line: string, resname: string): string {
  const chars = line.split("")
  "ATOM  ".split("").forEach((character, index) => {
    chars[index] = character
  })
  resname.padEnd(3, " ").slice(0, 3).split("").forEach((character, index) => {
    chars[17 + index] = character
  })
  return chars.join("")
}

function completeResidues(lines: string[]): string[] {
  const groups = new Map<string, string[]>()
  const order: string[] = []
  for (const line of lines) {
    const key = `${line[21]}:${line.slice(22, 26)}`
    if (!groups.has(key)) order.push(key)
    groups.set(key, [...(groups.get(key) ?? []), line])
  }
  const kept: string[] = []
  for (const key of order) {
    const group = groups.get(key) ?? []
    const names = new Set(group.map((line) => line.slice(12, 16).trim().toUpperCase()))
    if (["N", "CA", "C", "O"].every((name) => names.has(name))) kept.push(...group)
  }
  return kept
}

/** Coordinate file from RCSB or AlphaFold DB. */
export async function fetchReceptorStructure(pdbId: string | undefined): Promise<{ pdb: string; source: string }> {
  const id = pdbId?.trim().toUpperCase()
  if (!id) throw new StructureError("RCSB structure unavailable")
  if (id === "LATS1_AF" || id.startsWith("AF-")) {
    try {
      const modelId = id === "LATS1_AF" ? "AF-O95835-F1" : id
      const pdb = await getAlphaFoldCoordinates(modelId)
      if (!pdb.includes("ATOM")) {
        throw new StructureError("invalid PDB")
      }
      return { pdb, source: `AlphaFold DB ${modelId}` }
    } catch (error) {
      if (error instanceof StructureError) throw error
      throw new StructureError("AlphaFold DB structure unavailable")
    }
  }
  try {
    const pdb = await getRcsbCoordinates(id)
    if (!pdb.includes("ATOM") && !pdb.includes("HETATM")) {
      throw new StructureError("invalid PDB")
    }
    return { pdb, source: `RCSB PDB ${id}` }
  } catch (error) {
    if (error instanceof StructureError) throw error
    throw new StructureError("RCSB structure unavailable")
  }
}
