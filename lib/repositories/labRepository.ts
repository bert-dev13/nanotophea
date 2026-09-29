/**
 * Laboratory repository — experimental datasets + raw replicates.
 * Never generates scientific values. Evidence class is always EXPERIMENTAL.
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
import { defaultProvenance } from "@/lib/domain/provenance"
import { getLabAssayConfig, LOCKED_TREATMENT_CONCENTRATIONS } from "@/lib/lab/labAssayConfig"
import { summarizeMetricByTreatment } from "@/lib/lab/labCalculations"
import { STUDY_SUBCOLLECTIONS, labReplicatesPath, studySub } from "@/lib/firebase/paths"
import {
  deleteDocData,
  docRef,
  getDocData,
  listDocs,
  setDocData,
  updateDocData,
} from "@/lib/firebase/firestore"
import { writeAuditLog } from "@/lib/repositories/auditRepository"
import { getCellLine, getFormulation } from "@/lib/repositories/researchDataRepository"

type Actor = { id: string }

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

const FORBIDDEN_EXPERIMENTAL_ASSAYS = new Set(["mtt", "ros", "bax", "yap", "hippo-yap"])

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
      evidenceClass: "EXPERIMENTAL",
    },
  })

  assertExperimentalAssay(input.assayType)

  if (input.provenance.evidenceClass !== "EXPERIMENTAL") {
    throw new Error("Laboratory datasets must use evidence class EXPERIMENTAL.")
  }

  if (
    input.provenance.evidenceClass === ("PREDICTED" as string) ||
    input.provenance.evidenceClass === ("SIMULATION" as string)
  ) {
    throw new Error("PREDICTED/SIMULATION records cannot be stored as lab datasets.")
  }

  if (!input.laboratoryName?.trim()) throw new Error("Laboratory / facility name is required.")
  if (!input.datePerformed?.trim()) throw new Error("Date performed is required.")
  if (!input.protocolReference?.trim()) throw new Error("Protocol / method reference is required.")
  if (!input.datasetName?.trim()) throw new Error("Dataset name is required.")

  if (input.assayType === "dpph" || input.assayType === "ldh") {
    if (input.concentrationUnit && input.concentrationUnit !== "ug_per_mL") {
      throw new Error("Experimental DPPH/LDH concentrations must use µg/mL (ug_per_mL).")
    }
    if (input.assayType === "dpph" && input.wavelengthNm != null && input.wavelengthNm !== 517) {
      // Allow other wavelengths only with explicit note — warn via requiring notes if not 517
      if (!input.notes?.trim()) {
        throw new Error(
          "DPPH wavelength differs from the contract default (517 nm). Record the reason in notes."
        )
      }
    }
  }

  if (input.assayType === "ldh") {
    const name = (input.cellLineName || "").toLowerCase()
    if (input.cellLineId) {
      const cl = await getCellLine(studyId, input.cellLineId)
      if (!cl) throw new Error("Selected cell line was not found in this study.")
      if (!/hepg2/i.test(cl.name) && !/hepg2/i.test(name)) {
        throw new Error("Experimental LDH requires HepG2 under the Study Design Contract.")
      }
    } else if (!/hepg2/i.test(name)) {
      throw new Error("Experimental LDH requires HepG2 (set cell line name or select HepG2).")
    }
  }

  if (input.formulationId) {
    const f = await getFormulation(studyId, input.formulationId)
    if (!f) throw new Error("Selected formulation was not found in this study.")
  }

  if (input.ic50) {
    if (!input.ic50.method?.trim()) {
      throw new Error("IC50 requires method provenance (externally calculated — not invented here).")
    }
  }

  return input
}

function validateReplicateForAssay(
  assay: "dpph" | "ldh",
  input: LabReplicateInput
): LabReplicateInput {
  const parsed = LabReplicateInputSchema.parse({
    ...input,
    replicateCode: input.replicateCode,
    replicateN:
      input.replicateN ??
      (input.replicateCode === "R1" ? 1 : input.replicateCode === "R2" ? 2 : 3),
    dataClass: "RAW_EXPERIMENTAL",
  })

  const cfg = getLabAssayConfig(assay)
  const def = cfg.treatments.find((t) => t.code === parsed.treatmentCode)
  if (!def) throw new Error(`Invalid treatment code ${parsed.treatmentCode}.`)

  if (parsed.concentrationUnit && parsed.concentrationUnit !== "ug_per_mL") {
    throw new Error("Experimental treatment concentrations must use µg/mL — not µM.")
  }

  if (def.concentrationUgPerMl != null) {
    if (parsed.concentration != null && parsed.concentration !== def.concentrationUgPerMl) {
      throw new Error(
        `${parsed.treatmentCode} must be ${def.concentrationUgPerMl} µg/mL under the Study Design Contract.`
      )
    }
    parsed.concentration = def.concentrationUgPerMl
    parsed.concentrationUnit = "ug_per_mL"
  } else {
    // Controls — concentration optional (e.g. ascorbic acid conc recorded in notes/control detail)
    if (parsed.concentrationUnit && parsed.concentrationUnit !== "ug_per_mL") {
      throw new Error("Do not use µM for experimental treatment concentrations.")
    }
  }

  // Guard: reject µM-looking misuse via measurement keys
  for (const key of Object.keys(parsed.measurements)) {
    if (/uM|µM|micromolar/i.test(key) && !parsed.notes) {
      // soft: allow but concentration unit must stay ug_per_mL
    }
  }

  return parsed
}

export async function createLabDataset(
  studyId: string,
  actor: Actor,
  rawInput: LabDatasetInput
): Promise<LabDataset> {
  const input = await validateLabDatasetInput(studyId, rawInput)
  const ref = docRef(studySub(studyId, STUDY_SUBCOLLECTIONS.labDatasets))
  const now = new Date().toISOString()

  const record = LabDatasetSchema.parse({
    ...input,
    id: ref.id,
    studyId,
    assay: input.assayType,
    assayType: input.assayType,
    protocolReference: input.protocolReference,
    protocolRef: input.protocolReference,
    concentrationUnit:
      input.assayType === "dpph" || input.assayType === "ldh"
        ? "ug_per_mL"
        : input.concentrationUnit,
    wavelengthNm:
      input.assayType === "dpph"
        ? input.wavelengthNm ?? 517
        : input.wavelengthNm,
    treatmentSummaries: input.treatmentSummaries ?? [],
    characterization: input.characterization,
    status: input.status ?? "draft",
    provenance: defaultProvenance("EXPERIMENTAL", {
      ...input.provenance,
      evidenceClass: "EXPERIMENTAL",
      laboratoryName: input.laboratoryName,
      protocolRef: input.protocolReference,
      methodName: input.protocolReference,
      operatorId: actor.id,
      recordedAt: input.datePerformed || now,
      limitations: input.provenance.limitations,
      assumptions: input.provenance.assumptions,
      source: input.laboratoryName,
    }),
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })

  await setDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.labDatasets),
    ref.id,
    stripUndefined(record as unknown as Record<string, unknown>)
  )
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "labDataset.create",
    entityType: "labDataset",
    entityId: ref.id,
  })
  return record
}

export async function listLabDatasets(
  studyId: string,
  assay?: LabAssay
): Promise<LabDataset[]> {
  const rows = await listDocs<LabDataset>(studySub(studyId, STUDY_SUBCOLLECTIONS.labDatasets))
  return rows
    .map((r) =>
      LabDatasetSchema.parse({
        ...r,
        assay: r.assayType ?? r.assay,
        assayType: r.assayType ?? r.assay,
        datasetName: r.datasetName || `${r.assayType ?? r.assay} dataset`,
        laboratoryName: r.laboratoryName || "unspecified",
        datePerformed: r.datePerformed || r.createdAt,
        protocolReference: r.protocolReference || r.protocolRef || "unspecified",
        treatmentSummaries: r.treatmentSummaries ?? [],
        provenance: {
          ...r.provenance,
          evidenceClass: "EXPERIMENTAL",
        },
      })
    )
    .filter((r) => (assay ? r.assayType === assay : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getLabDataset(studyId: string, id: string): Promise<LabDataset | null> {
  const raw = await getDocData<LabDataset>(
    studySub(studyId, STUDY_SUBCOLLECTIONS.labDatasets),
    id
  )
  if (!raw) return null
  return LabDatasetSchema.parse({
    ...raw,
    assay: raw.assayType ?? raw.assay,
    assayType: raw.assayType ?? raw.assay,
    datasetName: raw.datasetName || `${raw.assayType ?? raw.assay} dataset`,
    laboratoryName: raw.laboratoryName || "unspecified",
    datePerformed: raw.datePerformed || raw.createdAt,
    protocolReference: raw.protocolReference || raw.protocolRef || "unspecified",
    treatmentSummaries: raw.treatmentSummaries ?? [],
    provenance: { ...raw.provenance, evidenceClass: "EXPERIMENTAL" },
  })
}

export async function updateLabDataset(
  studyId: string,
  id: string,
  actor: Actor,
  rawInput: LabDatasetInput
): Promise<LabDataset> {
  const input = await validateLabDatasetInput(studyId, rawInput)
  const existing = await getLabDataset(studyId, id)
  if (!existing) throw new Error("Lab dataset not found")
  if (existing.assayType !== input.assayType) {
    throw new Error("Cannot change assay type on an existing dataset.")
  }

  const now = new Date().toISOString()
  const next = LabDatasetSchema.parse({
    ...existing,
    ...input,
    id,
    studyId,
    assay: input.assayType,
    assayType: input.assayType,
    protocolReference: input.protocolReference,
    protocolRef: input.protocolReference,
    concentrationUnit:
      input.assayType === "dpph" || input.assayType === "ldh"
        ? "ug_per_mL"
        : input.concentrationUnit,
    provenance: defaultProvenance("EXPERIMENTAL", {
      ...input.provenance,
      evidenceClass: "EXPERIMENTAL",
      laboratoryName: input.laboratoryName,
      protocolRef: input.protocolReference,
      methodName: input.protocolReference,
      operatorId: actor.id,
      recordedAt: input.datePerformed || now,
      source: input.laboratoryName,
    }),
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: now,
    updatedBy: actor.id,
  })

  await updateDocData(
    studySub(studyId, STUDY_SUBCOLLECTIONS.labDatasets),
    id,
    stripUndefined({
      assay: next.assay,
      assayType: next.assayType,
      datasetName: next.datasetName,
      formulationId: next.formulationId,
      cellLineId: next.cellLineId,
      cellLineName: next.cellLineName,
      laboratoryName: next.laboratoryName,
      datePerformed: next.datePerformed,
      protocolReference: next.protocolReference,
      protocolRef: next.protocolRef,
      kitName: next.kitName,
      kitManufacturer: next.kitManufacturer,
      instrument: next.instrument,
      wavelengthNm: next.wavelengthNm,
      operatorName: next.operatorName,
      outsourcedLab: next.outsourcedLab,
      concentrationUnit: next.concentrationUnit,
      controlT1Detail: next.controlT1Detail,
      controlT2Detail: next.controlT2Detail,
      treatmentSummaries: next.treatmentSummaries,
      ic50: next.ic50,
      characterization: next.characterization,
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
    action: "labDataset.update",
    entityType: "labDataset",
    entityId: id,
  })
  return next
}

export async function deleteLabDataset(
  studyId: string,
  id: string,
  actor: Actor
): Promise<void> {
  const reps = await listLabReplicates(studyId, id)
  for (const r of reps) {
    await deleteDocData(labReplicatesPath(studyId, id), r.id)
  }
  await deleteDocData(studySub(studyId, STUDY_SUBCOLLECTIONS.labDatasets), id)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "labDataset.delete",
    entityType: "labDataset",
    entityId: id,
  })
}

export async function createLabReplicate(
  studyId: string,
  datasetId: string,
  actor: Actor,
  rawInput: LabReplicateInput
): Promise<LabReplicate> {
  const dataset = await getLabDataset(studyId, datasetId)
  if (!dataset) throw new Error("Lab dataset not found")
  if (dataset.assayType !== "dpph" && dataset.assayType !== "ldh") {
    throw new Error("Replicates are only used for Experimental DPPH and LDH.")
  }

  const input = validateReplicateForAssay(dataset.assayType, rawInput)
  const path = labReplicatesPath(studyId, datasetId)
  const ref = docRef(path)
  const now = new Date().toISOString()

  const record = LabReplicateSchema.parse({
    ...input,
    id: ref.id,
    studyId,
    datasetId,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id,
    updatedBy: actor.id,
  })
  await setDocData(path, ref.id, stripUndefined(record as unknown as Record<string, unknown>))
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "labReplicate.create",
    entityType: "labReplicate",
    entityId: ref.id,
    meta: { datasetId },
  })
  return record
}

export async function listLabReplicates(
  studyId: string,
  datasetId: string
): Promise<LabReplicate[]> {
  const rows = await listDocs<LabReplicate>(labReplicatesPath(studyId, datasetId))
  return rows
    .map((r) =>
      LabReplicateSchema.parse({
        ...r,
        replicateCode:
          r.replicateCode ||
          (r.replicateN ? replicateCodeFromN(r.replicateN) : "R1"),
        replicateN:
          r.replicateN ??
          (r.replicateCode === "R1" ? 1 : r.replicateCode === "R2" ? 2 : 3),
        dataClass: "RAW_EXPERIMENTAL",
        measurements: r.measurements ?? {},
      })
    )
    .sort((a, b) => {
      const t = a.treatmentCode.localeCompare(b.treatmentCode)
      if (t !== 0) return t
      return a.replicateCode.localeCompare(b.replicateCode)
    })
}

export async function updateLabReplicate(
  studyId: string,
  datasetId: string,
  replicateId: string,
  actor: Actor,
  rawInput: LabReplicateInput
): Promise<LabReplicate> {
  const dataset = await getLabDataset(studyId, datasetId)
  if (!dataset) throw new Error("Lab dataset not found")
  if (dataset.assayType !== "dpph" && dataset.assayType !== "ldh") {
    throw new Error("Replicates are only used for Experimental DPPH and LDH.")
  }
  const input = validateReplicateForAssay(dataset.assayType, rawInput)
  const existing = await getDocData<LabReplicate>(labReplicatesPath(studyId, datasetId), replicateId)
  if (!existing) throw new Error("Replicate not found")

  const now = new Date().toISOString()
  const next = LabReplicateSchema.parse({
    ...existing,
    ...input,
    id: replicateId,
    studyId,
    datasetId,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: now,
    updatedBy: actor.id,
  })

  await updateDocData(
    labReplicatesPath(studyId, datasetId),
    replicateId,
    stripUndefined({
      treatmentCode: next.treatmentCode,
      replicateCode: next.replicateCode,
      replicateN: next.replicateN,
      concentration: next.concentration,
      concentrationUnit: next.concentrationUnit,
      measurements: next.measurements,
      notes: next.notes,
      dataClass: next.dataClass,
      updatedAt: next.updatedAt,
      updatedBy: next.updatedBy,
    })
  )

  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "labReplicate.update",
    entityType: "labReplicate",
    entityId: replicateId,
    meta: { datasetId },
  })
  return next
}

export async function deleteLabReplicate(
  studyId: string,
  datasetId: string,
  replicateId: string,
  actor: Actor
): Promise<void> {
  await deleteDocData(labReplicatesPath(studyId, datasetId), replicateId)
  await writeAuditLog({
    studyId,
    actorId: actor.id,
    action: "labReplicate.delete",
    entityType: "labReplicate",
    entityId: replicateId,
    meta: { datasetId },
  })
}

/**
 * Recompute derived treatment summaries from raw replicates and persist on the dataset.
 * Does not modify raw replicate documents.
 */
export async function refreshDerivedSummaries(
  studyId: string,
  datasetId: string,
  actor: Actor,
  metricKeys: string[]
): Promise<LabDataset> {
  const dataset = await getLabDataset(studyId, datasetId)
  if (!dataset) throw new Error("Lab dataset not found")
  if (dataset.assayType !== "dpph" && dataset.assayType !== "ldh") {
    return dataset
  }

  const reps = await listLabReplicates(studyId, datasetId)
  const summaries = metricKeys.flatMap((metric) => summarizeMetricByTreatment(reps, metric))

  return updateLabDataset(studyId, datasetId, actor, {
    ...dataset,
    treatmentSummaries: summaries,
    provenance: dataset.provenance,
  })
}

export function lockedConcentration(code: LabTreatmentCode): number | undefined {
  if (code === "T3" || code === "T4" || code === "T5" || code === "T6") {
    return LOCKED_TREATMENT_CONCENTRATIONS[code]
  }
  return undefined
}
