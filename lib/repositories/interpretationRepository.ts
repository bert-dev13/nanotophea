"use server"

/**
 * Interpretation repository — researcher-authored, evidence-linked using MySQL/MariaDB.
 * Never auto-generates conclusions or hypothesis assessments.
 */
import {
  InterpretationCreateInputSchema,
  InterpretationSchema,
  InterpretationUpdateInputSchema,
  type Interpretation,
  type InterpretationCreateInput,
  type InterpretationLinkedEvidence,
  type InterpretationUpdateInput,
  type HypothesisAssessment,
} from "@/lib/domain/models"
import { defaultProvenance } from "@/lib/domain/provenance"
import { execute, query, queryOne } from "@/lib/db/mysql"
import { mapInterpretation } from "@/lib/repositories/mysqlMappers"
import { writeAuditLog } from "@/lib/repositories/auditRepository"
import {
  getCellLine,
  getCompound,
  getFormulation,
  getProtein,
  getReference,
  listCellLines,
  listCompounds,
  listFormulations,
  listProteins,
  listReferences,
} from "@/lib/repositories/researchDataRepository"
import {
  listAdmetRuns,
  listDockingRuns,
  listPredictionRuns,
  getDockingRun,
  getPredictionRun,
} from "@/lib/repositories/scientificRunRepository"
import { getLabDataset, listLabDatasets } from "@/lib/repositories/labRepository"
import {
  getStatisticsAnalysis,
  listStatisticsAnalyses,
} from "@/lib/repositories/statisticsRepository"
import { getComparison, listComparisons } from "@/lib/repositories/comparisonRepository"
import {
  buildInterpretationFingerprint,
  evaluateInterpretationFreshness,
  assertValidEvidenceClassForSource,
  SOURCE_TYPE_LABELS,
  type EvidenceCatalogItem,
  type EvidenceGroup,
  type InterpretationSourceType,
} from "@/lib/interpretation/evidenceCatalog"
import { getInterpretationPreset } from "@/lib/interpretation/presets"
import { randomUUID } from "crypto"

type Actor = { id: string }

function toJson(val: unknown): string | null {
  if (val === undefined || val === null) return null
  return JSON.stringify(val)
}

function generateDocId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20)
}

