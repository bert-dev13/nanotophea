import { z } from "zod"
import { EvidenceTypeSchema, ProvenanceSchema } from "@/lib/domain/provenance"

export const LaboratoryOmissionReasonSchema = z.enum([
  "study_scope",
  "cost",
  "equipment",
  "capability",
  "protocol",
  "other",
])
export type LaboratoryOmissionReason = z.infer<typeof LaboratoryOmissionReasonSchema>

export const LaboratoryOmissionSchema = z.object({
  reason: LaboratoryOmissionReasonSchema,
  notes: z.string().optional(),
})
export type LaboratoryOmission = z.infer<typeof LaboratoryOmissionSchema>

export const LaboratoryOmissionsSchema = z.object({
  dpph: LaboratoryOmissionSchema.optional(),
  mtt: LaboratoryOmissionSchema.optional(),
  ldh: LaboratoryOmissionSchema.optional(),
  ros: LaboratoryOmissionSchema.optional(),
  bax: LaboratoryOmissionSchema.optional(),
  hippo_yap: LaboratoryOmissionSchema.optional(),
  characterization: LaboratoryOmissionSchema.optional(),
})
export type LaboratoryOmissions = z.infer<typeof LaboratoryOmissionsSchema>

export const StudyRoleSchema = z.enum(["OWNER", "COLLABORATOR", "ADVISER", "VIEWER"])
export type StudyRole = z.infer<typeof StudyRoleSchema>

export const StudyStatusSchema = z.enum([
  "draft",
  "active",
  "analysis",
  "completed",
  "archived",
])
export type StudyStatus = z.infer<typeof StudyStatusSchema>

export const UserProfileSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  photoURL: z.string().url().optional().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Default role hint when invited; study membership is authoritative */
  defaultRole: StudyRoleSchema.default("VIEWER"),
  role: StudyRoleSchema.optional(),
  isActive: z.boolean().optional().default(true),
  lastLoginAt: z.string().optional().nullable(),
})
export type UserProfile = z.infer<typeof UserProfileSchema>

export const StudyMemberSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: StudyRoleSchema,
  addedAt: z.string(),
  addedBy: z.string().min(1),
})
export type StudyMember = z.infer<typeof StudyMemberSchema>

export const DockingSearchStrategySchema = z.enum(["known_site", "reference_ligand", "manual", "blind", "binding_site_residues"])
export type DockingSearchStrategy = z.infer<typeof DockingSearchStrategySchema>

/** Search space approved for one target and PDB. Coordinates are reviewed, never guessed. */
export const ApprovedDockingConfigurationSchema = z.object({
  proteinId: z.string().min(1),
  pdbId: z.string().min(1).optional(),
  strategy: DockingSearchStrategySchema.optional(),
  siteLabel: z.string().min(1).optional(),
  derivation: z.string().min(1).optional(),
  receptorChains: z.array(z.string()).optional(),
  referenceChain: z.string().min(1).optional(),
  referenceEntity: z.string().min(1).optional(),
  paddingAngstrom: z.number().nonnegative().optional(),
  calculationMethod: z.string().min(1).optional(),
  centerX: z.number().finite(),
  centerY: z.number().finite(),
  centerZ: z.number().finite(),
  sizeX: z.number().positive(),
  sizeY: z.number().positive(),
  sizeZ: z.number().positive(),
  exhaustiveness: z.number().int().positive().max(64),
  numModes: z.number().int().positive().max(20),
  energyRange: z.number().nonnegative().max(10),
  approvedAt: z.string().min(1),
  approvedBy: z.string().min(1),
})
export type ApprovedDockingConfiguration = z.infer<typeof ApprovedDockingConfigurationSchema>

export const StudySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  shortTitle: z.string().optional(),
  description: z.string().optional(),
  status: StudyStatusSchema.default("draft"),
  primaryCellLine: z.string().default(""),
  formulationSummary: z.string().default(""),
  fairYear: z.string().optional(),
  researcherNames: z.array(z.string()).optional(),
  adviserNames: z.array(z.string()).optional(),
  ownerId: z.string().min(1),
  memberIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  contractVersion: z.string().default("2026-09-29"),
  /** Which Step 04 modules this study will record. Missing keys use the selection default. */
  predictionModules: z
    .object({
      dpph: z.boolean().optional(),
      mtt: z.boolean().optional(),
      ldh: z.boolean().optional(),
      ros: z.boolean().optional(),
      bax: z.boolean().optional(),
      hippo_yap: z.boolean().optional(),
    })
    .optional(),
  /** False means the researcher marked this endpoint not tested. A missing key is not yet recorded. */
  laboratorySections: z
    .object({
      dpph: z.boolean().optional(),
      mtt: z.boolean().optional(),
      ldh: z.boolean().optional(),
      ros: z.boolean().optional(),
      bax: z.boolean().optional(),
      hippo_yap: z.boolean().optional(),
      characterization: z.boolean().optional(),
    })
    .optional(),
  /** Researcher-chosen reason when an endpoint was not experimentally tested. */
  laboratoryOmissions: LaboratoryOmissionsSchema.optional(),
  /** Last time laboratory results or coverage decisions changed. */
  laboratoryEvidenceAt: z.string().optional(),
  /** Per-target AutoDock Vina search space, stored with the PDB it was approved for. */
  dockingConfigurations: z.array(ApprovedDockingConfigurationSchema).max(40).optional(),
  /** Unsupported targets the researcher chose to keep in the study. */
  dockingReadinessAcknowledgement: z.object({
    proteinNames: z.array(z.string().min(1)).max(40),
    acknowledgedAt: z.string().min(1),
  }).optional(),
  /** Set when the researcher finalizes Step 06. Does not change evidence classes. */
  analysisFinalizedAt: z.string().optional(),
})
export type Study = z.infer<typeof StudySchema>

