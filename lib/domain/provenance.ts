import { z } from "zod"
import type { EvidenceType } from "@/types/evidence"

export const EvidenceTypeSchema = z.enum([
  "REFERENCE",
  "LITERATURE",
  "PREDICTED",
  "EXPERIMENTAL",
  "INTERPRETATION",
  "SIMULATION",
])

/** Reserved for future Storage / file artifacts without requiring them now */
export const ArtifactRefSchema = z.object({
  kind: z.enum(["storage", "external_url", "local_path"]).default("external_url"),
  pathOrUrl: z.string().min(1),
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  sizeBytes: z.number().optional(),
  uploadedAt: z.string().datetime().optional(),
  uploadedBy: z.string().optional(),
})

export type ArtifactRef = z.infer<typeof ArtifactRefSchema>

/**
 * Provenance metadata required by STUDY_DESIGN_CONTRACT.md §9.
 * Attachment fields are optional / out of scope for Phase 2 (no Storage).
 */
export const ProvenanceSchema = z.object({
  evidenceClass: EvidenceTypeSchema,
  source: z.string().optional(),
  methodName: z.string().optional(),
  methodVersion: z.string().optional(),
  citation: z.string().optional(),
  retrievedAt: z.string().optional(),
  recordedAt: z.string().optional(),
  operatorId: z.string().optional(),
  laboratoryName: z.string().optional(),
  protocolRef: z.string().optional(),
  assumptions: z.string().optional(),
  limitations: z.string().optional(),
  /** Future file support — unused while Storage is disabled */
  artifacts: z.array(ArtifactRefSchema).optional(),
})

export type Provenance = z.infer<typeof ProvenanceSchema>

export function defaultProvenance(evidenceClass: EvidenceType, partial?: Partial<Provenance>): Provenance {
  return ProvenanceSchema.parse({
    evidenceClass,
    recordedAt: new Date().toISOString(),
    ...partial,
  })
}
