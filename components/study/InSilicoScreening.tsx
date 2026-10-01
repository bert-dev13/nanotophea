"use client"

import { useRef, type KeyboardEvent, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, Check, LayoutDashboard, Shield } from "lucide-react"
import type { StudyStatus } from "@/lib/domain/models"
import type { StudyReadiness } from "@/lib/workflow/studyFlow"

const STATUS_LABEL: Record<StudyStatus, string> = {
  draft: "Draft",
  active: "Active",
  analysis: "Analysis",
  archived: "Archived",
}

interface ScreenSection {
  id: string
  number: string
  label: string
  hint: string
  icon: typeof Shield
}

const SECTIONS: ScreenSection[] = [
  {
    id: "overview",
    number: "01",
    label: "Overview",
    hint: "Inputs for this screen",
    icon: LayoutDashboard,
  },
  {
    id: "admet",
    number: "02",
    label: "ADMET",
    hint: "Drug-likeness records",
    icon: Shield,
  },
]

const MISSING_SETUP: Record<string, string> = {
  phytochemical: "phytochemicals",
  protein: "proteins",
}

interface InSilicoScreeningProps {
  title: string
  status: StudyStatus
  tab: string
  readiness: StudyReadiness | null
  checkError: string | null
  checking: boolean
  missing: string[]
  onTab: (tab: string) => void
  onBack: () => void
  onGap: (setupTab: string) => void
  onContinue: () => void
  children: ReactNode
}

