import type { AiPageContext } from "@/lib/ai/types"
import type { AssistantFocusId } from "@/lib/ai/focus"

export const EXPLORE_STAGES = ["entire", "setup", "insilico", "docking", "predictions", "laboratory", "analysis"] as const

export type ExploreStage = (typeof EXPLORE_STAGES)[number]

export interface DockingChoice {
  id: string
  label: string
  affinityKcalMol: number | null
  compound: string
}

export interface EndpointChoice {
  id: string
  label: string
  evidence?: "EXPERIMENTAL" | "SYNTHETIC" | "MIXED"
}

export interface AnalysisChoice {
  id: "overall" | "comparison" | "statistics" | "limitations" | "conclusion"
  label: string
}

export interface AssistantCatalog {
  stages: ExploreStage[]
  docking: DockingChoice[]
  predictions: EndpointChoice[]
  laboratory: EndpointChoice[]
  analysis: AnalysisChoice[]
  hasFormulation: boolean
}

export const EMPTY_CATALOG: AssistantCatalog = {
  stages: ["entire"],
  docking: [],
  predictions: [],
  laboratory: [],
  analysis: [],
  hasFormulation: false,
}

const STAGE_LABEL: Record<ExploreStage, string> = {
  entire: "Entire Study",
  setup: "Research Setup",
  insilico: "In-Silico Screening",
  docking: "Molecular Docking",
  predictions: "Biological Predictions",
  laboratory: "Laboratory Validation",
  analysis: "Analysis & Interpretation",
}

export function stageLabel(stage: ExploreStage): string {
  return STAGE_LABEL[stage]
}

export function askingAbout(stage: ExploreStage, detail: string | null): string {
  if (stage === "entire" || !detail) return STAGE_LABEL[stage]
  return `${STAGE_LABEL[stage]} / ${detail}`
}

export function pageForExplore(stage: ExploreStage, detail: string | null): AiPageContext {
  const focusLabel = detail?.trim() || null
  switch (stage) {
    case "setup":
      return { workflowStep: "setup", currentPage: "Research Setup", currentEndpoint: null, focusLabel: null }
    case "insilico":
      return { workflowStep: "insilico", currentPage: "In-Silico Screening", currentEndpoint: null, focusLabel: null }
    case "docking":
      return { workflowStep: "docking", currentPage: "Molecular Docking", currentEndpoint: null, focusLabel }
    case "predictions":
      return { workflowStep: "predictions", currentPage: "Biological Predictions", currentEndpoint: focusLabel, focusLabel }
    case "laboratory":
      return { workflowStep: "laboratory", currentPage: "Laboratory Validation", currentEndpoint: focusLabel, focusLabel }
    case "analysis":
      return { workflowStep: "analysis", currentPage: "Analysis & Interpretation", currentEndpoint: null, focusLabel }
    default:
      return { workflowStep: "", currentPage: "Entire study", currentEndpoint: null, focusLabel: null }
  }
}

export function selectionFromFocus(focus: AssistantFocusId): { stage: ExploreStage; detail: string | null } {
  switch (focus) {
    case "setup":
      return { stage: "setup", detail: null }
    case "insilico":
      return { stage: "insilico", detail: null }
    case "docking":
      return { stage: "docking", detail: null }
    case "laboratory":
    case "characterization":
      return { stage: "laboratory", detail: null }
    case "analysis":
      return { stage: "analysis", detail: null }
    case "dpph":
      return { stage: "predictions", detail: "DPPH" }
    case "mtt":
      return { stage: "predictions", detail: "MTT" }
    case "ldh":
      return { stage: "laboratory", detail: "LDH" }
    case "ros":
      return { stage: "predictions", detail: "ROS" }
    case "bax":
      return { stage: "predictions", detail: "BAX" }
    case "hippo-yap":
      return { stage: "predictions", detail: "Hippo–YAP" }
    default:
      return { stage: "entire", detail: null }
  }
}

export function detailAvailable(catalog: AssistantCatalog, stage: ExploreStage, detail: string): boolean {
  if (stage === "docking") return catalog.docking.some((item) => item.label === detail)
  if (stage === "predictions") return catalog.predictions.some((item) => item.label === detail)
  if (stage === "laboratory") return catalog.laboratory.some((item) => item.label === detail)
  if (stage === "analysis") return catalog.analysis.some((item) => item.label === detail)
  return false
}

