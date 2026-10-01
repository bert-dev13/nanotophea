"use client"

import { useRef, type KeyboardEvent, type ReactNode } from "react"
import { ArrowLeft, ArrowRight, Check, Droplets, FlaskConical, TestTubes } from "lucide-react"
import type { StudyStatus } from "@/lib/domain/models"
import { continueAdvisory, type StudyReadiness } from "@/lib/workflow/studyFlow"

const STATUS_LABEL: Record<StudyStatus, string> = {
  draft: "Draft",
  active: "Active",
  analysis: "Analysis",
  archived: "Archived",
}

type CountKey = "labDpph" | "labLdh" | "characterization"

interface LabSection {
  id: string
  number: string
  label: string
  hint: string
  countKey: CountKey
  icon: typeof FlaskConical
}

const SECTIONS: LabSection[] = [
  {
    id: "dpph",
    number: "01",
    label: "Experimental DPPH",
    hint: "Antioxidant assay",
    countKey: "labDpph",
    icon: FlaskConical,
  },
  {
    id: "ldh",
    number: "02",
    label: "Experimental LDH",
    hint: "Cytotoxicity assay",
    countKey: "labLdh",
    icon: Droplets,
  },
  {
    id: "characterization",
    number: "03",
    label: "Characterization",
    hint: "HPLC and related records",
    countKey: "characterization",
    icon: TestTubes,
  },
]

interface LaboratoryValidationProps {
  title: string
  status: StudyStatus
  tab: string
  readiness: StudyReadiness | null
  checkError: string | null
  checking: boolean
  onTab: (tab: string) => void
  onBack: () => void
  onContinue: () => void
  children: ReactNode
}

export function LaboratoryValidation({
  title,
  status,
  tab,
  readiness,
  checkError,
  checking,
  onTab,
  onBack,
  onContinue,
  children,
}: LaboratoryValidationProps) {
  const continueDisabled = checking || !readiness || Boolean(checkError)
  const recorded = SECTIONS.filter((section) => (readiness?.[section.countKey] ?? 0) > 0)
  const activeIndex = Math.max(0, SECTIONS.findIndex((section) => section.id === tab))
  const active = SECTIONS[activeIndex]
  const previous = activeIndex > 0 ? SECTIONS[activeIndex - 1] : null
  const next = activeIndex < SECTIONS.length - 1 ? SECTIONS[activeIndex + 1] : null
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const advisory = readiness ? continueAdvisory("laboratory", readiness) : null

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
          <p className="nano-setup-kicker">05 · Laboratory Validation</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="nano-setup-title">{title}</h1>
            <span className="nano-study-status" data-status={status}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="nano-setup-lead">
            Enter experimental DPPH, experimental LDH, and characterization from laboratory records.
            Analysis uses these datasets only. Predictions stay separate.
          </p>
          <p className="nano-setup-note">Computational outputs do not constitute experimental proof.</p>
        </div>
        <div className="nano-setup-progress" aria-live="polite">
          <p className="nano-setup-progress-label">Laboratory records</p>
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
              <span key={section.id} data-on={readiness && readiness[section.countKey] > 0 ? "true" : "false"} />
            ))}
          </div>
          <p className="nano-setup-progress-hint">
            {readiness
              ? recorded.length === 0
                ? "No experimental dataset recorded yet"
                : recorded.map((section) => section.label.replace("Experimental ", "")).join(", ")
              : "Loading study records"}
          </p>
        </div>
      </header>

      <div className="nano-setup-steps nano-setup-steps--trio" role="tablist" aria-label="Laboratory validation sections">
        {SECTIONS.map((section, index) => {
          const count = readiness ? readiness[section.countKey] : null
          const done = count != null && count > 0
          const selected = section.id === tab
          const Icon = section.icon
          const state = count == null ? "pending" : done ? "done" : "optional"
          return (
            <button
              key={section.id}
              ref={(node) => {
                tabRefs.current[index] = node
              }}
              id={`lab-step-${section.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="lab-stage"
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
              <span className="nano-setup-step-meta">{count == null ? "Checking" : done ? `${count} recorded` : "None yet"}</span>
            </button>
          )
        })}
      </div>

      <LabActions
        checkError={checkError}
        readiness={readiness}
        advisory={advisory}
        previous={previous}
        next={next}
        checking={checking}
        continueDisabled={continueDisabled}
        onTab={onTab}
        onBack={onBack}
        onContinue={onContinue}
        showStatus
      />

      <section
        id="lab-stage"
        role="tabpanel"
        aria-labelledby={`lab-step-${active.id}`}
        className="nano-setup-stage nano-step-in"
        key={tab}
      >
        {children}
      </section>

      <LabActions
        checkError={checkError}
        readiness={readiness}
        advisory={advisory}
        previous={previous}
        next={next}
        checking={checking}
        continueDisabled={continueDisabled}
        onTab={onTab}
        onBack={onBack}
        onContinue={onContinue}
      />
    </div>
  )
}

function LabActions({
  checkError,
  readiness,
  advisory,
  previous,
  next,
  checking,
  continueDisabled,
  onTab,
  onBack,
  onContinue,
  showStatus = false,
}: {
  checkError: string | null
  readiness: StudyReadiness | null
  advisory: string | null
  previous: LabSection | null
  next: LabSection | null
  checking: boolean
  continueDisabled: boolean
  onTab: (tab: string) => void
  onBack: () => void
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
          {!readiness && !checkError ? <p role="status">Checking laboratory records…</p> : null}
          {advisory ? <p role="status">{advisory}</p> : null}
          {readiness && !advisory ? (
            <p role="status">Laboratory datasets are on file. Analysis uses these records only.</p>
          ) : null}
        </div>
      ) : (
        <p className="nano-setup-bar-status">
          {next ? `Next section: ${next.label}` : "Analysis is the next workflow step."}
        </p>
      )}
      <div className="nano-setup-bar-actions">
        <button type="button" className="nano-setup-back" onClick={previous ? () => onTab(previous.id) : onBack}>
          <ArrowLeft size={15} aria-hidden />
          {previous ? previous.label : "Predictions"}
        </button>
        {next ? (
          <button type="button" className="nano-setup-next" onClick={() => onTab(next.id)}>
            Next step
            <ArrowRight size={15} aria-hidden />
          </button>
        ) : null}
        <button type="button" className="nano-setup-continue" disabled={continueDisabled} onClick={onContinue}>
          {checking ? "Checking…" : "Continue to Analysis"}
          <ArrowRight size={15} aria-hidden />
        </button>
      </div>
    </div>
  )
}
