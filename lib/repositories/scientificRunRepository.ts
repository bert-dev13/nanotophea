"use server"

/**
 * Scientific run repository — ADMET, docking, prediction runs using MySQL/MariaDB.
 * Preserves canonical DockingPair uniqueness (study_id + compound_id + protein_id)
 * and 1-to-many DockingRun history.
 */
import {
  PROTOTYPE_ADME_NOTICE,
  PROTOTYPE_ADME_PROVIDER,
  PROTOTYPE_ADME_SUBTITLE,
  PROTOTYPE_ADME_VERSION,
} from "@/lib/adme/assessmentService"
import {
  AdmetRunSchema,
  canonicalDockingPairDocId,
  DockingPairSchema,
  DockingRunInputSchema,
  DockingRunSchema,
  DOCKING_SKIP_REASON,
  PredictionRunInputSchema,
  PredictionRunSchema,
  SkippedDockingPairSchema,
  type AdmetRun,
  type DockingPair,
  type DockingRun,
  type DockingRunInput,
  type SkippedDockingPair,
  type PredictionEndpoint,
  type PredictionRun,
  type PredictionRunInput,
} from "@/lib/domain/models"
import { resolveAdmetEvidenceClass } from "@/lib/domain/admetEvidence"
import { defaultProvenance } from "@/lib/domain/provenance"
import { execute, query, queryOne, transaction } from "@/lib/db/mysql"
import {
  mapAdmetRun,
  mapDockingPair,
  mapDockingRun,
  mapPredictionRun,
  parseJson,
} from "@/lib/repositories/mysqlMappers"
import { writeAuditLog } from "@/lib/repositories/auditRepository"
import {
  getCellLine,
  getCompound,
  getProtein,
} from "@/lib/repositories/researchDataRepository"
import { randomUUID } from "crypto"

type Actor = { id: string }

function toJson(val: unknown): string | null {
  if (val === undefined || val === null) return null
  return JSON.stringify(val)
}

function generateDocId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20)
}

// ================= ADMET / In-Silico Screening =================

