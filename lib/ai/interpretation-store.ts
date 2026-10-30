import { evidenceVersion } from "@/lib/ai/evidence-version"
import { buildInterpretationFingerprint } from "@/lib/interpretation/evidenceCatalog"
import { buildInterpretationStudyContext } from "@/lib/ai/interpretation-context"
import { parseStructuredInterpretation, type StructuredInterpretation } from "@/lib/ai/interpretation-schema"
import { allowAiRequest } from "@/lib/ai/rate-limit"
import { completeStructuredInterpretation } from "@/lib/ai/together"
import { TOGETHER_MODEL, type InterpretationEvidenceSummary } from "@/lib/ai/types"
import { InterpretationSchema, type Interpretation } from "@/lib/domain/models"
import { execute, queryOne } from "@/lib/db/mysql"
import { mapInterpretation } from "@/lib/repositories/mysqlMappers"

export const AI_INTERPRETATION_ID = "ai-interpretation"

export interface StoredResearchInterpretation {
  id: string
  interpretation: StructuredInterpretation
  evidenceUsed: InterpretationEvidenceSummary
  generatedAt: string
  evidenceVersion: string
  cached: boolean
}

const tails = new Map<string, Promise<unknown>>()

export function ensureResearchInterpretation(studyId: string, actorId: string): Promise<StoredResearchInterpretation> {
  const previous = tails.get(studyId) ?? Promise.resolve()
  const run = previous.then(() => produce(studyId, actorId), () => produce(studyId, actorId))
  tails.set(studyId, run)
  return run
}

async function produce(studyId: string, actorId: string): Promise<StoredResearchInterpretation> {
  const built = await buildInterpretationStudyContext(studyId)
  const version = evidenceVersion(built.context)
  const cached = await readCached(studyId, version)
  if (cached) return { ...cached, cached: true }
  if (!allowAiRequest(actorId)) throw new Error("rate_limited")
  const reply = await completeStructuredInterpretation(built.context)
  const interpretation = parseStructuredInterpretation(reply)
  if (!interpretation) throw new Error("invalid_interpretation")
  const generatedAt = new Date().toISOString()
  await writeInterpretation(studyId, actorId, version, generatedAt, interpretation, built.summary)
  return {
    id: AI_INTERPRETATION_ID,
    interpretation,
    evidenceUsed: built.summary,
    generatedAt,
    evidenceVersion: version,
    cached: false,
  }
}

async function readCached(studyId: string, version: string): Promise<Omit<StoredResearchInterpretation, "cached"> | null> {
  const row = await queryOne<any>(
    "SELECT * FROM interpretations WHERE study_id = ? AND id = ?",
    [studyId, AI_INTERPRETATION_ID]
  )
  if (!row) return null
  let parsed: Interpretation
  try {
    parsed = mapInterpretation(row)
  } catch {
    return null
  }
  if (parsed.generatedBy !== "ai" || parsed.evidenceVersion !== version) return null
  const interpretation = fromRecord(parsed)
  if (!interpretation) return null
  return {
    id: parsed.id,
    interpretation,
    evidenceUsed: evidenceFrom(parsed),
    generatedAt: parsed.generatedAt || parsed.aiAssistance?.generatedAt || parsed.updatedAt,
    evidenceVersion: version,
  }
}

