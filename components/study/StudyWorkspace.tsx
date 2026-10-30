"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { useWorkflowStatus } from "@/components/study/WorkflowStatus"
import dynamic from "next/dynamic"
import { ResearchSetup } from "@/components/study/ResearchSetup"
import { WorkspaceModules } from "@/components/study/WorkspaceModules"

const WorkspaceLoading = () => (
  <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
    <div className="w-7 h-7 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
    <p className="text-xs text-slate-400 font-medium">Loading workspace module…</p>
  </div>
)

const InSilicoWorkspace = dynamic(
  () => import("@/components/study/InSilicoWorkspace").then((m) => m.InSilicoWorkspace),
  { loading: WorkspaceLoading }
)
const DockingPairsWorkspace = dynamic(
  () => import("@/components/study/DockingPairsWorkspace").then((m) => m.DockingPairsWorkspace),
  { loading: WorkspaceLoading }
)
const BiologicalPredictionsWorkspace = dynamic(
  () => import("@/components/study/BiologicalPredictionsWorkspace").then((m) => m.BiologicalPredictionsWorkspace || m.default),
  { loading: WorkspaceLoading }
)
const LaboratoryWorkspace = dynamic(
  () => import("@/components/study/LaboratoryWorkspace").then((m) => m.LaboratoryWorkspace),
  { loading: WorkspaceLoading }
)
const AnalysisInterpretation = dynamic(
  () => import("@/components/study/AnalysisInterpretation").then((m) => m.AnalysisInterpretation),
  { loading: WorkspaceLoading }
)
const AssistantStudyPage = dynamic(
  () => import("@/components/ai/assistant-workspace").then((m) => m.AssistantStudyPage),
  { loading: WorkspaceLoading }
)
import type { StudyStatus } from "@/lib/domain/models"
import {
  canEnterStep,
  continueAdvisory,
  continueRequirements,
  nextStep,
  parseWorkspaceSlug,
  previousStep,
  stepLockedMessage,
  studyPath,
  WORKFLOW_STEPS,
  workspacePath,
  writeWorkflowProgress,
  type StepId,
} from "@/lib/workflow/studyFlow"

const STATUS_LABEL: Record<StudyStatus, string> = {
  draft: "Draft",
  active: "Active",
  analysis: "Analysis",
  completed: "Completed",
  archived: "Archived",
}

