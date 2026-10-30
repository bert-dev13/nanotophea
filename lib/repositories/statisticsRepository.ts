"use server"

/**
 * Statistics repository — ANOVA / Scheffé on Experimental DPPH & LDH using MySQL/MariaDB.
 * Never reads predictionRuns. Raw lab measurements are not duplicated here.
 */
import {
  StatisticsCreateInputSchema,
  StatisticsRecordSchema,
  type StatisticsCreateInput,
  type StatisticsRecord,
} from "@/lib/domain/models"
import { defaultProvenance } from "@/lib/domain/provenance"
import { execute, query, queryOne } from "@/lib/db/mysql"
import { mapStatisticsAnalysis } from "@/lib/repositories/mysqlMappers"
import { getLabDataset, listLabReplicates } from "@/lib/repositories/labRepository"
import { writeAuditLog } from "@/lib/repositories/auditRepository"
import {
  buildSourceFingerprint,
  computeExperimentalStatistics,
  isStatisticsEligibleAssay,
  isValidMeasurementKey,
  STATISTICS_ALPHA,
  STATISTICS_CALCULATION_METHOD,
  STATISTICS_CALCULATION_VERSION,
} from "@/lib/statistics/runAnalysis"
import { INFINITE_STAT_SENTINEL } from "@/lib/statistics/statDisplay"
import { randomUUID } from "crypto"

type Actor = { id: string }

function toJson(val: unknown): string | null {
  if (val === undefined || val === null) return null
  return JSON.stringify(val)
}

function generateDocId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20)
}

function serializeAnovaNumbers(anova: StatisticsRecord["anova"]): StatisticsRecord["anova"] {
  const fix = (n: number | null) => {
    if (n == null) return null
    if (!Number.isFinite(n)) return n === Infinity ? INFINITE_STAT_SENTINEL : null
    return n
  }
  return {
    ...anova,
    fStatistic: fix(anova.fStatistic),
    msBetween: fix(anova.msBetween),
    msWithin: fix(anova.msWithin),
    pValue: fix(anova.pValue),
    ssBetween: fix(anova.ssBetween) ?? 0,
    ssWithin: fix(anova.ssWithin) ?? 0,
    ssTotal: fix(anova.ssTotal) ?? 0,
  }
}

function serializeScheffeNumbers(
  scheffe: StatisticsRecord["scheffeComparisons"]
): StatisticsRecord["scheffeComparisons"] {
  const fix = (n: number | null | undefined) => {
    if (n == null) return null
    if (!Number.isFinite(n)) return n === Infinity ? INFINITE_STAT_SENTINEL : null
    return n
  }
  return scheffe.map((row) => ({
    ...row,
    scheffeStatistic: fix(row.scheffeStatistic),
    criticalDifference: fix(row.criticalDifference),
    criticalF: fix(row.criticalF),
    pValue: fix(row.pValue),
  }))
}

