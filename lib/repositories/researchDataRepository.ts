/**
 * Research-data repository — full CRUD for Formulation, Compounds, Proteins,
 * Cell Lines, and References. No legacy demo-value migration.
 */
import {
  CellLineSchema,
  CompoundSchema,
  FormulationSchema,
  ProteinSchema,
  ReferenceRecordSchema,
  type CellLineRecord,
  type Compound,
  type Formulation,
  type Protein,
  type ReferenceRecord,
} from "@/lib/domain/models"
import { defaultProvenance, type Provenance } from "@/lib/domain/provenance"
import type { EvidenceType } from "@/types/evidence"
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

type Actor = { id: string }

type CreateBody<T> = Omit<
  T,
  "id" | "studyId" | "provenance" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
> & { provenance?: Partial<Provenance> }

async function createEnvelope<T extends { id: string }>(
  studyId: string,
  sub: string,
  actor: Actor,
  evidenceClass: EvidenceType,
  body: CreateBody<T>,
  parse: (v: unknown) => T,
  entityType: string
): Promise<T> {
  const ref = docRef(studySub(studyId, sub))
  const now = new Date().toISOString()
  const { provenance: provPartial, ...rest } = body
  const record = parse({
    ...rest,
    id: ref.id,
    studyId,
    provenance: defaultProvenance(evidenceClass, {
      ...provPartial,
      operatorId: actor.id,
      recordedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })
  await setDocData(studySub(studyId, sub), ref.id, record)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: `${entityType}.create`,
    entityType,
    entityId: ref.id,
  })
  return record
}

async function updateEnvelope(
  studyId: string,
  sub: string,
  id: string,
  actor: Actor,
  patch: Record<string, unknown>,
  entityType: string
) {
  const cleaned = Object.fromEntries(
    Object.entries(patch).filter(
      ([k, v]) =>
        v !== undefined && !["id", "studyId", "createdAt", "createdBy"].includes(k)
    )
  )
  await updateDocData(studySub(studyId, sub), id, {
    ...cleaned,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.id,
  })
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: `${entityType}.update`,
    entityType,
    entityId: id,
  })
}

async function deleteEnvelope(
  studyId: string,
  sub: string,
  id: string,
  actor: Actor,
  entityType: string
) {
  await deleteDocData(studySub(studyId, sub), id)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: `${entityType}.delete`,
    entityType,
    entityId: id,
  })
}

// ── Formulation ───────────────────────────────────────────────────────────────

export async function createFormulation(
  studyId: string,
  actor: Actor,
  input: CreateBody<Formulation> & { leafMassG: number; nanocarrierMassG: number; name: string }
): Promise<Formulation> {
  return createEnvelope(
    studyId,
    STUDY_SUBCOLLECTIONS.formulations,
    actor,
    "REFERENCE",
    {
      ...input,
      totalMassG: input.totalMassG ?? input.leafMassG + input.nanocarrierMassG,
      referenceIds: input.referenceIds ?? [],
      isCanonical: input.isCanonical ?? false,
    },
    (v) => FormulationSchema.parse(v),
    "formulation"
  )
}

export async function listFormulations(studyId: string): Promise<Formulation[]> {
  return (await listDocs<Formulation>(studySub(studyId, STUDY_SUBCOLLECTIONS.formulations))).map((r) =>
    FormulationSchema.parse(r)
  )
}

export async function getFormulation(studyId: string, id: string) {
  const raw = await getDocData<Formulation>(studySub(studyId, STUDY_SUBCOLLECTIONS.formulations), id)
  return raw ? FormulationSchema.parse(raw) : null
}

export async function updateFormulation(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<Formulation>
) {
  const next = { ...patch }
  if (patch.leafMassG != null && patch.nanocarrierMassG != null) {
    next.totalMassG = patch.leafMassG + patch.nanocarrierMassG
  }
  await updateEnvelope(studyId, STUDY_SUBCOLLECTIONS.formulations, id, actor, next, "formulation")
}

export async function deleteFormulation(studyId: string, id: string, actor: Actor) {
  await deleteEnvelope(studyId, STUDY_SUBCOLLECTIONS.formulations, id, actor, "formulation")
}

// ── Compounds ─────────────────────────────────────────────────────────────────

export async function createCompound(
  studyId: string,
  actor: Actor,
  input: CreateBody<Compound> & { name: string; evidenceClass?: EvidenceType }
): Promise<Compound> {
  const { evidenceClass = "REFERENCE", ...rest } = input
  return createEnvelope(
    studyId,
    STUDY_SUBCOLLECTIONS.compounds,
    actor,
    evidenceClass,
    { ...rest, referenceIds: rest.referenceIds ?? [], isPrimaryMarker: rest.isPrimaryMarker ?? false },
    (v) => CompoundSchema.parse(v),
    "compound"
  )
}

export async function listCompounds(studyId: string): Promise<Compound[]> {
  return (await listDocs<Compound>(studySub(studyId, STUDY_SUBCOLLECTIONS.compounds))).map((r) =>
    CompoundSchema.parse(r)
  )
}

