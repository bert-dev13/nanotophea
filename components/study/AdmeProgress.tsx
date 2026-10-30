"use client"

import { AlertCircle, Check } from "lucide-react"

export type StageState = "done" | "active" | "waiting" | "error"

export interface AssessmentStageView {
  id: "compound" | "pubchem" | "lipinski" | "prototype" | "complete"
  label: string
  state: StageState
}

export function startAssessmentStages(): AssessmentStageView[] {
  return [
    { id: "compound", label: "Compound identified", state: "done" },
    { id: "pubchem", label: "Retrieving PubChem properties...", state: "active" },
    { id: "lipinski", label: "Evaluating Lipinski rules...", state: "waiting" },
    { id: "prototype", label: "Preparing ADME assessment...", state: "waiting" },
    { id: "complete", label: "Assessment complete", state: "waiting" },
  ]
}

export function AdmeProgress({
  running,
  stages,
  showRun,
  onRun,
}: {
  running: boolean
  stages: AssessmentStageView[]
  showRun: boolean
  onRun: () => void
}) {
  const visible = stages.filter((stage) => stage.state !== "waiting")
  if (!showRun && visible.length === 0) return null
  return (
    <div className="adme-progress" aria-live="polite">
      {showRun ? (
        <button type="button" className="adme-action" disabled={running} aria-busy={running} onClick={onRun}>
          {running ? <span className="adme-spin" aria-hidden /> : null}
          {running ? "Running ADME Assessment..." : "Run Assessment"}
        </button>
      ) : null}
      {visible.length > 0 ? (
        <ol className="adme-stages">
          {visible.map((stage) => (
            <li key={stage.id} data-state={stage.state}>
              {stage.state === "done" ? <Check size={14} aria-hidden /> : null}
              {stage.state === "error" ? <AlertCircle size={14} aria-hidden /> : null}
              {stage.state === "active" ? <span className="adme-spin" aria-hidden /> : null}
              <span>{stage.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
