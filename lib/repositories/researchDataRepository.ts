"use server"

/**
 * Research-data repository — full CRUD for Formulation, Compounds, Proteins,
 * Cell Lines, and References using MySQL/MariaDB.
 */
import {
  CellLineSchema,
  CompoundSchema,
  FormulationSchema,
  NanoparticleFormulationSchema,
  ProteinSchema,
  ReferenceRecordSchema,
  type CellLineRecord,
  type Compound,
  type Formulation,
  type NanoparticleFormulation,
  type Protein,
  type ReferenceRecord,
} from "@/lib/domain/models"
import { defaultProvenance, type Provenance } from "@/lib/domain/provenance"
import type { EvidenceType } from "@/types/evidence"
import { execute, query, queryOne } from "@/lib/db/mysql"
import {
  mapCellLine,
  mapCompound,
  mapFormulation,
  mapNanoparticleFormulation,
  mapProtein,
  mapReference,
} from "@/lib/repositories/mysqlMappers"
import { writeAuditLog } from "@/lib/repositories/auditRepository"
import { randomUUID } from "crypto"

type Actor = { id: string }

type CreateBody<T> = Omit<
  T,
  "id" | "studyId" | "provenance" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
> & { provenance?: Partial<Provenance> }

function generateDocId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20)
}

function toJson(val: unknown): string | null {
  if (val === undefined || val === null) return null
  return JSON.stringify(val)
}

// ================= Formulations =================

export async function listFormulations(studyId: string): Promise<Formulation[]> {
  const rows = await query(`SELECT * FROM formulations WHERE study_id = ? ORDER BY created_at ASC`, [studyId])
  return rows.map(mapFormulation)
}

export async function getFormulation(studyId: string, id: string): Promise<Formulation | null> {
  const row = await queryOne(`SELECT * FROM formulations WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  return mapFormulation(row)
}

export async function createFormulation(
  studyId: string,
  actor: Actor,
  body: CreateBody<Formulation>
): Promise<Formulation> {
  const id = generateDocId()
  const now = new Date().toISOString()
  const { provenance: provPartial, ...rest } = body
  const record = FormulationSchema.parse({
    ...rest,
    id,
    studyId,
    provenance: defaultProvenance("REFERENCE", {
      ...provPartial,
      operatorId: actor.id,
      recordedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO formulations (
      id, study_id, name, plant_material, scientific_name, components,
      leaf_mass_g, nanocarrier_mass_g, total_mass_g, method_notes,
      storage_notes, marker_compound, marker_compound_id, reference_ids,
      is_canonical, provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.studyId,
      record.name,
      record.plantMaterial ?? null,
      record.scientificName ?? null,
      toJson(record.components),
      record.leafMassG ?? null,
      record.nanocarrierMassG ?? null,
      record.totalMassG ?? null,
      record.methodNotes ?? null,
      record.storageNotes ?? null,
      record.markerCompound ?? null,
      record.markerCompoundId ?? null,
      toJson(record.referenceIds),
      record.isCanonical ? 1 : 0,
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
    action: "formulation.create",
    entityType: "formulation",
    entityId: id,
  })

  return record
}

export async function updateFormulation(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<CreateBody<Formulation>>
): Promise<void> {
  const existing = await getFormulation(studyId, id)
  if (!existing) throw new Error("Formulation not found")
  const now = new Date().toISOString()

  const fields: string[] = ["updated_at = ?", "updated_by = ?"]
  const params: unknown[] = [now, actor.id]

  if (patch.name !== undefined) {
    fields.push("name = ?")
    params.push(patch.name)
  }
  if (patch.plantMaterial !== undefined) {
    fields.push("plant_material = ?")
    params.push(patch.plantMaterial ?? null)
  }
  if (patch.scientificName !== undefined) {
    fields.push("scientific_name = ?")
    params.push(patch.scientificName ?? null)
  }
  if (patch.components !== undefined) {
    fields.push("components = ?")
    params.push(toJson(patch.components))
  }
  if (patch.leafMassG !== undefined) {
    fields.push("leaf_mass_g = ?")
    params.push(patch.leafMassG ?? null)
  }
  if (patch.nanocarrierMassG !== undefined) {
    fields.push("nanocarrier_mass_g = ?")
    params.push(patch.nanocarrierMassG ?? null)
  }
  if (patch.totalMassG !== undefined) {
    fields.push("total_mass_g = ?")
    params.push(patch.totalMassG ?? null)
  }
  if (patch.methodNotes !== undefined) {
    fields.push("method_notes = ?")
    params.push(patch.methodNotes ?? null)
  }
  if (patch.storageNotes !== undefined) {
    fields.push("storage_notes = ?")
    params.push(patch.storageNotes ?? null)
  }
  if (patch.markerCompound !== undefined) {
    fields.push("marker_compound = ?")
    params.push(patch.markerCompound ?? null)
  }
  if (patch.markerCompoundId !== undefined) {
    fields.push("marker_compound_id = ?")
    params.push(patch.markerCompoundId ?? null)
  }
  if (patch.referenceIds !== undefined) {
    fields.push("reference_ids = ?")
    params.push(toJson(patch.referenceIds))
  }
  if (patch.isCanonical !== undefined) {
    fields.push("is_canonical = ?")
    params.push(patch.isCanonical ? 1 : 0)
  }
  if (patch.notes !== undefined) {
    fields.push("notes = ?")
    params.push(patch.notes ?? null)
  }

  params.push(studyId, id)
  await execute(`UPDATE formulations SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "formulation.update",
    entityType: "formulation",
    entityId: id,
  })
}