export async function createInterpretation(
  studyId: string,
  actor: Actor,
  rawInput: InterpretationCreateInput
): Promise<Interpretation> {
  const input = InterpretationCreateInputSchema.parse(rawInput)

  const preset = input.researchQuestionPresetId
    ? getInterpretationPreset(input.researchQuestionPresetId)
    : undefined

  const question = input.researchQuestion || preset?.researchQuestion || ""
  const objective = input.researchObjective || preset?.researchObjective || ""
  const hypothesis = input.hypothesisText || preset?.hypothesisText || ""

  const linked = input.linkedEvidence ?? []
  for (const link of linked) {
    assertValidEvidenceClassForSource(link.sourceType, link.evidenceClass)
  }

  const id = generateDocId()
  const now = new Date().toISOString()
  const fingerprint = buildInterpretationFingerprint(linked)

  const record = InterpretationSchema.parse({
    id,
    studyId,
    title: input.title,
    body: input.interpretationText || input.title,
    researchQuestion: question,
    researchObjective: objective,
    hypothesisText: hypothesis,
    researchQuestionPresetId: input.researchQuestionPresetId,
    linkedEvidence: linked,
    computationalSummary: input.computationalSummary || "",
    experimentalSummary: input.experimentalSummary || "",
    statisticalSummary: input.statisticalSummary || "",
    comparisonSummary: input.comparisonSummary || "",
    interpretationText: input.interpretationText || "",
    limitations: input.limitations || "",
    conclusion: input.conclusion || "",
    endpointFindings: input.endpointFindings,
    dockingInterpretation: input.dockingInterpretation,
    characterizationInterpretation: input.characterizationInterpretation,
    generatedBy: input.generatedBy,
    provider: input.provider,
    model: input.model,
    generatedAt: input.generatedAt,
    evidenceVersion: input.evidenceVersion,
    aiAssistance: input.aiAssistance,
    hypothesisAssessment: input.hypothesisAssessment ?? "not_assessed",
    assessmentRationale: input.assessmentRationale,
    status: input.status ?? "draft",
    sourceFingerprint: fingerprint,
    notes: input.notes,
    provenance: defaultProvenance("INTERPRETATION", {
      operatorId: actor.id,
      recordedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO interpretations (
      id, study_id, title, body, research_question, research_objective, hypothesis_text,
      research_question_preset_id, linked_evidence, computational_summary, experimental_summary,
      statistical_summary, comparison_summary, interpretation_text, limitations, conclusion,
      endpoint_findings, docking_interpretation, characterization_interpretation, generated_by,
      provider, model, generated_at, evidence_version, ai_assistance, hypothesis_assessment,
      assessment_rationale, assessment_selected_by, assessment_selected_at, status,
      source_fingerprint, provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      studyId,
      record.title,
      record.body ?? null,
      record.researchQuestion || "",
      record.researchObjective || "",
      record.hypothesisText ?? null,
      record.researchQuestionPresetId ?? null,
      toJson(record.linkedEvidence),
      record.computationalSummary ?? null,
      record.experimentalSummary ?? null,
      record.statisticalSummary ?? null,
      record.comparisonSummary ?? null,
      record.interpretationText ?? null,
      record.limitations ?? null,
      record.conclusion ?? null,
      toJson(record.endpointFindings),
      record.dockingInterpretation ?? null,
      record.characterizationInterpretation ?? null,
      record.generatedBy ?? null,
      record.provider ?? null,
      record.model ?? null,
      record.generatedAt ?? null,
      record.evidenceVersion ?? null,
      toJson(record.aiAssistance),
      record.hypothesisAssessment,
      record.assessmentRationale ?? null,
      record.assessmentSelectedBy ?? null,
      record.assessmentSelectedAt ?? null,
      record.status,
      record.sourceFingerprint ?? null,
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
    action: "interpretation.create",
    entityType: "interpretation",
    entityId: id,
  })

  return record
}

export async function listInterpretations(studyId: string): Promise<Interpretation[]> {
  const rows = await query(`SELECT * FROM interpretations WHERE study_id = ? ORDER BY created_at DESC`, [
    studyId,
  ])
  const records = rows.map(mapInterpretation)
  return Promise.all(
    records.map(async (r) => ({
      ...r,
      freshness: await evaluateFreshness(studyId, r),
    }))
  )
}

export async function getInterpretation(
  studyId: string,
  id: string
): Promise<Interpretation | null> {
  const row = await queryOne(`SELECT * FROM interpretations WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  const record = mapInterpretation(row)
  return {
    ...record,
    freshness: await evaluateFreshness(studyId, record),
  }
}

export async function updateInterpretation(
  studyId: string,
  id: string,
  actor: Actor,
  rawInput: InterpretationUpdateInput
): Promise<Interpretation> {
  const input = InterpretationUpdateInputSchema.parse(rawInput)
  const existing = await getInterpretation(studyId, id)
  if (!existing) throw new Error("Interpretation record not found")

  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?", "updated_by = ?"]
  const params: unknown[] = [now, actor.id]

  if (input.title !== undefined) {
    fields.push("title = ?")
    params.push(input.title)
  }
  if (input.researchQuestion !== undefined) {
    fields.push("research_question = ?")
    params.push(input.researchQuestion)
  }
  if (input.researchObjective !== undefined) {
    fields.push("research_objective = ?")
    params.push(input.researchObjective)
  }
  if (input.hypothesisText !== undefined) {
    fields.push("hypothesis_text = ?")
    params.push(input.hypothesisText)
  }
  if (input.researchQuestionPresetId !== undefined) {
    fields.push("research_question_preset_id = ?")
    params.push(input.researchQuestionPresetId ?? null)
  }
  if (input.linkedEvidence !== undefined) {
    for (const link of input.linkedEvidence) {
      assertValidEvidenceClassForSource(link.sourceType, link.evidenceClass)
    }
    fields.push("linked_evidence = ?", "source_fingerprint = ?")
    params.push(toJson(input.linkedEvidence), buildInterpretationFingerprint(input.linkedEvidence))
  }
  if (input.computationalSummary !== undefined) {
    fields.push("computational_summary = ?")
    params.push(input.computationalSummary)
  }
  if (input.experimentalSummary !== undefined) {
    fields.push("experimental_summary = ?")
    params.push(input.experimentalSummary)
  }
  if (input.statisticalSummary !== undefined) {
    fields.push("statistical_summary = ?")
    params.push(input.statisticalSummary)
  }
  if (input.comparisonSummary !== undefined) {
    fields.push("comparison_summary = ?")
    params.push(input.comparisonSummary)
  }
  if (input.interpretationText !== undefined) {
    fields.push("interpretation_text = ?", "body = ?")
    params.push(input.interpretationText, input.interpretationText)
  }
  if (input.limitations !== undefined) {
    fields.push("limitations = ?")
    params.push(input.limitations)
  }
  if (input.conclusion !== undefined) {
    fields.push("conclusion = ?")
    params.push(input.conclusion)
  }
  if (input.endpointFindings !== undefined) {
    fields.push("endpoint_findings = ?")
    params.push(toJson(input.endpointFindings))
  }
  if (input.dockingInterpretation !== undefined) {
    fields.push("docking_interpretation = ?")
    params.push(input.dockingInterpretation ?? null)
  }
  if (input.characterizationInterpretation !== undefined) {
    fields.push("characterization_interpretation = ?")
    params.push(input.characterizationInterpretation ?? null)
  }
  if (input.hypothesisAssessment !== undefined) {
    fields.push("hypothesis_assessment = ?", "assessment_selected_by = ?", "assessment_selected_at = ?")
    params.push(input.hypothesisAssessment, actor.id, now)
  }
  if (input.assessmentRationale !== undefined) {
    fields.push("assessment_rationale = ?")
    params.push(input.assessmentRationale ?? null)
  }
  if (input.status !== undefined) {
    fields.push("status = ?")
    params.push(input.status)
  }
  if (input.notes !== undefined) {
    fields.push("notes = ?")
    params.push(input.notes ?? null)
  }

  params.push(studyId, id)
  await execute(`UPDATE interpretations SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "interpretation.update",
    entityType: "interpretation",
    entityId: id,
  })

  const updated = await getInterpretation(studyId, id)
  if (!updated) throw new Error("Interpretation update failed")
  return updated
}

export async function deleteInterpretation(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM interpretations WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "interpretation.delete",
    entityType: "interpretation",
    entityId: id,
  })
}

