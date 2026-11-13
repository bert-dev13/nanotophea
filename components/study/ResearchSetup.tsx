"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { ArrowLeft, ArrowRight, Atom, Check, FlaskConical, Microscope, Sparkles } from "lucide-react"
import { AskAiLink } from "@/components/ai/ask-ai-link"
import { useStudy } from "@/components/providers/StudyProvider"
import { PhytochemicalBrowser } from "@/components/study/setup/PhytochemicalBrowser"
import { ProteinBrowser } from "@/components/study/setup/ProteinBrowser"
import { CellLineBrowser } from "@/components/study/setup/CellLineBrowser"
import { NanoparticleFormulationWorkspace } from "@/components/study/setup/NanoparticleFormulationWorkspace"
import {
  configuredNanoparticleSummary,
  nanoparticleChoiceFromStudy,
  nanoparticleChoiceLabel,
  skippedNanoparticleSummary,
} from "@/lib/setup/nanoparticleFormulationChoice"
import type { StudyReadiness } from "@/lib/workflow/studyFlow"

type CountKey = "compounds" | "proteins" | "cellLines" | "formulations"

export type SetupSectionId = "phytochemicals" | "proteins" | "cell-line" | "nanoparticle"

interface SetupSection {
  id: SetupSectionId
  number: string
  label: string
  hint: string
  countKey: CountKey
  icon: typeof FlaskConical | typeof Atom | typeof Microscope | typeof Sparkles
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
  {
    id: "nanoparticle",
    number: "04",
    label: "Nanoparticle Formulation",
    hint: "Optional Chitosan–TPP nanoparticle system",
    countKey: "formulations",
    icon: Sparkles,
  },
]

