/**
 * Deterministic demo ADME values for the interface prototype.
 * These are not ADMET-AI predictions, experimental measurements, or model output.
 * Lookup is exact: compound id, PubChem CID, or canonical SMILES. Missing compounds stay missing.
 */

export interface PrototypeAdmeEntry {
  /** Catalog keys or other stable compound ids. */
  compoundIds: string[]
  pubchemCids: number[]
  /** Canonical SMILES. Compared after whitespace is removed. SMILES is case-sensitive. */
  smiles: string[]
  /** Display text keyed by the ADME endpoint id. */
  descriptors: Record<string, string>
}

export const PROTOTYPE_ADME_ENTRIES: PrototypeAdmeEntry[] = [
  entry("quercetin", 5280343, "C1=CC(=C(C=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O)O", {
    giAbsorption: "High",
    pgpSubstrate: "No",
    oralBioavailability: "Moderate",
    aqueousSolubility: "Moderate",
    caco2Permeability: "Moderate",
    bbbPermeability: "Low",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "Yes",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "Yes",
    halfLife: "Moderate",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("rutin", 5280805, "CC1C(C(C(C(O1)OCC2C(C(C(C(O2)OC3=C(OC4=CC(=CC(=C4C3=O)O)O)C5=CC(=C(C=C5)O)O)O)O)O)O)O)O", {
    giAbsorption: "Low",
    pgpSubstrate: "Yes",
    oralBioavailability: "Low",
    aqueousSolubility: "Moderate",
    caco2Permeability: "Low",
    bbbPermeability: "Low",
    plasmaProteinBinding: "Moderate",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "No",
    halfLife: "Short",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("luteolin", 5280445, "C1=CC(=C(C=C1C2=CC(=O)C3=C(C=C(C=C3O2)O)O)O)O", {
    giAbsorption: "High",
    pgpSubstrate: "No",
    oralBioavailability: "Moderate",
    aqueousSolubility: "Low",
    caco2Permeability: "Moderate",
    bbbPermeability: "Low",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "Yes",
    cyp2c9Inhibitor: "Yes",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "Yes",
    halfLife: "Moderate",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Review",
  }),
  entry("kaempferol", 5280863, "C1=CC(=CC=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O", {
    giAbsorption: "High",
    pgpSubstrate: "No",
    oralBioavailability: "Moderate",
    aqueousSolubility: "Low",
    caco2Permeability: "Moderate",
    bbbPermeability: "Low",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "Yes",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "Yes",
    halfLife: "Moderate",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("ellagic-acid", 5281855, "C1=C2C3=C(C(=C1O)O)OC(=O)C4=CC(=C(C(=C43)OC2=O)O)O", {
    giAbsorption: "Moderate",
    pgpSubstrate: "No",
    oralBioavailability: "Low",
    aqueousSolubility: "Low",
    caco2Permeability: "Low",
    bbbPermeability: "Low",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "Yes",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "No",
    halfLife: "Moderate",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("gallic-acid", 370, "C1=C(C=C(C(=C1O)O)O)C(=O)O", {
    giAbsorption: "High",
    pgpSubstrate: "No",
    oralBioavailability: "High",
    aqueousSolubility: "High",
    caco2Permeability: "Moderate",
    bbbPermeability: "Moderate",
    plasmaProteinBinding: "Low",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "No",
    halfLife: "Short",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("corilagin", 73568, "C1C(C(OC(=O)C2=CC(=C(C(=C2C3=C(C(=C(C=C3C(=O)O1)O)O)O)O)O)O)C4=CC(=C(C(=C4)O)O)O)OC(=O)C5=CC(=C(C(=C5)O)O)O", {
    giAbsorption: "Low",
    pgpSubstrate: "Yes",
    oralBioavailability: "Low",
    aqueousSolubility: "Moderate",
    caco2Permeability: "Low",
    bbbPermeability: "Low",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "No",
    halfLife: "Short",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Review",
  }),
  entry("geraniin", 3001497, "C1C2C(C(C(C(O2)OC(=O)C3=CC(=C(C(=C3)O)O)O)O)OC(=O)C4=CC(=C(C(=C4)O)O)O)OC(=O)C5=CC(=C(C6=C5C7C(=CC(=O)C(C7(O6)O)(O)O)C(=O)O1)O)O", {
    giAbsorption: "Low",
    pgpSubstrate: "Yes",
    oralBioavailability: "Low",
    aqueousSolubility: "Moderate",
    caco2Permeability: "Low",
    bbbPermeability: "Low",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "No",
    halfLife: "Short",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Review",
  }),
  entry("phyllanthin", 358901, "COCC(CC1=CC(=C(C(=C1)OC)OC)OC)C(CC2=CC(=C(C(=C2)OC)OC)OC)OC", {
    giAbsorption: "High",
    pgpSubstrate: "No",
    oralBioavailability: "Moderate",
    aqueousSolubility: "Low",
    caco2Permeability: "High",
    bbbPermeability: "Moderate",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "Yes",
    cyp3a4Inhibitor: "Yes",
    halfLife: "Long",
    hergBlocking: "Review",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("hypophyllanthin", 182140, "COCC1C(CC2=CC3=C(C(=C2)OC)OCO3)C(CC4=CC(=C(C(=C4)OC)OC)OC)OC1OC", {
    giAbsorption: "High",
    pgpSubstrate: "No",
    oralBioavailability: "Moderate",
    aqueousSolubility: "Low",
    caco2Permeability: "High",
    bbbPermeability: "Moderate",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "Yes",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "Yes",
    halfLife: "Long",
    hergBlocking: "Review",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("astragalin", 5282102, "C1=CC(=CC=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)OC4C(C(C(C(O4)CO)O)O)O)O", {
    giAbsorption: "Low",
    pgpSubstrate: "Yes",
    oralBioavailability: "Low",
    aqueousSolubility: "Moderate",
    caco2Permeability: "Low",
    bbbPermeability: "Low",
    plasmaProteinBinding: "Moderate",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "No",
    halfLife: "Short",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("beta-sitosterol", 222284, "CCC(CCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C)C(C)C", {
    giAbsorption: "Low",
    pgpSubstrate: "No",
    oralBioavailability: "Low",
    aqueousSolubility: "Low",
    caco2Permeability: "Low",
    bbbPermeability: "Low",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "No",
    cyp3a4Inhibitor: "No",
    halfLife: "Long",
    hergBlocking: "Low concern",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("niranthin", 12303734, "COCC(CC1=CC(=C(C(=C1)OC)OC)OC)C(CC2=CC3=C(C(=C2)OC)OCO3)OC", {
    giAbsorption: "Moderate",
    pgpSubstrate: "No",
    oralBioavailability: "Moderate",
    aqueousSolubility: "Low",
    caco2Permeability: "Moderate",
    bbbPermeability: "Low",
    plasmaProteinBinding: "High",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "Yes",
    cyp3a4Inhibitor: "Yes",
    halfLife: "Moderate",
    hergBlocking: "Review",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Low concern",
  }),
  entry("securinine", 442872, "C1CC2C3C=CN2C(=O)C1C34C=CC(=O)O4", {
    giAbsorption: "High",
    pgpSubstrate: "No",
    oralBioavailability: "High",
    aqueousSolubility: "Moderate",
    caco2Permeability: "High",
    bbbPermeability: "Moderate",
    plasmaProteinBinding: "Moderate",
    cyp1a2Inhibitor: "No",
    cyp2c9Inhibitor: "No",
    cyp2d6Inhibitor: "Yes",
    cyp3a4Inhibitor: "No",
    halfLife: "Moderate",
    hergBlocking: "Review",
    amesMutagenicity: "Negative",
    drugInducedLiverInjury: "Review",
  }),
]

const byCompoundId = new Map<string, PrototypeAdmeEntry>()
const byCid = new Map<number, PrototypeAdmeEntry>()
const bySmiles = new Map<string, PrototypeAdmeEntry>()

for (const record of PROTOTYPE_ADME_ENTRIES) {
  for (const compoundId of record.compoundIds) byCompoundId.set(compoundId, record)
  for (const cid of record.pubchemCids) byCid.set(cid, record)
  for (const smiles of record.smiles) {
    const key = normalizePrototypeSmiles(smiles)
    if (key) bySmiles.set(key, record)
  }
}

export function normalizePrototypeSmiles(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim().replace(/\s+/g, "")
  return text || undefined
}

/** Exact match on compound id, PubChem CID, or canonical SMILES. Never invents a record. */
export function lookupPrototypeAdme(query: {
  compoundId?: string
  pubchemCid?: number
  smiles?: string
}): PrototypeAdmeEntry | undefined {
  const compoundId = query.compoundId?.trim()
  if (compoundId && byCompoundId.has(compoundId)) return byCompoundId.get(compoundId)
  if (query.pubchemCid != null && byCid.has(query.pubchemCid)) return byCid.get(query.pubchemCid)
  const smiles = normalizePrototypeSmiles(query.smiles)
  if (smiles && bySmiles.has(smiles)) return bySmiles.get(smiles)
  return undefined
}

function entry(
  compoundId: string,
  pubchemCid: number,
  smiles: string,
  descriptors: Record<string, string>,
): PrototypeAdmeEntry {
  return {
    compoundIds: [compoundId],
    pubchemCids: [pubchemCid],
    smiles: [smiles],
    descriptors: { ...descriptors },
  }
}
