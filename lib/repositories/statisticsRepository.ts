/**
 * Statistics repository — ANOVA / Scheffé on Experimental DPPH & LDH only.
 * Never reads predictionRuns. Raw lab measurements are not duplicated here.
 */
import {
  StatisticsCreateInputSchema,
  StatisticsRecordSchema,
  type StatisticsCreateInput,
  type StatisticsRecord,
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

type Actor = { id: string }

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
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
    pValue: anova.pValue == null || !Number.isFinite(anova.pValue) ? anova.pValue : anova.pValue,
  }
}

function serializeStatNumber(n: number | null): number | null {
  if (n == null) return null
  if (!Number.isFinite(n)) return n === Infinity ? INFINITE_STAT_SENTINEL : null
  return n
}

async function loadSource(studyId: string, labDatasetId: string, assayType: "dpph" | "ldh") {
  const dataset = await getLabDataset(studyId, labDatasetId)
  if (!dataset) throw new Error("Laboratory dataset not found in this study.")
  if (dataset.studyId !== studyId) {
    throw new Error("Study isolation violation: dataset does not belong to this study.")
  }
  if (!isStatisticsEligibleAssay(dataset.assayType)) {
    throw new Error(
      `Dataset assay "${dataset.assayType}" is not eligible. Statistics apply only to Experimental DPPH and LDH.`
    )
  }
  if (dataset.assayType !== assayType) {
    throw new Error(
      `Selected assay (${assayType}) does not match dataset assay (${dataset.assayType}).`
    )
  }
  if (dataset.provenance.evidenceClass !== "EXPERIMENTAL") {
    throw new Error("Statistics require EXPERIMENTAL laboratory datasets.")
  }
  const replicates = await listLabReplicates(studyId, labDatasetId)
  return { dataset, replicates }
}

export async function evaluateStatisticsFreshness(
  studyId: string,
  record: StatisticsRecord
): Promise<"CURRENT" | "STALE"> {
  try {
    const { dataset, replicates } = await loadSource(studyId, record.labDatasetId, record.assayType)
    const fp = buildSourceFingerprint(dataset.updatedAt, replicates, record.measurementKey)
    if (fp !== record.sourceFingerprint || dataset.updatedAt !== record.sourceDatasetUpdatedAt) {
      return "STALE"
    }
    return "CURRENT"
  } catch {
    return "STALE"
  }
}

