import type { PredictionEndpoint, PredictionRun } from "@/lib/domain/models"

export interface PredictionParty {
  id: string
  name: string
  gene?: string
  pathway?: string
}

export interface PredictionSubject {
  key: string
  compoundId: string
  compoundName: string
  cellLineId?: string
  cellLineName?: string
  proteinId?: string
  proteinName?: string
  label: string
}

export interface ModuleSelection {
  dpph?: boolean
  mtt?: boolean
  ldh?: boolean
  ros?: boolean
  bax?: boolean
  hippo_yap?: boolean
}

const CELL_MODULES: PredictionEndpoint[] = ["mtt", "ldh", "ros"]

export function isBaxTarget(protein: PredictionParty): boolean {
  return /bax/i.test(`${protein.name} ${protein.gene ?? ""}`)
}

export function isHippoTarget(protein: PredictionParty): boolean {
  return /yap|hippo|tead/i.test(`${protein.name} ${protein.gene ?? ""} ${protein.pathway ?? ""}`)
}

export function defaultModuleIncluded(
  module: PredictionEndpoint,
  compounds: PredictionParty[],
  proteins: PredictionParty[],
  cellLines: PredictionParty[],
): boolean {
  if (compounds.length === 0) return false
  if (module === "dpph") return true
  if (CELL_MODULES.includes(module)) return cellLines.length > 0
  if (module === "bax") return proteins.some(isBaxTarget)
  return proteins.some(isHippoTarget)
}

export function moduleIncluded(
  stored: ModuleSelection | undefined,
  module: PredictionEndpoint,
  compounds: PredictionParty[],
  proteins: PredictionParty[],
  cellLines: PredictionParty[],
): boolean {
  const choice = stored?.[module]
  if (choice != null) return choice
  return defaultModuleIncluded(module, compounds, proteins, cellLines)
}

export function subjectsForModule(
  module: PredictionEndpoint,
  compounds: PredictionParty[],
  proteins: PredictionParty[],
  cellLines: PredictionParty[],
): PredictionSubject[] {
  const ligands = [...compounds].sort((a, b) => a.name.localeCompare(b.name))
  const lines = [...cellLines].sort((a, b) => a.name.localeCompare(b.name))
  const targets = [...proteins]
    .filter((protein) => (module === "bax" ? isBaxTarget(protein) : module === "hippo_yap" ? isHippoTarget(protein) : false))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (module === "dpph") {
    return ligands.map((compound) => ({
      key: compound.id,
      compoundId: compound.id,
      compoundName: compound.name,
      label: compound.name,
    }))
  }

  if (CELL_MODULES.includes(module)) {
    return ligands.flatMap((compound) =>
      lines.map((line) => ({
        key: `${compound.id}:${line.id}`,
        compoundId: compound.id,
        compoundName: compound.name,
        cellLineId: line.id,
        cellLineName: line.name,
        label: `${compound.name} × ${line.name}`,
      })),
    )
  }

  return ligands.flatMap((compound) =>
    targets.map((protein) => ({
      key: `${compound.id}:${protein.id}`,
      compoundId: compound.id,
      compoundName: compound.name,
      proteinId: protein.id,
      proteinName: protein.name,
      label: `${compound.name} × ${protein.name}`,
    })),
  )
}

export function runMatchesSubject(run: PredictionRun, subject: PredictionSubject): boolean {
  if (run.compoundId !== subject.compoundId) return false
  if ((run.cellLineId ?? "") !== (subject.cellLineId ?? "")) return false
  if ((run.proteinId ?? "") !== (subject.proteinId ?? "")) return false
  return Boolean(run.methodName?.trim() && run.source?.trim())
}

export function predictionProgress(input: {
  stored?: ModuleSelection
  compounds: PredictionParty[]
  proteins: PredictionParty[]
  cellLines: PredictionParty[]
  runs: PredictionRun[]
}): { required: number; recorded: number } {
  const modules: PredictionEndpoint[] = ["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"]
  let required = 0
  let recorded = 0
  for (const module of modules) {
    if (!moduleIncluded(input.stored, module, input.compounds, input.proteins, input.cellLines)) continue
    const subjects = subjectsForModule(module, input.compounds, input.proteins, input.cellLines)
    required += subjects.length
    const rows = input.runs.filter((run) => run.endpoint === module)
    recorded += subjects.filter((subject) => rows.some((run) => runMatchesSubject(run, subject))).length
  }
  return { required, recorded }
}