export function StudyWorkspace({ studyId, slug }: { studyId: string; slug: string[] }) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { studies, activeStudy, loading: studyLoading, error, selectStudy } = useStudy()
  const { readiness, error: checkError, refresh } = useWorkflowStatus()
  const { step, tab } = parseWorkspaceSlug(slug)
  const [checking, setChecking] = useState(false)

  const canonical = workspacePath(studyId, slug)
  const actual = `/study/${studyId}${slug.length ? `/${slug.join("/")}` : ""}`

  const assistant = slug[0] === "assistant"

  useEffect(() => {
    if (assistant) return
    if (actual !== canonical) router.replace(canonical)
  }, [assistant, actual, canonical, router])

  useEffect(() => {
    if (assistant || !readiness) return
    if (canEnterStep(step.id, readiness)) return
    const fallback = [...WORKFLOW_STEPS].reverse().find((item) => canEnterStep(item.id, readiness)) ?? WORKFLOW_STEPS[0]
    if (fallback.id === step.id) return
    router.replace(studyPath(studyId, fallback.id))
  }, [assistant, readiness, step.id, studyId, router])

  const known = studies.some((s) => s.id === studyId)
  const matched = activeStudy?.id === studyId

  useEffect(() => {
    if (authLoading || studyLoading || !known || matched) return
    void selectStudy(studyId)
  }, [authLoading, studyLoading, known, matched, selectStudy, studyId])

  const goTab = (nextTab: string) => {
    router.push(studyPath(studyId, step.id, nextTab), { scroll: false })
  }

  const goStep = (stepId: StepId) => {
    router.push(studyPath(studyId, stepId), { scroll: false })
  }

  const upcoming = nextStep(step.id)
  const prior = previousStep(step.id)
  const ownMissing = readiness ? continueRequirements(step.id, readiness) : []
  const nextLock = ownMissing.length === 0 && upcoming && readiness && !canEnterStep(upcoming.id, readiness)
    ? stepLockedMessage(upcoming.id, readiness)
    : null
  const missing = [...ownMissing, ...(nextLock ? [nextLock] : [])]
  const advisory = readiness && missing.length === 0 ? continueAdvisory(step.id, readiness) : null
  const continueDisabled = checking || !readiness || missing.length > 0 || Boolean(checkError)

  const onContinue = async () => {
    if (!upcoming) return
    setChecking(true)
    const fresh = await refresh()
    setChecking(false)
    if (!fresh) return
    if (continueRequirements(step.id, fresh).length > 0) return
    if (!canEnterStep(upcoming.id, fresh)) return
    writeWorkflowProgress(studyId, upcoming.index)
    router.push(studyPath(studyId, upcoming.id), { scroll: false })
  }

  // AUTH_LOADING
  if (authLoading) {
    return <p className="py-10 text-sm text-[var(--muted-foreground)]">Authenticating…</p>
  }

  // UNAUTHORIZED
  if (!user) {
    return (
      <div className="py-10">
        <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Authentication required
        </h1>
        <p className="mt-2 max-w-md text-[13px] text-[var(--muted-foreground)]">
          Please sign in to access this study.
        </p>
        <button type="button" className="nano-flow-next mt-4" onClick={() => router.push("/")}>
          Return to Sign In
        </button>
      </div>
    )
  }

  // LOADING_STUDY
  if (studyLoading) {
    return <p className="py-10 text-sm text-[var(--muted-foreground)]">Opening study…</p>
  }

  // NOT_FOUND / UNAVAILABLE
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

  // LOADING_STUDY (matching active)
  if (!matched || !activeStudy) {
    return <p className="py-10 text-sm text-[var(--muted-foreground)]">Opening study…</p>
  }

  if (assistant) return <AssistantStudyPage />

  if (step.id === "setup") {
    return (
      <ResearchSetup
        title={activeStudy.title}
        tab={tab}
        readiness={readiness}
        checkError={checkError}
        checking={checking}
        missing={missing}
        onTabAction={goTab}
        onContinueAction={() => void onContinue()}
        onChangedAction={() => void refresh()}
      />
    )
  }

  if (step.id === "insilico") {
    return (
      <InSilicoWorkspace
        checkError={checkError}
        checking={checking}
        missing={missing}
        continueDisabled={continueDisabled}
        onBackAction={() => goStep("setup")}
        onContinueAction={() => void onContinue()}
        onChangedAction={() => void refresh()}
      />
    )
  }

  if (step.id === "docking") {
    return (
      <DockingPairsWorkspace
        checkError={checkError}
        checking={checking}
        missing={missing}
        continueDisabled={continueDisabled}
        onBackAction={() => goStep("insilico")}
        onContinueAction={() => void onContinue()}
        onChangedAction={() => void refresh()}
      />
    )
  }

  if (step.id === "predictions") {
    return (
      <BiologicalPredictionsWorkspace
        tab={tab}
        onTabAction={goTab}
        checkError={checkError}
        checking={checking}
        missing={missing}
        continueDisabled={continueDisabled}
        onBackAction={() => goStep("docking")}
        onContinueAction={() => void onContinue()}
        onChangedAction={() => void refresh()}
      />
    )
  }

  if (step.id === "laboratory") {
    return (
      <LaboratoryWorkspace
        tab={tab}
        onTabAction={goTab}
        checkError={checkError}
        checking={checking}
        missing={missing}
        continueDisabled={continueDisabled}
        onBackAction={() => goStep("predictions")}
        onContinueAction={() => void onContinue()}
        onChangedAction={() => void refresh()}
      />
    )
  }

  if (step.id === "analysis") {
    return (
      <AnalysisInterpretation
        readiness={readiness}
        checkError={checkError}
        onBackAction={() => goStep("laboratory")}
        onCompletedAction={() => void refresh()}
      />
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

      <footer className="nano-flow-footer mt-8 border-t pt-4" style={{ borderColor: "var(--border)" }}>
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
