"use client"

import { ArrowUpRight, Atom, FlaskConical, Shield } from "lucide-react"

interface InSilicoOverviewProps {
  compounds: number | null
  proteins: number | null
  admetRuns: number | null
  onOpenAdmet: () => void
  onOpenSetup?: (tab: string) => void
}

/** Orientation only. Counts come from stored records; nothing is computed here. */
export function InSilicoOverview({
  compounds,
  proteins,
  admetRuns,
  onOpenAdmet,
  onOpenSetup,
}: InSilicoOverviewProps) {
  return (
    <div className="nano-screen-board">
      <p className="nano-screen-lead">
        Screen the selected phytochemical before docking. Each ADMET value keeps its own evidence
        class: tool output, literature, or reference metadata.
      </p>

      <div className="nano-screen-grid">
        <RecordCard
          icon={FlaskConical}
          label="Phytochemicals"
          count={compounds}
          empty="Add a phytochemical in Research Setup before ADMET or docking."
          action="Open in setup"
          onAction={onOpenSetup ? () => onOpenSetup("phytochemicals") : undefined}
        />
        <RecordCard
          icon={Atom}
          label="Target proteins"
          count={proteins}
          empty="Add a target protein in Research Setup before docking."
          action="Open in setup"
          onAction={onOpenSetup ? () => onOpenSetup("proteins") : undefined}
        />
        <RecordCard
          icon={Shield}
          label="ADMET records"
          count={admetRuns}
          empty="No ADMET records in this study yet. Docking does not require one."
          action="Open ADMET"
          onAction={onOpenAdmet}
          optional
        />
      </div>
    </div>
  )
}

function RecordCard({
  icon: Icon,
  label,
  count,
  empty,
  action,
  onAction,
  optional = false,
}: {
  icon: typeof Shield
  label: string
  count: number | null
  empty: string
  action: string
  onAction?: () => void
  optional?: boolean
}) {
  const ready = count != null && count > 0
  return (
    <article className="nano-screen-card" data-state={count == null ? "pending" : ready ? "done" : optional ? "optional" : "needed"}>
      <div className="nano-screen-card-top">
        <span className="nano-setup-glyph" aria-hidden>
          <Icon size={15} strokeWidth={1.85} />
        </span>
        <span className="nano-screen-count">{count == null ? "…" : count}</span>
      </div>
      <h2 className="nano-screen-card-title">{label}</h2>
      <p className="nano-screen-card-copy">
        {count == null ? "Checking records…" : ready ? `${count} recorded in this study.` : empty}
      </p>
      {onAction ? (
        <button type="button" className="nano-screen-link" onClick={onAction}>
          {action}
          <ArrowUpRight size={14} aria-hidden />
        </button>
      ) : null}
    </article>
  )
}