export const CreateStudyInputSchema = z.object({
  title: z.string().min(3),
  shortTitle: z.string().optional(),
  description: z.string().optional(),
  fairYear: z.string().optional(),
  researcherNames: z.array(z.string()).optional(),
  adviserNames: z.array(z.string()).optional(),
})
export type CreateStudyInput = z.infer<typeof CreateStudyInputSchema>

export const UpdateStudyInputSchema = CreateStudyInputSchema.partial().extend({
  status: StudyStatusSchema.optional(),
  primaryCellLine: z.string().optional(),
  formulationSummary: z.string().optional(),
  predictionModules: z
    .object({
      dpph: z.boolean().optional(),
      mtt: z.boolean().optional(),
      ldh: z.boolean().optional(),
      ros: z.boolean().optional(),
      bax: z.boolean().optional(),
      hippo_yap: z.boolean().optional(),
    })
    .optional(),
  laboratorySections: z
    .object({
      dpph: z.boolean().optional(),
      mtt: z.boolean().optional(),
      ldh: z.boolean().optional(),
      ros: z.boolean().optional(),
      bax: z.boolean().optional(),
      hippo_yap: z.boolean().optional(),
      characterization: z.boolean().optional(),
    })
    .optional(),
  laboratoryOmissions: LaboratoryOmissionsSchema.optional(),
  laboratoryEvidenceAt: z.string().optional(),
  dockingConfigurations: z.array(ApprovedDockingConfigurationSchema).max(40).optional(),
  dockingReadinessAcknowledgement: z.object({
    proteinNames: z.array(z.string().min(1)).max(40),
    acknowledgedAt: z.string().min(1),
  }).optional(),
  analysisFinalizedAt: z.string().optional(),
})
export type UpdateStudyInput = z.infer<typeof UpdateStudyInputSchema>

/** Shared scientific document envelope */
export const ScientificRecordBaseSchema = z.object({
  id: z.string().min(1),
  studyId: z.string().min(1),
  provenance: ProvenanceSchema.default({ evidenceClass: "REFERENCE" }),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
  notes: z.string().optional(),
})

export const FormulationComponentSchema = z.object({
  name: z.string().min(1),
  amount: z.number().nonnegative().optional(),
  unit: z.string().optional(),
})
export type FormulationComponent = z.infer<typeof FormulationComponentSchema>

export const FormulationSchema = ScientificRecordBaseSchema.extend({
  name: z.string().min(1),
  plantMaterial: z.string().optional(),
  scientificName: z.string().optional(),
  components: z.array(FormulationComponentSchema).default([]),
  /** Legacy tea-bag masses. New formulations use `components` instead. */
  leafMassG: z.number().positive().optional(),
  nanocarrierMassG: z.number().positive().optional(),
  totalMassG: z.number().positive().optional(),
  methodNotes: z.string().optional(),
  storageNotes: z.string().optional(),
  markerCompound: z.string().optional(),
  markerCompoundId: z.string().optional(),
  referenceIds: z.array(z.string()).default([]),
  isCanonical: z.boolean().default(false),
})
export type Formulation = z.infer<typeof FormulationSchema>

export const CompoundSchema = ScientificRecordBaseSchema.extend({
  name: z.string().min(1),
  pubchemCid: z.number().int().optional(),
  smiles: z.string().optional(),
  isomericSmiles: z.string().optional(),
  formula: z.string().optional(),
  molecularWeight: z.number().optional(),
  chemicalClass: z.string().optional(),
  plantPart: z.string().optional(),
  source: z.string().optional(),
  isPrimaryMarker: z.boolean().default(false),
  referenceIds: z.array(z.string()).default([]),
  /** Set when the researcher finishes in-silico screening for this compound. */
  screeningReviewedAt: z.string().optional(),
})
export type Compound = z.infer<typeof CompoundSchema>

export const StructureEntityClaimSchema = z.object({
  label: z.string().min(1),
  uniprotId: z.string().min(1).optional(),
})

/**
 * Study copy of a reference protein.
 * verification status is not stored. Docking recomputes it from live RCSB metadata.
 */
export const ProteinSchema = ScientificRecordBaseSchema.extend({
  name: z.string().min(1),
  gene: z.string().optional(),
  geneSymbol: z.string().optional(),
  proteinName: z.string().optional(),
  biologicalTarget: z.string().optional(),
  pdbId: z.string().optional(),
  pathway: z.string().optional(),
  role: z.string().optional(),
  functionNotes: z.string().optional(),
  source: z.string().optional(),
  structureTitle: z.string().optional(),
  structureProtein: z.string().optional(),
  structureContext: z.string().optional(),
  organism: z.string().optional(),
  chains: z.array(z.string()).optional(),
  uniprotIds: z.array(z.string()).optional(),
  expectedTitle: z.string().optional(),
  expectedMethod: z.string().optional(),
  expectedResolution: z.string().optional(),
  expectedEntities: z.array(StructureEntityClaimSchema).optional(),
  /** Where the structure claim is checked. A stored value does not mean the structure is verified. */
  verificationSource: z.enum(["RCSB PDB", "AlphaFold DB"]).optional(),
  referenceIds: z.array(z.string()).default([]),
})
export type Protein = z.infer<typeof ProteinSchema>

export const CellLineSchema = ScientificRecordBaseSchema.extend({
  name: z.string().min(1),
  fullName: z.string().optional(),
  organism: z.string().optional(),
  tissueOrigin: z.string().optional(),
  diseaseContext: z.string().optional(),
  lineType: z.enum(["cancer", "normal", "other"]).default("cancer"),
  p53Status: z.string().optional(),
  hbvStatus: z.string().optional(),
  sourceDatabase: z.string().optional(),
  isPrimaryExperimental: z.boolean().default(false),
  referenceIds: z.array(z.string()).default([]),
})
export type CellLineRecord = z.infer<typeof CellLineSchema>

