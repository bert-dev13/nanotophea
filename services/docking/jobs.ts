import { randomUUID } from "node:crypto"
import { execute, query, queryOne, transaction } from "@/lib/db/mysql"
import { mapCompound, mapProtein } from "@/lib/repositories/mysqlMappers"
import {
  ApprovedDockingConfigurationSchema,
  canonicalDockingPairDocId,
  DockingPairSchema,
  DockingRunSchema,
  type ApprovedDockingConfiguration,
  type DockingPair,
  type DockingRun,
} from "@/lib/domain/models"
import { defaultProvenance } from "@/lib/domain/provenance"
import { isCompleteDockingProfile, profileSpecForProtein, YAP1_PROFILE_UNAVAILABLE, type ResolvedDockingProfile } from "@/lib/docking/profiles"
import { inspectEngine } from "@/services/docking/engine"
import { parseVinaOutput, type ParsedVinaOutput } from "@/services/docking/parser"
import { resolveDockingProfile } from "@/services/docking/resolveProfile"
import { dockingFileStore } from "@/services/docking/storage"
import {
  CONFIGURATION_UNAVAILABLE,
  DOCKING_INTERRUPTED,
  ENGINE_UNAVAILABLE,
  PROFILE_MISSING,
  researcherDockingError,
  type DockingJobRecord,
  type DockingStage,
} from "@/services/docking/types"
import { executeVina } from "@/services/docking/vina"

interface QueueItem {
  jobId: string
  task: () => Promise<void>
}

interface QueueState {
  running: boolean
  activeJobId: string | null
  pending: QueueItem[]
}

const queue: QueueState = ((globalThis as { __nanotopheaDocking?: QueueState }).__nanotopheaDocking ??= {
  running: false,
  activeJobId: null,
  pending: [],
})

export async function enqueueDocking(input: {
  studyId: string
  actorId: string
  compoundId: string
  proteinId: string
}): Promise<DockingJobRecord> {
  const blocker = await preflight(input.studyId, input.proteinId)
  if (blocker) {
    throw new DockingRejected(blocker)
  }
  const jobId = jobDocId(input.compoundId, input.proteinId)
  const existing = await readJob(input.studyId, jobId)
  const isActivelyRunning =
    existing &&
    (existing.status === "waiting" || existing.status === "preparing" || existing.status === "running") &&
    (queue.activeJobId === jobId || queue.pending.some((p) => p.jobId === jobId))

  if (isActivelyRunning && existing) return existing

  const now = new Date().toISOString()
  const job: DockingJobRecord = {
    id: jobId,
    studyId: input.studyId,
    compoundId: input.compoundId,
    proteinId: input.proteinId,
    status: "waiting",
    stage: null,
    error: null,
    runId: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
  await writeJob(job)
  console.info(`[docking] Enqueued job ${job.id} for study ${input.studyId}`)
  queue.pending.push({
    jobId: job.id,
    task: () => runJob(input.actorId, job),
  })
  void drain()
  return job
}

export async function listDockingJobs(studyId: string): Promise<DockingJobRecord[]> {
  const activeIds = new Set<string>()
  if (queue.activeJobId) activeIds.add(queue.activeJobId)
  for (const item of queue.pending) activeIds.add(item.jobId)

  const rows = await query<any>(
    "SELECT * FROM docking_jobs WHERE study_id = ? ORDER BY created_at ASC",
    [studyId]
  )

  const now = new Date().toISOString()
  const jobs: DockingJobRecord[] = []

  for (const row of rows) {
    const isUnfinished = row.status === "waiting" || row.status === "preparing" || row.status === "running"
    // Stale recovery: If job is marked running/preparing/waiting in DB but not active in memory, mark as interrupted
    if (isUnfinished && !activeIds.has(row.id)) {
      console.warn(`[docking] Reconciling stale job ${row.id} from status '${row.status}' to 'failed'`)
      await execute(
        `UPDATE docking_jobs SET
          status = 'failed',
          stage = NULL,
          error = ?,
          completed_at = ?,
          updated_at = ?
        WHERE id = ?`,
        [DOCKING_INTERRUPTED, now, now, row.id]
      )
      jobs.push({
        id: row.id,
        studyId: row.study_id,
        compoundId: row.compound_id,
        proteinId: row.protein_id,
        status: "failed",
        stage: null,
        error: DOCKING_INTERRUPTED,
        runId: row.run_id,
        createdAt: row.created_at,
        updatedAt: now,
        completedAt: now,
      })
    } else {
      jobs.push({
        id: row.id,
        studyId: row.study_id,
        compoundId: row.compound_id,
        proteinId: row.protein_id,
        status: row.status,
        stage: row.stage,
        error: row.error,
        runId: row.run_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      })
    }
  }

  return jobs
}

export class DockingRejected extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DockingRejected"
  }
}

