import { getAdminDb } from "../lib/firebase/admin"
import { execute, query, closePool, transaction } from "../lib/db/mysql"
import { initializeDatabase } from "../lib/db/init"
import {
  UserProfileSchema,
  StudySchema,
  StudyMemberSchema,
  FormulationSchema,
  CompoundSchema,
  ProteinSchema,
  CellLineSchema,
  AdmetRunSchema,
  DockingPairSchema,
  DockingRunSchema,
  SkippedDockingPairSchema,
  PredictionRunSchema,
  LabDatasetSchema,
  LabReplicateSchema,
  StatisticsRecordSchema,
  ComparisonRecordSchema,
  InterpretationSchema,
  ReferenceRecordSchema,
  AuditLogSchema,
  canonicalDockingPairDocId,
} from "../lib/domain/models"

interface MigrationStats {
  entity: string
  found: number
  migrated: number
  skipped: number
  errors: string[]
}

const stats: Record<string, MigrationStats> = {}

function recordStats(entity: string, found = 0) {
  if (!stats[entity]) {
    stats[entity] = { entity, found: 0, migrated: 0, skipped: 0, errors: [] }
  }
  stats[entity]!.found += found
}

function recordSuccess(entity: string) {
  stats[entity]!.migrated++
}

function recordSkip(entity: string, reason: string) {
  stats[entity]!.skipped++
  stats[entity]!.errors.push(reason)
}

function toJson(val: unknown): string | null {
  if (val === undefined || val === null) return null
  return JSON.stringify(val)
}

