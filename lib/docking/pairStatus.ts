export const DOCKING_PAIR_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "UNAVAILABLE",
  "SKIPPED",
] as const

export type DockingPairStatus = (typeof DOCKING_PAIR_STATUSES)[number]

export function dockingPairResolved(status: DockingPairStatus): boolean {
  return status === "COMPLETED" || status === "SKIPPED"
}

/** Completed Vina results and explicit skips count. Failures and missing profiles do not. */
export function dockingPairStatus(input: {
  completed: boolean
  skipped: boolean
  profileReady: boolean
  jobStatus?: "waiting" | "preparing" | "running" | "completed" | "failed" | null
}): DockingPairStatus {
  if (input.jobStatus === "waiting") return "PENDING"
  if (input.jobStatus === "preparing" || input.jobStatus === "running") return "RUNNING"
  if (input.completed) return "COMPLETED"
  if (input.skipped) return "SKIPPED"
  if (input.jobStatus === "failed") return "FAILED"
  if (!input.profileReady) return "UNAVAILABLE"
  return "PENDING"
}