async function preflight(studyId: string, proteinId: string): Promise<string | null> {
  const engine = inspectEngine()
  if (!engine.available) {
    console.error("[docking] engine unavailable", engine.missing.join(" "))
    return researcherDockingError(ENGINE_UNAVAILABLE)
  }
  const protein = await readDoc(studyId, "proteins", proteinId)
  if (!protein || !text(protein.pdbId).trim()) return researcherDockingError("RCSB structure unavailable")
  const spec = profileSpecForProtein({
    pdbId: text(protein.pdbId),
    uniprotIds: stringList(protein.uniprotIds),
  })
  if (!spec || !isCompleteDockingProfile(spec)) {
    console.error("[docking] no curated profile", text(protein.pdbId), proteinId)
    return PROFILE_MISSING
  }
  const resolved = await resolveDockingProfile(protein)
  if (!resolved.ok) {
    if (text(protein.pdbId).trim().toUpperCase() === "3KYS") console.error(YAP1_PROFILE_UNAVAILABLE)
    console.error("[docking] profile unresolved", text(protein.pdbId), resolved.reason)
    return CONFIGURATION_UNAVAILABLE
  }
  return null
}

async function drain(): Promise<void> {
  if (queue.running) return
  queue.running = true
  try {
    while (queue.pending.length) {
      const item = queue.pending.shift()
      if (item) {
        queue.activeJobId = item.jobId
        try {
          await item.task()
        } finally {
          queue.activeJobId = null
        }
      }
    }
  } finally {
    queue.running = false
    queue.activeJobId = null
  }
}

