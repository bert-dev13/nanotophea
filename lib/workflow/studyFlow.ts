/**
 * Guided study navigation. Pure routing and readiness rules — no scientific results.
 */

export type StepId =
  | "setup"
  | "insilico"
  | "docking"
  | "predictions"
  | "laboratory"
  | "analysis"

export interface WorkflowTab {
  id: string
  label: string
}

export interface WorkflowStep {
  id: StepId
  index: number
  number: string
  label: string
  shortLabel: string
  tabs: WorkflowTab[]
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "setup",
    index: 0,
    number: "01",
    label: "Research Setup",
    shortLabel: "Setup",
    tabs: [
      { id: "formulation", label: "Formulation" },
      { id: "phytochemicals", label: "Phytochemicals" },
      { id: "proteins", label: "Target Proteins" },
      { id: "cell-line", label: "Cell Line" },
      { id: "references", label: "References" },
    ],
  },
  {
    id: "insilico",
    index: 1,
    number: "02",
    label: "In-Silico Screening",
    shortLabel: "In-Silico",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "admet", label: "ADMET" },
    ],
  },
  {
    id: "docking",
    index: 2,
    number: "03",
    label: "Molecular Docking",
    shortLabel: "Docking",
    tabs: [],
  },
  {
    id: "predictions",
    index: 3,
    number: "04",
    label: "Biological Predictions",
    shortLabel: "Predictions",
    tabs: [
      { id: "dpph", label: "DPPH" },
      { id: "mtt", label: "MTT" },
      { id: "ldh", label: "LDH" },
      { id: "ros", label: "ROS" },
      { id: "bax", label: "BAX" },
      { id: "hippo-yap", label: "Hippo–YAP" },
    ],
  },
  {
    id: "laboratory",
    index: 4,
    number: "05",
    label: "Laboratory Validation",
    shortLabel: "Laboratory",
    tabs: [
      { id: "dpph", label: "Experimental DPPH" },
      { id: "ldh", label: "Experimental LDH" },
      { id: "characterization", label: "Characterization" },
    ],
  },
  {
    id: "analysis",
    index: 5,
    number: "06",
    label: "Analysis & Interpretation",
    shortLabel: "Analysis",
    tabs: [
      { id: "statistics", label: "Statistics" },
      { id: "comparison", label: "Comparison" },
      { id: "interpretation", label: "Interpretation" },
    ],
  },
]

/** Record-backed status. "unknown" means records have not been loaded yet. */
export type StepRecordStatus = "complete" | "incomplete" | "review" | "unknown"

export interface StudyReadiness {
  formulations: number
  compounds: number
  proteins: number
  cellLines: number
  references: number
  admetRuns: number
  dockingRuns: number
  predictionRuns: number
  labDpph: number
  labLdh: number
  characterization: number
  statistics: number
  comparisons: number
  interpretations: number
  /** Stored analyses whose existing freshness check returned STALE. */
  staleStatistics: number
  staleComparisons: number
  staleInterpretations: number
}

const PROGRESS_PREFIX = "nanotophea.workflowProgress."

export function emptyReadiness(patch: Partial<StudyReadiness> = {}): StudyReadiness {
  return {
    formulations: 0,
    compounds: 0,
    proteins: 0,
    cellLines: 0,
    references: 0,
    admetRuns: 0,
    dockingRuns: 0,
    predictionRuns: 0,
    labDpph: 0,
    labLdh: 0,
    characterization: 0,
    statistics: 0,
    comparisons: 0,
    interpretations: 0,
    staleStatistics: 0,
    staleComparisons: 0,
    staleInterpretations: 0,
    ...patch,
  }
}

export function getStep(stepId: StepId): WorkflowStep {
  return WORKFLOW_STEPS.find((s) => s.id === stepId) ?? WORKFLOW_STEPS[0]
}

export function nextStep(stepId: StepId): WorkflowStep | null {
  const step = getStep(stepId)
  return WORKFLOW_STEPS[step.index + 1] ?? null
}

export function previousStep(stepId: StepId): WorkflowStep | null {
  const step = getStep(stepId)
  return step.index > 0 ? WORKFLOW_STEPS[step.index - 1] : null
}

export function studyPath(studyId: string, stepId: StepId, tabId?: string): string {
  const step = getStep(stepId)
  if (step.tabs.length === 0) return `/study/${studyId}/${step.id}`
  const tab = step.tabs.some((t) => t.id === tabId) ? tabId! : step.tabs[0].id
  return `/study/${studyId}/${step.id}/${tab}`
}

export function parseWorkspaceSlug(slug: string[]): { step: WorkflowStep; tab: string } {
  const step = WORKFLOW_STEPS.find((s) => s.id === slug[0]) ?? WORKFLOW_STEPS[0]
  const tab = step.tabs.find((t) => t.id === slug[1])?.id ?? step.tabs[0]?.id ?? ""
  return { step, tab }
}

export function workspacePath(studyId: string, slug: string[]): string {
  const { step, tab } = parseWorkspaceSlug(slug)
  return studyPath(studyId, step.id, tab)
}

/** Records the furthest step the researcher continued into. */
export function readWorkflowProgress(studyId: string): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = localStorage.getItem(PROGRESS_PREFIX + studyId)
    if (raw == null) return 0
    const n = Number(raw)
    if (!Number.isFinite(n)) return 0
    return Math.min(Math.max(Math.trunc(n), 0), WORKFLOW_STEPS.length - 1)
  } catch {
    return 0
  }
}

export function writeWorkflowProgress(studyId: string, stepIndex: number): void {
  if (typeof window === "undefined") return
  const next = Math.min(Math.max(Math.trunc(stepIndex), 0), WORKFLOW_STEPS.length - 1)
  const stored = Math.max(readWorkflowProgress(studyId), next)
  try {
    localStorage.setItem(PROGRESS_PREFIX + studyId, String(stored))
  } catch {
    /* ignore */
  }
}

