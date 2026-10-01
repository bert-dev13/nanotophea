"use client"

import { useRef, type KeyboardEvent } from "react"
import { ArrowLeft, ArrowRight, Atom, Beaker, Check, FlaskConical, Microscope } from "lucide-react"
import { SetupRecords, type SetupCategory } from "@/components/study/setup/SetupRecords"
import type { StudyReadiness } from "@/lib/workflow/studyFlow"

type CountKey = "formulations" | "compounds" | "proteins" | "cellLines"

interface SetupSection {
  id: SetupCategory
  number: string
  label: string
  hint: string
  countKey: CountKey
  icon: typeof Beaker
}

const SECTIONS: SetupSection[] = [
  {
    id: "formulation",
    number: "01",
    label: "Formulations",
    hint: "Define what is prepared",
    countKey: "formulations",
    icon: Beaker,
  },
  {
    id: "phytochemicals",
    number: "02",
    label: "Phytochemicals",
    hint: "Choose compounds to study",
    countKey: "compounds",
    icon: FlaskConical,
  },
  {
    id: "proteins",
    number: "03",
    label: "Target proteins",
    hint: "Choose docking targets",
    countKey: "proteins",
    icon: Atom,
  },
  {
    id: "cell-line",
    number: "04",
    label: "Cell lines",
    hint: "Define experimental models",
    countKey: "cellLines",
    icon: Microscope,
  },
]

const MISSING_TAB: Record<string, SetupCategory> = {
  formulation: "formulation",
  phytochemical: "phytochemicals",
  protein: "proteins",
  "cell line": "cell-line",
}

interface ResearchSetupProps {
  title: string
  tab: string
  readiness: StudyReadiness | null
  checkError: string | null
  checking: boolean
  missing: string[]
  onTab: (tab: string) => void
  onContinue: () => void
  onChanged: () => void
}

