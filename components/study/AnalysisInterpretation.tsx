"use client"

import { useRef, type KeyboardEvent, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, BarChart3, Check, CircleAlert, Scale, ScrollText } from "lucide-react"
import type { StudyStatus } from "@/lib/domain/models"
import { analysisNeedsReview, type StudyReadiness } from "@/lib/workflow/studyFlow"

const STATUS_LABEL: Record<StudyStatus, string> = {
  draft: "Draft",
  active: "Active",
  analysis: "Analysis",
  archived: "Archived",
}

interface AnalysisSection {
  id: string
  number: string
  label: string
  hint: string
  countKey: "statistics" | "comparisons" | "interpretations"
  staleKey: "staleStatistics" | "staleComparisons" | "staleInterpretations"
  icon: typeof BarChart3
}

const SECTIONS: AnalysisSection[] = [
  {
    id: "statistics",
    number: "01",
    label: "Statistics",
    hint: "Laboratory datasets only",
    countKey: "statistics",
    staleKey: "staleStatistics",
    icon: BarChart3,
  },
  {
    id: "comparison",
    number: "02",
    label: "Comparison",
    hint: "Prediction versus experiment",
    countKey: "comparisons",
    staleKey: "staleComparisons",
    icon: Scale,
  },
  {
    id: "interpretation",
    number: "03",
    label: "Interpretation",
    hint: "Researcher-authored conclusion",
    countKey: "interpretations",
    staleKey: "staleInterpretations",
    icon: ScrollText,
  },
]

interface AnalysisInterpretationProps {
  title: string
  status: StudyStatus
  tab: string
  readiness: StudyReadiness | null
  checkError: string | null
  onTab: (tab: string) => void
  onBack: () => void
  children: ReactNode
}

