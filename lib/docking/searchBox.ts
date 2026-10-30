/** Solvent, ion, and buffer residues. These are not treated as a reference ligand. */
const SKIPPED_RESIDUES = new Set([
  "HOH", "WAT", "DOD", "NA", "CL", "MG", "ZN", "CA", "K", "MN", "FE", "NI", "CO", "CU", "CD", "HG", "BR",
  "SO4", "PO4", "GOL", "EDO", "PEG", "DMS", "ACT", "ACE", "FMT", "EOH", "IPA", "MPD", "BME", "TRS", "MES",
  "EPE", "HEP", "IMD", "PG4", "PGE", "1PE", "2PE", "3PE", "NO3", "NH4", "NH2", "NME", "MOH",
])

export interface DerivedSearchBox {
  centerX: number
  centerY: number
  centerZ: number
  sizeX: number
  sizeY: number
  sizeZ: number
  label: string
  derivation: string
}

interface AtomRecord {
  residue: string
  chain: string
  sequence: string
  x: number
  y: number
  z: number
}

/** Co-crystallized residues with a real spatial extent. Empty when the file has none. */
export function referenceLigands(pdb: string): DerivedSearchBox[] {
  const groups = new Map<string, AtomRecord[]>()
  for (const atom of parseAtoms(pdb, "HETATM")) {
    if (SKIPPED_RESIDUES.has(atom.residue)) continue
    const key = `${atom.residue}|${atom.chain}|${atom.sequence}`
    const group = groups.get(key) ?? []
    group.push(atom)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((atoms) => boxFromAtoms(atoms, `${atoms[0]?.residue ?? ""} ${atoms[0]?.chain ?? ""}${atoms[0]?.sequence ?? ""}`.trim(), "reference ligand"))
    .filter((box): box is DerivedSearchBox => box != null)
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Axis-aligned extent of protein ATOM records. Null when the file has no protein atoms. */
export function blindSearchBox(pdb: string): DerivedSearchBox | null {
  const atoms = parseAtoms(pdb, "ATOM")
  if (!atoms.length) return null
  return boxFromAtoms(atoms, "Protein extent", "protein atoms")
}

function boxFromAtoms(atoms: AtomRecord[], label: string, source: string): DerivedSearchBox | null {
  if (atoms.length < 2) return null
  const xs = atoms.map((atom) => atom.x)
  const ys = atoms.map((atom) => atom.y)
  const zs = atoms.map((atom) => atom.z)
  const sizeX = round3(Math.max(...xs) - Math.min(...xs))
  const sizeY = round3(Math.max(...ys) - Math.min(...ys))
  const sizeZ = round3(Math.max(...zs) - Math.min(...zs))
  if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) return null
  return {
    centerX: round3((Math.min(...xs) + Math.max(...xs)) / 2),
    centerY: round3((Math.min(...ys) + Math.max(...ys)) / 2),
    centerZ: round3((Math.min(...zs) + Math.max(...zs)) / 2),
    sizeX,
    sizeY,
    sizeZ,
    label,
    derivation: `Center is the midpoint of the axis-aligned extent of ${atoms.length} ${source} atoms in ${label}. Size is that extent. No padding was added.`,
  }
}

function parseAtoms(pdb: string, recordName: "ATOM" | "HETATM"): AtomRecord[] {
  const atoms: AtomRecord[] = []
  for (const line of pdb.split(/\r?\n/)) {
    if (line.slice(0, 6).trim() !== recordName || line.length < 54) continue
    const alt = line.slice(16, 17).trim()
    if (alt && alt !== "A") continue
    const x = Number(line.slice(30, 38))
    const y = Number(line.slice(38, 46))
    const z = Number(line.slice(46, 54))
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    atoms.push({
      residue: line.slice(17, 20).trim().toUpperCase(),
      chain: line.slice(21, 22).trim(),
      sequence: line.slice(22, 26).trim(),
      x,
      y,
      z,
    })
  }
  return atoms
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Documented AutoDock Vina 1.2 defaults. These are search settings, not measured results. */
export const VINA_DEFAULTS = {
  exhaustiveness: 8,
  numModes: 9,
  energyRange: 3,
} as const

/** Å added to each side of a reference entity. The researcher can change it before preview. */
export const DEFAULT_BOX_PADDING = 5

const PEPTIDE_RESIDUE_LIMIT = 30

export interface ReferenceEntity {
  id: string
  name: string
  chain: string
  kind: "peptide" | "ligand"
  residueCount: number
  context: string
}

export interface CalculatedSearchBox {
  centerX: number
  centerY: number
  centerZ: number
  sizeX: number
  sizeY: number
  sizeZ: number
  padding: number
  method: string
}

interface ChainPolymer {
  description?: string
  chains: string[]
  length?: number
}

/** Chains that belong to the docking receptor, excluding reference peptides and DNA. */
export function receptorChains(pdb: string, polymers: ChainPolymer[] = []): string[] {
  const { receptor } = classify(pdb, polymers)
  return [...receptor].sort()
}

/**
 * Reference peptides and co-crystallized ligands in a downloaded structure.
 * Receptor protein chains are not included.
 */
export function listReferenceEntities(pdb: string, polymers: ChainPolymer[] = []): ReferenceEntity[] {
  const atoms = parseCoordinateAtoms(pdb)
  const { peptides } = classify(pdb, polymers)
  const entities: ReferenceEntity[] = []
  for (const chain of [...peptides].sort()) {
    const chainAtoms = atoms.filter((atom) => atom.record === "ATOM" && atom.chain === chain)
    if (!chainAtoms.length) continue
    const polymer = polymers.find((item) => item.chains.includes(chain))
    const name = polymer?.description?.trim() || `Chain ${chain}`
    entities.push({
      id: `peptide:${chain}`,
      name,
      chain,
      kind: "peptide",
      residueCount: new Set(chainAtoms.map((atom) => `${atom.residue}:${atom.sequence}`)).size,
      context: polymer?.description?.trim() || "Reference peptide",
    })
  }
  const groups = new Map<string, AtomRecord[]>()
  for (const atom of atoms) {
    if (atom.record !== "HETATM" || SKIPPED_RESIDUES.has(atom.residue)) continue
    const key = `${atom.residue}|${atom.chain}|${atom.sequence}`
    const group = groups.get(key) ?? []
    group.push(atom)
    groups.set(key, group)
  }
  for (const [key, group] of groups) {
    const [residue, chain, sequence] = key.split("|")
    entities.push({
      id: `ligand:${key}`,
      name: residue ?? "Ligand",
      chain: chain ?? "",
      kind: "ligand",
      residueCount: 1,
      context: `Co-crystallized ligand ${residue ?? ""} ${chain ?? ""}${sequence ?? ""}`.trim(),
    })
  }
  return entities
}

export function referenceEntityAtoms(pdb: string, entity: Pick<ReferenceEntity, "id" | "kind" | "chain">): AtomRecord[] {
  const atoms = parseCoordinateAtoms(pdb)
  if (entity.kind === "peptide") return atoms.filter((atom) => atom.record === "ATOM" && atom.chain === entity.chain)
  const parts = entity.id.split("|")
  const residue = parts[0]?.replace(/^ligand:/, "")
  const chain = parts[1]
  const sequence = parts[2]
  return atoms.filter((atom) => atom.record === "HETATM" && atom.residue === residue && atom.chain === chain && atom.sequence === sequence)
}

/** Center and size from the entity's atoms, expanded by padding on each side. */
export function calculateSearchBox(atoms: AtomRecord[], padding: number, label: string): CalculatedSearchBox | null {
  if (!atoms.length || !Number.isFinite(padding) || padding < 0) return null
  const xs = atoms.map((atom) => atom.x)
  const ys = atoms.map((atom) => atom.y)
  const zs = atoms.map((atom) => atom.z)
  const sizeX = round3(Math.max(...xs) - Math.min(...xs) + padding * 2)
  const sizeY = round3(Math.max(...ys) - Math.min(...ys) + padding * 2)
  const sizeZ = round3(Math.max(...zs) - Math.min(...zs) + padding * 2)
  if (!vinaDimensionsValid(sizeX, sizeY, sizeZ)) return null
  return {
    centerX: round3((Math.min(...xs) + Math.max(...xs)) / 2),
    centerY: round3((Math.min(...ys) + Math.max(...ys)) / 2),
    centerZ: round3((Math.min(...zs) + Math.max(...zs)) / 2),
    sizeX,
    sizeY,
    sizeZ,
    padding,
    method: `Axis-aligned bounding box of ${atoms.length} atoms in ${label}, expanded by ${padding} Å on each side.`,
  }
}

export function vinaDimensionsValid(sizeX: number, sizeY: number, sizeZ: number): boolean {
  return [sizeX, sizeY, sizeZ].every((size) => Number.isFinite(size) && size >= 1)
}

export function boxContainsAtoms(
  box: { centerX: number; centerY: number; centerZ: number; sizeX: number; sizeY: number; sizeZ: number },
  atoms: AtomRecord[],
): boolean {
  if (!atoms.length) return false
  const slack = 0.05
  return atoms.every((atom) =>
    Math.abs(atom.x - box.centerX) <= box.sizeX / 2 + slack
    && Math.abs(atom.y - box.centerY) <= box.sizeY / 2 + slack
    && Math.abs(atom.z - box.centerZ) <= box.sizeZ / 2 + slack
  )
}

function classify(pdb: string, polymers: ChainPolymer[]): { receptor: Set<string>; peptides: Set<string> } {
  const atoms = parseCoordinateAtoms(pdb)
  const residueCounts = new Map<string, Set<string>>()
  for (const atom of atoms) {
    if (atom.record !== "ATOM") continue
    const residues = residueCounts.get(atom.chain) ?? new Set<string>()
    residues.add(`${atom.residue}:${atom.sequence}`)
    residueCounts.set(atom.chain, residues)
  }
  const receptor = new Set<string>()
  const peptides = new Set<string>()
  const seen = new Set<string>()
  for (const polymer of polymers) {
    if (isNucleicAcid(polymer.description)) {
      polymer.chains.forEach((chain) => seen.add(chain))
      continue
    }
    const peptide = isPeptide(polymer, residueCounts)
    for (const chain of polymer.chains) {
      seen.add(chain)
      if (!residueCounts.has(chain)) continue
      if (peptide) peptides.add(chain)
      else receptor.add(chain)
    }
  }
  for (const [chain, residues] of residueCounts) {
    if (seen.has(chain)) continue
    if (residues.size > 0 && residues.size < PEPTIDE_RESIDUE_LIMIT) peptides.add(chain)
    else if (residues.size >= PEPTIDE_RESIDUE_LIMIT) receptor.add(chain)
  }
  return { receptor, peptides }
}

function isPeptide(polymer: ChainPolymer, residueCounts: Map<string, Set<string>>): boolean {
  if (polymer.description && /peptide/i.test(polymer.description)) return true
  if (typeof polymer.length === "number" && polymer.length > 0) return polymer.length < PEPTIDE_RESIDUE_LIMIT
  const counts = polymer.chains.map((chain) => residueCounts.get(chain)?.size ?? 0)
  const longest = Math.max(0, ...counts)
  return longest > 0 && longest < PEPTIDE_RESIDUE_LIMIT
}

function isNucleicAcid(description?: string): boolean {
  return Boolean(description && (/^DNA\b/i.test(description) || /nucleotide/i.test(description)))
}

function parseCoordinateAtoms(pdb: string): Array<AtomRecord & { record: "ATOM" | "HETATM" }> {
  const atoms: Array<AtomRecord & { record: "ATOM" | "HETATM" }> = []
  for (const line of pdb.split(/\r?\n/)) {
    const record = line.slice(0, 6).trim()
    if ((record !== "ATOM" && record !== "HETATM") || line.length < 54) continue
    const alt = line.slice(16, 17).trim()
    if (alt && alt !== "A") continue
    const x = Number(line.slice(30, 38))
    const y = Number(line.slice(38, 46))
    const z = Number(line.slice(46, 54))
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue
    atoms.push({
      record,
      residue: line.slice(17, 20).trim().toUpperCase(),
      chain: line.slice(21, 22).trim(),
      sequence: line.slice(22, 26).trim(),
      x,
      y,
      z,
    })
  }
  return atoms
}
