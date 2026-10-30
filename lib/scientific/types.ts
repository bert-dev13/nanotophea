/** Normalized public-source records. These are not study selections. */

export interface PubChemCompound {
  cid: number
  formula?: string
  molecularWeight?: number
  iupac?: string
  /** Connectivity SMILES when PubChem provides it. */
  canonicalSmiles?: string
  /** Isomeric or default SMILES when PubChem provides it. */
  isomericSmiles?: string
  xLogP?: number
  hBondDonors?: number
  hBondAcceptors?: number
  rotatableBonds?: number
  tpsa?: number
  source: "PubChem"
}

export interface PubChemStructure {
  cid: number
  conformer: "3d" | "2d"
  sdf: string
}

export interface RcsbPolymer {
  description?: string
  organism?: string
  uniprotIds: string[]
  chains: string[]
  fragment?: string
  mutation?: string
  length?: number
}

export interface RcsbStructure {
  pdbId: string
  title?: string
  method?: string
  resolution?: string
  organism?: string
  /** First polymer entity, kept for existing readers. */
  molecule?: string
  /** Every polymer-entity description returned by RCSB. */
  molecules?: string[]
  polymers?: RcsbPolymer[]
  released?: string
  doi?: string
  source: "RCSB PDB"
}

export interface RcsbCoordinates {
  pdbId: string
  pdb: string
}
