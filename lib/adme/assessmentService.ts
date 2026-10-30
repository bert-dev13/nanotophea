/**
 * Hardcoded ADME assessment, local to the app.
 * Same role as the biological equation models: fixed demo values, no external model.
 */
import { lookupPrototypeAdme, normalizePrototypeSmiles } from "@/data/prototype-adme"

export const PROTOTYPE_ADME_PROVIDER = "Prototype ADME"
export const PROTOTYPE_ADME_VERSION = "prototype-1"
export const PROTOTYPE_ADME_HEADLINE = "PROTOTYPE PREDICTION"
export const PROTOTYPE_ADME_SUBTITLE = "Demo computational values"
export const PROTOTYPE_ADME_NOTICE =
  "Prototype values are provided for interface demonstration only and are not results from a live ADME prediction engine."
export const PROTOTYPE_ADME_UNAVAILABLE = "ADME data is not available for this compound."

export interface AdmeAssessmentQuery {
  compoundId: string
  pubchemCid?: number
  smiles?: string
}

export interface AdmeServiceAssessment {
  kind: "prototype"
  headline: typeof PROTOTYPE_ADME_HEADLINE
  subtitle: typeof PROTOTYPE_ADME_SUBTITLE
  notice: typeof PROTOTYPE_ADME_NOTICE
  provider: typeof PROTOTYPE_ADME_PROVIDER
  providerVersion: string
  method: typeof PROTOTYPE_ADME_SUBTITLE
  descriptors: Record<string, string>
}

export interface AdmeAssessmentService {
  assess(query: AdmeAssessmentQuery): Promise<AdmeServiceAssessment | null>
}

export function hardcodedAdmeAssessment(query: AdmeAssessmentQuery): AdmeServiceAssessment | null {
  const record = lookupPrototypeAdme({
    compoundId: query.compoundId,
    pubchemCid: query.pubchemCid,
    smiles: normalizePrototypeSmiles(query.smiles),
  })
  if (!record) return null
  return {
    kind: "prototype",
    headline: PROTOTYPE_ADME_HEADLINE,
    subtitle: PROTOTYPE_ADME_SUBTITLE,
    notice: PROTOTYPE_ADME_NOTICE,
    provider: PROTOTYPE_ADME_PROVIDER,
    providerVersion: PROTOTYPE_ADME_VERSION,
    method: PROTOTYPE_ADME_SUBTITLE,
    descriptors: { ...record.descriptors },
  }
}

export const prototypeAdmeService: AdmeAssessmentService = {
  async assess(query) {
    return hardcodedAdmeAssessment(query)
  },
}

/** Active assessment. Hardcoded demo values only. */
export const admeAssessmentService: AdmeAssessmentService = prototypeAdmeService

export function isPrototypeProvider(provider: string | undefined, toolName?: string): boolean {
  return provider === PROTOTYPE_ADME_PROVIDER || toolName === PROTOTYPE_ADME_PROVIDER
}
