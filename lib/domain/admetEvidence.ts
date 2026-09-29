/**
 * ADMET evidence classification — origin drives class, not module placement.
 * STUDY_DESIGN_CONTRACT.md §6.2 / §9.5
 */
import type { EvidenceType } from "@/types/evidence"
import type { Provenance } from "@/lib/domain/provenance"

/** Evidence classes allowed for ADMET-displayed values */
export const ADMET_EVIDENCE_CLASSES = [
  "PREDICTED",
  "LITERATURE",
  "REFERENCE",
] as const satisfies readonly EvidenceType[]

export type AdmetEvidenceClass = (typeof ADMET_EVIDENCE_CLASSES)[number]

/**
 * Resolve ADMET record/value evidence from declared provenance.
 * Does NOT default everything to PREDICTED.
 */
export function resolveAdmetEvidenceClass(
  provenance?: Partial<Provenance> | null,
  fallback?: AdmetEvidenceClass
): AdmetEvidenceClass {
  const cls = provenance?.evidenceClass
  if (cls === "PREDICTED" || cls === "LITERATURE" || cls === "REFERENCE") {
    return cls
  }
  if (fallback) return fallback
  throw new Error(
    "ADMET values require an explicit evidence class (PREDICTED | LITERATURE | REFERENCE) matching their origin."
  )
}

/** Heuristic for tool-named imports — still requires caller to set provenance fields. */
export function suggestAdmetEvidenceFromTool(toolName?: string | null): AdmetEvidenceClass | null {
  if (!toolName) return null
  const t = toolName.toLowerCase()
  if (t.includes("swissadme") || t.includes("rdkit") || t.includes("qsar")) return "PREDICTED"
  if (t.includes("pubchem") || t.includes("chembl")) return "REFERENCE"
  return null
}
