import { hardcodedAdmeAssessment } from "@/lib/adme/assessmentService"
import { isPrototypeAdmeRun, latestScreeningRun } from "@/lib/adme/service"
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
  mapInterpretation,
  mapNanoparticleFormulation,
} from "@/lib/repositories/mysqlMappers"
import { endpointCoverageStatus, PREDICTION_LAB_ENDPOINTS } from "@/lib/lab/sections"
import { AdmetRunSchema } from "@/lib/domain/models"
import { dockingSystemLabels, isCompleteDockingProfile, profileSpecForProtein } from "@/lib/docking/profiles"
import { presentAdmeGroups } from "@/lib/insilico/admeAssessment"
import { predictionLines } from "@/lib/ai/interpretation-context"
import { canonicalDockingPair, canonicalDockingTarget, dockingPairKey, representativeDocking } from "@/lib/ai/docking-groups"
import type { AiPageContext, DockingContextRow, LaboratoryEvidenceClass, StudyAISlice } from "@/lib/ai/types"
import { AI_MISSING_EXPERIMENT } from "@/lib/ai/types"

const ENDPOINT_LABEL: Record<string, string> = {
  dpph: "DPPH",
  mtt: "MTT",
  ldh: "LDH",
  ros: "ROS",
  bax: "BAX",
  hippo_yap: "Hippo–YAP",
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function receptorLabels(protein: Record<string, unknown> | undefined, target: string) {
  const spec = profileSpecForProtein({
    pdbId: text(protein?.pdbId),
    uniprotIds: Array.isArray(protein?.uniprotIds)
      ? protein.uniprotIds.filter((id): id is string => typeof id === "string")
      : [],
  })
  if (!spec || !isCompleteDockingProfile(spec)) return null
  const labels = dockingSystemLabels({
    name: text(protein?.name) || target,
    pathway: text(protein?.pathway),
    biologicalTarget: text(protein?.biologicalTarget),
    spec,
  })
  return labels.receptorDiffers ? labels : null
}

function admeLines(compounds: Array<Record<string, unknown>>, runs: Array<Record<string, unknown>>) {
  const parsed = runs.flatMap((row) => {
    const result = AdmetRunSchema.safeParse({
      studyId: text(row.studyId) || "study",
      createdAt: text(row.createdAt) || text(row.updatedAt) || new Date(0).toISOString(),
      updatedAt: text(row.updatedAt) || text(row.createdAt) || new Date(0).toISOString(),
      createdBy: text(row.createdBy) || "recorded",
      updatedBy: text(row.updatedBy) || text(row.createdBy) || "recorded",
      provenance: row.provenance && typeof row.provenance === "object" ? row.provenance : { evidenceClass: "PREDICTED" },
      descriptors: row.descriptors && typeof row.descriptors === "object" ? row.descriptors : {},
      ...row,
    })
    return result.success ? [result.data] : []
  })
  return compounds.flatMap((compound) => {
    const cid = typeof compound.pubchemCid === "number" ? compound.pubchemCid : undefined
    const hardcoded = hardcodedAdmeAssessment({
      compoundId: text(compound.id),
      ...(cid != null ? { pubchemCid: cid } : {}),
    })
    if (hardcoded) {
      return [{
        compound: text(compound.name) || "Compound",
        source: "ADME assessment",
        lines: presentAdmeGroups({ descriptors: hardcoded.descriptors }).flatMap((group) => group.fields.map((field) => `${group.label} ${field.label}: ${field.value}`)),
      }]
    }
    const run = latestScreeningRun(parsed, text(compound.id))
    if (!run || !isPrototypeAdmeRun(run)) return []
    return [{
      compound: text(compound.name) || "Compound",
      source: "ADME assessment",
      lines: presentAdmeGroups(run).flatMap((group) => group.fields.map((field) => `${group.label} ${field.label}: ${field.value}`)),
    }]
  })
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function clip(value: string, max = 500): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`
}

function endpointKey(label: string | null | undefined): string | null {
  if (!label) return null
  const normalized = label.toLowerCase().replace("–", "-")
  if (normalized.includes("hippo")) return "hippo_yap"
  return (Object.keys(ENDPOINT_LABEL).find((key) => ENDPOINT_LABEL[key].toLowerCase() === normalized) ?? null)
}

function evidenceClassOf(row: { provenance?: { evidenceClass?: string } | null }): "EXPERIMENTAL" | "SYNTHETIC" | "" {
  const value = row.provenance?.evidenceClass
  return value === "EXPERIMENTAL" || value === "SYNTHETIC" ? value : ""
}

function measurementLines(row: { treatmentSummaries?: unknown; observations?: unknown }): string[] {
  const summaries = Array.isArray(row.treatmentSummaries) ? row.treatmentSummaries : []
  const fromSummaries = summaries.slice(0, 6).flatMap((item) => {
    const summary = item as Record<string, unknown>
    const mean = finite(summary.mean)
    if (mean == null) return []
    const label = text(summary.label) || text(summary.treatmentCode) || "Treatment"
    const sd = finite(summary.sd)
    return [`${label}: mean ${mean}${sd != null ? `, SD ${sd}` : ""}`]
  })
  if (fromSummaries.length) return fromSummaries
  const observations = Array.isArray(row.observations) ? row.observations : []
  return observations.slice(0, 6).flatMap((item) => {
    const observation = item as Record<string, unknown>
    const mean = finite(observation.mean)
    const concentration = finite(observation.concentration)
    if (mean == null && concentration == null) return []
    const label = text(observation.label) || text(observation.treatmentCode) || "Observation"
    return [`${label}${concentration != null ? ` at ${concentration}` : ""}${mean != null ? `: mean ${mean}` : ""}`]
  })
}

export function describeLaboratory(row: StudyAISlice["laboratory"][number]): string {
  if (row.status === "not_tested") return "not experimentally tested. This is not experimental evidence."
  if (row.status !== "recorded") return AI_MISSING_EXPERIMENT
  if (row.evidence === "SYNTHETIC") return "SYNTHETIC record only. This is not an experimental assay and must not be described as one."
  if (row.evidence === "MIXED") return "EXPERIMENTAL and SYNTHETIC records are both stored. Only the EXPERIMENTAL record is laboratory evidence."
  if (row.evidence === "EXPERIMENTAL") return "EXPERIMENTAL laboratory record"
  return "experimental result recorded"
}

function listedTargets(names: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    const canonical = canonicalDockingTarget(name) || name
    const key = canonical.toLowerCase()
    if (!canonical || seen.has(key)) continue
    seen.add(key)
    result.push(canonical)
  }
  return result
}

export async function loadStudyAISlice(studyId: string): Promise<StudyAISlice> {
  const studyRow = await queryOne<any>("SELECT * FROM studies WHERE id = ?", [studyId])
  const study = studyRow ? mapStudy(studyRow) : ({} as any)
  const [
    compoundRows,
    proteinRows,
    cellLineRows,
    admetRows,
    dockingRows,
    predictionRows,
    datasetRows,
    statRows,
    comparisonRows,
    interpRows,
    nanoRow,
  ] = await Promise.all([
    query<any>("SELECT * FROM phytochemicals WHERE study_id = ?", [studyId]),
    query<any>("SELECT * FROM target_proteins WHERE study_id = ?", [studyId]),
    query<any>("SELECT * FROM cell_lines WHERE study_id = ?", [studyId]),
    query<any>("SELECT * FROM admet_runs WHERE study_id = ? LIMIT 40", [studyId]),
    query<any>("SELECT * FROM docking_runs WHERE study_id = ? ORDER BY updated_at DESC LIMIT 80", [studyId]),
    query<any>("SELECT * FROM biological_predictions WHERE study_id = ? LIMIT 24", [studyId]),
    query<any>("SELECT * FROM laboratory_datasets WHERE study_id = ? LIMIT 20", [studyId]),
    query<any>("SELECT * FROM statistics_analyses WHERE study_id = ? LIMIT 8", [studyId]),
    query<any>("SELECT * FROM comparisons WHERE study_id = ? LIMIT 8", [studyId]),
    query<any>("SELECT * FROM interpretations WHERE study_id = ? LIMIT 4", [studyId]),
    queryOne<any>("SELECT * FROM nanoparticle_formulations WHERE study_id = ? LIMIT 1", [studyId]).catch(() => null),
  ])

  const compounds = compoundRows.map(mapCompound)
  const proteins = proteinRows.map(mapProtein)
  const cellLines = cellLineRows.map(mapCellLine)
  const admet = admetRows.map(mapAdmetRun)
  const docking = dockingRows.map(mapDockingRun)
  const predictions = predictionRows.map(mapPredictionRun)
  const datasets = datasetRows.map(mapLabDataset)
  const statistics = statRows.map(mapStatisticsRecord)
  const comparisons = comparisonRows.map(mapComparison)
  const interpretations = interpRows.map(mapInterpretation)
  const npFormulation = nanoRow ? mapNanoparticleFormulation(nanoRow) : null

  const storedSections = study.laboratorySections as Partial<Record<(typeof PREDICTION_LAB_ENDPOINTS)[number] | "characterization", boolean>> | undefined
  const omissions = study.laboratoryOmissions as Parameters<typeof endpointCoverageStatus>[3]
  const labDatasets = datasets.map((row) => ({ assayType: text(row.assayType || row.assay) }))
  const laboratory = PREDICTION_LAB_ENDPOINTS.map((key) => {
    const matching = datasets.filter((row) => text(row.assayType || row.assay) === key)
    const classes = new Set(matching.map((row) => evidenceClassOf(row)))
    const evidence: LaboratoryEvidenceClass | undefined = classes.has("EXPERIMENTAL") && classes.has("SYNTHETIC")
      ? "MIXED"
      : classes.has("SYNTHETIC")
        ? "SYNTHETIC"
        : classes.has("EXPERIMENTAL")
          ? "EXPERIMENTAL"
          : undefined
    const preferred = evidence === "SYNTHETIC"
      ? matching
      : matching.filter((row) => evidenceClassOf(row) === "EXPERIMENTAL")
    const lines = (preferred.length ? preferred : matching).flatMap((row) => measurementLines(row)).slice(0, 6)
    return {
      endpoint: ENDPOINT_LABEL[key],
      status: endpointCoverageStatus(key, labDatasets, storedSections, omissions),
      ...(evidence ? { evidence } : {}),
      ...(lines.length ? { lines } : {}),
    }
  })
  const tested = laboratory.filter((row) => row.status === "recorded").length

  const latestInterpretation = [...interpretations].sort((a, b) => text(b.updatedAt).localeCompare(text(a.updatedAt)))[0]

  const slice: StudyAISlice = {
    title: text(study.title) || "Untitled study",
    compounds: compounds.map((row) => text(row.name)).filter(Boolean),
    proteins: listedTargets(proteins.map((row) => text(row.gene) || text(row.geneSymbol) || text(row.name)).filter(Boolean)),
    cellLines: cellLines.map((row) => text(row.name)).filter(Boolean),
    admetCount: admet.length,
    adme: admeLines(compounds, admet),
    docking: representativeDocking(docking.flatMap((row) => {
      if (text(row.status) === "SKIPPED" || text((row as Record<string, unknown>).dockingStatus) === "SKIPPED") return []
      const affinity = finite(row.bestBindingAffinityKcalMol)
      const modes = Array.isArray(row.modes) ? row.modes : []
      if (affinity == null || modes.length === 0) return []
      const rowData = row as Record<string, unknown>
      const ligand = text(row.ligandName)
      const proteinId = text(row.proteinId)
      const protein = proteins.find((item) => text(item.id) === proteinId)
      const target = text(protein?.gene) || text(protein?.geneSymbol) || text(protein?.name) || text(row.researchTarget) || text(rowData.targetName)
      const compound = compounds.find((item) => text(item.id) === text(row.compoundId))
      const left = ligand || text(compound?.name) || text(rowData.compoundName)
      if (!left || !target) return []
      const provenance = (row.provenance ?? {}) as Record<string, unknown>
      const pdbId = text(row.receptorPdbId)
      const method = text(provenance.methodName)
      const labels = receptorLabels(protein, canonicalDockingTarget(target))
      const updatedAt = text(row.updatedAt)
      return [{
        pair: canonicalDockingPair(`${left} × ${target}`),
        affinityKcalMol: affinity,
        ...(updatedAt ? { updatedAt } : {}),
        ...(pdbId ? { pdbId } : {}),
        ...(method ? { method } : {}),
        ...(labels ? { dockingReceptor: labels.dockingReceptor, affinityNote: labels.affinityNote ?? undefined } : {}),
      } satisfies DockingContextRow]
    })),
    dockingSkipped: docking.flatMap((row) => {
      const rowData = row as Record<string, unknown>
      if (text(row.status) !== "SKIPPED" && text(rowData.dockingStatus) !== "SKIPPED") return []
      const proteinId = text(row.proteinId)
      const protein = proteins.find((item) => text(item.id) === proteinId)
      const target = text(rowData.targetName) || text(protein?.gene) || text(protein?.name)
      const compound = compounds.find((item) => text(item.id) === text(row.compoundId))
      const left = text(rowData.compoundName) || text(row.ligandName) || text(compound?.name)
      if (!left || !target) return []
      return [{ pair: canonicalDockingPair(`${left} × ${target}`), reason: text(rowData.reason) || "AutoDock Vina docking profile unavailable" }]
    }).filter((row, index, list) => list.findIndex((item) => dockingPairKey(item.pair) === dockingPairKey(row.pair)) === index),
    predictions: predictions.flatMap((row) => {
      const endpoint = text(row.endpoint || row.module)
      if (!ENDPOINT_LABEL[endpoint]) return []
      const evidence = text((row.provenance as { evidenceClass?: string } | undefined)?.evidenceClass) || "SIMULATION"
      return [{ endpoint: ENDPOINT_LABEL[endpoint], evidence, lines: predictionLines(row) }]
    }),
    laboratory,
    statistics: statistics.flatMap((row) => {
      const endpoint = text(row.assayType || (row as Record<string, unknown>).assay)
      if (!ENDPOINT_LABEL[endpoint]) return []
      const anova = (row.anova ?? {}) as Record<string, unknown>
      const summaries = Array.isArray(row.treatmentSummaries) ? row.treatmentSummaries : []
      const means = summaries.flatMap((item) => {
        const summary = item as Record<string, unknown>
        const mean = finite(summary.mean)
        if (mean == null) return []
        return [`${text(summary.treatmentCode) || text(summary.label)} mean ${mean}`]
      })
      return [{
        endpoint: ENDPOINT_LABEL[endpoint],
        measurement: text(row.measurementLabel || row.measurementKey),
        pValue: finite(anova.pValue),
        significant: typeof anova.significant === "boolean" ? anova.significant : null,
        message: text(anova.message),
        means,
      }]
    }),
    comparisons: comparisons.flatMap((row) => {
      const endpoint = text(row.endpoint || (row as Record<string, unknown>).assay)
      if (!ENDPOINT_LABEL[endpoint]) return []
      const reasons = Array.isArray(row.compatibilityReasons) ? row.compatibilityReasons.map((item) => text(item)).filter(Boolean) : []
      return [{
        endpoint: ENDPOINT_LABEL[endpoint],
        mode: text(row.comparisonMode) || "unspecified",
        status: text(row.compatibilityStatus) || "unspecified",
        reason: reasons[0],
      }]
    }),
    characterization: datasets.flatMap((row) => {
      const assay = text(row.assayType || (row as Record<string, unknown>).assay)
      if (PREDICTION_LAB_ENDPOINTS.includes(assay as typeof PREDICTION_LAB_ENDPOINTS[number])) return []
      const hplc = (row.characterization as { hplc?: Record<string, unknown> } | undefined)?.hplc
      if (!hplc) return []
      const marker = text(hplc.markerCompound) || assay || "Characterization"
      const bits = [marker]
      if (finite(hplc.measuredQuercetinConcentration) != null) bits.push(`concentration ${hplc.measuredQuercetinConcentration} ${text(hplc.concentrationUnit)}`.trim())
      if (finite(hplc.retentionTimeMin) != null) bits.push(`retention time ${hplc.retentionTimeMin} min`)
      return [bits.join(", ")]
    }),
    nanoparticleFormulation: npFormulation
      ? {
          systemName: npFormulation.systemName,
          carrierType: npFormulation.carrierType,
          recordType: npFormulation.recordType || "research",
          chitosanConcentrationUnit: npFormulation.chitosanConcentrationUnit,
          chitosanMwUnit: npFormulation.chitosanMwUnit,
          tppConcentrationUnit: npFormulation.tppConcentrationUnit,
          instrument: npFormulation.instrument ?? undefined,
          measurementMethod: npFormulation.measurementMethod ?? undefined,
          experimentDate: npFormulation.experimentDate ?? undefined,
          researcher: npFormulation.researcher ?? undefined,
          sampleBatchId: npFormulation.sampleBatchId ?? undefined,
          chitosanConcentration: npFormulation.chitosanConcentration ?? undefined,
          chitosanMolecularWeight: npFormulation.chitosanMolecularWeight ?? undefined,
          chitosanDeacetylationDegree: npFormulation.chitosanDeacetylationDegree ?? undefined,
          chitosanSolvent: npFormulation.chitosanSolvent ?? undefined,
          chitosanPh: npFormulation.chitosanPh ?? undefined,
          tppConcentration: npFormulation.tppConcentration ?? undefined,
          tppPh: npFormulation.tppPh ?? undefined,
          chitosanTppRatio: npFormulation.chitosanTppRatio ?? undefined,
          mixingMethod: npFormulation.mixingMethod ?? undefined,
          particleSizeNm: npFormulation.particleSizeNm ?? undefined,
          pdi: npFormulation.pdi ?? undefined,
          zetaPotentialMv: npFormulation.zetaPotentialMv ?? undefined,
          encapsulationEfficiencyPercent: npFormulation.encapsulationEfficiencyPercent ?? undefined,
          loadingCapacityPercent: npFormulation.loadingCapacityPercent ?? undefined,
          characterizationNotes: npFormulation.characterizationNotes ?? undefined,
          computationalStatus: npFormulation.computationalStatus ?? "not_configured",
        }
      : undefined,
    interpretation: {
      overall: clip(text(latestInterpretation?.interpretationText || latestInterpretation?.body)),
      relationship: clip(text(latestInterpretation?.comparisonSummary)),
      limitations: clip(text(latestInterpretation?.limitations)),
      conclusion: clip(text(latestInterpretation?.conclusion)),
    },
    coverage: { tested, endpoints: PREDICTION_LAB_ENDPOINTS.length },
  }

  const completedPairs = new Set(slice.docking.map((row) => dockingPairKey(row.pair)))
  slice.dockingSkipped = slice.dockingSkipped.filter((row) => !completedPairs.has(dockingPairKey(row.pair)))

  return slice
}

export async function buildStudyAIContext(studyId: string, page: AiPageContext): Promise<string> {
  return assembleStudyAIContext(await loadStudyAISlice(studyId), page)
}

export function assembleStudyAIContext(slice: StudyAISlice, page: AiPageContext): string {
  const focus = endpointKey(page.currentEndpoint)
  const lines: string[] = [
    `Study: ${slice.title}`,
    `Current page: ${page.currentPage || "Not specified"}`,
    page.currentPage && page.currentPage !== "Entire study"
      ? `Prioritize questions about: ${page.currentPage}. Use the rest of the record only when it bears on that question.`
      : "",
    page.currentEndpoint ? `Current endpoint: ${page.currentEndpoint}` : "Current endpoint: none selected",
    `Selected phytochemicals: ${slice.compounds.length ? slice.compounds.join(", ") : "none recorded"}`,
    `Selected target proteins: ${slice.proteins.length ? slice.proteins.join(", ") : "none recorded"}`,
    `Selected cell lines: ${slice.cellLines.length ? slice.cellLines.join(", ") : "none recorded"}`,
    slice.nanoparticleFormulation
      ? `Nanoparticle carrier system (Chitosan–TPP Ionic Gelation): System ${slice.nanoparticleFormulation.systemName}. Record type: ${slice.nanoparticleFormulation.recordType === "test_synthetic" ? "TEST / SYNTHETIC DATA (Synthetic values for software validation; NOT part of experimental study evidence)" : "RESEARCH DATA (Study protocol & experimental measurements)"}. Chitosan conc: ${slice.nanoparticleFormulation.chitosanConcentration ? `${slice.nanoparticleFormulation.chitosanConcentration} ${slice.nanoparticleFormulation.chitosanConcentrationUnit || "mg/mL"}` : "not recorded"}, MW: ${slice.nanoparticleFormulation.chitosanMolecularWeight || "not recorded"}, DDA: ${slice.nanoparticleFormulation.chitosanDeacetylationDegree || "not recorded"}; TPP conc: ${slice.nanoparticleFormulation.tppConcentration ? `${slice.nanoparticleFormulation.tppConcentration} ${slice.nanoparticleFormulation.tppConcentrationUnit || "mg/mL"}` : "not recorded"}, pH: ${slice.nanoparticleFormulation.tppPh || "not recorded"}; Ratio: ${slice.nanoparticleFormulation.chitosanTppRatio || "not recorded"}. Characterization: Size: ${slice.nanoparticleFormulation.particleSizeNm != null ? `${slice.nanoparticleFormulation.particleSizeNm} nm` : "not recorded"}, PDI: ${slice.nanoparticleFormulation.pdi != null ? slice.nanoparticleFormulation.pdi : "not recorded"}, Zeta: ${slice.nanoparticleFormulation.zetaPotentialMv != null ? `${slice.nanoparticleFormulation.zetaPotentialMv} mV` : "not recorded"}, EE: ${slice.nanoparticleFormulation.encapsulationEfficiencyPercent != null ? `${slice.nanoparticleFormulation.encapsulationEfficiencyPercent}%` : "not recorded"}, LC: ${slice.nanoparticleFormulation.loadingCapacityPercent != null ? `${slice.nanoparticleFormulation.loadingCapacityPercent}%` : "not recorded"}. Method: ${slice.nanoparticleFormulation.measurementMethod || "not recorded"}, Instrument: ${slice.nanoparticleFormulation.instrument || "not recorded"}, Sample ID: ${slice.nanoparticleFormulation.sampleBatchId || "not recorded"}. ${slice.nanoparticleFormulation.recordType === "test_synthetic" ? "CRITICAL GUARDRAIL: The current characterization values are marked as test data and should NOT be interpreted as experimental findings or real research evidence." : ""} Computational modeling: NOT YET CONFIGURED (No computational interaction result is currently available).`
      : "Nanoparticle carrier system (Chitosan–TPP): Not recorded in study setup.",
    `ADME assessments:`,
    `Experimental coverage: ${slice.coverage.tested} of ${slice.coverage.endpoints} endpoints`,
  ]
  if (slice.adme.length === 0) lines.push("- No computational ADME assessment is recorded.")
  for (const row of slice.adme) {
    lines.push(`- ${row.compound} (${row.source})`)
    if (row.lines.length === 0) lines.push("  No descriptor values stored.")
    for (const line of row.lines) lines.push(`  ${line}`)
  }

  lines.push("Docking (PREDICTED, AutoDock Vina). One latest valid result per compound and target:")
  const dockingRows = representativeDocking(slice.docking)
  if (dockingRows.length === 0 && slice.dockingSkipped.length === 0) lines.push("- No docking result is recorded.")
  for (const row of dockingRows) {
    const provenance = [row.pdbId ? `PDB ${row.pdbId}` : "", row.method ?? ""].filter(Boolean).join("; ")
    const receptor = row.dockingReceptor
      ? ` Docking receptor: ${row.dockingReceptor}.${row.affinityNote ? ` ${row.affinityNote}` : ""}`
      : ""
    const runs = row.runCount && row.runCount > 1 ? ` Latest of ${row.runCount} runs for this pair.` : ""
    lines.push(`- ${row.pair}: ${row.affinityKcalMol} kcal/mol${provenance ? ` (${provenance})` : ""}${receptor}${runs}`)
  }
  for (const row of slice.dockingSkipped) {
    lines.push(`- ${row.pair}: no docking result. ${row.reason}. Binding affinity: none. Do not infer an affinity.`)
  }

  lines.push("Biological predictions:")
  if (slice.predictions.length === 0) lines.push("- No prediction is recorded.")
  for (const row of slice.predictions) {
    const focused = !focus || endpointKey(row.endpoint) === focus
    lines.push(`- ${row.endpoint} [${row.evidence}]${focused ? "" : " (summary)"}`)
    if (focused) {
      if (row.lines.length === 0) lines.push("  No stored prediction values.")
      for (const line of row.lines) lines.push(`  ${line}`)
    }
  }

  lines.push("Laboratory:")
  for (const row of slice.laboratory) lines.push(`- ${row.endpoint}: ${describeLaboratory(row)}`)

  lines.push("Statistics:")
  const stats = slice.statistics.filter((row) => !focus || endpointKey(row.endpoint) === focus)
  if (stats.length === 0) lines.push("- No statistical analysis is recorded for the current focus.")
  for (const row of stats) {
    const p = row.pValue == null ? "p value not recorded" : row.pValue < 0.0001 ? "p < 0.0001" : `p = ${row.pValue}`
    lines.push(`- ${row.endpoint} ${row.measurement}: ${row.message || "calculated"} (${p})`)
    for (const mean of row.means.slice(0, 8)) lines.push(`  ${mean}`)
  }

  lines.push("Prediction versus experiment:")
  const comparisons = slice.comparisons.filter((row) => !focus || endpointKey(row.endpoint) === focus)
  if (comparisons.length === 0) lines.push("- No comparison record is stored for the current focus.")
  for (const row of comparisons) {
    lines.push(`- ${row.endpoint}: ${row.mode}, compatibility ${row.status}${row.reason ? `. ${clip(row.reason, 240)}` : ""}`)
  }

  lines.push("Product characterization:")
  if (slice.characterization.length === 0) lines.push("- No characterization result is recorded.")
  for (const row of slice.characterization) lines.push(`- ${row}`)

  const written = [slice.interpretation.overall, slice.interpretation.relationship, slice.interpretation.limitations, slice.interpretation.conclusion].some(Boolean)
  lines.push("Research AI Interpretation (INTERPRETATION, generated from recorded evidence, not a new measurement):")
  if (!written) lines.push("- No interpretation is recorded.")
  else {
    if (slice.interpretation.overall) lines.push(`- Overall: ${slice.interpretation.overall}`)
    if (slice.interpretation.relationship) lines.push(`- Computational vs experimental: ${slice.interpretation.relationship}`)
    if (slice.interpretation.limitations) lines.push(`- Limitations: ${slice.interpretation.limitations}`)
    if (slice.interpretation.conclusion) lines.push(`- Conclusion: ${slice.interpretation.conclusion}`)
  }

  const context = lines.filter(Boolean).join("\n")
  return context.length <= 12000 ? context : `${context.slice(0, 12000)}\nContext truncated to the recorded fields above.`
}