export function exploreSuggestions(input: {
  stage: ExploreStage
  detail: string | null
  catalog: AssistantCatalog
}): string[] {
  const { stage, detail, catalog } = input
  const docking = catalog.docking.find((item) => item.label === detail)
  const prediction = catalog.predictions.find((item) => item.label === detail)
  const laboratory = catalog.laboratory.find((item) => item.label === detail)
  if (stage === "docking" && docking) {
    const affinity = formatAffinity(docking.affinityKcalMol)
    return [
      "Explain this docking result",
      affinity ? `What does ${affinity} kcal/mol mean?` : "What does this binding affinity mean?",
      catalog.docking.length > 1 ? `Compare ${docking.label} with other docking targets` : "How should this affinity be interpreted?",
      "What are the limitations of this result?",
    ]
  }
  if (stage === "docking") {
    return [
      "Explain my docking results",
      catalog.docking.length > 1 ? "Compare the docking targets" : "What does the binding affinity mean?",
      "Which result is the latest for each target?",
      "What are the limitations of these docking results?",
    ]
  }
  if (stage === "predictions" && prediction) {
    const lab = catalog.laboratory.some((item) => item.id === prediction.id)
    return [
      `Explain the ${prediction.label} prediction`,
      "What does the predicted value mean?",
      lab ? "Compare prediction with laboratory result" : "What would be needed to test this prediction?",
      "What evidence supports this prediction?",
    ]
  }
  if (stage === "predictions") {
    return [
      "Review my biological predictions",
      "Which predictions are recorded?",
      catalog.laboratory.length ? "Compare predictions with laboratory results" : "What are these predictions based on?",
      "What are the limitations of these predictions?",
    ]
  }
  if (stage === "laboratory" && laboratory) {
    const predicted = catalog.predictions.some((item) => item.id === laboratory.id)
    const experimental = laboratory.evidence === "EXPERIMENTAL" || laboratory.evidence === "MIXED"
    return [
      experimental ? `Explain my ${laboratory.label} results` : `Explain the ${laboratory.label} laboratory record`,
      "Summarize the concentration response",
      predicted ? `Compare ${laboratory.label} prediction and experiment` : `What does the ${laboratory.label} record show?`,
      "What are the limitations?",
    ]
  }
  if (stage === "laboratory") {
    return [
      "Explain my laboratory results",
      "Which endpoints have laboratory records?",
      catalog.predictions.length ? "Compare laboratory results with predictions" : "Summarize the recorded measurements",
      "What are the limitations?",
    ]
  }
  if (stage === "analysis") {
    if (detail === "Prediction vs Laboratory") {
      return [
        "Compare prediction and laboratory evidence",
        "Where do the results agree?",
        "Where is a direct comparison not supported?",
        "What are the limitations of this comparison?",
      ]
    }
    if (detail === "Statistics") {
      return [
        "Explain the statistical results",
        "Which comparisons are significant?",
        "What do the recorded p-values mean here?",
        "What are the limitations of this analysis?",
      ]
    }
    if (detail === "Limitations") return [
      "Identify the main research limitations",
      "Which evidence gaps matter most?",
      "What should not be concluded from this study?",
      "Which results still need laboratory evidence?",
    ]
    if (detail === "Conclusion") return [
      "Explain the recorded conclusion",
      "What findings support that conclusion?",
      "What remains uncertain?",
      "What should a reader be careful about?",
    ]
    return [
      "Summarize the analysis",
      "What are the key interpreted findings?",
      catalog.analysis.some((item) => item.id === "comparison") ? "How do predictions compare with laboratory results?" : "What evidence is the interpretation based on?",
      "What limitations are recorded?",
    ]
  }
  if (stage === "setup") {
    return [
      "Summarize the research setup",
      "Which phytochemicals and targets are selected?",
      "Which cell line is used?",
      catalog.hasFormulation ? "What formulation is recorded?" : "What is included in the study design?",
    ]
  }
  if (stage === "insilico") {
    return [
      "Explain the in-silico screening",
      "Summarize the recorded ADME results",
      "What do these screening values mean?",
      "What are the limitations of this screening?",
    ]
  }
  return [
    "Summarize my research findings",
    "What are the main findings?",
    "Where is the recorded evidence strongest?",
    "What are the main limitations?",
  ]
}

function formatAffinity(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null
  const text = String(value)
  return text.startsWith("-") ? `−${text.slice(1)}` : text
}