export async function createStatisticsAnalysis(
  studyId: string,
  actor: Actor,
  rawInput: StatisticsCreateInput
): Promise<StatisticsRecord> {
  const input = StatisticsCreateInputSchema.parse(rawInput)

  if (!isStatisticsEligibleAssay(input.assayType)) {
    throw new Error("Unsupported assay for experimental statistics.")
  }
  if (!isValidMeasurementKey(input.assayType, input.measurementKey)) {
    throw new Error(`Invalid measurement field for ${input.assayType}.`)
  }

  const { dataset, replicates } = await loadSource(studyId, input.labDatasetId, input.assayType)

  const computed = computeExperimentalStatistics({
    assayType: input.assayType,
    measurementKey: input.measurementKey,
    replicates,
    alpha: input.alpha ?? STATISTICS_ALPHA,
  })

  if (!computed.canPersist) {
    throw new Error(computed.blockReason || "Insufficient usable experimental data for ANOVA.")
  }

  const fingerprint = buildSourceFingerprint(
    dataset.updatedAt,
    replicates,
    input.measurementKey
  )
  const now = new Date().toISOString()
  const ref = docRef(studySub(studyId, STUDY_SUBCOLLECTIONS.statistics))

  const anovaStored = serializeAnovaNumbers({
    k: computed.anova.k,
    N: computed.anova.N,
    groupLabels: computed.anova.groupLabels,
    groupNs: computed.anova.groupNs,
    groupMeans: computed.anova.groupMeans,
    grandMean: computed.anova.grandMean,
    ssBetween: computed.anova.ssBetween,
    ssWithin: computed.anova.ssWithin,
    ssTotal: computed.anova.ssTotal,
    dfBetween: computed.anova.dfBetween,
    dfWithin: computed.anova.dfWithin,
    dfTotal: computed.anova.dfTotal,
    msBetween: computed.anova.msBetween,
    msWithin: computed.anova.msWithin,
    fStatistic:
      serializeStatNumber(computed.anova.fStatistic),
    pValue: computed.anova.pValue,
    alpha: computed.anova.alpha,
    significant: computed.anova.significant,
    message: computed.anova.message,
  })

  const record = StatisticsRecordSchema.parse({
    id: ref.id,
    studyId,
    assayType: input.assayType,
    assay: input.assayType,
    labDatasetId: dataset.id,
    labDatasetName: dataset.datasetName,
    measurementKey: input.measurementKey,
    measurementLabel: computed.measurementLabel,
    alpha: computed.alpha,
    sourceDatasetUpdatedAt: dataset.updatedAt,
    sourceFingerprint: fingerprint,
    treatmentSummaries: computed.treatmentSummaries.map((t) => ({
      treatmentCode: t.treatmentCode,
      label: t.label,
      n: t.n,
      mean: t.mean,
      sd: t.sd,
      variance: t.variance,
      missingReplicateSlots: t.missingReplicateSlots,
      dataClass: "DERIVED_FROM_EXPERIMENTAL" as const,
    })),
    completeness: {
      expectedCells: computed.completeness.expectedCells,
      observedCells: computed.completeness.observedCells,
      missingCells: computed.completeness.missingCells,
      incomplete: computed.completeness.incomplete,
      warnings: computed.completeness.warnings,
    },
    anova: anovaStored,
    scheffeComparisons: computed.scheffe.comparisons.map((c) => ({
      ...c,
      scheffeStatistic:
        serializeStatNumber(c.scheffeStatistic),
    })),
    scheffeMessage: computed.scheffe.message,
    calculationMethod: STATISTICS_CALCULATION_METHOD,
    calculationVersion: STATISTICS_CALCULATION_VERSION,
    calculatedAt: now,
    calculatedBy: actor.id,
    status: "final",
    notes: input.notes,
    provenance: defaultProvenance("EXPERIMENTAL", {
      methodName: STATISTICS_CALCULATION_METHOD,
      methodVersion: STATISTICS_CALCULATION_VERSION,
      source: `labDatasets/${dataset.id}`,
      laboratoryName: dataset.laboratoryName,
      protocolRef: dataset.protocolReference,
      operatorId: actor.id,
      assumptions:
        "One-way ANOVA and Scheffé post-hoc on raw experimental replicates. Statistical significance ≠ efficacy or hypothesis acceptance.",
      limitations:
        "Applies only to EXPERIMENTAL DPPH/LDH. Missing replicates are omitted, never zero-filled. Does not decide research hypotheses.",
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
    freshness: "CURRENT",
  })

  await setDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.statistics),
    ref.id,
    stripUndefined(record as unknown as Record<string, unknown>)
  )
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "statistics.create",
    entityType: "statistics",
    entityId: ref.id,
    meta: {
      labDatasetId: dataset.id,
      assayType: input.assayType,
      measurementKey: input.measurementKey,
    },
  })
  return record
}

export async function recalculateStatisticsAnalysis(
  studyId: string,
  analysisId: string,
  actor: Actor
): Promise<StatisticsRecord> {
  const existing = await getStatisticsAnalysis(studyId, analysisId)
  if (!existing) throw new Error("Statistics analysis not found.")

  const { dataset, replicates } = await loadSource(
    studyId,
    existing.labDatasetId,
    existing.assayType
  )

  const computed = computeExperimentalStatistics({
    assayType: existing.assayType,
    measurementKey: existing.measurementKey,
    replicates,
    alpha: existing.alpha ?? STATISTICS_ALPHA,
  })

  if (!computed.canPersist) {
    throw new Error(computed.blockReason || "Insufficient usable experimental data for ANOVA.")
  }

  const fingerprint = buildSourceFingerprint(
    dataset.updatedAt,
    replicates,
    existing.measurementKey
  )
  const now = new Date().toISOString()

  const next = StatisticsRecordSchema.parse({
    ...existing,
    labDatasetName: dataset.datasetName,
    measurementLabel: computed.measurementLabel,
    sourceDatasetUpdatedAt: dataset.updatedAt,
    sourceFingerprint: fingerprint,
    treatmentSummaries: computed.treatmentSummaries.map((t) => ({
      treatmentCode: t.treatmentCode,
      label: t.label,
      n: t.n,
      mean: t.mean,
      sd: t.sd,
      variance: t.variance,
      missingReplicateSlots: t.missingReplicateSlots,
      dataClass: "DERIVED_FROM_EXPERIMENTAL" as const,
    })),
    completeness: {
      expectedCells: computed.completeness.expectedCells,
      observedCells: computed.completeness.observedCells,
      missingCells: computed.completeness.missingCells,
      incomplete: computed.completeness.incomplete,
      warnings: computed.completeness.warnings,
    },
    anova: serializeAnovaNumbers({
      k: computed.anova.k,
      N: computed.anova.N,
      groupLabels: computed.anova.groupLabels,
      groupNs: computed.anova.groupNs,
      groupMeans: computed.anova.groupMeans,
      grandMean: computed.anova.grandMean,
      ssBetween: computed.anova.ssBetween,
      ssWithin: computed.anova.ssWithin,
      ssTotal: computed.anova.ssTotal,
      dfBetween: computed.anova.dfBetween,
      dfWithin: computed.anova.dfWithin,
      dfTotal: computed.anova.dfTotal,
      msBetween: computed.anova.msBetween,
      msWithin: computed.anova.msWithin,
      fStatistic:
        serializeStatNumber(computed.anova.fStatistic),
      pValue: computed.anova.pValue,
      alpha: computed.anova.alpha,
      significant: computed.anova.significant,
      message: computed.anova.message,
    }),
    scheffeComparisons: computed.scheffe.comparisons.map((c) => ({
      ...c,
      scheffeStatistic:
        serializeStatNumber(c.scheffeStatistic),
    })),
    scheffeMessage: computed.scheffe.message,
    calculationMethod: STATISTICS_CALCULATION_METHOD,
    calculationVersion: STATISTICS_CALCULATION_VERSION,
    calculatedAt: now,
    calculatedBy: actor.id,
    updatedAt: now,
    updatedBy: actor.id,
    freshness: "CURRENT",
    provenance: defaultProvenance("EXPERIMENTAL", {
      ...existing.provenance,
      evidenceClass: "EXPERIMENTAL",
      methodName: STATISTICS_CALCULATION_METHOD,
      methodVersion: STATISTICS_CALCULATION_VERSION,
      source: `labDatasets/${dataset.id}`,
      laboratoryName: dataset.laboratoryName,
      protocolRef: dataset.protocolReference,
      operatorId: actor.id,
    }),
  })

  await updateDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.statistics),
    analysisId,
    stripUndefined(next as unknown as Record<string, unknown>)
  )

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "statistics.recalculate",
    entityType: "statistics",
    entityId: analysisId,
    meta: { labDatasetId: existing.labDatasetId },
  })
  return next
}

