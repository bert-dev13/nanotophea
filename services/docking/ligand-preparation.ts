import { getPubChemStructure } from "@/lib/scientific/pubchem"

export class StructureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StructureError"
  }
}

/** 3D SDF from PubChem. A 2D drawing is not a docking conformer. */
export async function fetchLigandStructure(cid: number | undefined): Promise<{ sdf: string; source: string }> {
  if (cid == null) throw new StructureError("PubChem structure unavailable")
  try {
    const structure = await getPubChemStructure(cid)
    const hasCoordinates = structure.sdf.includes("V2000") || structure.sdf.includes("V3000")
    if (structure.conformer !== "3d" || !hasCoordinates) {
      throw new StructureError("PubChem structure unavailable")
    }
    return {
      sdf: structure.sdf,
      source: `PubChem CID ${cid} 3D SDF`,
    }
  } catch (error) {
    if (error instanceof StructureError) throw error
    throw new StructureError("PubChem structure unavailable")
  }
}