export function InSilicoScreening({
  title,
  status,
  tab,
  readiness,
  checkError,
  checking,
  missing,
  onTab,
  onBack,
  onGap,
  onContinue,
  children,
}: InSilicoScreeningProps) {
  const continueDisabled = checking || !readiness || missing.length > 0 || Boolean(checkError)
  const inputs = [
    { id: "compounds", ready: (readiness?.compounds ?? 0) > 0 },
    { id: "proteins", ready: (readiness?.proteins ?? 0) > 0 },
  ]
  const readyCount = inputs.filter((item) => item.ready).length
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
          <p className="nano-setup-kicker">02 · In-Silico Screening</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="nano-setup-title">{title}</h1>
            <span className="nano-study-status" data-status={status}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="nano-setup-lead">
            Review the phytochemical and target protein, then keep ADMET values with their own evidence
            class. Docking opens once both inputs are recorded.
          </p>
          <p className="nano-setup-note">Computational outputs do not constitute experimental proof.</p>
        </div>
        <div className="nano-setup-progress" aria-live="polite">
          <p className="nano-setup-progress-label">Ready for docking</p>
          <p className="nano-setup-progress-value">
            {readiness ? (
              <>
                <span>{readyCount}</span>
                <span>of 2</span>
              </>
            ) : (
              "Checking"
            )}
          </p>
          <div className="nano-setup-meter" style={{ gridTemplateColumns: "repeat(2, 1fr)" }} aria-hidden>
            {inputs.map((item) => (
              <span key={item.id} data-on={readiness && item.ready ? "true" : "false"} />
            ))}
          </div>
          <p className="nano-setup-progress-hint">
            {readiness
              ? readyCount === 2
                ? "Phytochemical and target protein are recorded"
                : `${2 - readyCount} still needed before docking`
              : "Loading study records"}
          </p>
        </div>
      </header>

      <div className="nano-setup-steps nano-setup-steps--pair" role="tablist" aria-label="In-silico screening sections">
        {SECTIONS.map((section, index) => {
          const selected = section.id === tab
          const done = sectionDone(section.id, readiness)
          const Icon = section.icon
          const state = readiness == null ? "pending" : done ? "done" : section.id === "admet" ? "optional" : "needed"
          return (
            <button
              key={section.id}
              ref={(node) => {
                tabRefs.current[index] = node
              }}
              id={`screen-step-${section.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="screen-stage"
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
                  {done && !selected ? <Check size={15} strokeWidth={2.5} /> : <Icon size={15} strokeWidth={1.85} />}
                </span>
                <span className="nano-setup-num">{section.number}</span>
              </span>
              <span className="nano-setup-step-label">{section.label}</span>
              <span className="nano-setup-step-hint">{section.hint}</span>
              <span className="nano-setup-step-meta">{sectionStatus(section.id, readiness)}</span>
            </button>
          )
        })}
      </div>

      <ScreenActions
        checkError={checkError}
        readiness={readiness}
        missing={missing}
        previous={previous}
        next={next}
        checking={checking}
        continueDisabled={continueDisabled}
        onTab={onTab}
        onBack={onBack}
        onGap={onGap}
        onContinue={onContinue}
        showStatus
      />

      <section
        id="screen-stage"
        role="tabpanel"
        aria-labelledby={`screen-step-${active.id}`}
        className="nano-setup-stage nano-step-in"
        key={tab}
      >
        {children}
      </section>

      <ScreenActions
        checkError={checkError}
        readiness={readiness}
        missing={missing}
        previous={previous}
        next={next}
        checking={checking}
        continueDisabled={continueDisabled}
        onTab={onTab}
        onBack={onBack}
        onGap={onGap}
        onContinue={onContinue}
      />
    </div>
  )
}

function ScreenActions({
  checkError,
  readiness,
  missing,
  previous,
  next,
  checking,
  continueDisabled,
  onTab,
  onBack,
  onGap,
  onContinue,
  showStatus = false,
}: {
  checkError: string | null
  readiness: StudyReadiness | null
  missing: string[]
  previous: ScreenSection | null
  next: ScreenSection | null
  checking: boolean
  continueDisabled: boolean
  onTab: (tab: string) => void
  onBack: () => void
  onGap: (setupTab: string) => void
  onContinue: () => void
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
          {!readiness && !checkError ? <p role="status">Checking required records…</p> : null}
          {missing.length > 0 ? (
            <div role="status">
              <p className="nano-setup-bar-kicker">Still required</p>
              <ul className="nano-setup-gaps">
                {missing.map((line) => {
                  const target = gapSetupTab(line)
                  return (
                    <li key={line}>
                      {target ? (
                        <button type="button" onClick={() => onGap(target)}>
                          {line}
                        </button>
                      ) : (
                        line
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : readiness ? (
            <p role="status">A phytochemical and a target protein are recorded. ADMET can be added before or after docking.</p>
          ) : null}
        </div>
      ) : (
        <p className="nano-setup-bar-status">
          {next ? `Next section: ${next.label}` : "Molecular docking is the next workflow step."}
        </p>
      )}
      <div className="nano-setup-bar-actions">
        <button type="button" className="nano-setup-back" onClick={previous ? () => onTab(previous.id) : onBack}>
          <ArrowLeft size={15} aria-hidden />
          {previous ? previous.label : "Research Setup"}
        </button>
        {next ? (
          <button type="button" className="nano-setup-next" onClick={() => onTab(next.id)}>
            Next step
            <ArrowRight size={15} aria-hidden />
          </button>
        ) : null}
        <button type="button" className="nano-setup-continue" disabled={continueDisabled} onClick={onContinue}>
          {checking ? "Checking…" : "Continue to Docking"}
          <ArrowRight size={15} aria-hidden />
        </button>
      </div>
    </div>
  )
}

function sectionDone(id: string, readiness: StudyReadiness | null): boolean {
  if (!readiness) return false
  if (id === "admet") return readiness.admetRuns > 0
  return readiness.compounds > 0 && readiness.proteins > 0
}

function sectionStatus(id: string, readiness: StudyReadiness | null): string {
  if (!readiness) return "Checking"
  if (id === "admet") {
    return readiness.admetRuns > 0 ? `${readiness.admetRuns} recorded` : "Optional"
  }
  if (readiness.compounds > 0 && readiness.proteins > 0) return "Inputs recorded"
  return "Needed"
}

function gapSetupTab(message: string): string | null {
  const text = message.toLowerCase()
  for (const [needle, tab] of Object.entries(MISSING_SETUP)) {
    if (text.includes(needle)) return tab
  }
  return null
}
