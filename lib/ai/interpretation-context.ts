/**
 * Sanitized interpretation context. Together AI receives this text only.
 * It does not receive database credentials.
 */
import { query, queryOne } from "@/lib/db/mysql"
import {
  mapStudy,
  mapCompound,
  mapProtein,
  mapCellLine,
  mapAdmetRun,
  mapDockingRun,
  mapPredictionRun,
  mapLabDataset,
  mapStatisticsRecord,
  mapComparison,
  mapReference,
  mapLabReplicate,
} from "@/lib/repositories/mysqlMappers"
import { hardcodedAdmeAssessment, PROTOTYPE_ADME_PROVIDER } from "@/lib/adme/assessmentService"
import { isPrototypeAdmeRun, latestScreeningRun, screenedCompoundIds } from "@/lib/adme/service"
import { ADME_PROVIDER_NAME } from "@/lib/adme/types"
import { presentAdmeGroups } from "@/lib/insilico/admeAssessment"
import { screenLipinski } from "@/lib/insilico/lipinski"
import { CHARACTERIZATION_ASSAYS, getLabAssayConfig } from "@/lib/lab/labAssayConfig"
import { endpointCoverageStatus, PREDICTION_LAB_ENDPOINTS } from "@/lib/lab/sections"
import type { AdmetRun, LabReplicate } from "@/lib/domain/models"
import { LabReplicateSchema } from "@/lib/domain/models"
import { getPubChemCompound } from "@/lib/scientific/pubchem"
import { dockingSystemLabels, isCompleteDockingProfile, profileSpecForProtein } from "@/lib/docking/profiles"
import { computeExperimentalStatistics } from "@/lib/statistics/runAnalysis"
import type { InterpretationEvidenceSummary } from "@/lib/ai/types"

const ENDPOINT_LABEL: Record<string, string> = {
  dpph: "DPPH",
  mtt: "MTT",
  ldh: "LDH",
  ros: "ROS",
  bax: "BAX",
  hippo_yap: "Hippo–YAP",
}