async function runJob(actorId: string, job: DockingJobRecord): Promise<void> {
  const pairDocId = canonicalDockingPairDocId(job.compoundId, job.proteinId)
  console.info(`[docking] [START] studyId=${job.studyId} pairId=${pairDocId} jobId=${job.id}`)
  try {
    await updateJob(job, { status: "preparing", stage: "Preparing ligand" })
    const blocker = await preflight(job.studyId, job.proteinId)
    if (blocker) throw new DockingRejected(blocker)

    const compound = await readDoc(job.studyId, "compounds", job.compoundId)
    const protein = await readDoc(job.studyId, "proteins", job.proteinId)
    if (!compound) throw new Error("PubChem structure unavailable")
    if (!protein) throw new Error("RCSB structure unavailable")

    const resolved = await resolveDockingProfile(protein)
    if (!resolved.ok) {
      if (text(protein.pdbId).trim().toUpperCase() === "3KYS") console.error(YAP1_PROFILE_UNAVAILABLE)
      console.error(`[docking] Profile unresolved: jobId=${job.id} reason=${resolved.reason}`)
      throw new DockingRejected(CONFIGURATION_UNAVAILABLE)
    }

    const configuration = configurationFromProfile(job.proteinId, resolved.profile)
    console.info(`[docking] [PREPARING] profile=${resolved.profile.id} v${resolved.profile.version} method=${resolved.profile.calculationMethod}`)

    const execution = await executeVina({
      cid: typeof compound.pubchemCid === "number" ? compound.pubchemCid : undefined,
      pdbId: resolved.profile.pdbId ?? (typeof protein.pdbId === "string" ? protein.pdbId : undefined),
      receptorChains: resolved.profile.receptorChains,
      ...(resolved.profile.residueRange ? { residueRange: resolved.profile.residueRange } : {}),
      ...(resolved.profile.referenceResidue && resolved.profile.restoreAs && resolved.profile.restoreAtomNames
        ? {
            receptorRestore: {
              residue: resolved.profile.referenceResidue,
              as: resolved.profile.restoreAs,
              atomNames: resolved.profile.restoreAtomNames,
            },
          }
        : {}),
      configuration,
      onStage: (stage) => {
        console.info(`[docking] [STAGE] jobId=${job.id} stage="${stage}"`)
        return updateJob(job, {
          status: stage === "Running AutoDock Vina" || stage === "Processing results" ? "running" : "preparing",
          stage,
        })
      },
    })

    console.info(`[docking] [VINA_COMPLETED] jobId=${job.id} vinaVersion=${execution.vinaVersion || "unknown"}`)
    await updateJob(job, { status: "running", stage: "Processing results" })

    const parsed = parseVinaOutput(`${execution.log}\n${execution.poses}`)
    if (!parsed.ok) throw new Error("parsing failure")
    console.info(`[docking] [PARSE_COMPLETED] jobId=${job.id} bestAffinity=${parsed.result.bestAffinityKcalMol} modes=${parsed.result.modes.length}`)

    const saved = await saveRun({
      studyId: job.studyId,
      actorId,
      compoundId: job.compoundId,
      proteinId: job.proteinId,
      compoundName: text(compound.name) || "Ligand",
      proteinName: text(protein.name) || "Target",
      cid: typeof compound.pubchemCid === "number" ? compound.pubchemCid : undefined,
      pdbId: typeof protein.pdbId === "string" ? protein.pdbId : undefined,
      configuration,
      profile: resolved.profile,
      execution,
      parsed: parsed.result,
    })

    console.info(`[docking] [DB_SAVED] jobId=${job.id} runId=${saved.id} pairId=${pairDocId}`)
    await updateJob(job, {
      status: "completed",
      stage: "Completed",
      runId: saved.id,
      completedAt: new Date().toISOString(),
      error: null,
    })
    console.info(`[docking] [JOB_COMPLETED] jobId=${job.id}`)
  } catch (error) {
    const technical = error instanceof Error ? error.message : "Vina execution failure"
    console.error(`[docking] [JOB_FAILED] jobId=${job.id} error="${technical}"`)
    await updateJob(job, {
      status: "failed",
      stage: null,
      error: researcherDockingError(technical),
      completedAt: new Date().toISOString(),
    })
  }
}

