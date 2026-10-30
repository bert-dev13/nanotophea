"use client"

import { useRef, type KeyboardEvent } from "react"
import { ArrowLeft, ArrowRight, Atom, Check, FlaskConical, Microscope } from "lucide-react"
import { AskAiLink } from "@/components/ai/ask-ai-link"
import { LibrarySelection, type LibraryCategory } from "@/components/study/setup/LibrarySelection"
import { PhytochemicalBrowser } from "@/components/study/setup/PhytochemicalBrowser"
import { ProteinBrowser } from "@/components/study/setup/ProteinBrowser"
import { CellLineBrowser } from "@/components/study/setup/CellLineBrowser"
import type { StudyReadiness } from "@/lib/workflow/studyFlow"

type CountKey = "compounds" | "proteins" | "cellLines"

interface SetupSection {
  id: LibraryCategory
  number: string
  label: string
  hint: string
  countKey: CountKey
  icon: typeof FlaskConical
}

const SECTIONS: SetupSection[] = [
  {
    id: "phytochemicals",
    number: "01",
    label: "Phytochemicals",
    hint: "Select compounds to investigate",
    countKey: "compounds",
    icon: FlaskConical,
  },
  {
    id: "proteins",
    number: "02",
    label: "Target proteins",
    hint: "Select docking targets",
    countKey: "proteins",
    icon: Atom,
  },
  {
    id: "cell-line",
    number: "03",
    label: "Cell lines",
    hint: "Select experimental models",
    countKey: "cellLines",
    icon: Microscope,
  },
]

const MISSING_TAB: Record<string, LibraryCategory> = {
  phytochemical: "phytochemicals",
  protein: "proteins",
  "cell line": "cell-line",
}

export interface ResearchSetupProps {
  title: string
  tab: string
  readiness: StudyReadiness | null
  checkError: string | null
  checking: boolean
  missing: string[]
  onTabAction?: (tab: string) => void
  onContinueAction?: () => void
  onChangedAction?: () => void
}

