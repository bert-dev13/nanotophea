/**
 * Decides whether a saved ADME result can be reused, and builds the study record
 * from a provider result. Does not invent values when prediction fails.
 */
import { hasNormalizedAdmeDescriptor } from "@/lib/adme/normalize"
import {
  ADME_ASSESSMENT_FAILED,
  ADME_METHOD_LABEL,
  ADME_NORMALIZER_VERSION,
  ADME_NO_CID,
  ADME_NO_STRUCTURE,
  ADME_PROTOCOL_NOTE,
  ADME_PROVIDER_NAME,
  type AdmeBatchItem,
  type AdmeEngineIdentity,
  type AdmePredictInput,
  type AdmeProvider,
  type AdmeResult,
} from "@/lib/adme/types"
import { AdmetRunSchema, type AdmetRun } from "@/lib/domain/models"
import { defaultProvenance } from "@/lib/domain/provenance"
import { isPrototypeProvider } from "@/lib/adme/assessmentService"
import { AdmePredictionError, publicAdmeError } from "@/lib/adme/errors"

export interface ResolvedCompound {
  compoundId: string
  compoundName: string
  pubchemCid?: number
  smiles?: string
  pubchemRetrieved: boolean
  lipinskiOverall: "pass" | "fail" | "incomplete"
  /** Set when this compound cannot be sent to the provider. */
  blocked?: string
  /** Keep a saved assessment when the structure source cannot be rechecked. */
  retainSaved?: boolean
}

export interface AdmeWorkPlan {
  cached: AdmetRun[]
  pending: ResolvedCompound[]
  errors: Array<{ compoundId: string; message: string }>
}

export function isAutomaticAdmeRun(run: Pick<AdmetRun, "provider" | "toolName" | "provenance"> | null | undefined): boolean {
  if (!run) return false
  if (run.provenance?.evidenceClass !== "PREDICTED") return false
  return run.provider === ADME_PROVIDER_NAME || run.toolName === ADME_PROVIDER_NAME
}

export function isPrototypeAdmeRun(run: Pick<AdmetRun, "provider" | "toolName"> | null | undefined): boolean {
  return isPrototypeProvider(run?.provider, run?.toolName)
}

function isScreeningAdmeRun(run: Pick<AdmetRun, "provider" | "toolName" | "provenance"> | null | undefined): boolean {
  return isAutomaticAdmeRun(run) || isPrototypeAdmeRun(run)
}

export function latestProviderRun(runs: AdmetRun[], compoundId: string): AdmetRun | undefined {
  return latestMatchingRun(runs, compoundId, isAutomaticAdmeRun)
}

/** Newest saved screening row, including a prototype assessment. */
export function latestScreeningRun(runs: AdmetRun[], compoundId: string): AdmetRun | undefined {
  return latestMatchingRun(runs, compoundId, isScreeningAdmeRun)
}

function latestMatchingRun(
  runs: AdmetRun[],
  compoundId: string,
  accept: (run: AdmetRun) => boolean,
): AdmetRun | undefined {
  return runs
    .filter((run) => run.compoundId === compoundId && accept(run) && hasNormalizedAdmeDescriptor(run.descriptors))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0]
}

export function admeCacheMatches(run: AdmetRun, compound: ResolvedCompound, engine: AdmeEngineIdentity): boolean {
  if (!compound.smiles || run.inputSmiles !== compound.smiles) return false
  if (run.compoundId !== compound.compoundId) return false
  if (!isAutomaticAdmeRun(run)) return false
  if (run.status !== "final") return false
  if (run.providerVersion !== engine.version) return false
  if (run.model !== engine.model) return false
  if (run.normalizerVersion !== ADME_NORMALIZER_VERSION) return false
  if (compound.pubchemCid != null && run.pubchemCid != null && run.pubchemCid !== compound.pubchemCid) return false
  return hasNormalizedAdmeDescriptor(run.descriptors)
}

export function planAdmeWork(
  compounds: ResolvedCompound[],
  runs: AdmetRun[],
  engine: AdmeEngineIdentity,
  force: ReadonlySet<string> = new Set(),
): AdmeWorkPlan {
  const cached: AdmetRun[] = []
  const pending: ResolvedCompound[] = []
  const errors: Array<{ compoundId: string; message: string }> = []
  for (const compound of compounds) {
    if (compound.blocked) {
      const saved = latestProviderRun(runs, compound.compoundId)
      if (compound.retainSaved && saved && !force.has(compound.compoundId) && saved.pubchemCid === compound.pubchemCid) {
        cached.push(saved)
        continue
      }
      errors.push({ compoundId: compound.compoundId, message: compound.blocked })
      continue
    }
    if (compound.pubchemCid == null) {
      errors.push({ compoundId: compound.compoundId, message: ADME_NO_CID })
      continue
    }
    const smiles = compound.smiles?.trim()
    if (!smiles || smiles.length > 5000) {
      errors.push({ compoundId: compound.compoundId, message: ADME_NO_STRUCTURE })
      continue
    }
    const current = latestProviderRun(runs, compound.compoundId)
    if (current && !force.has(compound.compoundId) && admeCacheMatches(current, { ...compound, smiles }, engine)) {
      cached.push(current)
      continue
    }
    pending.push({ ...compound, smiles })
  }
  return { cached, pending, errors }
}

