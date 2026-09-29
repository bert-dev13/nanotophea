/**
 * Comparison repository — Prediction vs Experimental (DPPH / LDH only).
 * Never invents values or claims experimental validation.
 */
import {
  ComparisonCreateInputSchema,
  ComparisonRecordSchema,
  ComparisonUpdateInputSchema,
  type ComparisonCreateInput,
  type ComparisonRecord,
  type ComparisonUpdateInput,
} from "@/lib/domain/models"
import { defaultProvenance } from "@/lib/domain/provenance"
import { STUDY_SUBCOLLECTIONS, studySub } from "@/lib/firebase/paths"
import {
  deleteDocData,
  docRef,
  getDocData,
  listDocs,
  setDocData,
  updateDocData,
} from "@/lib/firebase/firestore"
import { getLabDataset, listLabReplicates } from "@/lib/repositories/labRepository"
import {
  evaluateStatisticsFreshness,
  getStatisticsAnalysis,
} from "@/lib/repositories/statisticsRepository"
import { getPredictionRun } from "@/lib/repositories/scientificRunRepository"
import { writeAuditLog } from "@/lib/repositories/auditRepository"
import {
  buildComparisonFingerprint,
  COMPARISON_CALCULATION_METHOD,
  COMPARISON_CALCULATION_VERSION,
  computeComparison,
} from "@/lib/comparison/runComparison"
import { isComparisonEligibleEndpoint } from "@/lib/comparison/compatibility"
import { getLabAssayConfig } from "@/lib/lab/labAssayConfig"

type Actor = { id: string }

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

async function loadComparisonSources(
  studyId: string,
  input: {
    endpoint: "dpph" | "ldh"
    predictionRunId: string
    labDatasetId: string
    statisticsAnalysisId?: string
  }
) {
  if (!isComparisonEligibleEndpoint(input.endpoint)) {
    throw new Error("Only DPPH and LDH may be compared under the Study Design Contract.")
  }

  const prediction = await getPredictionRun(studyId, input.predictionRunId)
  if (!prediction) throw new Error("Prediction run not found in this study.")
  if (prediction.studyId !== studyId) {
    throw new Error("Study isolation violation: prediction run does not belong to this study.")
  }

  const dataset = await getLabDataset(studyId, input.labDatasetId)
  if (!dataset) throw new Error("Laboratory dataset not found in this study.")
  if (dataset.studyId !== studyId) {
    throw new Error("Study isolation violation: lab dataset does not belong to this study.")
  }

  const replicates = await listLabReplicates(studyId, input.labDatasetId)

  let statistics = null
  let statisticsFreshness: "CURRENT" | "STALE" | null = null
  if (input.statisticsAnalysisId) {
    statistics = await getStatisticsAnalysis(studyId, input.statisticsAnalysisId)
    if (!statistics) throw new Error("Statistics analysis not found in this study.")
    if (statistics.assayType !== input.endpoint) {
      throw new Error("Statistics assay does not match comparison endpoint.")
    }
    if (statistics.labDatasetId !== input.labDatasetId) {
      throw new Error("Statistics analysis is not linked to the selected experimental dataset.")
    }
    statisticsFreshness = statistics.freshness ?? (await evaluateStatisticsFreshness(studyId, statistics))
  }

  return { prediction, dataset, replicates, statistics, statisticsFreshness }
}

export async function previewComparison(studyId: string, rawInput: ComparisonCreateInput) {
  const input = ComparisonCreateInputSchema.parse(rawInput)
  const sources = await loadComparisonSources(studyId, input)
  const experimentalMetricKey =
    input.experimentalMetricKey || getLabAssayConfig(input.endpoint).primaryMetricKey

  const computed = computeComparison({
    endpoint: input.endpoint,
    prediction: sources.prediction,
    dataset: sources.dataset,
    replicates: sources.replicates,
    experimentalMetricKey,
    statistics: sources.statistics,
    statisticsFreshness: sources.statisticsFreshness,
  })

  return { ...sources, experimentalMetricKey, computed }
}

