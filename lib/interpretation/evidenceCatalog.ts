/**
 * Evidence catalog + fingerprinting for Researcher Interpretation (Phase 10).
 * Resolves linked IDs to display metadata without inventing conclusions.
 */

import type { InterpretationLinkedEvidence } from "@/lib/domain/models"
import { EvidenceTypeSchema } from "@/lib/domain/provenance"
import type { EvidenceType } from "@/types/evidence"

export type InterpretationSourceType = InterpretationLinkedEvidence["sourceType"]

export interface EvidenceCatalogItem {
  sourceType: InterpretationSourceType
  sourceId: string
  label: string
  evidenceClass: EvidenceType
  moduleLabel: string
  updatedAt: string
  dateLabel?: string
  methodOrSource?: string
  freshness?: "CURRENT" | "STALE"
  missing?: boolean
  factualSnippet?: string
}

export interface EvidenceGroup {
  id: string
  title: string
  items: EvidenceCatalogItem[]
}

export function buildInterpretationFingerprint(
  links: Array<{ sourceType: string; sourceId: string; sourceUpdatedAt?: string }>
): string {
  const parts = links
    .slice()
    .sort((a, b) =>
      `${a.sourceType}:${a.sourceId}`.localeCompare(`${b.sourceType}:${b.sourceId}`)
    )
    .map((l) => `${l.sourceType}:${l.sourceId}:${l.sourceUpdatedAt ?? "∅"}`)
  return `interp|n=${links.length}|${parts.join("|")}`
}

export function evaluateInterpretationFreshness(
  storedFingerprint: string | undefined,
  links: Array<{ sourceType: string; sourceId: string; sourceUpdatedAt?: string; missing?: boolean }>
): "CURRENT" | "STALE" {
  if (links.some((l) => l.missing)) return "STALE"
  const next = buildInterpretationFingerprint(links)
  if (!storedFingerprint) return "CURRENT"
  return next === storedFingerprint ? "CURRENT" : "STALE"
}

/** Guard: INTERPRETATION must never be stored as EXPERIMENTAL evidence class on links incorrectly */
export function assertValidEvidenceClassForSource(
  sourceType: InterpretationSourceType,
  evidenceClass: string
): boolean {
  const parsed = EvidenceTypeSchema.safeParse(evidenceClass)
  if (!parsed.success) return false

  if (sourceType === "predictionRun" || sourceType === "admetRun" || sourceType === "dockingRun") {
    return evidenceClass === "PREDICTED" || evidenceClass === "SIMULATION" || evidenceClass === "LITERATURE" || evidenceClass === "REFERENCE"
  }
  if (sourceType === "labDataset" || sourceType === "statistics") {
    return evidenceClass === "EXPERIMENTAL"
  }
  if (sourceType === "comparison") {
    // Comparison record provenance is INTERPRETATION; linked display may show mixed — store as INTERPRETATION
    return evidenceClass === "INTERPRETATION" || evidenceClass === "PREDICTED" || evidenceClass === "EXPERIMENTAL"
  }
  if (sourceType === "reference") {
    return evidenceClass === "LITERATURE" || evidenceClass === "REFERENCE"
  }
  // research data entities
  return (
    evidenceClass === "REFERENCE" ||
    evidenceClass === "LITERATURE" ||
    evidenceClass === "EXPERIMENTAL"
  )
}

export const SOURCE_TYPE_LABELS: Record<InterpretationSourceType, string> = {
  formulation: "Formulation",
  compound: "Phytochemical",
  protein: "Target protein",
  cellLine: "Cell line",
  reference: "Reference",
  admetRun: "ADMET",
  dockingRun: "Molecular docking",
  predictionRun: "Prediction run",
  labDataset: "Laboratory dataset",
  statistics: "Statistics",
  comparison: "Prediction vs Experimental",
}
