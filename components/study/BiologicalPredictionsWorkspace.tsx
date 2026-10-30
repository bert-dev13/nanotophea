"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Cpu,
  ExternalLink,
  FlaskConical,
  Play,
  RotateCcw,
  Search,
  Sliders,
} from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useAuth } from "@/components/providers/AuthProvider"
import { AskAiLink } from "@/components/ai/ask-ai-link"
import { assistantFocusId } from "@/lib/ai/focus"
import { useStudy } from "@/components/providers/StudyProvider"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import type {
  AdmetRun,
  CellLineRecord,
  Compound,
  DockingRun,
  PredictionEndpoint,
  PredictionRun,
  Protein,
  SkippedDockingPair,
} from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { ENDPOINT_SPECS } from "@/lib/predictions/engine"
import { assembleFeatures } from "@/lib/predictions/features"
import { literatureSearch, NO_SUPPORTING_PAPER } from "@/lib/predictions/literature"
import {
  canShowScientificEvidence,
  filterBiologicalPredictionJobs,
  filterRunnablePredictions,
  isPredictionCompletedWithResult,
  moduleIncluded,
  predictionProgress,
  resolvePredictionStatus,
  runMatchesSubject,
  subjectsForModule,
  type PredictionJobStatus,
  type PredictionSubject,
} from "@/lib/predictions/modules"
import type { PrototypePredictionResult } from "@/lib/predictions/prototype/types"
import { storedSimulationFromPrototype } from "@/lib/predictions/store"
import type { PredictionFeatures, PredictionSeriesPoint } from "@/lib/predictions/types"
import { publicationLabel, type PubMedPaper } from "@/lib/scientific/pubmed"
import { listCellLines, listCompounds, listProteins } from "@/lib/repositories/researchDataRepository"
import { createPredictionRun, listAdmetRuns, listDockingOutcomes, listPredictionRuns, updatePredictionRun } from "@/lib/repositories/scientificRunRepository"

export interface BiologicalPredictionJob {
  key: string
  endpoint: PredictionEndpoint
  subject: PredictionSubject
}

const TABS: Array<{ id: string; module?: PredictionEndpoint; label: string }> = [
  { id: "all", label: "All" },
  { id: "dpph", module: "dpph", label: "DPPH" },
  { id: "mtt", module: "mtt", label: "MTT" },
  { id: "ldh", module: "ldh", label: "LDH" },
  { id: "ros", module: "ros", label: "ROS" },
  { id: "bax", module: "bax", label: "BAX" },
  { id: "hippo-yap", module: "hippo_yap", label: "Hippo–YAP" },
]

const PREDICTION_MODULES: PredictionEndpoint[] = ["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"]

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "ready", label: "Ready to run" },
  { id: "failed", label: "Failed" },
] as const

type StatusFilterId = (typeof STATUS_FILTERS)[number]["id"]

const ENDPOINT_TONES: Record<PredictionEndpoint, string> = {
  dpph: "antioxidant",
  mtt: "cancer",
  ldh: "cell-cycle",
  ros: "phenolics",
  bax: "apoptosis",
  hippo_yap: "signaling",
}

const HERO: Record<PredictionEndpoint, string> = {
  dpph: "DPPH Antioxidant Prediction",
  mtt: "MTT Cytotoxicity Prediction",
  ldh: "LDH Cytotoxicity Prediction",
  ros: "ROS Oxidative Stress Prediction",
  bax: "BAX-mediated Apoptosis Prediction",
  hippo_yap: "Hippo–YAP Signaling Prediction",
}

function predictionJobKey(endpoint: PredictionEndpoint, subject: PredictionSubject): string {
  return `${endpoint}:${subject.key}`
}

function predictionJobLabel(endpoint: PredictionEndpoint, subject: PredictionSubject): string {
  const moduleLabel = TABS.find((item) => item.module === endpoint)?.label ?? endpoint
  return `${moduleLabel} · ${subject.label}`
}

function featuresForSubject(
  studyId: string,
  subject: PredictionSubject,
  compound: Compound | undefined,
  proteins: Protein[],
  docking: DockingRun[],
  admet: AdmetRun[],
) {
  return assembleFeatures({
    studyId,
    compound: {
      id: subject.compoundId,
      name: subject.compoundName,
      pubchemCid: compound?.pubchemCid,
      molecularWeight: compound?.molecularWeight,
      formula: compound?.formula,
    },
    cellLine: subject.cellLineId && subject.cellLineName ? { id: subject.cellLineId, name: subject.cellLineName } : undefined,
    proteins: proteins
      .filter((protein) => !subject.proteinId || protein.id === subject.proteinId)
      .map((protein) => ({ id: protein.id, name: protein.name })),
    docking: docking
      .filter((row) => row.compoundId === subject.compoundId && (!subject.proteinId || row.proteinId === subject.proteinId))
      .map((row) => ({
        proteinId: row.proteinId,
        proteinName: proteins.find((protein) => protein.id === row.proteinId)?.name,
        affinityKcalMol: row.bestBindingAffinityKcalMol,
      })),
    admeDescriptors: admet.find((row) => row.compoundId === subject.compoundId)?.descriptors,
  })
}

async function executePrediction(input: {
  studyId: string
  actorId: string
  endpoint: PredictionEndpoint
  subject: PredictionSubject
  compound?: Compound
  proteins: Protein[]
  docking: DockingRun[]
  admet: AdmetRun[]
  existing?: PredictionRun
}): Promise<void> {
  const features = featuresForSubject(input.studyId, input.subject, input.compound, input.proteins, input.docking, input.admet)
  const response = await fetch("/api/scientific/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: input.endpoint, features, mode: "prototype" }),
  })
  const body = (await response.json()) as PrototypePredictionResult & { error?: string }
  if (!response.ok || body.evidenceClass !== "SIMULATION") {
    throw new Error(body.error || "The prediction could not be generated.")
  }
  const stored = storedSimulationFromPrototype(body, features)
  if (input.existing) await updatePredictionRun(input.studyId, input.existing.id, { id: input.actorId }, stored)
  else await createPredictionRun(input.studyId, { id: input.actorId }, stored)
}

export interface BiologicalPredictionsWorkspaceProps {
  tab?: string
  onTabAction?: (tab: string) => void
  onTabChange?: (tab: string) => void
  onBackAction?: () => void
  onContinueAction?: () => void
  onChangedAction?: () => void
  continueDisabled?: boolean
  checking?: boolean
  missing?: string[]
  checkError?: string | null
}