export const AdmetRunSchema = ScientificRecordBaseSchema.extend({
  compoundId: z.string().optional(),
  compoundName: z.string().optional(),
  toolName: z.string().optional(),
  toolVersion: z.string().optional(),
  provider: z.string().optional(),
  providerVersion: z.string().optional(),
  model: z.string().optional(),
  normalizerVersion: z.string().optional(),
  pubchemCid: z.number().int().optional(),
  inputSmiles: z.string().optional(),
  generatedAt: z.string().optional(),
  pubchemRetrieved: z.boolean().optional(),
  lipinskiOverall: z.enum(["pass", "fail", "incomplete"]).optional(),
  descriptors: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  raw: z.record(z.string(), z.number()).optional(),
  status: z.enum(["draft", "imported", "final"]).default("draft"),
  /** calculated: this saved row came from the model. A later page view can still be a cache retrieval. */
  assessmentOrigin: z.enum(["calculated", "retrieved"]).optional(),
})
export type AdmetRun = z.infer<typeof AdmetRunSchema>

/** One AutoDock Vina pose/mode from actual Vina output  -  never generated */
export const DockingModeSchema = z.object({
  mode: z.number().int().positive(),
  affinityKcalMol: z.number(),
  rmsdLowerBound: z.number().optional(),
  rmsdUpperBound: z.number().optional(),
})
export type DockingMode = z.infer<typeof DockingModeSchema>

export const DockingInteractionTypeSchema = z.enum([
  "Hydrogen Bond",
  "Hydrophobic",
  "Pi-Pi",
  "Pi-Cation",
  "Electrostatic",
  "Van der Waals",
  "Other",
])
export type DockingInteractionType = z.infer<typeof DockingInteractionTypeSchema>

/** Manually recorded observed/interpreted interactions  -  not auto-generated */
export const DockingInteractionSchema = z.object({
  residue: z.string().min(1),
  interactionType: DockingInteractionTypeSchema,
  distanceAngstrom: z.number().positive().optional(),
  notes: z.string().optional(),
})
export type DockingInteraction = z.infer<typeof DockingInteractionSchema>

export const DockingSearchBoxSchema = z.object({
  centerX: z.number(),
  centerY: z.number(),
  centerZ: z.number(),
  sizeX: z.number().positive(),
  sizeY: z.number().positive(),
  sizeZ: z.number().positive(),
})
export type DockingSearchBox = z.infer<typeof DockingSearchBoxSchema>

/**
 * Canonical Docking Pair status.
 */
export const DockingPairStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "SKIPPED",
  "UNAVAILABLE",
])
export type DockingPairStatus = z.infer<typeof DockingPairStatusSchema>

/**
 * Deterministic document ID for a docking pair within a study.
 */
export function canonicalDockingPairDocId(compoundId: string, proteinId: string): string {
  return `${compoundId}__${proteinId}`
}

/**
 * Deterministic global key for a docking pair.
 */
export function canonicalDockingPairKey(studyId: string, compoundId: string, proteinId: string): string {
  return `${studyId}:${compoundId}:${proteinId}`
}

/**
 * Canonical Docking Pair (studyId + compoundId + proteinId).
 * Exactly one pair exists per compound x target combination.
 * Reruns create new DockingRuns under this pair rather than creating duplicate pairs.
 */
export const DockingPairSchema = ScientificRecordBaseSchema.extend({
  compoundId: z.string().min(1),
  proteinId: z.string().min(1),
  targetId: z.string().optional(),
  compoundName: z.string().optional(),
  targetName: z.string().optional(),
  status: DockingPairStatusSchema.default("PENDING"),
  latestRunId: z.string().nullable().optional(),
  latestBindingAffinity: z.number().nullable().optional(),
  runsCount: z.number().int().default(0),
  archived: z.boolean().default(false),
})
export type DockingPair = z.infer<typeof DockingPairSchema>

/**
 * AutoDock Vina result recorded for one study ligand - protein execution.
 * Multiple runs may belong to the same canonical DockingPair.
 * Affinities come only from AutoDock Vina output.
 */
export const DockingRunSchema = ScientificRecordBaseSchema.extend({
  pairId: z.string().optional(),
  runName: z.string().min(1),
  compoundId: z.string().min(1),
  proteinId: z.string().min(1),
  /** Present when the Vina log states a version. Omitted when the file does not. */
  vinaVersion: z.string().min(1).optional(),
  receptorPdbId: z.string().optional(),
  ligandName: z.string().optional(),
  ligandPubchemCid: z.number().int().optional(),
  exhaustiveness: z.number().positive().optional(),
  numModes: z.number().int().positive().optional(),
  energyRange: z.number().optional(),
  /** Present only when the imported file states the search box. */
  searchBox: DockingSearchBoxSchema.optional(),
  modes: z.array(DockingModeSchema).min(1),
  bestBindingAffinityKcalMol: z.number(),
  selectedMode: z.number().int().positive().optional(),
  interactions: z.array(DockingInteractionSchema).default([]),
  /** Comma-separated residues entered by the researcher. */
  interactingResidues: z.string().nullish(),
  interactionNotes: z.string().nullish(),
  sourceFileName: z.string().optional(),
  poseFileName: z.string().nullish(),
  /** Best-mode coordinates from Vina output. Never a PubChem conformer. */
  poseModel: z.string().max(400_000).nullish(),
  ligandSource: z.string().min(1).optional(),
  receptorSource: z.string().min(1).optional(),
  dockingProfileId: z.string().min(1).optional(),
  dockingProfileVersion: z.string().min(1).optional(),
  researchTarget: z.string().optional(),
  actualDockingReceptor: z.string().optional(),
  structureSource: z.enum(["EXPERIMENTAL_STRUCTURE", "PREDICTED_STRUCTURE"]).optional(),
  structureId: z.string().optional(),
  structureMethod: z.string().optional(),
  receptorUniProt: z.string().optional(),
  receptorChains: z.array(z.string()).optional(),
  referenceEntity: z.string().optional(),
  bindingSiteSource: z.string().optional(),
  gridDerivation: z.string().optional(),
  gridCenter: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
  gridSize: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
  modelSource: z.string().optional(),
  modelVersion: z.string().optional(),
  modelConfidence: z.string().optional(),
  bindingSiteValidationMethod: z.string().optional(),
  executionStatus: z.string().optional(),
  completedAt: z.string().optional(),
  status: z.enum(["draft", "imported", "final"]).default("imported"),
})
export type DockingRun = z.infer<typeof DockingRunSchema>