export async function evaluateComparisonFreshness(
  studyId: string,
  record: ComparisonRecord
): Promise<"CURRENT" | "STALE"> {
  try {
    const sources = await loadComparisonSources(studyId, {
      endpoint: record.endpoint,
      predictionRunId: record.predictionRunId,
      labDatasetId: record.labDatasetId,
      statisticsAnalysisId: record.statisticsAnalysisId,
    })
    const fp = buildComparisonFingerprint({
      predictionUpdatedAt: sources.prediction.updatedAt,
      predictionId: sources.prediction.id,
      predictionPoints: sources.prediction.resultPoints,
      labDatasetUpdatedAt: sources.dataset.updatedAt,
      labDatasetId: sources.dataset.id,
      replicates: sources.replicates,
      statisticsId: sources.statistics?.id,
      statisticsUpdatedAt: sources.statistics?.updatedAt,
      statisticsFingerprint: sources.statistics?.sourceFingerprint,
    })
    if (fp !== record.sourceFingerprint) return "STALE"
    if (sources.statisticsFreshness === "STALE") return "STALE"
    return "CURRENT"
  } catch {
    return "STALE"
  }
}

export async function createComparison(
  studyId: string,
  actor: Actor,
  rawInput: ComparisonCreateInput
): Promise<ComparisonRecord> {
  const input = ComparisonCreateInputSchema.parse(rawInput)
  const { prediction, dataset, replicates, statistics, statisticsFreshness, experimentalMetricKey, computed } =
    await previewComparison(studyId, input)

  if (!computed.canPersist) {
    throw new Error(computed.blockReason || "Comparison is incompatible and cannot be saved.")
  }

  // Stale statistics may be linked with warning, but never treated as fresh for aligned claims
  if (statistics && statisticsFreshness === "STALE") {
    // allowed to save with warning already in computed.notices
  }

  const fingerprint = buildComparisonFingerprint({
    predictionUpdatedAt: prediction.updatedAt,
    predictionId: prediction.id,
    predictionPoints: prediction.resultPoints,
    labDatasetUpdatedAt: dataset.updatedAt,
    labDatasetId: dataset.id,
    replicates,
    statisticsId: statistics?.id,
    statisticsUpdatedAt: statistics?.updatedAt,
    statisticsFingerprint: statistics?.sourceFingerprint,
  })

  const now = new Date().toISOString()
  const ref = docRef(studySub(studyId, STUDY_SUBCOLLECTIONS.comparisons))

  const record = ComparisonRecordSchema.parse({
    id: ref.id,
    studyId,
    endpoint: input.endpoint,
    assay: input.endpoint,
    predictionRunId: prediction.id,
    predictionRunName: prediction.runName,
    predictionEvidenceClass: computed.predictionEvidenceClass,
    labDatasetId: dataset.id,
    labDatasetName: dataset.datasetName,
    experimentalMetricKey,
    statisticsAnalysisId: statistics?.id,
    statisticsFreshnessAtSave: statisticsFreshness ?? undefined,
    compatibilityStatus: computed.compatibility.status,
    compatibilityReasons: computed.compatibility.reasons,
    comparisonMode: computed.comparisonMode,
    alignedPoints: computed.alignedPoints,
    researcherNotes: input.researcherNotes,
    sourcePredictionUpdatedAt: prediction.updatedAt,
    sourceLabUpdatedAt: dataset.updatedAt,
    sourceStatisticsUpdatedAt: statistics?.updatedAt,
    sourceFingerprint: fingerprint,
    calculationMethod: COMPARISON_CALCULATION_METHOD,
    calculationVersion: COMPARISON_CALCULATION_VERSION,
    metrics: {},
    concordanceFlag: input.concordanceFlag ?? "not_assessed",
    status: "final",
    notes: input.notes,
    provenance: defaultProvenance("INTERPRETATION", {
      methodName: COMPARISON_CALCULATION_METHOD,
      methodVersion: COMPARISON_CALCULATION_VERSION,
      source: `predictionRuns/${prediction.id} vs labDatasets/${dataset.id}`,
      operatorId: actor.id,
      assumptions:
        "Side-by-side and optional aligned comparison only. Agreement ≠ experimental validation of the computational method.",
      limitations:
        "No automatic µM↔µg/mL conversion. No auto hypothesis decisions. DPPH remains qualitative/side-by-side under current units.",
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
    freshness: "CURRENT",
  })

  await setDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.comparisons),
    ref.id,
    stripUndefined(record as unknown as Record<string, unknown>)
  )
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "comparison.create",
    entityType: "comparison",
    entityId: ref.id,
    meta: {
      endpoint: input.endpoint,
      predictionRunId: prediction.id,
      labDatasetId: dataset.id,
    },
  })
  return record
}