export async function deleteFormulation(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM formulations WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "formulation.delete",
    entityType: "formulation",
    entityId: id,
  })
}

import { CATALOG_COMPOUNDS, type CatalogCompound } from "@/lib/catalog/reusableResearchCatalog"

// ================= Compounds (Phytochemicals) =================

export async function listGlobalPhytochemicals(): Promise<CatalogCompound[]> {
  try {
    const rows = await query<any>(`
      SELECT * FROM global_phytochemicals 
      ORDER BY CASE WHEN LOWER(id) = 'quercetin' OR LOWER(name) = 'quercetin' THEN 0 ELSE 1 END, name ASC
    `)
    if (rows && rows.length > 0) {
      return rows.map((r: any) => ({
        key: r.id,
        name: r.name,
        pubchemCid: r.pubchem_cid ?? undefined,
        smiles: r.smiles ?? undefined,
        formula: r.formula ?? undefined,
        molecularWeight: r.molecular_weight ?? undefined,
        chemicalClass: r.chemical_class ?? undefined,
        plantPart: r.plant_part ?? undefined,
        filter: (r.filter_category as any) ?? undefined,
        source: r.source ?? undefined,
        notes: r.notes ?? undefined,
      }))
    }
  } catch {
    // Fall back to CATALOG_COMPOUNDS
  }
  return CATALOG_COMPOUNDS
}

export async function listCompounds(studyId: string): Promise<Compound[]> {
  const rows = await query(`SELECT * FROM phytochemicals WHERE study_id = ? ORDER BY created_at ASC`, [studyId])
  return rows.map(mapCompound)
}

