"use server"

/**
 * Comparison repository — Prediction vs Experimental (DPPH / LDH only) using MySQL/MariaDB.
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
import { execute, query, queryOne } from "@/lib/db/mysql"
import { mapComparison } from "@/lib/repositories/mysqlMappers"
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
import { randomUUID } from "crypto"

type Actor = { id: string }

function toJson(val: unknown): string | null {
  if (val === undefined || val === null) return null
  return JSON.stringify(val)
}

function generateDocId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20)
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
  const [predictionRun, labDataset, statsAnalysis] = await Promise.all([
    getPredictionRun(studyId, input.predictionRunId),
    getLabDataset(studyId, input.labDatasetId),
    input.statisticsAnalysisId
      ? getStatisticsAnalysis(studyId, input.statisticsAnalysisId)
      : Promise.resolve(null),
  ])

  if (!predictionRun) throw new Error("Referenced prediction run was not found in this study.")
  if (!labDataset) throw new Error("Referenced laboratory dataset was not found in this study.")

  if (predictionRun.endpoint !== input.endpoint) {
    throw new Error(
      `Prediction run endpoint (${predictionRun.endpoint}) does not match comparison endpoint (${input.endpoint}).`
    )
  }
  if (labDataset.assayType !== input.endpoint) {
    throw new Error(
      `Laboratory dataset assay (${labDataset.assayType}) does not match comparison endpoint (${input.endpoint}).`
    )
  }

  if (statsAnalysis) {
    if (statsAnalysis.assayType !== input.endpoint) {
      throw new Error("Statistics analysis assay does not match comparison endpoint.")
    }
    if (statsAnalysis.labDatasetId !== labDataset.id) {
      throw new Error("Statistics analysis does not belong to the selected laboratory dataset.")
    }
  }

  const replicates = await listLabReplicates(studyId, labDataset.id)

  return {
    predictionRun,
    labDataset,
    statsAnalysis,
    replicates,
  }
}

export async function previewComparison(studyId: string, rawInput: ComparisonCreateInput) {
  const input = ComparisonCreateInputSchema.parse(rawInput)
  const { predictionRun, labDataset, statsAnalysis, replicates } =
    await loadComparisonSources(studyId, input)

  const cfg = getLabAssayConfig(input.endpoint)
  const metricKey = input.experimentalMetricKey || cfg?.primaryMetricKey || "inhibitionPercent"

  const statsFreshness = statsAnalysis
    ? await evaluateStatisticsFreshness(statsAnalysis)
    : undefined

  const computation = computeComparison({
    endpoint: input.endpoint,
    prediction: predictionRun,
    dataset: labDataset,
    replicates,
    statistics: statsAnalysis ?? undefined,
    statisticsFreshness: statsFreshness ?? undefined,
    experimentalMetricKey: metricKey,
  })

  return {
    predictionRun,
    labDataset,
    statsAnalysis,
    replicates,
    experimentalMetricKey: metricKey,
    computation,
    statisticsFreshness: statsFreshness,
    prediction: predictionRun,
    dataset: labDataset,
    statistics: statsAnalysis,
    computed: computation,
  }
}

export async function createComparison(
  studyId: string,
  actor: Actor,
  rawInput: ComparisonCreateInput
): Promise<ComparisonRecord> {
  const input = ComparisonCreateInputSchema.parse(rawInput)

  if (!isComparisonEligibleEndpoint(input.endpoint)) {
    throw new Error(
      `Endpoint "${input.endpoint}" is not eligible for comparison under the Study Design Contract. Eligible: DPPH, LDH.`
    )
  }

  const { predictionRun, labDataset, statsAnalysis, replicates } =
    await loadComparisonSources(studyId, input)

  const cfg = getLabAssayConfig(input.endpoint)
  const metricKey = input.experimentalMetricKey || cfg?.primaryMetricKey || "inhibitionPercent"

  const statsFreshness = statsAnalysis
    ? await evaluateStatisticsFreshness(statsAnalysis)
    : undefined

  const computation = computeComparison({
    endpoint: input.endpoint,
    prediction: predictionRun,
    dataset: labDataset,
    replicates,
    statistics: statsAnalysis ?? undefined,
    statisticsFreshness: statsFreshness ?? undefined,
    experimentalMetricKey: metricKey,
  })

  const id = generateDocId()
  const now = new Date().toISOString()

  const record = ComparisonRecordSchema.parse({
    id,
    studyId,
    endpoint: input.endpoint,
    assay: input.endpoint,

    predictionRunId: predictionRun.id,
    predictionRunName: predictionRun.runName,
    predictionEvidenceClass: predictionRun.provenance.evidenceClass,

    labDatasetId: labDataset.id,
    labDatasetName: labDataset.datasetName,
    experimentalMetricKey: metricKey,

    statisticsAnalysisId: statsAnalysis?.id,
    statisticsFreshnessAtSave: statsFreshness,

    compatibilityStatus: computation.compatibility.status,
    compatibilityReasons: computation.compatibility.reasons,
    comparisonMode: computation.comparisonMode,
    alignedPoints: computation.alignedPoints,

    researcherNotes: input.researcherNotes,
    concordanceFlag: input.concordanceFlag ?? "not_assessed",

    sourcePredictionUpdatedAt: predictionRun.updatedAt,
    sourceLabUpdatedAt: labDataset.updatedAt,
    sourceStatisticsUpdatedAt: statsAnalysis?.updatedAt,
    sourceFingerprint: buildComparisonFingerprint({
      predictionUpdatedAt: predictionRun.updatedAt,
      predictionId: predictionRun.id,
      predictionPoints: computation.predictionPoints,
      labDatasetUpdatedAt: labDataset.updatedAt,
      labDatasetId: labDataset.id,
      replicates,
      statisticsId: statsAnalysis?.id,
      statisticsUpdatedAt: statsAnalysis?.updatedAt,
      statisticsFingerprint: statsAnalysis?.sourceFingerprint,
    }),

    calculationMethod: COMPARISON_CALCULATION_METHOD,
    calculationVersion: COMPARISON_CALCULATION_VERSION,

    status: "final",
    notes: input.notes,
    provenance: defaultProvenance("REFERENCE", {
      operatorId: actor.id,
      methodName: COMPARISON_CALCULATION_METHOD,
      methodVersion: COMPARISON_CALCULATION_VERSION,
      recordedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO comparisons (
      id, study_id, endpoint, prediction_run_id, prediction_run_name,
      prediction_evidence_class, lab_dataset_id, lab_dataset_name, experimental_metric_key,
      statistics_analysis_id, statistics_freshness_at_save, compatibility_status,
      compatibility_reasons, comparison_mode, aligned_points, researcher_notes,
      source_prediction_updated_at, source_lab_updated_at, source_statistics_updated_at,
      source_fingerprint, calculation_method, calculation_version, metrics,
      concordance_flag, status, provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      studyId,
      record.endpoint,
      record.predictionRunId,
      record.predictionRunName ?? null,
      record.predictionEvidenceClass,
      record.labDatasetId,
      record.labDatasetName ?? null,
      record.experimentalMetricKey,
      record.statisticsAnalysisId ?? null,
      record.statisticsFreshnessAtSave ?? null,
      record.compatibilityStatus,
      toJson(record.compatibilityReasons),
      record.comparisonMode,
      toJson(record.alignedPoints),
      record.researcherNotes ?? null,
      record.sourcePredictionUpdatedAt,
      record.sourceLabUpdatedAt,
      record.sourceStatisticsUpdatedAt ?? null,
      record.sourceFingerprint,
      record.calculationMethod,
      record.calculationVersion,
      toJson(record.metrics),
      record.concordanceFlag,
      record.status,
      toJson(record.provenance),
      record.notes ?? null,
      record.createdAt,
      record.updatedAt,
      record.createdBy,
      record.updatedBy,
    ]
  )

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "comparison.create",
    entityType: "comparison",
    entityId: id,
  })

  return record
}

export async function listComparisons(studyId: string): Promise<ComparisonRecord[]> {
  const rows = await query(`SELECT * FROM comparisons WHERE study_id = ? ORDER BY created_at DESC`, [studyId])
  const records = rows.map(mapComparison)
  return Promise.all(
    records.map(async (r) => ({
      ...r,
      freshness: await evaluateComparisonFreshness(r),
    }))
  )
}

export async function getComparison(studyId: string, id: string): Promise<ComparisonRecord | null> {
  const row = await queryOne(`SELECT * FROM comparisons WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  const record = mapComparison(row)
  return {
    ...record,
    freshness: await evaluateComparisonFreshness(record),
  }
}

export async function updateComparison(
  studyId: string,
  id: string,
  actor: Actor,
  rawInput: ComparisonUpdateInput
): Promise<ComparisonRecord> {
  const input = ComparisonUpdateInputSchema.parse(rawInput)
  const existing = await getComparison(studyId, id)
  if (!existing) throw new Error("Comparison record not found")

  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?", "updated_by = ?"]
  const params: unknown[] = [now, actor.id]

  if (input.researcherNotes !== undefined) {
    fields.push("researcher_notes = ?")
    params.push(input.researcherNotes ?? null)
  }
  if (input.concordanceFlag !== undefined) {
    fields.push("concordance_flag = ?")
    params.push(input.concordanceFlag)
  }
  if (input.notes !== undefined) {
    fields.push("notes = ?")
    params.push(input.notes ?? null)
  }
  if (input.statisticsAnalysisId !== undefined) {
    fields.push("statistics_analysis_id = ?")
    params.push(input.statisticsAnalysisId ?? null)
  }

  params.push(studyId, id)
  await execute(`UPDATE comparisons SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "comparison.update",
    entityType: "comparison",
    entityId: id,
  })

  const updated = await getComparison(studyId, id)
  if (!updated) throw new Error("Comparison update failed")
  return updated
}

export async function deleteComparison(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM comparisons WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "comparison.delete",
    entityType: "comparison",
    entityId: id,
  })
}

export async function evaluateComparisonFreshness(
  record: ComparisonRecord
): Promise<"CURRENT" | "STALE"> {
  const [predictionRun, labDataset, statsAnalysis] = await Promise.all([
    getPredictionRun(record.studyId, record.predictionRunId),
    getLabDataset(record.studyId, record.labDatasetId),
    record.statisticsAnalysisId
      ? getStatisticsAnalysis(record.studyId, record.statisticsAnalysisId)
      : Promise.resolve(null),
  ])

  if (!predictionRun || !labDataset) return "STALE"
  if (record.statisticsAnalysisId && !statsAnalysis) return "STALE"

  if (predictionRun.updatedAt !== record.sourcePredictionUpdatedAt) return "STALE"
  if (labDataset.updatedAt !== record.sourceLabUpdatedAt) return "STALE"
  if (record.sourceStatisticsUpdatedAt && statsAnalysis?.updatedAt !== record.sourceStatisticsUpdatedAt) {
    return "STALE"
  }

  const replicates = await listLabReplicates(record.studyId, record.labDatasetId)
  const currentFingerprint = buildComparisonFingerprint({
    predictionUpdatedAt: predictionRun.updatedAt,
    predictionId: predictionRun.id,
    predictionPoints: predictionRun.resultPoints,
    labDatasetUpdatedAt: labDataset.updatedAt,
    labDatasetId: labDataset.id,
    replicates,
    statisticsId: statsAnalysis?.id,
    statisticsUpdatedAt: statsAnalysis?.updatedAt,
    statisticsFingerprint: statsAnalysis?.sourceFingerprint,
  })

  return currentFingerprint === record.sourceFingerprint ? "CURRENT" : "STALE"
}
