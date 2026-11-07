import { cached } from "@/lib/scientific/cache"
import type { PubChemCompound, PubChemStructure } from "@/lib/scientific/types"

const PROPERTY_PATH =
  "MolecularFormula,MolecularWeight,IUPACName,ConnectivitySMILES,SMILES,XLogP,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,TPSA"

export function normalizePubChem(cid: number, payload: unknown): PubChemCompound {
  const row = readPropertyRow(payload)
  if (!row || Number(row.CID) !== cid) {
    throw new Error("PubChem response did not match the requested CID")
  }
  return {
    cid,
    formula: text(row.MolecularFormula),
    molecularWeight: number(row.MolecularWeight),
    iupac: text(row.IUPACName),
    canonicalSmiles: text(row.ConnectivitySMILES),
    isomericSmiles: text(row.SMILES) ?? text(row.IsomericSMILES),
    xLogP: number(row.XLogP),
    hBondDonors: number(row.HBondDonorCount),
    hBondAcceptors: number(row.HBondAcceptorCount),
    rotatableBonds: number(row.RotatableBondCount),
    tpsa: number(row.TPSA),
    source: "PubChem",
  }
}

export function getCatalogPubChemFallback(cid: number): PubChemCompound | undefined {
  return CATALOG_PUBCHEM_FALLBACKS[cid]
}

