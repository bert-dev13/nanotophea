"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useStudy } from "@/components/providers/StudyProvider"
import { useWorkflowStatus } from "@/components/study/WorkflowStatus"
import { InSilicoScreening } from "@/components/study/InSilicoScreening"
import { AnalysisInterpretation } from "@/components/study/AnalysisInterpretation"
import { LaboratoryValidation } from "@/components/study/LaboratoryValidation"
import { MolecularDocking } from "@/components/study/MolecularDocking"
import { ResearchSetup } from "@/components/study/ResearchSetup"
import { WorkspaceModules } from "@/components/study/WorkspaceModules"
import type { StudyStatus } from "@/lib/domain/models"
import {
  continueAdvisory,
  continueRequirements,
  nextStep,
  parseWorkspaceSlug,
  previousStep,
  stepRequirementsMet,
  studyPath,
  workspacePath,
  writeWorkflowProgress,
  type StepId,
} from "@/lib/workflow/studyFlow"

const STATUS_LABEL: Record<StudyStatus, string> = {
  draft: "Draft",
  active: "Active",
  analysis: "Analysis",
  archived: "Archived",
}

export function StudyWorkspace({ studyId, slug }: { studyId: string; slug: string[] }) {
  const router = useRouter()
  const { studies, activeStudy, loading, error, selectStudy } = useStudy()
  const { readiness, error: checkError, refresh } = useWorkflowStatus()
  const { step, tab } = parseWorkspaceSlug(slug)
  const [checking, setChecking] = useState(false)

  const canonical = workspacePath(studyId, slug)
  const actual = `/study/${studyId}${slug.length ? `/${slug.join("/")}` : ""}`

  useEffect(() => {
    if (actual !== canonical) router.replace(canonical)
  }, [actual, canonical, router])

  useEffect(() => {
    if (!readiness || step.id === "setup") return
    if (stepRequirementsMet("setup", readiness)) return
    router.replace(studyPath(studyId, "setup", "formulation"))
  }, [readiness, step.id, studyId, router])

  const known = studies.some((s) => s.id === studyId)
  const matched = activeStudy?.id === studyId

  useEffect(() => {
    if (loading || !known || matched) return
    void selectStudy(studyId)
  }, [loading, known, matched, selectStudy, studyId])

  const goTab = (nextTab: string) => {
    router.push(studyPath(studyId, step.id, nextTab), { scroll: false })
  }

  const goStep = (stepId: StepId) => {
    router.push(studyPath(studyId, stepId), { scroll: false })
  }

  const missing = readiness ? continueRequirements(step.id, readiness) : []
  const advisory = readiness && missing.length === 0 ? continueAdvisory(step.id, readiness) : null
  const upcoming = nextStep(step.id)
  const prior = previousStep(step.id)
  const continueDisabled = checking || !readiness || missing.length > 0 || Boolean(checkError)

  const onContinue = async () => {
    if (!upcoming) return
    setChecking(true)
    const fresh = await refresh()
    setChecking(false)
    if (!fresh) return
    if (continueRequirements(step.id, fresh).length > 0) return
    writeWorkflowProgress(studyId, upcoming.index)
    router.push(studyPath(studyId, upcoming.id), { scroll: false })
  }

  if (loading) {
    return <p className="py-10 text-sm text-[var(--muted-foreground)]">Opening study…</p>
  }

  if (!known) {
    return (
      <div className="py-10">
        <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          This study is unavailable
        </h1>
        <p className="mt-2 max-w-md text-[13px] text-[var(--muted-foreground)]">
          {error || "This account has no study with that link."}
        </p>
        <button type="button" className="nano-flow-next mt-4" onClick={() => router.push("/")}>
          Return to Studies
        </button>
      </div>
    )
  }

  if (!matched || !activeStudy) {
    return <p className="py-10 text-sm text-[var(--muted-foreground)]">Opening study…</p>
  }

  const openSetup = (setupTab: string) => {
    router.push(studyPath(studyId, "setup", setupTab), { scroll: false })
  }

  if (step.id === "setup") {
    return (
      <ResearchSetup
        title={activeStudy.title}
        tab={tab}
        readiness={readiness}
        checkError={checkError}
        checking={checking}
        missing={missing}
        onTab={goTab}
        onContinue={() => void onContinue()}
        onChanged={() => void refresh()}
      />
    )
  }

  if (step.id === "insilico") {
    return (
      <InSilicoScreening
        title={activeStudy.title}
        status={activeStudy.status}
        tab={tab}
        readiness={readiness}
        checkError={checkError}
        checking={checking}
        missing={missing}
        onTab={goTab}
        onBack={() => goStep("setup")}
        onGap={openSetup}
        onContinue={() => void onContinue()}
      >
        <WorkspaceModules
          step={step.id}
          tab={tab}
          readiness={readiness}
          onOpenTab={goTab}
          onOpenSetup={openSetup}
        />
      </InSilicoScreening>
    )
  }

  if (step.id === "docking") {
    return (
      <MolecularDocking
        title={activeStudy.title}
        status={activeStudy.status}
        readiness={readiness}
        checkError={checkError}
        checking={checking}
        onBack={() => goStep("insilico")}
        onOpenSetup={openSetup}
        onContinue={() => void onContinue()}
      >
        <WorkspaceModules step={step.id} tab={tab} readiness={readiness} onOpenTab={goTab} />
      </MolecularDocking>
    )
  }

  if (step.id === "laboratory") {
    return (
      <LaboratoryValidation
        title={activeStudy.title}
        status={activeStudy.status}
        tab={tab}
        readiness={readiness}
        checkError={checkError}
        checking={checking}
        onTab={goTab}
        onBack={() => goStep("predictions")}
        onContinue={() => void onContinue()}
      >
        <WorkspaceModules step={step.id} tab={tab} readiness={readiness} onOpenTab={goTab} />
      </LaboratoryValidation>
    )
  }

  if (step.id === "analysis") {
    return (
      <AnalysisInterpretation
        title={activeStudy.title}
        status={activeStudy.status}
        tab={tab}
        readiness={readiness}
        checkError={checkError}
        onTab={goTab}
        onBack={() => goStep("laboratory")}
      >
        <WorkspaceModules step={step.id} tab={tab} readiness={readiness} onOpenTab={goTab} />
      </AnalysisInterpretation>
    )
  }

  return (
    <div className="nano-workspace">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted-foreground)]">
          Current study
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            {activeStudy.title}
          </h1>
          <span className="nano-study-status" data-status={activeStudy.status}>
            {STATUS_LABEL[activeStudy.status]}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-[var(--muted-foreground)]">
          Computational outputs do not constitute experimental proof.
        </p>
      </header>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-[1.05rem] font-semibold tracking-[-0.02em]">
          {step.number} {step.label}
        </h2>
        {step.tabs.length > 0 ? (
          <div role="tablist" aria-label={step.label} className="mt-2 flex gap-1 overflow-x-auto border-b">
            {step.tabs.map((item) => {
              const selected = item.id === tab
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className="nano-flow-tab"
                  onClick={() => goTab(item.id)}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="nano-step-in pt-4" key={`${step.id}:${tab}`}>
        <WorkspaceModules step={step.id} tab={tab} readiness={readiness} onOpenTab={goTab} />
      </div>

      <footer className="mt-8 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        {checkError ? (
          <p className="mb-3 text-[13px]" style={{ color: "#b91c1c" }} role="status">
            {checkError}
          </p>
        ) : null}
        {missing.length > 0 ? (
          <div className="nano-flow-missing mb-3" role="status">
            {missing.length === 1 ? (
              <p>{missing[0]}</p>
            ) : (
              <ul className="list-disc space-y-1 pl-4">
                {missing.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {advisory ? (
          <p className="mb-3 text-[13px] leading-relaxed text-[var(--muted-foreground)]" role="status">
            {advisory}
          </p>
        ) : null}
        {!readiness && !checkError ? (
          <p className="mb-3 text-[13px] text-[var(--muted-foreground)]" role="status">
            Checking required records…
          </p>
        ) : null}

        <div
          className={`flex flex-col gap-2 sm:flex-row sm:items-center ${
            prior ? "sm:justify-between" : "sm:justify-end"
          }`}
        >
          {prior ? (
            <button type="button" className="nano-flow-prev" onClick={() => goStep(prior.id)}>
              <ArrowLeft size={15} aria-hidden />
              {prior.label}
            </button>
          ) : null}
          {upcoming ? (
            <button
              type="button"
              className="nano-flow-next"
              disabled={continueDisabled}
              onClick={() => void onContinue()}
            >
              {checking ? "Checking…" : `Continue to ${upcoming.label}`}
              <ArrowRight size={15} aria-hidden />
            </button>
          ) : (
            <p className="text-[13px] text-[var(--muted-foreground)]">This is the last step.</p>
          )}
        </div>
      </footer>
    </div>
  )
}