export async function getCompound(studyId: string, id: string): Promise<Compound | null> {
  const row = await queryOne(`SELECT * FROM phytochemicals WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  return mapCompound(row)
}

export async function createCompound(
  studyId: string,
  actor: Actor,
  body: CreateBody<Compound>
): Promise<Compound> {
  const id = generateDocId()
  const now = new Date().toISOString()
  const { provenance: provPartial, ...rest } = body
  const record = CompoundSchema.parse({
    ...rest,
    id,
    studyId,
    provenance: defaultProvenance("REFERENCE", {
      ...provPartial,
      operatorId: actor.id,
      recordedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO phytochemicals (
      id, study_id, name, pubchem_cid, smiles, isomeric_smiles, formula,
      molecular_weight, chemical_class, plant_part, source, is_primary_marker,
      reference_ids, screening_reviewed_at, provenance, notes, created_at, updated_at,
      created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.studyId,
      record.name,
      record.pubchemCid ?? null,
      record.smiles ?? null,
      record.isomericSmiles ?? null,
      record.formula ?? null,
      record.molecularWeight ?? null,
      record.chemicalClass ?? null,
      record.plantPart ?? null,
      record.source ?? null,
      record.isPrimaryMarker ? 1 : 0,
      toJson(record.referenceIds),
      record.screeningReviewedAt ?? null,
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
    action: "compound.create",
    entityType: "compound",
    entityId: id,
  })

  return record
}

export async function updateCompound(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<CreateBody<Compound>>
): Promise<void> {
  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?", "updated_by = ?"]
  const params: unknown[] = [now, actor.id]

  if (patch.name !== undefined) {
    fields.push("name = ?")
    params.push(patch.name)
  }
  if (patch.pubchemCid !== undefined) {
    fields.push("pubchem_cid = ?")
    params.push(patch.pubchemCid ?? null)
  }
  if (patch.smiles !== undefined) {
    fields.push("smiles = ?")
    params.push(patch.smiles ?? null)
  }
  if (patch.isomericSmiles !== undefined) {
    fields.push("isomeric_smiles = ?")
    params.push(patch.isomericSmiles ?? null)
  }
  if (patch.formula !== undefined) {
    fields.push("formula = ?")
    params.push(patch.formula ?? null)
  }
  if (patch.molecularWeight !== undefined) {
    fields.push("molecular_weight = ?")
    params.push(patch.molecularWeight ?? null)
  }
  if (patch.chemicalClass !== undefined) {
    fields.push("chemical_class = ?")
    params.push(patch.chemicalClass ?? null)
  }
  if (patch.plantPart !== undefined) {
    fields.push("plant_part = ?")
    params.push(patch.plantPart ?? null)
  }
  if (patch.source !== undefined) {
    fields.push("source = ?")
    params.push(patch.source ?? null)
  }
  if (patch.isPrimaryMarker !== undefined) {
    fields.push("is_primary_marker = ?")
    params.push(patch.isPrimaryMarker ? 1 : 0)
  }
  if (patch.referenceIds !== undefined) {
    fields.push("reference_ids = ?")
    params.push(toJson(patch.referenceIds))
  }
  if (patch.screeningReviewedAt !== undefined) {
    fields.push("screening_reviewed_at = ?")
    params.push(patch.screeningReviewedAt ?? null)
  }
  if (patch.notes !== undefined) {
    fields.push("notes = ?")
    params.push(patch.notes ?? null)
  }

  params.push(studyId, id)
  await execute(`UPDATE phytochemicals SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "compound.update",
    entityType: "compound",
    entityId: id,
  })
}

export async function deleteCompound(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM phytochemicals WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "compound.delete",
    entityType: "compound",
    entityId: id,
  })
}

// ================= Proteins =================

export async function listProteins(studyId: string): Promise<Protein[]> {
  const rows = await query(`SELECT * FROM target_proteins WHERE study_id = ? ORDER BY created_at ASC`, [studyId])
  return rows.map(mapProtein)
}

