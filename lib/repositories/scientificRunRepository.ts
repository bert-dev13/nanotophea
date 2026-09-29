/**
 * Scientific run repository — ADMET, docking, prediction runs.
 * Docking: import/record actual AutoDock Vina results only — never simulate affinities.
 */
import {
  AdmetRunSchema,
  DockingRunInputSchema,
  DockingRunSchema,
  PredictionRunInputSchema,
  PredictionRunSchema,
  type AdmetRun,
  type DockingRun,
  type DockingRunInput,
  type PredictionEndpoint,
  type PredictionRun,
  type PredictionRunInput,
} from "@/lib/domain/models"
import { resolveAdmetEvidenceClass } from "@/lib/domain/admetEvidence"
import { defaultProvenance } from "@/lib/domain/provenance"
import { getPredictionEndpoint } from "@/lib/insilico/predictionEndpoints"
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
} from "@/lib/repositories/researchDataRepository"

type Actor = { id: string }

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

export async function createAdmetRun(
  studyId: string,
  actor: Actor,
  input: Partial<AdmetRun> & { compoundName?: string }
): Promise<AdmetRun> {
  const ref = docRef(studySub(studyId, STUDY_SUBCOLLECTIONS.admetRuns))
  const now = new Date().toISOString()
  const evidenceClass = resolveAdmetEvidenceClass(input.provenance)
  const record = AdmetRunSchema.parse({
    id: ref.id,
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
  await setDocData(studySub(studyId, STUDY_SUBCOLLECTIONS.admetRuns), ref.id, record)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "admetRun.create",
    entityType: "admetRun",
    entityId: ref.id,
  })
  return record
}

export async function listAdmetRuns(studyId: string): Promise<AdmetRun[]> {
  const rows = await listDocs<AdmetRun>(studySub(studyId, STUDY_SUBCOLLECTIONS.admetRuns))
  return rows.map((r) => AdmetRunSchema.parse(r))
}

/** Validate compound + protein exist in the study; compute best affinity from modes if needed. */
async function validateDockingRefs(
  studyId: string,
  input: DockingRunInput
): Promise<{ ligandName?: string; ligandPubchemCid?: number; receptorPdbId?: string }> {
  const compound = await getCompound(studyId, input.compoundId)
  if (!compound) throw new Error("Selected ligand compound was not found in this study.")

  const protein = await getProtein(studyId, input.proteinId)
  if (!protein) throw new Error("Selected target protein was not found in this study.")

  const pdb = (input.receptorPdbId ?? protein.pdbId ?? "").trim()
  if (!pdb) throw new Error("Receptor PDB ID is required (from the protein record or entered explicitly).")

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
    receptorPdbId: pdb,
  }
}

function bestAffinityFromModes(modes: DockingRunInput["modes"]): number {
  return modes.reduce(
    (best, m) => (m.affinityKcalMol < best ? m.affinityKcalMol : best),
    modes[0]!.affinityKcalMol
  )
}

export async function createDockingRun(
  studyId: string,
  actor: Actor,
  rawInput: DockingRunInput
): Promise<DockingRun> {
  const input = DockingRunInputSchema.parse(rawInput)
  const refs = await validateDockingRefs(studyId, input)

  const ref = docRef(studySub(studyId, STUDY_SUBCOLLECTIONS.dockingRuns))
  const now = new Date().toISOString()
  const best =
    input.bestBindingAffinityKcalMol ?? bestAffinityFromModes(input.modes)

  const record = DockingRunSchema.parse({
    ...input,
    id: ref.id,
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
      methodVersion: input.vinaVersion,
      operatorId: actor.id,
      recordedAt: input.provenance.recordedAt || now,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await setDocData(studySub(studyId, STUDY_SUBCOLLECTIONS.dockingRuns), ref.id, record)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "dockingRun.create",
    entityType: "dockingRun",
    entityId: ref.id,
  })
  return record
}