export async function listStatisticsAnalyses(studyId: string): Promise<StatisticsRecord[]> {
  const rows = await listDocs<StatisticsRecord>(
    studySub(studyId, STUDY_SUBCOLLECTIONS.statistics)
  )
  const parsed = rows.map((r) =>
    StatisticsRecordSchema.parse({
      ...r,
      assayType: r.assayType ?? r.assay,
      assay: r.assayType ?? r.assay,
      treatmentSummaries: r.treatmentSummaries ?? [],
      scheffeComparisons: r.scheffeComparisons ?? [],
      completeness: r.completeness ?? {
        expectedCells: 0,
        observedCells: 0,
        missingCells: 0,
        incomplete: false,
        warnings: [],
      },
    })
  )

  const withFreshness = await Promise.all(
    parsed.map(async (r) => ({
      ...r,
      freshness: await evaluateStatisticsFreshness(studyId, r),
    }))
  )

  return withFreshness.sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt))
}

export async function getStatisticsAnalysis(
  studyId: string,
  id: string
): Promise<StatisticsRecord | null> {
  const raw = await getDocData<StatisticsRecord>(
    studySub(studyId, STUDY_SUBCOLLECTIONS.statistics),
    id
  )
  if (!raw) return null
  const record = StatisticsRecordSchema.parse({
    ...raw,
    assayType: raw.assayType ?? raw.assay,
    assay: raw.assayType ?? raw.assay,
    treatmentSummaries: raw.treatmentSummaries ?? [],
    scheffeComparisons: raw.scheffeComparisons ?? [],
    completeness: raw.completeness ?? {
      expectedCells: 0,
      observedCells: 0,
      missingCells: 0,
      incomplete: false,
      warnings: [],
    },
  })
  return {
    ...record,
    freshness: await evaluateStatisticsFreshness(studyId, record),
  }
}

export async function deleteStatisticsAnalysis(
  studyId: string,
  id: string,
  actor: Actor
): Promise<void> {
  const existing = await getStatisticsAnalysis(studyId, id)
  if (!existing) throw new Error("Statistics analysis not found.")
  await deleteDocData(studySub(studyId, STUDY_SUBCOLLECTIONS.statistics), id)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "statistics.delete",
    entityType: "statistics",
    entityId: id,
    meta: { labDatasetId: existing.labDatasetId },
  })
}

/** Preview computation without persisting (UI workspace). */
export async function previewStatisticsAnalysis(
  studyId: string,
  input: StatisticsCreateInput
) {
  const parsed = StatisticsCreateInputSchema.parse(input)
  if (!isValidMeasurementKey(parsed.assayType, parsed.measurementKey)) {
    throw new Error(`Invalid measurement field for ${parsed.assayType}.`)
  }
  const { dataset, replicates } = await loadSource(studyId, parsed.labDatasetId, parsed.assayType)
  const computed = computeExperimentalStatistics({
    assayType: parsed.assayType,
    measurementKey: parsed.measurementKey,
    replicates,
    alpha: parsed.alpha ?? STATISTICS_ALPHA,
  })
  return { dataset, replicates, computed }
}