async function writeInterpretation(
  studyId: string,
  actorId: string,
  version: string,
  generatedAt: string,
  interpretation: StructuredInterpretation,
  evidenceUsed: InterpretationEvidenceSummary,
): Promise<void> {
  const existing = await queryOne<any>(
    "SELECT created_at FROM interpretations WHERE study_id = ? AND id = ?",
    [studyId, AI_INTERPRETATION_ID]
  )
  const createdAt = existing?.created_at || generatedAt
  const findings = Object.fromEntries(
    Object.entries(interpretation.endpointFindings).flatMap(([key, value]) => (value ? [[key, value]] : [])),
  )
  const record = InterpretationSchema.parse({
    id: AI_INTERPRETATION_ID,
    studyId,
    title: "Research AI Interpretation",
    body: interpretation.overallInterpretation,
    interpretationText: interpretation.overallInterpretation,
    comparisonSummary: interpretation.computationalVsExperimental,
    limitations: interpretation.limitations,
    conclusion: interpretation.conclusion,
    endpointFindings: findings,
    generatedBy: "ai",
    provider: "Together AI",
    model: TOGETHER_MODEL,
    generatedAt,
    evidenceVersion: version,
    aiAssistance: {
      generatedWithAI: true,
      provider: "Together AI",
      model: TOGETHER_MODEL,
      generatedAt,
      evidenceSnapshot: version,
      evidenceUsed: {
        compounds: evidenceUsed.compounds,
        dockingResults: evidenceUsed.dockingResults,
        predictionEndpoints: evidenceUsed.predictionEndpoints,
        experimentalRecorded: evidenceUsed.experimentalRecorded,
        experimentalEndpoints: evidenceUsed.experimentalEndpoints,
        statistics: evidenceUsed.statistics,
        characterization: evidenceUsed.characterization,
        literature: evidenceUsed.literature,
      },
    },
    hypothesisAssessment: "not_assessed",
    status: "final",
    sourceFingerprint: buildInterpretationFingerprint([]),
    freshness: "CURRENT",
    provenance: {
      evidenceClass: "INTERPRETATION",
      operatorId: actorId,
      recordedAt: generatedAt,
      methodName: "Research AI Interpretation",
      methodVersion: TOGETHER_MODEL,
      source: "Together AI",
      assumptions: "Generated by NANOTOPHEA AI from the study evidence supplied in the interpretation context. Not researcher-authored.",
      limitations: "Does not create measurements, statistics, docking scores, ADME values, or citations that were not supplied.",
    },
    createdAt,
    updatedAt: generatedAt,
    createdBy: "nanotophea-ai",
    updatedBy: "nanotophea-ai",
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
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?
    ) ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      body = VALUES(body),
      comparison_summary = VALUES(comparison_summary),
      interpretation_text = VALUES(interpretation_text),
      limitations = VALUES(limitations),
      conclusion = VALUES(conclusion),
      endpoint_findings = VALUES(endpoint_findings),
      generated_by = VALUES(generated_by),
      provider = VALUES(provider),
      model = VALUES(model),
      generated_at = VALUES(generated_at),
      evidence_version = VALUES(evidence_version),
      ai_assistance = VALUES(ai_assistance),
      source_fingerprint = VALUES(source_fingerprint),
      provenance = VALUES(provenance),
      updated_at = VALUES(updated_at),
      updated_by = VALUES(updated_by)`,
    [
      record.id,
      record.studyId,
      record.title,
      record.body ?? null,
      "",
      "",
      null,
      null,
      JSON.stringify(record.linkedEvidence ?? []),
      record.computationalSummary ?? null,
      record.experimentalSummary ?? null,
      record.statisticalSummary ?? null,
      record.comparisonSummary ?? null,
      record.interpretationText ?? null,
      record.limitations ?? null,
      record.conclusion ?? null,
      JSON.stringify(record.endpointFindings ?? {}),
      record.dockingInterpretation ?? null,
      record.characterizationInterpretation ?? null,
      record.generatedBy ?? null,
      record.provider ?? null,
      record.model ?? null,
      record.generatedAt ?? null,
      record.evidenceVersion ?? null,
      record.aiAssistance ? JSON.stringify(record.aiAssistance) : null,
      record.hypothesisAssessment,
      record.assessmentRationale ?? null,
      record.assessmentSelectedBy ?? null,
      record.assessmentSelectedAt ?? null,
      record.status,
      record.sourceFingerprint ?? null,
      JSON.stringify(record.provenance),
      record.notes ?? null,
      record.createdAt,
      record.updatedAt,
      record.createdBy,
      record.updatedBy,
    ]
  )
}

function fromRecord(record: Interpretation): StructuredInterpretation | null {
  return parseStructuredInterpretation(JSON.stringify({
    overallInterpretation: record.interpretationText || record.body || "",
    computationalVsExperimental: record.comparisonSummary || "",
    endpointFindings: record.endpointFindings ?? {},
    limitations: record.limitations || "",
    conclusion: record.conclusion || "",
  }))
}

function evidenceFrom(record: Interpretation): InterpretationEvidenceSummary {
  const used = record.aiAssistance?.evidenceUsed
  return {
    compounds: used?.compounds ?? [],
    dockingResults: used?.dockingResults ?? 0,
    predictionEndpoints: used?.predictionEndpoints ?? 0,
    experimentalRecorded: used?.experimentalRecorded ?? 0,
    experimentalEndpoints: used?.experimentalEndpoints ?? 0,
    statistics: used?.statistics ?? "not_recorded",
    characterization: used?.characterization ?? "not_recorded",
    literature: used?.literature ?? 0,
    snapshot: record.evidenceVersion || "",
    setupRecorded: false,
    insilicoRecorded: false,
    dockingRecorded: (used?.dockingResults ?? 0) > 0,
    predictionsRecorded: (used?.predictionEndpoints ?? 0) > 0,
  }
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, stripValue(value)]),
  )
}

function stripValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stripValue(item))
  if (value && typeof value === "object") return stripUndefined(value as Record<string, unknown>)
  return value
}
