import { listLabDatasets } from "@/lib/repositories/labRepository"
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
  listDockingRuns,
  listPredictionRuns,
} from "@/lib/repositories/scientificRunRepository"
import { listStatisticsAnalyses } from "@/lib/repositories/statisticsRepository"
import { emptyReadiness, type StudyReadiness } from "@/lib/workflow/studyFlow"

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
  ] = await Promise.all([
    listFormulations(studyId),
    listCompounds(studyId),
    listProteins(studyId),
    listCellLines(studyId),
    listReferences(studyId),
    listAdmetRuns(studyId),
    listDockingRuns(studyId),
    listPredictionRuns(studyId),
    listLabDatasets(studyId),
    listStatisticsAnalyses(studyId),
    listComparisons(studyId),
    listInterpretations(studyId),
  ])

  const labDpph = labDatasets.filter((d) => assayOf(d) === "dpph").length
  const labLdh = labDatasets.filter((d) => assayOf(d) === "ldh").length
  const characterization = labDatasets.filter((d) => {
    const assay = assayOf(d)
    return assay !== "" && assay !== "dpph" && assay !== "ldh"
  }).length

  const staleOf = (rows: { freshness?: string }[]) =>
    rows.filter((row) => row.freshness === "STALE").length

  return emptyReadiness({
    formulations: formulations.length,
    compounds: compounds.length,
    proteins: proteins.length,
    cellLines: cellLines.length,
    references: references.length,
    admetRuns: admetRuns.length,
    dockingRuns: dockingRuns.length,
    predictionRuns: predictionRuns.length,
    labDpph,
    labLdh,
    characterization,
    statistics: statistics.length,
    comparisons: comparisons.length,
    interpretations: interpretations.length,
    staleStatistics: staleOf(statistics),
    staleComparisons: staleOf(comparisons),
    staleInterpretations: staleOf(interpretations),
  })
}
