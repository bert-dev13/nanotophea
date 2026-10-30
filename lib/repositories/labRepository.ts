"use server"

/**
 * Laboratory repository — experimental datasets + raw replicates using MySQL/MariaDB.
 * Never generates scientific values. Researcher entry is EXPERIMENTAL.
 * SYNTHETIC is stored only when the caller sets that class explicitly.
 */
import {
  LabDatasetInputSchema,
  LabDatasetSchema,
  LabReplicateInputSchema,
  LabReplicateSchema,
  type LabAssay,
  type LabDataset,
  type LabDatasetInput,
  type LabReplicate,
  type LabReplicateInput,
  type LabTreatmentCode,
} from "@/lib/domain/models"
import { getLabAssayConfig, LOCKED_TREATMENT_CONCENTRATIONS } from "@/lib/lab/labAssayConfig"
import { summarizeMetricByTreatment } from "@/lib/lab/labCalculations"
import { execute, query, queryOne, transaction } from "@/lib/db/mysql"
import { mapLabDataset, mapLabReplicate, parseJson } from "@/lib/repositories/mysqlMappers"
import { writeAuditLog } from "@/lib/repositories/auditRepository"
import { getCellLine, getCompound, getFormulation, getProtein } from "@/lib/repositories/researchDataRepository"
import { randomUUID } from "crypto"

type Actor = { id: string }

function generateDocId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20)
}

function toJson(val: unknown): string | null {
  if (val === undefined || val === null) return null
  return JSON.stringify(val)
}

const FORBIDDEN_EXPERIMENTAL_ASSAYS = new Set(["yap", "hippo-yap"])

function assertExperimentalAssay(assay: string) {
  if (FORBIDDEN_EXPERIMENTAL_ASSAYS.has(assay.toLowerCase())) {
    throw new Error(
      `Assay "${assay}" has no experimental Laboratory Results module under the Study Design Contract.`
    )
  }
}

function replicateCodeFromN(n: number): "R1" | "R2" | "R3" {
  if (n === 1) return "R1"
  if (n === 2) return "R2"
  if (n === 3) return "R3"
  throw new Error("Replicate must be R1, R2, or R3.")
}

async function validateLabDatasetInput(
  studyId: string,
  raw: LabDatasetInput
): Promise<LabDatasetInput> {
  const input = LabDatasetInputSchema.parse({
    ...raw,
    assay: raw.assayType ?? raw.assay,
    assayType: raw.assayType ?? raw.assay,
    protocolReference: raw.protocolReference || raw.protocolRef || "",
    protocolRef: raw.protocolReference || raw.protocolRef,
    provenance: {
      ...raw.provenance,
      evidenceClass: raw.provenance?.evidenceClass === "SYNTHETIC" ? "SYNTHETIC" : "EXPERIMENTAL",
    },
  })

  assertExperimentalAssay(input.assayType)

  if (input.provenance.evidenceClass !== "EXPERIMENTAL" && input.provenance.evidenceClass !== "SYNTHETIC") {
    throw new Error("Laboratory datasets must use evidence class EXPERIMENTAL or SYNTHETIC.")
  }

  if (
    input.provenance.evidenceClass === ("PREDICTED" as string) ||
    input.provenance.evidenceClass === ("SIMULATION" as string)
  ) {
    throw new Error("PREDICTED/SIMULATION records cannot be stored as lab datasets.")
  }

  if (!input.datePerformed?.trim()) throw new Error("Experiment date is required.")

  if (input.formulationId) {
    const f = await getFormulation(studyId, input.formulationId)
    if (!f) throw new Error("Selected formulation does not belong to this study.")
  }
  if (input.compoundId) {
    const c = await getCompound(studyId, input.compoundId)
    if (!c) throw new Error("Selected compound does not belong to this study.")
  }
  if (input.cellLineId) {
    const cl = await getCellLine(studyId, input.cellLineId)
    if (!cl) throw new Error("Selected cell line does not belong to this study.")
  }
  if (input.proteinId) {
    const p = await getProtein(studyId, input.proteinId)
    if (!p) throw new Error("Selected protein does not belong to this study.")
  }

  return input
}

export async function listLabDatasets(
  studyId: string,
  assay?: LabAssay
): Promise<LabDataset[]> {
  const sql = assay
    ? `SELECT * FROM laboratory_datasets WHERE study_id = ? AND assay_type = ? ORDER BY created_at ASC`
    : `SELECT * FROM laboratory_datasets WHERE study_id = ? ORDER BY created_at ASC`
  const params = assay ? [studyId, assay] : [studyId]
  const rows = await query(sql, params)
  return rows.map(mapLabDataset)
}

