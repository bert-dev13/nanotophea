import type {
  UserProfile,
  Study,
  StudyMember,
  Formulation,
  NanoparticleFormulation,
  Compound,
  Protein,
  CellLineRecord,
  AdmetRun,
  DockingPair,
  DockingRun,
  PredictionRun,
  LabDataset,
  LabReplicate,
  StatisticsRecord,
  ComparisonRecord,
  Interpretation,
  ReferenceRecord,
  AuditLog,
} from "@/lib/domain/models"
import {
  UserProfileSchema,
  StudySchema,
  StudyMemberSchema,
  FormulationSchema,
  NanoparticleFormulationSchema,
  CompoundSchema,
  ProteinSchema,
  CellLineSchema,
  AdmetRunSchema,
  DockingPairSchema,
  DockingRunSchema,
  PredictionRunSchema,
  LabDatasetSchema,
  LabReplicateSchema,
  StatisticsRecordSchema,
  ComparisonRecordSchema,
  InterpretationSchema,
  ReferenceRecordSchema,
  AuditLogSchema,
} from "@/lib/domain/models"

export function parseJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === "object") return val as T
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

export function parseOptionalJson<T>(val: unknown): T | undefined {
  if (val === null || val === undefined) return undefined
  if (typeof val === "object") return val as T
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T
    } catch {
      return undefined
    }
  }
  return undefined
}

