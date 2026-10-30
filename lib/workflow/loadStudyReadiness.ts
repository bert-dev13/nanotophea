import { laboratoryProgress } from "@/lib/lab/sections"
import { predictionProgress } from "@/lib/predictions/modules"
import { listLabDatasets } from "@/lib/repositories/labRepository"
import { getStudy } from "@/lib/repositories/studyRepository"
import {
  listCellLines,
  listCompounds,
  listFormulations,
  listProteins,
  listReferences,
} from "@/lib/repositories/researchDataRepository"
import { listComparisons } from "@/lib/repositories/comparisonRepository"
import { listInterpretations } from "@/lib/repositories/interpretationRepository"
import {
  listAdmetRuns,
  listDockingOutcomes,
  listPredictionRuns,
} from "@/lib/repositories/scientificRunRepository"
import { listStatisticsAnalyses } from "@/lib/repositories/statisticsRepository"
import { screenedCompoundIds } from "@/lib/adme/service"
import { emptyReadiness, type StudyReadiness } from "@/lib/workflow/studyFlow"

function dockingProgress(
  compounds: { id: string }[],
  proteins: { id: string }[],
  runs: {
    compoundId: string
    proteinId: string
    status?: string
    dockingStatus?: string
    modes?: unknown[]
    bestBindingAffinityKcalMol?: number | null
  }[],
): { dockingExpected: number; dockingCompleted: number; dockingSkipped: number; dockingResolved: number } {
  const proteinIds = new Set(proteins.map((protein) => protein.id))
  const compoundIds = new Set(compounds.map((compound) => compound.id))
  const completed = new Set<string>()
  const skipped = new Set<string>()
  for (const run of runs) {
    if (!proteinIds.has(run.proteinId) || !compoundIds.has(run.compoundId)) continue
    const key = `${run.compoundId}:${run.proteinId}`
    const modes = Array.isArray(run.modes) ? run.modes : []
    if (modes.length > 0 && Number.isFinite(run.bestBindingAffinityKcalMol)) {
      completed.add(key)
      continue
    }
    if (run.status === "SKIPPED" || run.dockingStatus === "SKIPPED") skipped.add(key)
  }
  for (const key of completed) skipped.delete(key)
  return {
    dockingExpected: compounds.length * proteinIds.size,
    dockingCompleted: completed.size,
    dockingSkipped: skipped.size,
    dockingResolved: completed.size + skipped.size,
  }
}

function assayOf(row: { assay?: string; assayType?: string }): string {
  return row.assayType || row.assay || ""
}

/** Counts stored records only. Does not score, interpret, or invent results. */
export async function loadStudyReadiness(studyId: string): Promise<StudyReadiness> {
  const [
    formulations,
    compounds,
    proteins,
    cellLines,
    references,
    admetRuns,
    dockingRuns,
    predictionRuns,
    labDatasets,
    statistics,
    comparisons,
    interpretations,
    study,
  ] = await Promise.all([
    listFormulations(studyId).catch(() => []),
    listCompounds(studyId).catch(() => []),
    listProteins(studyId).catch(() => []),
    listCellLines(studyId).catch(() => []),
    listReferences(studyId).catch(() => []),
    listAdmetRuns(studyId).catch(() => []),
    listDockingOutcomes(studyId).catch(() => ({
      completed: [],
      skipped: [],
      allRuns: [],
      runsByPair: {},
      pairs: [],
    })),
    listPredictionRuns(studyId).catch(() => []),
    listLabDatasets(studyId).catch(() => []),
    listStatisticsAnalyses(studyId).catch(() => []),
    listComparisons(studyId).catch(() => []),
    listInterpretations(studyId).catch(() => []),
    getStudy(studyId),
  ])

  const biological = new Set(["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"])
  const labDpph = labDatasets.filter((d) => assayOf(d) === "dpph").length
  const labLdh = labDatasets.filter((d) => assayOf(d) === "ldh").length

  const laboratory = laboratoryProgress({
    stored: study?.laboratorySections,
    omissions: study?.laboratoryOmissions,
    datasets: labDatasets,
  })

  const predictions = predictionProgress({
    stored: study?.predictionModules,
    compounds,
    proteins,
    cellLines,
    runs: predictionRuns,
  })

  const staleOf = (rows: { freshness?: string }[]) =>
    rows.filter((row) => row.freshness === "STALE").length

  const predictionCount = (endpoint: string) =>
    predictionRuns.filter((run) => (run.endpoint || run.module) === endpoint).length

  const currentComparisons = (endpoint: "dpph" | "ldh") =>
    comparisons.filter((row) => row.endpoint === endpoint && row.freshness !== "STALE").length

  const evidenceStamp = [study?.laboratoryEvidenceAt, ...labDatasets.map((row) => row.updatedAt)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const laboratoryChangedAfterAnalysis = Boolean(
    study?.analysisFinalizedAt && evidenceStamp && evidenceStamp > study.analysisFinalizedAt,
  )

  const interpretationFilled = (row: {
    interpretationText?: string
    body?: string
    comparisonSummary?: string
    limitations?: string
    conclusion?: string
  }) => {
    const overall = (row.interpretationText || row.body || "").trim()
    return Boolean(
      overall &&
        (row.comparisonSummary || "").trim() &&
        (row.limitations || "").trim() &&
        (row.conclusion || "").trim(),
    )
  }

  return emptyReadiness({
    formulations: formulations.length,
    compounds: compounds.length,
    screenedCompounds: screenedCompoundIds(compounds.map((compound) => compound.id), admetRuns).length,
    proteins: proteins.length,
    cellLines: cellLines.length,
    references: references.length,
    admetRuns: admetRuns.length,
    dockingRuns: dockingRuns.completed.length + dockingRuns.skipped.length,
    ...dockingProgress(compounds, proteins, [...dockingRuns.completed, ...dockingRuns.skipped]),
    predictionRuns: predictionRuns.length,
    predictionRequired: predictions.required,
    predictionRecorded: predictions.recorded,
    labDpph,
    labLdh,

    labRequired: laboratory.required,
    labRecorded: laboratory.recorded,
    statistics: statistics.length,
    comparisons: comparisons.length,
    interpretations: interpretations.length,
    staleStatistics: staleOf(statistics),
    staleComparisons: staleOf(comparisons),
    staleInterpretations: staleOf(interpretations),
    predictionDpph: predictionCount("dpph"),
    predictionMtt: predictionCount("mtt"),
    predictionLdh: predictionCount("ldh"),
    predictionRos: predictionCount("ros"),
    predictionBax: predictionCount("bax"),
    predictionHippo: predictionCount("hippo_yap"),
    comparisonsDpph: currentComparisons("dpph"),
    comparisonsLdh: currentComparisons("ldh"),
    interpretationReady: interpretations.filter(interpretationFilled).length,
    interpretationFinal: interpretations.filter(
      (row) => row.status === "final" && interpretationFilled(row),
    ).length,
    laboratoryChangedAfterAnalysis,
  })
}