async function loadSourceUpdatedAt(
  studyId: string,
  sourceType: InterpretationSourceType,
  sourceId: string
): Promise<string | undefined> {
  switch (sourceType) {
    case "formulation":
      return (await getFormulation(studyId, sourceId))?.updatedAt
    case "compound":
      return (await getCompound(studyId, sourceId))?.updatedAt
    case "protein":
      return (await getProtein(studyId, sourceId))?.updatedAt
    case "cellLine":
      return (await getCellLine(studyId, sourceId))?.updatedAt
    case "reference":
      return (await getReference(studyId, sourceId))?.updatedAt
    case "admetRun":
      return (await queryOne(`SELECT updated_at FROM admet_runs WHERE study_id = ? AND id = ?`, [studyId, sourceId]))?.updated_at
    case "dockingRun":
      return (await getDockingRun(studyId, sourceId))?.updatedAt
    case "predictionRun":
      return (await getPredictionRun(studyId, sourceId))?.updatedAt
    case "labDataset":
      return (await getLabDataset(studyId, sourceId))?.updatedAt
    case "statistics":
      return (await getStatisticsAnalysis(studyId, sourceId))?.updatedAt
    case "comparison":
      return (await getComparison(studyId, sourceId))?.updatedAt
    default:
      return undefined
  }
}