export function mapUser(row: any): UserProfile {
  return UserProfileSchema.parse({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    photoURL: row.photo_url ?? null,
    defaultRole: row.default_role || row.role || "VIEWER",
    role: row.role || row.default_role || "VIEWER",
    isActive: row.is_active === 1 || row.is_active === true || row.is_active === undefined,
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

export function mapStudy(row: any): Study {
  return StudySchema.parse({
    id: row.id,
    title: row.title,
    shortTitle: row.short_title ?? undefined,
    description: row.description ?? undefined,
    status: row.status,
    primaryCellLine: row.primary_cell_line || "",
    formulationSummary: row.formulation_summary || "",
    fairYear: row.fair_year ?? undefined,
    researcherNames: parseOptionalJson<string[]>(row.researcher_names),
    adviserNames: parseOptionalJson<string[]>(row.adviser_names),
    ownerId: row.owner_id,
    memberIds: parseOptionalJson<string[]>(row.member_ids) ?? [row.owner_id],
    contractVersion: row.contract_version || "2026-09-29",
    predictionModules: parseOptionalJson(row.prediction_modules),
    laboratorySections: parseOptionalJson(row.laboratory_sections),
    laboratoryOmissions: parseOptionalJson(row.laboratory_omissions),
    laboratoryEvidenceAt: row.laboratory_evidence_at ?? undefined,
    dockingConfigurations: parseOptionalJson(row.docking_configurations),
    dockingReadinessAcknowledgement: parseOptionalJson(row.docking_readiness_acknowledgement),
    analysisFinalizedAt: row.analysis_finalized_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

export function mapStudyMember(row: any): StudyMember {
  return StudyMemberSchema.parse({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    addedAt: row.added_at,
    addedBy: row.added_by,
  })
}

export function mapFormulation(row: any): Formulation {
  return FormulationSchema.parse({
    id: row.id,
    studyId: row.study_id,
    name: row.name,
    plantMaterial: row.plant_material ?? undefined,
    scientificName: row.scientific_name ?? undefined,
    components: parseJson(row.components, []),
    leafMassG: row.leaf_mass_g ?? undefined,
    nanocarrierMassG: row.nanocarrier_mass_g ?? undefined,
    totalMassG: row.total_mass_g ?? undefined,
    methodNotes: row.method_notes ?? undefined,
    storageNotes: row.storage_notes ?? undefined,
    markerCompound: row.marker_compound ?? undefined,
    markerCompoundId: row.marker_compound_id ?? undefined,
    referenceIds: parseJson(row.reference_ids, []),
    isCanonical: Boolean(row.is_canonical),
    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapNanoparticleFormulation(row: any): NanoparticleFormulation {
  return NanoparticleFormulationSchema.parse({
    id: row.id,
    studyId: row.study_id,
        systemName: row.system_name || "Chitosan–TPP Nanoparticle System",
    carrierType: row.carrier_type || "chitosan_tpp",
    recordType: row.record_type || "research",

    chitosanConcentration: row.chitosan_concentration ?? undefined,
    chitosanConcentrationUnit: row.chitosan_concentration_unit || "mg/mL",
    chitosanMolecularWeight: row.chitosan_molecular_weight ?? undefined,
    chitosanMwUnit: row.chitosan_mw_unit || "kDa",
    chitosanDeacetylationDegree: row.chitosan_deacetylation_degree ?? undefined,
    chitosanSolvent: row.chitosan_solvent ?? undefined,
    chitosanPh: row.chitosan_ph ?? undefined,

    tppConcentration: row.tpp_concentration ?? undefined,
    tppConcentrationUnit: row.tpp_concentration_unit || "mg/mL",
    tppPh: row.tpp_ph ?? undefined,

    chitosanTppRatio: row.chitosan_tpp_ratio ?? undefined,
    mixingMethod: row.mixing_method ?? undefined,
    additionMethod: row.addition_method ?? undefined,
    stirringRate: row.stirring_rate ?? undefined,
    stirringDuration: row.stirring_duration ?? undefined,
    temperature: row.temperature ?? undefined,
    preparationNotes: row.preparation_notes ?? undefined,
    preparationProtocol: parseOptionalJson(row.preparation_protocol),

    particleSizeNm: row.particle_size_nm != null ? Number(row.particle_size_nm) : undefined,
    pdi: row.pdi != null ? Number(row.pdi) : undefined,
    zetaPotentialMv: row.zeta_potential_mv != null ? Number(row.zeta_potential_mv) : undefined,
    encapsulationEfficiencyPercent: row.encapsulation_efficiency_percent != null ? Number(row.encapsulation_efficiency_percent) : undefined,
    loadingCapacityPercent: row.loading_capacity_percent != null ? Number(row.loading_capacity_percent) : undefined,
    instrument: row.instrument ?? undefined,
    measurementMethod: row.measurement_method ?? undefined,
    experimentDate: row.experiment_date ?? undefined,
    researcher: row.researcher ?? undefined,
    sampleBatchId: row.sample_batch_id ?? undefined,
    characterizationNotes: row.characterization_notes ?? undefined,

    computationalStatus: row.computational_status || "not_configured",
    computationalNotes: row.computational_notes ?? undefined,

    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    referenceIds: parseJson(row.reference_ids, []),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapCompound(row: any): Compound {
  return CompoundSchema.parse({
    id: row.id,
    studyId: row.study_id,
    name: row.name,
    pubchemCid: row.pubchem_cid ?? undefined,
    smiles: row.smiles ?? undefined,
    isomericSmiles: row.isomeric_smiles ?? undefined,
    formula: row.formula ?? undefined,
    molecularWeight: row.molecular_weight ?? undefined,
    chemicalClass: row.chemical_class ?? undefined,
    plantPart: row.plant_part ?? undefined,
    source: row.source ?? undefined,
    isPrimaryMarker: Boolean(row.is_primary_marker),
    referenceIds: parseJson(row.reference_ids, []),
    screeningReviewedAt: row.screening_reviewed_at ?? undefined,
    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapProtein(row: any): Protein {
  return ProteinSchema.parse({
    id: row.id,
    studyId: row.study_id,
    name: row.name,
    gene: row.gene ?? undefined,
    geneSymbol: row.gene_symbol ?? undefined,
    proteinName: row.protein_name ?? undefined,
    biologicalTarget: row.biological_target ?? undefined,
    pdbId: row.pdb_id ?? undefined,
    pathway: row.pathway ?? undefined,
    role: row.role ?? undefined,
    functionNotes: row.function_notes ?? undefined,
    source: row.source ?? undefined,
    structureTitle: row.structure_title ?? undefined,
    structureProtein: row.structure_protein ?? undefined,
    structureContext: row.structure_context ?? undefined,
    organism: row.organism ?? undefined,
    chains: parseOptionalJson(row.chains),
    uniprotIds: parseOptionalJson(row.uniprot_ids),
    expectedTitle: row.expected_title ?? undefined,
    expectedMethod: row.expected_method ?? undefined,
    expectedResolution: row.expected_resolution ?? undefined,
    expectedEntities: parseOptionalJson(row.expected_entities),
    verificationSource: row.verification_source ?? undefined,
    referenceIds: parseJson(row.reference_ids, []),
    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapCellLine(row: any): CellLineRecord {
  return CellLineSchema.parse({
    id: row.id,
    studyId: row.study_id,
    name: row.name,
    fullName: row.full_name ?? undefined,
    organism: row.organism ?? undefined,
    tissueOrigin: row.tissue_origin ?? undefined,
    diseaseContext: row.disease_context ?? undefined,
    lineType: row.line_type,
    p53Status: row.p53_status ?? undefined,
    hbvStatus: row.hbv_status ?? undefined,
    sourceDatabase: row.source_database ?? undefined,
    isPrimaryExperimental: Boolean(row.is_primary_experimental),
    referenceIds: parseJson(row.reference_ids, []),
    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapAdmetRun(row: any): AdmetRun {
  return AdmetRunSchema.parse({
    id: row.id,
    studyId: row.study_id,
    compoundId: row.compound_id ?? undefined,
    compoundName: row.compound_name ?? undefined,
    toolName: row.tool_name ?? undefined,
    toolVersion: row.tool_version ?? undefined,
    provider: row.provider ?? undefined,
    providerVersion: row.provider_version ?? undefined,
    model: row.model ?? undefined,
    normalizerVersion: row.normalizer_version ?? undefined,
    pubchemCid: row.pubchem_cid ?? undefined,
    inputSmiles: row.input_smiles ?? undefined,
    generatedAt: row.generated_at ?? undefined,
    pubchemRetrieved: row.pubchem_retrieved !== null ? Boolean(row.pubchem_retrieved) : undefined,
    lipinskiOverall: row.lipinski_overall ?? undefined,
    descriptors: parseJson(row.descriptors, {}),
    raw: parseOptionalJson(row.raw),
    status: row.status,
    assessmentOrigin: row.assessment_origin ?? undefined,
    provenance: parseJson(row.provenance, { evidenceClass: "PREDICTED" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapDockingPair(row: any): DockingPair {
  return DockingPairSchema.parse({
    id: row.id,
    studyId: row.study_id,
    compoundId: row.compound_id,
    proteinId: row.protein_id,
    targetId: row.target_id ?? undefined,
    compoundName: row.compound_name ?? undefined,
    targetName: row.target_name ?? undefined,
    status: row.status,
    latestRunId: row.latest_run_id ?? null,
    latestBindingAffinity: row.latest_binding_affinity ?? null,
    runsCount: row.runs_count ?? 0,
    archived: Boolean(row.archived),
    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapDockingRun(row: any): DockingRun {
  return DockingRunSchema.parse({
    id: row.id,
    studyId: row.study_id,
    pairId: row.pair_id,
    runName: row.run_name,
    compoundId: row.compound_id,
    proteinId: row.protein_id,
    vinaVersion: row.vina_version ?? undefined,
    receptorPdbId: row.receptor_pdb_id ?? undefined,
    ligandName: row.ligand_name ?? undefined,
    ligandPubchemCid: row.ligand_pubchem_cid ?? undefined,
    exhaustiveness: row.exhaustiveness ?? undefined,
    numModes: row.num_modes ?? undefined,
    energyRange: row.energy_range ?? undefined,
    searchBox: parseOptionalJson(row.search_box),
    modes: parseJson(row.modes, []),
    bestBindingAffinityKcalMol: row.best_binding_affinity_kcal_mol,
    selectedMode: row.selected_mode ?? undefined,
    interactions: parseJson(row.interactions, []),
    interactingResidues: row.interacting_residues ?? undefined,
    interactionNotes: row.interaction_notes ?? undefined,
    sourceFileName: row.source_file_name ?? undefined,
    poseFileName: row.pose_file_name ?? undefined,
    poseModel: row.pose_model ?? undefined,
    ligandSource: row.ligand_source ?? undefined,
    receptorSource: row.receptor_source ?? undefined,
    dockingProfileId: row.docking_profile_id ?? undefined,
    dockingProfileVersion: row.docking_profile_version ?? undefined,
    researchTarget: row.research_target ?? undefined,
    actualDockingReceptor: row.actual_docking_receptor ?? undefined,
    structureSource: row.structure_source ?? undefined,
    structureId: row.structure_id ?? undefined,
    structureMethod: row.structure_method ?? undefined,
    receptorUniProt: row.receptor_uniprot ?? undefined,
    receptorChains: parseOptionalJson(row.receptor_chains),
    referenceEntity: row.reference_entity ?? undefined,
    bindingSiteSource: row.binding_site_source ?? undefined,
    gridDerivation: row.grid_derivation ?? undefined,
    gridCenter: parseOptionalJson(row.grid_center),
    gridSize: parseOptionalJson(row.grid_size),
    modelSource: row.model_source ?? undefined,
    modelVersion: row.model_version ?? undefined,
    modelConfidence: row.model_confidence ?? undefined,
    bindingSiteValidationMethod: row.binding_site_validation_method ?? undefined,
    executionStatus: row.execution_status ?? undefined,
    completedAt: row.completed_at ?? undefined,
    status: row.status,
    provenance: parseJson(row.provenance, { evidenceClass: "PREDICTED" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapPredictionRun(row: any): PredictionRun {
  return PredictionRunSchema.parse({
    id: row.id,
    studyId: row.study_id,
    endpoint: row.endpoint,
    module: row.endpoint,
    runName: row.run_name,
    compoundId: row.compound_id ?? undefined,
    formulationId: row.formulation_id ?? undefined,
    cellLineId: row.cell_line_id ?? undefined,
    proteinId: row.protein_id ?? undefined,
    summaryIc50: row.summary_ic50 ?? undefined,
    summaryIc50Unit: row.summary_ic50_unit ?? undefined,
    summaryMaximum: row.summary_maximum ?? undefined,
    summaryMaximumUnit: row.summary_maximum_unit ?? undefined,
    teac: row.teac ?? undefined,
    selectivityIndex: row.selectivity_index ?? undefined,
    pathwayEffect: row.pathway_effect ?? undefined,
    concentrationUnitLabel: row.concentration_unit_label ?? undefined,
    methodName: row.method_name,
    methodVersion: row.method_version ?? undefined,
    methodType: row.method_type,
    source: row.source,
    referenceIds: parseJson(row.reference_ids, []),
    assumptions: row.assumptions ?? undefined,
    limitations: row.limitations ?? undefined,
    concentrationUnit: row.concentration_unit,
    inputParameters: parseOptionalJson(row.input_parameters),
    dateGenerated: row.date_generated,
    operatorName: row.operator_name ?? undefined,
    resultPoints: parseJson(row.result_points, []),
    status: row.status,
    provenance: parseJson(row.provenance, { evidenceClass: "PREDICTED" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapLabDataset(row: any): LabDataset {
  return LabDatasetSchema.parse({
    id: row.id,
    studyId: row.study_id,
    assay: row.assay_type,
    assayType: row.assay_type,
    datasetName: row.dataset_name,
    endpointType: row.endpoint_type ?? undefined,
    formulationId: row.formulation_id ?? undefined,
    compoundId: row.compound_id ?? undefined,
    cellLineId: row.cell_line_id ?? undefined,
    cellLineName: row.cell_line_name ?? undefined,
    proteinId: row.protein_id ?? undefined,
    laboratoryName: row.laboratory_name || "",
    datePerformed: row.date_performed,
    protocolReference: row.protocol_reference || "",
    protocolRef: row.protocol_reference || undefined,
    kitName: row.kit_name ?? undefined,
    kitManufacturer: row.kit_manufacturer ?? undefined,
    instrument: row.instrument ?? undefined,
    wavelengthNm: row.wavelength_nm ?? undefined,
    operatorName: row.operator_name ?? undefined,
    outsourcedLab: Boolean(row.outsourced_lab),
    concentrationUnit: row.concentration_unit ?? undefined,
    controlT1Detail: row.control_t1_detail ?? undefined,
    controlT2Detail: row.control_t2_detail ?? undefined,
    treatmentSummaries: parseJson(row.treatment_summaries, []),
    observations: parseJson(row.observations, []),
    ic50: parseOptionalJson(row.ic50),
    characterization: parseOptionalJson(row.characterization),
    status: row.status,
    provenance: parseJson(row.provenance, { evidenceClass: "EXPERIMENTAL" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapLabReplicate(row: any): LabReplicate {
  return LabReplicateSchema.parse({
    id: row.id,
    datasetId: row.dataset_id,
    studyId: row.study_id,
    treatmentCode: row.treatment_code,
    replicateCode: row.replicate_code,
    replicateN: row.replicate_n ?? undefined,
    concentration: row.concentration ?? undefined,
    concentrationUnit: row.concentration_unit ?? undefined,
    measurements: parseJson(row.measurements, {}),
    notes: row.notes ?? undefined,
    dataClass: row.data_class || "RAW_EXPERIMENTAL",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by ?? undefined,
  })
}

export function mapStatisticsAnalysis(row: any): StatisticsRecord {
  return StatisticsRecordSchema.parse({
    id: row.id,
    studyId: row.study_id,
    assay: row.assay_type,
    assayType: row.assay_type,
    labDatasetId: row.lab_dataset_id,
    labDatasetName: row.lab_dataset_name,
    measurementKey: row.measurement_key,
    measurementLabel: row.measurement_label,
    alpha: row.alpha,
    sourceDatasetUpdatedAt: row.source_dataset_updated_at,
    sourceFingerprint: row.source_fingerprint,
    treatmentSummaries: parseJson(row.treatment_summaries, []),
    completeness: parseJson(row.completeness, { expectedCells: 0, observedCells: 0, missingCells: 0, incomplete: false, warnings: [] }),
    anova: parseJson(row.anova, {}),
    scheffeComparisons: parseJson(row.scheffe_comparisons, []),
    scheffeMessage: row.scheffe_message ?? undefined,
    calculationMethod: row.calculation_method || "ONE_WAY_ANOVA_SCHEFFE",
    calculationVersion: row.calculation_version || "1.0.0",
    calculatedAt: row.calculated_at,
    calculatedBy: row.calculated_by,
    status: row.status,
    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export const mapStatisticsRecord = mapStatisticsAnalysis

export function mapComparison(row: any): ComparisonRecord {
  return ComparisonRecordSchema.parse({
    id: row.id,
    studyId: row.study_id,
    endpoint: row.endpoint,
    assay: row.endpoint,
    predictionRunId: row.prediction_run_id,
    predictionRunName: row.prediction_run_name ?? undefined,
    predictionEvidenceClass: row.prediction_evidence_class,
    labDatasetId: row.lab_dataset_id,
    labDatasetName: row.lab_dataset_name ?? undefined,
    experimentalMetricKey: row.experimental_metric_key,
    statisticsAnalysisId: row.statistics_analysis_id ?? undefined,
    statisticsFreshnessAtSave: row.statistics_freshness_at_save ?? undefined,
    compatibilityStatus: row.compatibility_status,
    compatibilityReasons: parseJson(row.compatibility_reasons, []),
    comparisonMode: row.comparison_mode,
    alignedPoints: parseJson(row.aligned_points, []),
    researcherNotes: row.researcher_notes ?? undefined,
    sourcePredictionUpdatedAt: row.source_prediction_updated_at,
    sourceLabUpdatedAt: row.source_lab_updated_at,
    sourceStatisticsUpdatedAt: row.source_statistics_updated_at ?? undefined,
    sourceFingerprint: row.source_fingerprint,
    calculationMethod: row.calculation_method || "PRED_VS_EXP_SIDE_BY_SIDE_ALIGNED",
    calculationVersion: row.calculation_version || "1.0.0",
    metrics: parseJson(row.metrics, {}),
    concordanceFlag: row.concordance_flag || "not_assessed",
    status: row.status,
    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapInterpretation(row: any): Interpretation {
  return InterpretationSchema.parse({
    id: row.id,
    studyId: row.study_id,
    title: row.title,
    body: row.body || "",
    researchQuestion: row.research_question || "",
    researchObjective: row.research_objective || "",
    hypothesisText: row.hypothesis_text || "",
    researchQuestionPresetId: row.research_question_preset_id ?? undefined,
    linkedEvidence: parseJson(row.linked_evidence, []),
    computationalSummary: row.computational_summary || "",
    experimentalSummary: row.experimental_summary || "",
    statisticalSummary: row.statistical_summary || "",
    comparisonSummary: row.comparison_summary || "",
    interpretationText: row.interpretation_text || "",
    limitations: row.limitations || "",
    conclusion: row.conclusion || "",
    endpointFindings: parseOptionalJson(row.endpoint_findings),
    dockingInterpretation: row.docking_interpretation ?? undefined,
    characterizationInterpretation: row.characterization_interpretation ?? undefined,
    generatedBy: row.generated_by ?? undefined,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    generatedAt: row.generated_at ?? undefined,
    evidenceVersion: row.evidence_version ?? undefined,
    aiAssistance: parseOptionalJson(row.ai_assistance),
    hypothesisAssessment: row.hypothesis_assessment || "not_assessed",
    assessmentRationale: row.assessment_rationale ?? undefined,
    assessmentSelectedBy: row.assessment_selected_by ?? undefined,
    assessmentSelectedAt: row.assessment_selected_at ?? undefined,
    status: row.status,
    sourceFingerprint: row.source_fingerprint ?? undefined,
    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapReference(row: any): ReferenceRecord {
  return ReferenceRecordSchema.parse({
    id: row.id,
    studyId: row.study_id,
    title: row.title,
    authors: row.authors ?? undefined,
    year: row.year ?? undefined,
    journal: row.journal ?? undefined,
    doi: row.doi ?? undefined,
    pmid: row.pmid ?? undefined,
    url: row.url ?? undefined,
    retrievedAt: row.retrieved_at ?? undefined,
    citationText: row.citation_text ?? undefined,
    provenance: parseJson(row.provenance, { evidenceClass: "REFERENCE" }),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  })
}

export function mapAuditLog(row: any): AuditLog {
  return AuditLogSchema.parse({
    id: row.id,
    studyId: row.study_id,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    at: row.at,
    meta: parseOptionalJson(row.meta),
  })
}