export function resumePath(studyId: string): string {
  const step = WORKFLOW_STEPS[readWorkflowProgress(studyId)] ?? WORKFLOW_STEPS[0]
  return studyPath(studyId, step.id)
}

/**
 * Inputs that must exist before the next step can be used.
 * Empty means Continue is allowed. Messages are shown in full — never a silent disable.
 */
export function continueRequirements(stepId: StepId, readiness: StudyReadiness): string[] {
  if (stepId === "setup") {
    const missing: string[] = []
    if (readiness.formulations < 1) {
      missing.push("Add a formulation before continuing to In-Silico Screening.")
    }
    if (readiness.compounds < 1) {
      missing.push("Add a phytochemical before continuing to In-Silico Screening.")
    }
    if (readiness.proteins < 1) {
      missing.push("Add a target protein before continuing to In-Silico Screening.")
    }
    if (readiness.cellLines < 1) {
      missing.push("Add a cell line before continuing to In-Silico Screening.")
    }
    return missing
  }

  if (stepId === "insilico") {
    const missing: string[] = []
    if (readiness.compounds < 1) {
      missing.push("Select a phytochemical before continuing to Molecular Docking.")
    }
    if (readiness.proteins < 1) {
      missing.push("Select a target protein before continuing to Molecular Docking.")
    }
    return missing
  }

  return []
}

/**
 * Honest gaps that do not block the next step.
 * Predictions, laboratory entry, and analysis stay reachable without invented results.
 */
export function continueAdvisory(stepId: StepId, readiness: StudyReadiness): string | null {
  if (stepId === "docking" && readiness.dockingRuns < 1) {
    return "No docking run is recorded yet. Biological predictions are a separate computational step."
  }
  if (stepId === "predictions" && readiness.predictionRuns < 1) {
    return "No prediction runs are recorded yet. Laboratory results are entered on their own."
  }
  if (stepId === "laboratory" && readiness.labDpph < 1 && readiness.labLdh < 1) {
    return "No experimental DPPH or LDH dataset is recorded yet. Analysis uses laboratory records only."
  }
  return null
}

export function stepRequirementsMet(stepId: StepId, readiness: StudyReadiness): boolean {
  switch (stepId) {
    case "setup":
      return (
        readiness.formulations > 0 &&
        readiness.compounds > 0 &&
        readiness.proteins > 0 &&
        readiness.cellLines > 0
      )
    case "insilico":
      return readiness.admetRuns > 0
    case "docking":
      return readiness.dockingRuns > 0
    case "predictions":
      return readiness.predictionRuns > 0
    case "laboratory":
      return readiness.labDpph + readiness.labLdh + readiness.characterization > 0
    case "analysis":
      return readiness.statistics + readiness.comparisons + readiness.interpretations > 0
    default:
      return false
  }
}

export function analysisNeedsReview(readiness: StudyReadiness): boolean {
  return (
    readiness.staleStatistics + readiness.staleComparisons + readiness.staleInterpretations > 0
  )
}

/**
 * Sidebar status from stored records only.
 * A step is complete when its records exist. Analysis is "review" when an
 * existing freshness check is STALE. Missing records stay incomplete.
 */
export function stepRecordStatus(
  stepId: StepId,
  readiness: StudyReadiness | null
): StepRecordStatus {
  if (!readiness) return "unknown"
  if (stepId === "analysis" && analysisNeedsReview(readiness)) return "review"
  return stepRequirementsMet(stepId, readiness) ? "complete" : "incomplete"
}

/** Step open in `/study/{id}/...`, or null when the path is not that study. */
export function stepIdFromPathname(pathname: string, studyId: string): StepId | null {
  const prefix = `/study/${studyId}`
  if (pathname !== prefix && !pathname.startsWith(prefix + "/")) return null
  const rest = pathname.slice(prefix.length).replace(/^\//, "")
  const slug = rest ? rest.split("/").filter(Boolean) : []
  return parseWorkspaceSlug(slug).step.id
}

/** Old module URLs preserved as bookmarks. The page redirects into the open study. */
export const LEGACY_MODULE_TARGETS: Record<string, { step: StepId; tab?: string }> = {
  "/research/formulation": { step: "setup", tab: "formulation" },
  "/research/phytochemicals": { step: "setup", tab: "phytochemicals" },
  "/research/proteins": { step: "setup", tab: "proteins" },
  "/research/cell-lines": { step: "setup", tab: "cell-line" },
  "/research/references": { step: "setup", tab: "references" },
  "/insilico/admet": { step: "insilico", tab: "admet" },
  "/insilico/docking": { step: "docking" },
  "/insilico/predictions/dpph": { step: "predictions", tab: "dpph" },
  "/insilico/predictions/mtt": { step: "predictions", tab: "mtt" },
  "/insilico/predictions/ldh": { step: "predictions", tab: "ldh" },
  "/insilico/predictions/ros": { step: "predictions", tab: "ros" },
  "/insilico/predictions/bax": { step: "predictions", tab: "bax" },
  "/insilico/predictions/yap": { step: "predictions", tab: "hippo-yap" },
  "/insilico/predictions/hippo-yap": { step: "predictions", tab: "hippo-yap" },
  "/lab/dpph": { step: "laboratory", tab: "dpph" },
  "/lab/ldh": { step: "laboratory", tab: "ldh" },
  "/lab/characterization": { step: "laboratory", tab: "characterization" },
  "/analysis/statistics": { step: "analysis", tab: "statistics" },
  "/analysis/compare": { step: "analysis", tab: "comparison" },
  "/analysis/interpretation": { step: "analysis", tab: "interpretation" },
}