export async function runMigration() {
  console.log("=== STARTING FIRESTORE TO MYSQL MIGRATION ===")
  await initializeDatabase()

  const db = getAdminDb()

  // 1. Users
  recordStats("users")
  const usersSnap = await db.collection("users").get()
  stats.users!.found = usersSnap.size
  for (const doc of usersSnap.docs) {
    const raw = { id: doc.id, ...doc.data() }
    const parsed = UserProfileSchema.safeParse(raw)
    if (!parsed.success) {
      recordSkip("users", `Invalid user ${doc.id}: ${parsed.error.message}`)
      continue
    }
    const u = parsed.data
    await execute(
      `INSERT INTO users (id, email, display_name, photo_url, default_role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), display_name=VALUES(display_name), photo_url=VALUES(photo_url), default_role=VALUES(default_role), updated_at=VALUES(updated_at)`,
      [u.id, u.email, u.displayName, u.photoURL ?? null, u.defaultRole, u.createdAt, u.updatedAt]
    )
    recordSuccess("users")
  }

  // 2. Studies
  recordStats("studies")
  const studiesSnap = await db.collection("studies").get()
  stats.studies!.found = studiesSnap.size
  for (const doc of studiesSnap.docs) {
    const raw = { id: doc.id, ...doc.data() }
    const parsed = StudySchema.safeParse(raw)
    if (!parsed.success) {
      recordSkip("studies", `Invalid study ${doc.id}: ${parsed.error.message}`)
      continue
    }
    const s = parsed.data

    // Ensure owner exists in users table (foreign key constraint)
    const ownerExists = await query(`SELECT id FROM users WHERE id = ?`, [s.ownerId])
    if (!ownerExists.length) {
      await execute(
        `INSERT INTO users (id, email, display_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id=id`,
        [s.ownerId, `${s.ownerId}@placeholder.local`, "Researcher", s.createdAt, s.updatedAt]
      )
    }

    await execute(
      `INSERT INTO studies (
        id, title, short_title, description, status, primary_cell_line,
        formulation_summary, fair_year, researcher_names, adviser_names,
        owner_id, contract_version, prediction_modules, laboratory_sections,
        laboratory_omissions, laboratory_evidence_at, docking_configurations,
        docking_readiness_acknowledgement, analysis_finalized_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title=VALUES(title), short_title=VALUES(short_title), description=VALUES(description),
        status=VALUES(status), primary_cell_line=VALUES(primary_cell_line), formulation_summary=VALUES(formulation_summary),
        fair_year=VALUES(fair_year), researcher_names=VALUES(researcher_names), adviser_names=VALUES(adviser_names),
        owner_id=VALUES(owner_id), contract_version=VALUES(contract_version), prediction_modules=VALUES(prediction_modules),
        laboratory_sections=VALUES(laboratory_sections), laboratory_omissions=VALUES(laboratory_omissions),
        laboratory_evidence_at=VALUES(laboratory_evidence_at), docking_configurations=VALUES(docking_configurations),
        docking_readiness_acknowledgement=VALUES(docking_readiness_acknowledgement),
        analysis_finalized_at=VALUES(analysis_finalized_at), updated_at=VALUES(updated_at)`,
      [
        s.id,
        s.title,
        s.shortTitle ?? null,
        s.description ?? null,
        s.status,
        s.primaryCellLine || "",
        s.formulationSummary || "",
        s.fairYear ?? null,
        toJson(s.researcherNames),
        toJson(s.adviserNames),
        s.ownerId,
        s.contractVersion || "2026-09-29",
        toJson(s.predictionModules),
        toJson(s.laboratorySections),
        toJson(s.laboratoryOmissions),
        s.laboratoryEvidenceAt ?? null,
        toJson(s.dockingConfigurations),
        toJson(s.dockingReadinessAcknowledgement),
        s.analysisFinalizedAt ?? null,
        s.createdAt,
        s.updatedAt,
      ]
    )
    recordSuccess("studies")

    const studyId = s.id

    // 3. Study Members
    recordStats("study_members")
    const membersSnap = await db.collection(`studies/${studyId}/members`).get()
    stats.study_members!.found += membersSnap.size
    for (const mDoc of membersSnap.docs) {
      const mRaw = { id: mDoc.id, ...mDoc.data() }
      const mParsed = StudyMemberSchema.safeParse(mRaw)
      if (!mParsed.success) {
        recordSkip("study_members", `Study ${studyId} member ${mDoc.id}: ${mParsed.error.message}`)
        continue
      }
      const m = mParsed.data
      // Ensure user exists
      const userEx = await query(`SELECT id FROM users WHERE id = ?`, [m.userId])
      if (!userEx.length) {
        await execute(
          `INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=id`,
          [m.userId, m.email, m.displayName, m.addedAt, m.addedAt]
        )
      }
      const memberId = `${studyId}_${m.userId}`
      await execute(
        `INSERT INTO study_members (id, study_id, user_id, email, display_name, role, added_at, added_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role=VALUES(role), display_name=VALUES(display_name)`,
        [memberId, studyId, m.userId, m.email, m.displayName, m.role, m.addedAt, m.addedBy]
      )
      recordSuccess("study_members")
    }

    // 4. Formulations
    recordStats("formulations")
    const formsSnap = await db.collection(`studies/${studyId}/formulations`).get()
    stats.formulations!.found += formsSnap.size
    for (const fDoc of formsSnap.docs) {
      const fRaw = { id: fDoc.id, ...fDoc.data() }
      const fParsed = FormulationSchema.safeParse(fRaw)
      if (!fParsed.success) {
        recordSkip("formulations", `Study ${studyId} formulation ${fDoc.id}: ${fParsed.error.message}`)
        continue
      }
      const f = fParsed.data
      await execute(
        `INSERT INTO formulations (
          id, study_id, name, plant_material, scientific_name, components,
          leaf_mass_g, nanocarrier_mass_g, total_mass_g, method_notes,
          storage_notes, marker_compound, marker_compound_id, reference_ids,
          is_canonical, provenance, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name), updated_at=VALUES(updated_at)`,
        [
          f.id,
          studyId,
          f.name,
          f.plantMaterial ?? null,
          f.scientificName ?? null,
          toJson(f.components),
          f.leafMassG ?? null,
          f.nanocarrierMassG ?? null,
          f.totalMassG ?? null,
          f.methodNotes ?? null,
          f.storageNotes ?? null,
          f.markerCompound ?? null,
          f.markerCompoundId ?? null,
          toJson(f.referenceIds),
          f.isCanonical ? 1 : 0,
          toJson(f.provenance),
          f.notes ?? null,
          f.createdAt,
          f.updatedAt,
          f.createdBy,
          f.updatedBy,
        ]
      )
      recordSuccess("formulations")
    }

    // 5. Phytochemicals (Compounds)
    recordStats("phytochemicals")
    const compSnap = await db.collection(`studies/${studyId}/compounds`).get()
    stats.phytochemicals!.found += compSnap.size
    for (const cDoc of compSnap.docs) {
      const cRaw = { id: cDoc.id, ...cDoc.data() }
      const cParsed = CompoundSchema.safeParse(cRaw)
      if (!cParsed.success) {
        recordSkip("phytochemicals", `Study ${studyId} compound ${cDoc.id}: ${cParsed.error.message}`)
        continue
      }
      const c = cParsed.data
      await execute(
        `INSERT INTO phytochemicals (
          id, study_id, name, pubchem_cid, smiles, isomeric_smiles, formula,
          molecular_weight, chemical_class, plant_part, source, is_primary_marker,
          reference_ids, screening_reviewed_at, provenance, notes, created_at, updated_at,
          created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name), pubchem_cid=VALUES(pubchem_cid), smiles=VALUES(smiles), updated_at=VALUES(updated_at)`,
        [
          c.id,
          studyId,
          c.name,
          c.pubchemCid ?? null,
          c.smiles ?? null,
          c.isomericSmiles ?? null,
          c.formula ?? null,
          c.molecularWeight ?? null,
          c.chemicalClass ?? null,
          c.plantPart ?? null,
          c.source ?? null,
          c.isPrimaryMarker ? 1 : 0,
          toJson(c.referenceIds),
          c.screeningReviewedAt ?? null,
          toJson(c.provenance),
          c.notes ?? null,
          c.createdAt,
          c.updatedAt,
          c.createdBy,
          c.updatedBy,
        ]
      )
      recordSuccess("phytochemicals")
    }

    // 6. Target Proteins
    recordStats("target_proteins")
    const protSnap = await db.collection(`studies/${studyId}/proteins`).get()
    stats.target_proteins!.found += protSnap.size
    for (const pDoc of protSnap.docs) {
      const pRaw = { id: pDoc.id, ...pDoc.data() }
      const pParsed = ProteinSchema.safeParse(pRaw)
      if (!pParsed.success) {
        recordSkip("target_proteins", `Study ${studyId} protein ${pDoc.id}: ${pParsed.error.message}`)
        continue
      }
      const p = pParsed.data
      await execute(
        `INSERT INTO target_proteins (
          id, study_id, name, gene, gene_symbol, protein_name, biological_target,
          pdb_id, pathway, role, function_notes, source, structure_title,
          structure_protein, structure_context, organism, chains, uniprot_ids,
          expected_title, expected_method, expected_resolution, expected_entities,
          verification_source, reference_ids, provenance, notes, created_at, updated_at,
          created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name), pdb_id=VALUES(pdb_id), updated_at=VALUES(updated_at)`,
        [
          p.id,
          studyId,
          p.name,
          p.gene ?? null,
          p.geneSymbol ?? null,
          p.proteinName ?? null,
          p.biologicalTarget ?? null,
          p.pdbId ?? null,
          p.pathway ?? null,
          p.role ?? null,
          p.functionNotes ?? null,
          p.source ?? null,
          p.structureTitle ?? null,
          p.structureProtein ?? null,
          p.structureContext ?? null,
          p.organism ?? null,
          toJson(p.chains),
          toJson(p.uniprotIds),
          p.expectedTitle ?? null,
          p.expectedMethod ?? null,
          p.expectedResolution ?? null,
          toJson(p.expectedEntities),
          p.verificationSource ?? null,
          toJson(p.referenceIds),
          toJson(p.provenance),
          p.notes ?? null,
          p.createdAt,
          p.updatedAt,
          p.createdBy,
          p.updatedBy,
        ]
      )
      recordSuccess("target_proteins")
    }

    // 7. Cell Lines
    recordStats("cell_lines")
    const cellSnap = await db.collection(`studies/${studyId}/cellLines`).get()
    stats.cell_lines!.found += cellSnap.size
    for (const clDoc of cellSnap.docs) {
      const clRaw = { id: clDoc.id, ...clDoc.data() }
      const clParsed = CellLineSchema.safeParse(clRaw)
      if (!clParsed.success) {
        recordSkip("cell_lines", `Study ${studyId} cellLine ${clDoc.id}: ${clParsed.error.message}`)
        continue
      }
      const cl = clParsed.data
      await execute(
        `INSERT INTO cell_lines (
          id, study_id, name, full_name, organism, tissue_origin, disease_context,
          line_type, p53_status, hbv_status, source_database, is_primary_experimental,
          reference_ids, provenance, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name), updated_at=VALUES(updated_at)`,
        [
          cl.id,
          studyId,
          cl.name,
          cl.fullName ?? null,
          cl.organism ?? null,
          cl.tissueOrigin ?? null,
          cl.diseaseContext ?? null,
          cl.lineType,
          cl.p53Status ?? null,
          cl.hbvStatus ?? null,
          cl.sourceDatabase ?? null,
          cl.isPrimaryExperimental ? 1 : 0,
          toJson(cl.referenceIds),
          toJson(cl.provenance),
          cl.notes ?? null,
          cl.createdAt,
          cl.updatedAt,
          cl.createdBy,
          cl.updatedBy,
        ]
      )
      recordSuccess("cell_lines")
    }

    // 8. ADMET Runs
    recordStats("admet_runs")
    const admetSnap = await db.collection(`studies/${studyId}/admetRuns`).get()
    stats.admet_runs!.found += admetSnap.size
    for (const aDoc of admetSnap.docs) {
      const aRaw = { id: aDoc.id, ...aDoc.data() }
      const aParsed = AdmetRunSchema.safeParse(aRaw)
      if (!aParsed.success) {
        recordSkip("admet_runs", `Study ${studyId} admetRun ${aDoc.id}: ${aParsed.error.message}`)
        continue
      }
      const a = aParsed.data
      // Verify foreign key compound_id exists
      let validCompId: string | null = null
      if (a.compoundId) {
        const compEx = await query(`SELECT id FROM phytochemicals WHERE id = ?`, [a.compoundId])
        if (compEx.length) validCompId = a.compoundId
      }
      await execute(
        `INSERT INTO admet_runs (
          id, study_id, compound_id, compound_name, tool_name, tool_version,
          provider, provider_version, model, normalizer_version, pubchem_cid,
          input_smiles, generated_at, pubchem_retrieved, lipinski_overall,
          descriptors, raw, status, assessment_origin, provenance, notes,
          created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status=VALUES(status), descriptors=VALUES(descriptors), updated_at=VALUES(updated_at)`,
        [
          a.id,
          studyId,
          validCompId,
          a.compoundName ?? null,
          a.toolName ?? null,
          a.toolVersion ?? null,
          a.provider ?? null,
          a.providerVersion ?? null,
          a.model ?? null,
          a.normalizerVersion ?? null,
          a.pubchemCid ?? null,
          a.inputSmiles ?? null,
          a.generatedAt ?? null,
          a.pubchemRetrieved !== undefined ? (a.pubchemRetrieved ? 1 : 0) : null,
          a.lipinskiOverall ?? null,
          toJson(a.descriptors || {}),
          toJson(a.raw),
          a.status,
          a.assessmentOrigin ?? null,
          toJson(a.provenance),
          a.notes ?? null,
          a.createdAt,
          a.updatedAt,
          a.createdBy,
          a.updatedBy,
        ]
      )
      recordSuccess("admet_runs")
    }

    // 9. Docking Pairs
    recordStats("docking_pairs")
    const dpSnap = await db.collection(`studies/${studyId}/dockingPairs`).get()
    stats.docking_pairs!.found += dpSnap.size
    for (const dpDoc of dpSnap.docs) {
      const dpRaw = { id: dpDoc.id, ...dpDoc.data() }
      const dpParsed = DockingPairSchema.safeParse(dpRaw)
      if (!dpParsed.success) {
        recordSkip("docking_pairs", `Study ${studyId} dockingPair ${dpDoc.id}: ${dpParsed.error.message}`)
        continue
      }
      const dp = dpParsed.data
      // Validate foreign keys
      const compEx = await query(`SELECT id FROM phytochemicals WHERE id = ?`, [dp.compoundId])
      const protEx = await query(`SELECT id FROM target_proteins WHERE id = ?`, [dp.proteinId])
      if (!compEx.length || !protEx.length) {
        recordSkip("docking_pairs", `Skipping dockingPair ${dp.id}: compound or protein missing in study`)
        continue
      }
      await execute(
        `INSERT INTO docking_pairs (
          id, study_id, compound_id, protein_id, target_id, compound_name, target_name,
          status, latest_run_id, latest_binding_affinity, runs_count, archived,
          provenance, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status=VALUES(status), latest_run_id=VALUES(latest_run_id), latest_binding_affinity=VALUES(latest_binding_affinity), runs_count=VALUES(runs_count), updated_at=VALUES(updated_at)`,
        [
          dp.id,
          studyId,
          dp.compoundId,
          dp.proteinId,
          dp.targetId ?? null,
          dp.compoundName ?? null,
          dp.targetName ?? null,
          dp.status,
          dp.latestRunId ?? null,
          dp.latestBindingAffinity ?? null,
          dp.runsCount,
          dp.archived ? 1 : 0,
          toJson(dp.provenance),
          dp.notes ?? null,
          dp.createdAt,
          dp.updatedAt,
          dp.createdBy,
          dp.updatedBy,
        ]
      )
      recordSuccess("docking_pairs")
    }

    // 10. Docking Runs
    recordStats("docking_runs")
    const drSnap = await db.collection(`studies/${studyId}/dockingRuns`).get()
    stats.docking_runs!.found += drSnap.size
    for (const drDoc of drSnap.docs) {
      const drRaw = { id: drDoc.id, ...drDoc.data() }
      const drParsed = DockingRunSchema.safeParse(drRaw)
      if (!drParsed.success) {
        recordSkip("docking_runs", `Study ${studyId} dockingRun ${drDoc.id}: ${drParsed.error.message}`)
        continue
      }
      const dr = drParsed.data
      const pairId = dr.pairId || canonicalDockingPairDocId(dr.compoundId, dr.proteinId)

      // Ensure pair exists first
      const pairEx = await query(`SELECT id FROM docking_pairs WHERE id = ?`, [pairId])
      if (!pairEx.length) {
        // Create canonical pair if not already created
        const compEx = await query(`SELECT id FROM phytochemicals WHERE id = ?`, [dr.compoundId])
        const protEx = await query(`SELECT id FROM target_proteins WHERE id = ?`, [dr.proteinId])
        if (!compEx.length || !protEx.length) {
          recordSkip("docking_runs", `Skipping dockingRun ${dr.id}: compound or protein does not exist`)
          continue
        }
        await execute(
          `INSERT INTO docking_pairs (
            id, study_id, compound_id, protein_id, target_id, compound_name, target_name,
            status, latest_run_id, latest_binding_affinity, runs_count, archived,
            provenance, notes, created_at, updated_at, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE id=id`,
          [
            pairId,
            studyId,
            dr.compoundId,
            dr.proteinId,
            dr.proteinId,
            dr.ligandName ?? null,
            dr.researchTarget ?? null,
            "COMPLETED",
            dr.id,
            dr.bestBindingAffinityKcalMol,
            1,
            0,
            toJson(dr.provenance),
            dr.notes ?? null,
            dr.createdAt,
            dr.updatedAt,
            dr.createdBy,
            dr.updatedBy,
          ]
        )
      }

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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE best_binding_affinity_kcal_mol=VALUES(best_binding_affinity_kcal_mol), updated_at=VALUES(updated_at)`,
        [
          dr.id,
          studyId,
          pairId,
          dr.runName,
          dr.compoundId,
          dr.proteinId,
          dr.vinaVersion ?? null,
          dr.receptorPdbId ?? null,
          dr.ligandName ?? null,
          dr.ligandPubchemCid ?? null,
          dr.exhaustiveness ?? null,
          dr.numModes ?? null,
          dr.energyRange ?? null,
          toJson(dr.searchBox),
          toJson(dr.modes),
          dr.bestBindingAffinityKcalMol,
          dr.selectedMode ?? null,
          toJson(dr.interactions),
          dr.interactingResidues ?? null,
          dr.interactionNotes ?? null,
          dr.sourceFileName ?? null,
          dr.poseFileName ?? null,
          dr.poseModel ?? null,
          dr.ligandSource ?? null,
          dr.receptorSource ?? null,
          dr.dockingProfileId ?? null,
          dr.dockingProfileVersion ?? null,
          dr.researchTarget ?? null,
          dr.actualDockingReceptor ?? null,
          dr.structureSource ?? null,
          dr.structureId ?? null,
          dr.structureMethod ?? null,
          dr.receptorUniProt ?? null,
          toJson(dr.receptorChains),
          dr.referenceEntity ?? null,
          dr.bindingSiteSource ?? null,
          dr.gridDerivation ?? null,
          toJson(dr.gridCenter),
          toJson(dr.gridSize),
          dr.modelSource ?? null,
          dr.modelVersion ?? null,
          dr.modelConfidence ?? null,
          dr.bindingSiteValidationMethod ?? null,
          dr.executionStatus ?? null,
          dr.completedAt ?? null,
          dr.status,
          toJson(dr.provenance),
          dr.notes ?? null,
          dr.createdAt,
          dr.updatedAt,
          dr.createdBy,
          dr.updatedBy,
        ]
      )
      recordSuccess("docking_runs")
    }

    // 11. Docking Jobs
    recordStats("docking_jobs")
    const djSnap = await db.collection(`studies/${studyId}/dockingJobs`).get()
    stats.docking_jobs!.found += djSnap.size
    for (const djDoc of djSnap.docs) {
      const dj = djDoc.data()
      await execute(
        `INSERT INTO docking_jobs (
          id, study_id, compound_id, protein_id, status, stage, error, run_id, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status=VALUES(status), stage=VALUES(stage), error=VALUES(error), updated_at=VALUES(updated_at)`,
        [
          djDoc.id,
          studyId,
          dj.compoundId,
          dj.proteinId,
          dj.status,
          dj.stage ?? null,
          dj.error ?? null,
          dj.runId ?? null,
          dj.createdAt,
          dj.updatedAt,
          dj.completedAt ?? null,
        ]
      )
      recordSuccess("docking_jobs")
    }

    // 12. Biological Predictions
    recordStats("biological_predictions")
    const predSnap = await db.collection(`studies/${studyId}/predictionRuns`).get()
    stats.biological_predictions!.found += predSnap.size
    for (const prDoc of predSnap.docs) {
      const prRaw = { id: prDoc.id, ...prDoc.data() }
      const prParsed = PredictionRunSchema.safeParse(prRaw)
      if (!prParsed.success) {
        recordSkip("biological_predictions", `Study ${studyId} predictionRun ${prDoc.id}: ${prParsed.error.message}`)
        continue
      }
      const pr = prParsed.data
      await execute(
        `INSERT INTO biological_predictions (
          id, study_id, endpoint, run_name, compound_id, formulation_id, cell_line_id,
          protein_id, summary_ic50, summary_ic50_unit, summary_maximum, summary_maximum_unit,
          teac, selectivity_index, pathway_effect, concentration_unit_label, method_name,
          method_version, method_type, source, reference_ids, assumptions, limitations,
          concentration_unit, input_parameters, date_generated, operator_name, result_points,
          status, provenance, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE run_name=VALUES(run_name), summary_ic50=VALUES(summary_ic50), updated_at=VALUES(updated_at)`,
        [
          pr.id,
          studyId,
          pr.endpoint,
          pr.runName,
          pr.compoundId ?? null,
          pr.formulationId ?? null,
          pr.cellLineId ?? null,
          pr.proteinId ?? null,
          pr.summaryIc50 ?? null,
          pr.summaryIc50Unit ?? null,
          pr.summaryMaximum ?? null,
          pr.summaryMaximumUnit ?? null,
          pr.teac ?? null,
          pr.selectivityIndex ?? null,
          pr.pathwayEffect ?? null,
          pr.concentrationUnitLabel ?? null,
          pr.methodName,
          pr.methodVersion ?? null,
          pr.methodType,
          pr.source,
          toJson(pr.referenceIds),
          pr.assumptions ?? null,
          pr.limitations ?? null,
          pr.concentrationUnit,
          toJson(pr.inputParameters),
          pr.dateGenerated,
          pr.operatorName ?? null,
          toJson(pr.resultPoints),
          pr.status,
          toJson(pr.provenance),
          pr.notes ?? null,
          pr.createdAt,
          pr.updatedAt,
          pr.createdBy,
          pr.updatedBy,
        ]
      )
      recordSuccess("biological_predictions")
    }

    // 13. Laboratory Datasets
    recordStats("laboratory_datasets")
    recordStats("laboratory_replicates")
    const labSnap = await db.collection(`studies/${studyId}/labDatasets`).get()
    stats.laboratory_datasets!.found += labSnap.size
    for (const lDoc of labSnap.docs) {
      const lRaw = { id: lDoc.id, ...lDoc.data() }
      const lParsed = LabDatasetSchema.safeParse(lRaw)
      if (!lParsed.success) {
        recordSkip("laboratory_datasets", `Study ${studyId} labDataset ${lDoc.id}: ${lParsed.error.message}`)
        continue
      }
      const l = lParsed.data
      await execute(
        `INSERT INTO laboratory_datasets (
          id, study_id, assay_type, dataset_name, endpoint_type, formulation_id,
          compound_id, cell_line_id, cell_line_name, protein_id, laboratory_name,
          date_performed, protocol_reference, kit_name, kit_manufacturer, instrument,
          wavelength_nm, operator_name, outsourced_lab, concentration_unit,
          control_t1_detail, control_t2_detail, treatment_summaries, observations,
          ic50, characterization, status, provenance, notes, created_at, updated_at,
          created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE dataset_name=VALUES(dataset_name), updated_at=VALUES(updated_at)`,
        [
          l.id,
          studyId,
          l.assayType,
          l.datasetName,
          l.endpointType ?? null,
          l.formulationId ?? null,
          l.compoundId ?? null,
          l.cellLineId ?? null,
          l.cellLineName ?? null,
          l.proteinId ?? null,
          l.laboratoryName || "",
          l.datePerformed,
          l.protocolReference || "",
          l.kitName ?? null,
          l.kitManufacturer ?? null,
          l.instrument ?? null,
          l.wavelengthNm ?? null,
          l.operatorName ?? null,
          l.outsourcedLab ? 1 : 0,
          l.concentrationUnit ?? null,
          l.controlT1Detail ?? null,
          l.controlT2Detail ?? null,
          toJson(l.treatmentSummaries),
          toJson(l.observations),
          toJson(l.ic50),
          toJson(l.characterization),
          l.status,
          toJson(l.provenance),
          l.notes ?? null,
          l.createdAt,
          l.updatedAt,
          l.createdBy,
          l.updatedBy,
        ]
      )
      recordSuccess("laboratory_datasets")

      // Replicates subcollection
      const repSnap = await lDoc.ref.collection("replicates").get()
      stats.laboratory_replicates!.found += repSnap.size
      for (const rDoc of repSnap.docs) {
        const rRaw = { id: rDoc.id, datasetId: l.id, studyId, ...rDoc.data() }
        const rParsed = LabReplicateSchema.safeParse(rRaw)
        if (!rParsed.success) {
          recordSkip("laboratory_replicates", `Dataset ${l.id} replicate ${rDoc.id}: ${rParsed.error.message}`)
          continue
        }
        const r = rParsed.data
        await execute(
          `INSERT INTO laboratory_replicates (
            id, dataset_id, study_id, treatment_code, replicate_code, replicate_n,
            concentration, concentration_unit, measurements, notes, data_class,
            created_at, updated_at, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE measurements=VALUES(measurements), updated_at=VALUES(updated_at)`,
          [
            r.id,
            l.id,
            studyId,
            r.treatmentCode,
            r.replicateCode,
            r.replicateN ?? null,
            r.concentration ?? null,
            r.concentrationUnit ?? null,
            toJson(r.measurements),
            r.notes ?? null,
            r.dataClass,
            r.createdAt,
            r.updatedAt,
            r.createdBy,
            r.updatedBy ?? null,
          ]
        )
        recordSuccess("laboratory_replicates")
      }
    }

    // 15. Statistics Analyses
    recordStats("statistics_analyses")
    const statSnap = await db.collection(`studies/${studyId}/statistics`).get()
    stats.statistics_analyses!.found += statSnap.size
    for (const sDoc of statSnap.docs) {
      const sRaw = { id: sDoc.id, ...sDoc.data() }
      const sParsed = StatisticsRecordSchema.safeParse(sRaw)
      if (!sParsed.success) {
        recordSkip("statistics_analyses", `Study ${studyId} statistics ${sDoc.id}: ${sParsed.error.message}`)
        continue
      }
      const st = sParsed.data
      await execute(
        `INSERT INTO statistics_analyses (
          id, study_id, assay_type, lab_dataset_id, lab_dataset_name, measurement_key,
          measurement_label, alpha, source_dataset_updated_at, source_fingerprint,
          treatment_summaries, completeness, anova, scheffe_comparisons, scheffe_message,
          calculation_method, calculation_version, calculated_at, calculated_by, status,
          provenance, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE anova=VALUES(anova), scheffe_comparisons=VALUES(scheffe_comparisons), updated_at=VALUES(updated_at)`,
        [
          st.id,
          studyId,
          st.assayType,
          st.labDatasetId,
          st.labDatasetName,
          st.measurementKey,
          st.measurementLabel,
          st.alpha,
          st.sourceDatasetUpdatedAt,
          st.sourceFingerprint,
          toJson(st.treatmentSummaries),
          toJson(st.completeness),
          toJson(st.anova),
          toJson(st.scheffeComparisons),
          st.scheffeMessage ?? null,
          st.calculationMethod,
          st.calculationVersion,
          st.calculatedAt,
          st.calculatedBy,
          st.status,
          toJson(st.provenance),
          st.notes ?? null,
          st.createdAt,
          st.updatedAt,
          st.createdBy,
          st.updatedBy,
        ]
      )
      recordSuccess("statistics_analyses")
    }

    // 16. Comparisons
    recordStats("comparisons")
    const compSnap2 = await db.collection(`studies/${studyId}/comparisons`).get()
    stats.comparisons!.found += compSnap2.size
    for (const cmpDoc of compSnap2.docs) {
      const cmpRaw = { id: cmpDoc.id, ...cmpDoc.data() }
      const cmpParsed = ComparisonRecordSchema.safeParse(cmpRaw)
      if (!cmpParsed.success) {
        recordSkip("comparisons", `Study ${studyId} comparison ${cmpDoc.id}: ${cmpParsed.error.message}`)
        continue
      }
      const cmp = cmpParsed.data
      await execute(
        `INSERT INTO comparisons (
          id, study_id, endpoint, prediction_run_id, prediction_run_name,
          prediction_evidence_class, lab_dataset_id, lab_dataset_name, experimental_metric_key,
          statistics_analysis_id, statistics_freshness_at_save, compatibility_status,
          compatibility_reasons, comparison_mode, aligned_points, researcher_notes,
          source_prediction_updated_at, source_lab_updated_at, source_statistics_updated_at,
          source_fingerprint, calculation_method, calculation_version, metrics,
          concordance_flag, status, provenance, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE aligned_points=VALUES(aligned_points), updated_at=VALUES(updated_at)`,
        [
          cmp.id,
          studyId,
          cmp.endpoint,
          cmp.predictionRunId,
          cmp.predictionRunName ?? null,
          cmp.predictionEvidenceClass,
          cmp.labDatasetId,
          cmp.labDatasetName ?? null,
          cmp.experimentalMetricKey,
          cmp.statisticsAnalysisId ?? null,
          cmp.statisticsFreshnessAtSave ?? null,
          cmp.compatibilityStatus,
          toJson(cmp.compatibilityReasons),
          cmp.comparisonMode,
          toJson(cmp.alignedPoints),
          cmp.researcherNotes ?? null,
          cmp.sourcePredictionUpdatedAt,
          cmp.sourceLabUpdatedAt,
          cmp.sourceStatisticsUpdatedAt ?? null,
          cmp.sourceFingerprint,
          cmp.calculationMethod,
          cmp.calculationVersion,
          toJson(cmp.metrics),
          cmp.concordanceFlag,
          cmp.status,
          toJson(cmp.provenance),
          cmp.notes ?? null,
          cmp.createdAt,
          cmp.updatedAt,
          cmp.createdBy,
          cmp.updatedBy,
        ]
      )
      recordSuccess("comparisons")
    }

    // 17. Interpretations
    recordStats("interpretations")
    const interpSnap = await db.collection(`studies/${studyId}/interpretations`).get()
    stats.interpretations!.found += interpSnap.size
    for (const inDoc of interpSnap.docs) {
      const inRaw = { id: inDoc.id, ...inDoc.data() }
      const inParsed = InterpretationSchema.safeParse(inRaw)
      if (!inParsed.success) {
        recordSkip("interpretations", `Study ${studyId} interpretation ${inDoc.id}: ${inParsed.error.message}`)
        continue
      }
      const interp = inParsed.data
      await execute(
        `INSERT INTO interpretations (
          id, study_id, title, body, research_question, research_objective, hypothesis_text,
          research_question_preset_id, linked_evidence, computational_summary, experimental_summary,
          statistical_summary, comparison_summary, interpretation_text, limitations, conclusion,
          endpoint_findings, docking_interpretation, characterization_interpretation, generated_by,
          provider, model, generated_at, evidence_version, ai_assistance, hypothesis_assessment,
          assessment_rationale, assessment_selected_by, assessment_selected_at, status,
          source_fingerprint, provenance, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title=VALUES(title), interpretation_text=VALUES(interpretation_text), updated_at=VALUES(updated_at)`,
        [
          interp.id,
          studyId,
          interp.title,
          interp.body ?? null,
          interp.researchQuestion || "",
          interp.researchObjective || "",
          interp.hypothesisText ?? null,
          interp.researchQuestionPresetId ?? null,
          toJson(interp.linkedEvidence),
          interp.computationalSummary ?? null,
          interp.experimentalSummary ?? null,
          interp.statisticalSummary ?? null,
          interp.comparisonSummary ?? null,
          interp.interpretationText ?? null,
          interp.limitations ?? null,
          interp.conclusion ?? null,
          toJson(interp.endpointFindings),
          interp.dockingInterpretation ?? null,
          interp.characterizationInterpretation ?? null,
          interp.generatedBy ?? null,
          interp.provider ?? null,
          interp.model ?? null,
          interp.generatedAt ?? null,
          interp.evidenceVersion ?? null,
          toJson(interp.aiAssistance),
          interp.hypothesisAssessment,
          interp.assessmentRationale ?? null,
          interp.assessmentSelectedBy ?? null,
          interp.assessmentSelectedAt ?? null,
          interp.status,
          interp.sourceFingerprint ?? null,
          toJson(interp.provenance),
          interp.notes ?? null,
          interp.createdAt,
          interp.updatedAt,
          interp.createdBy,
          interp.updatedBy,
        ]
      )
      recordSuccess("interpretations")
    }

    // 18. References
    recordStats("references")
    const refSnap = await db.collection(`studies/${studyId}/references`).get()
    stats.references!.found += refSnap.size
    for (const rDoc of refSnap.docs) {
      const rRaw = { id: rDoc.id, ...rDoc.data() }
      const rParsed = ReferenceRecordSchema.safeParse(rRaw)
      if (!rParsed.success) {
        recordSkip("references", `Study ${studyId} reference ${rDoc.id}: ${rParsed.error.message}`)
        continue
      }
      const ref = rParsed.data
      await execute(
        `INSERT INTO \`references\` (
          id, study_id, title, authors, year, journal, doi, pmid, url,
          retrieved_at, citation_text, provenance, notes, created_at, updated_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title=VALUES(title), updated_at=VALUES(updated_at)`,
        [
          ref.id,
          studyId,
          ref.title,
          ref.authors ?? null,
          ref.year ?? null,
          ref.journal ?? null,
          ref.doi ?? null,
          ref.pmid ?? null,
          ref.url ?? null,
          ref.retrievedAt ?? null,
          ref.citationText ?? null,
          toJson(ref.provenance),
          ref.notes ?? null,
          ref.createdAt,
          ref.updatedAt,
          ref.createdBy,
          ref.updatedBy,
        ]
      )
      recordSuccess("references")
    }

    // 19. Audit Logs
    recordStats("audit_logs")
    const alSnap = await db.collection(`studies/${studyId}/auditLogs`).get()
    stats.audit_logs!.found += alSnap.size
    for (const alDoc of alSnap.docs) {
      const alRaw = { id: alDoc.id, ...alDoc.data() }
      const alParsed = AuditLogSchema.safeParse(alRaw)
      if (!alParsed.success) {
        recordSkip("audit_logs", `Study ${studyId} auditLog ${alDoc.id}: ${alParsed.error.message}`)
        continue
      }
      const al = alParsed.data
      await execute(
        `INSERT INTO audit_logs (id, study_id, actor_id, action, entity_type, entity_id, at, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id=id`,
        [al.id, studyId, al.actorId, al.action, al.entityType, al.entityId ?? null, al.at, toJson(al.meta)]
      )
      recordSuccess("audit_logs")
    }
  }

  // 20. Literature Cache
  recordStats("literature_cache")
  const litSnap = await db.collection("literatureCache").get()
  stats.literature_cache!.found = litSnap.size
  for (const lDoc of litSnap.docs) {
    const data = lDoc.data()
    await execute(
      `INSERT INTO literature_cache (id, query, endpoint, compound, retrieved_at, source, pmids, dois, papers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE retrieved_at=VALUES(retrieved_at), papers=VALUES(papers)`,
      [
        lDoc.id,
        data.query || "",
        data.endpoint ?? null,
        data.compound ?? null,
        data.retrievedAt || new Date().toISOString(),
        data.source || "PubMed",
        toJson(data.pmids),
        toJson(data.dois),
        toJson(data.papers || []),
      ]
    )
    recordSuccess("literature_cache")
  }

  console.log("\n=== MIGRATION SUMMARY ===")
  let totalFound = 0
  let totalMigrated = 0
  let totalSkipped = 0
  for (const [entity, s] of Object.entries(stats)) {
    console.log(
      `  ${entity.padEnd(25)}: found ${String(s.found).padStart(3)}, migrated ${String(s.migrated).padStart(3)}, skipped ${String(s.skipped).padStart(3)}`
    )
    totalFound += s.found
    totalMigrated += s.migrated
    totalSkipped += s.skipped
    if (s.errors.length) {
      s.errors.forEach((err) => console.log(`    ! ${err}`))
    }
  }
  console.log(`TOTAL RECORDS FOUND    : ${totalFound}`)
  console.log(`TOTAL RECORDS MIGRATED : ${totalMigrated}`)
  console.log(`TOTAL RECORDS SKIPPED  : ${totalSkipped}`)
  console.log("=== MIGRATION COMPLETED SUCCESSFULLY ===")

  await closePool()
}

if (process.argv[1] && process.argv[1].endsWith("migrate-firestore-to-mysql.ts")) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err)
      process.exit(1)
    })
}
