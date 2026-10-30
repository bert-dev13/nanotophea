import type { LaboratoryOmissions, LaboratoryOmissionReason } from "@/lib/domain/models"
import type { ModuleSelection, PredictionParty } from "@/lib/predictions/modules"

export const LAB_SECTION_CATALOG = [
  { id: "dpph", tab: "dpph", label: "DPPH", endpoint: "dpph" },
  { id: "mtt", tab: "mtt", label: "MTT", endpoint: "mtt" },
  { id: "ldh", tab: "ldh", label: "LDH", endpoint: "ldh" },
  { id: "ros", tab: "ros", label: "ROS", endpoint: "ros" },
  { id: "bax", tab: "bax", label: "BAX", endpoint: "bax" },
  { id: "hippo_yap", tab: "hippo-yap", label: "Hippo–YAP", endpoint: "hippo_yap" },

] as const

export type LaboratorySectionKey = (typeof LAB_SECTION_CATALOG)[number]["id"]

export type LaboratorySectionSelection = Partial<Record<LaboratorySectionKey, boolean>>

/** Prediction endpoints that always appear in Step 05. Testing all of them is not required. */
export const PREDICTION_LAB_ENDPOINTS = ["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"] as const satisfies readonly LaboratorySectionKey[]

export const OMISSION_REASON_OPTIONS: Array<{ id: LaboratoryOmissionReason; label: string }> = [
  { id: "study_scope", label: "Study scope" },
  { id: "cost", label: "Cost/resource limitation" },
  { id: "equipment", label: "Equipment unavailable" },
  { id: "capability", label: "Laboratory capability unavailable" },
  { id: "protocol", label: "Not required by protocol" },
  { id: "other", label: "Other" },
]

const BIOLOGICAL_ASSAYS = new Set(["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"])

export type EndpointCoverageStatus = "recorded" | "not_tested" | "pending"

export function laboratorySectionIncluded(
  stored: LaboratorySectionSelection | undefined,
  key: LaboratorySectionKey,
): boolean {
  return stored?.[key] !== false
}

export function visibleLaboratorySections(
  _input: {
    storedPredictions?: ModuleSelection
    compounds: PredictionParty[]
    proteins: PredictionParty[]
    cellLines: PredictionParty[]
  },
): Array<(typeof LAB_SECTION_CATALOG)[number]> {
  return [...LAB_SECTION_CATALOG]
}

function assayOf(row: { assayType?: string; assay?: string }): string {
  return row.assayType || row.assay || ""
}

export function sectionHasDataset(
  key: LaboratorySectionKey,
  datasets: Array<{ assayType?: string; assay?: string }>,
): boolean {

  return datasets.some((row) => assayOf(row) === key)
}

/**
 * Recorded wins over a not-tested mark. A missing mark is not yet recorded, not an error.
 */
export function endpointCoverageStatus(
  key: LaboratorySectionKey,
  datasets: Array<{ assayType?: string; assay?: string }>,
  stored?: LaboratorySectionSelection,
  omissions?: LaboratoryOmissions,
): EndpointCoverageStatus {
  if (sectionHasDataset(key, datasets)) return "recorded"
  if (stored?.[key] === false || omissions?.[key]?.reason) return "not_tested"
  return "pending"
}

export function experimentalCoverage(input: {
  datasets: Array<{ assayType?: string; assay?: string }>
  stored?: LaboratorySectionSelection
  omissions?: LaboratoryOmissions
}): { endpoints: number; tested: number; resolved: number } {
  let tested = 0
  let resolved = 0
  for (const key of PREDICTION_LAB_ENDPOINTS) {
    const status = endpointCoverageStatus(key, input.datasets, input.stored, input.omissions)
    if (status === "recorded") {
      tested += 1
      resolved += 1
    } else if (status === "not_tested") {
      resolved += 1
    }
  }
  return { endpoints: PREDICTION_LAB_ENDPOINTS.length, tested, resolved }
}

export function laboratoryProgress(input: {
  visible?: LaboratorySectionKey[]
  stored?: LaboratorySectionSelection
  omissions?: LaboratoryOmissions
  datasets: Array<{ assayType?: string; assay?: string }>
}): { required: number; recorded: number; tested: number; endpoints: number } {
  const coverage = experimentalCoverage(input)
  return {
    endpoints: coverage.endpoints,
    tested: coverage.tested,
    required: coverage.endpoints,
    recorded: coverage.resolved,
  }
}