export function AnalysisInterpretation({
  title,
  status,
  tab,
  readiness,
  checkError,
  onTab,
  onBack,
  children,
}: AnalysisInterpretationProps) {
  const recorded = SECTIONS.filter((section) => (readiness?.[section.countKey] ?? 0) > 0)
  const needsReview = readiness ? analysisNeedsReview(readiness) : false
  const activeIndex = Math.max(0, SECTIONS.findIndex((section) => section.id === tab))
  const active = SECTIONS[activeIndex]
  const previous = activeIndex > 0 ? SECTIONS[activeIndex - 1] : null
  const next = activeIndex < SECTIONS.length - 1 ? SECTIONS[activeIndex + 1] : null
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return
    }
    event.preventDefault()
    const last = SECTIONS.length - 1
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowRight"
            ? (index + 1) % SECTIONS.length
            : (index - 1 + SECTIONS.length) % SECTIONS.length
    tabRefs.current[target]?.focus()
    onTab(SECTIONS[target].id)
  }

  return (
    <div className="nano-setup">
      <header className="nano-setup-intro">
        <div className="min-w-0">
          <p className="nano-setup-kicker">06 · Analysis & Interpretation</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="nano-setup-title">{title}</h1>
            <span className="nano-study-status" data-status={status}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="nano-setup-lead">
            Statistics use laboratory datasets only. Comparison sets prediction beside experiment.
            Interpretation is written by the researcher and is not experimental proof.
          </p>
          <p className="nano-setup-note">Computational outputs do not constitute experimental proof.</p>
        </div>
        <div className="nano-setup-progress" aria-live="polite">
          <p className="nano-setup-progress-label">Analysis records</p>
          <p className="nano-setup-progress-value">
            {readiness ? (
              <>
                <span>{recorded.length}</span>
                <span>of 3</span>
              </>
            ) : (
              "Checking"
            )}
          </p>
          <div className="nano-setup-meter" style={{ gridTemplateColumns: "repeat(3, 1fr)" }} aria-hidden>
            {SECTIONS.map((section) => (
              <span
                key={section.id}
                data-on={readiness && readiness[section.countKey] > 0 ? "true" : "false"}
              />
            ))}
          </div>
          <p className="nano-setup-progress-hint">
            {!readiness
              ? "Loading study records"
              : needsReview
                ? "A saved record is stale and needs review"
                : recorded.length === 0
                  ? "No analysis record saved yet"
                  : recorded.map((section) => section.label).join(", ")}
          </p>
        </div>
      </header>

      <div className="nano-setup-steps nano-setup-steps--trio" role="tablist" aria-label="Analysis sections">
        {SECTIONS.map((section, index) => {
          const count = readiness ? readiness[section.countKey] : null
          const stale = readiness ? readiness[section.staleKey] > 0 : false
          const done = count != null && count > 0 && !stale
          const selected = section.id === tab
          const Icon = section.icon
          const state = count == null ? "pending" : stale ? "review" : done ? "done" : "optional"
          return (
            <button
              key={section.id}
              ref={(node) => {
                tabRefs.current[index] = node
              }}
              id={`analysis-step-${section.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="analysis-stage"
              tabIndex={selected ? 0 : -1}
              className="nano-setup-step"
              data-current={selected ? "true" : undefined}
              data-state={state}
              style={{ animationDelay: `${40 + index * 45}ms` }}
              onClick={() => onTab(section.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <span className="nano-setup-step-top">
                <span className="nano-setup-glyph" aria-hidden>
                  {stale ? (
                    <CircleAlert size={15} strokeWidth={2.25} />
                  ) : done && !selected ? (
                    <Check size={15} strokeWidth={2.5} />
                  ) : (
                    <Icon size={15} strokeWidth={1.85} />
                  )}
                </span>
                <span className="nano-setup-num">{section.number}</span>
              </span>
              <span className="nano-setup-step-label">{section.label}</span>
              <span className="nano-setup-step-hint">{section.hint}</span>
              <span className="nano-setup-step-meta">{sectionMeta(count, stale)}</span>
            </button>
          )
        })}
      </div>

      <AnalysisActions
        checkError={checkError}
        readiness={readiness}
        needsReview={needsReview}
        previous={previous}
        next={next}
        onTab={onTab}
        onBack={onBack}
        showStatus
      />

      <section
        id="analysis-stage"
        role="tabpanel"
        aria-labelledby={`analysis-step-${active.id}`}
        className="nano-setup-stage nano-step-in"
        key={tab}
      >
        {children}
      </section>

      <AnalysisActions
        checkError={checkError}
        readiness={readiness}
        needsReview={needsReview}
        previous={previous}
        next={next}
        onTab={onTab}
        onBack={onBack}
      />
    </div>
  )
}

function AnalysisActions({
  checkError,
  readiness,
  needsReview,
  previous,
  next,
  onTab,
  onBack,
  showStatus = false,
}: {
  checkError: string | null
  readiness: StudyReadiness | null
  needsReview: boolean
  previous: AnalysisSection | null
  next: AnalysisSection | null
  onTab: (tab: string) => void
  onBack: () => void
  showStatus?: boolean
}) {
  return (
    <div className="nano-setup-bar">
      {showStatus ? (
        <div className="nano-setup-bar-status">
          {checkError ? (
            <p className="nano-setup-alert" role="status">
              {checkError}
            </p>
          ) : null}
          {!readiness && !checkError ? <p role="status">Checking analysis records…</p> : null}
          {needsReview ? (
            <p role="status">
              A saved statistics, comparison, or interpretation record is stale. Do not treat it as current.
            </p>
          ) : null}
          {readiness && !needsReview ? (
            <p role="status">This is the last workflow step. Statistics stay tied to laboratory datasets.</p>
          ) : null}
        </div>
      ) : (
        <p className="nano-setup-bar-status">
          {next ? `Next section: ${next.label}` : "This is the last workflow step."}
        </p>
      )}
      <div className="nano-setup-bar-actions">
        <button type="button" className="nano-setup-back" onClick={previous ? () => onTab(previous.id) : onBack}>
          <ArrowLeft size={15} aria-hidden />
          {previous ? previous.label : "Laboratory"}
        </button>
        {next ? (
          <button type="button" className="nano-setup-next" onClick={() => onTab(next.id)}>
            Next step
            <ArrowRight size={15} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function sectionMeta(count: number | null, stale: boolean): string {
  if (count == null) return "Checking"
  if (stale) return "Review"
  if (count > 0) return `${count} recorded`
  return "None yet"
}
