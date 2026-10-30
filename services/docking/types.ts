export type DockingJobStatus = "waiting" | "preparing" | "running" | "completed" | "failed"

export type DockingStage =
  | "Preparing ligand"
  | "Preparing receptor"
  | "Running AutoDock Vina"
  | "Processing results"
  | "Completed"

export interface EngineStatus {
  available: boolean
  message: "Docking engine unavailable" | "AutoDock Vina"
  vinaPath: string | null
  preparer: string | null
  python: boolean
  missing: string[]
}

export interface DockingJobRecord {
  id: string
  studyId: string
  compoundId: string
  proteinId: string
  status: DockingJobStatus
  stage: DockingStage | null
  error: string | null
  runId: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export const ENGINE_UNAVAILABLE = "Docking engine unavailable"
export const DOCKING_SERVICE_UNAVAILABLE = "Molecular docking service is currently unavailable."
export const CONFIG_REQUIRED = "Docking configuration required"
export const DOCKING_FAILED = "Docking failed"
export const PREPARATION_FAILED = "Preparation failed"
export const CONFIGURATION_UNAVAILABLE = "Configuration unavailable"
export const DOCKING_INTERRUPTED = "Docking interrupted. Retry."
import { PROFILE_MISSING } from "@/lib/docking/profiles"
import { TARGET_UNVERIFIED } from "@/lib/docking/targetVerification"

export { PROFILE_MISSING, TARGET_UNVERIFIED }

/** Researcher-facing job text. Technical causes stay in the server log. */
export function researcherDockingError(technical: string): string {
  if (technical === PROFILE_MISSING) return PROFILE_MISSING
  if (
    technical === PREPARATION_FAILED ||
    technical === CONFIGURATION_UNAVAILABLE ||
    technical === DOCKING_FAILED ||
    technical === DOCKING_INTERRUPTED
  ) {
    return technical
  }
  if (
    technical === TARGET_UNVERIFIED ||
    technical === CONFIG_REQUIRED ||
    technical === "RCSB structure unavailable" ||
    technical === "PubChem structure unavailable"
  ) {
    return CONFIGURATION_UNAVAILABLE
  }
  if (
    technical === "ligand preparation failure" ||
    technical === "receptor preparation failure" ||
    technical === "invalid PDB"
  ) {
    return PREPARATION_FAILED
  }
  return DOCKING_FAILED
}