/** Input for creating/updating a docking run (ids/audit assigned by repository) */
export const DockingRunInputSchema = DockingRunSchema.omit({
  id: true,
  studyId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
}).extend({
  provenance: ProvenanceSchema.extend({
    evidenceClass: z.literal("PREDICTED"),
    methodName: z.string().min(1),
  }),
})
export type DockingRunInput = z.infer<typeof DockingRunInputSchema>

/**
 * Researcher decision that a pair cannot be docked.
 * This is not a Vina result and must not carry a predicted affinity.
 */
export const SkippedDockingPairSchema = z.object({
  id: z.string().min(1),
  studyId: z.string().min(1),
  compoundId: z.string().min(1),
  compoundName: z.string().min(1),
  proteinId: z.string().min(1),
  targetId: z.string().min(1),
  targetName: z.string().min(1),
  runName: z.string().min(1),
  ligandName: z.string().optional(),
  status: z.literal("SKIPPED"),
  dockingStatus: z.literal("SKIPPED"),
  bindingAffinity: z.null(),
  bestBindingAffinityKcalMol: z.null(),
  reason: z.string().min(1),
  modes: z.array(DockingModeSchema).max(0).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
})
export type SkippedDockingPair = z.infer<typeof SkippedDockingPairSchema>

export const DOCKING_SKIP_REASON = "AutoDock Vina docking profile unavailable"

export const PredictionModuleSchema = z.enum([
  "dpph",
  "mtt",
  "ldh",
  "ros",
  "bax",
  "hippo_yap",
])
export type PredictionModule = z.infer<typeof PredictionModuleSchema>
/** Alias used in Phase 6 UI / contract language */
export type PredictionEndpoint = PredictionModule

export const PredictionConcentrationUnitSchema = z.enum(["uM", "ug_per_mL", "other"])
export type PredictionConcentrationUnit = z.infer<typeof PredictionConcentrationUnitSchema>

export const PredictionMethodTypeSchema = z.enum([
  "documented_model",
  "external_tool",
  "literature_derived_computation",
  "exploratory_math",
  "other",
])
export type PredictionMethodType = z.infer<typeof PredictionMethodTypeSchema>

/** One stored computational result point  -  never auto-generated */
export const PredictionResultPointSchema = z.object({
  concentration: z.number(),
  concentrationUnit: PredictionConcentrationUnitSchema,
  metric: z.string().min(1),
  value: z.number(),
  valueUnit: z.string().min(1),
  notes: z.string().optional(),
})
export type PredictionResultPoint = z.infer<typeof PredictionResultPointSchema>

/**
 * In-silico prediction import/record (Phase 6).
 * Values must come from a documented external method  -  never Hill/random sims.
 */
export const PredictionRunSchema = ScientificRecordBaseSchema.extend({
  /** Canonical endpoint id (also historically called module) */
  endpoint: PredictionModuleSchema,
  /** @deprecated Prefer endpoint  -  kept in sync for older readers */
  module: PredictionModuleSchema,
  runName: z.string().min(1),
  compoundId: z.string().optional(),
  formulationId: z.string().optional(),
  cellLineId: z.string().optional(),
  proteinId: z.string().nullish(),
  summaryIc50: z.number().nullish(),
  summaryIc50Unit: z.string().nullish(),
  summaryMaximum: z.number().nullish(),
  summaryMaximumUnit: z.string().nullish(),
  teac: z.string().nullish(),
  selectivityIndex: z.string().nullish(),
  pathwayEffect: z.string().nullish(),
  concentrationUnitLabel: z.string().nullish(),
  methodName: z.string().min(1),
  methodVersion: z.string().optional(),
  methodType: PredictionMethodTypeSchema,
  source: z.string().min(1),
  referenceIds: z.array(z.string()).default([]),
  assumptions: z.string().optional(),
  limitations: z.string().optional(),
  concentrationUnit: PredictionConcentrationUnitSchema,
  inputParameters: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
  dateGenerated: z.string().min(1),
  operatorName: z.string().optional(),
  resultPoints: z.array(PredictionResultPointSchema).default([]),
  status: z.enum(["draft", "imported", "final"]).default("imported"),
})
export type PredictionRun = z.infer<typeof PredictionRunSchema>

export const PredictionRunInputSchema = PredictionRunSchema.omit({
  id: true,
  studyId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
}).extend({
  provenance: ProvenanceSchema.extend({
    evidenceClass: z.enum(["PREDICTED", "SIMULATION"]),
    methodName: z.string().min(1),
  }),
})
export type PredictionRunInput = z.infer<typeof PredictionRunInputSchema>

export const LabEndpointSchema = z.enum(["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"])
export type LabEndpoint = z.infer<typeof LabEndpointSchema>

/** Researcher-entered experimental rows for endpoints without a locked plate design. */
export const LabObservationRoleSchema = z.enum(["untreated", "vehicle", "positive", "treatment"])
export type LabObservationRole = z.infer<typeof LabObservationRoleSchema>

