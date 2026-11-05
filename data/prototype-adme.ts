/**
 * Deterministic demo ADME values for the interface prototype.
 * These are not ADMET-AI predictions, experimental measurements, or model output.
 * Lookup is exact or alias: compound id, PubChem CID, normalized compound name, or canonical SMILES. Missing compounds stay missing.
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
  entry(["quercetin", "Quercetin"], 5280343, ["C1=CC(=C(C=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O)O", "O=c1c(O)c(-c2ccc(O)c(O)c2)oc2cc(O)cc(O)c12"], {
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
  entry(["rutin", "Rutin"], 5280805, ["CC1C(C(C(C(O1)OCC2C(C(C(C(O2)OC3=C(OC4=CC(=CC(=C4C3=O)O)O)C5=CC(=C(C=C5)O)O)O)O)O)O)O)O", "O=c1c(OC2OC(CO)C(O)C(O)C2OC2OC(C)C(O)C(O)C2)c(-c2ccc(O)c(O)c2)oc2cc(O)cc(O)c12"], {
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
  entry(["luteolin", "Luteolin"], 5280445, ["C1=CC(=C(C=C1C2=CC(=O)C3=C(C=C(C=C3O2)O)O)O)O", "O=c1cc(-c2ccc(O)c(O)c2)oc2cc(O)cc(O)c12"], {
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
  entry(["kaempferol", "Kaempferol"], 5280863, ["C1=CC(=CC=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O", "O=c1c(O)c(-c2ccc(O)cc2)oc2cc(O)cc(O)c12"], {
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
  entry(["ellagic-acid", "ellagicacid", "Ellagic Acid"], 5281855, ["C1=C2C3=C(C(=C1O)O)OC(=O)C4=CC(=C(C(=C43)OC2=O)O)O", "O=c1oc2c(O)c(O)cc3c(=O)oc4cc(O)c(O)cc4c1c23"], {
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
  entry(["gallic-acid", "gallicacid", "Gallic Acid"], 370, ["C1=C(C=C(C(=C1O)O)O)C(=O)O", "OC(=O)c1cc(O)c(O)c(O)c1"], {
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
  entry(["corilagin", "Corilagin"], 73568, ["C1C(C(OC(=O)C2=CC(=C(C(=C2C3=C(C(=C(C=C3C(=O)O1)O)O)O)O)O)O)C4=CC(=C(C(=C4)O)O)O)OC(=O)C5=CC(=C(C(=C5)O)O)O", "O=C(OC1OC(OC(=O)c2cc(O)c(O)c(O)c2)C(O)C(O)C1O)c1cc(O)c(O)c(O)c1"], {
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
  entry(["geraniin", "Geraniin"], [3001497, 119084], ["C1C2C(C(C(C(O2)OC(=O)C3=CC(=C(C(=C3)O)O)O)O)OC(=O)C4=CC(=C(C(=C4)O)O)O)OC(=O)C5=CC(=C(C6=C5C7C(=CC(=O)C(C7(O6)O)(O)O)C(=O)O1)O)O", "O=C1OC(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C1O"], {
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
  entry(["phyllanthin", "Phyllanthin"], [358901, 9908089], ["COCC(CC1=CC(=C(C(=C1)OC)OC)OC)C(CC2=CC(=C(C(=C2)OC)OC)OC)OC", "COc1cc(CC(COc2cc(OC)c(OC)cc2CC)OC)ccc1OC"], {
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
  entry(["hypophyllanthin", "Hypophyllanthin"], [182140, 9979682], ["COCC1C(CC2=CC3=C(C(=C2)OC)OCO3)C(CC4=CC(=C(C(=C4)OC)OC)OC)OC1OC", "COc1cc(CC(COc2cc(OC)c(OC)cc2CC)OC)ccc1OC"], {
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
  entry(["astragalin", "Astragalin"], [5282102, 5318767], ["C1=CC(=CC=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)OC4C(C(C(C(O4)CO)O)O)O)O", "O=c1c(OC2OC(CO)C(O)C(O)C2O)c(-c2ccc(O)cc2)oc2cc(O)cc(O)c12"], {
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
  entry(["beta-sitosterol", "betasitosterol", "β-sitosterol", "β-Sitosterol", "Beta-Sitosterol"], 222284, ["CCC(CCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C)C(C)C", "CCC(CCC(C)C1CCC2C3CC=C4CC(O)CCC4(C)C3CCC12C)C"], {
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
  entry(["niranthin", "Niranthin"], 12303734, ["COCC(CC1=CC(=C(C(=C1)OC)OC)OC)C(CC2=CC3=C(C(=C2)OC)OCO3)OC", "COc1cc([C@@H]2OC[C@@H]3[C@@H]2CC(=C)[C@@H]3Cc2ccc(OC)c(OC)c2)ccc1OC"], {
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
  entry(["securinine", "Securinine"], [442872, 10010], ["C1CC2C3C=CN2C(=O)C1C34C=CC(=O)O4", "O=C1OCC=C2CCCCN3CC=CC(=C1)[C@H]23"], {
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

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[\s\-_β–]/g, "")
}

const byCompoundId = new Map<string, PrototypeAdmeEntry>()
const byNormalizedName = new Map<string, PrototypeAdmeEntry>()
const byCid = new Map<number, PrototypeAdmeEntry>()
const bySmiles = new Map<string, PrototypeAdmeEntry>()

for (const record of PROTOTYPE_ADME_ENTRIES) {
  for (const compoundId of record.compoundIds) {
    byCompoundId.set(compoundId, record)
    const norm = normalizeKey(compoundId)
    if (norm) byNormalizedName.set(norm, record)
  }
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

/** Exact match on compound id, PubChem CID, normalized name, or canonical SMILES. Never invents a record. */
export function lookupPrototypeAdme(query: {
  compoundId?: string
  compoundName?: string
  pubchemCid?: number
  smiles?: string
}): PrototypeAdmeEntry | undefined {
  const compoundId = query.compoundId?.trim()
  if (compoundId && byCompoundId.has(compoundId)) return byCompoundId.get(compoundId)
  if (query.pubchemCid != null && byCid.has(query.pubchemCid)) return byCid.get(query.pubchemCid)
  if (query.compoundName) {
    const normName = normalizeKey(query.compoundName)
    if (normName && byNormalizedName.has(normName)) return byNormalizedName.get(normName)
  }
  if (compoundId) {
    const normId = normalizeKey(compoundId)
    if (normId && byNormalizedName.has(normId)) return byNormalizedName.get(normId)
  }
  const smiles = normalizePrototypeSmiles(query.smiles)
  if (smiles && bySmiles.has(smiles)) return bySmiles.get(smiles)
  return undefined
}

function entry(
  compoundIds: string | string[],
  pubchemCids: number | number[],
  smiles: string | string[],
  descriptors: Record<string, string>,
): PrototypeAdmeEntry {
  return {
    compoundIds: Array.isArray(compoundIds) ? compoundIds : [compoundIds],
    pubchemCids: Array.isArray(pubchemCids) ? pubchemCids : [pubchemCids],
    smiles: Array.isArray(smiles) ? smiles : [smiles],
    descriptors: { ...descriptors },
  }
}
