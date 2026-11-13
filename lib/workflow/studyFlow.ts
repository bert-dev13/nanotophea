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
      { id: "phytochemicals", label: "Phytochemicals" },
      { id: "proteins", label: "Target Proteins" },
      { id: "cell-line", label: "Cell Lines" },
      { id: "nanoparticle", label: "Nanoparticle Formulation" },
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
      { id: "all", label: "All" },
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
      { id: "coverage", label: "Prediction Validation" },
      { id: "dpph", label: "DPPH" },
      { id: "mtt", label: "MTT" },
      { id: "ldh", label: "LDH" },
      { id: "ros", label: "ROS" },
      { id: "bax", label: "BAX" },
      { id: "hippo-yap", label: "Hippo–YAP" },
    ],
  },
  {
    id: "analysis",
    index: 5,
    number: "06",
    label: "Analysis & Interpretation",
    shortLabel: "Analysis",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "statistics", label: "Statistical Analysis" },
      { id: "comparison", label: "Prediction vs Experimental" },
      { id: "interpretation", label: "Research Interpretation" },
    ],
  },
]

/** Record-backed status. "unknown" means records have not been loaded yet. */
export type StepRecordStatus = "complete" | "incomplete" | "in_progress" | "review" | "unknown"

export interface StudyReadiness {
  formulations: number
  compounds: number
  /** Selected phytochemicals marked reviewed in In-Silico Screening. */
  screenedCompounds: number
  proteins: number
  cellLines: number
  references: number
  admetRuns: number
  dockingRuns: number
  /** Ligand–protein pairs in this study that have an imported Vina result. */
  dockingCompleted: number
  /** Pairs the researcher skipped because docking could not be performed. */
  dockingSkipped?: number
  /** Completed Vina results plus explicit skips. Omitted values fall back to dockingCompleted. */
  dockingResolved?: number
  /** Pairs with a curated docking profile. When omitted, every selected pair is required. */
  dockingExpected?: number
  predictionRuns: number
  /** Subjects in prediction modules this study has included. */
  predictionRequired: number
  /** Included subjects that have a recorded prediction. */
  predictionRecorded: number
  labDpph: number
  labLdh: number

  /** Laboratory sections included in this study. */
  labRequired: number
  /** Included sections that have a recorded experimental dataset. */
  labRecorded: number
  statistics: number
  comparisons: number
  interpretations: number
  /** Stored analyses whose existing freshness check returned STALE. */
  staleStatistics: number
  staleComparisons: number
  staleInterpretations: number
  predictionDpph: number
  predictionMtt: number
  predictionLdh: number
  predictionRos: number
  predictionBax: number
  predictionHippo: number
  /** Current (not stale) saved comparisons, by assay. */
  comparisonsDpph: number
  comparisonsLdh: number
  /** Interpretations with overall text, relationship, limitations, and conclusion. */
  interpretationReady: number
  interpretationFinal: number
  /** Laboratory results or coverage changed after Step 06 was finalized. */
  laboratoryChangedAfterAnalysis: boolean
}

const PROGRESS_PREFIX = "nanotophea.workflowProgress."

