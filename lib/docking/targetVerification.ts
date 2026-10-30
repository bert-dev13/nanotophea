import type { RcsbPolymer } from "@/lib/scientific/types"

/** Shown when the live RCSB record does not verify the intended receptor. */
export const TARGET_UNVERIFIED = "Target structure requires verification"

export type TargetVerificationStatus = "verified" | "needs_verification" | "mismatch"

export const TARGET_VERIFICATION_LABEL: Record<TargetVerificationStatus, string> = {
  verified: "VERIFIED",
  needs_verification: "NEEDS VERIFICATION",
  mismatch: "MISMATCH",
}

export interface StructureEntityClaim {
  label: string
  uniprotId?: string
}

/** Identity the reference library claims for a PDB. Checked against live RCSB, never assumed from a successful request. */
export interface StructureExpectation {
  title?: string
  method?: string
  resolution?: string
  organism?: string
  chains?: string[]
  entities: StructureEntityClaim[]
}

export interface TargetVerification {
  status: TargetVerificationStatus
  recordLabel: string
}

export function expectationFromRecord(record: {
  expectedTitle?: unknown
  expectedMethod?: unknown
  expectedResolution?: unknown
  organism?: unknown
  chains?: unknown
  expectedEntities?: unknown
} | null | undefined): StructureExpectation | null {
  const entities = entityClaims(record?.expectedEntities)
  if (!entities.length) return null
  const chains = stringList(record?.chains)
  return {
    ...(typeof record?.expectedTitle === "string" && record.expectedTitle.trim() ? { title: record.expectedTitle.trim() } : {}),
    ...(typeof record?.expectedMethod === "string" && record.expectedMethod.trim() ? { method: record.expectedMethod.trim() } : {}),
    ...(typeof record?.expectedResolution === "string" && record.expectedResolution.trim() ? { resolution: record.expectedResolution.trim() } : {}),
    ...(typeof record?.organism === "string" && record.organism.trim() ? { organism: record.organism.trim() } : {}),
    ...(chains.length ? { chains } : {}),
    entities,
  }
}

/**
 * A successful RCSB response is not verification.
 * VERIFIED requires the expected entities, organism, UniProt accessions, chains, title, method, and resolution.
 */
export function assessTargetStructure(input: {
  expectation: StructureExpectation | null
  title?: string | null
  method?: string | null
  resolution?: string | null
  polymers?: RcsbPolymer[] | null
  retrieved: boolean
}): TargetVerification {
  const polymers = input.polymers ?? []
  const recordLabel = input.title?.trim() || polymers.find((item) => item.description)?.description || ""
  if (!input.retrieved || !input.expectation) {
    return { status: "needs_verification", recordLabel }
  }
  if (!polymers.length || !input.title?.trim() || !input.method?.trim() || !input.resolution?.trim()) {
    return { status: "needs_verification", recordLabel }
  }
  const expectation = input.expectation
  if (expectation.title && !textHasPhrase(input.title, expectation.title)) {
    return { status: "mismatch", recordLabel }
  }
  if (expectation.method && !input.method.toLowerCase().includes(expectation.method.toLowerCase())) {
    return { status: "mismatch", recordLabel }
  }
  if (expectation.resolution && !input.resolution.includes(expectation.resolution)) {
    return { status: "mismatch", recordLabel }
  }
  const matched = expectation.entities.map((entity) => polymers.find((polymer) => polymerMatches(polymer, entity, expectation.organism)))
  if (matched.some((polymer) => !polymer)) return { status: "mismatch", recordLabel }
  const presentChains = new Set(polymers.flatMap((polymer) => polymer.chains.map((chain) => chain.toUpperCase())))
  if ((expectation.chains ?? []).some((chain) => !presentChains.has(chain.toUpperCase()))) {
    return { status: "mismatch", recordLabel }
  }
  return { status: "verified", recordLabel }
}

function polymerMatches(polymer: RcsbPolymer, entity: StructureEntityClaim, organism?: string): boolean {
  if (entity.uniprotId && !polymer.uniprotIds.some((id) => id.toUpperCase() === entity.uniprotId?.toUpperCase())) return false
  if (!polymer.description || !textHasPhrase(polymer.description, entity.label)) return false
  if (organism && polymer.organism && polymer.organism.toLowerCase() !== organism.toLowerCase()) return false
  if (organism && !polymer.organism) return false
  return true
}

function entityClaims(value: unknown): StructureEntityClaim[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as { label?: unknown; uniprotId?: unknown }
    if (typeof record.label !== "string" || !record.label.trim()) return []
    const uniprotId = typeof record.uniprotId === "string" ? record.uniprotId.trim() : ""
    return [{ label: record.label.trim(), ...(uniprotId ? { uniprotId } : {}) }]
  })
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []
}

function textHasPhrase(haystack: string, phrase: string): boolean {
  const needle = phrase.trim().toLowerCase()
  if (needle.length < 3) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack)
}