async function evaluateFreshness(
  studyId: string,
  record: Interpretation
): Promise<"CURRENT" | "STALE"> {
  const linksWithCurrent: Array<{
    sourceType: string
    sourceId: string
    sourceUpdatedAt?: string
    missing?: boolean
  }> = []
  for (const link of record.linkedEvidence) {
    const updatedAt = await loadSourceUpdatedAt(
      studyId,
      link.sourceType,
      link.sourceId
    )
    linksWithCurrent.push({
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      sourceUpdatedAt: updatedAt,
      missing: updatedAt === undefined,
    })
  }
  return evaluateInterpretationFreshness(record.sourceFingerprint, linksWithCurrent)
}

export async function getEvidenceCatalog(studyId: string): Promise<EvidenceGroup[]> {
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
  ])

  function item(
    sourceType: InterpretationSourceType,
    id: string,
    label: string,
    evidenceClass: any,
    updatedAt: string,
    moduleLabel = "General"
  ): EvidenceCatalogItem {
    return {
      sourceType,
      sourceId: id,
      label,
      evidenceClass,
      updatedAt,
      moduleLabel,
    }
  }

  const groups: EvidenceGroup[] = [
    {
      id: "research_setup",
      title: "01 Research Setup",
      items: [
        ...formulations.map((f) => item("formulation", f.id, f.name, f.provenance.evidenceClass, f.updatedAt, "Formulation")),
        ...compounds.map((c) => item("compound", c.id, c.name, c.provenance.evidenceClass, c.updatedAt, "Phytochemical")),
        ...proteins.map((p) => item("protein", p.id, p.name, p.provenance.evidenceClass, p.updatedAt, "Target Protein")),
        ...cellLines.map((cl) => item("cellLine", cl.id, cl.name, cl.provenance.evidenceClass, cl.updatedAt, "Cell Line")),
        ...references.map((r) => item("reference", r.id, r.title, r.provenance.evidenceClass, r.updatedAt, "Literature Reference")),
      ],
    },
    {
      id: "insilico",
      title: "02 In-Silico Screening",
      items: admetRuns.map((a) => item("admetRun", a.id, a.compoundName ? `${a.compoundName} ADMET` : "ADMET Run", a.provenance.evidenceClass, a.updatedAt, "ADMET / Lipinski")),
    },
    {
      id: "docking",
      title: "03 Molecular Docking",
      items: dockingRuns.map((d) => item("dockingRun", d.id, d.runName, d.provenance.evidenceClass, d.updatedAt, "AutoDock Vina")),
    },
    {
      id: "predictions",
      title: "04 Biological Predictions",
      items: predictionRuns.map((p) => item("predictionRun", p.id, p.runName, p.provenance.evidenceClass, p.updatedAt, `Prediction (${p.endpoint.toUpperCase()})`)),
    },
    {
      id: "lab",
      title: "05 Laboratory Validation",
      items: labDatasets.map((l) => item("labDataset", l.id, l.datasetName, l.provenance.evidenceClass, l.updatedAt, `Lab (${l.assayType.toUpperCase()})`)),
    },
    {
      id: "analysis",
      title: "06 Analysis & Synthesis",
      items: [
        ...statistics.map((s) => item("statistics", s.id, `${s.labDatasetName} (${s.measurementLabel})`, s.provenance.evidenceClass, s.updatedAt, "ANOVA / Scheffé")),
        ...comparisons.map((c) => item("comparison", c.id, `${c.endpoint.toUpperCase()} Comparison`, c.provenance.evidenceClass, c.updatedAt, "Side-by-Side Comparison")),
      ],
    },
  ]

  return groups
}

export const buildEvidenceLibrary = getEvidenceCatalog

export async function resolveLinkedEvidence(
  studyId: string,
  links: InterpretationLinkedEvidence[]
): Promise<EvidenceCatalogItem[]> {
  return Promise.all(
    links.map(async (link) => {
      const updatedAt = await loadSourceUpdatedAt(studyId, link.sourceType, link.sourceId)
      return {
        sourceType: link.sourceType,
        sourceId: link.sourceId,
        label: link.label,
        evidenceClass: link.evidenceClass,
        moduleLabel: link.sourceType,
        updatedAt: updatedAt || "",
        missing: !updatedAt,
      }
    })
  )
}