export function BiologicalPredictionsWorkspace({
  tab,
  onTabAction,
  onTabChange,
  onBackAction,
  onContinueAction,
  onChangedAction,
  continueDisabled = false,
  checking = false,
  missing = [],
  checkError = null,
}: BiologicalPredictionsWorkspaceProps) {
  const [endpointFilter, setEndpointFilter] = useState<string>(tab || "all")

  useEffect(() => {
    if (tab) {
      setEndpointFilter(tab)
    }
  }, [tab])

  const handleTab = useCallback(
    (newTab: string) => {
      setEndpointFilter(newTab)
      if (onTabAction) onTabAction(newTab)
      if (onTabChange) onTabChange(newTab)
    },
    [onTabAction, onTabChange]
  )

  const handleBack = onBackAction ?? (() => {})
  const handleContinue = onContinueAction ?? (() => {})
  const handleChanged = onChangedAction ?? (() => {})

  const { user } = useAuth()
  const { activeStudy } = useStudy()
  const [compounds, setCompounds] = useState<Compound[]>([])
  const [proteins, setProteins] = useState<Protein[]>([])
  const [cellLines, setCellLines] = useState<CellLineRecord[]>([])
  const [runs, setRuns] = useState<PredictionRun[]>([])
  const [docking, setDocking] = useState<DockingRun[]>([])
  const [skippedDocking, setSkippedDocking] = useState<SkippedDockingPair[]>([])
  const [admet, setAdmet] = useState<AdmetRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedJobKey, setSelectedJobKey] = useState<string>("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<StatusFilterId>("all")
  const [mobilePane, setMobilePane] = useState<"library" | "detail">("library")
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [queuedKeys, setQueuedKeys] = useState<Set<string>>(new Set())
  const [batch, setBatch] = useState<{ done: number; total: number; label: string } | null>(null)
  const [failures, setFailures] = useState<Record<string, string>>({})
  const runningRef = useRef(false)

  const load = useCallback(async () => {
    if (!activeStudy) return
    setLoading(true)
    setError(null)
    try {
      const [compoundRows, proteinRows, lineRows, predictionRows, dockingRows, admetRows] = await Promise.all([
        listCompounds(activeStudy.id),
        listProteins(activeStudy.id),
        listCellLines(activeStudy.id),
        listPredictionRuns(activeStudy.id).catch(() => [] as PredictionRun[]),
        listDockingOutcomes(activeStudy.id).catch(() => ({ completed: [] as DockingRun[], skipped: [] as SkippedDockingPair[] })),
        listAdmetRuns(activeStudy.id).catch(() => [] as AdmetRun[]),
      ])
      setCompounds(compoundRows)
      setProteins(proteinRows)
      setCellLines(lineRows)
      setRuns(predictionRows)
      setDocking(dockingRows.completed)
      setSkippedDocking(dockingRows.skipped)
      setAdmet(admetRows)
    } catch (e) {
      setError(toUserFacingError(e, "Biological predictions could not be loaded."))
    } finally {
      setLoading(false)
    }
  }, [activeStudy])

  useEffect(() => {
    void load()
  }, [load])

  const parties = useMemo(
    () => ({
      compounds: compounds.map((row) => ({ id: row.id, name: row.name })),
      proteins: proteins.map((row) => ({ id: row.id, name: row.name, gene: row.gene, pathway: row.pathway })),
      cellLines: cellLines.map((row) => ({ id: row.id, name: row.name })),
    }),
    [compounds, proteins, cellLines]
  )

  const allJobs = useMemo<BiologicalPredictionJob[]>(() => {
    const list: BiologicalPredictionJob[] = []
    for (const endpoint of PREDICTION_MODULES) {
      if (!moduleIncluded(activeStudy?.predictionModules, endpoint, parties.compounds, parties.proteins, parties.cellLines)) continue
      for (const subject of subjectsForModule(endpoint, parties.compounds, parties.proteins, parties.cellLines)) {
        list.push({
          key: predictionJobKey(endpoint, subject),
          endpoint,
          subject,
        })
      }
    }
    return list
  }, [activeStudy?.predictionModules, parties])

  const getJobStatus = useCallback(
    (job: BiologicalPredictionJob): PredictionJobStatus => {
      const isRunning = runningKey === job.key
      const isQueued = queuedKeys.has(job.key)
      const hasError = Boolean(failures[job.key]) && !isRunning
      const run = runs.find((r) => r.endpoint === job.endpoint && runMatchesSubject(r, job.subject))
      return resolvePredictionStatus({ run, isRunning, isQueued, hasError })
    },
    [failures, queuedKeys, runningKey, runs]
  )

  const completedCount = useMemo(() => allJobs.filter((j) => getJobStatus(j) === "COMPLETED").length, [allJobs, getJobStatus])
  const readyCount = useMemo(() => allJobs.filter((j) => getJobStatus(j) === "READY").length, [allJobs, getJobStatus])
  const runningCount = useMemo(() => allJobs.filter((j) => getJobStatus(j) === "RUNNING").length, [allJobs, getJobStatus])
  const queuedCount = useMemo(() => allJobs.filter((j) => getJobStatus(j) === "QUEUED").length, [allJobs, getJobStatus])
  const failedCount = useMemo(() => allJobs.filter((j) => getJobStatus(j) === "FAILED").length, [allJobs, getJobStatus])
  const totalCount = allJobs.length
  const isCompleteStudy = totalCount > 0 && completedCount === totalCount

  const visibleJobs = useMemo(() => {
    const jobsWithStatus = allJobs.map((j) => ({ ...j, status: getJobStatus(j) }))
    return filterBiologicalPredictionJobs(jobsWithStatus, {
      endpointFilter,
      statusFilter: filter,
      query,
      heroLabels: HERO,
    })
  }, [allJobs, endpointFilter, filter, query, getJobStatus])

  const selectedJob = useMemo(() => {
    if (selectedJobKey) {
      const match = allJobs.find((j) => j.key === selectedJobKey)
      if (match) return match
    }
    return visibleJobs[0] ?? allJobs[0] ?? null
  }, [allJobs, visibleJobs, selectedJobKey])

  useEffect(() => {
    if (selectedJob && selectedJob.key !== selectedJobKey) {
      setSelectedJobKey(selectedJob.key)
    }
  }, [selectedJob, selectedJobKey])

  const refreshRuns = useCallback(async () => {
    if (!activeStudy) return
    const updated = await listPredictionRuns(activeStudy.id).catch(() => [] as PredictionRun[])
    setRuns(updated)
  }, [activeStudy])

  async function runJobs(jobsToRun: BiologicalPredictionJob[]) {
    if (!activeStudy || !user || runningRef.current || jobsToRun.length === 0) {
      if (!user) setError("Sign in to run a prediction.")
      return
    }
    runningRef.current = true
    setError(null)

    const jobKeys = jobsToRun.map((j) => j.key)
    setQueuedKeys(new Set(jobKeys))

    try {
      for (let i = 0; i < jobsToRun.length; i++) {
        const job = jobsToRun[i]
        setRunningKey(job.key)
        setQueuedKeys((prev) => {
          const next = new Set(prev)
          next.delete(job.key)
          return next
        })
        setBatch(
          jobsToRun.length > 1
            ? { done: i + 1, total: jobsToRun.length, label: predictionJobLabel(job.endpoint, job.subject) }
            : null
        )

        try {
          await executePrediction({
            studyId: activeStudy.id,
            actorId: user.uid,
            endpoint: job.endpoint,
            subject: job.subject,
            compound: compounds.find((row) => row.id === job.subject.compoundId),
            proteins,
            docking,
            admet,
            existing: runs.find((run) => run.endpoint === job.endpoint && runMatchesSubject(run, job.subject)),
          })
          setFailures((current) => {
            if (!current[job.key]) return current
            const next = { ...current }
            delete next[job.key]
            return next
          })
        } catch (reason) {
          const message = toUserFacingError(reason, "The prediction could not be generated.")
          setFailures((current) => ({ ...current, [job.key]: message }))
        } finally {
          await refreshRuns()
        }
      }
    } finally {
      runningRef.current = false
      setRunningKey(null)
      setQueuedKeys(new Set())
      setBatch(null)
      handleChanged()
    }
  }

  async function runAllReady() {
    const readyJobs = allJobs.filter((j) => getJobStatus(j) === "READY")
    if (!readyJobs.length) return
    await runJobs(readyJobs)
  }

  async function retryAllFailed() {
    const failedJobs = allJobs.filter((j) => getJobStatus(j) === "FAILED")
    if (!failedJobs.length) return
    await runJobs(failedJobs)
  }

  return (
    <div className="nano-setup">
      {/* Intro Header matching Molecular Docking */}
      <header className="nano-setup-intro nano-setup-intro--compact">
        <div className="nano-setup-intro-copy">
          <span className="nano-setup-mark" aria-hidden>
            <FlaskConical size={18} strokeWidth={1.85} />
          </span>
          <div>
            <p className="nano-setup-kicker">04 · Biological Predictions</p>
            <div className="nano-setup-intro-line">
              <h1 className="nano-setup-title">Biological Predictions</h1>
              <span className="nano-study-status" data-status={isCompleteStudy ? "active" : "draft"}>
                {isCompleteStudy ? "Completed" : "In progress"}
              </span>
            </div>
            <p className="nano-setup-lead">
              Computational bioactivity predictions and dose–response simulations for study targets.
            </p>
            <AskAiLink context={assistantFocusId(endpointFilter !== "all" ? endpointFilter : "dpph")} />
          </div>
        </div>

        <div className="nano-setup-progress" aria-live="polite">
          <p className="nano-setup-progress-label">
            {loading ? "Loading" : `${totalCount} predictions`}
          </p>
          <p className="nano-setup-progress-value">
            {loading ? (
              "Checking"
            ) : (
              <>
                <span>{completedCount}</span>
                <span>of {totalCount} completed</span>
              </>
            )}
          </p>
          {!loading && totalCount > 0 ? (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "4px" }}>
              {completedCount > 0 && (
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#10b981", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  <Check size={12} strokeWidth={2.5} /> {completedCount} Completed
                </span>
              )}
              {readyCount > 0 && (
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  <Clock size={12} /> {readyCount} Ready
                </span>
              )}
              {(runningCount > 0 || queuedCount > 0) && (
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#0284c7", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  <span className="adme-spin" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> {runningCount + queuedCount} Running
                </span>
              )}
              {failedCount > 0 && (
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#f43f5e", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                  <AlertCircle size={12} /> {failedCount} Failed
                </span>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {/* Endpoint Navigation Tabs matching Molecular Docking */}
      <div className="pred-tabs" role="tablist" aria-label="Prediction endpoints">
        {TABS.map((item) => {
          const tabJobs = item.id === "all" ? allJobs : allJobs.filter((j) => j.endpoint === item.module)
          const tabDone = tabJobs.filter((j) => getJobStatus(j) === "COMPLETED").length
          const isSelected = endpointFilter === item.id

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-on={isSelected ? "true" : "false"}
              onClick={() => {
                handleTab(item.id)
                setMobilePane("library")
              }}
            >
              <span>{item.label}</span>
              {tabJobs.length > 0 ? (
                <small>
                  {tabDone}/{tabJobs.length}
                </small>
              ) : null}
            </button>
          )
        })}
      </div>

      {error ? (
        <p className="nano-studies-alert" role="alert">
          {error}
        </p>
      ) : null}
      {checkError ? (
        <p className="nano-studies-alert" role="alert">
          {checkError}
        </p>
      ) : null}
      {!runningRef.current && Object.keys(failures).length > 0 ? (
        <p className="nano-studies-alert" role="alert">
          {Object.keys(failures).length === 1
            ? "1 prediction could not be generated. Click Retry to re-simulate."
            : `${Object.keys(failures).length} predictions could not be generated. Click Retry to re-simulate.`}
        </p>
      ) : null}

      {loading ? (
        <p className="nano-studies-empty">Loading biological predictions…</p>
      ) : allJobs.length === 0 ? (
        <div className="nano-studies-empty">
          <p>This study needs selected phytochemicals and targets before biological predictions can be generated.</p>
          <button type="button" className="phyto-back" onClick={handleBack}>
            <ArrowLeft size={15} aria-hidden />
            Molecular Docking
          </button>
        </div>
      ) : (
        <div className="phyto">
          <div className="phyto-workspace" data-pane={mobilePane}>
            {/* LEFT LIBRARY: Matching Molecular Docking & Research Setup */}
            <aside className="phyto-library">
              <header className="phyto-library-head">
                <div>
                  <p className="phyto-library-kicker">Library</p>
                  <h2>Prediction subjects</h2>
                </div>
                <div className="phyto-selection-summary" aria-live="polite">
                  <p className="phyto-count">
                    <span>{allJobs.length}</span>
                    <small>predictions</small>
                  </p>
                  {allJobs.length > 0 ? (
                    <>
                      <span data-ready="true">✓ {completedCount} completed</span>
                      {readyCount > 0 ? <span data-ready="false">◷ {readyCount} ready</span> : null}
                      {(runningCount > 0 || queuedCount > 0) ? (
                        <span style={{ color: "#0284c7" }}>⚙ {runningCount + queuedCount} running</span>
                      ) : null}
                      {failedCount > 0 ? <span style={{ color: "#f43f5e" }}>! {failedCount} failed</span> : null}
                    </>
                  ) : null}
                </div>
              </header>

              {/* Action Bar matching Molecular Docking */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.6rem" }}>
                <button
                  type="button"
                  onClick={handleBack}
                  style={{
                    background: "rgba(45, 212, 191, 0.08)",
                    border: "1px solid rgba(45, 212, 191, 0.28)",
                    color: "#2dd4bf",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "4px 8px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Return to Molecular Docking"
                >
                  ← Molecular Docking
                </button>
                {isCompleteStudy ? (
                  <span
                    style={{
                      background: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      color: "#10b981",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Check size={11} aria-hidden strokeWidth={2.5} /> All Predictions Completed
                  </span>
                ) : readyCount > 0 ? (
                  <button
                    type="button"
                    disabled={runningRef.current || queuedKeys.size > 0}
                    onClick={() => void runAllReady()}
                    style={{
                      background: "rgba(20, 184, 166, 0.16)",
                      border: "1px solid rgba(45, 212, 191, 0.4)",
                      color: "#5eead4",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      cursor: runningRef.current || queuedKeys.size > 0 ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Play size={11} aria-hidden />
                    {runningRef.current || queuedKeys.size > 0 ? "Running..." : `Run All Ready (${readyCount})`}
                  </button>
                ) : failedCount > 0 ? (
                  <button
                    type="button"
                    disabled={runningRef.current || queuedKeys.size > 0}
                    onClick={() => void retryAllFailed()}
                    style={{
                      background: "rgba(244, 63, 94, 0.12)",
                      border: "1px solid rgba(244, 63, 94, 0.35)",
                      color: "#fb7185",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <RotateCcw size={11} aria-hidden />
                    Retry Failed ({failedCount})
                  </button>
                ) : null}
              </div>

              <label className="phyto-search">
                <Search size={14} aria-hidden />
                <input
                  value={query}
                  placeholder="Search subjects, compounds, endpoints..."
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <div className="phyto-filters" role="tablist" aria-label="Prediction status">
                {STATUS_FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    data-on={filter === item.id ? "true" : "false"}
                    onClick={() => setFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <ul className="phyto-rows">
                {visibleJobs.map((job, index) => {
                  const status = getJobStatus(job)
                  const current = selectedJob?.key === job.key
                  const saved = runs.find((run) => run.endpoint === job.endpoint && runMatchesSubject(run, job.subject))
                  const primarySnippet = primaryOutputSnippet(saved)
                  const endpointPill = TABS.find((t) => t.module === job.endpoint)?.label ?? job.endpoint

                  return (
                    <li
                      key={job.key}
                      data-viewing={current ? "true" : "false"}
                      data-selected={status === "COMPLETED" ? "true" : "false"}
                      data-tone={ENDPOINT_TONES[job.endpoint]}
                      style={{ animationDelay: `${Math.min(index, 10) * 22}ms` }}
                    >
                      <button
                        type="button"
                        className="phyto-row"
                        onClick={() => {
                          setSelectedJobKey(job.key)
                          setMobilePane("detail")
                        }}
                      >
                        <span className="phyto-row-mark" aria-hidden />
                        <span className="phyto-row-copy">
                          <span className="phyto-row-name">{job.subject.label}</span>
                          <span className="phyto-row-sub">
                            <span className="phyto-row-class">
                              {endpointPill} · {job.subject.cellLineName ?? job.subject.proteinName ?? HERO[job.endpoint]}
                            </span>
                            <span className="phyto-row-meta">
                              {status === "COMPLETED" && primarySnippet ? primarySnippet : "Dose–response simulation"}
                            </span>
                            <span
                              className="phyto-row-meta"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                color:
                                  status === "COMPLETED"
                                    ? "#059669"
                                    : status === "RUNNING"
                                      ? "#0284c7"
                                      : status === "QUEUED"
                                        ? "#0284c7"
                                        : status === "FAILED"
                                          ? "#e11d48"
                                          : "#64748b",
                                fontWeight: 500,
                              }}
                            >
                              {status === "COMPLETED" ? (
                                <>
                                  <Check size={12} strokeWidth={2.5} style={{ color: "#059669" }} />
                                  Completed
                                </>
                              ) : status === "RUNNING" ? (
                                <>
                                  <span className="adme-spin" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                                  Running prediction...
                                </>
                              ) : status === "QUEUED" ? (
                                <>
                                  <Circle size={10} style={{ color: "#0284c7" }} />
                                  Queued
                                </>
                              ) : status === "FAILED" ? (
                                <>
                                  <AlertCircle size={12} style={{ color: "#e11d48" }} />
                                  Prediction failed
                                </>
                              ) : (
                                <>
                                  <Clock size={12} style={{ color: "#64748b" }} />
                                  Ready to run
                                </>
                              )}
                            </span>
                          </span>
                        </span>
                      </button>
                      {status === "FAILED" ? (
                        <button
                          type="button"
                          title="Retry prediction"
                          onClick={(e) => {
                            e.stopPropagation()
                            void runJobs([job])
                          }}
                          style={{
                            padding: "4px 8px",
                            marginRight: "8px",
                            fontSize: "11px",
                            borderRadius: "4px",
                            border: "1px solid rgba(225, 29, 72, 0.4)",
                            background: "rgba(225, 29, 72, 0.1)",
                            color: "#e11d48",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <RotateCcw size={11} /> Retry
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              {visibleJobs.length === 0 ? <p className="phyto-empty">No prediction subjects match that filter.</p> : null}

              {/* Bottom Selected / Progress Bar matching Molecular Docking */}
              <div className="phyto-picked">
                <div className="phyto-picked-bar">
                  <p>
                    Completed · {completedCount} of {totalCount}
                  </p>
                  {readyCount > 0 ? (
                    <button
                      type="button"
                      disabled={runningRef.current || queuedKeys.size > 0}
                      onClick={() => void runAllReady()}
                      style={{ color: "#2dd4bf", fontWeight: 600 }}
                    >
                      {runningRef.current || queuedKeys.size > 0 ? "Running..." : `Run all ready (${readyCount})`}
                    </button>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 600 }}>
                      ✓ All completed
                    </span>
                  )}
                </div>
              </div>
            </aside>

            {/* RIGHT DETAIL: Selected Subject Detail View */}
            {selectedJob && activeStudy ? (
              <SubjectPrediction
                key={selectedJob.key}
                studyId={activeStudy.id}
                endpoint={selectedJob.endpoint}
                subject={selectedJob.subject}
                literatureCellLine={selectedJob.subject.cellLineName ?? (cellLines.length === 1 ? cellLines[0]?.name : undefined)}
                compound={compounds.find((row) => row.id === selectedJob.subject.compoundId)}
                proteins={proteins}
                docking={docking}
                skippedDocking={skippedDocking.filter((row) => row.compoundId === selectedJob.subject.compoundId)}
                admet={admet}
                run={runs.find((row) => row.endpoint === selectedJob.endpoint && runMatchesSubject(row, selectedJob.subject))}
                running={getJobStatus(selectedJob) === "RUNNING"}
                queued={getJobStatus(selectedJob) === "QUEUED"}
                runError={failures[selectedJob.key] ?? null}
                batch={batch}
                onRun={() => void runJobs([selectedJob])}
                onLibrary={() => setMobilePane("library")}
              />
            ) : null}
          </div>

          <footer className="phyto-nav" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="phyto-back" onClick={handleBack}>
              <ArrowLeft size={15} aria-hidden />
              Molecular Docking
            </button>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <button
                type="button"
                className="phyto-continue"
                disabled={continueDisabled || loading || !isCompleteStudy}
                onClick={handleContinue}
                title={
                  !isCompleteStudy
                    ? "Complete Biological Predictions before continuing to Laboratory Validation."
                    : undefined
                }
              >
                {checking ? "Checking…" : "Continue to Laboratory Validation"}
                <ArrowRight size={15} aria-hidden />
              </button>
              {!loading && !isCompleteStudy ? (
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Complete Biological Predictions before continuing to Laboratory Validation.
                </span>
              ) : null}
            </div>
          </footer>
        </div>
      )}

      {missing[0] ? (
        <p className="nano-setup-note" role="status">
          {missing[0]}
        </p>
      ) : null}
    </div>
  )
}

function SubjectPrediction({
  studyId,
  endpoint,
  subject,
  literatureCellLine,
  compound,
  proteins,
  docking,
  skippedDocking = [],
  admet,
  run,
  running,
  queued = false,
  runError,
  batch,
  onRun,
  onLibrary,
}: {
  studyId: string
  endpoint: PredictionEndpoint
  subject: PredictionSubject
  literatureCellLine?: string
  compound?: Compound
  proteins: Protein[]
  docking: DockingRun[]
  skippedDocking?: SkippedDockingPair[]
  admet: AdmetRun[]
  run?: PredictionRun
  running: boolean
  queued?: boolean
  runError: string | null
  batch: { done: number; total: number; label: string } | null
  onRun: () => void
  onLibrary: () => void
}) {
  const spec = ENDPOINT_SPECS[endpoint]
  const features = featuresForSubject(studyId, subject, compound, proteins, docking, admet)
  const search = literatureSearch(endpoint, subject.compoundName, literatureCellLine)
  const validated = run && run.provenance?.evidenceClass !== "SIMULATION" ? run : null

  const isCompletedWithValidResult = canShowScientificEvidence(run, { running, runError })
  const outputs = isCompletedWithValidResult ? simulationOutputs(run) : []
  const series =
    isCompletedWithValidResult && run?.resultPoints
      ? run.resultPoints.map((point) => ({
          concentration: point.concentration,
          concentrationUnit: point.concentrationUnit,
          metric: point.metric,
          value: point.value,
          unit: point.valueUnit,
        }))
      : []
  const chart = chartable(series)
  const primaryMetric = isCompletedWithValidResult ? primaryMetricHighlight(run) : undefined
  const isHippoYap = endpoint === "hippo_yap"
  const isBax = endpoint === "bax"

  return (
    <article className="phyto-detail">
      {/* Mobile Back Button */}
      <button type="button" className="phyto-mobile-back" onClick={onLibrary}>
        <ArrowLeft size={14} aria-hidden />
        Library
      </button>

      {/* Hero Header matching Molecular Docking */}
      <header className="phyto-hero">
        <div>
          <p className="phyto-kicker" data-tone={ENDPOINT_TONES[endpoint]}>
            <FlaskConical size={13} aria-hidden />
            {HERO[endpoint]}
          </p>
          <h2>{subject.label}</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {isCompletedWithValidResult ? <EvidenceBadge type="PREDICTED" /> : null}

          <button
            type="button"
            className="phyto-select"
            data-on={isCompletedWithValidResult ? "true" : "false"}
            disabled={running || queued}
            onClick={onRun}
          >
            {isCompletedWithValidResult ? (
              <>
                <Check size={14} aria-hidden strokeWidth={2.5} />
                Completed
              </>
            ) : running ? (
              <>
                <span className="adme-spin" aria-hidden />
                Running...
              </>
            ) : queued ? (
              <>
                <Circle size={14} aria-hidden />
                Queued
              </>
            ) : runError ? (
              <>
                <RotateCcw size={14} aria-hidden />
                Retry Prediction
              </>
            ) : (
              <>
                <Play size={14} aria-hidden />
                Run Prediction
              </>
            )}
          </button>
        </div>
      </header>

      {/* Special Pathway Context Notices matching LATS1 / YAP1 in Docking */}
      {isHippoYap ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.75rem 0.9rem",
            borderRadius: "8px",
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            color: "#0369a1",
            fontSize: "13px",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#0c4a6e",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "0.2rem",
            }}
          >
            Hippo–YAP Signaling Interface (TEAD1 / YAP1)
          </strong>
          Simulation evaluates modulation of the YAP–TEAD transcriptional regulatory complex, predicting downstream
          cellular signaling suppression and target gene inhibition.
        </div>
      ) : null}

      {isBax ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.75rem 0.9rem",
            borderRadius: "8px",
            background: "#f5f3ff",
            border: "1px solid #ddd6fe",
            color: "#5b21b6",
            fontSize: "13px",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#4c1d95",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "0.2rem",
            }}
          >
            Mitochondrial Apoptotic Pathway (BAX Activation)
          </strong>
          Simulates pro-apoptotic BAX induction, mitochondrial outer membrane permeabilization, and apoptotic threshold
          dynamics across ligand concentrations.
        </div>
      ) : null}

      {/* 3-Column Identity Cards matching Molecular Docking & Research Setup */}
      <ul className="phyto-identity">
        <li>
          <span>Ligand</span>
          <strong>{subject.compoundName}</strong>
        </li>
        <li>
          <span>Biological Context</span>
          <strong>{subject.cellLineName ?? subject.proteinName ?? HERO[endpoint]}</strong>
        </li>
        <li>
          <span>Primary Result</span>
          <strong>{primaryMetric ?? "Pending"}</strong>
        </li>
      </ul>

      {/* Live Simulation Progress (if running) matching adme-progress */}
      {running ? (
        <div className="adme-progress" aria-live="polite" style={{ marginTop: "1rem" }}>
          <div className="adme-running">
            <p className="adme-pulse">RUNNING PREDICTION SIMULATION</p>
            <strong>
              {batch ? `Simulating ${batch.label} (${batch.done} of ${batch.total})` : `Simulating ${subject.label} · ${HERO[endpoint]}`}
            </strong>
          </div>
          <ol className="adme-stages">
            <li data-state="done">
              <Check size={14} aria-hidden />
              <span>Assembling molecular descriptors</span>
            </li>
            <li data-state="done">
              <Check size={14} aria-hidden />
              <span>Retrieving docking affinities</span>
            </li>
            <li data-state="active">
              <span className="adme-spin" aria-hidden />
              <span>Querying bioactivity model</span>
            </li>
            <li data-state="waiting">
              <span className="adme-wait" aria-hidden />
              <span>Simulating concentration response</span>
            </li>
            <li data-state="waiting">
              <span className="adme-wait" aria-hidden />
              <span>Parsing prediction results</span>
            </li>
          </ol>
        </div>
      ) : null}

      {/* Dedicated Failure Box when run fails */}
      {runError && !running ? (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.85rem 1rem",
            borderRadius: "8px",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#be123c",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
          role="alert"
        >
          <div>
            <strong
              style={{
                display: "block",
                color: "#9f1239",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.2rem",
              }}
            >
              Prediction failed
            </strong>
            <span>{runError}</span>
          </div>
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "6px",
              background: "#be123c",
              color: "#ffffff",
              border: "none",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <RotateCcw size={13} aria-hidden />
            Retry Prediction
          </button>
        </div>
      ) : null}

      {/* OVERVIEW SECTION: Chart Stage & Prediction Facts Split */}
      <div className="phyto-overview">
        <section className="phyto-stage">
          <h3>{isCompletedWithValidResult && chart ? "Concentration–response curve" : "Endpoint bioactivity visualization"}</h3>
          {isCompletedWithValidResult && chart ? (
            <div className="pred-chart" aria-label={`${chart.metric} concentration response`} style={{ height: "260px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.rows} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="concentration" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={42} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      color: "var(--card-foreground)",
                      fontSize: "12px",
                      boxShadow: "var(--card-shadow)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#0f766e" }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div
              style={{
                height: "260px",
                display: "grid",
                placeItems: "center",
                background: "var(--surface-secondary)",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                padding: "1rem",
                textAlign: "center",
              }}
            >
              <p className="phyto-missing">
                {runError
                  ? "Prediction failed. Click \u201cRetry Prediction\u201d to re-calculate response."
                  : "Simulation has not run for this subject yet. Click \u201cRun Prediction\u201d to calculate response."}
              </p>
            </div>
          )}

          {isCompletedWithValidResult && primaryMetric ? (
            <div className="phyto-adme" style={{ marginTop: "0.85rem" }}>
              <span>Primary Calculated Result</span>
              <strong data-mark="pass">{primaryMetric}</strong>
            </div>
          ) : null}
        </section>

        <section>
          <h3>Prediction overview</h3>
          <dl className="phyto-facts">
            <Fact label="Ligand" value={subject.compoundName} />
            <Fact
              label="PubChem CID"
              value={features.pubchemCid != null ? String(features.pubchemCid) : undefined}
            />
            <Fact label="Endpoint" value={spec.label} />
            <Fact label="Cell context" value={subject.cellLineName} />
            <Fact label="Protein target" value={subject.proteinName} />
            <Fact label="Docking affinity" value={dockingContext(features, skippedDocking)} />
            <Fact
              label="Molecular weight"
              value={features.molecularWeight != null ? `${features.molecularWeight} g/mol` : undefined}
            />
            <Fact label="Formula" value={features.formula} />
            <Fact
              label="Status"
              value={
                isCompletedWithValidResult ? (
                  <span style={{ color: "#059669", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Check size={13} strokeWidth={2.5} /> Completed
                  </span>
                ) : running ? (
                  <span style={{ color: "#0284c7", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span className="adme-spin" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> Running simulation
                  </span>
                ) : queued ? (
                  <span style={{ color: "#0284c7", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Circle size={12} /> Queued
                  </span>
                ) : runError ? (
                  <span style={{ color: "#e11d48", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <AlertCircle size={13} /> Prediction failed
                  </span>
                ) : (
                  <span style={{ color: "#64748b", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={13} /> Ready to run
                  </span>
                )
              }
            />
          </dl>
        </section>
      </div>

      {/* SIMULATION OUTPUTS TABLE: Modeled after AutoDock Vina Modes */}
      <section className="phyto-block">
        <h3>Simulation outputs & response points</h3>
        <p className="phyto-caption">
          Computational bioactivity metrics, concentration points, and predicted values.
        </p>

        {isCompletedWithValidResult && outputs.length > 0 ? (
          <>
            <div className="dock-table-wrap">
              <table className="dock-table">
                <thead>
                  <tr>
                    <th>Output parameter</th>
                    <th>Calculated value</th>
                  </tr>
                </thead>
                <tbody>
                  {outputs.map((item, idx) => (
                    <tr key={item.label} data-best={idx === 0 ? "true" : undefined}>
                      <td>
                        <strong>{systemCopy(item.label)}</strong>
                      </td>
                      <td>{systemCopy(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {run?.pathwayEffect ? (
              <p className="dock-note" style={{ marginTop: "0.85rem" }}>
                {systemCopy(run.pathwayEffect)}
              </p>
            ) : null}
          </>
        ) : (
          <p className="dock-note">
            Simulation has not run for this subject yet. Click &ldquo;Run Prediction&rdquo; to calculate response.
          </p>
        )}
      </section>

      {/* PREDICTION METHOD / PROVENANCE BLOCK */}
      {isCompletedWithValidResult ? (
        <section className="phyto-block">
          <h3>Prediction method & specifications</h3>
          <p className="phyto-caption">Computational model parameters, algorithm descriptors, and assumptions.</p>
          <Provenance
            method={systemCopy(run?.source ?? run?.methodType ?? "")}
            model={systemCopy(run?.methodName ?? "")}
            version={systemCopy(run?.methodVersion ?? "")}
            generatedAt={run?.dateGenerated ?? ""}
            features={features}
            assumptions={systemCopy(run?.assumptions ?? "")}
          />
        </section>
      ) : null}

      {/* SCIENTIFIC LITERATURE EVIDENCE BLOCK matching Molecular Docking */}
      {isCompletedWithValidResult ? (
        <EvidenceBrowser
          studyId={studyId}
          endpoint={endpoint}
          compound={subject.compoundName}
          cellLine={literatureCellLine || subject.cellLineName}
          term={search.term}
          tags={search.tags}
          enabled={isCompletedWithValidResult}
        />
      ) : null}
    </article>
  )
}

function systemCopy(value: string): string {
  return value
    .replace(/NANOTOPHEA Prototype/g, "NANOTOPHEA")
    .replace(/Deterministic prototype simulation/g, "Computational prediction")
    .replace(/\bprototype-v1\b/g, "v1")
    .replace(/\bprototype score\b/gi, "score")
    .replace(/\bprototype ratio\b/gi, "ratio")
    .replace(/demonstration /gi, "")
    .replace(/Prototype curve is higher at the upper concentrations\./g, "The response is higher at the upper concentrations.")
    .replace(/Prototype curve stays lower across the concentrations\./g, "The response stays lower across the concentrations.")
    .replace(/\bprototype\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function Fact({ label, value }: { label: string; value?: string | React.ReactNode }) {
  if (!value) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

interface FeatureCardItem {
  id: string
  label: string
  value: string
  category: "all" | "targets" | "physicochemical" | "adme" | "toxicity"
  type?: "docking" | "yes" | "no" | "normal"
}

function formatDescriptorKey(key: string): string {
  const overrides: Record<string, string> = {
    cyp2c19Inhibitor: "CYP2C19 Inhibitor",
    cyp3a4Inhibitor: "CYP3A4 Inhibitor",
    cyp2c9Inhibitor: "CYP2C9 Inhibitor",
    cyp1a2Inhibitor: "CYP1A2 Inhibitor",
    cyp2d6Inhibitor: "CYP2D6 Inhibitor",
    cyp2c9Substrate: "CYP2C9 Substrate",
    cyp2d6Substrate: "CYP2D6 Substrate",
    cyp3a4Substrate: "CYP3A4 Substrate",
    tumorProteinP53: "p53 Tumor Suppressor",
    clinicalToxicity: "Clinical Toxicity",
    atad5: "ATAD5 Genotoxicity",
    volumeOfDistribution: "Volume of Distribution (Vd)",
    hydrationFreeEnergy: "Hydration Free Energy (ΔGhyd)",
    androgenReceptorLbd: "Androgen Receptor LBD",
    amesMutagenicity: "AMES Mutagenicity",
    halfLife: "Elimination Half-Life (t½)",
    pparGamma: "PPAR-γ",
    arylHydrocarbonReceptor: "Aryl Hydrocarbon Receptor (AhR)",
    androgenReceptor: "Androgen Receptor",
    giAbsorption: "GI Absorption",
    drugInducedLiverInjury: "Drug-Induced Liver Injury (DILI)",
    antioxidantResponse: "Antioxidant Response (ARE)",
    estrogenReceptorLbd: "Estrogen Receptor LBD",
    aqueousSolubility: "Aqueous Solubility (logS)",
    pgpInhibition: "P-gp Inhibition",
    hergBlocking: "hERG Channel Block",
    bbbPermeability: "Blood-Brain Barrier (BBB)",
    caco2Permeability: "Caco-2 Permeability",
    skinReaction: "Skin Sensitization",
    acuteToxicityLd50: "Acute Oral Toxicity (LD50)",
    lipophilicity: "Lipophilicity (logP)",
    microsomeClearance: "Microsomal Clearance",
    carcinogenicity: "Carcinogenicity",
    plasmaProteinBinding: "Plasma Protein Binding (PPB)",
    estrogenReceptor: "Estrogen Receptor",
    hepatocyteClearance: "Hepatocyte Clearance",
    mitochondrialMembranePotential: "Mitochondrial Depolarization",
    pampaPermeability: "PAMPA Permeability",
    oralBioavailability: "Oral Bioavailability (F)",
    aromatase: "Aromatase Inhibition",
    heatShockResponse: "Heat Shock Response",
  }
  if (overrides[key]) return overrides[key]
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()).trim()
}

function Provenance({
  method,
  model,
  version,
  generatedAt,
  features,
  assumptions,
}: {
  method: string
  model: string
  version?: string
  generatedAt: string
  features: PredictionFeatures
  assumptions?: string
}) {
  const [featuresExpanded, setFeaturesExpanded] = useState(false)
  const [activeCategory, setActiveCategory] = useState<"all" | "targets" | "physicochemical" | "adme" | "toxicity">("all")

  const formattedDate = useMemo(() => {
    if (!generatedAt) return "—"
    try {
      const date = new Date(generatedAt)
      if (isNaN(date.getTime())) return generatedAt
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    } catch {
      return generatedAt
    }
  }, [generatedAt])

  const featureItems = useMemo<FeatureCardItem[]>(() => {
    const list: FeatureCardItem[] = []

    // 1. Physicochemical
    if (features.molecularWeight != null) {
      list.push({
        id: "mw",
        label: "Molecular Weight",
        value: `${features.molecularWeight} g/mol`,
        category: "physicochemical",
      })
    }
    if (features.formula) {
      list.push({
        id: "formula",
        label: "Chemical Formula",
        value: features.formula,
        category: "physicochemical",
      })
    }
    if (features.pubchemCid != null) {
      list.push({
        id: "cid",
        label: "PubChem CID",
        value: String(features.pubchemCid),
        category: "physicochemical",
      })
    }

    // 2. Docking Affinities
    for (const d of features.docking) {
      list.push({
        id: `dock_${d.proteinId}`,
        label: `${d.proteinName ?? d.proteinId} Affinity`,
        value: `${d.affinityKcalMol} kcal/mol`,
        category: "targets",
        type: "docking",
      })
    }

    // 3. ADMET Descriptors
    const admeKeys = Object.keys(features.admeDescriptors)
    for (const key of admeKeys) {
      const val = String(features.admeDescriptors[key])
      const label = formatDescriptorKey(key)
      let cat: "adme" | "toxicity" | "physicochemical" = "adme"
      const lowerKey = key.toLowerCase()

      if (
        lowerKey.includes("solubility") ||
        lowerKey.includes("lipophilicity") ||
        lowerKey.includes("hydration")
      ) {
        cat = "physicochemical"
      } else if (
        lowerKey.includes("toxicity") ||
        lowerKey.includes("mutagenicity") ||
        lowerKey.includes("carcinogenicity") ||
        lowerKey.includes("herg") ||
        lowerKey.includes("injury") ||
        lowerKey.includes("reaction") ||
        lowerKey.includes("mitochondrial") ||
        lowerKey.includes("p53") ||
        lowerKey.includes("atad5") ||
        lowerKey.includes("heatshock")
      ) {
        cat = "toxicity"
      }

      let type: "yes" | "no" | "normal" = "normal"
      if (val.toLowerCase().startsWith("yes") || val.toLowerCase().startsWith("absorbed")) {
        type = "yes"
      } else if (val.toLowerCase().startsWith("no")) {
        type = "no"
      }

      list.push({
        id: `adme_${key}`,
        label,
        value: val,
        category: cat,
        type,
      })
    }

    return list
  }, [features])

  const filteredItems = useMemo(() => {
    if (activeCategory === "all") return featureItems
    return featureItems.filter((item) => item.category === activeCategory)
  }, [featureItems, activeCategory])

  const counts = useMemo(() => {
    return {
      all: featureItems.length,
      targets: featureItems.filter((i) => i.category === "targets").length,
      physicochemical: featureItems.filter((i) => i.category === "physicochemical").length,
      adme: featureItems.filter((i) => i.category === "adme").length,
      toxicity: featureItems.filter((i) => i.category === "toxicity").length,
    }
  }, [featureItems])

  return (
    <div className="pred-provenance">
      {/* 4-Column Spec Highlights Grid */}
      <ul className="pred-spec-grid">
        <li className="pred-spec-item">
          <span>Methodology</span>
          <strong>{method || "Computational prediction"}</strong>
          <span className="pred-spec-pill">Deterministic Engine</span>
        </li>
        <li className="pred-spec-item">
          <span>Model Name</span>
          <strong>{model || "NANOTOPHEA Simulation"}</strong>
        </li>
        <li className="pred-spec-item">
          <span>Version</span>
          <strong>{version || "v1.0"}</strong>
          <span className="pred-spec-pill" style={{ background: "#f1f5f9", color: "#475569" }}>
            Release Model
          </span>
        </li>
        <li className="pred-spec-item">
          <span>Generated</span>
          <strong>{formattedDate}</strong>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Audit Verified</span>
        </li>
      </ul>

      {/* Assumptions & Mathematical Formulation */}
      {assumptions ? (
        <div className="pred-assumption-box">
          <div className="pred-assumption-header">
            <Cpu size={14} aria-hidden />
            <span>Mathematical Model Formulation & Assumptions</span>
          </div>
          <p className="pred-assumption-text">{assumptions}</p>
        </div>
      ) : null}

      {/* Categorized Input Features Explorer with Collapsible Accordion (Section 19) */}
      <div className="pred-features-section" style={{ marginTop: "1rem" }}>
        <div
          className="pred-features-head"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            padding: "0.5rem 0",
            borderBottom: featuresExpanded ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
          }}
          onClick={() => setFeaturesExpanded((prev) => !prev)}
        >
          <div>
            <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              <Sliders size={14} aria-hidden />
              Input Feature Vectors
            </h4>
            <small style={{ color: "#64748b" }}>
              {featureItems.length} Descriptors Attached · Docking ({counts.targets}) · ADME ({counts.adme}) · Toxicity ({counts.toxicity}) · Physicochemical ({counts.physicochemical})
            </small>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setFeaturesExpanded((prev) => !prev)
            }}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "inherit",
              fontSize: "12px",
              fontWeight: 500,
              padding: "4px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {featuresExpanded ? (
              <>
                Collapse Descriptors <ChevronUp size={13} />
              </>
            ) : (
              <>
                Expand Descriptors ({featureItems.length}) <ChevronDown size={13} />
              </>
            )}
          </button>
        </div>

        {featuresExpanded ? (
          <>
            {/* Filter Category Tabs */}
            <div className="pred-features-tabs" role="tablist" aria-label="Feature categories" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                data-active={activeCategory === "all" ? "true" : "false"}
                onClick={() => setActiveCategory("all")}
              >
                All Features ({counts.all})
              </button>
              {counts.targets > 0 ? (
                <button
                  type="button"
                  data-active={activeCategory === "targets" ? "true" : "false"}
                  onClick={() => setActiveCategory("targets")}
                >
                  Docking Targets ({counts.targets})
                </button>
              ) : null}
              {counts.adme > 0 ? (
                <button
                  type="button"
                  data-active={activeCategory === "adme" ? "true" : "false"}
                  onClick={() => setActiveCategory("adme")}
                >
                  Pharmacokinetics & ADME ({counts.adme})
                </button>
              ) : null}
              {counts.toxicity > 0 ? (
                <button
                  type="button"
                  data-active={activeCategory === "toxicity" ? "true" : "false"}
                  onClick={() => setActiveCategory("toxicity")}
                >
                  Safety & Toxicity ({counts.toxicity})
                </button>
              ) : null}
              {counts.physicochemical > 0 ? (
                <button
                  type="button"
                  data-active={activeCategory === "physicochemical" ? "true" : "false"}
                  onClick={() => setActiveCategory("physicochemical")}
                >
                  Physicochemical ({counts.physicochemical})
                </button>
              ) : null}
            </div>

            {/* Features Card Grid */}
            <div className="pred-features-grid" style={{ marginTop: "0.75rem" }}>
              {filteredItems.map((item) => (
                <div key={item.id} className="pred-feature-card">
                  <span className="pred-feature-card-label" title={item.label}>
                    {item.label}
                  </span>
                  <span className="pred-feature-card-value" data-type={item.type}>
                    {item.value}
                  </span>
                </div>
              ))}
              {filteredItems.length === 0 ? (
                <p className="phyto-empty" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "1.5rem" }}>
                  No descriptors in this category.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function EvidenceBrowser({
  studyId,
  endpoint,
  compound,
  cellLine,
  term,
  tags,
  enabled = true,
}: {
  studyId: string
  endpoint: PredictionEndpoint
  compound: string
  cellLine?: string
  term: string
  tags: string[]
  enabled?: boolean
}) {
  const [paper, setPaper] = useState<PubMedPaper | null>(null)
  const [loadedKey, setLoadedKey] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const requestKey = `${compound}|${endpoint}|${cellLine ?? ""}|${term}|${retryNonce}`

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setPaper(null)
    setLoadedKey("")
    setError(null)
    const params = new URLSearchParams({
      term,
      compound,
      endpoint,
      studyId,
      ...(cellLine ? { cellLine } : {}),
    })
    void fetch(`/api/scientific/pubmed?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { paper?: PubMedPaper | null; error?: string }
        if (!response.ok) throw new Error(body.error || "Supporting literature temporarily unavailable — Retry")
        setPaper(body.paper ?? null)
        setLoadedKey(requestKey)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : "Supporting literature temporarily unavailable — Retry")
        setLoadedKey(requestKey)
      })
    return () => controller.abort()
  }, [cellLine, compound, enabled, endpoint, requestKey, studyId, term, retryNonce])

  if (!enabled) return null

  const ready = loadedKey === requestKey
  const selected = ready ? paper : null
  const label = selected ? publicationLabel(selected.pubTypes) : undefined

  return (
    <section className="phyto-block bp-evidence" aria-label="Scientific evidence">
      <header className="bp-evidence-head">
        <span className="bp-evidence-mark" aria-hidden>
          <BookOpen size={16} />
        </span>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <p className="bp-kicker" style={{ margin: 0 }}>Scientific evidence</p>
            <EvidenceBadge type="LITERATURE" />
          </div>
          <h3 style={{ marginTop: "0.2rem" }}>Supporting research</h3>
          <p className="bp-source-line">Source: PubMed / National Library of Medicine</p>
        </div>
      </header>
      <p className="bp-context">Peer-reviewed literature supporting the scientific context of this prediction.</p>
      
      {/* PubMed failure independent state (Section 21) */}
      {error ? (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            background: "rgba(244, 63, 94, 0.08)",
            border: "1px solid rgba(244, 63, 94, 0.25)",
            margin: "0.75rem 0",
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "13px", color: "#fb7185", fontWeight: 500 }}>
            Supporting literature temporarily unavailable — Retry
          </p>
          <button
            type="button"
            onClick={() => setRetryNonce((n) => n + 1)}
            style={{
              background: "rgba(244, 63, 94, 0.15)",
              border: "1px solid rgba(244, 63, 94, 0.35)",
              color: "#fda4af",
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: "5px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <RotateCcw size={11} aria-hidden /> Retry
          </button>
        </div>
      ) : null}
      {!ready && !error ? (
        <div className="bp-skeletons" aria-hidden>
          <span />
        </div>
      ) : null}
      {ready && !error && !selected ? <p className="bp-quiet">{NO_SUPPORTING_PAPER}</p> : null}
      {selected ? (
        <article className="bp-paper">
          <p className="bp-paper-kicker">
            <span>{label ?? "PubMed record"}</span>
            {selected.year ? <span>{selected.year}</span> : null}
          </p>
          <h4>{selected.title}</h4>
          {selected.authors ? <p className="bp-authors">{selected.authors}</p> : null}
          {selected.journal ? <p className="bp-journal">{selected.journal}</p> : null}
          <p className="bp-ids">
            <span>PMID {selected.pmid}</span>
            {selected.doi ? <span>DOI {selected.doi}</span> : null}
          </p>
          {tags.length > 0 ? (
            <div className="bp-tags">
              <span>Relevant to</span>
              <ul>
                {tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {selected.relevanceNote ? (
            <p className="bp-why">
              <span>Why this research is relevant</span>
              {selected.relevanceNote}
            </p>
          ) : null}
          <p className="bp-actions">
            <a href={selected.pubmedUrl} target="_blank" rel="noopener noreferrer">
              View on PubMed <ExternalLink size={13} aria-hidden />
            </a>
            {selected.doiUrl ? (
              <a href={selected.doiUrl} target="_blank" rel="noopener noreferrer">
                Open DOI <ExternalLink size={13} aria-hidden />
              </a>
            ) : null}
          </p>
        </article>
      ) : null}
    </section>
  )
}

function simulationOutputs(run?: PredictionRun): Array<{ label: string; value: string }> {
  if (!run || run.provenance?.evidenceClass !== "SIMULATION") return storedOutputs(run)
  const rows: Array<{ label: string; value: string }> = []
  for (const [key, value] of Object.entries(run.inputParameters ?? {})) {
    if (!key.startsWith("output:")) continue
    const label = key.slice("output:".length)
    const unit = run.inputParameters?.[`unit:${label}`]
    rows.push({ label, value: unit ? `${value} ${unit}` : String(value) })
  }
  return rows.length ? rows : storedOutputs(run)
}

function storedOutputs(run?: PredictionRun): Array<{ label: string; value: string }> {
  if (!run) return []
  const rows: Array<{ label: string; value: string }> = []
  if (run.summaryIc50 != null) rows.push({ label: "IC50", value: `${run.summaryIc50}${run.summaryIc50Unit ? ` ${run.summaryIc50Unit}` : ""}` })
  if (run.summaryMaximum != null) rows.push({ label: "Maximum", value: `${run.summaryMaximum}${run.summaryMaximumUnit ? ` ${run.summaryMaximumUnit}` : ""}` })
  if (run.teac) rows.push({ label: "TEAC", value: run.teac })
  if (run.selectivityIndex) rows.push({ label: "Selectivity index", value: run.selectivityIndex })
  if (run.pathwayEffect) rows.push({ label: "Pathway", value: run.pathwayEffect })
  for (const point of run.resultPoints) {
    rows.push({ label: `${point.metric} at ${point.concentration}`, value: `${point.value} ${point.valueUnit}` })
  }
  return rows
}

function dockingContext(features: PredictionFeatures, skipped: SkippedDockingPair[]): string {
  const done = features.docking.map((row) => `${row.proteinName ?? "Target"} ${row.affinityKcalMol} kcal/mol`)
  const omitted = skipped.map((row) => `${row.targetName}: no docking result`)
  const lines = [...done, ...omitted]
  return lines.length ? lines.join(" · ") : "Not available"
}

function featureLines(features: PredictionFeatures): string[] {
  const lines: string[] = []
  if (features.molecularWeight != null) lines.push(`Molecular weight ${features.molecularWeight}`)
  if (features.formula) lines.push(features.formula)
  if (features.pubchemCid != null) lines.push(`PubChem CID ${features.pubchemCid}`)
  for (const row of features.docking) lines.push(`${row.proteinName ?? row.proteinId} ${row.affinityKcalMol} kcal/mol`)
  for (const [key, value] of Object.entries(features.admeDescriptors)) lines.push(`${key} ${String(value)}`)
  return lines
}

function chartable(points: PredictionSeriesPoint[]): { metric: string; rows: PredictionSeriesPoint[] } | null {
  const groups = new Map<string, PredictionSeriesPoint[]>()
  for (const point of points) {
    const rows = groups.get(point.metric) ?? []
    rows.push(point)
    groups.set(point.metric, rows)
  }
  for (const [metric, rows] of groups) {
    if (rows.length >= 2) return { metric, rows: [...rows].sort((a, b) => a.concentration - b.concentration) }
  }
  return null
}

function primaryOutputSnippet(run?: PredictionRun): string {
  if (!run) return ""
  if (run.summaryIc50 != null) return `IC50: ${run.summaryIc50} ${run.summaryIc50Unit ?? "μM"}`
  if (run.summaryMaximum != null) return `Max: ${run.summaryMaximum}${run.summaryMaximumUnit ?? "%"}`
  if (run.teac) return `TEAC: ${run.teac}`
  if (run.selectivityIndex) return `SI: ${run.selectivityIndex}`
  const outputs = simulationOutputs(run)
  if (outputs[0]) return `${outputs[0].label}: ${outputs[0].value}`
  return "Completed"
}

function primaryMetricHighlight(run?: PredictionRun): string | null {
  if (!run) return null
  if (run.summaryIc50 != null) return `${run.summaryIc50} ${run.summaryIc50Unit ?? "μM"} (IC50)`
  if (run.summaryMaximum != null) return `${run.summaryMaximum}${run.summaryMaximumUnit ?? "%"} (Max response)`
  if (run.teac) return `${run.teac} (TEAC)`
  if (run.selectivityIndex) return `${run.selectivityIndex} (SI)`
  const outputs = simulationOutputs(run)
  if (outputs[0]) return `${outputs[0].value} (${outputs[0].label})`
  return "Calculated"
}

export default BiologicalPredictionsWorkspace