export const CATALOG_PUBCHEM_FALLBACKS: Record<number, PubChemCompound> = {
  // Quercetin
  5280343: {
    cid: 5280343,
    formula: "C15H10O7",
    molecularWeight: 302.24,
    iupac: "2-(3,4-dihydroxyphenyl)-3,5,7-trihydroxychromen-4-one",
    canonicalSmiles: "C1=CC(=C(C=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O)O",
    isomericSmiles: "C1=CC(=C(C=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O)O",
    xLogP: 1.5,
    hBondDonors: 5,
    hBondAcceptors: 7,
    rotatableBonds: 1,
    tpsa: 127,
    source: "PubChem",
  },
  // Rutin
  5280805: {
    cid: 5280805,
    formula: "C27H30O16",
    molecularWeight: 610.52,
    iupac: "2-(3,4-dihydroxyphenyl)-5,7-dihydroxy-3-[(2S,3R,4S,5S,6R)-3,4,5-trihydroxy-6-[[(2R,3R,4R,5R,6S)-3,4,5-trihydroxy-6-methyloxan-2-yl]oxymethyl]oxan-2-yl]oxychromen-4-one",
    canonicalSmiles: "CC1C(C(C(C(O1)OCC2C(C(C(C(O2)OC3=C(OC4=CC(=CC(=C4C3=O)O)O)C5=CC(=C(C=C5)O)O)O)O)O)O)O)O",
    isomericSmiles: "CC1C(C(C(C(O1)OCC2C(C(C(C(O2)OC3=C(OC4=CC(=CC(=C4C3=O)O)O)C5=CC(=C(C=C5)O)O)O)O)O)O)O)O",
    xLogP: -1.3,
    hBondDonors: 10,
    hBondAcceptors: 16,
    rotatableBonds: 6,
    tpsa: 269,
    source: "PubChem",
  },
  // Luteolin
  5280445: {
    cid: 5280445,
    formula: "C15H10O6",
    molecularWeight: 286.24,
    iupac: "2-(3,4-dihydroxyphenyl)-5,7-dihydroxychromen-4-one",
    canonicalSmiles: "C1=CC(=C(C=C1C2=CC(=O)C3=C(C=C(C=C3O2)O)O)O)O",
    isomericSmiles: "C1=CC(=C(C=C1C2=CC(=O)C3=C(C=C(C=C3O2)O)O)O)O",
    xLogP: 2.3,
    hBondDonors: 4,
    hBondAcceptors: 6,
    rotatableBonds: 1,
    tpsa: 111,
    source: "PubChem",
  },
  // Kaempferol
  5280863: {
    cid: 5280863,
    formula: "C15H10O6",
    molecularWeight: 286.24,
    iupac: "3,5,7-trihydroxy-2-(4-hydroxyphenyl)chromen-4-one",
    canonicalSmiles: "C1=CC(=CC=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O",
    isomericSmiles: "C1=CC(=CC=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O",
    xLogP: 2.2,
    hBondDonors: 4,
    hBondAcceptors: 6,
    rotatableBonds: 1,
    tpsa: 111,
    source: "PubChem",
  },
  // Astragalin
  5318767: {
    cid: 5318767,
    formula: "C21H20O11",
    molecularWeight: 448.38,
    iupac: "5,7-dihydroxy-2-(4-hydroxyphenyl)-3-[(2S,3R,4S,5S,6R)-3,4,5-trihydroxy-6-(hydroxymethyl)oxan-2-yl]oxychromen-4-one",
    canonicalSmiles: "C1=CC(=CC=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)OC4C(C(C(C(O4)CO)O)O)O)O",
    isomericSmiles: "C1=CC(=CC=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)OC4C(C(C(C(O4)CO)O)O)O)O",
    xLogP: 0.5,
    hBondDonors: 7,
    hBondAcceptors: 11,
    rotatableBonds: 4,
    tpsa: 190,
    source: "PubChem",
  },
  // Gallic Acid
  370: {
    cid: 370,
    formula: "C7H6O5",
    molecularWeight: 170.12,
    iupac: "3,4,5-trihydroxybenzoic acid",
    canonicalSmiles: "C1=C(C=C(C(=C1O)O)O)C(=O)O",
    isomericSmiles: "C1=C(C=C(C(=C1O)O)O)C(=O)O",
    xLogP: 0.7,
    hBondDonors: 4,
    hBondAcceptors: 5,
    rotatableBonds: 1,
    tpsa: 98,
    source: "PubChem",
  },
  // Ellagic Acid
  5281855: {
    cid: 5281855,
    formula: "C14H6O8",
    molecularWeight: 302.19,
    iupac: "2,3,7,8-tetrahydroxychromeno[5,4,3-cde]chromene-5,10-dione",
    canonicalSmiles: "C1=C2C3=C(C(=C1O)O)OC(=O)C4=CC(=C(C(=C43)OC2=O)O)O",
    isomericSmiles: "C1=C2C3=C(C(=C1O)O)OC(=O)C4=CC(=C(C(=C43)OC2=O)O)O",
    xLogP: 1.1,
    hBondDonors: 4,
    hBondAcceptors: 8,
    rotatableBonds: 0,
    tpsa: 134,
    source: "PubChem",
  },
  // Corilagin
  73568: {
    cid: 73568,
    formula: "C27H22O18",
    molecularWeight: 634.44,
    iupac: "Corilagin",
    canonicalSmiles: "O=C(OC1OC(OC(=O)c2cc(O)c(O)c(O)c2)C(O)C(O)C1O)c1cc(O)c(O)c(O)c1",
    isomericSmiles: "O=C(OC1OC(OC(=O)c2cc(O)c(O)c(O)c2)C(O)C(O)C1O)c1cc(O)c(O)c(O)c1",
    xLogP: -0.6,
    hBondDonors: 11,
    hBondAcceptors: 18,
    rotatableBonds: 4,
    tpsa: 301,
    source: "PubChem",
  },
  // Geraniin
  119084: {
    cid: 119084,
    formula: "C41H28O27",
    molecularWeight: 952.64,
    iupac: "Geraniin",
    canonicalSmiles: "O=C1OC(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C1O",
    isomericSmiles: "O=C1OC(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C(OC(=O)c2cc(O)c(O)c(O)c2)C1O",
    xLogP: -1.8,
    hBondDonors: 15,
    hBondAcceptors: 27,
    rotatableBonds: 6,
    tpsa: 444,
    source: "PubChem",
  },
  // Phyllanthin
  9908089: {
    cid: 9908089,
    formula: "C24H34O6",
    molecularWeight: 418.52,
    iupac: "1,2-dimethoxy-4-[[(2S,3S)-3-[(3,4-dimethoxyphenyl)methyl]-4-methoxybutan-2-yl]oxymethyl]benzene",
    canonicalSmiles: "COc1cc(CC(COc2cc(OC)c(OC)cc2CC)OC)ccc1OC",
    isomericSmiles: "COc1cc(CC(COc2cc(OC)c(OC)cc2CC)OC)ccc1OC",
    xLogP: 3.7,
    hBondDonors: 0,
    hBondAcceptors: 6,
    rotatableBonds: 9,
    tpsa: 55.4,
    source: "PubChem",
  },
  358901: {
    cid: 358901,
    formula: "C24H34O6",
    molecularWeight: 418.52,
    iupac: "Phyllanthin",
    canonicalSmiles: "COCC(CC1=CC(=C(C(=C1)OC)OC)OC)C(CC2=CC(=C(C(=C2)OC)OC)OC)OC",
    isomericSmiles: "COCC(CC1=CC(=C(C(=C1)OC)OC)OC)C(CC2=CC(=C(C(=C2)OC)OC)OC)OC",
    xLogP: 3.7,
    hBondDonors: 0,
    hBondAcceptors: 6,
    rotatableBonds: 9,
    tpsa: 55.4,
    source: "PubChem",
  },
  // Hypophyllanthin
  9979682: {
    cid: 9979682,
    formula: "C24H34O7",
    molecularWeight: 434.52,
    iupac: "Hypophyllanthin",
    canonicalSmiles: "COc1cc(CC(COc2cc(OC)c(OC)cc2CC)OC)ccc1OC",
    isomericSmiles: "COc1cc(CC(COc2cc(OC)c(OC)cc2CC)OC)ccc1OC",
    xLogP: 3.2,
    hBondDonors: 1,
    hBondAcceptors: 7,
    rotatableBonds: 9,
    tpsa: 75.6,
    source: "PubChem",
  },
  // Niranthin
  12303734: {
    cid: 12303734,
    formula: "C24H32O6",
    molecularWeight: 416.50,
    iupac: "Niranthin",
    canonicalSmiles: "COc1cc([C@@H]2OC[C@@H]3[C@@H]2CC(=C)[C@@H]3Cc2ccc(OC)c(OC)c2)ccc1OC",
    isomericSmiles: "COc1cc([C@@H]2OC[C@@H]3[C@@H]2CC(=C)[C@@H]3Cc2ccc(OC)c(OC)c2)ccc1OC",
    xLogP: 3.9,
    hBondDonors: 0,
    hBondAcceptors: 6,
    rotatableBonds: 6,
    tpsa: 55.4,
    source: "PubChem",
  },
  // Securinine
  10010: {
    cid: 10010,
    formula: "C13H15NO2",
    molecularWeight: 217.27,
    iupac: "(6S,11aR,11bS)-9,10,11,11a-tetrahydro-8H-6,11b-methanofuro[2,3-c]pyrido[1,2-a]azepin-2-one",
    canonicalSmiles: "O=C1OCC=C2CCCCN3CC=CC(=C1)[C@H]23",
    isomericSmiles: "O=C1OCC=C2CCCCN3CC=CC(=C1)[C@H]23",
    xLogP: 1.2,
    hBondDonors: 0,
    hBondAcceptors: 3,
    rotatableBonds: 0,
    tpsa: 29.5,
    source: "PubChem",
  },
  // Beta-Sitosterol
  222284: {
    cid: 222284,
    formula: "C29H50O",
    molecularWeight: 414.71,
    iupac: "beta-Sitosterol",
    canonicalSmiles: "CCC(CCC(C)C1CCC2C3CC=C4CC(O)CCC4(C)C3CCC12C)C",
    isomericSmiles: "CCC(CCC(C)C1CCC2C3CC=C4CC(O)CCC4(C)C3CCC12C)C",
    xLogP: 8.8,
    hBondDonors: 1,
    hBondAcceptors: 1,
    rotatableBonds: 6,
    tpsa: 20.2,
    source: "PubChem",
  },
}