export async function getLabDataset(studyId: string, id: string): Promise<LabDataset | null> {
  const row = await queryOne(`SELECT * FROM laboratory_datasets WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  return mapLabDataset(row)
}

export async function createLabDataset(
  studyId: string,
  actor: Actor,
  raw: LabDatasetInput
): Promise<LabDataset> {
  const input = await validateLabDatasetInput(studyId, raw)
  const id = generateDocId()
  const now = new Date().toISOString()

  const record = LabDatasetSchema.parse({
    ...input,
    id,
    studyId,
    assay: input.assayType,
    protocolReference: input.protocolReference || "",
    treatmentSummaries: input.treatmentSummaries ?? [],
    observations: input.observations ?? [],
    status: input.status ?? "draft",
    provenance: {
      ...input.provenance,
      evidenceClass: input.provenance.evidenceClass,
      operatorId: actor.id,
      recordedAt: input.provenance.recordedAt || now,
    },
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO laboratory_datasets (
      id, study_id, assay_type, dataset_name, endpoint_type, formulation_id,
      compound_id, cell_line_id, cell_line_name, protein_id, laboratory_name,
      date_performed, protocol_reference, kit_name, kit_manufacturer, instrument,
      wavelength_nm, operator_name, outsourced_lab, concentration_unit,
      control_t1_detail, control_t2_detail, treatment_summaries, observations,
      ic50, characterization, status, provenance, notes, created_at, updated_at,
      created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      studyId,
      record.assayType,
      record.datasetName,
      record.endpointType ?? null,
      record.formulationId ?? null,
      record.compoundId ?? null,
      record.cellLineId ?? null,
      record.cellLineName ?? null,
      record.proteinId ?? null,
      record.laboratoryName,
      record.datePerformed,
      record.protocolReference,
      record.kitName ?? null,
      record.kitManufacturer ?? null,
      record.instrument ?? null,
      record.wavelengthNm ?? null,
      record.operatorName ?? null,
      record.outsourcedLab ? 1 : 0,
      record.concentrationUnit ?? null,
      record.controlT1Detail ?? null,
      record.controlT2Detail ?? null,
      toJson(record.treatmentSummaries),
      toJson(record.observations),
      toJson(record.ic50),
      toJson(record.characterization),
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
    action: "labDataset.create",
    entityType: "labDataset",
    entityId: id,
  })

  return record
}

export async function updateLabDataset(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<LabDatasetInput>
): Promise<LabDataset> {
  const existing = await getLabDataset(studyId, id)
  if (!existing) throw new Error("Dataset not found")

  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?", "updated_by = ?"]
  const params: unknown[] = [now, actor.id]

  if (patch.datasetName !== undefined) {
    fields.push("dataset_name = ?")
    params.push(patch.datasetName)
  }
  if (patch.datePerformed !== undefined) {
    fields.push("date_performed = ?")
    params.push(patch.datePerformed)
  }
  if (patch.protocolReference !== undefined) {
    fields.push("protocol_reference = ?")
    params.push(patch.protocolReference)
  }
  if (patch.laboratoryName !== undefined) {
    fields.push("laboratory_name = ?")
    params.push(patch.laboratoryName)
  }
  if (patch.operatorName !== undefined) {
    fields.push("operator_name = ?")
    params.push(patch.operatorName ?? null)
  }
  if (patch.kitName !== undefined) {
    fields.push("kit_name = ?")
    params.push(patch.kitName ?? null)
  }
  if (patch.kitManufacturer !== undefined) {
    fields.push("kit_manufacturer = ?")
    params.push(patch.kitManufacturer ?? null)
  }
  if (patch.instrument !== undefined) {
    fields.push("instrument = ?")
    params.push(patch.instrument ?? null)
  }
  if (patch.wavelengthNm !== undefined) {
    fields.push("wavelength_nm = ?")
    params.push(patch.wavelengthNm ?? null)
  }
  if (patch.outsourcedLab !== undefined) {
    fields.push("outsourced_lab = ?")
    params.push(patch.outsourcedLab ? 1 : 0)
  }
  if (patch.controlT1Detail !== undefined) {
    fields.push("control_t1_detail = ?")
    params.push(patch.controlT1Detail ?? null)
  }
  if (patch.controlT2Detail !== undefined) {
    fields.push("control_t2_detail = ?")
    params.push(patch.controlT2Detail ?? null)
  }
  if (patch.treatmentSummaries !== undefined) {
    fields.push("treatment_summaries = ?")
    params.push(toJson(patch.treatmentSummaries))
  }
  if (patch.observations !== undefined) {
    fields.push("observations = ?")
    params.push(toJson(patch.observations))
  }
  if (patch.ic50 !== undefined) {
    fields.push("ic50 = ?")
    params.push(toJson(patch.ic50))
  }
  if (patch.characterization !== undefined) {
    fields.push("characterization = ?")
    params.push(toJson(patch.characterization))
  }
  if (patch.status !== undefined) {
    fields.push("status = ?")
    params.push(patch.status)
  }
  if (patch.notes !== undefined) {
    fields.push("notes = ?")
    params.push(patch.notes ?? null)
  }
  if (patch.provenance !== undefined) {
    const evidenceClass = patch.provenance.evidenceClass === "SYNTHETIC" ? "SYNTHETIC" : "EXPERIMENTAL"
    fields.push("provenance = ?")
    params.push(toJson({
      ...existing.provenance,
      ...patch.provenance,
      evidenceClass,
      operatorId: patch.provenance.operatorId || existing.provenance.operatorId,
      recordedAt: patch.provenance.recordedAt || existing.provenance.recordedAt,
    }))
  }

  params.push(studyId, id)
  await execute(`UPDATE laboratory_datasets SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "labDataset.update",
    entityType: "labDataset",
    entityId: id,
  })

  const updated = await getLabDataset(studyId, id)
  if (!updated) throw new Error("Dataset update failed")
  return updated
}