export async function listDockingRuns(studyId: string): Promise<DockingRun[]> {
  const rows = await listDocs<DockingRun>(studySub(studyId, STUDY_SUBCOLLECTIONS.dockingRuns))
  return rows
    .map((r) => DockingRunSchema.parse(r))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getDockingRun(studyId: string, id: string): Promise<DockingRun | null> {
  const raw = await getDocData<DockingRun>(studySub(studyId, STUDY_SUBCOLLECTIONS.dockingRuns), id)
  return raw ? DockingRunSchema.parse(raw) : null
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
  const best =
    input.bestBindingAffinityKcalMol ?? bestAffinityFromModes(input.modes)

  const next = DockingRunSchema.parse({
    ...existing,
    ...input,
    id,
    studyId,
    ligandName: refs.ligandName,
    ligandPubchemCid: refs.ligandPubchemCid,
    receptorPdbId: refs.receptorPdbId,
    bestBindingAffinityKcalMol: best,
    interactions: input.interactions ?? [],
    provenance: defaultProvenance("PREDICTED", {
      ...input.provenance,
      evidenceClass: "PREDICTED",
      methodName: input.provenance.methodName || "AutoDock Vina",
      methodVersion: input.vinaVersion,
      operatorId: actor.id,
      recordedAt: input.provenance.recordedAt || now,
    }),
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: now,
    updatedBy: actor.id,
  })

  await updateDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.dockingRuns),
    id,
    stripUndefined({
      runName: next.runName,
      compoundId: next.compoundId,
      proteinId: next.proteinId,
      vinaVersion: next.vinaVersion,
      receptorPdbId: next.receptorPdbId,
      ligandName: next.ligandName,
      ligandPubchemCid: next.ligandPubchemCid,
      exhaustiveness: next.exhaustiveness,
      numModes: next.numModes,
      energyRange: next.energyRange,
      searchBox: next.searchBox,
      modes: next.modes,
      bestBindingAffinityKcalMol: next.bestBindingAffinityKcalMol,
      selectedMode: next.selectedMode,
      interactions: next.interactions,
      status: next.status,
      notes: next.notes,
      provenance: next.provenance,
      updatedAt: next.updatedAt,
      updatedBy: next.updatedBy,
    })
  )

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "dockingRun.update",
    entityType: "dockingRun",
    entityId: id,
  })
  return next
}

export async function deleteDockingRun(studyId: string, id: string, actor: Actor): Promise<void> {
  await deleteDocData(studySub(studyId, STUDY_SUBCOLLECTIONS.dockingRuns), id)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "dockingRun.delete",
    entityType: "dockingRun",
    entityId: id,
  })
}