export const LabObservationSchema = z.object({
  treatment: z.string().optional(),
  concentration: z.string().optional(),
  parameter: z.string().optional(),
  unit: z.string().optional(),
  role: LabObservationRoleSchema.optional(),
  /** Raw replicate measurements. Mean and SD are stored separately. */
  replicates: z.array(z.number()).default([]),
  /** Raw single measurement when the method is not recorded as replicates. */
  value: z.number().optional(),
  mean: z.number().optional(),
  sd: z.number().optional(),
  /** Derived from raw absorbance and a recorded control. Omitted when it cannot be calculated. */
  viabilityPercent: z.number().optional(),
  inhibitionPercent: z.number().optional(),
})
export type LabObservation = z.infer<typeof LabObservationSchema>

export const LabAssaySchema = z.enum([
  "dpph",
  "mtt",
  "ldh",
  "ros",
  "bax",
  "hippo_yap",
  "hplc",
  "proximate",
  "nutritive",
  "pb",
  "sensory",
  "microbial",
  "stability",
])
export type LabAssay = z.infer<typeof LabAssaySchema>

/** Experimental assay concentration unit  -   - g/mL only under the contract */
export const LabConcentrationUnitSchema = z.enum(["ug_per_mL"])
export type LabConcentrationUnit = z.infer<typeof LabConcentrationUnitSchema>

export const LabTreatmentCodeSchema = z.enum(["T1", "T2", "T3", "T4", "T5", "T6"])
export type LabTreatmentCode = z.infer<typeof LabTreatmentCodeSchema>

export const LabReplicateCodeSchema = z.enum(["R1", "R2", "R3"])
export type LabReplicateCode = z.infer<typeof LabReplicateCodeSchema>

/** Externally calculated IC50  -  never invented by the app */
export const LabIc50RecordSchema = z.object({
  value: z.number(),
  unit: z.string().min(1),
  method: z.string().min(1),
  calculatedBy: z.string().optional(),
  notes: z.string().optional(),
  dataClass: z.literal("DERIVED_FROM_EXPERIMENTAL").default("DERIVED_FROM_EXPERIMENTAL"),
})
export type LabIc50Record = z.infer<typeof LabIc50RecordSchema>

/** Per-treatment mean/SD computed from raw replicates */
export const LabTreatmentSummarySchema = z.object({
  treatmentCode: LabTreatmentCodeSchema,
  metric: z.string().min(1),
  mean: z.number().optional(),
  sd: z.number().optional(),
  n: z.number().int().min(0).optional(),
  dataClass: z.literal("DERIVED_FROM_EXPERIMENTAL").default("DERIVED_FROM_EXPERIMENTAL"),
})
export type LabTreatmentSummary = z.infer<typeof LabTreatmentSummarySchema>

export const HplcResultsSchema = z.object({
  markerCompound: z.string().optional(),
  retentionTimeMin: z.number().optional(),
  peakArea: z.number().optional(),
  calibrationInfo: z.string().optional(),
  rSquared: z.number().optional(),
  lod: z.number().optional(),
  loq: z.number().optional(),
  measuredQuercetinConcentration: z.number().optional(),
  concentrationUnit: z.string().optional(),
})
export type HplcResults = z.infer<typeof HplcResultsSchema>

export const ProximateResultsSchema = z.object({
  moisture: z.number().optional(),
  ash: z.number().optional(),
  protein: z.number().optional(),
  fat: z.number().optional(),
  fiber: z.number().optional(),
  unit: z.string().optional(),
})
export type ProximateResults = z.infer<typeof ProximateResultsSchema>

export const NutritiveResultsSchema = z.object({
  carbohydrates: z.number().optional(),
  energy: z.number().optional(),
  energyUnit: z.string().optional(),
  fat: z.number().optional(),
  protein: z.number().optional(),
  servingInfo: z.string().optional(),
  netWeight: z.string().optional(),
})
export type NutritiveResults = z.infer<typeof NutritiveResultsSchema>

export const PbResultsSchema = z.object({
  measuredValue: z.number().optional(),
  unit: z.enum(["mg_per_kg", "ppm", "other"]).optional(),
  acceptanceLimit: z.number().optional(),
  acceptanceLimitSource: z.string().optional(),
})
export type PbResults = z.infer<typeof PbResultsSchema>

export const SensoryResultsSchema = z.object({
  timepoint: z.string().optional(),
  appearance: z.string().optional(),
  odor: z.string().optional(),
  taste: z.string().optional(),
  overallAcceptability: z.number().optional(),
  scaleProtocol: z.string().optional(),
})
export type SensoryResults = z.infer<typeof SensoryResultsSchema>

export const MicrobialResultsSchema = z.object({
  timepoint: z.string().optional(),
  apc: z.number().optional(),
  yeastMold: z.number().optional(),
  units: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
})
export type MicrobialResults = z.infer<typeof MicrobialResultsSchema>

export const StabilityResultsSchema = z.object({
  timepoint: z.string().optional(),
  storageConditions: z.string().optional(),
  observations: z.string().optional(),
  linkedSensoryNotes: z.string().optional(),
  linkedMicrobialNotes: z.string().optional(),
})
export type StabilityResults = z.infer<typeof StabilityResultsSchema>

export const CharacterizationPayloadSchema = z.object({
  hplc: HplcResultsSchema.optional(),
  proximate: ProximateResultsSchema.optional(),
  nutritive: NutritiveResultsSchema.optional(),
  pb: PbResultsSchema.optional(),
  sensory: SensoryResultsSchema.optional(),
  microbial: MicrobialResultsSchema.optional(),
  stability: StabilityResultsSchema.optional(),
})
export type CharacterizationPayload = z.infer<typeof CharacterizationPayloadSchema>

/**
 * Laboratory dataset. Researcher entry is EXPERIMENTAL.
 * A record is SYNTHETIC only when that class is stored explicitly.
 * Raw replicates live in the replicates subcollection.
 */
