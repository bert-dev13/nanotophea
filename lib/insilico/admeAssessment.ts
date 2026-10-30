/**
 * Study-scoped ADME assessment display.
 * Reads stored descriptor values only. Does not estimate missing ADME results.
 */
import { endpointGroups } from "@/lib/adme/normalize"
import type { AdmetRun } from "@/lib/domain/models"

export type AdmePhase = "idle" | "running" | "recorded" | "unavailable" | "failed" | "load_error"

export interface AdmeFieldDefinition {
  id: string
  label: string
  keys: string[]
  /** Legacy keys are displayed when stored, and are not offered as new entry fields. */
  entry?: boolean
}

export interface AdmeGroupDefinition {
  id: string
  label: string
  fields: AdmeFieldDefinition[]
}

/** Display order for values produced by the configured ADME provider. */
export const ADME_GROUPS: AdmeGroupDefinition[] = endpointGroups().map((group) => ({
  ...group,
  fields: group.id === "absorption"
    ? [
      ...group.fields.slice(0, 1),
      { id: "pgpSubstrate", label: "P-gp Substrate", keys: ["pgpSubstrate", "pgp", "pGpSubstrate", "pgp_substrate"] },
      ...group.fields.slice(1),
    ]
    : group.fields,
}))

export interface AdmePresentedField {
  id: string
  label: string
  value: string
}

export interface AdmePresentedGroup {
  id: string
  label: string
  fields: AdmePresentedField[]
}

export function descriptorText(value: unknown): string | undefined {
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  return undefined
}

export function readAdmeField(
  descriptors: Record<string, unknown> | undefined,
  field: AdmeFieldDefinition,
): string | undefined {
  for (const key of field.keys) {
    const text = descriptorText(descriptors?.[key])
    if (text) return text
  }
  return undefined
}

export function latestAdmeRun(runs: AdmetRun[], compoundId: string): AdmetRun | undefined {
  return runs
    .filter((run) => run.compoundId === compoundId)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0]
}

export function admeSourceLabel(run: AdmetRun): string {
  return (run.toolName || run.provenance?.source || run.provenance?.methodName || "").trim()
}

const KNOWN_DESCRIPTOR_KEYS = new Set(ADME_GROUPS.flatMap((group) => group.fields.flatMap((field) => field.keys)))

export function presentAdmeGroups(run: { descriptors?: Record<string, unknown> }): AdmePresentedGroup[] {
  return ADME_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    fields: group.fields.flatMap((field) => {
      const value = readAdmeField(run.descriptors, field)
      return value ? [{ id: field.id, label: field.label, value }] : []
    }),
  })).filter((group) => group.fields.length > 0)
}

export function extraAdmeDescriptors(run: AdmetRun): Array<{ key: string; value: string }> {
  return Object.entries(run.descriptors ?? {}).flatMap(([key, value]) => {
    if (KNOWN_DESCRIPTOR_KEYS.has(key)) return []
    const text = descriptorText(value)
    return text ? [{ key, value: text }] : []
  })
}

export function admeSummaryCopy(phase: AdmePhase): string {
  if (phase === "load_error") return "Unable to load assessment"
  if (phase === "idle") return "Run the assessment"
  if (phase === "unavailable") return "ADME data is not available for this compound."
  if (phase === "recorded") return "Computational assessment completed"
  if (phase === "failed") return "ADME assessment could not be completed."
  return "Assessment running"
}