export async function createPredictionRun(
  studyId: string,
  actor: Actor,
  rawInput: PredictionRunInput
): Promise<PredictionRun> {
  const input = await validatePredictionInput(studyId, rawInput)
  const ref = docRef(studySub(studyId, STUDY_SUBCOLLECTIONS.predictionRuns))
  const now = new Date().toISOString()
  const evidence = input.provenance.evidenceClass

  const record = PredictionRunSchema.parse({
    ...input,
    id: ref.id,
    studyId,
    endpoint: input.endpoint,
    module: input.endpoint,
    resultPoints: input.resultPoints ?? [],
    referenceIds: input.referenceIds ?? [],
    status: input.status ?? "imported",
    provenance: defaultProvenance(evidence, {
      ...input.provenance,
      evidenceClass: evidence,
      methodName: input.methodName,
      methodVersion: input.methodVersion,
      source: input.source,
      operatorId: actor.id,
      recordedAt: input.dateGenerated || input.provenance.recordedAt || now,
      assumptions: input.assumptions ?? input.provenance.assumptions,
      limitations: input.limitations ?? input.provenance.limitations,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await setDocData(studySub(studyId, STUDY_SUBCOLLECTIONS.predictionRuns), ref.id, record)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "predictionRun.create",
    entityType: "predictionRun",
    entityId: ref.id,
  })
  return record
}

export async function listPredictionRuns(
  studyId: string,
  endpoint?: PredictionEndpoint
): Promise<PredictionRun[]> {
  const rows = await listDocs<PredictionRun>(studySub(studyId, STUDY_SUBCOLLECTIONS.predictionRuns))
  return rows
    .map((r) => {
      const endpointId = (r as PredictionRun).endpoint ?? (r as PredictionRun).module
      return PredictionRunSchema.parse({
        ...r,
        endpoint: endpointId,
        module: endpointId,
        runName: (r as PredictionRun).runName || `${endpointId} run`,
        methodName: (r as PredictionRun).methodName || (r as PredictionRun).provenance?.methodName || "unspecified",
        methodType: (r as PredictionRun).methodType || "other",
        source: (r as PredictionRun).source || (r as PredictionRun).provenance?.source || "unspecified",
        dateGenerated:
          (r as PredictionRun).dateGenerated ||
          (r as PredictionRun).provenance?.recordedAt ||
          (r as PredictionRun).createdAt,
        concentrationUnit: (r as PredictionRun).concentrationUnit || "other",
        resultPoints: (r as PredictionRun).resultPoints ?? [],
        referenceIds: (r as PredictionRun).referenceIds ?? [],
        status: (() => {
          const s = String((r as { status?: string }).status || "imported")
          if (s === "complete") return "imported" as const
          if (s === "draft" || s === "imported" || s === "final") return s
          return "imported" as const
        })(),
      })
    })
    .filter((r) => (endpoint ? r.endpoint === endpoint : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getPredictionRun(studyId: string, id: string): Promise<PredictionRun | null> {
  const raw = await getDocData<PredictionRun>(studySub(studyId, STUDY_SUBCOLLECTIONS.predictionRuns), id)
  if (!raw) return null
  const endpointId = raw.endpoint ?? raw.module
  return PredictionRunSchema.parse({
    ...raw,
    endpoint: endpointId,
    module: endpointId,
  })
}

export async function updatePredictionRun(
  studyId: string,
  id: string,
  actor: Actor,
  rawInput: PredictionRunInput
): Promise<PredictionRun> {
  const input = await validatePredictionInput(studyId, rawInput)
  const existing = await getPredictionRun(studyId, id)
  if (!existing) throw new Error("Prediction run not found")
  if (existing.endpoint !== input.endpoint) {
    throw new Error("Cannot change prediction endpoint on an existing run.")
  }

  const now = new Date().toISOString()
  const evidence = input.provenance.evidenceClass
  const next = PredictionRunSchema.parse({
    ...existing,
    ...input,
    id,
    studyId,
    endpoint: input.endpoint,
    module: input.endpoint,
    resultPoints: input.resultPoints ?? [],
    referenceIds: input.referenceIds ?? [],
    provenance: defaultProvenance(evidence, {
      ...input.provenance,
      evidenceClass: evidence,
      methodName: input.methodName,
      methodVersion: input.methodVersion,
      source: input.source,
      operatorId: actor.id,
      recordedAt: input.dateGenerated || input.provenance.recordedAt || now,
      assumptions: input.assumptions ?? input.provenance.assumptions,
      limitations: input.limitations ?? input.provenance.limitations,
    }),
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: now,
    updatedBy: actor.id,
  })

  await updateDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.predictionRuns),
    id,
    stripUndefined({
      endpoint: next.endpoint,
      module: next.module,
      runName: next.runName,
      compoundId: next.compoundId,
      formulationId: next.formulationId,
      cellLineId: next.cellLineId,
      methodName: next.methodName,
      methodVersion: next.methodVersion,
      methodType: next.methodType,
      source: next.source,
      referenceIds: next.referenceIds,
      assumptions: next.assumptions,
      limitations: next.limitations,
      concentrationUnit: next.concentrationUnit,
      inputParameters: next.inputParameters,
      dateGenerated: next.dateGenerated,
      operatorName: next.operatorName,
      resultPoints: next.resultPoints,
      status: next.status,
      notes: next.notes,
      provenance: next.provenance,
      updatedAt: next.updatedAt,
      updatedBy: next.updatedBy,
    })
  )

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "predictionRun.update",
    entityType: "predictionRun",
    entityId: id,
  })
  return next
}

export async function deletePredictionRun(studyId: string, id: string, actor: Actor): Promise<void> {
  await deleteDocData(studySub(studyId, STUDY_SUBCOLLECTIONS.predictionRuns), id)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "predictionRun.delete",
    entityType: "predictionRun",
    entityId: id,
  })
}

