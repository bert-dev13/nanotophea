export interface AiPageContext {
  workflowStep: string
  currentPage: string
  currentEndpoint?: string | null
  /** Selected result inside a stage, such as YAP1, DPPH, or Statistics. */
  focusLabel?: string | null
}

export interface DockingContextRow {
  pair: string
  affinityKcalMol: number
  pdbId?: string
  method?: string
  dockingReceptor?: string
  affinityNote?: string
  updatedAt?: string
  runCount?: number
  history?: Array<{ pair: string; affinityKcalMol: number; updatedAt?: string }>
}

export type LaboratoryEvidenceClass = "EXPERIMENTAL" | "SYNTHETIC" | "MIXED"

export interface AiChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface AiInterpretationDraft {
  overall: string
  relationship: string
  limitations: string
  conclusion: string
}

export interface StudyAISlice {
  title: string
  compounds: string[]
  proteins: string[]
  cellLines: string[]
  admetCount: number
  adme: Array<{ compound: string; source: string; lines: string[] }>
  docking: DockingContextRow[]
  dockingSkipped: Array<{ pair: string; reason: string }>
  predictions: Array<{ endpoint: string; evidence: string; lines: string[] }>
  laboratory: Array<{
    endpoint: string
    status: "recorded" | "not_tested" | "pending"
    evidence?: LaboratoryEvidenceClass
    lines?: string[]
  }>
  statistics: Array<{
    endpoint: string
    measurement: string
    pValue: number | null
    significant: boolean | null
    message: string
    means: string[]
  }>
  comparisons: Array<{ endpoint: string; mode: string; status: string; reason?: string }>
  characterization: string[]
  interpretation: {
    overall: string
    relationship: string
    limitations: string
    conclusion: string
  }
  coverage: { tested: number; endpoints: number }
}

export interface InterpretationEvidenceSummary {
  compounds: string[]
  dockingResults: number
  predictionEndpoints: number
  experimentalRecorded: number
  experimentalEndpoints: number
  statistics: "available" | "not_recorded"
  characterization: "available" | "not_recorded"
  literature: number
  snapshot: string
  setupRecorded: boolean
  insilicoRecorded: boolean
  dockingRecorded: boolean
  predictionsRecorded: boolean
}

export const TOGETHER_MODEL = "openai/gpt-oss-120b"
export const AI_UNAVAILABLE = "AI Assistant is temporarily unavailable."
export const AI_MISSING_EXPERIMENT = "No experimental result is currently recorded for this endpoint."
