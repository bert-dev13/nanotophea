"use client"

interface InSilicoOverviewProps {
  compounds: number | null
  admetRuns: number | null
  onOpenAdmet: () => void
}

/** Orientation only. Counts come from stored records; nothing is computed here. */
export function InSilicoOverview({ compounds, admetRuns, onOpenAdmet }: InSilicoOverviewProps) {
  return (
    <div className="nano-step-in max-w-xl space-y-4 py-2">
      <p className="text-[13.5px] leading-relaxed text-[var(--foreground)]">
        Screen the selected phytochemical before docking. ADMET keeps each value’s own evidence
        class: tool output, literature, or reference metadata.
      </p>

      <dl className="grid grid-cols-2 gap-3 text-[13px]">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
            Phytochemicals
          </dt>
          <dd className="mt-1 font-semibold tabular-nums">{compounds == null ? "…" : compounds}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
            ADMET records
          </dt>
          <dd className="mt-1 font-semibold tabular-nums">{admetRuns == null ? "…" : admetRuns}</dd>
        </div>
      </dl>

      {compounds === 0 ? (
        <p className="text-[13px] text-[var(--foreground)]">
          Add a phytochemical in Research Setup before ADMET or docking.
        </p>
      ) : null}

      {admetRuns === 0 ? (
        <p className="text-[13px] text-[var(--muted-foreground)]">
          No ADMET records in this study yet.
        </p>
      ) : null}

      <button type="button" className="nano-flow-next" onClick={onOpenAdmet}>
        Open ADMET
      </button>
    </div>
  )
}