export async function getProtein(studyId: string, id: string): Promise<Protein | null> {
  const row = await queryOne(`SELECT * FROM target_proteins WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  return mapProtein(row)
}

export async function createProtein(
  studyId: string,
  actor: Actor,
  body: CreateBody<Protein>
): Promise<Protein> {
  const id = generateDocId()
  const now = new Date().toISOString()
  const { provenance: provPartial, ...rest } = body
  const record = ProteinSchema.parse({
    ...rest,
    id,
    studyId,
    provenance: defaultProvenance("REFERENCE", {
      ...provPartial,
      operatorId: actor.id,
      recordedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO target_proteins (
      id, study_id, name, gene, gene_symbol, protein_name, biological_target,
      pdb_id, pathway, role, function_notes, source, structure_title,
      structure_protein, structure_context, organism, chains, uniprot_ids,
      expected_title, expected_method, expected_resolution, expected_entities,
      verification_source, reference_ids, provenance, notes, created_at, updated_at,
      created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.studyId,
      record.name,
      record.gene ?? null,
      record.geneSymbol ?? null,
      record.proteinName ?? null,
      record.biologicalTarget ?? null,
      record.pdbId ?? null,
      record.pathway ?? null,
      record.role ?? null,
      record.functionNotes ?? null,
      record.source ?? null,
      record.structureTitle ?? null,
      record.structureProtein ?? null,
      record.structureContext ?? null,
      record.organism ?? null,
      toJson(record.chains),
      toJson(record.uniprotIds),
      record.expectedTitle ?? null,
      record.expectedMethod ?? null,
      record.expectedResolution ?? null,
      toJson(record.expectedEntities),
      record.verificationSource ?? null,
      toJson(record.referenceIds),
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
    action: "protein.create",
    entityType: "protein",
    entityId: id,
  })

  return record
}

export async function updateProtein(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<CreateBody<Protein>>
): Promise<void> {
  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?", "updated_by = ?"]
  const params: unknown[] = [now, actor.id]

  if (patch.name !== undefined) {
    fields.push("name = ?")
    params.push(patch.name)
  }
  if (patch.gene !== undefined) {
    fields.push("gene = ?")
    params.push(patch.gene ?? null)
  }
  if (patch.geneSymbol !== undefined) {
    fields.push("gene_symbol = ?")
    params.push(patch.geneSymbol ?? null)
  }
  if (patch.proteinName !== undefined) {
    fields.push("protein_name = ?")
    params.push(patch.proteinName ?? null)
  }
  if (patch.biologicalTarget !== undefined) {
    fields.push("biological_target = ?")
    params.push(patch.biologicalTarget ?? null)
  }
  if (patch.pdbId !== undefined) {
    fields.push("pdb_id = ?")
    params.push(patch.pdbId ?? null)
  }
  if (patch.pathway !== undefined) {
    fields.push("pathway = ?")
    params.push(patch.pathway ?? null)
  }
  if (patch.role !== undefined) {
    fields.push("role = ?")
    params.push(patch.role ?? null)
  }
  if (patch.functionNotes !== undefined) {
    fields.push("function_notes = ?")
    params.push(patch.functionNotes ?? null)
  }
  if (patch.source !== undefined) {
    fields.push("source = ?")
    params.push(patch.source ?? null)
  }
  if (patch.structureTitle !== undefined) {
    fields.push("structure_title = ?")
    params.push(patch.structureTitle ?? null)
  }
  if (patch.structureProtein !== undefined) {
    fields.push("structure_protein = ?")
    params.push(patch.structureProtein ?? null)
  }
  if (patch.structureContext !== undefined) {
    fields.push("structure_context = ?")
    params.push(patch.structureContext ?? null)
  }
  if (patch.organism !== undefined) {
    fields.push("organism = ?")
    params.push(patch.organism ?? null)
  }
  if (patch.chains !== undefined) {
    fields.push("chains = ?")
    params.push(toJson(patch.chains))
  }
  if (patch.uniprotIds !== undefined) {
    fields.push("uniprot_ids = ?")
    params.push(toJson(patch.uniprotIds))
  }
  if (patch.expectedTitle !== undefined) {
    fields.push("expected_title = ?")
    params.push(patch.expectedTitle ?? null)
  }
  if (patch.expectedMethod !== undefined) {
    fields.push("expected_method = ?")
    params.push(patch.expectedMethod ?? null)
  }
  if (patch.expectedResolution !== undefined) {
    fields.push("expected_resolution = ?")
    params.push(patch.expectedResolution ?? null)
  }
  if (patch.expectedEntities !== undefined) {
    fields.push("expected_entities = ?")
    params.push(toJson(patch.expectedEntities))
  }
  if (patch.verificationSource !== undefined) {
    fields.push("verification_source = ?")
    params.push(patch.verificationSource ?? null)
  }
  if (patch.referenceIds !== undefined) {
    fields.push("reference_ids = ?")
    params.push(toJson(patch.referenceIds))
  }
  if (patch.notes !== undefined) {
    fields.push("notes = ?")
    params.push(patch.notes ?? null)
  }

  params.push(studyId, id)
  await execute(`UPDATE target_proteins SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "protein.update",
    entityType: "protein",
    entityId: id,
  })
}

