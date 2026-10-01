"use client"

import type { ReactNode } from "react"
import { ArrowLeft, ArrowRight, Atom, Cpu, FlaskConical } from "lucide-react"
import type { StudyStatus } from "@/lib/domain/models"
import { continueAdvisory, type StudyReadiness } from "@/lib/workflow/studyFlow"

const STATUS_LABEL: Record<StudyStatus, string> = {
  draft: "Draft",
  active: "Active",
  analysis: "Analysis",
  archived: "Archived",
}

interface MolecularDockingProps {
  title: string
  status: StudyStatus
  readiness: StudyReadiness | null
  checkError: string | null
  checking: boolean
  onBack: () => void
  onOpenSetup: (tab: string) => void
  onContinue: () => void
  children: ReactNode
}

export function MolecularDocking({
  title,
  status,
  readiness,
  checkError,
  checking,
  onBack,
  onOpenSetup,
  onContinue,
  children,
}: MolecularDockingProps) {
  const continueDisabled = checking || !readiness || Boolean(checkError)
  const runs = readiness?.dockingRuns ?? null
  const ligandReady = (readiness?.compounds ?? 0) > 0
  const proteinReady = (readiness?.proteins ?? 0) > 0
  const advisory = readiness ? continueAdvisory("docking", readiness) : null
  const gaps = readiness
    ? [
        !ligandReady
          ? { tab: "phytochemicals", line: "Add a phytochemical before recording a Vina run." }
          : null,
        !proteinReady
          ? { tab: "proteins", line: "Add a target protein before recording a Vina run." }
          : null,
      ].filter((item): item is { tab: string; line: string } => item != null)
    : []

  return (
    <div className="nano-setup">
      <header className="nano-setup-intro">
        <div className="min-w-0">
          <p className="nano-setup-kicker">03 · Molecular Docking</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="nano-setup-title">{title}</h1>
            <span className="nano-study-status" data-status={status}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="nano-setup-lead">
            Enter AutoDock Vina results run outside NANOTOPHEA. Affinity is a prediction and is not
            experimental evidence. Biological predictions stay a separate step.
          </p>
          <p className="nano-setup-note">Computational outputs do not constitute experimental proof.</p>
        </div>
        <div className="nano-setup-progress" aria-live="polite">
          <p className="nano-setup-progress-label">Vina runs</p>
          <p className="nano-setup-progress-value">
            {runs == null ? (
              "Checking"
            ) : (
              <>
                <span>{runs}</span>
                <span>recorded</span>
              </>
            )}
          </p>
          <div className="nano-setup-meter" style={{ gridTemplateColumns: "repeat(2, 1fr)" }} aria-hidden>
            <span data-on={readiness && ligandReady ? "true" : "false"} />
            <span data-on={readiness && proteinReady ? "true" : "false"} />
          </div>
          <p className="nano-setup-progress-hint">
            {readiness
              ? ligandReady && proteinReady
                ? "Ligand and receptor are recorded"
                : "Ligand and receptor are needed before a run"
              : "Loading study records"}
          </p>
        </div>
      </header>

      <div className="nano-screen-grid">
        <StatusCard
          icon={FlaskConical}
          label="Phytochemical"
          count={readiness ? readiness.compounds : null}
          hint="Ligand for the Vina run"
          action="Open in setup"
          onAction={() => onOpenSetup("phytochemicals")}
        />
        <StatusCard
          icon={Atom}
          label="Target protein"
          count={readiness ? readiness.proteins : null}
          hint="Receptor for the Vina run"
          action="Open in setup"
          onAction={() => onOpenSetup("proteins")}
        />
        <StatusCard
          icon={Cpu}
          label="Vina runs"
          count={runs}
          hint="Imported AutoDock Vina output"
          state={runs == null ? "pending" : runs > 0 ? "done" : "optional"}
        />
      </div>

      <div className="nano-setup-bar">
        <div className="nano-setup-bar-status">
          {checkError ? (
            <p className="nano-setup-alert" role="status">
              {checkError}
            </p>
          ) : null}
          {!readiness && !checkError ? <p role="status">Checking docking records…</p> : null}
          {gaps.length > 0 ? (
            <div role="status">
              <p className="nano-setup-bar-kicker">Before a Vina run</p>
              <ul className="nano-setup-gaps">
                {gaps.map((gap) => (
                  <li key={gap.tab}>
                    <button type="button" onClick={() => onOpenSetup(gap.tab)}>
                      {gap.line}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : advisory ? (
            <p role="status">{advisory}</p>
          ) : readiness ? (
            <p role="status">
              {runs} AutoDock Vina {runs === 1 ? "run is" : "runs are"} recorded.
            </p>
          ) : null}
        </div>
        <div className="nano-setup-bar-actions">
          <button type="button" className="nano-setup-back" onClick={onBack}>
            <ArrowLeft size={15} aria-hidden />
            In-Silico Screening
          </button>
          <button type="button" className="nano-setup-continue" disabled={continueDisabled} onClick={onContinue}>
            {checking ? "Checking…" : "Continue to Predictions"}
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      </div>

      <section className="nano-setup-stage nano-step-in">{children}</section>
    </div>
  )
}

function StatusCard({
  icon: Icon,
  label,
  count,
  hint,
  action,
  onAction,
  state,
}: {
  icon: typeof Cpu
  label: string
  count: number | null
  hint: string
  action?: string
  onAction?: () => void
  state?: "pending" | "done" | "needed" | "optional"
}) {
  const resolved = state ?? (count == null ? "pending" : count > 0 ? "done" : "needed")
  return (
    <article className="nano-screen-card" data-state={resolved}>
      <div className="nano-screen-card-top">
        <span className="nano-setup-glyph" aria-hidden>
          <Icon size={15} strokeWidth={1.85} />
        </span>
        <span className="nano-screen-count">{count == null ? "…" : count}</span>
      </div>
      <h2 className="nano-screen-card-title">{label}</h2>
      <p className="nano-screen-card-copy">{hint}</p>
      {action && onAction ? (
        <button type="button" className="nano-screen-link" onClick={onAction}>
          {action}
          <ArrowRight size={14} aria-hidden />
        </button>
      ) : (
        <p className="nano-screen-card-copy">
          {count == null ? "Checking records…" : count > 0 ? `${count} recorded in this study.` : "None recorded yet."}
        </p>
      )}
    </article>
  )
}