export async function getCompound(studyId: string, id: string) {
  const raw = await getDocData<Compound>(studySub(studyId, STUDY_SUBCOLLECTIONS.compounds), id)
  return raw ? CompoundSchema.parse(raw) : null
}

export async function updateCompound(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<Compound>
) {
  await updateEnvelope(studyId, STUDY_SUBCOLLECTIONS.compounds, id, actor, patch, "compound")
}

export async function deleteCompound(studyId: string, id: string, actor: Actor) {
  await deleteEnvelope(studyId, STUDY_SUBCOLLECTIONS.compounds, id, actor, "compound")
}

// ── Proteins ──────────────────────────────────────────────────────────────────

export async function createProtein(
  studyId: string,
  actor: Actor,
  input: CreateBody<Protein> & { name: string }
): Promise<Protein> {
  return createEnvelope(
    studyId,
    STUDY_SUBCOLLECTIONS.proteins,
    actor,
    "REFERENCE",
    { ...input, referenceIds: input.referenceIds ?? [] },
    (v) => ProteinSchema.parse(v),
    "protein"
  )
}

export async function listProteins(studyId: string): Promise<Protein[]> {
  return (await listDocs<Protein>(studySub(studyId, STUDY_SUBCOLLECTIONS.proteins))).map((r) =>
    ProteinSchema.parse(r)
  )
}

export async function getProtein(studyId: string, id: string) {
  const raw = await getDocData<Protein>(studySub(studyId, STUDY_SUBCOLLECTIONS.proteins), id)
  return raw ? ProteinSchema.parse(raw) : null
}

export async function updateProtein(studyId: string, id: string, actor: Actor, patch: Partial<Protein>) {
  await updateEnvelope(studyId, STUDY_SUBCOLLECTIONS.proteins, id, actor, patch, "protein")
}

export async function deleteProtein(studyId: string, id: string, actor: Actor) {
  await deleteEnvelope(studyId, STUDY_SUBCOLLECTIONS.proteins, id, actor, "protein")
}

// ── Cell lines ────────────────────────────────────────────────────────────────

export async function createCellLine(
  studyId: string,
  actor: Actor,
  input: CreateBody<CellLineRecord> & { name: string }
): Promise<CellLineRecord> {
  return createEnvelope(
    studyId,
    STUDY_SUBCOLLECTIONS.cellLines,
    actor,
    "REFERENCE",
    {
      ...input,
      referenceIds: input.referenceIds ?? [],
      isPrimaryExperimental: input.isPrimaryExperimental ?? false,
      lineType: input.lineType ?? "cancer",
    },
    (v) => CellLineSchema.parse(v),
    "cellLine"
  )
}

export async function listCellLines(studyId: string): Promise<CellLineRecord[]> {
  return (await listDocs<CellLineRecord>(studySub(studyId, STUDY_SUBCOLLECTIONS.cellLines))).map((r) =>
    CellLineSchema.parse(r)
  )
}

export async function getCellLine(studyId: string, id: string) {
  const raw = await getDocData<CellLineRecord>(studySub(studyId, STUDY_SUBCOLLECTIONS.cellLines), id)
  return raw ? CellLineSchema.parse(raw) : null
}

export async function updateCellLine(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<CellLineRecord>
) {
  await updateEnvelope(studyId, STUDY_SUBCOLLECTIONS.cellLines, id, actor, patch, "cellLine")
}

export async function deleteCellLine(studyId: string, id: string, actor: Actor) {
  await deleteEnvelope(studyId, STUDY_SUBCOLLECTIONS.cellLines, id, actor, "cellLine")
}

// ── References ────────────────────────────────────────────────────────────────

export async function createReference(
  studyId: string,
  actor: Actor,
  input: CreateBody<ReferenceRecord> & { title: string }
): Promise<ReferenceRecord> {
  return createEnvelope(
    studyId,
    STUDY_SUBCOLLECTIONS.references,
    actor,
    "LITERATURE",
    input,
    (v) => ReferenceRecordSchema.parse(v),
    "reference"
  )
}

export async function listReferences(studyId: string): Promise<ReferenceRecord[]> {
  return (await listDocs<ReferenceRecord>(studySub(studyId, STUDY_SUBCOLLECTIONS.references))).map((r) =>
    ReferenceRecordSchema.parse(r)
  )
}

export async function getReference(studyId: string, id: string) {
  const raw = await getDocData<ReferenceRecord>(studySub(studyId, STUDY_SUBCOLLECTIONS.references), id)
  return raw ? ReferenceRecordSchema.parse(raw) : null
}

export async function updateReference(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<ReferenceRecord>
) {
  await updateEnvelope(studyId, STUDY_SUBCOLLECTIONS.references, id, actor, patch, "reference")
}

export async function deleteReference(studyId: string, id: string, actor: Actor) {
  await deleteEnvelope(studyId, STUDY_SUBCOLLECTIONS.references, id, actor, "reference")
}
