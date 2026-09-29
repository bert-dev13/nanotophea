/**
 * Interpretation repository — researcher-authored, evidence-linked.
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
import { STUDY_SUBCOLLECTIONS, studySub } from "@/lib/firebase/paths"
import {
  deleteDocData,
  docRef,
  getDocData,
  listDocs,
  setDocData,
  updateDocData,
} from "@/lib/firebase/firestore"
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
import type { EvidenceType } from "@/types/evidence"

type Actor = { id: string }

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function normalizeStatus(status: string | undefined): Interpretation["status"] {
  if (status === "submitted") return "reviewed"
  if (status === "draft" || status === "reviewed" || status === "final") return status
  return "draft"
}

function parseInterpretation(raw: Interpretation): Interpretation {
  const linkedEvidence = raw.linkedEvidence?.length
    ? raw.linkedEvidence
    : (raw.linkedEvidenceIds ?? []).map((id) => ({
        sourceType: "reference" as const,
        sourceId: id,
        evidenceClass: "REFERENCE" as const,
        label: id,
      }))

  return InterpretationSchema.parse({
    ...raw,
    status: normalizeStatus(raw.status as string),
    linkedEvidence,
    body: raw.body ?? raw.interpretationText ?? "",
    interpretationText: raw.interpretationText || raw.body || "",
    researchQuestion: raw.researchQuestion ?? "",
    researchObjective: raw.researchObjective ?? "",
    hypothesisText: raw.hypothesisText ?? "",
    computationalSummary: raw.computationalSummary ?? "",
    experimentalSummary: raw.experimentalSummary ?? "",
    statisticalSummary: raw.statisticalSummary ?? "",
    comparisonSummary: raw.comparisonSummary ?? "",
    limitations: raw.limitations ?? "",
    conclusion: raw.conclusion ?? "",
    hypothesisAssessment: raw.hypothesisAssessment ?? "not_assessed",
  })
}

async function resolveOneLink(
  studyId: string,
  link: InterpretationLinkedEvidence
): Promise<EvidenceCatalogItem> {
  const base = {
    sourceType: link.sourceType,
    sourceId: link.sourceId,
    label: link.label,
    evidenceClass: link.evidenceClass,
    moduleLabel: link.moduleLabel || SOURCE_TYPE_LABELS[link.sourceType],
    updatedAt: link.sourceUpdatedAt || "",
  }

  try {
    switch (link.sourceType) {
      case "formulation": {
        const r = await getFormulation(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: r.name,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || "REFERENCE",
          updatedAt: r.updatedAt,
          methodOrSource: r.provenance.source,
        }
      }
      case "compound": {
        const r = await getCompound(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: r.name,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || "REFERENCE",
          updatedAt: r.updatedAt,
        }
      }
      case "protein": {
        const r = await getProtein(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: r.name,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || "REFERENCE",
          updatedAt: r.updatedAt,
        }
      }
      case "cellLine": {
        const r = await getCellLine(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: r.name,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || "REFERENCE",
          updatedAt: r.updatedAt,
        }
      }
      case "reference": {
        const r = await getReference(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: r.title,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || "LITERATURE",
          updatedAt: r.updatedAt,
          methodOrSource: r.citationText || r.doi,
        }
      }
      case "admetRun": {
        const rows = await listAdmetRuns(studyId)
        const r = rows.find((x) => x.id === link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: r.compoundName || r.toolName || `ADMET ${r.id.slice(0, 6)}`,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || "PREDICTED",
          updatedAt: r.updatedAt,
          methodOrSource: r.toolName,
          factualSnippet: Object.keys(r.descriptors || {}).length
            ? `${Object.keys(r.descriptors).length} descriptor(s)`
            : undefined,
        }
      }
      case "dockingRun": {
        const r = await getDockingRun(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        const best = r.modes?.[0]?.affinityKcalMol
        return {
          ...base,
          label: r.runName || `Docking ${r.id.slice(0, 6)}`,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || "PREDICTED",
          updatedAt: r.updatedAt,
          methodOrSource: r.vinaVersion || "AutoDock Vina (imported)",
          factualSnippet:
            best != null ? `Best affinity: ${best} kcal/mol` : undefined,
        }
      }
      case "predictionRun": {
        const r = await getPredictionRun(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: r.runName,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || "PREDICTED",
          updatedAt: r.updatedAt,
          moduleLabel: `Prediction · ${(r.endpoint || r.module).toUpperCase()}`,
          methodOrSource: r.methodName,
          factualSnippet: `${r.resultPoints?.length ?? 0} result point(s)`,
        }
      }
      case "labDataset": {
        const r = await getLabDataset(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: r.datasetName,
          evidenceClass: "EXPERIMENTAL",
          updatedAt: r.updatedAt,
          moduleLabel: `Lab · ${r.assayType.toUpperCase()}`,
          methodOrSource: r.laboratoryName,
          dateLabel: r.datePerformed,
        }
      }
      case "statistics": {
        const r = await getStatisticsAnalysis(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: `${r.assayType.toUpperCase()} · ${r.measurementLabel}`,
          evidenceClass: "EXPERIMENTAL",
          updatedAt: r.updatedAt,
          freshness: r.freshness,
          factualSnippet:
            r.anova?.pValue != null
              ? `ANOVA p = ${r.anova.pValue < 0.0001 ? "< 0.0001" : r.anova.pValue.toFixed(4)}${
                  r.anova.significant ? " · significant at α = 0.05" : ""
                }`
              : undefined,
        }
      }
      case "comparison": {
        const r = await getComparison(studyId, link.sourceId)
        if (!r) return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
        return {
          ...base,
          label: `${r.endpoint.toUpperCase()} · ${r.comparisonMode}`,
          evidenceClass: "INTERPRETATION",
          updatedAt: r.updatedAt,
          freshness: r.freshness,
          factualSnippet: `Compatibility: ${r.compatibilityStatus}`,
        }
      }
      default:
        return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
    }
  } catch {
    return { ...base, missing: true, label: `${link.label} (SOURCE MISSING)` }
  }
}

export async function resolveLinkedEvidence(
  studyId: string,
  links: InterpretationLinkedEvidence[]
): Promise<EvidenceCatalogItem[]> {
  const out: EvidenceCatalogItem[] = []
  for (const link of links) {
    out.push(await resolveOneLink(studyId, link))
  }
  return out
}

export async function buildEvidenceLibrary(studyId: string): Promise<EvidenceGroup[]> {
  const [
    formulations,
    compounds,
    proteins,
    cellLines,
    references,
    admet,
    docking,
    predictions,
    labs,
    stats,
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

  const groups: EvidenceGroup[] = [
    {
      id: "computational",
      title: "Computational",
      items: [
        ...admet.map((r) => ({
          sourceType: "admetRun" as const,
          sourceId: r.id,
          label: r.compoundName || r.toolName || `ADMET ${r.id.slice(0, 6)}`,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || ("PREDICTED" as const),
          moduleLabel: "ADMET",
          updatedAt: r.updatedAt,
          methodOrSource: r.toolName,
        })),
        ...docking.map((r) => ({
          sourceType: "dockingRun" as const,
          sourceId: r.id,
          label: r.runName || `Docking ${r.id.slice(0, 6)}`,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || ("PREDICTED" as const),
          moduleLabel: "Molecular docking",
          updatedAt: r.updatedAt,
          factualSnippet:
            r.modes?.[0]?.affinityKcalMol != null
              ? `Best affinity: ${r.modes[0].affinityKcalMol} kcal/mol`
              : undefined,
        })),
        ...predictions.map((r) => ({
          sourceType: "predictionRun" as const,
          sourceId: r.id,
          label: r.runName,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || ("PREDICTED" as const),
          moduleLabel: `Prediction · ${(r.endpoint || r.module).toUpperCase()}`,
          updatedAt: r.updatedAt,
          methodOrSource: r.methodName,
        })),
      ],
    },
    {
      id: "experimental",
      title: "Experimental",
      items: labs.map((r) => ({
        sourceType: "labDataset" as const,
        sourceId: r.id,
        label: r.datasetName,
        evidenceClass: "EXPERIMENTAL" as const,
        moduleLabel: `Lab · ${r.assayType.toUpperCase()}`,
        updatedAt: r.updatedAt,
        dateLabel: r.datePerformed,
        methodOrSource: r.laboratoryName,
      })),
    },
    {
      id: "statistics",
      title: "Statistics",
      items: stats.map((r) => ({
        sourceType: "statistics" as const,
        sourceId: r.id,
        label: `${r.assayType.toUpperCase()} · ${r.measurementLabel}`,
        evidenceClass: "EXPERIMENTAL" as const,
        moduleLabel: "Statistics",
        updatedAt: r.updatedAt,
        freshness: r.freshness,
        factualSnippet:
          r.anova?.pValue != null
            ? `ANOVA p = ${r.anova.pValue < 0.0001 ? "< 0.0001" : r.anova.pValue.toFixed(4)}`
            : undefined,
      })),
    },
    {
      id: "comparison",
      title: "Prediction vs Experimental",
      items: comparisons.map((r) => ({
        sourceType: "comparison" as const,
        sourceId: r.id,
        label: `${r.endpoint.toUpperCase()} · ${r.comparisonMode}`,
        evidenceClass: "INTERPRETATION" as const,
        moduleLabel: "Comparison",
        updatedAt: r.updatedAt,
        freshness: r.freshness,
        factualSnippet: r.compatibilityStatus,
      })),
    },
    {
      id: "research",
      title: "Research Data",
      items: [
        ...formulations.map((r) => ({
          sourceType: "formulation" as const,
          sourceId: r.id,
          label: r.name,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || ("REFERENCE" as const),
          moduleLabel: "Formulation",
          updatedAt: r.updatedAt,
        })),
        ...compounds.map((r) => ({
          sourceType: "compound" as const,
          sourceId: r.id,
          label: r.name,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || ("REFERENCE" as const),
          moduleLabel: "Phytochemical",
          updatedAt: r.updatedAt,
        })),
        ...proteins.map((r) => ({
          sourceType: "protein" as const,
          sourceId: r.id,
          label: r.name,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || ("REFERENCE" as const),
          moduleLabel: "Protein",
          updatedAt: r.updatedAt,
        })),
        ...cellLines.map((r) => ({
          sourceType: "cellLine" as const,
          sourceId: r.id,
          label: r.name,
          evidenceClass: (r.provenance.evidenceClass as EvidenceType) || ("REFERENCE" as const),
          moduleLabel: "Cell line",
          updatedAt: r.updatedAt,
        })),
      ],
    },
    {
      id: "references",
      title: "References",
      items: references.map((r) => ({
        sourceType: "reference" as const,
        sourceId: r.id,
        label: r.title,
        evidenceClass: (r.provenance.evidenceClass as EvidenceType) || ("LITERATURE" as const),
        moduleLabel: "Reference",
        updatedAt: r.updatedAt,
      })),
    },
  ]

  return groups
}

async function validateAndRefreshLinks(
  studyId: string,
  links: InterpretationLinkedEvidence[]
): Promise<InterpretationLinkedEvidence[]> {
  const resolved = await resolveLinkedEvidence(studyId, links)
  const next: InterpretationLinkedEvidence[] = []
  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    const item = resolved[i]
    if (!assertValidEvidenceClassForSource(link.sourceType, link.evidenceClass)) {
      throw new Error(
        `Invalid evidence class ${link.evidenceClass} for source type ${link.sourceType}.`
      )
    }
    if (item.missing) {
      // Keep the link but mark with SOURCE MISSING label — do not silently drop
      next.push({
        ...link,
        label: item.label.includes("SOURCE MISSING") ? item.label : `${link.label} (SOURCE MISSING)`,
      })
      continue
    }
    next.push({
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      evidenceClass: item.evidenceClass,
      label: item.label,
      sourceUpdatedAt: item.updatedAt,
      moduleLabel: item.moduleLabel,
    })
  }
  return next
}

export async function createInterpretation(
  studyId: string,
  actor: Actor,
  rawInput: InterpretationCreateInput
): Promise<Interpretation> {
  const input = InterpretationCreateInputSchema.parse(rawInput)

  let researchQuestion = input.researchQuestion ?? ""
  let researchObjective = input.researchObjective ?? ""
  let hypothesisText = input.hypothesisText ?? ""
  if (input.researchQuestionPresetId) {
    const preset = getInterpretationPreset(input.researchQuestionPresetId)
    if (!preset) throw new Error("Unknown research question preset.")
    // Only fill blanks — never silently overwrite researcher text
    if (!researchQuestion.trim()) researchQuestion = preset.researchQuestion
    if (!researchObjective.trim()) researchObjective = preset.researchObjective
    if (!hypothesisText.trim()) hypothesisText = preset.hypothesisText
  }

  const linkedEvidence = await validateAndRefreshLinks(studyId, input.linkedEvidence ?? [])
  const fingerprint = buildInterpretationFingerprint(linkedEvidence)

  const assessment = input.hypothesisAssessment ?? "not_assessed"
  const now = new Date().toISOString()
  const ref = docRef(studySub(studyId, STUDY_SUBCOLLECTIONS.interpretations))

  const record = InterpretationSchema.parse({
    id: ref.id,
    studyId,
    title: input.title.trim(),
    body: input.interpretationText ?? "",
    researchQuestion,
    researchObjective,
    hypothesisText,
    researchQuestionPresetId: input.researchQuestionPresetId,
    linkedEvidence,
    linkedEvidenceIds: linkedEvidence.map((l) => l.sourceId),
    computationalSummary: input.computationalSummary ?? "",
    experimentalSummary: input.experimentalSummary ?? "",
    statisticalSummary: input.statisticalSummary ?? "",
    comparisonSummary: input.comparisonSummary ?? "",
    interpretationText: input.interpretationText ?? "",
    limitations: input.limitations ?? "",
    conclusion: input.conclusion ?? "",
    hypothesisAssessment: assessment,
    assessmentRationale: input.assessmentRationale,
    assessmentSelectedBy: assessment !== "not_assessed" ? actor.id : undefined,
    assessmentSelectedAt: assessment !== "not_assessed" ? now : undefined,
    status: input.status ?? "draft",
    sourceFingerprint: fingerprint,
    freshness: "CURRENT",
    notes: input.notes,
    provenance: defaultProvenance("INTERPRETATION", {
      operatorId: actor.id,
      recordedAt: now,
      methodName: "Researcher Interpretation",
      assumptions:
        "Human-authored interpretation. Linked evidence classes are preserved. Not an experimental result.",
      limitations:
        "Does not auto-assess hypotheses or generate efficacy conclusions.",
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await setDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.interpretations),
    ref.id,
    stripUndefined(record as unknown as Record<string, unknown>)
  )
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "interpretation.create",
    entityType: "interpretation",
    entityId: ref.id,
  })
  if (assessment !== "not_assessed") {
    await writeAuditLog({
      studyId,
      actorId: actor.id,
      action: "interpretation.hypothesis_assessment",
      entityType: "interpretation",
      entityId: ref.id,
      meta: { assessment },
    })
  }
  return record
}

export async function updateInterpretation(
  studyId: string,
  id: string,
  actor: Actor,
  rawPatch: InterpretationUpdateInput
): Promise<Interpretation> {
  const patch = InterpretationUpdateInputSchema.parse(rawPatch)
  const existing = await getInterpretation(studyId, id)
  if (!existing) throw new Error("Interpretation not found.")

  const now = new Date().toISOString()
  let linkedEvidence = existing.linkedEvidence
  if (patch.linkedEvidence) {
    linkedEvidence = await validateAndRefreshLinks(studyId, patch.linkedEvidence)
  } else {
    // Refresh timestamps for freshness
    linkedEvidence = await validateAndRefreshLinks(studyId, existing.linkedEvidence)
  }

  const fingerprint = buildInterpretationFingerprint(linkedEvidence)

  let assessment = existing.hypothesisAssessment
  let assessmentSelectedBy = existing.assessmentSelectedBy
  let assessmentSelectedAt = existing.assessmentSelectedAt
  let assessmentRationale =
    patch.assessmentRationale === null
      ? undefined
      : patch.assessmentRationale !== undefined
        ? patch.assessmentRationale
        : existing.assessmentRationale

  const assessmentChanged =
    patch.hypothesisAssessment != null &&
    patch.hypothesisAssessment !== existing.hypothesisAssessment

  if (assessmentChanged) {
    assessment = patch.hypothesisAssessment as HypothesisAssessment
    assessmentSelectedBy = actor.id
    assessmentSelectedAt = now
  }

  const statusChanged = patch.status != null && patch.status !== existing.status

  let researchQuestion = patch.researchQuestion ?? existing.researchQuestion
  let researchObjective = patch.researchObjective ?? existing.researchObjective
  let hypothesisText = patch.hypothesisText ?? existing.hypothesisText
  const presetId =
    patch.researchQuestionPresetId !== undefined
      ? patch.researchQuestionPresetId
      : existing.researchQuestionPresetId
  if (patch.researchQuestionPresetId) {
    const preset = getInterpretationPreset(patch.researchQuestionPresetId)
    if (!preset) throw new Error("Unknown research question preset.")
    if (!(patch.researchQuestion ?? "").trim()) researchQuestion = preset.researchQuestion
    if (!(patch.researchObjective ?? "").trim()) researchObjective = preset.researchObjective
    if (!(patch.hypothesisText ?? "").trim()) hypothesisText = preset.hypothesisText
  }

  const interpretationText =
    patch.interpretationText !== undefined
      ? patch.interpretationText
      : existing.interpretationText

  const next = InterpretationSchema.parse({
    ...existing,
    title: patch.title ?? existing.title,
    researchQuestion,
    researchObjective,
    hypothesisText,
    researchQuestionPresetId: presetId,
    linkedEvidence,
    linkedEvidenceIds: linkedEvidence.map((l) => l.sourceId),
    computationalSummary:
      patch.computationalSummary !== undefined
        ? patch.computationalSummary
        : existing.computationalSummary,
    experimentalSummary:
      patch.experimentalSummary !== undefined
        ? patch.experimentalSummary
        : existing.experimentalSummary,
    statisticalSummary:
      patch.statisticalSummary !== undefined
        ? patch.statisticalSummary
        : existing.statisticalSummary,
    comparisonSummary:
      patch.comparisonSummary !== undefined
        ? patch.comparisonSummary
        : existing.comparisonSummary,
    interpretationText,
    body: interpretationText,
    limitations:
      patch.limitations !== undefined ? patch.limitations : existing.limitations,
    conclusion: patch.conclusion !== undefined ? patch.conclusion : existing.conclusion,
    hypothesisAssessment: assessment,
    assessmentRationale,
    assessmentSelectedBy,
    assessmentSelectedAt,
    status: patch.status ?? existing.status,
    sourceFingerprint: fingerprint,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    updatedAt: now,
    updatedBy: actor.id,
    provenance: {
      ...existing.provenance,
      evidenceClass: "INTERPRETATION",
      operatorId: actor.id,
    },
  })

  await setDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.interpretations),
    id,
    stripUndefined(next as unknown as Record<string, unknown>)
  )

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "interpretation.update",
    entityType: "interpretation",
    entityId: id,
  })
  if (statusChanged) {
    await writeAuditLog({
      studyId,
      actorId: actor.id,
      action: "interpretation.status_change",
      entityType: "interpretation",
      entityId: id,
      meta: { status: next.status },
    })
  }
  if (assessmentChanged) {
    await writeAuditLog({
      studyId,
      actorId: actor.id,
      action: "interpretation.hypothesis_assessment",
      entityType: "interpretation",
      entityId: id,
      meta: { assessment: next.hypothesisAssessment },
    })
  }

  const resolved = await resolveLinkedEvidence(studyId, next.linkedEvidence)
  return {
    ...next,
    freshness: evaluateInterpretationFreshness(
      fingerprint,
      resolved.map((r) => ({
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        sourceUpdatedAt: r.updatedAt,
        missing: r.missing,
      }))
    ),
  }
}

export async function getInterpretation(
  studyId: string,
  id: string
): Promise<Interpretation | null> {
  const raw = await getDocData<Interpretation>(
    studySub(studyId, STUDY_SUBCOLLECTIONS.interpretations),
    id
  )
  if (!raw) return null
  const record = parseInterpretation(raw)
  if (record.studyId !== studyId) return null
  const resolved = await resolveLinkedEvidence(studyId, record.linkedEvidence)
  return {
    ...record,
    freshness: evaluateInterpretationFreshness(
      record.sourceFingerprint,
      resolved.map((r) => ({
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        sourceUpdatedAt: r.updatedAt,
        missing: r.missing,
      }))
    ),
  }
}

export async function listInterpretations(studyId: string): Promise<Interpretation[]> {
  const rows = await listDocs<Interpretation>(
    studySub(studyId, STUDY_SUBCOLLECTIONS.interpretations)
  )
  const parsed = rows.map((r) => parseInterpretation(r)).filter((r) => r.studyId === studyId)
  const withFresh = await Promise.all(
    parsed.map(async (record) => {
      const resolved = await resolveLinkedEvidence(studyId, record.linkedEvidence)
      return {
        ...record,
        freshness: evaluateInterpretationFreshness(
          record.sourceFingerprint,
          resolved.map((r) => ({
            sourceType: r.sourceType,
            sourceId: r.sourceId,
            sourceUpdatedAt: r.updatedAt,
            missing: r.missing,
          }))
        ),
      }
    })
  )
  return withFresh.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function deleteInterpretation(
  studyId: string,
  id: string,
  actor: Actor
): Promise<void> {
  const existing = await getInterpretation(studyId, id)
  if (!existing) throw new Error("Interpretation not found.")
  await deleteDocData(studySub(studyId, STUDY_SUBCOLLECTIONS.interpretations), id)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "interpretation.delete",
    entityType: "interpretation",
    entityId: id,
  })
}

export type { InterpretationSourceType }