export function isCompletedScreeningRun(run: AdmetRun | undefined): boolean {
  if (!run || !isScreeningAdmeRun(run)) return false
  if (run.pubchemRetrieved !== true) return false
  if (run.lipinskiOverall !== "pass" && run.lipinskiOverall !== "fail") return false
  return hasNormalizedAdmeDescriptor(run.descriptors)
}

export function screenedCompoundIds(compoundIds: string[], runs: AdmetRun[]): string[] {
  return compoundIds.filter((compoundId) => isCompletedScreeningRun(latestScreeningRun(runs, compoundId)))
}

export function buildStoredAdmeRun(input: {
  id: string
  studyId: string
  actorId: string
  compound: ResolvedCompound
  result: AdmeResult
  now: string
  existing?: AdmetRun
}): AdmetRun {
  const { compound, result, now, existing } = input
  return AdmetRunSchema.parse({
    id: input.id,
    studyId: input.studyId,
    compoundId: compound.compoundId,
    compoundName: compound.compoundName,
    toolName: result.provider,
    toolVersion: result.providerVersion,
    provider: result.provider,
    providerVersion: result.providerVersion,
    model: result.model,
    normalizerVersion: ADME_NORMALIZER_VERSION,
    pubchemCid: result.pubchemCid ?? compound.pubchemCid,
    inputSmiles: result.smiles,
    generatedAt: now,
    pubchemRetrieved: compound.pubchemRetrieved,
    lipinskiOverall: compound.lipinskiOverall,
    descriptors: result.descriptors,
    raw: result.raw,
    status: "final",
    assessmentOrigin: "calculated",
    provenance: defaultProvenance("PREDICTED", {
      evidenceClass: "PREDICTED",
      source: result.provider,
      methodName: result.method || ADME_METHOD_LABEL,
      methodVersion: result.providerVersion,
      citation: "Swanson K, et al. ADMET-AI: a machine learning ADMET platform for evaluation of large-scale chemical libraries. Bioinformatics. 2024.",
      operatorId: input.actorId,
      recordedAt: now,
      retrievedAt: now,
      assumptions: "Classification endpoints report the model's probability of the positive class. A probability of at least 0.5 is labeled as that positive class. These are computational predictions, not experimental measurements.",
      limitations: ADME_PROTOCOL_NOTE,
    }),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || input.actorId,
    updatedBy: input.actorId,
  })
}

export async function predictPlannedAdme(input: {
  plan: AdmeWorkPlan
  provider: AdmeProvider
  studyId: string
  actorId: string
  now: string
  existing: AdmetRun[]
  nextId: () => string
}): Promise<{ records: AdmetRun[]; errors: Array<{ compoundId: string; message: string }> }> {
  const errors = [...input.plan.errors]
  if (input.plan.pending.length === 0) return { records: [], errors }
  let batch: AdmeBatchItem[]
  try {
    batch = await predictBatch(input.provider, input.plan.pending.map(toPredictInput))
  } catch (error) {
    const message = publicAdmeError(error)
    for (const compound of input.plan.pending) errors.push({ compoundId: compound.compoundId, message })
    return { records: [], errors }
  }
  const byId = new Map(batch.map((item) => [item.compoundId, item]))
  const records: AdmetRun[] = []
  for (const compound of input.plan.pending) {
    const item = byId.get(compound.compoundId)
    if (!item?.result) {
      errors.push({ compoundId: compound.compoundId, message: ADME_ASSESSMENT_FAILED })
      continue
    }
    const existing = latestProviderRun(input.existing, compound.compoundId)
    records.push(buildStoredAdmeRun({
      id: existing?.id || input.nextId(),
      studyId: input.studyId,
      actorId: input.actorId,
      compound,
      result: item.result,
      now: input.now,
      existing,
    }))
  }
  return { records, errors }
}

function toPredictInput(compound: ResolvedCompound): AdmePredictInput {
  return {
    compoundId: compound.compoundId,
    smiles: compound.smiles ?? "",
    ...(compound.pubchemCid != null ? { pubchemCid: compound.pubchemCid } : {}),
  }
}

async function predictBatch(provider: AdmeProvider, inputs: AdmePredictInput[]): Promise<AdmeBatchItem[]> {
  if (provider.predictBatch) return provider.predictBatch(inputs)
  const items: AdmeBatchItem[] = []
  for (const predictInput of inputs) {
    try {
      items.push({ compoundId: predictInput.compoundId, result: await provider.predict(predictInput) })
    } catch (error) {
      if (error instanceof AdmePredictionError && error.code === "engine_unavailable") throw error
      items.push({ compoundId: predictInput.compoundId, failed: true })
    }
  }
  return items
}