export interface InterpretationContextResult {
  context: string
  summary: InterpretationEvidenceSummary
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function clip(value: string, max = 500): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`
}

function syntheticDemoRecord(row: Record<string, unknown> | undefined): boolean {
  const provenance = row?.provenance as { evidenceClass?: string } | undefined
  return text(provenance?.evidenceClass) === "SYNTHETIC"
}

function isConcentrationUnit(unit: string): boolean {
  return /µg|μg|ug\/|µM|μM|\buM\b|mg\/mL|ng\/mL|g\/mL/i.test(unit)
}

export function predictionLines(row: Record<string, unknown> | undefined): string[] {
  if (!row) return []
  const lines: string[] = []
  if (row.summaryIc50 != null) {
    lines.push(`IC50: ${row.summaryIc50} ${text(row.summaryIc50Unit) || "µM"}`)
  }
  if (row.summaryMaximum != null) {
    lines.push(`Max: ${row.summaryMaximum} ${text(row.summaryMaximumUnit) || "%"}`)
  }
  if (text(row.teac)) {
    lines.push(`TEAC: ${text(row.teac)}`)
  }
  if (text(row.selectivityIndex)) {
    lines.push(`SI: ${text(row.selectivityIndex)}`)
  }
  if (text(row.pathwayEffect)) {
    lines.push(`Effect: ${text(row.pathwayEffect)}`)
  }
  const points = Array.isArray(row.resultPoints) ? row.resultPoints : []
  for (const p of points.slice(0, 5)) {
    const pt = p as Record<string, unknown>
    if (pt.concentration != null && pt.value != null) {
      lines.push(`${pt.concentration} ${text(pt.concentrationUnit)} -> ${pt.value} ${text(pt.valueUnit)} (${text(pt.metric)})`)
    }
  }
  return lines
}

export async function buildInterpretationStudyContext(studyId: string): Promise<InterpretationContextResult> {
  const studyRow = await queryOne<any>("SELECT * FROM studies WHERE id = ?", [studyId])
  const study = studyRow ? mapStudy(studyRow) : ({} as any)
  const [
    compoundRows,
    proteinRows,
    cellLineRows,
    admetRows,
    dockingRows,
    rawPredictionRows,
    datasetRows,
    statRows,
    comparisonRows,
    referenceRows,
  ] = await Promise.all([
    query<any>("SELECT * FROM phytochemicals WHERE study_id = ?", [studyId]),
    query<any>("SELECT * FROM target_proteins WHERE study_id = ?", [studyId]),
    query<any>("SELECT * FROM cell_lines WHERE study_id = ?", [studyId]),
    query<any>("SELECT * FROM admet_runs WHERE study_id = ? LIMIT 40", [studyId]),
    query<any>("SELECT * FROM docking_runs WHERE study_id = ? LIMIT 12", [studyId]),
    query<any>("SELECT * FROM biological_predictions WHERE study_id = ? LIMIT 24", [studyId]),
    query<any>("SELECT * FROM laboratory_datasets WHERE study_id = ? LIMIT 24", [studyId]),
    query<any>("SELECT * FROM statistics_analyses WHERE study_id = ? LIMIT 8", [studyId]),
    query<any>("SELECT * FROM comparisons WHERE study_id = ? LIMIT 8", [studyId]),
    query<any>("SELECT * FROM `references` WHERE study_id = ? LIMIT 8", [studyId]),
  ])

  const compounds = compoundRows.map(mapCompound)
  const proteins = proteinRows.map(mapProtein)
  const cellLines = cellLineRows.map(mapCellLine)
  const admet = admetRows.map(mapAdmetRun)
  const docking = dockingRows.map(mapDockingRun)
  const predictions = rawPredictionRows.map(mapPredictionRun)
  const datasets = datasetRows.map(mapLabDataset)
  const statistics = statRows.map(mapStatisticsRecord)
  const comparisons = comparisonRows.map(mapComparison)
  const references = referenceRows.map(mapReference)

  const storedSections = study.laboratorySections as Parameters<typeof endpointCoverageStatus>[2]
  const omissions = study.laboratoryOmissions as Parameters<typeof endpointCoverageStatus>[3]
  const labDatasets = datasets.map((row) => ({ assayType: text(row.assayType || row.assay) }))
  const laboratory = PREDICTION_LAB_ENDPOINTS.map((key) => ({
    key,
    label: ENDPOINT_LABEL[key],
    status: endpointCoverageStatus(key, labDatasets, storedSections, omissions),
  }))
  const tested = PREDICTION_LAB_ENDPOINTS.filter((key) => datasets.some((row) => text(row.assayType || row.assay) === key && !syntheticDemoRecord(row))).length
  const snapshot = datasets.map((row) => text(row.updatedAt)).filter(Boolean).sort().at(-1) ?? ""

  const lines: string[] = [
    "STUDY",
    `Title: ${text(study.title) || "Untitled study"}`,
    text(study.description) ? `Objective: ${clip(text(study.description))}` : "Objective: not recorded",
    "",
    "RESEARCH SETUP",
  ]
  const compoundNames = compounds.map((row) => text(row.name)).filter(Boolean)
  const proteinNames = proteins.map((row) => text(row.gene) || text(row.geneSymbol) || text(row.name)).filter(Boolean)
  const cellLineNames = cellLines.map((row) => text(row.name)).filter(Boolean)
  lines.push(`Phytochemicals: ${compoundNames.length ? compoundNames.join(", ") : "none recorded"}`)
  lines.push(`Target proteins: ${proteinNames.length ? proteinNames.join(", ") : "none recorded"}`)
  lines.push(`Cell lines: ${cellLineNames.length ? cellLineNames.join(", ") : "none recorded"}`)

  lines.push("", "IN-SILICO")
  if (compounds.length === 0) lines.push("No phytochemical is selected.")
  for (const compound of compounds.slice(0, 6)) {
    const name = text(compound.name) || "Unnamed compound"
    const cid = finite(compound.pubchemCid)
    lines.push(cid == null ? `${name}: no PubChem CID stored` : `${name}: PubChem CID ${cid}`)
    if (cid != null) {
      try {
        const pubchem = await getPubChemCompound(cid)
        const bits = [
          pubchem.molecularWeight != null ? `molecular weight ${pubchem.molecularWeight} g/mol` : "",
          pubchem.xLogP != null ? `XLogP ${pubchem.xLogP}` : "",
          pubchem.hBondDonors != null ? `H-bond donors ${pubchem.hBondDonors}` : "",
          pubchem.hBondAcceptors != null ? `H-bond acceptors ${pubchem.hBondAcceptors}` : "",
          pubchem.tpsa != null ? `TPSA ${pubchem.tpsa}` : "",
          pubchem.rotatableBonds != null ? `rotatable bonds ${pubchem.rotatableBonds}` : "",
        ].filter(Boolean)
        lines.push(bits.length ? `PubChem REFERENCE: ${bits.join("; ")}` : "PubChem properties were not present in the retrieved record.")
        const likeness = screenLipinski(pubchem)
        lines.push(`Lipinski RULE-BASED: ${likeness.overallLabel}`)
      } catch {
        lines.push("PubChem properties could not be retrieved for this compound.")
      }
    }
    const hardcoded = hardcodedAdmeAssessment({
      compoundId: text(compound.id),
      ...(cid != null ? { pubchemCid: cid } : {}),
    })
    const saved = latestScreeningRun(admet.flatMap((row) => {
      if (text(row.provider) !== PROTOTYPE_ADME_PROVIDER && text(row.toolName) !== PROTOTYPE_ADME_PROVIDER) return []
      return [row as unknown as AdmetRun]
    }), text(compound.id))
    const descriptors = hardcoded?.descriptors ?? (saved && isPrototypeAdmeRun(saved) ? saved.descriptors : undefined)
    if (!descriptors) {
      lines.push("ADME assessment: not available for this compound.")
    } else {
      const fields = presentAdmeGroups({ descriptors }).flatMap((group) => group.fields.map((field) => `${field.label} ${field.value}`))
      lines.push(fields.length
        ? `ADME assessment: ${fields.join("; ")}.`
        : "ADME assessment: no values stored.")
    }
  }

  lines.push("", "MOLECULAR DOCKING")
  const configurations = Array.isArray(study.dockingConfigurations) ? study.dockingConfigurations as Array<Record<string, unknown>> : []
  const skippedLines = docking.flatMap((row) => {
    const rowData = row as Record<string, unknown>
    if (text(row.status) !== "SKIPPED" && text(rowData.dockingStatus) !== "SKIPPED") return []
    const protein = proteins.find((item) => text(item.id) === text(row.proteinId))
    const target = text(rowData.targetName) || text(protein?.gene) || text(protein?.name)
    const compound = compounds.find((item) => text(item.id) === text(row.compoundId))
    const ligand = text(rowData.compoundName) || text(row.ligandName) || text(compound?.name)
    if (!ligand || !target) return []
    const reason = text(rowData.reason) || "AutoDock Vina docking profile unavailable"
    return [`${ligand} × ${target}: no docking result. ${reason}. Binding affinity: none. Do not infer an affinity.`]
  })
  const dockingLines = docking.flatMap((row) => {
    const rowData = row as Record<string, unknown>
    if (text(row.status) === "SKIPPED" || text(rowData.dockingStatus) === "SKIPPED") return []
    const affinity = finite(row.bestBindingAffinityKcalMol)
    const modes = Array.isArray(row.modes) ? row.modes : []
    if (affinity == null || modes.length === 0) return []
    const protein = proteins.find((item) => text(item.id) === text(row.proteinId))
    const target = text(protein?.gene) || text(protein?.geneSymbol) || text(protein?.name)
    const compound = compounds.find((item) => text(item.id) === text(row.compoundId))
    const ligand = text(row.ligandName) || text(compound?.name)
    if (!ligand || !target) return []
    const provenance = (row.provenance ?? {}) as Record<string, unknown>
    const config = configurations.find((item) => text(item.proteinId) === text(row.proteinId))
    const spec = profileSpecForProtein({
      pdbId: text(protein?.pdbId) || text(row.receptorPdbId),
      uniprotIds: Array.isArray(protein?.uniprotIds)
        ? protein.uniprotIds.filter((id): id is string => typeof id === "string")
        : [],
    })
    const labels = spec && isCompleteDockingProfile(spec)
      ? dockingSystemLabels({
          name: text(protein?.name) || target,
          pathway: text(protein?.pathway),
          biologicalTarget: text(protein?.biologicalTarget),
          spec,
        })
      : null
    const detail = [
      `${ligand} × ${target}`,
      `affinity ${affinity} kcal/mol`,
      labels?.receptorDiffers ? `research target ${labels.researchTarget}` : "",
      labels?.receptorDiffers ? `docking receptor ${labels.dockingReceptor}` : "",
      text(row.receptorPdbId) ? `PDB ${text(row.receptorPdbId)}` : "",
      labels?.affinityNote ?? "",
      `evidence ${text(provenance.evidenceClass) || "PREDICTED"}`,
      text(provenance.methodName) ? `method ${text(provenance.methodName)}` : "",
      config ? `search box center ${config.centerX}, ${config.centerY}, ${config.centerZ}; size ${config.sizeX} × ${config.sizeY} × ${config.sizeZ}` : "",
    ].filter(Boolean)
    return [detail.join("; ")]
  })
  const dockingEvidence = [...dockingLines, ...skippedLines]
  lines.push(dockingEvidence.length ? dockingEvidence.map((line) => `- ${line}`).join("\n") : "No completed docking result is recorded.")

  lines.push("", "BIOLOGICAL PREDICTIONS")
  const predictionRows = PREDICTION_LAB_ENDPOINTS.map((key) => {
    const matches = predictions.filter((row) => text(row.endpoint || row.module) === key)
    const latest = [...matches].sort((a, b) => text(b.updatedAt).localeCompare(text(a.updatedAt)))[0]
    return { key, latest }
  })
  let predictionCount = 0
  for (const row of predictionRows) {
    if (!row.latest) {
      lines.push(`${ENDPOINT_LABEL[row.key]}: no prediction record`)
      continue
    }
    predictionCount += 1
    const evidence = text((row.latest.provenance as { evidenceClass?: string } | undefined)?.evidenceClass) || "SIMULATION"
    const values = predictionLines(row.latest)
    lines.push(`${ENDPOINT_LABEL[row.key]} [${evidence}]: ${values.length ? values.join("; ") : "no stored output values"}`)
  }

  lines.push("", "LABORATORY")
  lines.push("Use only genuine experimental records below. Software test records are excluded and are not experimental evidence.")
  for (const row of laboratory) {
    if (row.status === "not_tested") {
      lines.push(`${row.label}: marked as not tested in this study.`)
      continue
    }
    const matches = datasets.filter((item) => text(item.assayType || item.assay) === row.key)
    const dataset = [...matches]
      .filter((item) => !syntheticDemoRecord(item))
      .sort((a, b) => text(b.updatedAt).localeCompare(text(a.updatedAt)))[0]
    if (!dataset) {
      const synthetic = matches.some((item) => syntheticDemoRecord(item))
      lines.push(synthetic
        ? `${row.label}: stored record is SYNTHETIC. It is not experimental evidence. Experimental evidence is currently unavailable.`
        : `${row.label}: no experimental record. Experimental evidence is currently unavailable.`)
      continue
    }
    lines.push(`${row.label}: experimental dataset recorded (${text(dataset.datasetName)}).`)
    const observations = Array.isArray(dataset.observations) ? dataset.observations as Array<Record<string, unknown>> : []
    const detail = observations.slice(0, 8).flatMap((obs) => {
      const label = text(obs.treatment) || text(obs.parameter) || "measurement"
      const replicates = Array.isArray(obs.replicates) ? obs.replicates.length : 0
      const mean = finite(obs.mean)
      const sd = finite(obs.sd)
      const storedUnit = text(obs.unit)
      const responseUnit = storedUnit && !isConcentrationUnit(storedUnit) ? storedUnit : ""
      const concentration = text(obs.concentration)
      const parameter = text(obs.parameter)
      return [`${label}: ${replicates > 0 ? `${replicates} replicates` : "measurement stored"}${parameter ? `, parameter ${parameter}` : ""}${mean != null ? `, mean ${mean}${responseUnit ? ` ${responseUnit}` : ""}` : ""}${sd != null ? `, SD ${sd}` : ""}${concentration ? `, concentration ${concentration}${isConcentrationUnit(storedUnit) ? ` ${storedUnit}` : ""}` : ""}`]
    })
    if (detail.length) lines.push(`${row.label} stored measurements: ${detail.join("; ")}`)
  }
  const characterization = datasets.flatMap((row) => {
    const assay = text(row.assayType || row.assay)
    if (!CHARACTERIZATION_ASSAYS.includes(assay as typeof CHARACTERIZATION_ASSAYS[number])) return []
    const hplc = (row.characterization as { hplc?: Record<string, unknown> } | undefined)?.hplc
    const marker = text(hplc?.markerCompound)
    const bits = [assay.toUpperCase(), marker, finite(hplc?.measuredQuercetinConcentration) != null ? `concentration ${hplc?.measuredQuercetinConcentration} ${text(hplc?.concentrationUnit)}`.trim() : ""].filter(Boolean)
    return [bits.join(", ")]
  })
  lines.push(characterization.length ? `Product characterization EXPERIMENTAL: ${characterization.join(" | ")}` : "Product characterization: not recorded")

  lines.push("", "STATISTICS")
  const statisticLines = await statisticsText(studyId, datasets, statistics)
  lines.push(statisticLines.length ? statisticLines.join("\n") : "No statistical analysis is stored.")

  lines.push("", "COMPARISON LIMITS")
  if (comparisons.length === 0) lines.push("No stored comparison record.")
  for (const row of comparisons) {
    const reasons = Array.isArray(row.compatibilityReasons) ? row.compatibilityReasons.map((item) => text(item)).filter(Boolean) : []
    lines.push(`${text(row.endpoint || row.assay).toUpperCase()}: ${text(row.compatibilityStatus) || "unspecified"}${reasons[0] ? `; ${reasons[0]}` : ""}`)
  }

  lines.push("", "LITERATURE")
  const literature = references.flatMap((row) => {
    const title = text(row.title)
    if (!title) return []
    return [`${title}${text(row.year) ? ` (${text(row.year)})` : ""}${text(row.pmid) ? ` PMID ${text(row.pmid)}` : ""}`]
  })
  lines.push(literature.length ? literature.map((item) => `- ${item}`).join("\n") : "No literature record is attached to this study.")

  const automatic = admet.flatMap((row) => {
    if (
      text(row.provider) !== ADME_PROVIDER_NAME
      && text(row.toolName) !== ADME_PROVIDER_NAME
      && text(row.provider) !== PROTOTYPE_ADME_PROVIDER
      && text(row.toolName) !== PROTOTYPE_ADME_PROVIDER
    ) return []
    return [row as unknown as AdmetRun]
  })
  const screened = screenedCompoundIds(compounds.map((row) => text(row.id)).filter(Boolean), automatic)
  return {
    context: lines.join("\n"),
    summary: {
      compounds: compoundNames,
      dockingResults: dockingLines.length,
      predictionEndpoints: predictionCount,
      experimentalRecorded: tested,
      experimentalEndpoints: PREDICTION_LAB_ENDPOINTS.length,
      statistics: statisticLines.length ? "available" : "not_recorded",
      characterization: characterization.length ? "available" : "not_recorded",
      literature: literature.length,
      snapshot,
      setupRecorded: compoundNames.length > 0 && proteinNames.length > 0 && cellLineNames.length > 0,
      insilicoRecorded: compounds.length > 0 && screened.length >= compounds.length,
      dockingRecorded: dockingLines.length > 0,
      predictionsRecorded: predictionCount > 0,
    },
  }
}

async function statisticsText(
  studyId: string,
  datasets: Array<Record<string, unknown>>,
  stored: Array<Record<string, unknown>>,
): Promise<string[]> {
  const lines: string[] = []
  const excluded = new Set(datasets.filter((row) => syntheticDemoRecord(row)).map((row) => text(row.id)))
  for (const row of stored) {
    if (excluded.has(text(row.labDatasetId))) continue
    const endpoint = text(row.assayType || row.assay)
    if (endpoint !== "dpph" && endpoint !== "ldh") continue
    const anova = (row.anova ?? {}) as Record<string, unknown>
    const p = finite(anova.pValue)
    lines.push(`${endpoint.toUpperCase()} stored analysis: ${text(row.measurementLabel || row.measurementKey) || "measurement"}; ANOVA p=${p ?? "not stored"}; significant=${typeof anova.significant === "boolean" ? String(anova.significant) : "not stored"}`)
  }
  for (const dataset of datasets) {
    if (syntheticDemoRecord(dataset)) continue
    const assay = text(dataset.assayType || dataset.assay)
    if (assay !== "dpph" && assay !== "ldh") continue
    if (lines.some((line) => line.startsWith(assay.toUpperCase()))) continue
    try {
      const rows = await query<any>(
        "SELECT * FROM laboratory_replicates WHERE dataset_id = ? LIMIT 24",
        [text(dataset.id)]
      )
      const parsed = rows.flatMap((row) => {
        try {
          return [mapLabReplicate(row)]
        } catch {
          return []
        }
      })
      if (parsed.length === 0) continue
      const stats = computeExperimentalStatistics({
        assayType: assay,
        measurementKey: getLabAssayConfig(assay).primaryMetricKey,
        replicates: parsed as LabReplicate[],
      })
      const p = stats.anova.pValue
      lines.push(`${assay.toUpperCase()} statistics engine ${stats.calculationMethod} ${stats.calculationVersion}: ${stats.measurementLabel}; ANOVA p=${p ?? "not produced"}; ${stats.anova.message}`)
      for (const treatment of stats.treatmentSummaries) {
        if (treatment.mean == null) continue
        lines.push(`${treatment.treatmentCode} ${treatment.label}: n=${treatment.n}, mean=${treatment.mean}${treatment.sd != null ? `, SD=${treatment.sd}` : ""}`)
      }
      for (const comparison of stats.scheffe.comparisons.slice(0, 8)) {
        if (comparison.pValue == null && comparison.meanDifference == null) continue
        lines.push(`Scheffé ${comparison.treatmentA} vs ${comparison.treatmentB}: mean difference ${comparison.meanDifference ?? "not produced"}, p=${comparison.pValue ?? "not produced"}`)
      }
    } catch {
      lines.push(`${assay.toUpperCase()}: stored replicates could not be analyzed by the statistics engine.`)
    }
  }
  return lines
}