export function emptyReadiness(patch: Partial<StudyReadiness> = {}): StudyReadiness {
  return {
    formulations: 0,
    compounds: 0,
    screenedCompounds: 0,
    proteins: 0,
    cellLines: 0,
    references: 0,
    admetRuns: 0,
    dockingRuns: 0,
    dockingCompleted: 0,
    predictionRuns: 0,
    predictionRequired: 0,
    predictionRecorded: 0,
    labDpph: 0,
    labLdh: 0,
    labRequired: 2,
    labRecorded: 0,
    statistics: 0,
    comparisons: 0,
    interpretations: 0,
    staleStatistics: 0,
    staleComparisons: 0,
    staleInterpretations: 0,
    predictionDpph: 0,
    predictionMtt: 0,
    predictionLdh: 0,
    predictionRos: 0,
    predictionBax: 0,
    predictionHippo: 0,
    comparisonsDpph: 0,
    comparisonsLdh: 0,
    interpretationReady: 0,
    interpretationFinal: 0,
    laboratoryChangedAfterAnalysis: false,
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
    if (readiness.compounds < 1) {
      missing.push("Select at least one phytochemical before continuing to In-Silico Screening.")
    }
    if (readiness.proteins < 1) {
      missing.push("Select at least one target protein before continuing to In-Silico Screening.")
    }
    if (readiness.cellLines < 1) {
      missing.push("Select at least one cell line before continuing to In-Silico Screening.")
    }
    return missing
  }

  if (stepId === "insilico") {
    const missing: string[] = []
    if (readiness.compounds < 1) {
      missing.push("Select at least one phytochemical before continuing to Molecular Docking.")
    } else if (readiness.screenedCompounds < 1) {
      missing.push("Complete PubChem, drug-likeness, and ADME screening for at least one selected phytochemical before continuing to Molecular Docking.")
    }
    if (readiness.proteins < 1) {
      missing.push("Select a target protein before continuing to Molecular Docking.")
    }
    return missing
  }

  if (stepId === "docking") {
    const missing: string[] = []
    if (readiness.compounds < 1) {
      missing.push("Select at least one phytochemical before continuing to Biological Predictions.")
    }
    if (readiness.proteins < 1) {
      missing.push("Select at least one target protein before continuing to Biological Predictions.")
    }
    // Incomplete / failed / unavailable docking pairs do not block Biological Predictions.
    // Unresolved pairs stay incomplete in readiness and are surfaced via continueAdvisory.
    return missing
  }

  if (stepId === "predictions") {
    return []
  }

  if (stepId === "laboratory") {
    return []
  }

  return []
}

/** Cartesian product of the study's selected phytochemicals and target proteins. */
export function expectedDockingPairs(readiness: StudyReadiness): number {
  return readiness.compounds * readiness.proteins
}

/** Pairs that must be resolved before the next step. */
export function requiredDockingPairs(readiness: StudyReadiness): number {
  return readiness.dockingExpected ?? expectedDockingPairs(readiness)
}

/** A completed Vina result or an explicit skip. A missing profile is not resolved. */
export function resolvedDockingPairs(readiness: StudyReadiness): number {
  if (readiness.dockingResolved != null) return readiness.dockingResolved
  return readiness.dockingCompleted + (readiness.dockingSkipped ?? 0)
}

/**
 * Honest gaps that do not block the next step.
 * Predictions, laboratory entry, and analysis stay reachable without invented results.
 */
export function continueAdvisory(stepId: StepId, readiness: StudyReadiness): string | null {
  if (stepId === "insilico") {
    if (readiness.compounds > readiness.screenedCompounds && readiness.screenedCompounds >= 1) {
      const excluded = readiness.compounds - readiness.screenedCompounds
      return `${readiness.screenedCompounds} of ${readiness.compounds} phytochemicals completed screening. The remaining ${excluded} compound${excluded > 1 ? "s are" : " is"} pending or excluded from Molecular Docking.`
    }
  }
  if (stepId === "docking") {
    const expected = requiredDockingPairs(readiness)
    const resolved = resolvedDockingPairs(readiness)
    if (expected > 0 && resolved < expected) {
      const open = expected - resolved
      const completed = readiness.dockingCompleted
      const skipped = readiness.dockingSkipped ?? 0
      return `Docking is incomplete: ${resolved} of ${expected} pairs resolved (${completed} completed · ${skipped} skipped · ${open} still open). You may continue to Biological Predictions. Missing affinities stay unavailable and are not treated as experimental evidence.`
    }
  }
  return null
}

export function stepRequirementsMet(stepId: StepId, readiness: StudyReadiness): boolean {
  switch (stepId) {
    case "setup":
      return readiness.compounds > 0 && readiness.proteins > 0 && readiness.cellLines > 0
    case "insilico":
      return readiness.compounds > 0 && readiness.screenedCompounds >= 1 && readiness.proteins > 0
    case "docking":
      return requiredDockingPairs(readiness) > 0 && resolvedDockingPairs(readiness) >= requiredDockingPairs(readiness)
    case "predictions":
      return readiness.predictionRequired > 0 && readiness.predictionRecorded >= readiness.predictionRequired
    case "laboratory":
      if (readiness.labRequired === 0) {
        return readiness.labRecorded === 0 && readiness.labDpph === 0 && readiness.labLdh === 0
      }
      return readiness.labRecorded >= readiness.labRequired
    case "analysis":
      return readiness.interpretationFinal > 0
    default:
      return false
  }
}