export async function deleteLabDataset(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM laboratory_datasets WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "labDataset.delete",
    entityType: "labDataset",
    entityId: id,
  })
}

// ================= Laboratory Replicates =================

export async function listLabReplicates(studyId: string, datasetId: string): Promise<LabReplicate[]> {
  const rows = await query(
    `SELECT * FROM laboratory_replicates WHERE study_id = ? AND dataset_id = ? ORDER BY treatment_code ASC, replicate_code ASC`,
    [studyId, datasetId]
  )
  return rows.map(mapLabReplicate)
}

export async function saveLabReplicate(
  studyId: string,
  datasetId: string,
  actor: Actor,
  input: LabReplicateInput
): Promise<LabReplicate> {
  const dataset = await getLabDataset(studyId, datasetId)
  if (!dataset) throw new Error("Dataset not found")

  const repCode =
    input.replicateCode ?? (input.replicateN ? replicateCodeFromN(input.replicateN) : "R1")
  const id = `${datasetId}_${input.treatmentCode}_${repCode}`
  const now = new Date().toISOString()

  const record = LabReplicateSchema.parse({
    ...input,
    id,
    datasetId,
    studyId,
    replicateCode: repCode,
    dataClass: "RAW_EXPERIMENTAL",
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO laboratory_replicates (
      id, dataset_id, study_id, treatment_code, replicate_code, replicate_n,
      concentration, concentration_unit, measurements, notes, data_class,
      created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      measurements=VALUES(measurements), concentration=VALUES(concentration), notes=VALUES(notes),
      updated_at=VALUES(updated_at), updated_by=VALUES(updated_by)`,
    [
      record.id,
      record.datasetId,
      record.studyId,
      record.treatmentCode,
      record.replicateCode,
      record.replicateN ?? null,
      record.concentration ?? null,
      record.concentrationUnit ?? null,
      toJson(record.measurements),
      record.notes ?? null,
      record.dataClass,
      record.createdAt,
      record.updatedAt,
      record.createdBy,
      record.updatedBy ?? null,
    ]
  )

  await execute(`UPDATE laboratory_datasets SET updated_at = ?, updated_by = ? WHERE id = ?`, [
    now,
    actor.id,
    datasetId,
  ])

  return record
}

export const createLabReplicate = saveLabReplicate

export async function updateLabReplicate(
  studyId: string,
  datasetId: string,
  replicateId: string,
  actor: Actor,
  input: LabReplicateInput
): Promise<LabReplicate> {
  return saveLabReplicate(studyId, datasetId, actor, input)
}

export async function bulkSaveLabReplicates(
  studyId: string,
  datasetId: string,
  actor: Actor,
  rows: LabReplicateInput[]
): Promise<void> {
  for (const r of rows) {
    await saveLabReplicate(studyId, datasetId, actor, r)
  }
}

export async function deleteLabReplicate(
  studyId: string,
  datasetId: string,
  replicateId: string,
  actor: Actor
): Promise<void> {
  await execute(`DELETE FROM laboratory_replicates WHERE study_id = ? AND dataset_id = ? AND id = ?`, [
    studyId,
    datasetId,
    replicateId,
  ])
  const now = new Date().toISOString()
  await execute(`UPDATE laboratory_datasets SET updated_at = ?, updated_by = ? WHERE id = ?`, [
    now,
    actor.id,
    datasetId,
  ])
}

export async function saveDerivedAssaySummaries(
  studyId: string,
  datasetId: string,
  actor: Actor,
  metric: string
): Promise<void> {
  const [dataset, replicates] = await Promise.all([
    getLabDataset(studyId, datasetId),
    listLabReplicates(studyId, datasetId),
  ])
  if (!dataset) throw new Error("Dataset not found")

  const summaries = summarizeMetricByTreatment(replicates, metric)
  await updateLabDataset(studyId, datasetId, actor, { treatmentSummaries: summaries })
}

export async function saveObservations(
  studyId: string,
  datasetId: string,
  actor: Actor,
  observations: LabDataset["observations"]
): Promise<void> {
  await updateLabDataset(studyId, datasetId, actor, { observations })
}