export async function deleteProtein(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM target_proteins WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "protein.delete",
    entityType: "protein",
    entityId: id,
  })
}

// ================= Cell Lines =================

export async function listCellLines(studyId: string): Promise<CellLineRecord[]> {
  const rows = await query(`SELECT * FROM cell_lines WHERE study_id = ? ORDER BY created_at ASC`, [studyId])
  return rows.map(mapCellLine)
}

export async function getCellLine(studyId: string, id: string): Promise<CellLineRecord | null> {
  const row = await queryOne(`SELECT * FROM cell_lines WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  return mapCellLine(row)
}

export async function createCellLine(
  studyId: string,
  actor: Actor,
  body: CreateBody<CellLineRecord>
): Promise<CellLineRecord> {
  const id = generateDocId()
  const now = new Date().toISOString()
  const { provenance: provPartial, ...rest } = body
  const record = CellLineSchema.parse({
    ...rest,
    id,
    studyId,
    provenance: defaultProvenance("REFERENCE", {
      ...provPartial,
      operatorId: actor.id,
      recordedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO cell_lines (
      id, study_id, name, full_name, organism, tissue_origin, disease_context,
      line_type, p53_status, hbv_status, source_database, is_primary_experimental,
      reference_ids, provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.studyId,
      record.name,
      record.fullName ?? null,
      record.organism ?? null,
      record.tissueOrigin ?? null,
      record.diseaseContext ?? null,
      record.lineType,
      record.p53Status ?? null,
      record.hbvStatus ?? null,
      record.sourceDatabase ?? null,
      record.isPrimaryExperimental ? 1 : 0,
      toJson(record.referenceIds),
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
    action: "cellLine.create",
    entityType: "cellLine",
    entityId: id,
  })

  return record
}

export async function updateCellLine(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<CreateBody<CellLineRecord>>
): Promise<void> {
  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?", "updated_by = ?"]
  const params: unknown[] = [now, actor.id]

  if (patch.name !== undefined) {
    fields.push("name = ?")
    params.push(patch.name)
  }
  if (patch.fullName !== undefined) {
    fields.push("full_name = ?")
    params.push(patch.fullName ?? null)
  }
  if (patch.organism !== undefined) {
    fields.push("organism = ?")
    params.push(patch.organism ?? null)
  }
  if (patch.tissueOrigin !== undefined) {
    fields.push("tissue_origin = ?")
    params.push(patch.tissueOrigin ?? null)
  }
  if (patch.diseaseContext !== undefined) {
    fields.push("disease_context = ?")
    params.push(patch.diseaseContext ?? null)
  }
  if (patch.lineType !== undefined) {
    fields.push("line_type = ?")
    params.push(patch.lineType)
  }
  if (patch.p53Status !== undefined) {
    fields.push("p53_status = ?")
    params.push(patch.p53Status ?? null)
  }
  if (patch.hbvStatus !== undefined) {
    fields.push("hbv_status = ?")
    params.push(patch.hbvStatus ?? null)
  }
  if (patch.sourceDatabase !== undefined) {
    fields.push("source_database = ?")
    params.push(patch.sourceDatabase ?? null)
  }
  if (patch.isPrimaryExperimental !== undefined) {
    fields.push("is_primary_experimental = ?")
    params.push(patch.isPrimaryExperimental ? 1 : 0)
  }
  if (patch.referenceIds !== undefined) {
    fields.push("reference_ids = ?")
    params.push(toJson(patch.referenceIds))
  }
  if (patch.notes !== undefined) {
    fields.push("notes = ?")
    params.push(patch.notes ?? null)
  }

  params.push(studyId, id)
  await execute(`UPDATE cell_lines SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "cellLine.update",
    entityType: "cellLine",
    entityId: id,
  })
}