export function getPubChemCompound(cid: number): Promise<PubChemCompound> {
  assertCid(cid)
  return cached(`pubchem:compound:${cid}`, async () => {
    try {
      const response = await pubchem(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/${PROPERTY_PATH}/JSON`,
      )
      return normalizePubChem(cid, await response.json())
    } catch (networkError) {
      const fallback = getCatalogPubChemFallback(cid)
      if (fallback) {
        return fallback
      }
      throw networkError
    }
  })
}

export function getPubChemStructure(cid: number): Promise<PubChemStructure> {
  assertCid(cid)
  return cached(`pubchem:structure:${cid}`, async () => {
    const threeD = await pubchem(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`,
      true,
    )
    if (threeD?.ok) {
      const sdf = await threeD.text()
      if (looksLikeSdf(sdf)) return { cid, conformer: "3d", sdf }
    }
    const twoD = await pubchem(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=2d`,
    )
    const sdf = await twoD.text()
    if (!looksLikeSdf(sdf)) throw new Error("PubChem did not return a structure")
    return { cid, conformer: "2d", sdf }
  })
}

export function getPubChemImage(cid: number): Promise<ArrayBuffer> {
  assertCid(cid)
  return cached(`pubchem:image:${cid}`, async () => {
    const response = await pubchem(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?record_type=2d&image_size=400x400`,
    )
    return response.arrayBuffer()
  })
}

export function assertCid(cid: number) {
  if (!Number.isInteger(cid) || cid <= 0 || cid > 999_999_999) {
    throw new Error("Invalid PubChem CID")
  }
}

async function pubchem(url: string, allowMissing = false): Promise<Response> {
  const response = await fetch(url, {
    headers: { Accept: "application/json, chemical/x-mdl-sdfile, image/png, */*", "User-Agent": "NANO-HEPATOTEA" },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    if (allowMissing) return response
    throw new Error("PubChem request failed")
  }
  return response
}

function readPropertyRow(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null
  const table = (payload as { PropertyTable?: { Properties?: unknown[] } }).PropertyTable
  const row = table?.Properties?.[0]
  if (!row || typeof row !== "object") return null
  return row as Record<string, unknown>
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function looksLikeSdf(value: string): boolean {
  return value.includes("M  END") || value.includes("V2000") || value.includes("V3000")
}
