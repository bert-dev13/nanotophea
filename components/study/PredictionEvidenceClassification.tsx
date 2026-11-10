"use client"

import { AlertTriangle, BookOpen, FlaskConical, HelpCircle } from "lucide-react"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import type { PredictionEndpoint, PredictionRun } from "@/lib/domain/models"
import {
  resolvePredictionEvidenceDisplay,
  type PredictionEvidenceDisplayClass,
} from "@/lib/predictions/evidenceDisplay"
import type { EvidenceType } from "@/types/evidence"

function badgeForClass(cls: PredictionEvidenceDisplayClass): EvidenceType | null {
  if (cls === "SIMULATION") return "SIMULATION"
  if (cls === "PREDICTED") return "PREDICTED"
  if (cls === "EXPERIMENTAL") return "EXPERIMENTAL"
  return null
}

export function PredictionEvidenceClassification({
  endpoint,
  run,
  assumptionsHref,
}: {
  endpoint: PredictionEndpoint
  run?: PredictionRun | null
  assumptionsHref?: string
}) {
  const display = resolvePredictionEvidenceDisplay(endpoint, run, { assumptionsHref })
  const badgeType = badgeForClass(display.class)

  return (
    <aside
      className="prediction-evidence-panel"
      data-evidence={display.class}
      role="note"
      aria-label={`Evidence classification: ${display.class.replaceAll("_", " ")}`}
    >
      <div className="prediction-evidence-panel__header">
        {badgeType ? (
          <EvidenceBadge type={badgeType} size="sm" />
        ) : (
          <span className="prediction-evidence-na-badge">
            <HelpCircle size={10} strokeWidth={2.25} aria-hidden />
            NOT AVAILABLE
          </span>
        )}
        <strong className="prediction-evidence-panel__title">{display.title}</strong>
      </div>

      <p className="prediction-evidence-panel__summary">{display.summary}</p>

      {display.showAssumptionsLink ? (
        <p className="prediction-evidence-panel__link-row">
          <BookOpen size={12} aria-hidden />
          <a href={display.assumptionsHref}>Assumptions and limitations</a>
        </p>
      ) : null}

      {display.dockingNote ? (
        <p className="prediction-evidence-panel__docking">
          <AlertTriangle size={12} aria-hidden />
          <span>{display.dockingNote}</span>
        </p>
      ) : null}

      {display.class === "EXPERIMENTAL" ? (
        <p className="prediction-evidence-panel__docking">
          <FlaskConical size={12} aria-hidden />
          <span>Laboratory Validation owns experimental assay records for this study.</span>
        </p>
      ) : null}
    </aside>
  )
}

/** Hero badge helper — never upgrades SIMULATION / unverified records to PREDICTED. */
export function predictionEvidenceBadgeType(
  endpoint: PredictionEndpoint,
  run?: PredictionRun | null,
): EvidenceType | "NOT_AVAILABLE" {
  const cls = resolvePredictionEvidenceDisplay(endpoint, run).class
  if (cls === "NOT_AVAILABLE") return "NOT_AVAILABLE"
  return cls
}