async function validatePredictionInput(
  studyId: string,
  rawInput: PredictionRunInput
): Promise<PredictionRunInput> {
  const input = PredictionRunInputSchema.parse({
    ...rawInput,
    module: rawInput.endpoint,
    endpoint: rawInput.endpoint,
  })

  const cfg = getPredictionEndpoint(input.endpoint)
  const evidence = input.provenance.evidenceClass

  if (evidence !== "PREDICTED" && evidence !== "SIMULATION") {
    throw new Error("Prediction runs may only use PREDICTED or SIMULATION evidence.")
  }
  if (evidence === "PREDICTED") {
    if (!input.methodName.trim()) throw new Error("PREDICTED runs require a documented method name.")
    if (!input.source.trim()) throw new Error("PREDICTED runs require a source / reference description.")
    if (!input.dateGenerated.trim()) throw new Error("PREDICTED runs require a generation date.")
    if (input.methodType === "exploratory_math") {
      throw new Error("exploratory_math method type must use SIMULATION evidence, not PREDICTED.")
    }
  }
  if (evidence === "SIMULATION") {
    if (!input.assumptions?.trim() && !input.provenance.assumptions?.trim()) {
      throw new Error("SIMULATION runs require documented assumptions.")
    }
  }

  if (input.concentrationUnit !== cfg.concentrationUnit) {
    throw new Error(
      `${cfg.shortLabel} workspace requires concentration unit ${cfg.concentrationUnitLabel} (${cfg.concentrationUnit}).`
    )
  }

  if (cfg.subjectType === "compound") {
    if (!input.compoundId) throw new Error("Select a compound (ligand / phytochemical) for this endpoint.")
    const compound = await getCompound(studyId, input.compoundId)
    if (!compound) throw new Error("Selected compound was not found in this study.")
    if (input.formulationId) {
      throw new Error("Compound-level endpoints must not reference a formulation subject.")
    }
  } else {
    if (!input.formulationId) throw new Error("Select a formulation for this endpoint.")
    const formulation = await getFormulation(studyId, input.formulationId)
    if (!formulation) throw new Error("Selected formulation was not found in this study.")
    if (input.compoundId) {
      throw new Error("Formulation-level endpoints must not use compoundId as the primary subject.")
    }
  }

  if (cfg.requiresCellLine) {
    if (!input.cellLineId) throw new Error("Select a cell line (HepG2 primary for this study).")
    const cell = await getCellLine(studyId, input.cellLineId)
    if (!cell) throw new Error("Selected cell line was not found in this study.")
  }

  for (const pt of input.resultPoints ?? []) {
    if (pt.concentrationUnit !== input.concentrationUnit) {
      throw new Error("Each result point must use the same concentration unit as the run.")
    }
    if (typeof pt.value !== "number" || Number.isNaN(pt.value)) {
      throw new Error("Result values must be numeric — enter only values from a documented method.")
    }
  }

  // Soft guard: warn via throw if DPPH experimental-looking µg/mL grid used in µM workspace
  if (input.endpoint === "dpph" && input.concentrationUnit === "uM") {
    const vals = (input.resultPoints ?? []).map((p) => p.concentration)
    const looksLikeExpUg =
      vals.length >= 3 &&
      vals.every((v) => [50, 100, 250, 500].includes(v)) &&
      !vals.some((v) => [3.13, 6.25, 12.5, 25].includes(v))
    if (looksLikeExpUg) {
      throw new Error(
        "These concentrations look like Experimental DPPH µg/mL (T3–T6). In-silico DPPH uses µM (0, 3.13–100). Document unit conversion before entering experimental-like grids here."
      )
    }
  }

  return input
}