async function saveRun(input: {
  studyId: string
  actorId: string
  compoundId: string
  proteinId: string
  compoundName: string
  proteinName: string
  cid?: number
  pdbId?: string
  configuration: ApprovedDockingConfiguration
  profile: ResolvedDockingProfile
  execution: Awaited<ReturnType<typeof executeVina>>
  parsed: ParsedVinaOutput
}): Promise<DockingRun> {
  const now = new Date().toISOString()
  const runId = randomUUID()
  const pairDocId = canonicalDockingPairDocId(input.compoundId, input.proteinId)

  const store = dockingFileStore(input.studyId, `${input.compoundId}_${input.proteinId}`)
  const artifacts = store.configured
    ? (await Promise.all([
        store.write("ligand.sdf", input.execution.ligandSdf),
        store.write("ligand.pdbqt", input.execution.ligandPdbqt),
        store.write("receptor.pdb", input.execution.receptorPdb),
        store.write("receptor.pdbqt", input.execution.receptorPdbqt),
        store.write("vina.txt", input.execution.configText),
        store.write("vina.log", input.execution.log),
        store.write("poses.pdbqt", input.execution.poses),
      ])).flatMap((item) => (item ? [item] : []))
    : []
  const pose = input.parsed.poseModel && input.parsed.poseModel.length <= 400_000 ? input.parsed.poseModel : undefined
  const record = DockingRunSchema.parse({
    id: runId,
    pairId: pairDocId,
    studyId: input.studyId,
    runName: `${input.compoundName} × ${input.proteinName}`,
    compoundId: input.compoundId,
    proteinId: input.proteinId,
    ...(input.parsed.vinaVersion || input.execution.vinaVersion
      ? { vinaVersion: input.parsed.vinaVersion || input.execution.vinaVersion }
      : {}),
    ...(input.pdbId ? { receptorPdbId: input.pdbId.toUpperCase() } : {}),
    ligandName: input.compoundName,
    ...(input.cid != null ? { ligandPubchemCid: input.cid } : {}),
    exhaustiveness: input.configuration.exhaustiveness,
    numModes: input.configuration.numModes,
    energyRange: input.configuration.energyRange,
    searchBox: {
      centerX: input.configuration.centerX,
      centerY: input.configuration.centerY,
      centerZ: input.configuration.centerZ,
      sizeX: input.configuration.sizeX,
      sizeY: input.configuration.sizeY,
      sizeZ: input.configuration.sizeZ,
    },
    modes: input.parsed.modes,
    bestBindingAffinityKcalMol: input.parsed.bestAffinityKcalMol,
    selectedMode: input.parsed.bestMode,
    interactions: [],
    ligandSource: input.execution.ligandSource,
    receptorSource: input.execution.receptorSource,
    dockingProfileId: input.profile.id,
    dockingProfileVersion: input.profile.version,
    researchTarget: input.profile.researchTarget ?? input.profile.biologicalTarget ?? input.proteinName,
    actualDockingReceptor: input.profile.actualDockingReceptor ?? input.profile.dockingReceptor,
    structureSource: input.profile.structureSource ?? (input.profile.verificationSource === "AlphaFold DB" ? "PREDICTED_STRUCTURE" : "EXPERIMENTAL_STRUCTURE"),
    structureId: input.profile.structureId ?? input.profile.pdbId,
    structureMethod: input.profile.structureMethod ?? (input.profile.structureSource === "PREDICTED_STRUCTURE" ? "AlphaFold DB" : "X-ray"),
    receptorUniProt: input.profile.receptorUniprotId,
    receptorChains: input.profile.receptorChains,
    referenceEntity: input.profile.referenceEntity,
    bindingSiteSource: input.profile.bindingSiteSource ?? input.profile.bindingSiteLabel,
    gridDerivation: input.profile.provenance,
    gridCenter: {
      x: input.configuration.centerX,
      y: input.configuration.centerY,
      z: input.configuration.centerZ,
    },
    gridSize: {
      x: input.configuration.sizeX,
      y: input.configuration.sizeY,
      z: input.configuration.sizeZ,
    },
    ...(input.profile.modelSource ? { modelSource: input.profile.modelSource } : {}),
    ...(input.profile.modelVersion ? { modelVersion: input.profile.modelVersion } : {}),
    ...(input.profile.modelConfidence ? { modelConfidence: input.profile.modelConfidence } : {}),
    ...(input.profile.bindingSiteValidationMethod ? { bindingSiteValidationMethod: input.profile.bindingSiteValidationMethod } : {}),
    executionStatus: "completed",
    completedAt: now,
    ...(pose ? { poseModel: pose } : {}),
    status: "final",
    provenance: defaultProvenance("PREDICTED", {
      evidenceClass: "PREDICTED",
      methodName: "AutoDock Vina",
      ...(input.execution.vinaVersion ? { methodVersion: input.execution.vinaVersion } : {}),
      source: `${input.execution.ligandSource}; ${input.execution.receptorSource}; docking profile ${input.profile.id} v${input.profile.version}; ligand prepared with ${input.execution.ligandTool}; receptor prepared with ${input.execution.receptorTool}`,
      recordedAt: now,
      operatorId: input.actorId,
      ...(artifacts.length ? { artifacts } : {}),
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: input.actorId,
    updatedBy: input.actorId,
  })

  // Atomic persistence using MySQL transaction:
  // 1. Ensure/upsert canonical DockingPair FIRST so foreign key fk_dr_pair is satisfied!
  // 2. Insert DockingRun with pair_id = pairDocId SECOND!
  // 3. Atomically update latest_run_id on DockingPair!
  // 4. Atomically update DockingJob!
  await transaction(async (conn) => {
    // 1. Upsert canonical DockingPair
    const [existingPairs] = await conn.query<any[]>(
      "SELECT * FROM docking_pairs WHERE study_id = ? AND compound_id = ? AND protein_id = ?",
      [input.studyId, input.compoundId, input.proteinId]
    )
    const existingPair = existingPairs[0]

    if (existingPair) {
      await conn.execute(
        `UPDATE docking_pairs SET
          status = 'COMPLETED',
          latest_run_id = ?,
          latest_binding_affinity = ?,
          runs_count = runs_count + 1,
          updated_at = ?,
          updated_by = ?
        WHERE id = ?`,
        [
          runId,
          input.parsed.bestAffinityKcalMol,
          now,
          input.actorId,
          existingPair.id,
        ]
      )
    } else {
      await conn.execute(
        `INSERT INTO docking_pairs (
          id, study_id, compound_id, protein_id, target_id, compound_name, target_name,
          status, latest_run_id, latest_binding_affinity, runs_count, archived,
          provenance, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pairDocId,
          input.studyId,
          input.compoundId,
          input.proteinId,
          input.proteinId,
          input.compoundName,
          input.proteinName,
          "COMPLETED",
          runId,
          input.parsed.bestAffinityKcalMol,
          1,
          0,
          JSON.stringify(defaultProvenance("REFERENCE", { evidenceClass: "REFERENCE", recordedAt: now, operatorId: input.actorId })),
          null,
          now,
          now,
          input.actorId,
          input.actorId,
        ]
      )
    }

    // 2. Insert run into docking_runs (now that pair exists!)
    await conn.execute(
      `INSERT INTO docking_runs (
        id, study_id, pair_id, run_name, compound_id, protein_id,
        vina_version, receptor_pdb_id, ligand_name, ligand_pubchem_cid,
        exhaustiveness, num_modes, energy_range, search_box, modes,
        best_binding_affinity_kcal_mol, selected_mode, interactions,
        interacting_residues, interaction_notes, source_file_name, pose_file_name,
        pose_model, ligand_source, receptor_source, docking_profile_id,
        docking_profile_version, research_target, actual_docking_receptor,
        structure_source, structure_id, structure_method, receptor_uniprot,
        receptor_chains, reference_entity, binding_site_source, grid_derivation,
        grid_center, grid_size, model_source, model_version, model_confidence,
        binding_site_validation_method, execution_status, completed_at, status,
        provenance, notes, created_at, updated_at, created_by, updated_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )`,
      [
        record.id,
        record.studyId,
        record.pairId,
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
        record.searchBox ? JSON.stringify(record.searchBox) : null,
        JSON.stringify(record.modes),
        record.bestBindingAffinityKcalMol,
        record.selectedMode ?? null,
        JSON.stringify(record.interactions ?? []),
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
        record.receptorChains ? JSON.stringify(record.receptorChains) : null,
        record.referenceEntity ?? null,
        record.bindingSiteSource ?? null,
        record.gridDerivation ?? null,
        record.gridCenter ? JSON.stringify(record.gridCenter) : null,
        record.gridSize ? JSON.stringify(record.gridSize) : null,
        record.modelSource ?? null,
        record.modelVersion ?? null,
        record.modelConfidence ?? null,
        record.bindingSiteValidationMethod ?? null,
        record.executionStatus ?? null,
        record.completedAt ?? null,
        record.status,
        JSON.stringify(record.provenance),
        record.notes ?? null,
        record.createdAt,
        record.updatedAt,
        record.createdBy,
        record.updatedBy,
      ] as any
    )

    // 3. Atomically update job status
    await conn.execute(
      `UPDATE docking_jobs SET
        status = 'completed',
        stage = 'Completed',
        run_id = ?,
        error = NULL,
        completed_at = ?,
        updated_at = ?
      WHERE study_id = ? AND id = ?`,
      [
        runId,
        now,
        now,
        input.studyId,
        jobDocId(input.compoundId, input.proteinId),
      ]
    )
  })

  return record
}

async function readDoc(studyId: string, collection: string, id: string): Promise<Record<string, unknown> | null> {
  if (collection === "proteins") {
    const row = await queryOne<any>("SELECT * FROM target_proteins WHERE study_id = ? AND id = ?", [studyId, id])
    return row ? (mapProtein(row) as unknown as Record<string, unknown>) : null
  }
  if (collection === "compounds") {
    const row = await queryOne<any>("SELECT * FROM phytochemicals WHERE study_id = ? AND id = ?", [studyId, id])
    return row ? (mapCompound(row) as unknown as Record<string, unknown>) : null
  }
  return null
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function configurationFromProfile(proteinId: string, profile: ResolvedDockingProfile): ApprovedDockingConfiguration {
  return ApprovedDockingConfigurationSchema.parse({
    proteinId,
    pdbId: profile.pdbId,
    strategy: profile.bindingSiteStrategy,
    siteLabel: profile.bindingSiteLabel,
    derivation: profile.provenance,
    receptorChains: profile.receptorChains,
    referenceChain: profile.referenceChain,
    referenceEntity: profile.referenceEntity,
    paddingAngstrom: profile.paddingAngstrom,
    calculationMethod: profile.calculationMethod,
    centerX: profile.centerX,
    centerY: profile.centerY,
    centerZ: profile.centerZ,
    sizeX: profile.sizeX,
    sizeY: profile.sizeY,
    sizeZ: profile.sizeZ,
    exhaustiveness: profile.exhaustiveness,
    numModes: profile.numModes,
    energyRange: profile.energyRange,
    approvedAt: profile.verifiedAt,
    approvedBy: profile.verifiedBy,
  })
}

function jobDocId(compoundId: string, proteinId: string): string {
  return `${compoundId}__${proteinId}`
}

async function readJob(studyId: string, id: string): Promise<DockingJobRecord | null> {
  const row = await queryOne<any>(
    "SELECT * FROM docking_jobs WHERE study_id = ? AND id = ?",
    [studyId, id]
  )
  if (!row) return null
  return {
    id: row.id,
    studyId: row.study_id,
    compoundId: row.compound_id,
    proteinId: row.protein_id,
    status: row.status,
    stage: row.stage,
    error: row.error,
    runId: row.run_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  }
}

async function writeJob(job: DockingJobRecord): Promise<void> {
  await execute(
    `INSERT INTO docking_jobs (
      id, study_id, compound_id, protein_id, status, stage, error, run_id, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      stage = VALUES(stage),
      error = VALUES(error),
      run_id = VALUES(run_id),
      updated_at = VALUES(updated_at),
      completed_at = VALUES(completed_at)`,
    [
      job.id,
      job.studyId,
      job.compoundId,
      job.proteinId,
      job.status,
      job.stage,
      job.error,
      job.runId,
      job.createdAt,
      job.updatedAt,
      job.completedAt,
    ]
  )
}

async function updateJob(
  job: DockingJobRecord,
  patch: Partial<Pick<DockingJobRecord, "status" | "stage" | "error" | "runId" | "completedAt">>,
): Promise<void> {
  const next: DockingJobRecord = {
    ...job,
    ...patch,
    stage: patch.stage === undefined ? job.stage : patch.stage,
    updatedAt: new Date().toISOString(),
  }
  job.status = next.status
  job.stage = next.stage
  job.error = next.error
  job.runId = next.runId
  job.completedAt = next.completedAt
  job.updatedAt = next.updatedAt
  await writeJob(next)
}

export function assertConfiguration(value: unknown): ApprovedDockingConfiguration {
  return ApprovedDockingConfigurationSchema.parse(value)
}

export { ENGINE_UNAVAILABLE, type DockingStage }
