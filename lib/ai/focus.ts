import type { AiPageContext } from "@/lib/ai/types"

export const ASSISTANT_FOCI = [
  { id: "entire", label: "Entire Study" },
  { id: "setup", label: "Research Setup" },
  { id: "insilico", label: "In-Silico Screening" },
  { id: "docking", label: "Molecular Docking" },
  { id: "dpph", label: "DPPH" },
  { id: "mtt", label: "MTT" },
  { id: "ldh", label: "LDH" },
  { id: "ros", label: "ROS" },
  { id: "bax", label: "BAX" },
  { id: "hippo-yap", label: "Hippo–YAP" },
  { id: "laboratory", label: "Laboratory Validation" },
  { id: "analysis", label: "Analysis & Interpretation" },
  { id: "characterization", label: "Product Characterization" },
] as const

export type AssistantFocusId = (typeof ASSISTANT_FOCI)[number]["id"]

const FOCUS_IDS = new Set<string>(ASSISTANT_FOCI.map((item) => item.id))

export function assistantFocusId(value: string | null | undefined): AssistantFocusId {
  return value && FOCUS_IDS.has(value) ? (value as AssistantFocusId) : "entire"
}

export function assistantHref(studyId: string, focus: AssistantFocusId = "entire"): string {
  const base = `/study/${studyId}/assistant`
  return focus === "entire" ? base : `${base}?context=${encodeURIComponent(focus)}`
}

export function pageFromFocus(focus: AssistantFocusId): AiPageContext {
  switch (focus) {
    case "setup":
      return { workflowStep: "setup", currentPage: "Research Setup", currentEndpoint: null }
    case "insilico":
      return { workflowStep: "insilico", currentPage: "In-Silico Screening", currentEndpoint: null }
    case "docking":
      return { workflowStep: "docking", currentPage: "Molecular Docking", currentEndpoint: null }
    case "dpph":
      return { workflowStep: "predictions", currentPage: "DPPH", currentEndpoint: "DPPH" }
    case "mtt":
      return { workflowStep: "predictions", currentPage: "MTT", currentEndpoint: "MTT" }
    case "ldh":
      return { workflowStep: "laboratory", currentPage: "LDH", currentEndpoint: "LDH" }
    case "ros":
      return { workflowStep: "predictions", currentPage: "ROS", currentEndpoint: "ROS" }
    case "bax":
      return { workflowStep: "predictions", currentPage: "BAX", currentEndpoint: "BAX" }
    case "hippo-yap":
      return { workflowStep: "predictions", currentPage: "Hippo–YAP", currentEndpoint: "Hippo–YAP" }
    case "laboratory":
      return { workflowStep: "laboratory", currentPage: "Laboratory Validation", currentEndpoint: null }
    case "analysis":
      return { workflowStep: "analysis", currentPage: "Analysis & Interpretation", currentEndpoint: null }
    case "characterization":
      return { workflowStep: "laboratory", currentPage: "Product Characterization", currentEndpoint: null }
    default:
      return { workflowStep: "", currentPage: "Entire study", currentEndpoint: null }
  }
}

export const ASSISTANT_PROMPTS = [
  "Explain my current study",
  "Summarize my research findings",
  "Explain my docking results",
  "Review my biological predictions",
  "Explain my laboratory results",
  "Explain my statistical analysis",
  "Compare computational and experimental findings",
  "Identify research limitations",
] as const