export async function deleteCellLine(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM cell_lines WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "cellLine.delete",
    entityType: "cellLine",
    entityId: id,
  })
}

// ================= References =================

export async function listReferences(studyId: string): Promise<ReferenceRecord[]> {
  const rows = await query(`SELECT * FROM \`references\` WHERE study_id = ? ORDER BY created_at ASC`, [studyId])
  return rows.map(mapReference)
}

export async function getReference(studyId: string, id: string): Promise<ReferenceRecord | null> {
  const row = await queryOne(`SELECT * FROM \`references\` WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  return mapReference(row)
}

export async function createReference(
  studyId: string,
  actor: Actor,
  body: CreateBody<ReferenceRecord>
): Promise<ReferenceRecord> {
  const id = generateDocId()
  const now = new Date().toISOString()
  const { provenance: provPartial, ...rest } = body
  const record = ReferenceRecordSchema.parse({
    ...rest,
    id,
    studyId,
    provenance: defaultProvenance("LITERATURE", {
      ...provPartial,
      operatorId: actor.id,
      recordedAt: now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO \`references\` (
      id, study_id, title, authors, year, journal, doi, pmid, url,
      retrieved_at, citation_text, provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.studyId,
      record.title,
      record.authors ?? null,
      record.year ?? null,
      record.journal ?? null,
      record.doi ?? null,
      record.pmid ?? null,
      record.url ?? null,
      record.retrievedAt ?? null,
      record.citationText ?? null,
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
    action: "reference.create",
    entityType: "reference",
    entityId: id,
  })

  return record
}

export async function updateReference(
  studyId: string,
  id: string,
  actor: Actor,
  patch: Partial<CreateBody<ReferenceRecord>>
): Promise<void> {
  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?", "updated_by = ?"]
  const params: unknown[] = [now, actor.id]

  if (patch.title !== undefined) {
    fields.push("title = ?")
    params.push(patch.title)
  }
  if (patch.authors !== undefined) {
    fields.push("authors = ?")
    params.push(patch.authors ?? null)
  }
  if (patch.year !== undefined) {
    fields.push("year = ?")
    params.push(patch.year ?? null)
  }
  if (patch.journal !== undefined) {
    fields.push("journal = ?")
    params.push(patch.journal ?? null)
  }
  if (patch.doi !== undefined) {
    fields.push("doi = ?")
    params.push(patch.doi ?? null)
  }
  if (patch.pmid !== undefined) {
    fields.push("pmid = ?")
    params.push(patch.pmid ?? null)
  }
  if (patch.url !== undefined) {
    fields.push("url = ?")
    params.push(patch.url ?? null)
  }
  if (patch.retrievedAt !== undefined) {
    fields.push("retrieved_at = ?")
    params.push(patch.retrievedAt ?? null)
  }
  if (patch.citationText !== undefined) {
    fields.push("citation_text = ?")
    params.push(patch.citationText ?? null)
  }
  if (patch.notes !== undefined) {
    fields.push("notes = ?")
    params.push(patch.notes ?? null)
  }

  params.push(studyId, id)
  await execute(`UPDATE \`references\` SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "reference.update",
    entityType: "reference",
    entityId: id,
  })
}

export async function deleteReference(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM \`references\` WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "reference.delete",
    entityType: "reference",
    entityId: id,
  })
}

// ================= Nanoparticle Formulations =================

export async function getNanoparticleFormulation(studyId: string): Promise<NanoparticleFormulation | null> {
  const row = await queryOne(`SELECT * FROM nanoparticle_formulations WHERE study_id = ? ORDER BY created_at ASC LIMIT 1`, [studyId])
  if (!row) return null
  return mapNanoparticleFormulation(row)
}

export async function saveNanoparticleFormulation(
  studyId: string,
  actor: Actor,
  data: Partial<NanoparticleFormulation>
): Promise<NanoparticleFormulation> {
  const existing = await queryOne<any>(`SELECT id FROM nanoparticle_formulations WHERE study_id = ? LIMIT 1`, [studyId])
  const now = new Date().toISOString()

  if (existing) {
    const id = existing.id
    const fields: string[] = [
      "system_name = ?",
      "carrier_type = ?",
      "record_type = ?",
      "chitosan_concentration = ?",
      "chitosan_concentration_unit = ?",
      "chitosan_molecular_weight = ?",
      "chitosan_mw_unit = ?",
      "chitosan_molecular_weight = ?",
      "chitosan_deacetylation_degree = ?",
      "chitosan_solvent = ?",
      "chitosan_ph = ?",
      "tpp_concentration = ?",
      "tpp_concentration_unit = ?",
      "tpp_ph = ?",
      "chitosan_tpp_ratio = ?",
      "mixing_method = ?",
      "addition_method = ?",
      "stirring_rate = ?",
      "stirring_duration = ?",
      "temperature = ?",
      "preparation_notes = ?",
      "particle_size_nm = ?",
      "pdi = ?",
      "zeta_potential_mv = ?",
      "encapsulation_efficiency_percent = ?",
      "loading_capacity_percent = ?",
      "instrument = ?",
      "measurement_method = ?",
      "experiment_date = ?",
      "researcher = ?",
      "sample_batch_id = ?",
      "characterization_notes = ?",
      "computational_status = ?",
      "computational_notes = ?",
      "provenance = ?",
      "reference_ids = ?",
      "updated_at = ?",
      "updated_by = ?",
    ]
    const params = [
      data.systemName ?? "Chitosan–TPP Nanoparticle System",
      data.carrierType ?? "chitosan_tpp",
      data.recordType ?? "research",
      data.chitosanConcentration ?? null,
      data.chitosanConcentrationUnit ?? "mg/mL",
      data.chitosanMolecularWeight ?? null,
      data.chitosanMwUnit ?? "kDa",
      data.chitosanDeacetylationDegree ?? null,
      data.chitosanSolvent ?? null,
      data.chitosanPh ?? null,
      data.tppConcentration ?? null,
      data.tppConcentrationUnit ?? "mg/mL",
      data.tppPh ?? null,
      data.chitosanTppRatio ?? null,
      data.mixingMethod ?? null,
      data.additionMethod ?? null,
      data.stirringRate ?? null,
      data.stirringDuration ?? null,
      data.temperature ?? null,
      data.preparationNotes ?? null,
      data.particleSizeNm ?? null,
      data.pdi ?? null,
      data.zetaPotentialMv ?? null,
      data.encapsulationEfficiencyPercent ?? null,
      data.loadingCapacityPercent ?? null,
      data.instrument ?? null,
      data.measurementMethod ?? null,
      data.experimentDate ?? null,
      data.researcher ?? null,
      data.sampleBatchId ?? null,
      data.characterizationNotes ?? null,
      data.computationalStatus ?? "not_configured",
      data.computationalNotes ?? null,
      toJson(data.provenance ?? defaultProvenance("REFERENCE", { source: "Study protocol" })),
      toJson(data.referenceIds ?? []),
      now,
      actor.id,
      studyId,
      id,
    ]

    await execute(`UPDATE nanoparticle_formulations SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)
    await writeAuditLog({
      studyId,
      actorId: actor.id,
      action: "nanoparticle_formulation.update",
      entityType: "nanoparticle_formulation",
      entityId: id,
    })
    const updated = await getNanoparticleFormulation(studyId)
    return updated!
  } else {
    const id = generateDocId()
    const record = NanoparticleFormulationSchema.parse({
      id,
      studyId,
      systemName: data.systemName ?? "Chitosan–TPP Nanoparticle System",
      carrierType: data.carrierType ?? "chitosan_tpp",
      chitosanConcentration: data.chitosanConcentration ?? null,
      chitosanMolecularWeight: data.chitosanMolecularWeight ?? null,
      chitosanDeacetylationDegree: data.chitosanDeacetylationDegree ?? null,
      chitosanSolvent: data.chitosanSolvent ?? null,
      chitosanPh: data.chitosanPh ?? null,
      tppConcentration: data.tppConcentration ?? null,
      tppPh: data.tppPh ?? null,
      chitosanTppRatio: data.chitosanTppRatio ?? null,
      mixingMethod: data.mixingMethod ?? null,
      additionMethod: data.additionMethod ?? null,
      stirringRate: data.stirringRate ?? null,
      stirringDuration: data.stirringDuration ?? null,
      temperature: data.temperature ?? null,
      preparationNotes: data.preparationNotes ?? null,
      particleSizeNm: data.particleSizeNm ?? null,
      pdi: data.pdi ?? null,
      zetaPotentialMv: data.zetaPotentialMv ?? null,
      encapsulationEfficiencyPercent: data.encapsulationEfficiencyPercent ?? null,
      loadingCapacityPercent: data.loadingCapacityPercent ?? null,
      characterizationNotes: data.characterizationNotes ?? null,
      computationalStatus: data.computationalStatus ?? "not_configured",
      computationalNotes: data.computationalNotes ?? null,
      provenance: data.provenance ?? defaultProvenance("REFERENCE", { source: "Study protocol" }),
      referenceIds: data.referenceIds ?? [],
      createdAt: now,
      updatedAt: now,
      createdBy: actor.id,
      updatedBy: actor.id,
    })

    await execute(
      `INSERT INTO nanoparticle_formulations (
        id, study_id, system_name, carrier_type, record_type,
        chitosan_concentration, chitosan_concentration_unit, chitosan_molecular_weight, chitosan_mw_unit, chitosan_deacetylation_degree, chitosan_solvent, chitosan_ph,
        tpp_concentration, tpp_concentration_unit, tpp_ph,
        chitosan_tpp_ratio, mixing_method, addition_method, stirring_rate, stirring_duration, temperature, preparation_notes,
        particle_size_nm, pdi, zeta_potential_mv, encapsulation_efficiency_percent, loading_capacity_percent,
        instrument, measurement_method, experiment_date, researcher, sample_batch_id, characterization_notes,
        computational_status, computational_notes,
        provenance, reference_ids, created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.studyId,
        record.systemName,
        record.carrierType,
        record.recordType,
        record.chitosanConcentration,
        record.chitosanConcentrationUnit,
        record.chitosanMolecularWeight,
        record.chitosanMwUnit,
        record.chitosanDeacetylationDegree,
        record.chitosanSolvent,
        record.chitosanPh,
        record.tppConcentration,
        record.tppConcentrationUnit,
        record.tppPh,
        record.chitosanTppRatio,
        record.mixingMethod,
        record.additionMethod,
        record.stirringRate,
        record.stirringDuration,
        record.temperature,
        record.preparationNotes,
        record.particleSizeNm,
        record.pdi,
        record.zetaPotentialMv,
        record.encapsulationEfficiencyPercent,
        record.loadingCapacityPercent,
        record.instrument,
        record.measurementMethod,
        record.experimentDate,
        record.researcher,
        record.sampleBatchId,
        record.characterizationNotes,
        record.computationalStatus,
        record.computationalNotes,
        toJson(record.provenance),
        toJson(record.referenceIds),
        record.createdAt,
        record.updatedAt,
        record.createdBy,
        record.updatedBy,
      ]
    )

    await writeAuditLog({
      studyId,
      actorId: actor.id,
      action: "nanoparticle_formulation.create",
      entityType: "nanoparticle_formulation",
      entityId: id,
    })

    return record
  }
}

export async function deleteNanoparticleFormulation(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM nanoparticle_formulations WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "nanoparticle_formulation.delete",
    entityType: "nanoparticle_formulation",
    entityId: id,
  })
}