export async function updateComparison(
  studyId: string,
  id: string,
  actor: Actor,
  rawPatch: ComparisonUpdateInput
): Promise<ComparisonRecord> {
  const patch = ComparisonUpdateInputSchema.parse(rawPatch)
  const existing = await getComparison(studyId, id)
  if (!existing) throw new Error("Comparison not found.")

  const now = new Date().toISOString()
  let nextStatsId = existing.statisticsAnalysisId
  let nextStatsFreshness = existing.statisticsFreshnessAtSave
  let nextStatsUpdatedAt = existing.sourceStatisticsUpdatedAt
  let fingerprint = existing.sourceFingerprint

  if (patch.statisticsAnalysisId !== undefined) {
    nextStatsId = patch.statisticsAnalysisId ?? undefined
    if (nextStatsId) {
      const preview = await previewComparison(studyId, {
        endpoint: existing.endpoint,
        predictionRunId: existing.predictionRunId,
        labDatasetId: existing.labDatasetId,
        experimentalMetricKey: existing.experimentalMetricKey,
        statisticsAnalysisId: nextStatsId,
      })
      nextStatsFreshness = preview.statisticsFreshness ?? undefined
      nextStatsUpdatedAt = preview.statistics?.updatedAt
      fingerprint = buildComparisonFingerprint({
        predictionUpdatedAt: preview.prediction.updatedAt,
        predictionId: preview.prediction.id,
        predictionPoints: preview.prediction.resultPoints,
        labDatasetUpdatedAt: preview.dataset.updatedAt,
        labDatasetId: preview.dataset.id,
        replicates: preview.replicates,
        statisticsId: preview.statistics?.id,
        statisticsUpdatedAt: preview.statistics?.updatedAt,
        statisticsFingerprint: preview.statistics?.sourceFingerprint,
      })
    } else {
      nextStatsFreshness = undefined
      nextStatsUpdatedAt = undefined
      const preview = await previewComparison(studyId, {
        endpoint: existing.endpoint,
        predictionRunId: existing.predictionRunId,
        labDatasetId: existing.labDatasetId,
        experimentalMetricKey: existing.experimentalMetricKey,
      })
      fingerprint = buildComparisonFingerprint({
        predictionUpdatedAt: preview.prediction.updatedAt,
        predictionId: preview.prediction.id,
        predictionPoints: preview.prediction.resultPoints,
        labDatasetUpdatedAt: preview.dataset.updatedAt,
        labDatasetId: preview.dataset.id,
        replicates: preview.replicates,
      })
    }
  }

  const next = ComparisonRecordSchema.parse({
    ...existing,
    researcherNotes:
      patch.researcherNotes !== undefined ? patch.researcherNotes : existing.researcherNotes,
    concordanceFlag: patch.concordanceFlag ?? existing.concordanceFlag,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    statisticsAnalysisId: nextStatsId,
    statisticsFreshnessAtSave: nextStatsFreshness,
    sourceStatisticsUpdatedAt: nextStatsUpdatedAt,
    sourceFingerprint: fingerprint,
    updatedAt: now,
    updatedBy: actor.id,
  })

  await updateDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.comparisons),
    id,
    stripUndefined({
      researcherNotes: next.researcherNotes,
      concordanceFlag: next.concordanceFlag,
      notes: next.notes,
      statisticsAnalysisId: next.statisticsAnalysisId,
      statisticsFreshnessAtSave: next.statisticsFreshnessAtSave,
      sourceStatisticsUpdatedAt: next.sourceStatisticsUpdatedAt,
      sourceFingerprint: next.sourceFingerprint,
      updatedAt: next.updatedAt,
      updatedBy: next.updatedBy,
    })
  )

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "comparison.update",
    entityType: "comparison",
    entityId: id,
  })

  return { ...next, freshness: await evaluateComparisonFreshness(studyId, next) }
}