export const LabDatasetSchema = ScientificRecordBaseSchema.extend({
  /** Alias kept for older readers  -  same as assayType */
  assay: LabAssaySchema,
  assayType: LabAssaySchema,
  datasetName: z.string().min(1),
  /** Stable biological endpoint for later predicted-versus-experimental matching. */
  endpointType: LabEndpointSchema.optional(),
  formulationId: z.string().optional(),
  compoundId: z.string().optional(),
  cellLineId: z.string().optional(),
  /** Denormalized display name (e.g. HepG2) */
  cellLineName: z.string().optional(),
  proteinId: z.string().optional(),
  laboratoryName: z.string().default(""),
  datePerformed: z.string().min(1),
  protocolReference: z.string().default(""),
  /** @deprecated Prefer protocolReference */
  protocolRef: z.string().optional(),
  kitName: z.string().optional(),
  kitManufacturer: z.string().optional(),
  instrument: z.string().optional(),
  wavelengthNm: z.number().optional(),
  operatorName: z.string().optional(),
  outsourcedLab: z.boolean().default(false),
  concentrationUnit: LabConcentrationUnitSchema.optional(),
  /** Protocol detail for T1 / T2 when not inventing reagents */
  controlT1Detail: z.string().optional(),
  controlT2Detail: z.string().optional(),
  treatmentSummaries: z.array(LabTreatmentSummarySchema).default([]),
  observations: z.array(LabObservationSchema).default([]),
  ic50: LabIc50RecordSchema.optional(),
  characterization: CharacterizationPayloadSchema.optional(),
  status: z.enum(["draft", "locked", "final"]).default("draft"),
  provenance: ProvenanceSchema.extend({
    evidenceClass: z.enum(["EXPERIMENTAL", "SYNTHETIC"]),
  }),
})
export type LabDataset = z.infer<typeof LabDatasetSchema>

export const LabDatasetInputSchema = LabDatasetSchema.omit({
  id: true,
  studyId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
}).extend({
  provenance: ProvenanceSchema.extend({
    evidenceClass: z.enum(["EXPERIMENTAL", "SYNTHETIC"]),
  }),
})
export type LabDatasetInput = z.infer<typeof LabDatasetInputSchema>

export const LabReplicateSchema = z.object({
  id: z.string().min(1),
  datasetId: z.string().min(1),
  studyId: z.string().min(1),
  treatmentCode: LabTreatmentCodeSchema,
  replicateCode: LabReplicateCodeSchema,
  /** @deprecated Prefer replicateCode */
  replicateN: z.number().int().min(1).max(3).optional(),
  concentration: z.number().optional(),
  concentrationUnit: LabConcentrationUnitSchema.optional(),
  /** Raw experimental measurements only  -  never overwrite when deriving summaries */
  measurements: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
  notes: z.string().optional(),
  dataClass: z.literal("RAW_EXPERIMENTAL").default("RAW_EXPERIMENTAL"),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string().optional(),
})
export type LabReplicate = z.infer<typeof LabReplicateSchema>

export const LabReplicateInputSchema = LabReplicateSchema.omit({
  id: true,
  studyId: true,
  datasetId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
})
export type LabReplicateInput = z.infer<typeof LabReplicateInputSchema>

export const StatisticsRecordSchema = ScientificRecordBaseSchema.extend({
  /** Experimental assay only: dpph | ldh */
  assayType: z.enum(["dpph", "ldh"]),
  /** @deprecated Prefer assayType */
  assay: z.enum(["dpph", "ldh"]).optional(),
  labDatasetId: z.string().min(1),
  labDatasetName: z.string().min(1),
  measurementKey: z.string().min(1),
  measurementLabel: z.string().min(1),
  alpha: z.number().positive().default(0.05),
  /** Snapshot identifiers for stale detection  -  not a full raw-data copy */
  sourceDatasetUpdatedAt: z.string().min(1),
  sourceFingerprint: z.string().min(1),
  treatmentSummaries: z
    .array(
      z.object({
        treatmentCode: LabTreatmentCodeSchema,
        label: z.string(),
        n: z.number().int().min(0),
        mean: z.number().optional(),
        sd: z.number().optional(),
        variance: z.number().optional(),
        missingReplicateSlots: z.number().int().min(0).default(0),
        dataClass: z.literal("DERIVED_FROM_EXPERIMENTAL").default("DERIVED_FROM_EXPERIMENTAL"),
      })
    )
    .default([]),
  completeness: z.object({
    expectedCells: z.number().int(),
    observedCells: z.number().int(),
    missingCells: z.number().int(),
    incomplete: z.boolean(),
    warnings: z.array(z.string()).default([]),
  }),
  anova: z.object({
    k: z.number().int(),
    N: z.number().int(),
    groupLabels: z.array(z.string()),
    groupNs: z.array(z.number().int()),
    groupMeans: z.array(z.number()),
    grandMean: z.number(),
    ssBetween: z.number(),
    ssWithin: z.number(),
    ssTotal: z.number(),
    dfBetween: z.number(),
    dfWithin: z.number(),
    dfTotal: z.number(),
    msBetween: z.number().nullable(),
    msWithin: z.number().nullable(),
    fStatistic: z.number().nullable(),
    pValue: z.number().nullable(),
    alpha: z.number(),
    significant: z.boolean().nullable(),
    message: z.string(),
  }),
  scheffeComparisons: z
    .array(
      z.object({
        treatmentA: z.string(),
        treatmentB: z.string(),
        meanA: z.number(),
        meanB: z.number(),
        meanDifference: z.number(),
        nA: z.number().int(),
        nB: z.number().int(),
        scheffeStatistic: z.number().nullable(),
        criticalF: z.number().nullable(),
        criticalDifference: z.number().nullable(),
        pValue: z.number().nullable(),
        significant: z.boolean().nullable(),
        note: z.string().optional(),
      })
    )
    .default([]),
  scheffeMessage: z.string().optional(),
  calculationMethod: z.string().default("ONE_WAY_ANOVA_SCHEFFE"),
  calculationVersion: z.string().default("1.0.0"),
  calculatedAt: z.string(),
  calculatedBy: z.string().min(1),
  status: z.enum(["draft", "final"]).default("final"),
  /** Runtime freshness flag  -  not necessarily persisted */
  freshness: z.enum(["CURRENT", "STALE"]).optional(),
})
export type StatisticsRecord = z.infer<typeof StatisticsRecordSchema>