const MISSING_TAB: Record<string, SetupSectionId> = {
  phytochemical: "phytochemicals",
  protein: "proteins",
  "cell line": "cell-line",
  nanoparticle: "nanoparticle",
  formulation: "nanoparticle",
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
  const { activeStudy, updateActiveStudy } = useStudy()
  const handleTab = onTabAction ?? (() => {})
  const handleContinue = onContinueAction ?? (() => {})
  const handleChanged = onChangedAction ?? (() => {})
  const [navBusy, setNavBusy] = useState(false)
  const [visited, setVisited] = useState<Record<SetupSectionId, boolean>>({
    phytochemicals: true,
    proteins: false,
    "cell-line": false,
    nanoparticle: false,
  })
  const activeIndex = Math.max(0, SECTIONS.findIndex((section) => section.id === tab))
  const active = SECTIONS[activeIndex]

  useEffect(() => {
    setVisited((current) => (current[active.id] ? current : { ...current, [active.id]: true }))
  }, [active.id])
  const previous = activeIndex > 0 ? SECTIONS[activeIndex - 1] : null
  const next = activeIndex < SECTIONS.length - 1 ? SECTIONS[activeIndex + 1] : null
  const requiredSections = SECTIONS.filter((section) => section.id !== "nanoparticle")
  const readyRequired = requiredSections.filter((section) => (readiness?.[section.countKey] ?? 0) > 0).length
  const nanoparticleStatus = nanoparticleChoiceFromStudy({
    formulationSummary: activeStudy?.formulationSummary,
    nanoparticleConfigured: (readiness?.formulations ?? 0) > 0,
  })
  const complete = readyRequired === requiredSections.length
  const continueDisabled = checking || navBusy || !readiness || missing.length > 0 || Boolean(checkError)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  async function continueToInSilico(options?: { markSkipped?: boolean; markConfigured?: boolean }) {
    if (continueDisabled && !options?.markSkipped && !options?.markConfigured) return
    if (checking || navBusy || !readiness || missing.length > 0 || Boolean(checkError)) return
    setNavBusy(true)
    try {
      if (options?.markSkipped) {
        await updateActiveStudy({ formulationSummary: skippedNanoparticleSummary() })
        handleChanged()
      } else if (options?.markConfigured || (readiness.formulations ?? 0) > 0) {
        await updateActiveStudy({
          formulationSummary: configuredNanoparticleSummary("Chitosan–TPP nanoparticle system"),
        })
        handleChanged()
      }
      handleContinue()
    } finally {
      setNavBusy(false)
    }
  }

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
            {SECTIONS.map((section) => {
              const Icon = section.icon
              const on =
                section.id === "nanoparticle"
                  ? nanoparticleStatus !== "unresolved"
                  : Boolean(readiness && readiness[section.countKey] > 0)
              return (
                <li
                  key={section.id}
                  data-on={on ? "true" : "false"}
                  data-tone={section.id}
                >
                  <Icon size={14} strokeWidth={1.9} />
                </li>
              )
            })}
          </ul>
          <p className="nano-setup-progress-value">
            {readiness ? (
              <>
                <span key={readyRequired}>{readyRequired}</span>
                <span>of {requiredSections.length} required</span>
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
          const done =
            section.id === "nanoparticle"
              ? nanoparticleStatus !== "unresolved"
              : count !== null && count > 0
          const selected = section.id === tab
          const Icon = section.icon
          const state =
            section.id === "nanoparticle"
              ? count === null
                ? "pending"
                : done
                  ? "done"
                  : "needed"
              : count === null
                ? "pending"
                : done
                  ? "done"
                  : "needed"
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
              onClick={() => handleTab(section.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <span className="nano-setup-glyph" aria-hidden>
                {done && !selected ? <Check size={15} strokeWidth={2.5} /> : <Icon size={15} strokeWidth={1.85} />}
              </span>
              <span className="nano-setup-step-copy">
                <span className="nano-setup-num">{section.number}</span>
                <span className="nano-setup-step-label">{section.label}</span>
                <span className="nano-setup-step-hint">
                  {section.id === "nanoparticle" ? "Optional Chitosan–TPP nanoparticle system" : section.hint}
                </span>
              </span>
              <span className="nano-setup-step-meta">
                {count === null
                  ? "Checking"
                  : section.id === "nanoparticle"
                    ? nanoparticleChoiceLabel(nanoparticleStatus)
                    : done
                      ? `${count} selected`
                      : "0 selected"}
              </span>
            </button>
          )
        })}
      </div>

      {visited.phytochemicals ? (
        <section
          id="setup-stage-phytochemicals"
          role="tabpanel"
          hidden={active.id !== "phytochemicals"}
          aria-labelledby="setup-step-phytochemicals"
          className="nano-setup-stage"
        >
          <PhytochemicalBrowser onChangedAction={handleChanged} onContinueAction={() => handleTab("proteins")} />
        </section>
      ) : null}
      {visited.proteins ? (
        <section
          id="setup-stage-proteins"
          role="tabpanel"
          hidden={active.id !== "proteins"}
          aria-labelledby="setup-step-proteins"
          className="nano-setup-stage"
        >
          <ProteinBrowser
            onChangedAction={handleChanged}
            onBackAction={() => handleTab("phytochemicals")}
            onContinueAction={() => handleTab("cell-line")}
          />
        </section>
      ) : null}
      {visited["cell-line"] ? (
        <section
          id="setup-stage-cell-line"
          role="tabpanel"
          hidden={active.id !== "cell-line"}
          aria-labelledby="setup-step-cell-line"
          className="nano-setup-stage"
        >
          <CellLineBrowser
            onChangedAction={handleChanged}
            onBackAction={() => handleTab("proteins")}
            onContinueToNanoparticleAction={() => handleTab("nanoparticle")}
            onContinueToInSilicoAction={() => void continueToInSilico({ markSkipped: true })}
            continueDisabled={continueDisabled}
          />
        </section>
      ) : null}
      {visited.nanoparticle ? (
        <section
          id="setup-stage-nanoparticle"
          role="tabpanel"
          hidden={active.id !== "nanoparticle"}
          aria-labelledby="setup-step-nanoparticle"
          className="nano-setup-stage space-y-6"
        >
          <NanoparticleFormulationWorkspace
            studyId={activeStudy?.id || ""}
            onChangedAction={() => {
              void updateActiveStudy({
                formulationSummary: configuredNanoparticleSummary("Chitosan–TPP nanoparticle system"),
              }).then(() => handleChanged())
            }}
          />
          <SetupActions
            checkError={checkError}
            readiness={readiness}
            missing={missing}
            previous={previous}
            next={null}
            checking={checking || navBusy}
            continueDisabled={continueDisabled}
            onTabAction={handleTab}
            onSkipAction={() => void continueToInSilico({ markSkipped: true })}
            onContinueAction={() =>
              void continueToInSilico(
                (readiness?.formulations ?? 0) > 0 || nanoparticleStatus === "configured"
                  ? { markConfigured: true }
                  : { markSkipped: true },
              )
            }
            skipLabel="Skip Nanoparticle Formulation"
            continueLabel="Continue to In-Silico"
            statusNote={
              (readiness?.formulations ?? 0) > 0 || nanoparticleStatus === "configured"
                ? "Nanoparticle formulation is recorded and preserved when you continue. Selected phytochemicals, proteins, and cell lines remain available."
                : "Nanoparticle formulation is optional. Skip or continue — neither blocks In-Silico. Existing records are preserved if you navigate away."
            }
            showStatus
            isBottom
          />
        </section>
      ) : null}
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
  onSkipAction,
  onContinueAction,
  skipLabel,
  continueLabel = "Continue to In-Silico",
  statusNote,
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
  onSkipAction?: () => void
  onContinueAction?: () => void
  skipLabel?: string
  continueLabel?: string
  statusNote?: string
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
            <p role="status">{statusNote ?? "Required setup records are ready. Nanoparticle formulation remains optional."}</p>
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
        {onSkipAction && skipLabel ? (
          <button type="button" className="nano-setup-back" disabled={continueDisabled} onClick={onSkipAction}>
            {checking ? "Checking…" : skipLabel}
          </button>
        ) : null}
        <button type="button" className="nano-setup-continue" disabled={continueDisabled} onClick={onContinueAction}>
          {checking ? "Checking…" : continueLabel}
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
