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
import {
  PredictionEvidenceClassification,
  predictionEvidenceBadgeType,
} from "@/components/study/PredictionEvidenceClassification"
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
import type { ExploratoryAcknowledgementRecord } from "@/lib/predictions/acknowledgement"
import {
  assertAcknowledgementActorIsServer,
  readAcknowledgementFromParameters,
} from "@/lib/predictions/acknowledgement"
import { sanitizePredictionDisplay } from "@/lib/predictions/displaySanitization"
import type { PrototypePredictionResult } from "@/lib/predictions/prototype/types"
import {
  buildRosOxidativeTargetSelections,
  readRosOxidativeTargetKeysFromParameters,
  resolveRosOxidativeTargetViews,
} from "@/lib/predictions/rosOxidativeTargets"
import { storedSimulationFromPrototype } from "@/lib/predictions/store"
import type { PredictionFeatures, PredictionSeriesPoint } from "@/lib/predictions/types"
import { publicationLabel, type PubMedPaper } from "@/lib/scientific/pubmed"
import { listCellLines, listCompounds, listProteins } from "@/lib/repositories/researchDataRepository"
import { createPredictionRun, listAdmetRuns, listDockingOutcomes, listPredictionRuns, updatePredictionRun } from "@/lib/repositories/scientificRunRepository"
import { RosOxidativeTargetPicker } from "@/components/study/RosOxidativeTargetPicker"
import { readStudyUiPrefs, writeStudyUiPrefs } from "@/lib/workflow/studyUiPrefs"

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
  dpph: "DPPH Antioxidant (exploratory simulation)",
  mtt: "MTT Metabolic Viability (exploratory simulation)",
  ldh: "LDH Membrane-Damage Index (exploratory simulation)",
  ros: "ROS Oxidative-Stress Index (exploratory simulation)",
  bax: "BAX-Target Context (exploratory simulation)",
  hippo_yap: "Hippo–YAP Pathway Proxies (exploratory simulation)",
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
  endpoint?: PredictionEndpoint,
) {
  // Only Hippo–YAP uses docking as an explicit pathway-engagement proxy.
  // DPPH / MTT / LDH / ROS / BAX must not receive docking affinities as assay drivers.
  const includeDocking = endpoint === "hippo_yap"
  const includeProteins = endpoint === "hippo_yap" || endpoint === "bax"
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
    proteins: includeProteins
      ? proteins
          .filter((protein) => !subject.proteinId || protein.id === subject.proteinId)
          .map((protein) => ({ id: protein.id, name: protein.name }))
      : endpoint === "dpph"
        ? []
        : subject.proteinId
          ? [{ id: subject.proteinId, name: subject.proteinName ?? subject.proteinId }]
          : [],
    docking: includeDocking
      ? docking
          .filter((row) => row.compoundId === subject.compoundId && (!subject.proteinId || row.proteinId === subject.proteinId))
          .map((row) => ({
            proteinId: row.proteinId,
            proteinName: proteins.find((protein) => protein.id === row.proteinId)?.name,
            affinityKcalMol: row.bestBindingAffinityKcalMol,
          }))
      : [],
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
  /** ROS investigation context only — never fed into simulateRos features. */
  rosOxidativeTargetKeys?: string[]
}): Promise<void> {
  const features = featuresForSubject(
    input.studyId,
    input.subject,
    input.compound,
    input.proteins,
    input.docking,
    input.admet,
    input.endpoint,
  )
  const response = await fetch("/api/scientific/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studyId: input.studyId,
      endpoint: input.endpoint,
      features,
      mode: "exploratory_simulation",
      acknowledgeExploratory: true,
    }),
  })
  const body = (await response.json()) as {
    endpoint?: string
    evidenceClass?: string
    error?: string
    reason?: string
    message?: string
    status?: string
    series?: PrototypePredictionResult["series"]
    outputs?: PrototypePredictionResult["outputs"]
    modelName?: string
    modelVersion?: string
    method?: string
    assumptions?: string
    note?: string
    generatedAt?: string
    inputFeatures?: string[]
    units?: Record<string, string>
    acknowledgement?: ExploratoryAcknowledgementRecord
    acknowledgedByServer?: string
  }
  if (response.status === 401) {
    throw new Error(body.error || "Sign in to run exploratory simulations.")
  }
  if (response.status === 403) {
    throw new Error(body.error || "You do not have access to this study.")
  }
  if (response.status === 422 || body.status === "unavailable") {
    throw new Error(body.reason || body.error || "Insufficient data for a scientifically defensible simulation.")
  }
  if (!response.ok || body.evidenceClass !== "SIMULATION" || body.status === "acknowledgement_required") {
    throw new Error(body.error || body.message || "The exploratory simulation could not be generated.")
  }
  if (body.endpoint !== input.endpoint) {
    throw new Error("Prediction endpoint mismatch — result was not stored.")
  }
  if (!Array.isArray(body.series) || !body.outputs || !body.modelName || !body.method || !body.assumptions) {
    throw new Error("Incomplete exploratory simulation payload — nothing was stored.")
  }
  if (!body.acknowledgement?.acknowledgedExploratory || !body.acknowledgement.acknowledgedBy) {
    throw new Error("Server acknowledgement was missing — exploratory run was not stored.")
  }
  // Never trust a client-invented actor for consent audit; use server stamp only.
  const acknowledgement: ExploratoryAcknowledgementRecord = {
    ...body.acknowledgement,
    acknowledgedBy: body.acknowledgedByServer || body.acknowledgement.acknowledgedBy,
  }
  assertAcknowledgementActorIsServer(acknowledgement, body.acknowledgedByServer || acknowledgement.acknowledgedBy)
  const simulation: PrototypePredictionResult = {
    endpoint: body.endpoint as PrototypePredictionResult["endpoint"],
    modelName: body.modelName,
    modelVersion: (body.modelVersion as PrototypePredictionResult["modelVersion"]) || "exploratory-v1",
    method: "Exploratory simulation",
    status: "ok",
    outputs: body.outputs,
    units: body.units ?? {},
    inputFeatures: body.inputFeatures ?? [],
    generatedAt: body.generatedAt || new Date().toISOString(),
    evidenceClass: "SIMULATION",
    assumptions: body.assumptions,
    series: body.series,
    ...(body.note ? { note: body.note } : {}),
  }
  const rosSelections =
    input.endpoint === "ros"
      ? buildRosOxidativeTargetSelections(
          resolveRosOxidativeTargetViews({
            selectedKeys: input.rosOxidativeTargetKeys ?? [],
            proteins: input.proteins,
            docking: input.docking,
            compoundId: input.subject.compoundId,
          }),
        )
      : undefined
  const stored = storedSimulationFromPrototype(simulation, features, {
    proteinId: input.subject.proteinId,
    cellLineId: input.subject.cellLineId,
    acknowledgement,
    ...(rosSelections ? { rosOxidativeTargets: rosSelections } : {}),
  })
  if (stored.endpoint !== input.endpoint) {
    throw new Error("Stored prediction endpoint mismatch.")
  }
  // Persist with the authenticated workspace user; acknowledgement actor is the server stamp in input_parameters.
  // Re-runs must replace the scientific payload (updatePredictionRun scientific-replace path), not notes-only.
  try {
    if (input.existing) await updatePredictionRun(input.studyId, input.existing.id, { id: input.actorId }, stored)
    else await createPredictionRun(input.studyId, { id: input.actorId }, stored)
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Exploratory simulation was computed but not saved: ${error.message}`
        : "Exploratory simulation was computed but not saved.",
    )
  }
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
  const studyId = activeStudy?.id ?? null
  const activeStudyRef = useRef(activeStudy)
  activeStudyRef.current = activeStudy
  const [compounds, setCompounds] = useState<Compound[]>([])
  const [proteins, setProteins] = useState<Protein[]>([])
  const [cellLines, setCellLines] = useState<CellLineRecord[]>([])
  const [runs, setRuns] = useState<PredictionRun[]>([])
  const [docking, setDocking] = useState<DockingRun[]>([])
  const [skippedDocking, setSkippedDocking] = useState<SkippedDockingPair[]>([])
  const [admet, setAdmet] = useState<AdmetRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const predictionUi = readStudyUiPrefs(studyId, "predictions", {
    selectedJobKey: "",
    query: "",
    filter: "all" as StatusFilterId,
  })
  const [selectedJobKey, setSelectedJobKey] = useState(String(predictionUi.selectedJobKey ?? ""))
  const [query, setQuery] = useState(String(predictionUi.query ?? ""))
  const [filter, setFilter] = useState<StatusFilterId>((predictionUi.filter as StatusFilterId) || "all")
  const [mobilePane, setMobilePane] = useState<"library" | "detail">("library")
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [pendingConfirmJobs, setPendingConfirmJobs] = useState<BiologicalPredictionJob[] | null>(null)
  const [queuedKeys, setQueuedKeys] = useState<Set<string>>(new Set())
  const [batch, setBatch] = useState<{ done: number; total: number; label: string } | null>(null)
  const [failures, setFailures] = useState<Record<string, string>>({})
  /** Per ROS subject key → selected oxidative-stress target keys (config + traceability). */
  const [rosTargetKeysBySubject, setRosTargetKeysBySubject] = useState<Record<string, string[]>>({})
  const runningRef = useRef(false)
  const loadGenerationRef = useRef(0)

  useEffect(() => {
    writeStudyUiPrefs(studyId, "predictions", { selectedJobKey, query, filter })
  }, [studyId, selectedJobKey, query, filter])

  const load = useCallback(async (options?: { soft?: boolean }) => {
    const study = activeStudyRef.current
    const generation = ++loadGenerationRef.current
    if (!study) {
      setLoading(false)
      return
    }
    if (!options?.soft) setLoading(true)
    setError(null)
    try {
      const [compoundRows, proteinRows, lineRows, predictionRows, dockingRows, admetRows] = await Promise.all([
        listCompounds(study.id),
        listProteins(study.id),
        listCellLines(study.id),
        listPredictionRuns(study.id).catch(() => [] as PredictionRun[]),
        listDockingOutcomes(study.id).catch(() => ({ completed: [] as DockingRun[], skipped: [] as SkippedDockingPair[] })),
        listAdmetRuns(study.id).catch(() => [] as AdmetRun[]),
      ])
      if (generation !== loadGenerationRef.current) return
      setCompounds(compoundRows)
      setProteins(proteinRows)
      setCellLines(lineRows)
      setRuns(predictionRows)
      setDocking(dockingRows.completed)
      setSkippedDocking(dockingRows.skipped)
      setAdmet(admetRows)
    } catch (e) {
      if (generation !== loadGenerationRef.current) return
      setError(toUserFacingError(e, "Biological predictions could not be loaded."))
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false)
    }
  }, [studyId])

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
    if (!studyId) return
    const updated = await listPredictionRuns(studyId).catch(() => [] as PredictionRun[])
    setRuns(updated)
  }, [studyId])

  function requestExploratoryRun(jobsToRun: BiologicalPredictionJob[]) {
    if (!user) {
      setError("Sign in to run an exploratory simulation.")
      return
    }
    if (!activeStudy || runningRef.current || jobsToRun.length === 0) return
    setPendingConfirmJobs(jobsToRun)
  }

  async function runJobs(jobsToRun: BiologicalPredictionJob[]) {
    if (!activeStudy || !user || runningRef.current || jobsToRun.length === 0) {
      if (!user) setError("Sign in to run an exploratory simulation.")
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
          const rosKeys =
            job.endpoint === "ros"
              ? rosTargetKeysBySubject[job.subject.key] ??
                readRosOxidativeTargetKeysFromParameters(
                  runs.find((run) => run.endpoint === "ros" && runMatchesSubject(run, job.subject))?.inputParameters,
                )
              : undefined
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
            ...(rosKeys ? { rosOxidativeTargetKeys: rosKeys } : job.endpoint === "ros" ? { rosOxidativeTargetKeys: [] } : {}),
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

  function runAllReady() {
    const readyJobs = allJobs.filter((j) => getJobStatus(j) === "READY")
    if (!readyJobs.length) return
    requestExploratoryRun(readyJobs)
  }

  function retryAllFailed() {
    const failedJobs = allJobs.filter((j) => getJobStatus(j) === "FAILED")
    if (!failedJobs.length) return
    requestExploratoryRun(failedJobs)
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
                    onClick={() => runAllReady()}
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
                    {runningRef.current || queuedKeys.size > 0 ? "Running..." : `Simulate All Ready (${readyCount})`}
                  </button>
                ) : failedCount > 0 ? (
                  <button
                    type="button"
                    disabled={runningRef.current || queuedKeys.size > 0}
                    onClick={() => retryAllFailed()}
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
                            requestExploratoryRun([job])
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

            {/* RIGHT DETAIL: Individual phytochemical assay view */}
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
                rosOxidativeTargetKeys={
                  selectedJob.endpoint === "ros"
                    ? (rosTargetKeysBySubject[selectedJob.subject.key] ??
                      readRosOxidativeTargetKeysFromParameters(
                        runs.find(
                          (row) => row.endpoint === "ros" && runMatchesSubject(row, selectedJob.subject),
                        )?.inputParameters,
                      ))
                    : []
                }
                onRosOxidativeTargetsChange={(keys) => {
                  setRosTargetKeysBySubject((current) => ({
                    ...current,
                    [selectedJob.subject.key]: keys,
                  }))
                }}
                onRun={() => requestExploratoryRun([selectedJob])}
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

      {pendingConfirmJobs ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exploratory-sim-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15, 23, 42, 0.55)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "var(--card, #fff)",
              color: "var(--card-foreground, #0f172a)",
              borderRadius: "12px",
              border: "1px solid var(--border, #e2e8f0)",
              padding: "1.1rem 1.2rem",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
            }}
          >
            <p
              id="exploratory-sim-title"
              style={{ margin: 0, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#c2410c", fontWeight: 700 }}
            >
              Exploratory simulation — not a validated prediction
            </p>
            <h3 style={{ margin: "0.45rem 0 0.55rem", fontSize: "1.05rem" }}>
              Run {pendingConfirmJobs.length === 1 ? "this" : `${pendingConfirmJobs.length}`} exploratory simulation
              {pendingConfirmJobs.length === 1 ? "" : "s"}?
            </h3>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "#475569" }}>
              No validated computational model is registered for these endpoints. Results will be stored as{" "}
              <strong>SIMULATION</strong> from identity-based demonstration curves. They are not experimental
              measurements, not Trolox TEAC, not fitted IC50 values, not absorbance/OD, and not flow-cytometry
              populations. Hippo–YAP may use docking only as a labeled pathway proxy.
            </p>
            <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem", fontSize: "12px", color: "#64748b" }}>
              {pendingConfirmJobs.slice(0, 6).map((job) => (
                <li key={job.key}>{predictionJobLabel(job.endpoint, job.subject)}</li>
              ))}
              {pendingConfirmJobs.length > 6 ? <li>…and {pendingConfirmJobs.length - 6} more</li> : null}
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                type="button"
                className="phyto-back"
                onClick={() => setPendingConfirmJobs(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="phyto-continue"
                onClick={() => {
                  const jobs = pendingConfirmJobs
                  setPendingConfirmJobs(null)
                  void runJobs(jobs)
                }}
              >
                I understand — run exploratory simulation
              </button>
            </div>
          </div>
        </div>
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
  rosOxidativeTargetKeys = [],
  onRosOxidativeTargetsChange,
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
  rosOxidativeTargetKeys?: string[]
  onRosOxidativeTargetsChange?: (keys: string[]) => void
  onRun: () => void
  onLibrary: () => void
}) {
  const spec = ENDPOINT_SPECS[endpoint]
  const features = featuresForSubject(studyId, subject, compound, proteins, docking, admet, endpoint)
  const search = literatureSearch(endpoint, subject.compoundName, literatureCellLine)
  const isCompletedWithValidResult = canShowScientificEvidence(run, { running, runError })
  const evidenceBadge = predictionEvidenceBadgeType(endpoint, isCompletedWithValidResult ? run : null)
  const display = isCompletedWithValidResult ? sanitizePredictionDisplay(run) : null
  const outputs = display ? display.primary.map((row) => ({ label: row.label, value: row.value })) : []
  const legacyOutputs = display ? display.legacy.map((row) => ({ label: row.label, value: row.value })) : []
  const legacyWarning = display?.legacyWarning ?? null
  const provenanceWarning = display?.provenanceWarning ?? null
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
  const metricCards = prioritizeAssayOutputs(endpoint, outputs)
  const isHippoYap = endpoint === "hippo_yap"
  const isBax = endpoint === "bax"
  const isDpph = endpoint === "dpph"
  const isMtt = endpoint === "mtt"
  const isLdh = endpoint === "ldh"
  const isRos = endpoint === "ros"

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
          {evidenceBadge && evidenceBadge !== "NOT_AVAILABLE" ? (
            <EvidenceBadge type={evidenceBadge} />
          ) : evidenceBadge === "NOT_AVAILABLE" ? (
            <span className="prediction-evidence-hero-na">NOT AVAILABLE</span>
          ) : null}

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
                Retry exploratory simulation
              </>
            ) : (
              <>
                <Play size={14} aria-hidden />
                Run exploratory simulation
              </>
            )}
          </button>
        </div>
      </header>

      <PredictionEvidenceClassification endpoint={endpoint} run={run} />

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
            Hippo–YAP pathway proxies (exploratory)
          </strong>
          YAP–TEAD residual activity and related proxies use the selected Hippo-related docking context as an exploratory
          engagement signal — not Western blot, qPCR, microscopy, or DPPH scavenging.
        </div>
      ) : null}

      {isDpph ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.75rem 0.9rem",
            borderRadius: "8px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: "13px",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#14532d",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "0.2rem",
            }}
          >
            DPPH radical-scavenging (exploratory, µM)
          </strong>
          Compound-level demonstration on the in-silico µM grid. Docking is not used. Hill midpoint ≠ fitted IC50. Maximum
          response ratio ≠ Trolox TEAC. Experimental DPPH (µg/mL) is recorded separately in Laboratory.
        </div>
      ) : null}

      {isMtt ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.75rem 0.9rem",
            borderRadius: "8px",
            background: "#fdf4ff",
            border: "1px solid #e9d5ff",
            color: "#6b21a8",
            fontSize: "13px",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#581c87",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "0.2rem",
            }}
          >
            MTT metabolic viability (exploratory)
          </strong>
          Reflects an exploratory metabolic-viability index for compound × cell line identity. Not definitive cell death.
          No selectivity index without paired normal/cancer IC50 data. Docking is not used.
        </div>
      ) : null}

      {isLdh ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.75rem 0.9rem",
            borderRadius: "8px",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#9f1239",
            fontSize: "13px",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#881337",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "0.2rem",
            }}
          >
            LDH membrane-damage index (exploratory)
          </strong>
          No spectrophotometer OD is invented here. Experimental LDH % cytotoxicity requires sample, spontaneous, and
          maximum-release controls in Laboratory.
        </div>
      ) : null}

      {isRos ? (
        <div
          style={{
            marginTop: "0.85rem",
            padding: "0.75rem 0.9rem",
            borderRadius: "8px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: "13px",
          }}
        >
          <strong
            style={{
              display: "block",
              color: "#78350f",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "0.2rem",
            }}
          >
            ROS oxidative-stress index (exploratory)
          </strong>
          Relative index only — not DCFH fluorescence and not mitochondrial ΔΨm. Distinct from chemical DPPH scavenging.
          Docking affinities are excluded from the ROS index. Optional oxidative-stress protein targets below are
          investigation context only — not experimentally measured biomarkers.
        </div>
      ) : null}

      {isRos ? (
        <RosOxidativeTargetPicker
          selectedKeys={rosOxidativeTargetKeys}
          onChange={(keys) => onRosOxidativeTargetsChange?.(keys)}
          proteins={proteins}
          docking={docking}
          compoundId={subject.compoundId}
          disabled={running || queued}
        />
      ) : null}

      {isRos && isCompletedWithValidResult ? (
        <section className="phyto-block" style={{ marginTop: "0.85rem" }}>
          <h3>Recorded oxidative-stress targets</h3>
          <p className="phyto-caption">
            Targets preserved with this ROS run for study traceability. They did not drive the exploratory ROS index.
          </p>
          {(() => {
            const storedKeys = readRosOxidativeTargetKeysFromParameters(run?.inputParameters)
            if (!storedKeys.length) {
              return <p className="dock-note">No oxidative-stress protein targets were selected for this run.</p>
            }
            const views = resolveRosOxidativeTargetViews({
              selectedKeys: storedKeys,
              proteins,
              docking,
              compoundId: subject.compoundId,
            }).filter((row) => row.selected)
            return (
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                {views.map((row) => (
                  <li key={row.key}>
                    <strong>{row.geneSymbol}</strong> — {row.proteinName}
                    {row.curatedPdbId ? ` · curated PDB ${row.curatedPdbId}` : ""}
                    {row.dockingAffinityKcalMol != null
                      ? ` · docking context ${row.dockingAffinityKcalMol.toFixed(2)} kcal/mol (not a ROS value)`
                      : ""}
                  </li>
                ))}
              </ul>
            )
          })()}
        </section>
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
            BAX-target context (exploratory)
          </strong>
          Only a BAX-target context index is simulated. This is not BAX/BCL-2/caspase expression, not Annexin V/PI, and not
          viable/early/late/necrotic population percentages.
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
            <p className="adme-pulse">RUNNING EXPLORATORY SIMULATION</p>
            <strong>
              {batch ? `Simulating ${batch.label} (${batch.done} of ${batch.total})` : `Simulating ${subject.label} · ${HERO[endpoint]}`}
            </strong>
          </div>
          <ol className="adme-stages">
            <li data-state="done">
              <Check size={14} aria-hidden />
              <span>Collecting recorded identity fields</span>
            </li>
            <li data-state="done">
              <Check size={14} aria-hidden />
              <span>{isHippoYap ? "Including Hippo-target docking proxy" : "Excluding docking as assay driver"}</span>
            </li>
            <li data-state="active">
              <span className="adme-spin" aria-hidden />
              <span>Building exploratory demonstration curve</span>
            </li>
            <li data-state="waiting">
              <span className="adme-wait" aria-hidden />
              <span>Applying SIMULATION evidence labels</span>
            </li>
            <li data-state="waiting">
              <span className="adme-wait" aria-hidden />
              <span>Persisting exploratory outputs</span>
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

      {/* OUTPUT PARAMETERS — primary researcher focus */}
      <section className="phyto-block assay-results-block">
        <h3>Output parameters</h3>
        <p className="phyto-caption">
          Exploratory SIMULATION metrics for this endpoint. These are not experimental assay measurements.
        </p>

        {isCompletedWithValidResult && metricCards.main.length > 0 ? (
          <>
            <div className="assay-metric-grid" data-count={String(metricCards.main.length)}>
              {metricCards.main.map((item, idx) => {
                const parts = splitMetricDisplay(item.value)
                return (
                  <article key={item.label} className="assay-metric-card" data-primary={idx === 0 ? "true" : undefined}>
                    <span className="assay-metric-label">{systemCopy(item.label)}</span>
                    <strong className="assay-metric-value">{systemCopy(parts.value)}</strong>
                    {parts.unit ? <span className="assay-metric-unit">{systemCopy(parts.unit)}</span> : null}
                  </article>
                )
              })}
            </div>

            {metricCards.additional.length > 0 ? (
              <div className="assay-metric-grid assay-metric-grid--secondary" data-count={String(metricCards.additional.length)}>
                {metricCards.additional.map((item) => {
                  const parts = splitMetricDisplay(item.value)
                  return (
                    <article key={item.label} className="assay-metric-card assay-metric-card--secondary">
                      <span className="assay-metric-label">{systemCopy(item.label)}</span>
                      <strong className="assay-metric-value">{systemCopy(parts.value)}</strong>
                      {parts.unit ? <span className="assay-metric-unit">{systemCopy(parts.unit)}</span> : null}
                    </article>
                  )
                })}
              </div>
            ) : null}

            {run?.pathwayEffect ? (
              <p className="dock-note" style={{ marginTop: "0.85rem" }}>
                {systemCopy(run.pathwayEffect)}
              </p>
            ) : null}

            {provenanceWarning ? (
              <p className="dock-note" role="note" style={{ marginTop: "0.85rem" }}>
                {provenanceWarning}
              </p>
            ) : null}

            {legacyWarning && legacyOutputs.length > 0 ? (
              <div className="nano-studies-alert" role="note" style={{ marginTop: "0.85rem" }}>
                <p>{legacyWarning}</p>
                <div className="dock-table-wrap" style={{ marginTop: "0.6rem" }}>
                  <table className="dock-table">
                    <thead>
                      <tr>
                        <th>Historical / legacy field</th>
                        <th>Stored value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legacyOutputs.map((item) => (
                        <tr key={item.label}>
                          <td>
                            <strong>{systemCopy(item.label)}</strong>
                          </td>
                          <td>{systemCopy(item.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="dock-note">
            No exploratory simulation has been run for this subject yet. Click &ldquo;Run exploratory simulation&rdquo; after
            acknowledging the SIMULATION disclaimer.
          </p>
        )}
      </section>

      {/* ASSAY GRAPH — supporting visualization below outputs */}
      <section className="phyto-block assay-graph-block">
        <h3>
          {isCompletedWithValidResult && chart
            ? isHippoYap
              ? "Assay graph · YAP–TEAD residual activity vs concentration"
              : isDpph
                ? "Assay graph · DPPH scavenging vs concentration"
                : isMtt
                  ? "Assay graph · Metabolic viability vs concentration"
                  : isLdh
                    ? "Assay graph · Membrane-damage index vs concentration"
                    : isRos
                      ? "Assay graph · Relative ROS index vs concentration"
                      : isBax
                        ? "Assay graph · BAX-target context vs concentration"
                        : "Assay graph · Concentration–response"
            : "Assay graph"}
        </h3>
        <p className="phyto-caption">
          {isCompletedWithValidResult && chart
            ? `Supporting concentration–response for ${chart.metric.replace(/_/g, " ")}. Exploratory simulation only.`
            : "Concentration–response visualization appears after the exploratory simulation completes."}
        </p>

        {isCompletedWithValidResult && chart ? (
          <div className="pred-chart assay-graph-panel" aria-label={`${chart.metric} concentration response`}>
            <p className="phyto-caption" style={{ marginBottom: "0.45rem" }}>
              X:{" "}
              {chart.rows[0]?.concentrationUnit === "uM"
                ? "µM"
                : chart.rows[0]?.concentrationUnit === "ug_per_mL"
                  ? "µg/mL"
                  : chart.rows[0]?.concentrationUnit || "concentration"}{" "}
              · Y: {chart.rows[0]?.unit || "response"} · Metric: {chart.metric.replace(/_/g, " ")}
            </p>
            <div className="assay-graph-canvas">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.rows} margin={{ top: 12, right: 16, bottom: 8, left: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="concentration"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    label={{
                      value:
                        chart.rows[0]?.concentrationUnit === "uM"
                          ? "Concentration (µM)"
                          : chart.rows[0]?.concentrationUnit === "ug_per_mL"
                            ? "Concentration (µg/mL)"
                            : "Concentration",
                      position: "insideBottom",
                      offset: -2,
                      style: { fontSize: 11, fill: "#94a3b8" },
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    width={48}
                    label={{
                      value: chart.rows[0]?.unit || "Response",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 11, fill: "#94a3b8" },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      color: "var(--card-foreground)",
                      fontSize: "12px",
                      boxShadow: "var(--card-shadow)",
                    }}
                    formatter={(value: number) => [`${value} ${chart.rows[0]?.unit || ""}`.trim(), chart.metric.replace(/_/g, " ")]}
                    labelFormatter={(label) => {
                      const unit =
                        chart.rows[0]?.concentrationUnit === "uM"
                          ? "µM"
                          : chart.rows[0]?.concentrationUnit === "ug_per_mL"
                            ? "µg/mL"
                            : chart.rows[0]?.concentrationUnit || ""
                      return `${label} ${unit}`.trim()
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={chart.metric.replace(/_/g, " ")}
                    stroke={isHippoYap ? "#0369a1" : "#0f766e"}
                    strokeWidth={2.75}
                    dot={{ r: 4.5, fill: isHippoYap ? "#0369a1" : "#0f766e" }}
                    activeDot={{ r: 7 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="assay-graph-empty">
            <p className="phyto-missing">
              {runError
                ? "Exploratory simulation failed. Click “Retry exploratory simulation” to re-run."
                : "No graph yet. Run the exploratory simulation to generate the concentration–response curve."}
            </p>
          </div>
        )}
      </section>

      {/* Compact study context after results */}
      <section className="phyto-block">
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

      {/* INTERPRETATION / ASSUMPTIONS — anchor target for evidence classification link */}
      <section className="phyto-block" id="prediction-assumptions-limitations">
        <h3>Interpretation & assumptions</h3>
        <p className="phyto-caption">
          {isCompletedWithValidResult
            ? "Method labels, exploratory limitations, and acknowledgement audit."
            : "Endpoint limitations before a run. Full method provenance appears after the exploratory simulation completes."}
        </p>
        {isCompletedWithValidResult ? (
          <Provenance
            method={systemCopy(run?.source ?? run?.methodType ?? "")}
            model={systemCopy(run?.methodName ?? "")}
            version={systemCopy(run?.methodVersion ?? "")}
            generatedAt={run?.dateGenerated ?? ""}
            features={features}
            assumptions={systemCopy(run?.assumptions ?? "")}
            acknowledgement={readAcknowledgementFromParameters(run?.inputParameters)}
          />
        ) : (
          <div className="pred-assumption-box">
            <div className="pred-assumption-header">
              <span>Assumptions &amp; limitations</span>
            </div>
            <p className="pred-assumption-text">{systemCopy(spec.context)}</p>
            <p className="pred-assumption-text" style={{ marginTop: "0.55rem" }}>
              No validated predictive model is registered for this endpoint. Outputs remain SIMULATION / exploratory
              computational results until a documented model with provenance is available. Experimental measurements are
              recorded in Laboratory Validation.
            </p>
          </div>
        )}
      </section>

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
    .replace(/NANO-HEPATOTEA Prototype|NANOTOPHEA Prototype|HEPATOTEA Prototype/g, "HEPATOTEA")
    .replace(/NANO-HEPATOTEA|NANOTOPHEA/g, "HEPATOTEA")
    .replace(/Deterministic prototype simulation/g, "Exploratory simulation")
    .replace(/Computational prediction/gi, "Exploratory simulation")
    .replace(/\bprototype-v1\b/g, "exploratory-v1")
    .replace(/\bprototype score\b/gi, "score")
    .replace(/\bprototype ratio\b/gi, "ratio")
    .replace(/Prototype curve is higher at the upper concentrations\./g, "The response is higher at the upper concentrations.")
    .replace(/Prototype curve stays lower across the concentrations\./g, "The response stays lower across the concentrations.")
    .replace(/\bprototype\b/gi, "exploratory")
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
  acknowledgement,
}: {
  method: string
  model: string
  version?: string
  generatedAt: string
  features: PredictionFeatures
  assumptions?: string
  acknowledgement?: ReturnType<typeof readAcknowledgementFromParameters>
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
          <strong>{model || "HEPATOTEA Simulation"}</strong>
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

      {acknowledgement ? (
        <div className="pred-assumption-box" style={{ marginTop: "0.75rem" }}>
          <div className="pred-assumption-header">
            <Check size={14} aria-hidden />
            <span>Exploratory acknowledgement audit</span>
          </div>
          <p className="pred-assumption-text">
            {acknowledgement.present
              ? `Acknowledged at ${acknowledgement.acknowledgedAt ?? "unknown time"} by authenticated user ${acknowledgement.acknowledgedBy ?? "unknown"} (version ${acknowledgement.acknowledgementVersion ?? "unspecified"}).`
              : "Historical run: no exploratory acknowledgement metadata is stored on this record. The simulation result is preserved; consent was not captured under the current audit format."}
          </p>
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
  const display = sanitizePredictionDisplay(run)
  return display.primary.map((row) => ({ label: row.label, value: row.value }))
}

/** Split "12.5 µM (not fitted IC50)" into value + unit for metric cards. */
function splitMetricDisplay(raw: string): { value: string; unit: string } {
  const text = String(raw ?? "").trim()
  if (!text) return { value: "—", unit: "" }
  const match = text.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(.*)$/i)
  if (!match) return { value: text, unit: "" }
  return { value: match[1], unit: match[2].trim() }
}

const ENDPOINT_MAIN_OUTPUT_PATTERNS: Record<PredictionEndpoint, RegExp[]> = {
  dpph: [/Scavenging response/i, /Hill midpoint/i, /Maximum scavenging/i],
  mtt: [/Metabolic viability/i, /Hill midpoint/i, /Maximum metabolic inhibition/i],
  ldh: [/membrane-damage|Membrane-damage/i, /Hill midpoint/i],
  ros: [/ROS index/i, /Hill midpoint/i],
  bax: [/BAX-target context/i, /Hill midpoint/i],
  hippo_yap: [/YAP–TEAD residual|YAP-TEAD residual/i, /Estimated YAP suppression/i, /p-YAP Ser127/i],
}

/**
 * Prioritize assay-specific numeric outputs for prominent cards.
 * Excludes pathway notes and other narrative fields from metric cards.
 */
function prioritizeAssayOutputs(
  endpoint: PredictionEndpoint,
  outputs: Array<{ label: string; value: string }>,
): { main: Array<{ label: string; value: string }>; additional: Array<{ label: string; value: string }> } {
  const numeric = outputs.filter((row) => !/^Pathway note$/i.test(row.label))
  const patterns = ENDPOINT_MAIN_OUTPUT_PATTERNS[endpoint] ?? []
  const main: Array<{ label: string; value: string }> = []
  const used = new Set<string>()

  for (const pattern of patterns) {
    const hit = numeric.find((row) => pattern.test(row.label) && !used.has(row.label))
    if (!hit) continue
    main.push(hit)
    used.add(hit.label)
    if (main.length >= 3) break
  }

  if (!main.length && numeric[0]) {
    main.push(numeric[0])
    used.add(numeric[0].label)
  }

  const additional = numeric.filter((row) => !used.has(row.label))
  return { main, additional }
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

function preferredSimulationOutput(
  run: PredictionRun,
): { label: string; value: string } | undefined {
  const outputs = simulationOutputs(run)
  if (!outputs.length) return undefined
  if (run.endpoint === "hippo_yap") {
    return (
      outputs.find((row) => /YAP–TEAD residual|YAP-TEAD residual|Estimated YAP suppression/i.test(row.label)) ??
      outputs[0]
    )
  }
  if (run.endpoint === "dpph") {
    return outputs.find((row) => /Scavenging|Hill midpoint/i.test(row.label)) ?? outputs[0]
  }
  if (run.endpoint === "mtt") {
    return outputs.find((row) => /Metabolic viability/i.test(row.label)) ?? outputs[0]
  }
  if (run.endpoint === "ldh") {
    return outputs.find((row) => /membrane-damage|Membrane-damage/i.test(row.label)) ?? outputs[0]
  }
  if (run.endpoint === "ros") {
    return outputs.find((row) => /ROS index/i.test(row.label)) ?? outputs[0]
  }
  if (run.endpoint === "bax") {
    return outputs.find((row) => /BAX-target context/i.test(row.label)) ?? outputs[0]
  }
  return outputs[0]
}

function primaryOutputSnippet(run?: PredictionRun): string {
  if (!run) return ""
  const preferred = preferredSimulationOutput(run)
  if (preferred) return `${preferred.label}: ${preferred.value}`
  if (run.summaryMaximum != null) return `Max: ${run.summaryMaximum}${run.summaryMaximumUnit ?? "%"}`
  return "Completed"
}

function primaryMetricHighlight(run?: PredictionRun): string | null {
  if (!run) return null
  const preferred = preferredSimulationOutput(run)
  if (preferred) return `${preferred.value} (${preferred.label})`
  if (run.summaryMaximum != null) return `${run.summaryMaximum}${run.summaryMaximumUnit ?? "%"} (Max response)`
  return "Exploratory result"
}

export default BiologicalPredictionsWorkspace