export async function createAdmetRun(
  studyId: string,
  actor: Actor,
  input: Partial<AdmetRun> & { compoundName?: string }
): Promise<AdmetRun> {
  const id = generateDocId()
  const now = new Date().toISOString()
  const evidenceClass = resolveAdmetEvidenceClass(input.provenance)
  const record = AdmetRunSchema.parse({
    id,
    studyId,
    compoundId: input.compoundId,
    compoundName: input.compoundName,
    toolName: input.toolName,
    toolVersion: input.toolVersion,
    descriptors: input.descriptors ?? {},
    status: input.status ?? "draft",
    notes: input.notes,
    provenance: defaultProvenance(evidenceClass, {
      operatorId: actor.id,
      methodName: input.toolName ?? input.provenance?.methodName,
      methodVersion: input.toolVersion ?? input.provenance?.methodVersion,
      source: input.provenance?.source,
      citation: input.provenance?.citation,
      retrievedAt: input.provenance?.retrievedAt,
      recordedAt: now,
      assumptions: input.provenance?.assumptions,
      limitations: input.provenance?.limitations,
      ...input.provenance,
      evidenceClass,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO admet_runs (
      id, study_id, compound_id, compound_name, tool_name, tool_version,
      provider, provider_version, model, normalizer_version, pubchem_cid,
      input_smiles, generated_at, pubchem_retrieved, lipinski_overall,
      descriptors, raw, status, assessment_origin, provenance, notes,
      created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      compound_name=VALUES(compound_name),
      pubchem_cid=VALUES(pubchem_cid),
      input_smiles=VALUES(input_smiles),
      generated_at=VALUES(generated_at),
      pubchem_retrieved=VALUES(pubchem_retrieved),
      lipinski_overall=VALUES(lipinski_overall),
      descriptors=VALUES(descriptors),
      raw=VALUES(raw),
      status=VALUES(status),
      assessment_origin=VALUES(assessment_origin),
      provenance=VALUES(provenance),
      notes=VALUES(notes),
      updated_at=VALUES(updated_at),
      updated_by=VALUES(updated_by)`,
    [
      record.id,
      studyId,
      record.compoundId ?? null,
      record.compoundName ?? null,
      record.toolName ?? null,
      record.toolVersion ?? null,
      record.provider ?? null,
      record.providerVersion ?? null,
      record.model ?? null,
      record.normalizerVersion ?? null,
      record.pubchemCid ?? null,
      record.inputSmiles ?? null,
      record.generatedAt ?? null,
      record.pubchemRetrieved !== undefined ? (record.pubchemRetrieved ? 1 : 0) : null,
      record.lipinskiOverall ?? null,
      toJson(record.descriptors),
      toJson(record.raw),
      record.status,
      record.assessmentOrigin ?? null,
      toJson(record.provenance),
      record.notes ?? null,
      record.createdAt,
      record.updatedAt,
      record.createdBy,
      record.updatedBy,
    ]
  )

  if (input.compoundId) {
    try {
      await execute(
        `UPDATE phytochemicals SET screening_reviewed_at = ?, updated_at = ? WHERE study_id = ? AND id = ?`,
        [now, now, studyId, input.compoundId]
      )
    } catch (err) {
      console.warn("[saveAutomaticAdmeRun] Could not update screening_reviewed_at:", err)
    }
  }

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "admetRun.create",
    entityType: "admetRun",
    entityId: id,
  })

  return record
}

export async function savePrototypeAdmeRun(
  studyId: string,
  actor: Actor,
  input: {
    compoundId: string
    compoundName: string
    pubchemCid: number
    smiles?: string
    pubchemRetrieved?: boolean
    lipinskiOverall: "pass" | "fail" | "incomplete"
    descriptors: Record<string, string | number | boolean | null>
  }
): Promise<AdmetRun> {
  const existingRow = await queryOne(
    `SELECT * FROM admet_runs WHERE study_id = ? AND compound_id = ?`,
    [studyId, input.compoundId]
  )
  const existing = existingRow ? mapAdmetRun(existingRow) : null
  const now = new Date().toISOString()
  const refId = existing?.id || generateDocId()

  const record = AdmetRunSchema.parse({
    id: refId,
    studyId,
    compoundId: input.compoundId,
    compoundName: input.compoundName,
    toolName: PROTOTYPE_ADME_PROVIDER,
    toolVersion: PROTOTYPE_ADME_VERSION,
    provider: PROTOTYPE_ADME_PROVIDER,
    providerVersion: PROTOTYPE_ADME_VERSION,
    model: PROTOTYPE_ADME_SUBTITLE,
    pubchemCid: input.pubchemCid,
    inputSmiles: input.smiles ?? undefined,
    generatedAt: now,
    pubchemRetrieved: input.pubchemRetrieved,
    lipinskiOverall: input.lipinskiOverall,
    descriptors: input.descriptors,
    status: "final",
    assessmentOrigin: "calculated",
    provenance: defaultProvenance("SIMULATION", {
      source: PROTOTYPE_ADME_PROVIDER,
      methodName: PROTOTYPE_ADME_SUBTITLE,
      methodVersion: PROTOTYPE_ADME_VERSION,
      operatorId: actor.id,
      recordedAt: now,
      assumptions:
        "These values are a fixed demonstration set. They are not measurements and they are not output from a live ADME model.",
      limitations: PROTOTYPE_ADME_NOTICE,
    }),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO admet_runs (
      id, study_id, compound_id, compound_name, tool_name, tool_version,
      provider, provider_version, model, normalizer_version, pubchem_cid,
      input_smiles, generated_at, pubchem_retrieved, lipinski_overall,
      descriptors, raw, status, assessment_origin, provenance, notes,
      created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      compound_name=VALUES(compound_name),
      pubchem_cid=VALUES(pubchem_cid),
      input_smiles=VALUES(input_smiles),
      generated_at=VALUES(generated_at),
      pubchem_retrieved=VALUES(pubchem_retrieved),
      lipinski_overall=VALUES(lipinski_overall),
      descriptors=VALUES(descriptors),
      raw=VALUES(raw),
      status=VALUES(status),
      assessment_origin=VALUES(assessment_origin),
      provenance=VALUES(provenance),
      notes=VALUES(notes),
      updated_at=VALUES(updated_at),
      updated_by=VALUES(updated_by)`,
    [
      record.id,
      studyId,
      record.compoundId ?? null,
      record.compoundName ?? null,
      record.toolName ?? null,
      record.toolVersion ?? null,
      record.provider ?? null,
      record.providerVersion ?? null,
      record.model ?? null,
      record.normalizerVersion ?? null,
      record.pubchemCid ?? null,
      record.inputSmiles ?? null,
      record.generatedAt ?? null,
      record.pubchemRetrieved !== undefined ? (record.pubchemRetrieved ? 1 : 0) : null,
      record.lipinskiOverall ?? null,
      toJson(record.descriptors),
      toJson(record.raw),
      record.status,
      record.assessmentOrigin ?? null,
      toJson(record.provenance),
      record.notes ?? null,
      record.createdAt,
      record.updatedAt,
      record.createdBy,
      record.updatedBy,
    ]
  )

  try {
    await execute(
      `UPDATE phytochemicals SET screening_reviewed_at = ?, updated_at = ? WHERE study_id = ? AND id = ?`,
      [now, now, studyId, input.compoundId]
    )
  } catch (err) {
    console.warn("[savePrototypeAdmeRun] Could not update screening_reviewed_at:", err)
  }

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: existing ? "admetRun.update" : "admetRun.create",
    entityType: "admetRun",
    entityId: refId,
  })

  return record
}

export async function listAdmetRuns(studyId: string): Promise<AdmetRun[]> {
  const rows = await query(`SELECT * FROM admet_runs WHERE study_id = ? ORDER BY created_at ASC`, [studyId])
  return rows.map(mapAdmetRun)
}

// ================= Molecular Docking =================

async function validateDockingRefs(
  studyId: string,
  input: DockingRunInput
): Promise<{ ligandName?: string; ligandPubchemCid?: number; receptorPdbId?: string }> {
  const compound = await getCompound(studyId, input.compoundId)
  if (!compound) throw new Error("Selected ligand compound was not found in this study.")

  const protein = await getProtein(studyId, input.proteinId)
  if (!protein) throw new Error("Selected target protein was not found in this study.")

  const pdb = (input.receptorPdbId ?? protein.pdbId ?? "").trim()

  if (!input.modes.length) throw new Error("At least one Vina mode with affinity (kcal/mol) is required.")

  for (const m of input.modes) {
    if (typeof m.affinityKcalMol !== "number" || Number.isNaN(m.affinityKcalMol)) {
      throw new Error(`Mode ${m.mode}: affinity must be a number in kcal/mol from actual Vina output.`)
    }
  }

  if (input.provenance.evidenceClass !== "PREDICTED") {
    throw new Error("AutoDock Vina docking runs must use PREDICTED evidence.")
  }
  if (!input.provenance.methodName?.trim()) {
    throw new Error("Provenance method name is required (AutoDock Vina).")
  }
  if (!input.provenance.recordedAt && !input.provenance.retrievedAt) {
    throw new Error("Provenance date generated / recorded is required.")
  }

  return {
    ligandName: input.ligandName ?? compound.name,
    ligandPubchemCid: input.ligandPubchemCid ?? compound.pubchemCid,
    receptorPdbId: pdb || undefined,
  }
}

function bestAffinityFromModes(modes: DockingRunInput["modes"]): number {
  return modes.reduce(
    (best, m) => (m.affinityKcalMol < best ? m.affinityKcalMol : best),
    modes[0]!.affinityKcalMol
  )
}

export async function getDockingPair(studyId: string, id: string): Promise<DockingPair | null> {
  const row = await queryOne(`SELECT * FROM docking_pairs WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  return mapDockingPair(row)
}

export async function listDockingPairs(studyId: string): Promise<DockingPair[]> {
  const rows = await query(`SELECT * FROM docking_pairs WHERE study_id = ? ORDER BY created_at ASC`, [studyId])
  return rows.map(mapDockingPair)
}

export async function upsertDockingPair(
  studyId: string,
  actor: Actor,
  input: {
    compoundId: string
    proteinId: string
    targetId?: string
    compoundName?: string
    targetName?: string
    status?: DockingPair["status"]
    latestRunId?: string | null
    latestBindingAffinity?: number | null
    runsCount?: number
    archived?: boolean
  }
): Promise<DockingPair> {
  const pairId = canonicalDockingPairDocId(input.compoundId, input.proteinId)
  const existing = await getDockingPair(studyId, pairId)
  const now = new Date().toISOString()

  const record = DockingPairSchema.parse({
    id: pairId,
    studyId,
    compoundId: input.compoundId,
    proteinId: input.proteinId,
    targetId: input.targetId ?? existing?.targetId ?? input.proteinId,
    compoundName: input.compoundName ?? existing?.compoundName,
    targetName: input.targetName ?? existing?.targetName,
    status: input.status ?? existing?.status ?? "PENDING",
    latestRunId: input.latestRunId !== undefined ? input.latestRunId : (existing?.latestRunId ?? null),
    latestBindingAffinity:
      input.latestBindingAffinity !== undefined
        ? input.latestBindingAffinity
        : (existing?.latestBindingAffinity ?? null),
    runsCount: input.runsCount !== undefined ? input.runsCount : (existing?.runsCount ?? 0),
    archived: input.archived !== undefined ? input.archived : (existing?.archived ?? false),
    provenance: existing?.provenance || defaultProvenance("REFERENCE", { operatorId: actor.id, recordedAt: now }),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    createdBy: existing?.createdBy ?? actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO docking_pairs (
      id, study_id, compound_id, protein_id, target_id, compound_name, target_name,
      status, latest_run_id, latest_binding_affinity, runs_count, archived,
      provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      target_id=VALUES(target_id), compound_name=VALUES(compound_name), target_name=VALUES(target_name),
      status=VALUES(status), latest_run_id=VALUES(latest_run_id), latest_binding_affinity=VALUES(latest_binding_affinity),
      runs_count=VALUES(runs_count), archived=VALUES(archived), updated_at=VALUES(updated_at), updated_by=VALUES(updated_by)`,
    [
      record.id,
      studyId,
      record.compoundId,
      record.proteinId,
      record.targetId ?? null,
      record.compoundName ?? null,
      record.targetName ?? null,
      record.status,
      record.latestRunId ?? null,
      record.latestBindingAffinity ?? null,
      record.runsCount,
      record.archived ? 1 : 0,
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
    action: existing ? "dockingPair.update" : "dockingPair.create",
    entityType: "dockingPair",
    entityId: pairId,
  })

  return record
}

export async function createDockingRun(
  studyId: string,
  actor: Actor,
  rawInput: DockingRunInput
): Promise<DockingRun> {
  const input = DockingRunInputSchema.parse(rawInput)
  const refs = await validateDockingRefs(studyId, input)

  const id = generateDocId()
  const now = new Date().toISOString()
  const best = input.bestBindingAffinityKcalMol ?? bestAffinityFromModes(input.modes)
  const pairId = canonicalDockingPairDocId(input.compoundId, input.proteinId)

  // Check existing pair to calculate runs_count
  const existingPair = await getDockingPair(studyId, pairId)
  const nextRunsCount = (existingPair?.runsCount ?? 0) + 1

  const record = DockingRunSchema.parse({
    ...input,
    id,
    pairId,
    studyId,
    ligandName: refs.ligandName,
    ligandPubchemCid: refs.ligandPubchemCid,
    receptorPdbId: refs.receptorPdbId,
    bestBindingAffinityKcalMol: best,
    interactions: input.interactions ?? [],
    status: input.status ?? "imported",
    provenance: defaultProvenance("PREDICTED", {
      ...input.provenance,
      evidenceClass: "PREDICTED",
      methodName: input.provenance.methodName || "AutoDock Vina",
      ...(input.vinaVersion ? { methodVersion: input.vinaVersion } : {}),
      operatorId: actor.id,
      recordedAt: input.provenance.recordedAt || now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  // 1. Ensure canonical pair exists
  await upsertDockingPair(studyId, actor, {
    compoundId: input.compoundId,
    proteinId: input.proteinId,
    compoundName: refs.ligandName,
    status: "COMPLETED",
    latestRunId: record.id,
    latestBindingAffinity: best,
    runsCount: nextRunsCount,
  })

  // 2. Insert new docking run (preserves history: multiple runs under 1 pair)
  await execute(
    `INSERT INTO docking_runs (
      id, study_id, pair_id, run_name, compound_id, protein_id, vina_version,
      receptor_pdb_id, ligand_name, ligand_pubchem_cid, exhaustiveness, num_modes,
      energy_range, search_box, modes, best_binding_affinity_kcal_mol, selected_mode,
      interactions, interacting_residues, interaction_notes, source_file_name,
      pose_file_name, pose_model, ligand_source, receptor_source, docking_profile_id,
      docking_profile_version, research_target, actual_docking_receptor, structure_source,
      structure_id, structure_method, receptor_uniprot, receptor_chains, reference_entity,
      binding_site_source, grid_derivation, grid_center, grid_size, model_source,
      model_version, model_confidence, binding_site_validation_method, execution_status,
      completed_at, status, provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      studyId,
      pairId,
      record.runName,
      record.compoundId,
      record.proteinId,
      record.vinaVersion ?? null,
      record.receptorPdbId ?? null,
      record.ligandName ?? null,
      record.ligandPubchemCid ?? null,
      record.exhaustiveness ?? null,
      record.numModes ?? null,
      record.energyRange ?? null,
      toJson(record.searchBox),
      toJson(record.modes),
      record.bestBindingAffinityKcalMol,
      record.selectedMode ?? null,
      toJson(record.interactions),
      record.interactingResidues ?? null,
      record.interactionNotes ?? null,
      record.sourceFileName ?? null,
      record.poseFileName ?? null,
      record.poseModel ?? null,
      record.ligandSource ?? null,
      record.receptorSource ?? null,
      record.dockingProfileId ?? null,
      record.dockingProfileVersion ?? null,
      record.researchTarget ?? null,
      record.actualDockingReceptor ?? null,
      record.structureSource ?? null,
      record.structureId ?? null,
      record.structureMethod ?? null,
      record.receptorUniProt ?? null,
      toJson(record.receptorChains),
      record.referenceEntity ?? null,
      record.bindingSiteSource ?? null,
      record.gridDerivation ?? null,
      toJson(record.gridCenter),
      toJson(record.gridSize),
      record.modelSource ?? null,
      record.modelVersion ?? null,
      record.modelConfidence ?? null,
      record.bindingSiteValidationMethod ?? null,
      record.executionStatus ?? null,
      record.completedAt ?? null,
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
    action: "dockingRun.create",
    entityType: "dockingRun",
    entityId: id,
  })

  return record
}

export async function createSkippedDockingPair(
  studyId: string,
  actor: Actor,
  input: {
    compoundId: string
    compoundName: string
    proteinId: string
    targetId: string
    targetName: string
    runName: string
    reason?: string
  }
): Promise<SkippedDockingPair> {
  const pairId = canonicalDockingPairDocId(input.compoundId, input.proteinId)
  const now = new Date().toISOString()
  const skipRecord = SkippedDockingPairSchema.parse({
    id: pairId,
    studyId,
    compoundId: input.compoundId,
    compoundName: input.compoundName,
    proteinId: input.proteinId,
    targetId: input.targetId,
    targetName: input.targetName,
    runName: input.runName,
    ligandName: input.compoundName,
    status: "SKIPPED",
    dockingStatus: "SKIPPED",
    bindingAffinity: null,
    bestBindingAffinityKcalMol: null,
    reason: input.reason || DOCKING_SKIP_REASON,
    modes: [],
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await upsertDockingPair(studyId, actor, {
    compoundId: input.compoundId,
    proteinId: input.proteinId,
    targetId: input.targetId,
    compoundName: input.compoundName,
    targetName: input.targetName,
    status: "SKIPPED",
    latestRunId: null,
    latestBindingAffinity: null,
  })

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "dockingPair.skip",
    entityType: "dockingPair",
    entityId: pairId,
  })

  return skipRecord
}

export async function listDockingRuns(
  studyId: string,
  options?: { all?: boolean }
): Promise<DockingRun[]> {
  const { completed, allRuns } = await listDockingOutcomes(studyId)
  return options?.all ? allRuns : completed
}

export async function listAllDockingRuns(studyId: string): Promise<DockingRun[]> {
  const { allRuns } = await listDockingOutcomes(studyId)
  return allRuns
}

export async function getDockingRun(studyId: string, id: string): Promise<DockingRun | null> {
  const row = await queryOne(`SELECT * FROM docking_runs WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  return mapDockingRun(row)
}

export async function updateDockingRun(
  studyId: string,
  id: string,
  actor: Actor,
  rawInput: DockingRunInput
): Promise<DockingRun> {
  const input = DockingRunInputSchema.parse(rawInput)
  const refs = await validateDockingRefs(studyId, input)
  const existing = await getDockingRun(studyId, id)
  if (!existing) throw new Error("Docking run not found")

  const now = new Date().toISOString()
  const best = input.bestBindingAffinityKcalMol ?? bestAffinityFromModes(input.modes)

  await execute(
    `UPDATE docking_runs SET
      run_name = ?,
      vina_version = ?,
      receptor_pdb_id = ?,
      ligand_name = ?,
      ligand_pubchem_cid = ?,
      exhaustiveness = ?,
      num_modes = ?,
      energy_range = ?,
      search_box = ?,
      modes = ?,
      best_binding_affinity_kcal_mol = ?,
      selected_mode = ?,
      interactions = ?,
      interacting_residues = ?,
      interaction_notes = ?,
      source_file_name = ?,
      pose_file_name = ?,
      pose_model = ?,
      ligand_source = ?,
      receptor_source = ?,
      docking_profile_id = ?,
      docking_profile_version = ?,
      research_target = ?,
      actual_docking_receptor = ?,
      structure_source = ?,
      structure_id = ?,
      structure_method = ?,
      receptor_uniprot = ?,
      receptor_chains = ?,
      reference_entity = ?,
      binding_site_source = ?,
      grid_derivation = ?,
      grid_center = ?,
      grid_size = ?,
      model_source = ?,
      model_version = ?,
      model_confidence = ?,
      binding_site_validation_method = ?,
      execution_status = ?,
      completed_at = ?,
      status = ?,
      provenance = ?,
      notes = ?,
      updated_at = ?,
      updated_by = ?
    WHERE study_id = ? AND id = ?`,
    [
      input.runName,
      input.vinaVersion ?? null,
      refs.receptorPdbId ?? null,
      refs.ligandName ?? null,
      refs.ligandPubchemCid ?? null,
      input.exhaustiveness ?? null,
      input.numModes ?? null,
      input.energyRange ?? null,
      input.searchBox ? JSON.stringify(input.searchBox) : null,
      JSON.stringify(input.modes),
      best,
      input.selectedMode ?? null,
      JSON.stringify(input.interactions ?? []),
      input.interactingResidues ?? null,
      input.interactionNotes ?? null,
      input.sourceFileName ?? null,
      input.poseFileName ?? null,
      input.poseModel ?? null,
      input.ligandSource ?? null,
      input.receptorSource ?? null,
      input.dockingProfileId ?? null,
      input.dockingProfileVersion ?? null,
      input.researchTarget ?? null,
      input.actualDockingReceptor ?? null,
      input.structureSource ?? null,
      input.structureId ?? null,
      input.structureMethod ?? null,
      input.receptorUniProt ?? null,
      input.receptorChains ? JSON.stringify(input.receptorChains) : null,
      input.referenceEntity ?? null,
      input.bindingSiteSource ?? null,
      input.gridDerivation ?? null,
      input.gridCenter ? JSON.stringify(input.gridCenter) : null,
      input.gridSize ? JSON.stringify(input.gridSize) : null,
      input.modelSource ?? null,
      input.modelVersion ?? null,
      input.modelConfidence ?? null,
      input.bindingSiteValidationMethod ?? null,
      input.executionStatus ?? null,
      input.completedAt ?? null,
      input.status ?? "imported",
      JSON.stringify(input.provenance),
      input.notes ?? null,
      now,
      actor.id,
      studyId,
      id,
    ]
  )

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "dockingRun.update",
    entityType: "dockingRun",
    entityId: id,
  })

  const updated = await getDockingRun(studyId, id)
  if (!updated) throw new Error("Docking run update failed")
  return updated
}

export async function listDockingOutcomes(
  studyId: string,
  options?: { includePoseModel?: boolean }
): Promise<{
  completed: DockingRun[]
  skipped: SkippedDockingPair[]
  allRuns: DockingRun[]
  runsByPair: Record<string, DockingRun[]>
  pairs: DockingPair[]
}> {
  const runFields = options?.includePoseModel
    ? "*"
    : `id, study_id, pair_id, run_name, compound_id, protein_id, vina_version,
       receptor_pdb_id, ligand_name, ligand_pubchem_cid, exhaustiveness, num_modes,
       energy_range, search_box, modes, best_binding_affinity_kcal_mol, selected_mode,
       interactions, interacting_residues, interaction_notes, source_file_name,
       pose_file_name, NULL as pose_model, ligand_source, receptor_source, docking_profile_id,
       docking_profile_version, research_target, actual_docking_receptor,
       structure_source, structure_id, structure_method, receptor_uniprot,
       receptor_chains, reference_entity, binding_site_source, grid_derivation,
       grid_center, grid_size, model_source, model_version, model_confidence,
       binding_site_validation_method, execution_status, completed_at, status,
       provenance, notes, created_at, updated_at, created_by, updated_by`

  const [runRows, pairRows] = await Promise.all([
    query(`SELECT ${runFields} FROM docking_runs WHERE study_id = ? ORDER BY completed_at DESC, created_at DESC`, [studyId]),
    query(`SELECT * FROM docking_pairs WHERE study_id = ? ORDER BY created_at ASC`, [studyId]),
  ])

  const pairs: DockingPair[] = pairRows.map(mapDockingPair)
  const allRuns: DockingRun[] = runRows.map(mapDockingRun)
  const skipped: SkippedDockingPair[] = []

  // Check skipped pairs
  for (const p of pairs) {
    if (p.status === "SKIPPED") {
      skipped.push(
        SkippedDockingPairSchema.parse({
          id: p.id,
          studyId,
          compoundId: p.compoundId,
          compoundName: p.compoundName || "",
          proteinId: p.proteinId,
          targetId: p.targetId || p.proteinId,
          targetName: p.targetName || "",
          runName: `${p.compoundName} × ${p.targetName}`,
          ligandName: p.compoundName,
          status: "SKIPPED",
          dockingStatus: "SKIPPED",
          bindingAffinity: null,
          bestBindingAffinityKcalMol: null,
          reason: DOCKING_SKIP_REASON,
          modes: [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          createdBy: p.createdBy,
          updatedBy: p.updatedBy,
        })
      )
    }
  }

  // Group runs by canonical pair
  const runsByPair: Record<string, DockingRun[]> = {}
  const latestRunsMap = new Map<string, DockingRun>()

  for (const run of allRuns) {
    const key = run.pairId || canonicalDockingPairDocId(run.compoundId, run.proteinId)
    if (!runsByPair[key]) runsByPair[key] = []
    runsByPair[key].push(run)

    if (!latestRunsMap.has(key)) {
      latestRunsMap.set(key, run)
    }
  }

  const completed = Array.from(latestRunsMap.values())

  return {
    completed,
    skipped,
    allRuns,
    runsByPair,
    pairs,
  }
}

export async function deleteDockingRun(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM docking_runs WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "dockingRun.delete",
    entityType: "dockingRun",
    entityId: id,
  })
}

// ================= Biological Predictions =================

export async function listPredictionRuns(
  studyId: string,
  endpoint?: PredictionEndpoint
): Promise<PredictionRun[]> {
  const sql = endpoint
    ? `SELECT * FROM biological_predictions WHERE study_id = ? AND endpoint = ? ORDER BY created_at ASC`
    : `SELECT * FROM biological_predictions WHERE study_id = ? ORDER BY created_at ASC`
  const params = endpoint ? [studyId, endpoint] : [studyId]
  const rows = await query(sql, params)
  return rows.map(mapPredictionRun)
}

export async function getPredictionRun(studyId: string, id: string): Promise<PredictionRun | null> {
  const row = await queryOne(`SELECT * FROM biological_predictions WHERE study_id = ? AND id = ?`, [studyId, id])
  if (!row) return null
  return mapPredictionRun(row)
}

export async function createPredictionRun(
  studyId: string,
  actor: Actor,
  input: PredictionRunInput
): Promise<PredictionRun> {
  const validated = PredictionRunInputSchema.parse(input)
  const id = generateDocId()
  const now = new Date().toISOString()

  const record = PredictionRunSchema.parse({
    ...validated,
    id,
    studyId,
    module: validated.endpoint,
    provenance: defaultProvenance(validated.provenance.evidenceClass, {
      ...validated.provenance,
      operatorId: actor.id,
      recordedAt: validated.provenance.recordedAt || now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await execute(
    `INSERT INTO biological_predictions (
      id, study_id, endpoint, run_name, compound_id, formulation_id, cell_line_id,
      protein_id, summary_ic50, summary_ic50_unit, summary_maximum, summary_maximum_unit,
      teac, selectivity_index, pathway_effect, concentration_unit_label, method_name,
      method_version, method_type, source, reference_ids, assumptions, limitations,
      concentration_unit, input_parameters, date_generated, operator_name, result_points,
      status, provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      studyId,
      record.endpoint,
      record.runName,
      record.compoundId ?? null,
      record.formulationId ?? null,
      record.cellLineId ?? null,
      record.proteinId ?? null,
      record.summaryIc50 ?? null,
      record.summaryIc50Unit ?? null,
      record.summaryMaximum ?? null,
      record.summaryMaximumUnit ?? null,
      record.teac ?? null,
      record.selectivityIndex ?? null,
      record.pathwayEffect ?? null,
      record.concentrationUnitLabel ?? null,
      record.methodName,
      record.methodVersion ?? null,
      record.methodType,
      record.source,
      toJson(record.referenceIds),
      record.assumptions ?? null,
      record.limitations ?? null,
      record.concentrationUnit,
      toJson(record.inputParameters),
      record.dateGenerated,
      record.operatorName ?? null,
      toJson(record.resultPoints),
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
    action: "predictionRun.create",
    entityType: "predictionRun",
    entityId: id,
  })

  return record
}

export async function deletePredictionRun(studyId: string, id: string, actor: Actor): Promise<void> {
  await execute(`DELETE FROM biological_predictions WHERE study_id = ? AND id = ?`, [studyId, id])
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "predictionRun.delete",
    entityType: "predictionRun",
    entityId: id,
  })
}

export async function updatePredictionRun(
  studyId: string,
  id: string,
  actor: Actor,
  input: Partial<PredictionRun>
): Promise<PredictionRun> {
  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?", "updated_by = ?"]
  const params: unknown[] = [now, actor.id]

  if (input.runName !== undefined) {
    fields.push("run_name = ?")
    params.push(input.runName)
  }
  if (input.notes !== undefined) {
    fields.push("notes = ?")
    params.push(input.notes ?? null)
  }
  if (input.status !== undefined) {
    fields.push("status = ?")
    params.push(input.status)
  }

  params.push(studyId, id)
  await execute(`UPDATE biological_predictions SET ${fields.join(", ")} WHERE study_id = ? AND id = ?`, params)
  const updated = await getPredictionRun(studyId, id)
  if (!updated) throw new Error("Prediction run update failed")
  return updated
}

export async function skipDockingPair(
  studyId: string,
  actor: Actor,
  input: { compoundId: string; compoundName: string; proteinId: string; targetName: string; reason?: string }
): Promise<void> {
  const pairId = canonicalDockingPairDocId(input.compoundId, input.proteinId)
  const now = new Date().toISOString()
  await execute(
    `INSERT INTO docking_pairs (
      id, study_id, compound_id, protein_id, target_id, compound_name, target_name,
      status, latest_run_id, latest_binding_affinity, runs_count, archived,
      provenance, notes, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SKIPPED', NULL, NULL, 0, 0, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = 'SKIPPED',
      notes = VALUES(notes),
      updated_at = VALUES(updated_at),
      updated_by = VALUES(updated_by)`,
    [
      pairId,
      studyId,
      input.compoundId,
      input.proteinId,
      input.proteinId,
      input.compoundName,
      input.targetName,
      JSON.stringify(defaultProvenance("REFERENCE", { evidenceClass: "REFERENCE", recordedAt: now, operatorId: actor.id })),
      input.reason ?? DOCKING_SKIP_REASON,
      now,
      now,
      actor.id,
      actor.id,
    ]
  )
}

export async function reopenDockingPair(studyId: string, pairId: string, actor: Actor): Promise<void> {
  const now = new Date().toISOString()
  await execute(
    `UPDATE docking_pairs SET status = 'PENDING', updated_at = ?, updated_by = ? WHERE study_id = ? AND id = ?`,
    [now, actor.id, studyId, pairId]
  )
}