/**
 * Validates that a biological prediction has successfully completed and contains
 * a valid persisted result.
 *
 * Rules:
 * - A run record must exist.
 * - The run must not currently be in-flight (running = true).
 * - The run must not be in an unhandled failed state (runError present).
 * - The run must have a non-empty document ID.
 * - The run must have a valid non-draft status ("final" or "imported").
 * - The run must have valid calculated result points.
 */
export function isPredictionCompletedWithResult(
  run?: PredictionRun | null,
  options?: { running?: boolean; runError?: string | null }
): boolean {
  if (!run) return false
  if (options?.running) return false
  if (Boolean(options?.runError)) return false
  if (!run.id || typeof run.id !== "string" || !run.id.trim()) return false
  if (run.status !== "final" && run.status !== "imported") return false
  if (!Array.isArray(run.resultPoints) || run.resultPoints.length === 0) return false
  return true
}

/**
 * Gate for displaying Scientific Evidence / Supporting Research.
 * Scientific Evidence must appear ONLY AFTER a prediction has successfully finished running.
 */
export function canShowScientificEvidence(
  run?: PredictionRun | null,
  options?: { running?: boolean; runError?: string | null }
): boolean {
  return isPredictionCompletedWithResult(run, options)
}

export type PredictionJobStatus = "COMPLETED" | "RUNNING" | "QUEUED" | "FAILED" | "READY"

/**
 * Resolves the display and operational status of a biological prediction.
 */
export function resolvePredictionStatus(input: {
  run?: PredictionRun | null
  isRunning?: boolean
  isQueued?: boolean
  hasError?: boolean
}): PredictionJobStatus {
  if (input.isRunning) return "RUNNING"
  if (input.isQueued) return "QUEUED"
  if (input.hasError) return "FAILED"
  if (isPredictionCompletedWithResult(input.run)) return "COMPLETED"
  return "READY"
}

/**
 * Filters biological predictions to only those eligible for bulk execution.
 * Only READY predictions are eligible. COMPLETED, RUNNING, QUEUED, and FAILED
 * predictions are not eligible for standard bulk execution.
 */
export function filterRunnablePredictions<T extends { status: PredictionJobStatus }>(items: T[]): T[] {
  return items.filter((item) => item.status === "READY")
}

export interface FilterablePredictionJob {
  endpoint: PredictionEndpoint
  status: PredictionJobStatus
  subject: {
    label: string
    compoundName: string
    cellLineName?: string
    proteinName?: string
  }
}

/**
 * Pure filter logic for Biological Predictions master list.
 * Combines:
 * - endpointFilter ("all" | endpoint module)
 * - statusFilter ("all" | "completed" | "ready" | "failed")
 * - search query
 *
 * CRITICAL: The selected prediction in the right detail panel NEVER filters this list.
 */
export function filterBiologicalPredictionJobs<T extends FilterablePredictionJob>(
  jobs: T[],
  filters: {
    endpointFilter?: string
    statusFilter?: "all" | "completed" | "ready" | "failed"
    query?: string
    heroLabels?: Partial<Record<PredictionEndpoint, string>>
  }
): T[] {
  const endpoint = (filters.endpointFilter || "all").toLowerCase()
  const status = filters.statusFilter || "all"
  const q = (filters.query || "").trim().toLowerCase()

  return jobs.filter((job) => {
    // 1. Endpoint filter
    if (endpoint !== "all") {
      const normalizedEndpoint = endpoint === "hippo-yap" ? "hippo_yap" : endpoint
      const jobEndpoint = job.endpoint === "hippo_yap" ? "hippo_yap" : job.endpoint
      if (jobEndpoint !== normalizedEndpoint && job.endpoint !== endpoint) return false
    }

    // 2. Status filter
    if (status === "completed" && job.status !== "COMPLETED") return false
    if (status === "ready" && job.status !== "READY" && job.status !== "QUEUED") return false
    if (status === "failed" && job.status !== "FAILED") return false

    // 3. Search query
    if (!q) return true
    const hero = filters.heroLabels?.[job.endpoint] ?? ""
    const haystack = `${job.subject.label} ${job.subject.compoundName} ${job.subject.cellLineName ?? ""} ${job.subject.proteinName ?? ""} ${hero} ${job.endpoint}`.toLowerCase()
    return haystack.includes(q)
  })
}

