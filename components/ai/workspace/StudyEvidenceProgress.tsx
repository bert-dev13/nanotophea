import { stepRecordStatus, WORKFLOW_STEPS, type StepId, type StudyReadiness } from "@/lib/workflow/studyFlow"

const SHORT: Record<StepId, string> = {
  setup: "Research Setup",
  insilico: "In-Silico",
  docking: "Docking",
  predictions: "Predictions",
  laboratory: "Laboratory",
  analysis: "Analysis",
}

export function StudyEvidenceProgress({
  readiness,
  tested,
}: {
  readiness: StudyReadiness | null
  tested: number | null
}) {
  return (
    <section className="ai-evidence-map">
      <h3>Study evidence</h3>
      <ol>
        {WORKFLOW_STEPS.map((step, index) => {
          const status = stepRecordStatus(step.id, readiness)
          const laboratory = step.id === "laboratory"
          const done = !laboratory && status === "complete"
          const partial = laboratory || status === "in_progress" || status === "review"
          return (
            <li key={step.id} data-state={done ? "done" : partial ? "partial" : "open"} style={{ animationDelay: `${index * 30}ms` }}>
              <span>{SHORT[step.id]}</span>
              {laboratory ? (
                <strong>{tested == null ? "—" : `${tested} / 6`}</strong>
              ) : done ? (
                <strong aria-label="Complete">✓</strong>
              ) : status === "in_progress" || status === "review" ? (
                <strong aria-label={status === "review" ? "Needs review" : "In progress"}>○</strong>
              ) : (
                <strong aria-label="Not recorded">·</strong>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