export function ResearchSetup({
  title,
  tab,
  readiness,
  checkError,
  checking,
  missing,
  onTab,
  onContinue,
  onChanged,
}: ResearchSetupProps) {
  const reviewing = tab === "review"
  const activeIndex = Math.max(0, SECTIONS.findIndex((section) => section.id === tab))
  const active = reviewing ? null : SECTIONS[activeIndex]
  const previous = reviewing ? SECTIONS[SECTIONS.length - 1] : activeIndex > 0 ? SECTIONS[activeIndex - 1] : null
  const next = reviewing ? null : activeIndex < SECTIONS.length - 1 ? SECTIONS[activeIndex + 1] : null
  const readyCount = SECTIONS.filter((section) => (readiness?.[section.countKey] ?? 0) > 0).length
  const complete = readyCount === 4
  const continueDisabled = checking || !readiness || missing.length > 0 || Boolean(checkError)
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
            ? Math.min(index + 1, last)
            : Math.max(index - 1, 0)
    tabRefs.current[target]?.focus()
    onTab(SECTIONS[target].id)
  }

  return (
    <div className="nano-setup">
      <header className="nano-setup-intro">
        <div className="min-w-0">
          <p className="nano-setup-kicker">01 · Research Setup</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="nano-setup-title">{title}</h1>
            <span className="nano-study-status" data-status={complete ? "active" : "draft"}>
              {complete ? "Completed" : "In Progress"}
            </span>
          </div>
          <p className="nano-setup-lead">
            Define formulations, then select phytochemicals, target proteins, and cell lines for this study.
            Nothing is added until you save it here.
          </p>
          <p className="nano-setup-note">Computational outputs do not constitute experimental proof.</p>
        </div>
        <div className="nano-setup-progress" aria-live="polite">
          <p className="nano-setup-progress-label">Research Setup</p>
          <p className="nano-setup-progress-value">
            {readiness ? (
              <>
                <span>{readyCount}</span>
                <span>of 4</span>
              </>
            ) : (
              "Checking"
            )}
          </p>
          <div className="nano-setup-meter" aria-hidden>
            {SECTIONS.map((section) => (
              <span key={section.id} data-on={readiness && readiness[section.countKey] > 0 ? "true" : "false"} />
            ))}
          </div>
          <p className="nano-setup-progress-hint">
            {readiness
              ? complete
                ? "Completed — ready for in-silico screening"
                : `${4 - readyCount} still needed`
              : "Loading study records"}
          </p>
        </div>
      </header>

      <div className="nano-setup-steps" role="tablist" aria-label="Research setup sections">
        {SECTIONS.map((section, index) => {
          const count = readiness ? readiness[section.countKey] : null
          const done = count !== null && count > 0
          const selected = section.id === tab
          const Icon = section.icon
          const state = count === null ? "pending" : done ? "done" : "needed"
          return (
            <button
              key={section.id}
              ref={(node) => {
                tabRefs.current[index] = node
              }}
              id={`setup-step-${section.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="setup-stage"
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
              <span className="nano-setup-step-meta">
                {count === null ? "Checking" : done ? `${count} recorded` : "Needed"}
              </span>
            </button>
          )
        })}
      </div>

      {complete && !reviewing ? (
        <SetupReview readiness={readiness} onManage={onTab} />
      ) : null}

      <SetupActions
        checkError={checkError}
        readiness={readiness}
        missing={missing}
        previous={previous}
        next={next}
        reviewing={reviewing}
        checking={checking}
        continueDisabled={continueDisabled}
        onTab={onTab}
        onContinue={onContinue}
        showStatus
      />

      <section
        id="setup-stage"
        role="tabpanel"
        aria-labelledby={active ? `setup-step-${active.id}` : undefined}
        className="nano-setup-stage nano-step-in"
        key={tab}
      >
        {reviewing || !active ? (
          <SetupReview readiness={readiness} onManage={onTab} />
        ) : (
          <SetupRecords category={active.id} onChanged={onChanged} />
        )}
      </section>

      <SetupActions
        checkError={checkError}
        readiness={readiness}
        missing={missing}
        previous={previous}
        next={next}
        reviewing={reviewing}
        checking={checking}
        continueDisabled={continueDisabled}
        onTab={onTab}
        onContinue={onContinue}
      />
    </div>
  )
}

function SetupReview({
  readiness,
  onManage,
}: {
  readiness: StudyReadiness | null
  onManage: (tab: string) => void
}) {
  const readyCount = SECTIONS.filter((section) => (readiness?.[section.countKey] ?? 0) > 0).length
  return (
    <section className="nano-setup-review" aria-label="Research setup review">
      <h2>Research Setup — {readiness ? `${readyCount} of 4` : "Checking"} {readyCount === 4 ? "completed" : "in progress"}</h2>
      <ul>
        {SECTIONS.map((section) => {
          const count = readiness ? readiness[section.countKey] : null
          return (
            <li key={section.id}>
              <span>
                {section.label}
                <strong>{count === null ? "—" : `${count} records`}</strong>
              </span>
              <button type="button" onClick={() => onManage(section.id)}>
                {count ? "Edit" : "Add"}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function SetupActions({
  checkError,
  readiness,
  missing,
  previous,
  next,
  reviewing,
  checking,
  continueDisabled,
  onTab,
  onContinue,
  showStatus = false,
}: {
  checkError: string | null
  readiness: StudyReadiness | null
  missing: string[]
  previous: SetupSection | null
  next: SetupSection | null
  reviewing: boolean
  checking: boolean
  continueDisabled: boolean
  onTab: (tab: string) => void
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
                  const target = gapTab(line)
                  return (
                    <li key={line}>
                      {target ? (
                        <button type="button" onClick={() => onTab(target)}>
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
            <p role="status">All four setup categories are complete.</p>
          ) : null}
        </div>
      ) : (
        <p className="nano-setup-bar-status">
          {next ? `Next: ${next.label}` : "In-Silico Screening is the next workflow step."}
        </p>
      )}
      <div className="nano-setup-bar-actions">
        {previous ? (
          <button type="button" className="nano-setup-back" onClick={() => onTab(previous.id)}>
            <ArrowLeft size={15} aria-hidden />
            {previous.label}
          </button>
        ) : null}
        {next ? (
          <button type="button" className="nano-setup-next" onClick={() => onTab(next.id)}>
            Next step
            <ArrowRight size={15} aria-hidden />
          </button>
        ) : !reviewing ? (
          <button type="button" className="nano-setup-next" onClick={() => onTab("review")}>
            Review setup
            <ArrowRight size={15} aria-hidden />
          </button>
        ) : null}
        <button type="button" className="nano-setup-continue" disabled={continueDisabled} onClick={onContinue}>
          {checking ? "Checking…" : "Continue to In-Silico"}
          <ArrowRight size={15} aria-hidden />
        </button>
      </div>
    </div>
  )
}

function gapTab(message: string): string | null {
  const text = message.toLowerCase()
  for (const [needle, tab] of Object.entries(MISSING_TAB)) {
    if (text.includes(needle)) return tab
  }
  return null
}