export const StatisticsCreateInputSchema = z.object({
  labDatasetId: z.string().min(1),
  assayType: z.enum(["dpph", "ldh"]),
  measurementKey: z.string().min(1),
  notes: z.string().optional(),
  alpha: z.number().positive().optional(),
})
export type StatisticsCreateInput = z.infer<typeof StatisticsCreateInputSchema>

export const ComparisonRecordSchema = ScientificRecordBaseSchema.extend({
  /** Comparison endpoint  -  DPPH or LDH only */
  endpoint: z.enum(["dpph", "ldh"]),
  /** @deprecated Prefer endpoint */
  assay: z.enum(["dpph", "ldh"]).optional(),

  predictionRunId: z.string().min(1),
  predictionRunName: z.string().optional(),
  predictionEvidenceClass: z.enum(["PREDICTED", "SIMULATION"]),

  labDatasetId: z.string().min(1),
  labDatasetName: z.string().optional(),
  experimentalMetricKey: z.string().min(1),

  statisticsAnalysisId: z.string().optional(),
  statisticsFreshnessAtSave: z.enum(["CURRENT", "STALE"]).optional(),

  compatibilityStatus: z.enum(["COMPATIBLE", "PARTIAL", "INCOMPATIBLE"]),
  compatibilityReasons: z.array(z.string()).default([]),

  comparisonMode: z.enum(["SIDE_BY_SIDE", "ALIGNED"]),

  alignedPoints: z
    .array(
      z.object({
        concentration: z.number(),
        concentrationUnit: z.literal("ug_per_mL"),
        predictionMetric: z.string(),
        experimentalMetricKey: z.string(),
        predictedValue: z.number(),
        predictedValueUnit: z.string(),
        experimentalMean: z.number(),
        experimentalSd: z.number().optional(),
        experimentalN: z.number().int(),
        treatmentCode: z.string(),
        signedDifference: z.number().nullable(),
        absoluteDifference: z.number().nullable(),
        percentDifference: z.number().nullable(),
        differencesComputed: z.boolean(),
        note: z.string().optional(),
      })
    )
    .default([]),

  /** Researcher-authored notes  -  INTERPRETATION layer, not auto-generated */
  researcherNotes: z.string().optional(),

  sourcePredictionUpdatedAt: z.string().min(1),
  sourceLabUpdatedAt: z.string().min(1),
  sourceStatisticsUpdatedAt: z.string().optional(),
  sourceFingerprint: z.string().min(1),

  calculationMethod: z.string().default("PRED_VS_EXP_SIDE_BY_SIDE_ALIGNED"),
  calculationVersion: z.string().default("1.0.0"),

  /** Legacy loose bag  -  kept empty for older readers */
  metrics: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .default({}),
  concordanceFlag: z
    .enum(["consistent", "partially_consistent", "divergent", "not_assessed"])
    .default("not_assessed"),
  status: z.enum(["draft", "final"]).default("final"),
  freshness: z.enum(["CURRENT", "STALE"]).optional(),
})
export type ComparisonRecord = z.infer<typeof ComparisonRecordSchema>

export const ComparisonCreateInputSchema = z.object({
  endpoint: z.enum(["dpph", "ldh"]),
  predictionRunId: z.string().min(1),
  labDatasetId: z.string().min(1),
  experimentalMetricKey: z.string().optional(),
  statisticsAnalysisId: z.string().optional(),
  researcherNotes: z.string().optional(),
  concordanceFlag: z
    .enum(["consistent", "partially_consistent", "divergent", "not_assessed"])
    .optional(),
  notes: z.string().optional(),
})
export type ComparisonCreateInput = z.infer<typeof ComparisonCreateInputSchema>

export const ComparisonUpdateInputSchema = z.object({
  researcherNotes: z.string().optional(),
  concordanceFlag: z
    .enum(["consistent", "partially_consistent", "divergent", "not_assessed"])
    .optional(),
  notes: z.string().optional(),
  statisticsAnalysisId: z.string().nullable().optional(),
})
export type ComparisonUpdateInput = z.infer<typeof ComparisonUpdateInputSchema>

export const InterpretationLinkedEvidenceSchema = z.object({
  sourceType: z.enum([
    "formulation",
    "compound",
    "protein",
    "cellLine",
    "reference",
    "admetRun",
    "dockingRun",
    "predictionRun",
    "labDataset",
    "statistics",
    "comparison",
  ]),
  sourceId: z.string().min(1),
  evidenceClass: EvidenceTypeSchema,
  label: z.string().min(1),
  /** Snapshot of source updatedAt when linked / last refreshed */
  sourceUpdatedAt: z.string().optional(),
  moduleLabel: z.string().optional(),
})
export type InterpretationLinkedEvidence = z.infer<typeof InterpretationLinkedEvidenceSchema>

export const InterpretationEndpointFindingsSchema = z.object({
  dpph: z.string().optional(),
  mtt: z.string().optional(),
  ldh: z.string().optional(),
  ros: z.string().optional(),
  bax: z.string().optional(),
  hippoYap: z.string().optional(),
})
export type InterpretationEndpointFindings = z.infer<typeof InterpretationEndpointFindingsSchema>