export function ResearchSetup({
  title,
  tab,
  readiness,
  checkError,
  checking,
  missing,
  onTabAction,
  onContinueAction,
  onChangedAction,
}: ResearchSetupProps) {
  const handleTab = onTabAction ?? (() => {})
  const handleContinue = onContinueAction ?? (() => {})
  const handleChanged = onChangedAction ?? (() => {})
  const activeIndex = Math.max(0, SECTIONS.findIndex((section) => section.id === tab))
  const active = SECTIONS[activeIndex]
  const previous = activeIndex > 0 ? SECTIONS[activeIndex - 1] : null
  const next = activeIndex < SECTIONS.length - 1 ? SECTIONS[activeIndex + 1] : null
  const readyCount = SECTIONS.filter((section) => (readiness?.[section.countKey] ?? 0) > 0).length
  const complete = readyCount === SECTIONS.length
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
    handleTab(SECTIONS[target].id)
  }

  return (
    <div className="nano-setup">
      <header className="nano-setup-intro nano-setup-intro--compact">
        <div className="nano-setup-intro-copy">
          <span className="nano-setup-mark" aria-hidden>
            <FlaskConical size={18} strokeWidth={1.85} />
          </span>
          <div>
            <p className="nano-setup-kicker">01 · Research Setup</p>
            <div className="nano-setup-intro-line">
              <h1 className="nano-setup-title">{title}</h1>
              <span className="nano-study-status" data-status={complete ? "active" : "draft"}>
                {complete ? "Completed" : "In progress"}
              </span>
            </div>
            <AskAiLink context="setup" />
          </div>
        </div>
        <div className="nano-setup-progress" aria-live="polite">
          <ul className="nano-setup-pips" aria-hidden>
            {SECTIONS.map((section, index) => {
              const Icon = section.icon
              const on = Boolean(readiness && readiness[section.countKey] > 0)
              return (
                <li
                  key={section.id}
                  data-on={on ? "true" : "false"}
                  data-tone={section.id}
                  style={{ animationDelay: `${90 + index * 70}ms` }}
                >
                  <Icon size={14} strokeWidth={1.9} />
                </li>
              )
            })}
          </ul>
          <p className="nano-setup-progress-value">
            {readiness ? (
              <>
                <span key={readyCount}>{readyCount}</span>
                <span>of {SECTIONS.length}</span>
              </>
            ) : (
              "Checking"
            )}
          </p>
        </div>
      </header>

      <div className="nano-setup-steps nano-setup-steps--rail" role="tablist" aria-label="Research setup sections">
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
              data-tone={section.id}
              style={{ animationDelay: `${40 + index * 45}ms` }}
              onClick={() => handleTab(section.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <span className="nano-setup-glyph" aria-hidden>
                {done && !selected ? <Check size={15} strokeWidth={2.5} /> : <Icon size={15} strokeWidth={1.85} />}
              </span>
              <span className="nano-setup-step-copy">
                <span className="nano-setup-num">{section.number}</span>
                <span className="nano-setup-step-label">{section.label}</span>
                <span className="nano-setup-step-hint">{section.hint}</span>
              </span>
              <span className="nano-setup-step-meta">
                {count === null ? "Checking" : done ? `${count} selected` : "0 selected"}
              </span>
            </button>
          )
        })}
      </div>

      {active.id === "phytochemicals" ? (
        <section id="setup-stage" role="tabpanel" aria-labelledby={`setup-step-${active.id}`} className="nano-setup-stage">
          <PhytochemicalBrowser onChangedAction={handleChanged} onContinueAction={() => handleTab("proteins")} />
        </section>
      ) : active.id === "proteins" ? (
        <section id="setup-stage" role="tabpanel" aria-labelledby={`setup-step-${active.id}`} className="nano-setup-stage">
          <ProteinBrowser
            onChangedAction={handleChanged}
            onBackAction={() => handleTab("phytochemicals")}
            onContinueAction={() => handleTab("cell-line")}
          />
        </section>
      ) : active.id === "cell-line" ? (
        <section id="setup-stage" role="tabpanel" aria-labelledby={`setup-step-${active.id}`} className="nano-setup-stage">
          <CellLineBrowser
            onChangedAction={handleChanged}
            onBackAction={() => handleTab("proteins")}
            onContinueAction={handleContinue}
            continueDisabled={continueDisabled}
          />
        </section>
      ) : (
        <>
          <SetupActions
            checkError={checkError}
            readiness={readiness}
            missing={missing}
            previous={previous}
            next={next}
            checking={checking}
            continueDisabled={continueDisabled}
            onTabAction={handleTab}
            onContinueAction={handleContinue}
            showStatus
          />

          <section
            id="setup-stage"
            role="tabpanel"
            aria-labelledby={`setup-step-${active.id}`}
            className="nano-setup-stage nano-step-in"
            key={tab}
          >
            <LibrarySelection category={active.id} onChangedAction={handleChanged} />
          </section>

          <SetupActions
            checkError={checkError}
            readiness={readiness}
            missing={missing}
            previous={previous}
            next={next}
            checking={checking}
            continueDisabled={continueDisabled}
            onTabAction={handleTab}
            onContinueAction={handleContinue}
            isBottom
          />
        </>
      )}
    </div>
  )
}

function SetupActions({
  checkError,
  readiness,
  missing,
  previous,
  next,
  checking,
  continueDisabled,
  onTabAction,
  onContinueAction,
  showStatus = false,
  isBottom = false,
}: {
  checkError: string | null
  readiness: StudyReadiness | null
  missing: string[]
  previous: SetupSection | null
  next: SetupSection | null
  checking: boolean
  continueDisabled: boolean
  onTabAction?: (tab: string) => void
  onContinueAction?: () => void
  showStatus?: boolean
  isBottom?: boolean
}) {
  return (
    <div className={`nano-setup-bar ${isBottom ? "nano-setup-bar--bottom" : ""}`}>
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
                        <button type="button" onClick={() => onTabAction?.(target)}>
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
            <p role="status">All three selections are complete.</p>
          ) : null}
        </div>
      ) : (
        <p className="nano-setup-bar-status">
          {next ? `Next: ${next.label}` : "In-Silico Screening is the next workflow step."}
        </p>
      )}
      <div className="nano-setup-bar-actions">
        {previous ? (
          <button type="button" className="nano-setup-back" onClick={() => onTabAction?.(previous.id)}>
            <ArrowLeft size={15} aria-hidden />
            {previous.label}
          </button>
        ) : null}
        {next ? (
          <button type="button" className="nano-setup-next" onClick={() => onTabAction?.(next.id)}>
            Next step
            <ArrowRight size={15} aria-hidden />
          </button>
        ) : null}
        <button type="button" className="nano-setup-continue" disabled={continueDisabled} onClick={onContinueAction}>
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
