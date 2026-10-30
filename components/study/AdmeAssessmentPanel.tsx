"use client"

import { useState } from "react"
import { PROTOTYPE_ADME_UNAVAILABLE } from "@/lib/adme/assessmentService"
import { ADME_ASSESSMENT_FAILED } from "@/lib/adme/types"
import type { AdmetRun } from "@/lib/domain/models"
import { type AdmePhase, presentAdmeGroups } from "@/lib/insilico/admeAssessment"

export function AdmeAssessmentPanel({
  compoundName,
  pubchemCid,
  phase,
  preparingPrototype,
  run,
  assessment,
  message,
  onRetry,
}: {
  compoundName: string
  pubchemCid?: number
  phase: AdmePhase
  preparingPrototype?: boolean
  run?: AdmetRun
  assessment?: { descriptors: Record<string, string> }
  message?: string
  onRetry: () => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  if (phase === "load_error") {
    return (
      <div className="adme-state">
        <p className="adme-state-label">Unable to load assessment</p>
        <button type="button" className="adme-action" onClick={onRetry}>Retry</button>
      </div>
    )
  }
  if (phase === "unavailable") {
    return (
      <div className="adme-state">
        <p>{message || "ADME service is currently unavailable."}</p>
        <button type="button" className="adme-action" onClick={onRetry}>Run assessment again</button>
      </div>
    )
  }
  if (phase === "failed") {
    return <Failure message={message} onRetry={onRetry} />
  }
  if (phase === "idle") {
    return (
      <p className="dock-note">Run the assessment for this compound.</p>
    )
  }
  if (phase === "running") {
    return (
      <div className="adme-running">
        {preparingPrototype ? null : (
          <p className="dock-note">ADME values appear after PubChem properties and Lipinski screening.</p>
        )}
        {preparingPrototype ? (
          <div className="phyto-skel" aria-hidden>
            <i /><i /><i /><i />
          </div>
        ) : null}
      </div>
    )
  }

  const prototype = assessment ?? (run && Object.keys(run.descriptors ?? {}).length > 0 ? assessmentFromRun(run) : undefined)
  if (prototype) {
    const groups = presentAdmeGroups({ descriptors: prototype.descriptors }).filter((group) => group.id !== "toxicity")
    const toxicity = presentAdmeGroups({ descriptors: prototype.descriptors }).find((group) => group.id === "toxicity")
    return (
      <div className="adme-record adme-reveal">
        {message && message !== PROTOTYPE_ADME_UNAVAILABLE ? <p className="dock-note">{message}</p> : null}
        {groups.map((group) => (
          <div key={group.id} className="adme-group">
            <p>{group.label}</p>
            <dl>
              {group.fields.map((field) => (
                <div key={field.id}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {detailsOpen && toxicity ? (
          <div className="adme-details-block">
            <div className="adme-group">
              <p>{toxicity.label}</p>
              <dl>
                {toxicity.fields.map((field) => (
                  <div key={field.id}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <dl className="adme-details">
              <div><dt>Compound</dt><dd>{compoundName}</dd></div>
              {pubchemCid != null ? <div><dt>PubChem CID</dt><dd>{pubchemCid}</dd></div> : null}
            </dl>
          </div>
        ) : null}
        <div className="adme-actions">
          {toxicity ? (
            <button type="button" className="adme-action" data-quiet="true" onClick={() => setDetailsOpen((open) => !open)}>
              {detailsOpen ? "Hide details" : "View Details"}
            </button>
          ) : null}
          <button type="button" className="adme-action" data-quiet="true" onClick={onRetry}>Run assessment again</button>
        </div>
      </div>
    )
  }

  return (
    <p className="dock-note">Run the assessment for this compound.</p>
  )
}

function assessmentFromRun(run: AdmetRun): { descriptors: Record<string, string> } {
  const descriptors = Object.fromEntries(
    Object.entries(run.descriptors ?? {}).flatMap(([key, value]) => {
      if (typeof value !== "string" || !value.trim()) return []
      return [[key, value]]
    }),
  )
  return { descriptors }
}

function Failure({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const specific = message && message !== ADME_ASSESSMENT_FAILED ? message : undefined
  return (
    <div className="adme-state">
      <p className="adme-state-label">ADME assessment could not be completed.</p>
      {specific ? <p>{specific}</p> : null}
      <button type="button" className="adme-action" onClick={onRetry}>Retry Assessment</button>
    </div>
  )
}