export const InterpretationEvidenceUsedSchema = z.object({
  compounds: z.array(z.string()).max(24),
  dockingResults: z.number().int().nonnegative(),
  predictionEndpoints: z.number().int().nonnegative(),
  experimentalRecorded: z.number().int().nonnegative(),
  experimentalEndpoints: z.number().int().nonnegative(),
  statistics: z.enum(["available", "not_recorded"]),
  characterization: z.enum(["available", "not_recorded"]),
  literature: z.number().int().nonnegative(),
})
export type InterpretationEvidenceUsed = z.infer<typeof InterpretationEvidenceUsedSchema>

export const InterpretationAiAssistanceSchema = z.object({
  generatedWithAI: z.literal(true),
  provider: z.literal("Together AI"),
  model: z.string().min(1),
  generatedAt: z.string(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  evidenceSnapshot: z.string(),
  evidenceUsed: InterpretationEvidenceUsedSchema.optional(),
})
export type InterpretationAiAssistance = z.infer<typeof InterpretationAiAssistanceSchema>

export const HypothesisAssessmentSchema = z.enum([
  "not_assessed",
  "supported",
  "partially_supported",
  "not_supported",
])
export type HypothesisAssessment = z.infer<typeof HypothesisAssessmentSchema>

export const InterpretationStatusSchema = z.enum(["draft", "reviewed", "final"])
export type InterpretationStatus = z.infer<typeof InterpretationStatusSchema>

export const InterpretationSchema = ScientificRecordBaseSchema.extend({
  title: z.string().min(1),
  /** @deprecated Prefer interpretationText  -  kept for older draft records */
  body: z.string().optional().default(""),

  researchQuestion: z.string().default(""),
  researchObjective: z.string().default(""),
  hypothesisText: z.string().optional().default(""),
  /** Optional preset id from Study Design Contract templates */
  researchQuestionPresetId: z.string().optional(),

  linkedEvidence: z.array(InterpretationLinkedEvidenceSchema).default([]),
  /** @deprecated Prefer linkedEvidence */
  linkedEvidenceIds: z.array(z.string()).optional().default([]),
  researchQuestionId: z.string().optional(),
  hypothesisId: z.string().optional(),

  computationalSummary: z.string().optional().default(""),
  experimentalSummary: z.string().optional().default(""),
  statisticalSummary: z.string().optional().default(""),
  comparisonSummary: z.string().optional().default(""),

  interpretationText: z.string().optional().default(""),
  limitations: z.string().optional().default(""),
  conclusion: z.string().optional().default(""),
  endpointFindings: InterpretationEndpointFindingsSchema.optional(),
  dockingInterpretation: z.string().optional(),
  characterizationInterpretation: z.string().optional(),
  /** Automatic Research AI Interpretation. Not a researcher-authored record. */
  generatedBy: z.literal("ai").optional(),
  provider: z.literal("Together AI").optional(),
  model: z.string().optional(),
  generatedAt: z.string().optional(),
  evidenceVersion: z.string().optional(),
  aiAssistance: InterpretationAiAssistanceSchema.optional(),

  hypothesisAssessment: HypothesisAssessmentSchema.default("not_assessed"),
  assessmentRationale: z.string().optional(),
  assessmentSelectedBy: z.string().optional(),
  assessmentSelectedAt: z.string().optional(),

  status: InterpretationStatusSchema.default("draft"),

  sourceFingerprint: z.string().optional(),
  freshness: z.enum(["CURRENT", "STALE"]).optional(),
})
export type Interpretation = z.infer<typeof InterpretationSchema>

export const InterpretationCreateInputSchema = z.object({
  title: z.string().min(1),
  researchQuestion: z.string().optional(),
  researchObjective: z.string().optional(),
  hypothesisText: z.string().optional(),
  researchQuestionPresetId: z.string().optional(),
  linkedEvidence: z.array(InterpretationLinkedEvidenceSchema).optional(),
  computationalSummary: z.string().optional(),
  experimentalSummary: z.string().optional(),
  statisticalSummary: z.string().optional(),
  comparisonSummary: z.string().optional(),
  interpretationText: z.string().optional(),
  limitations: z.string().optional(),
  conclusion: z.string().optional(),
  endpointFindings: InterpretationEndpointFindingsSchema.optional(),
  dockingInterpretation: z.string().optional(),
  characterizationInterpretation: z.string().optional(),
  generatedBy: z.literal("ai").optional(),
  provider: z.literal("Together AI").optional(),
  model: z.string().optional(),
  generatedAt: z.string().optional(),
  evidenceVersion: z.string().optional(),
  aiAssistance: InterpretationAiAssistanceSchema.optional(),
  hypothesisAssessment: HypothesisAssessmentSchema.optional(),
  assessmentRationale: z.string().optional(),
  notes: z.string().optional(),
  status: InterpretationStatusSchema.optional(),
})
export type InterpretationCreateInput = z.infer<typeof InterpretationCreateInputSchema>

export const InterpretationUpdateInputSchema = InterpretationCreateInputSchema.partial().extend({
  hypothesisAssessment: HypothesisAssessmentSchema.optional(),
  assessmentRationale: z.string().nullable().optional(),
  status: InterpretationStatusSchema.optional(),
})
export type InterpretationUpdateInput = z.infer<typeof InterpretationUpdateInputSchema>

export const ReferenceRecordSchema = ScientificRecordBaseSchema.extend({
  title: z.string().min(1),
  authors: z.string().optional(),
  year: z.string().optional(),
  journal: z.string().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  url: z.string().optional(),
  retrievedAt: z.string().optional(),
  citationText: z.string().optional(),
})
export type ReferenceRecord = z.infer<typeof ReferenceRecordSchema>

export const AuditLogSchema = z.object({
  id: z.string().min(1),
  studyId: z.string().min(1),
  actorId: z.string().min(1),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().optional(),
  at: z.string(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
})
export type AuditLog = z.infer<typeof AuditLogSchema>
