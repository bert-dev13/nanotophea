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

export function getPubChemCompound(cid: number): Promise<PubChemCompound> {
  assertCid(cid)
  return cached(`pubchem:compound:${cid}`, async () => {
    const response = await pubchem(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/${PROPERTY_PATH}/JSON`,
    )
    return normalizePubChem(cid, await response.json())
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
    headers: { Accept: "application/json, chemical/x-mdl-sdfile, image/png, */*", "User-Agent": "NANOTOPHEA" },
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