export async function createStatisticsAnalysis(
  studyId: string,
  actor: Actor,
  rawInput: StatisticsCreateInput
): Promise<StatisticsRecord> {
  const input = StatisticsCreateInputSchema.parse(rawInput)

  if (!isStatisticsEligibleAssay(input.assayType)) {
    throw new Error(
      `Assay "${input.assayType}" is not eligible for Step 06 statistics under the Study Design Contract. Eligible: DPPH, LDH.`
    )
  }

  const dataset = await getLabDataset(studyId, input.labDatasetId)
  if (!dataset) throw new Error("Referenced laboratory dataset was not found in this study.")
  if (dataset.assayType !== input.assayType) {
    throw new Error(
      `Dataset assayType (${dataset.assayType}) does not match input assayType (${input.assayType}).`
    )
  }

  if (!isValidMeasurementKey(input.assayType, input.measurementKey)) {
    throw new Error(
      `Measurement key "${input.measurementKey}" is not supported for ${input.assayType} statistics.`
    )
  }

  const replicates = await listLabReplicates(studyId, input.labDatasetId)
  const computation = computeExperimentalStatistics({
    assayType: input.assayType,
    measurementKey: input.measurementKey,
    replicates,
    alpha: input.alpha ?? STATISTICS_ALPHA,
  })

  const id = generateDocId()
  const now = new Date().toISOString()
  const label =
    input.measurementKey === "inhibitionPercent"
      ? "% Inhibition"
      : input.measurementKey === "cytotoxicityPercent"
        ? "% Cytotoxicity"
        : input.measurementKey === "absorbance"
          ? "Absorbance"
          : input.measurementKey

  const record = StatisticsRecordSchema.parse({
    id,
    studyId,
    assayType: input.assayType,
    assay: input.assayType,
    labDatasetId: dataset.id,
    labDatasetName: dataset.datasetName,
    measurementKey: input.measurementKey,
    measurementLabel: label,
    alpha: computation.alpha,
    sourceDatasetUpdatedAt: dataset.updatedAt,
    sourceFingerprint: buildSourceFingerprint(dataset.updatedAt, replicates, input.measurementKey),
    treatmentSummaries: computation.treatmentSummaries,
    completeness: computation.completeness,
    anova: serializeAnovaNumbers(computation.anova),
    scheffeComparisons: serializeScheffeNumbers(computation.scheffe.comparisons),
    scheffeMessage: computation.scheffe.message,
    calculationMethod: STATISTICS_CALCULATION_METHOD,
    calculationVersion: STATISTICS_CALCULATION_VERSION,
    calculatedAt: now,
    calculatedBy: actor.id,
    status: "final",
    notes: input.notes,
    provenance: defaultProvenance("REFERENCE", {
      operatorId: actor.id,
      methodName: STATISTICS_CALCULATION_METHOD,
      methodVersion: STATISTICS_CALCULATION_VERSION,
      recordedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO statistics_analyses (
      id, study_id, assay_type, lab_dataset_id, lab_dataset_name, measurement_key,
      measurement_label, alpha, source_dataset_updated_at, source_fingerprint,
      treatment_summaries, completeness, anova, scheffe_comparisons, scheffe_message,
      calculation_method, calculation_version, calculated_at, calculated_by, status,
      provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      studyId,
      record.assayType,
      record.labDatasetId,
      record.labDatasetName,
      record.measurementKey,
      record.measurementLabel,
      record.alpha,
      record.sourceDatasetUpdatedAt,
      record.sourceFingerprint,
      toJson(record.treatmentSummaries),
      toJson(record.completeness),
      toJson(record.anova),
      toJson(record.scheffeComparisons),
      record.scheffeMessage ?? null,
      record.calculationMethod,
      record.calculationVersion,
      record.calculatedAt,
      record.calculatedBy,
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
    action: "statistics.create",
    entityType: "statistics",
    entityId: id,
  })

  return record
}

export async function listStatisticsAnalyses(studyId: string): Promise<StatisticsRecord[]> {
  const rows = await query(`SELECT * FROM statistics_analyses WHERE study_id = ? ORDER BY calculated_at DESC`, [
    studyId,
  ])
  const records = rows.map(mapStatisticsAnalysis)
  return Promise.all(
    records.map(async (r) => ({
      ...r,
      freshness: await evaluateStatisticsFreshness(r),
    }))
  )
}

export async function getStatisticsAnalysis(
  studyId: string,
  id: string
): Promise<StatisticsRecord | null> {
  const row = await queryOne(`SELECT * FROM statistics_analyses WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  const record = mapStatisticsAnalysis(row)
  return {
    ...record,
    freshness: await evaluateStatisticsFreshness(record),
  }
}

export async function deleteStatisticsAnalysis(
  studyId: string,
  id: string,
  actor: Actor
): Promise<void> {
  await execute(`DELETE FROM statistics_analyses WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "statistics.delete",
    entityType: "statistics",
    entityId: id,
  })
}

export async function previewStatisticsAnalysis(
  studyId: string,
  rawInput: StatisticsCreateInput
) {
  const input = StatisticsCreateInputSchema.parse(rawInput)
  const dataset = await getLabDataset(studyId, input.labDatasetId)
  if (!dataset) throw new Error("Referenced laboratory dataset was not found in this study.")
  if (dataset.assayType !== input.assayType) {
    throw new Error(`Dataset assayType (${dataset.assayType}) does not match input assayType (${input.assayType}).`)
  }
  const replicates = await listLabReplicates(studyId, input.labDatasetId)
  const computation = computeExperimentalStatistics({
    assayType: input.assayType,
    measurementKey: input.measurementKey,
    replicates,
    alpha: input.alpha ?? STATISTICS_ALPHA,
  })
  return { dataset, replicates, computed: computation, computation }
}

export async function recalculateStatisticsAnalysis(
  studyId: string,
  analysisId: string,
  actor: Actor
): Promise<StatisticsRecord> {
  const existing = await getStatisticsAnalysis(studyId, analysisId)
  if (!existing) throw new Error("Statistics analysis not found.")

  const dataset = await getLabDataset(studyId, existing.labDatasetId)
  if (!dataset) throw new Error("Referenced laboratory dataset was not found.")
  const replicates = await listLabReplicates(studyId, existing.labDatasetId)

  const computation = computeExperimentalStatistics({
    assayType: existing.assayType,
    measurementKey: existing.measurementKey,
    replicates,
    alpha: existing.alpha ?? STATISTICS_ALPHA,
  })

  const now = new Date().toISOString()
  await execute(
    `UPDATE statistics_analyses SET
      source_dataset_updated_at = ?,
      source_fingerprint = ?,
      treatment_summaries = ?,
      completeness = ?,
      anova = ?,
      scheffe_comparisons = ?,
      scheffe_message = ?,
      calculated_at = ?,
      calculated_by = ?,
      updated_at = ?,
      updated_by = ?
    WHERE study_id = ? AND id = ?`,
    [
      dataset.updatedAt,
      buildSourceFingerprint(dataset.updatedAt, replicates, existing.measurementKey),
      toJson(computation.treatmentSummaries),
      toJson(computation.completeness),
      toJson(serializeAnovaNumbers(computation.anova)),
      toJson(serializeScheffeNumbers(computation.scheffe.comparisons)),
      computation.scheffe.message ?? null,
      now,
      actor.id,
      now,
      actor.id,
      studyId,
      analysisId,
    ]
  )

  const updated = await getStatisticsAnalysis(studyId, analysisId)
  if (!updated) throw new Error("Statistics recalculation failed")
  return updated
}

export async function evaluateStatisticsFreshness(
  record: StatisticsRecord
): Promise<"CURRENT" | "STALE"> {
  const dataset = await getLabDataset(record.studyId, record.labDatasetId)
  if (!dataset) return "STALE"
  if (dataset.updatedAt !== record.sourceDatasetUpdatedAt) return "STALE"
  const replicates = await listLabReplicates(record.studyId, record.labDatasetId)
  const currentFingerprint = buildSourceFingerprint(dataset.updatedAt, replicates, record.measurementKey)
  return currentFingerprint === record.sourceFingerprint ? "CURRENT" : "STALE"
}