export type AnalysisStageId = "statistics" | "comparison" | "interpretation"
export type AnalysisStageStatus = "not_started" | "in_progress" | "ready" | "completed"

export function analysisStageStatus(
  stage: AnalysisStageId,
  readiness: StudyReadiness,
): AnalysisStageStatus {
  if (stage === "statistics") {
    if (readiness.statistics > 0 && readiness.staleStatistics === 0) return "completed"
    if (readiness.staleStatistics > 0) return "in_progress"
    if (readiness.labDpph + readiness.labLdh > 0) return "ready"
    return "not_started"
  }
  if (stage === "comparison") {
    if (readiness.comparisons > 0 && readiness.staleComparisons === 0) return "completed"
    if (readiness.staleComparisons > 0) return "in_progress"
    const pairable =
      (readiness.predictionDpph > 0 && readiness.labDpph > 0) ||
      (readiness.predictionLdh > 0 && readiness.labLdh > 0)
    if (pairable) return "ready"
    return "not_started"
  }
  if (readiness.interpretationFinal > 0 && readiness.staleInterpretations === 0) return "completed"
  if (readiness.interpretations > 0 || readiness.staleInterpretations > 0) return "in_progress"
  if (readiness.statistics > 0 || readiness.comparisons > 0) return "ready"
  return "not_started"
}

export const ANALYSIS_STAGE_STATUS_LABEL: Record<AnalysisStageStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready",
  completed: "Completed",
}

/** What still has to exist before Step 06 can be finalized. */
export function analysisFinalizeBlockers(readiness: StudyReadiness): string[] {
  const missing: string[] = []
  if (readiness.labDpph + readiness.labLdh > 0 && (readiness.statistics === 0 || readiness.staleStatistics > 0)) {
    missing.push("Complete a current statistical analysis of the experimental datasets.")
  }
  if (readiness.predictionDpph > 0 && readiness.labDpph > 0 && readiness.comparisonsDpph === 0) {
    missing.push("Save the DPPH simulation versus experimental comparison.")
  }
  if (readiness.predictionLdh > 0 && readiness.labLdh > 0 && readiness.comparisonsLdh === 0) {
    missing.push("Save the LDH simulation versus experimental comparison.")
  }
  if (readiness.interpretationReady === 0) {
    missing.push("Write the interpretation, the relationship between computational and experimental results, limitations, and a conclusion.")
  }
  if (readiness.staleInterpretations > 0) {
    missing.push("Review the interpretation after the linked evidence changed.")
  }
  return missing
}

export function analysisNeedsReview(readiness: StudyReadiness): boolean {
  return (
    readiness.staleStatistics + readiness.staleComparisons + readiness.staleInterpretations > 0
  )
}

/**
 * Sidebar status from stored records only.
 * Laboratory completeness does not lock Analysis. A finalized analysis returns
 * to review when laboratory evidence changes afterward.
 */
export function stepRecordStatus(
  stepId: StepId,
  readiness: StudyReadiness | null
): StepRecordStatus {
  if (!readiness) return "unknown"
  if (stepId === "analysis") {
    if (readiness.interpretationFinal > 0 && readiness.laboratoryChangedAfterAnalysis) return "review"
    if (analysisNeedsReview(readiness)) {
      if (readiness.interpretationFinal > 0 && readiness.staleInterpretations === 0) return "complete"
      return "review"
    }
  }
  if (stepId === "insilico") {
    if (readiness.compounds > 0 && readiness.screenedCompounds >= readiness.compounds && readiness.proteins > 0) {
      return "complete"
    }
    if (readiness.screenedCompounds > 0) {
      return "in_progress"
    }
    return "incomplete"
  }
  if (stepId === "docking") {
    if (stepRequirementsMet("docking", readiness)) return "complete"
    if (resolvedDockingPairs(readiness) > 0) return "in_progress"
    return "incomplete"
  }
  if (stepId === "laboratory" && !stepRequirementsMet("laboratory", readiness)) {
    const started =
      readiness.labRecorded > 0 ||
      readiness.labDpph + readiness.labLdh > 0
    if (started) return "in_progress"
  }
  return stepRequirementsMet(stepId, readiness) ? "complete" : "incomplete"
}