export async function listComparisons(studyId: string): Promise<ComparisonRecord[]> {
  const rows = await listDocs<ComparisonRecord>(studySub(studyId, STUDY_SUBCOLLECTIONS.comparisons))
  const parsed = rows.map((r) =>
    ComparisonRecordSchema.parse({
      ...r,
      endpoint: r.endpoint ?? r.assay,
      assay: r.endpoint ?? r.assay,
      predictionEvidenceClass: r.predictionEvidenceClass ?? "PREDICTED",
      experimentalMetricKey: r.experimentalMetricKey || "unknown",
      compatibilityStatus: r.compatibilityStatus ?? "PARTIAL",
      compatibilityReasons: r.compatibilityReasons ?? [],
      comparisonMode: r.comparisonMode ?? "SIDE_BY_SIDE",
      alignedPoints: r.alignedPoints ?? [],
      sourcePredictionUpdatedAt: r.sourcePredictionUpdatedAt || r.updatedAt,
      sourceLabUpdatedAt: r.sourceLabUpdatedAt || r.updatedAt,
      sourceFingerprint: r.sourceFingerprint || `legacy:${r.id}`,
      predictionRunId: r.predictionRunId || "missing",
      labDatasetId: r.labDatasetId || "missing",
      metrics: r.metrics ?? {},
    })
  )

  const withFresh = await Promise.all(
    parsed.map(async (r) => ({
      ...r,
      freshness: await evaluateComparisonFreshness(studyId, r),
    }))
  )
  return withFresh.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getComparison(
  studyId: string,
  id: string
): Promise<ComparisonRecord | null> {
  const raw = await getDocData<ComparisonRecord>(
    studySub(studyId, STUDY_SUBCOLLECTIONS.comparisons),
    id
  )
  if (!raw) return null
  const record = ComparisonRecordSchema.parse({
    ...raw,
    endpoint: raw.endpoint ?? raw.assay,
    assay: raw.endpoint ?? raw.assay,
    predictionEvidenceClass: raw.predictionEvidenceClass ?? "PREDICTED",
    experimentalMetricKey: raw.experimentalMetricKey || "unknown",
    compatibilityStatus: raw.compatibilityStatus ?? "PARTIAL",
    compatibilityReasons: raw.compatibilityReasons ?? [],
    comparisonMode: raw.comparisonMode ?? "SIDE_BY_SIDE",
    alignedPoints: raw.alignedPoints ?? [],
    sourcePredictionUpdatedAt: raw.sourcePredictionUpdatedAt || raw.updatedAt,
    sourceLabUpdatedAt: raw.sourceLabUpdatedAt || raw.updatedAt,
    sourceFingerprint: raw.sourceFingerprint || `legacy:${raw.id}`,
    predictionRunId: raw.predictionRunId || "missing",
    labDatasetId: raw.labDatasetId || "missing",
    metrics: raw.metrics ?? {},
  })
  return {
    ...record,
    freshness: await evaluateComparisonFreshness(studyId, record),
  }
}

export async function deleteComparison(
  studyId: string,
  id: string,
  actor: Actor
): Promise<void> {
  const existing = await getComparison(studyId, id)
  if (!existing) throw new Error("Comparison not found.")
  await deleteDocData(studySub(studyId, STUDY_SUBCOLLECTIONS.comparisons), id)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "comparison.delete",
    entityType: "comparison",
    entityId: id,
    meta: {
      endpoint: existing.endpoint,
      predictionRunId: existing.predictionRunId,
      labDatasetId: existing.labDatasetId,
    },
  })
}