/** Sidebar state for one workflow step. */
export type StepAvailability = "completed" | "current" | "available" | "locked" | "review"

/**
 * Whether the researcher may open this step.
 * Setup unlocks In-Silico Screening. Docking unlocks after screening, or stays
 * open once its own pairs are resolved. Biological Predictions unlock after
 * In-Silico Screening — incomplete docking does not permanently block them.
 * Laboratory waits for predictions, and Analysis waits for laboratory records.
 * A skipped pair is not a Vina result; unresolved pairs are not fabricated.
 */
export function canEnterStep(stepId: StepId, readiness: StudyReadiness | null): boolean {
  if (stepId === "setup") return true
  if (!readiness || !stepRequirementsMet("setup", readiness)) return false
  if (stepId === "insilico") return true
  const dockingDone = stepRequirementsMet("docking", readiness)
  const screened = stepRequirementsMet("insilico", readiness)
  if (stepId === "docking") return dockingDone || screened
  // Predictions may open once screening is done, even if docking pairs remain open.
  if (stepId === "predictions") return screened
  if (!stepRequirementsMet("predictions", readiness)) return false
  if (stepId === "laboratory") return true
  if (stepId === "analysis") {
    return (
      stepRequirementsMet("laboratory", readiness) ||
      readiness.labRecorded > 0 ||
      readiness.labDpph > 0 ||
      readiness.labLdh > 0
    )
  }
  return stepRequirementsMet(stepId, readiness)
}

/** Why the next step cannot be opened. Empty when it can. */
export function stepLockedMessage(stepId: StepId, readiness: StudyReadiness): string | null {
  if (canEnterStep(stepId, readiness)) return null
  if (!stepRequirementsMet("setup", readiness)) {
    return "Complete Research Setup before continuing."
  }
  if ((stepId === "docking" || stepId === "predictions") && !stepRequirementsMet("insilico", readiness)) {
    return "Complete In-Silico Screening before continuing."
  }
  if (stepId === "laboratory" || stepId === "analysis") {
    if (!stepRequirementsMet("predictions", readiness)) {
      return "Complete Biological Predictions before continuing to Laboratory Validation."
    }
  }
  if (stepId === "analysis") {
    return "Record at least one laboratory result or resolve endpoints before continuing to Analysis & Interpretation."
  }
  return "This step is locked."
}

/**
 * Sidebar state for one workflow step. Locked and available come from canEnterStep
 * so the sidebar and the Continue button share one rule.
 */
export function stepAvailability(
  stepId: StepId,
  readiness: StudyReadiness | null,
  current: boolean
): StepAvailability {
  if (readiness && !canEnterStep(stepId, readiness)) return "locked"
  const record = stepRecordStatus(stepId, readiness)
  if (record === "review") return "review"
  if (current) return "current"
  if (record === "complete") return "completed"
  return "available"
}

/** Step open in `/study/{id}/...`, or null when the path is not that study. */
export function stepIdFromPathname(pathname: string, studyId: string): StepId | null {
  const prefix = `/study/${studyId}`
  if (pathname !== prefix && !pathname.startsWith(prefix + "/")) return null
  const rest = pathname.slice(prefix.length).replace(/^\//, "")
  const slug = rest ? rest.split("/").filter(Boolean) : []
  if (slug[0] === "assistant") return null
  return parseWorkspaceSlug(slug).step.id
}

/** Old module URLs preserved as bookmarks. The page redirects into the open study. */
export const LEGACY_MODULE_TARGETS: Record<string, { step: StepId; tab?: string }> = {
  "/research/formulation": { step: "setup", tab: "nanoparticle" },
  "/research/phytochemicals": { step: "setup", tab: "phytochemicals" },
  "/research/proteins": { step: "setup", tab: "proteins" },
  "/research/cell-lines": { step: "setup", tab: "cell-line" },
  "/research/references": { step: "setup", tab: "phytochemicals" },
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
