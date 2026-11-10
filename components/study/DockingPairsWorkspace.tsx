"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  Check,
  Cpu,
  ExternalLink,
  History,
  Play,
  RotateCcw,
  Search,
  X,
} from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { AskAiLink } from "@/components/ai/ask-ai-link"
import dynamic from "next/dynamic"
import { useStudy } from "@/components/providers/StudyProvider"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { PhytochemicalAnalysisViewToggle } from "@/components/study/PhytochemicalAnalysisViewToggle"
import { TeaFormulationCombinedPanel } from "@/components/study/TeaFormulationCombinedPanel"
import { usePhytochemicalAnalysisView } from "@/components/study/usePhytochemicalAnalysisView"
import { buildCombinedDockingResultRows } from "@/lib/phytochemicals/analysisView"
import { readStudyUiPrefs, writeStudyUiPrefs } from "@/lib/workflow/studyUiPrefs"
import {
  canonicalDockingPairDocId,
  type Compound,
  type DockingRun,
  type Protein,
  type SkippedDockingPair,
} from "@/lib/domain/models"
import { dockingPairStatus, type DockingPairStatus } from "@/lib/docking/pairStatus"
import {
  dockingProfileReport,
  dockingSystemLabels,
  dockingUnavailableText,
  isCompleteDockingProfile,
  profileSpecForProtein,
} from "@/lib/docking/profiles"

const DockedPoseViewer = dynamic(
  () => import("@/components/study/DockedPoseViewer").then((m) => m.DockedPoseViewer),
  { ssr: false, loading: () => <div className="h-[320px] flex items-center justify-center text-xs text-slate-400">Loading 3D docked pose…</div> }
)

import { DeferredProteinViewer } from "@/components/study/DeferredMolecularViewer"
import { listCompounds, listProteins } from "@/lib/repositories/researchDataRepository"
import { getDockingRun, listAdmetRuns, listDockingOutcomes, reopenDockingPair, skipDockingPair } from "@/lib/repositories/scientificRunRepository"
import { screenedCompoundIds } from "@/lib/adme/service"
import { DOCKING_FAILED, DOCKING_SERVICE_UNAVAILABLE, researcherDockingError } from "@/services/docking/types"

export interface DockingPairView {
  id: string
  compound: Compound
  protein: Protein
  run?: DockingRun // latest completed run
  runs: DockingRun[] // all runs for this pair, sorted newest first
  skip?: SkippedDockingPair
}

interface JobView {
  compoundId: string
  proteinId: string
  status: "waiting" | "preparing" | "running" | "completed" | "failed"
  stage: string | null
  error: string | null
}

interface EngineView {
  available: boolean
  message: string
  missing: string[]
}

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "ready", label: "Ready to run" },
  { id: "skipped", label: "Skipped" },
] as const

type StatusFilterId = (typeof STATUS_FILTERS)[number]["id"]

export interface DockingPairsWorkspaceProps {
  onBackAction?: () => void
  onContinueAction?: () => void
  onChangedAction?: () => void
  continueDisabled?: boolean
  checking?: boolean
  missing?: string[]
  checkError?: string | null
}

export function DockingPairsWorkspace({
  onBackAction,
  onContinueAction,
  onChangedAction,
  continueDisabled = false,
  checking = false,
  missing = [],
  checkError = null,
}: DockingPairsWorkspaceProps) {
  const handleBack = onBackAction ?? (() => {})
  const handleContinue = onContinueAction ?? (() => {})
  const handleChanged = onChangedAction ?? (() => {})
  const { user, loading: authLoading } = useAuth()
  const { activeStudy, loading: studyLoading } = useStudy()
  const studyId = activeStudy?.id ?? null
  const activeStudyRef = useRef(activeStudy)
  activeStudyRef.current = activeStudy
  const { viewMode, setViewMode } = usePhytochemicalAnalysisView(studyId)
  /** All Research Setup phytochemicals for this study (tea formulation composition). */
  const [studyCompounds, setStudyCompounds] = useState<Compound[]>([])
  /** Docking-eligible subset (screened). Used for pair execution only. */
  const [compounds, setCompounds] = useState<Compound[]>([])
  const [excludedCompounds, setExcludedCompounds] = useState<Compound[]>([])
  const [proteins, setProteins] = useState<Protein[]>([])
  const [runs, setRuns] = useState<DockingRun[]>([])
  const [runsByPair, setRunsByPair] = useState<Record<string, DockingRun[]>>({})
  const [skips, setSkips] = useState<SkippedDockingPair[]>([])
  const [jobs, setJobs] = useState<JobView[]>([])
  const [engine, setEngine] = useState<EngineView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const uiPrefs = readStudyUiPrefs(studyId, "docking", { pairId: "", query: "", filter: "all" as StatusFilterId })
  const [pairId, setPairId] = useState(String(uiPrefs.pairId ?? ""))
  const [query, setQuery] = useState(String(uiPrefs.query ?? ""))
  const [filter, setFilter] = useState<StatusFilterId>((uiPrefs.filter as StatusFilterId) || "all")
  const [mobilePane, setMobilePane] = useState<"library" | "detail">("library")
  const [showPicked, setShowPicked] = useState(false)
  const [confirmSkipId, setConfirmSkipId] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)

  useEffect(() => {
    writeStudyUiPrefs(studyId, "docking", { pairId, query, filter })
  }, [studyId, pairId, query, filter])

  const load = useCallback(async (options?: { soft?: boolean }) => {
    if (authLoading || studyLoading || !user) return
    const study = activeStudyRef.current
    if (!study) return
    const generation = ++loadGenerationRef.current
    setError(null)
    if (!options?.soft) setLoading(true)
    try {
      const [compoundRows, proteinRows, outcomes, admetRuns] = await Promise.all([
        listCompounds(study.id),
        listProteins(study.id),
        listDockingOutcomes(study.id).catch((err) => {
          console.warn("[Docking] listDockingOutcomes catch:", err)
          return {
            completed: [] as DockingRun[],
            skipped: [] as SkippedDockingPair[],
            allRuns: [] as DockingRun[],
            runsByPair: {} as Record<string, DockingRun[]>,
            pairs: [],
          }
        }),
        listAdmetRuns(study.id).catch(() => [] as any),
      ])
      if (generation !== loadGenerationRef.current) return
      const readyIds = new Set(screenedCompoundIds(compoundRows.map((c) => c.id), admetRuns))
      const eligible = compoundRows.filter((c) => readyIds.has(c.id))
      const omitted = compoundRows.filter((c) => !readyIds.has(c.id))
      // Combined tea view must use every Research Setup selection; docking runs only the eligible subset.
      setStudyCompounds(compoundRows)
      setCompounds(eligible.length > 0 ? eligible : compoundRows)
      setExcludedCompounds(eligible.length > 0 ? omitted : [])
      setProteins(proteinRows)
      setRuns(outcomes.completed)
      setRunsByPair(outcomes.runsByPair || {})
      setSkips(outcomes.skipped)
    } catch {
      if (generation !== loadGenerationRef.current) return
      setError("Unable to load docking history.")
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false)
    }
  }, [authLoading, studyLoading, user, studyId])

  const refreshJobs = useCallback(async () => {
    if (!studyId || !user) return
    try {
      const response = await fetch(`/api/scientific/docking/jobs?studyId=${encodeURIComponent(studyId)}`, {
        credentials: "same-origin",
      })
      if (!response.ok) return
      const body = (await response.json()) as { jobs?: JobView[] }
      setJobs(body.jobs ?? [])
    } catch {
      // non-fatal job polling error
    }
  }, [studyId, user])

  const refreshEngine = useCallback(async () => {
    if (!user) return
    try {
      const response = await fetch("/api/scientific/docking/engine", {
        credentials: "same-origin",
      })
      if (!response.ok) {
        setEngine({ available: false, message: DOCKING_SERVICE_UNAVAILABLE, missing: [] })
        return
      }
      setEngine((await response.json()) as EngineView)
    } catch {
      setEngine({ available: false, message: DOCKING_SERVICE_UNAVAILABLE, missing: [] })
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && !studyLoading && user && studyId) {
      void load()
    }
  }, [load, authLoading, studyLoading, user, studyId])

  useEffect(() => {
    if (user) {
      void refreshEngine()
    }
  }, [refreshEngine, user])

  useEffect(() => {
    if (user && studyId) {
      void refreshJobs()
    }
  }, [refreshJobs, user, studyId])

  const notifyChanged = useRef(handleChanged)
  notifyChanged.current = handleChanged
  const activeJob = jobs.some((job) => job.status === "waiting" || job.status === "preparing" || job.status === "running")
  useEffect(() => {
    if (!activeJob) return
    const timer = setInterval(() => {
      void refreshJobs()
        .then(() => load({ soft: true }))
        .then(() => notifyChanged.current())
    }, 2000)
    return () => clearInterval(timer)
  }, [activeJob, load, refreshJobs])

  // Build canonical unique docking pairs
  const pairs = useMemo(
    () => buildPairs(compounds, proteins, runs, skips, runsByPair),
    [compounds, proteins, runs, skips, runsByPair],
  )
  const completed = pairs.filter((pair) => pairStatus(pair, jobFor(pair, jobs)) === "COMPLETED").length
  const skipped = pairs.filter((pair) => pairStatus(pair, jobFor(pair, jobs)) === "SKIPPED").length
  const resolved = pairs.filter((pair) => {
    const status = pairStatus(pair, jobFor(pair, jobs))
    return status === "COMPLETED" || status === "SKIPPED"
  }).length
  const readyPairs = pairs.filter((pair) => dockingProfileReport(pair.protein).ready)
  const setupPairs = pairs.filter((pair) => !dockingProfileReport(pair.protein).ready)
  const runnable = readyPairs.filter((pair) => canRun(pair, jobs))
  const setupTargets = useMemo(() => {
    const seen = new Map<string, DockingPairView["protein"]>()
    for (const pair of setupPairs) seen.set(pair.protein.id, pair.protein)
    return [...seen.values()]
  }, [setupPairs])
  const skipTarget = setupTargets.find((protein) => protein.id === confirmSkipId) ?? null

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pairs.filter((pair) => {
      const line = statusLine(pair, jobFor(pair, jobs))
      if (filter === "completed" && line.status !== "COMPLETED") return false
      if (filter === "ready" && (line.status === "COMPLETED" || line.status === "SKIPPED")) return false
      if (filter === "skipped" && line.status !== "SKIPPED") return false
      if (!q) return true
      return `${pair.compound.name} ${pair.protein.name} ${pair.protein.gene ?? ""}`.toLowerCase().includes(q)
    })
  }, [pairs, filter, query, jobs])

  const selected = useMemo(() => {
    if (pairId) {
      const match = pairs.find((pair) => pair.id === pairId)
      if (match) return match
    }
    return visible[0] ?? pairs[0] ?? null
  }, [pairs, visible, pairId])

  useEffect(() => {
    if (selected && pairId !== selected.id) {
      setPairId(selected.id)
    }
  }, [pairId, selected])

  async function start(scope: { compoundId: string; proteinId: string } | Array<{ compoundId: string; proteinId: string }>) {
    if (!activeStudy || !user) return
    const pairsToRun = (Array.isArray(scope) ? scope : [scope]).filter((item) => {
      const protein = proteins.find((row) => row.id === item.proteinId)
      return protein ? dockingProfileReport(protein).ready : false
    })
    if (!pairsToRun.length) return
    setBusy(true)
    setError(null)
    try {
      const rejected: string[] = []
      for (const pair of pairsToRun) {
        const response = await fetch("/api/scientific/docking/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ studyId: activeStudy.id, ...pair }),
        })
        const body = (await response.json()) as { error?: string; rejected?: string[] }
        if (!response.ok) rejected.push(researcherDockingError(body.error || DOCKING_FAILED))
        rejected.push(...(body.rejected ?? []).map((item) => researcherDockingError(item)))
      }
      if (rejected[0]) setError(rejected[0])
      await refreshJobs()
      handleChanged()
    } catch (reason) {
      setError(researcherDockingError(reason instanceof Error ? reason.message : DOCKING_FAILED))
    } finally {
      setBusy(false)
    }
  }

  async function skipForStudy(protein: Protein) {
    if (!activeStudy || !user) return
    setBusy(true)
    setError(null)
    try {
      const pending = pairs.filter((pair) => pair.protein.id === protein.id && !pair.run && !pair.skip)
      for (const pair of pending) {
        await skipDockingPair(
          activeStudy.id,
          { id: user.uid },
          {
            compoundId: pair.compound.id,
            compoundName: pair.compound.name,
            proteinId: pair.protein.id,
            targetName: pair.protein.name,
          },
        )
      }
      setConfirmSkipId(null)
      await load()
      handleChanged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This target could not be skipped.")
    } finally {
      setBusy(false)
    }
  }

  async function reopenSelected() {
    if (!activeStudy || !user || !selected?.skip) return
    setBusy(true)
    setError(null)
    try {
      await reopenDockingPair(activeStudy.id, selected.skip.id, { id: user.uid })
      await load()
      handleChanged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This docking pair could not be reopened.")
    } finally {
      setBusy(false)
    }
  }

  const isCompleteStudy = completed === pairs.length && pairs.length > 0

  return (
    <div className="nano-setup">
      {/* Intro Header matching Research Setup */}
      <header className="nano-setup-intro nano-setup-intro--compact">
        <div className="nano-setup-intro-copy">
          <span className="nano-setup-mark" aria-hidden>
            <Cpu size={18} strokeWidth={1.85} />
          </span>
          <div>
            <p className="nano-setup-kicker">03 · Molecular Docking</p>
            <div className="nano-setup-intro-line">
              <h1 className="nano-setup-title">Molecular Docking</h1>
              <span className="nano-study-status" data-status={isCompleteStudy ? "active" : "draft"}>
                {isCompleteStudy ? "Completed" : "In progress"}
              </span>
            </div>
            <p className="nano-setup-lead">Selected phytochemicals and targets are docked with AutoDock Vina.</p>
            <AskAiLink context="docking" />
            {!loading && studyCompounds.length > 0 ? (
              <PhytochemicalAnalysisViewToggle
                mode={viewMode}
                onChange={setViewMode}
                compoundCount={studyCompounds.length}
              />
            ) : null}
          </div>
        </div>
        <div className="nano-setup-progress" aria-live="polite">
          <p className="nano-setup-progress-label">{loading ? "Loading" : `${pairs.length} docking pairs`}</p>
          <p className="nano-setup-progress-value">
            {loading ? (
              "Checking"
            ) : skipped > 0 ? (
              <>
                <span>{resolved}</span>
                <span>of {pairs.length} resolved</span>
              </>
            ) : (
              <>
                <span>{completed}</span>
                <span>of {pairs.length} completed</span>
              </>
            )}
          </p>
          {!loading && skipped > 0 ? (
            <p className="nano-setup-progress-label">
              {completed} completed · {skipped} skipped
            </p>
          ) : null}
        </div>
      </header>

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
      {engine && !engine.available ? (
        <p className="nano-studies-alert" role="status">
          {DOCKING_SERVICE_UNAVAILABLE}{" "}
          <button type="button" onClick={() => void refreshEngine()}>
            Retry
          </button>
        </p>
      ) : null}

      {loading ? (
        <p className="nano-studies-empty">Loading docking pairs…</p>
      ) : pairs.length === 0 ? (
        <div className="nano-studies-empty">
          <p>This study needs a selected phytochemical and a target protein before docking pairs can be created.</p>
          <button type="button" className="phyto-back" onClick={handleBack}>
            <ArrowLeft size={15} aria-hidden />
            In-Silico Screening
          </button>
        </div>
      ) : (
        <div className="phyto">
          {excludedCompounds.length > 0 ? (
            <div
              style={{
                background: "rgba(59, 130, 246, 0.08)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                borderRadius: "8px",
                padding: "8px 12px",
                marginBottom: "0.75rem",
                fontSize: "12px",
                color: "#93c5fd",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <span>
                Carrying forward <strong>{compounds.length}</strong> docking-ready phytochemical{compounds.length > 1 ? "s" : ""}.
                {" "}{excludedCompounds.length} compound{excludedCompounds.length > 1 ? "s are" : " is"} excluded ({excludedCompounds.map((c) => c.name).join(", ")}) because screening is pending or incomplete.
              </span>
              <button
                type="button"
                onClick={handleBack}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(147, 197, 253, 0.4)",
                  color: "#93c5fd",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "11px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                In-Silico Screening
              </button>
            </div>
          ) : null}
          <div className="phyto-workspace" data-pane={mobilePane}>
            {/* LEFT LIBRARY: Matching PhytochemicalBrowser & ProteinBrowser */}
            <aside className="phyto-library">
              <header className="phyto-library-head">
                <div>
                  <p className="phyto-library-kicker">Library</p>
                  <h2>Docking pairs</h2>
                </div>
                <div className="phyto-selection-summary" aria-live="polite">
                  <p className="phyto-count">
                    <span>{pairs.length}</span>
                    <small>pairs</small>
                  </p>
                  {pairs.length > 0 ? (
                    <>
                      <span data-ready="true">✓ {completed} completed</span>
                      {runnable.length > 0 ? <span data-ready="false">⚠ {runnable.length} ready to run</span> : null}
                    </>
                  ) : null}
                </div>
              </header>

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
                  title="Return to In-Silico Screening"
                >
                  ← In-Silico Screening
                </button>
                {runnable.length > 0 ? (
                  <button
                    type="button"
                    disabled={busy || activeJob || engine?.available === false}
                    onClick={() =>
                      void start(
                        runnable.map((p) => ({ compoundId: p.compound.id, proteinId: p.protein.id })),
                      )
                    }
                    style={{
                      background: "rgba(20, 184, 166, 0.16)",
                      border: "1px solid rgba(45, 212, 191, 0.4)",
                      color: "#5eead4",
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
                    <Play size={11} aria-hidden />
                    {activeJob ? "Running..." : `Run all ready (${runnable.length})`}
                  </button>
                ) : null}
              </div>

              <label className="phyto-search">
                <Search size={14} aria-hidden />
                <input
                  value={query}
                  placeholder="Search pairs, targets..."
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <div className="phyto-filters" role="tablist" aria-label="Docking status">
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
                {visible.map((pair, index) => {
                  const line = statusLine(pair, jobFor(pair, jobs))
                  const current = selected?.id === pair.id
                  const isDone = line.status === "COMPLETED"
                  const profile = profileSpecForProtein(pair.protein)
                  const isPredicted =
                    pair.protein.name.toUpperCase().includes("LATS1") ||
                    profile?.structureSource === "PREDICTED_STRUCTURE"

                  return (
                    <li
                      key={pair.id}
                      data-viewing={current ? "true" : "false"}
                      data-selected={isDone ? "true" : "false"}
                      data-tone={pair.protein.pathway || "signaling"}
                    >
                      <button
                        type="button"
                        className="phyto-row"
                        onClick={() => {
                          setPairId(pair.id)
                          setMobilePane("detail")
                        }}
                      >
                        <span className="phyto-row-mark" aria-hidden />
                        <span className="phyto-row-copy">
                          <span className="phyto-row-name">
                            {pair.compound.name} × {pair.protein.name}
                          </span>
                          <span className="phyto-row-sub">
                            <span className="phyto-row-class">
                              {profile?.actualDockingReceptor ?? profile?.dockingReceptor ?? pair.protein.name}
                            </span>
                            <span className="phyto-row-meta">
                              {isDone && line.affinity != null
                                ? `${formatNumber(line.affinity)} kcal/mol`
                                : isPredicted
                                  ? "AlphaFold DB"
                                  : pair.protein.pdbId
                                    ? `PDB ${pair.protein.pdbId}`
                                    : "AutoDock Vina"}
                            </span>
                            <span
                              className="phyto-row-meta"
                              style={{ color: isDone ? "#059669" : line.failed ? "#dc2626" : "#64748b", fontWeight: 500 }}
                            >
                              {isDone
                                ? "✓ Completed"
                                : line.status === "RUNNING"
                                  ? "Running simulation..."
                                  : line.status === "SKIPPED"
                                    ? "Skipped"
                                    : line.status === "FAILED"
                                      ? `✕ ${line.text}`
                                      : "✓ AutoDock Vina ready"}
                            </span>
                            {isPredicted ? (
                              <span
                                className="phyto-row-meta"
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(147, 51, 234, 0.12)",
                                  color: "#7e22ce",
                                  fontWeight: 600,
                                }}
                              >
                                Predicted structure
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                      <label
                        className="phyto-check"
                        title={
                          isDone
                            ? `${pair.compound.name} × ${pair.protein.name} completed (click to re-dock)`
                            : line.running
                              ? "Running simulation…"
                              : line.failed
                                ? `${line.text} (click to retry)`
                                : `Click to select and run docking for ${pair.compound.name} × ${pair.protein.name}`
                        }
                        onClick={(event) => {
                          event.stopPropagation()
                          setPairId(pair.id)
                          if (!line.running && !busy && !activeJob) {
                            if (!dockingProfileReport(pair.protein).ready) {
                              setError(dockingUnavailableText(pair.protein.name))
                              return
                            }
                            void start({ compoundId: pair.compound.id, proteinId: pair.protein.id })
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isDone}
                          disabled={line.running || busy || activeJob}
                          onChange={(event) => {
                            event.stopPropagation()
                            setPairId(pair.id)
                            if (!line.running && !busy && !activeJob) {
                              if (!dockingProfileReport(pair.protein).ready) {
                                setError(dockingUnavailableText(pair.protein.name))
                                return
                              }
                              void start({ compoundId: pair.compound.id, proteinId: pair.protein.id })
                            }
                          }}
                          aria-label={
                            isDone
                              ? `${pair.compound.name} × ${pair.protein.name} completed: checked (click to re-dock)`
                              : `Select and run docking for ${pair.compound.name} × ${pair.protein.name}: unchecked`
                          }
                        />
                        <span aria-hidden />
                      </label>
                    </li>
                  )
                })}
              </ul>

              {visible.length === 0 ? <p className="phyto-empty">No docking pairs match that filter.</p> : null}

              {/* Bottom Selected / Progress Bar matching Research Setup */}
              <div className="phyto-picked">
                <div className="phyto-picked-bar">
                  <p>
                    Completed · {completed} of {pairs.length}
                  </p>
                  {runnable.length > 0 ? (
                    <button
                      type="button"
                      disabled={busy || activeJob || engine?.available === false}
                      onClick={() =>
                        void start(
                          runnable.map((p) => ({ compoundId: p.compound.id, proteinId: p.protein.id })),
                        )
                      }
                      style={{ color: "#2dd4bf", fontWeight: 600 }}
                    >
                      {activeJob ? "Running..." : `Run all ready (${runnable.length})`}
                    </button>
                  ) : null}
                </div>
                {completed === 0 ? (
                  <p className="phyto-picked-empty">No completed pairs yet</p>
                ) : (
                  <>
                    {completed > 3 ? (
                      <button
                        type="button"
                        onClick={() => setShowPicked((prev) => !prev)}
                        style={{ background: "transparent", border: 0, color: "#93a4b5", fontSize: "11px", padding: 0, cursor: "pointer", marginTop: "2px" }}
                      >
                        {showPicked ? "Hide completed list" : `View ${completed} completed`}
                      </button>
                    ) : null}
                    {(showPicked || completed <= 3) ? (
                      <ul>
                        {pairs
                          .filter((p) => p.run)
                          .map((p) => (
                            <li key={p.id}>
                              <span>
                                {p.compound.name} × {p.protein.name} ({formatNumber(p.run?.bestBindingAffinityKcalMol)} kcal/mol)
                              </span>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            </aside>

            {/* RIGHT DETAIL: Individual pair or combined tea formulation */}
            {viewMode === "combined" ? (
              <TeaFormulationCombinedPanel
                stageLabel="molecular docking"
                compounds={studyCompounds.map((row) => ({
                  id: row.id,
                  name: row.name,
                  pubchemCid: row.pubchemCid,
                  formula: row.formula,
                  chemicalClass: row.chemicalClass,
                  smiles: row.smiles,
                }))}
                resultRows={buildCombinedDockingResultRows({
                  studyCompounds: studyCompounds.map((row) => ({ id: row.id, name: row.name })),
                  proteins: proteins.map((row) => ({ id: row.id, name: row.name, gene: row.gene })),
                  eligibleCompoundIds: new Set(compounds.map((row) => row.id)),
                  pairs: pairs.map((pair) => {
                    const status = pairStatus(pair, jobFor(pair, jobs))
                    const affinityLabel =
                      pair.run?.bestBindingAffinityKcalMol != null && Number.isFinite(pair.run.bestBindingAffinityKcalMol)
                        ? `${formatNumber(pair.run.bestBindingAffinityKcalMol)} kcal/mol`
                        : status === "SKIPPED"
                          ? "Skipped"
                          : status === "COMPLETED"
                            ? "Completed (affinity unavailable)"
                            : status === "UNAVAILABLE"
                              ? "Docking unavailable"
                              : "Not yet docked"
                    return {
                      compoundId: pair.compound.id,
                      proteinId: pair.protein.id,
                      proteinName: pair.protein.name,
                      proteinGene: pair.protein.gene,
                      affinityLabel,
                      statusLabel: status,
                      detail: `Pair ${pair.compound.name} × ${pair.protein.name} · status ${status}`,
                    }
                  }),
                })}
                onInspectCompound={(compoundId) => {
                  const first = pairs.find((pair) => pair.compound.id === compoundId)
                  if (first) {
                    setPairId(first.id)
                    setViewMode("individual")
                    setMobilePane("detail")
                    return
                  }
                  // Unscreened formulation members are still listed; open In-Silico for that compound via individual list fallback.
                  setViewMode("individual")
                  setMobilePane("library")
                }}
              />
            ) : selected ? (
              <PairDetail
                key={selected.id}
                pair={selected}
                job={jobFor(selected, jobs)}
                busy={busy || activeJob}
                onBack={() => setMobilePane("library")}
                onRetry={() => {
                  if (!dockingProfileReport(selected.protein).ready) {
                    setError(dockingUnavailableText(selected.protein.name))
                    return
                  }
                  void start({ compoundId: selected.compound.id, proteinId: selected.protein.id })
                }}
                onSkip={() => setConfirmSkipId(selected.protein.id)}
                onReopen={() => void reopenSelected()}
              />
            ) : null}
          </div>

          <footer className="phyto-nav" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="phyto-back" onClick={handleBack}>
              <ArrowLeft size={15} aria-hidden />
              In-Silico Screening
            </button>
            <button type="button" className="phyto-continue" disabled={continueDisabled || loading} onClick={handleContinue}>
              {checking ? "Checking…" : "Continue to Biological Predictions"}
              <ArrowRight size={15} aria-hidden />
            </button>
          </footer>
        </div>
      )}

      {missing[0] ? (
        <p className="nano-setup-note" role="status">
          {missing[0]}
        </p>
      ) : null}

      {skipTarget ? (
        <div className="nano-modal-back" role="presentation">
          <div className="nano-modal" role="dialog" aria-modal="true" aria-labelledby="skip-pair-title">
            <h2 id="skip-pair-title">Skip {skipTarget.name} for this study?</h2>
            <p>
              This target has no AutoDock Vina profile that can run. No docking affinity will be generated. The reason
              will be recorded, and completed results for other targets stay unchanged.
            </p>
            <div className="nano-modal-form">
              <button type="button" className="phyto-back" disabled={busy} onClick={() => setConfirmSkipId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="phyto-continue"
                disabled={busy}
                onClick={() => void skipForStudy(skipTarget)}
              >
                {busy ? "Saving…" : "Skip for this study"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PairDetail({
  pair,
  job,
  busy,
  onBack,
  onRetry,
  onSkip,
  onReopen,
}: {
  pair: DockingPairView
  job?: JobView
  busy: boolean
  onBack: () => void
  onRetry: () => void
  onSkip: () => void
  onReopen: () => void
}) {
  const line = statusLine(pair, job)
  const profile = profileSpecForProtein(pair.protein)
  const system =
    profile && isCompleteDockingProfile(profile)
      ? dockingSystemLabels({
          name: pair.protein.name,
          pathway: pair.protein.pathway,
          biologicalTarget: pair.protein.biologicalTarget,
          spec: profile,
        })
      : null

  const isLats1 = pair.protein.name.toUpperCase().includes("LATS1") || profile?.id === "LATS1_PROFILE"
  const isYap1 = pair.protein.name.toUpperCase().includes("YAP1") || profile?.id === "YAP1_PROFILE"

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const baseRun = (selectedRunId ? pair.runs.find((r) => r.id === selectedRunId) : null) ?? pair.run
  const [detailedRun, setDetailedRun] = useState<DockingRun | null>(null)

  useEffect(() => {
    if (!baseRun?.id || baseRun.poseModel) {
      setDetailedRun(null)
      return
    }
    let active = true
    getDockingRun(pair.protein.studyId, baseRun.id).then((full) => {
      if (active && full) setDetailedRun(full)
    })
    return () => {
      active = false
    }
  }, [baseRun?.id, baseRun?.poseModel, pair.protein.studyId])

  const activeRun = detailedRun || baseRun

  const isPredicted = isLats1 || activeRun?.structureSource === "PREDICTED_STRUCTURE" || Boolean(activeRun?.structureId?.startsWith("AF-"))
  const displayStructureId = isPredicted
    ? "AF-O95835-F1"
    : activeRun?.structureId ?? activeRun?.receptorPdbId ?? profile?.pdbId ?? pair.protein.pdbId ?? ""

  return (
    <article className="phyto-detail">
      {/* Mobile Back Button */}
      <button type="button" className="phyto-mobile-back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden />
        Library
      </button>

      {/* Hero Header */}
      <header className="phyto-hero">
        <div>
          <p className="phyto-kicker" data-tone={pair.protein.pathway || "signaling"}>
            <Atom size={13} aria-hidden />
            {profile?.actualDockingReceptor ?? profile?.dockingReceptor ?? pair.protein.name}
          </p>
          <h2>
            {pair.compound.name} × {pair.protein.name}
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {line.status === "COMPLETED" ? <EvidenceBadge type="PREDICTED" /> : null}

          <button
            type="button"
            className="phyto-select"
            data-on={line.status === "COMPLETED" ? "true" : "false"}
            disabled={busy || line.running}
            onClick={line.status === "COMPLETED" ? onRetry : line.status === "SKIPPED" ? onReopen : onRetry}
          >
            {line.status === "COMPLETED" ? (
              <>
                <Check size={14} aria-hidden />
                Completed
              </>
            ) : line.running ? (
              <>
                <span className="adme-spin" aria-hidden />
                Running...
              </>
            ) : line.status === "SKIPPED" ? (
              <>
                <RotateCcw size={14} aria-hidden />
                Reopen Pair
              </>
            ) : line.failed ? (
              <>
                <RotateCcw size={14} aria-hidden />
                Retry Docking
              </>
            ) : (
              <>
                <Play size={14} aria-hidden />
                Run Docking
              </>
            )}
          </button>
        </div>
      </header>

      {/* DOCKING FAILURE / RECOVERY NOTICE */}
      {line.failed ? (
        <div style={{ marginTop: "0.85rem", padding: "0.75rem 0.9rem", borderRadius: "8px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#b91c1c", fontSize: "13px" }}>
          <strong style={{ display: "block", color: "#991b1b", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
            Docking Execution Notice
          </strong>
          {line.text}. Click &ldquo;Retry Docking&rdquo; to rerun AutoDock Vina for this pair.
        </div>
      ) : null}

      {/* LATS1 SPECIAL NOTICE */}
      {isLats1 ? (
        <div style={{ marginTop: "0.85rem", padding: "0.75rem 0.9rem", borderRadius: "8px", background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#5b21b6", fontSize: "13px" }}>
          <strong style={{ display: "block", color: "#4c1d95", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
            Predicted Receptor Structure (AlphaFold DB)
          </strong>
          This docking profile uses the predicted structural model of the human LATS1 kinase domain from AlphaFold DB (AF-O95835-F1). It does not use an experimental PDB crystal structure.
        </div>
      ) : null}

      {/* YAP1 SPECIAL NOTICE */}
      {isYap1 ? (
        <div style={{ marginTop: "0.85rem", padding: "0.75rem 0.9rem", borderRadius: "8px", background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1", fontSize: "13px" }}>
          <strong style={{ display: "block", color: "#0c4a6e", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
            TEAD1 Receptor (Hippo–YAP Signaling Interface)
          </strong>
          Research target is YAP1 / Hippo–YAP signaling. The actual docking receptor is the TEAD1 YAP-binding domain in PDB 3KYS (palmitate pocket). This measures binding to the YAP–TEAD interface complex, not direct binding to isolated monomeric YAP1.
        </div>
      ) : null}

      {/* 3-Column Identity Cards matching Research Setup */}
      <ul className="phyto-identity">
        <li>
          <span>Ligand</span>
          <strong>{pair.compound.name}</strong>
        </li>
        <li>
          <span>Receptor</span>
          <strong>{pair.protein.name} ({displayStructureId})</strong>
        </li>
        <li>
          <span>Affinity</span>
          <strong>{activeRun ? `${formatNumber(activeRun.bestBindingAffinityKcalMol)} kcal/mol` : "Pending"}</strong>
        </li>
      </ul>

      {/* Live Simulation Progress (if running) */}
      {line.running ? (
        <div className="adme-progress" aria-live="polite" style={{ marginTop: "1rem" }}>
          <div className="adme-running">
            <p className="adme-pulse">RUNNING AUTODOCK VINA</p>
            <strong>{activityLabel(job ?? { compoundId: pair.compound.id, proteinId: pair.protein.id, status: "running", stage: null, error: null })}</strong>
          </div>
          <ol className="adme-stages">
            <li data-state={isStagePassed(job?.stage, "Preparing ligand") ? "done" : job?.stage === "Preparing ligand" ? "active" : "waiting"}>
              {isStagePassed(job?.stage, "Preparing ligand") ? <Check size={14} aria-hidden /> : job?.stage === "Preparing ligand" ? <span className="adme-spin" aria-hidden /> : <span className="adme-wait" aria-hidden />}
              <span>Preparing ligand</span>
            </li>
            <li data-state={isStagePassed(job?.stage, "Preparing receptor") ? "done" : job?.stage === "Preparing receptor" ? "active" : "waiting"}>
              {isStagePassed(job?.stage, "Preparing receptor") ? <Check size={14} aria-hidden /> : job?.stage === "Preparing receptor" ? <span className="adme-spin" aria-hidden /> : <span className="adme-wait" aria-hidden />}
              <span>Preparing receptor</span>
            </li>
            <li data-state={isStagePassed(job?.stage, "Generating PDBQT") ? "done" : job?.stage === "Generating PDBQT" ? "active" : "waiting"}>
              {isStagePassed(job?.stage, "Generating PDBQT") ? <Check size={14} aria-hidden /> : job?.stage === "Generating PDBQT" ? <span className="adme-spin" aria-hidden /> : <span className="adme-wait" aria-hidden />}
              <span>Generating PDBQT</span>
            </li>
            <li data-state={isStagePassed(job?.stage, "Running AutoDock Vina") ? "done" : job?.stage === "Running AutoDock Vina" ? "active" : "waiting"}>
              {isStagePassed(job?.stage, "Running AutoDock Vina") ? <Check size={14} aria-hidden /> : job?.stage === "Running AutoDock Vina" ? <span className="adme-spin" aria-hidden /> : <span className="adme-wait" aria-hidden />}
              <span>Running AutoDock Vina</span>
            </li>
            <li data-state={job?.stage === "Completed" ? "done" : job?.stage === "Processing results" ? "active" : "waiting"}>
              {job?.stage === "Completed" ? <Check size={14} aria-hidden /> : job?.stage === "Processing results" ? <span className="adme-spin" aria-hidden /> : <span className="adme-wait" aria-hidden />}
              <span>Parsing results</span>
            </li>
          </ol>
        </div>
      ) : null}

      {/* OVERVIEW SECTION: 3D Structure & Docking Facts Split */}
      <div className="phyto-overview">
        <section className="phyto-stage">
          <h3>{activeRun ? "3D docked pose & binding site" : "3D protein receptor structure"}</h3>
          {activeRun?.poseModel && (displayStructureId || pair.protein.pdbId) ? (
            <DockedPoseViewer pdbId={displayStructureId.trim()} pose={activeRun.poseModel} searchBox={activeRun.searchBox} />
          ) : isLats1 ? (
            <DeferredProteinViewer key="LATS1_AF" pdbId="LATS1_AF" name={pair.protein.name} height={320} quiet />
          ) : pair.protein.pdbId ? (
            <DeferredProteinViewer key={pair.protein.pdbId} pdbId={pair.protein.pdbId} name={pair.protein.name} height={320} quiet />
          ) : (
            <p className="phyto-missing">This pair has no 3D structure available.</p>
          )}
        </section>

        <section>
          <h3>Docking overview</h3>
          <dl className="phyto-facts">
            <Fact label="Ligand" value={pair.compound.name} />
            <Fact label="PubChem CID" value={pair.compound.pubchemCid != null ? String(pair.compound.pubchemCid) : undefined} />
            <Fact label="Biological target" value={system?.researchTarget ?? pair.protein.name} />
            <Fact
              label="Docking receptor"
              value={profile?.actualDockingReceptor ?? profile?.dockingReceptor ?? pair.protein.name}
            />
            <Fact label="Structure" value={isPredicted ? `AlphaFold DB ${displayStructureId}` : `PDB ${displayStructureId}`} />
            <Fact label="Binding site" value={profile?.bindingSiteLabel ?? "Curated verified pocket"} />
            <Fact label="Best affinity" value={activeRun ? `${formatNumber(activeRun.bestBindingAffinityKcalMol)} kcal/mol` : undefined} />
            <Fact
              label="Status"
              value={
                line.status === "COMPLETED"
                  ? "Completed"
                  : line.status === "RUNNING"
                    ? "Running AutoDock Vina"
                    : line.status === "SKIPPED"
                      ? "Skipped"
                      : line.status === "FAILED"
                        ? `Failed (${line.text})`
                        : "Ready to run"
              }
            />
          </dl>
        </section>
      </div>

      {/* DOCKING MODES BLOCK */}
      <section className="phyto-block">
        <h3>AutoDock Vina docking modes</h3>
        <p className="phyto-caption">
          AutoDock Vina simulated binding modes, calculated binding energies, and coordinates.
        </p>

        {activeRun ? (
          <>
            <div className="dock-table-wrap">
              <table className="dock-table">
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>Affinity</th>
                    <th>RMSD lower</th>
                    <th>RMSD upper</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRun.modes.map((mode) => (
                    <tr key={mode.mode} data-best={mode.mode === 1 ? "true" : undefined}>
                      <td>Mode {mode.mode}</td>
                      <td>
                        <strong>{formatNumber(mode.affinityKcalMol)} kcal/mol</strong>
                      </td>
                      <td>{mode.rmsdLowerBound == null ? "0.000" : formatNumber(mode.rmsdLowerBound)}</td>
                      <td>{mode.rmsdUpperBound == null ? "0.000" : formatNumber(mode.rmsdUpperBound)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="phyto-adme" style={{ marginTop: "0.75rem" }}>
              <span>Best Binding Affinity</span>
              <strong data-mark="pass">{formatNumber(activeRun.bestBindingAffinityKcalMol)} kcal/mol</strong>
            </div>

            {activeRun.interactions && activeRun.interactions.length > 0 ? (
              <div style={{ marginTop: "1rem" }}>
                <h4 style={{ fontSize: "12.5px", fontWeight: 700, margin: "0 0 0.4rem", color: "#334155" }}>
                  Key Residue Interactions
                </h4>
                <ul className="dock-interactions">
                  {activeRun.interactions.map((interaction) => (
                    <li key={`${interaction.residue}-${interaction.interactionType}`}>
                      <strong>{interaction.residue}</strong>
                      <span>{interaction.interactionType}</span>
                      <em>{interaction.distanceAngstrom != null ? `${formatNumber(interaction.distanceAngstrom)} Å` : "—"}</em>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : line.status === "SKIPPED" ? (
          <p className="dock-note">Docking was skipped for this target in this study. {pair.skip?.reason}</p>
        ) : line.status === "UNAVAILABLE" ? (
          <div className="phyto-unavailable">
            <p>{dockingUnavailableText(pair.protein.name)}</p>
            <button type="button" className="phyto-retry" disabled={busy} onClick={onSkip}>
              Skip for this study
            </button>
          </div>
        ) : (
          <div style={{ marginTop: "0.6rem" }}>
            <p className="dock-note">
              Simulation has not run for this pair yet. Click &ldquo;Run Docking&rdquo; to simulate binding modes.
            </p>
            <button
              type="button"
              className="phyto-select"
              data-on="true"
              disabled={busy || line.running}
              onClick={onRetry}
              style={{ marginTop: "0.35rem" }}
            >
              <Play size={13} aria-hidden />
              Run Docking
            </button>
          </div>
        )}
      </section>

      {/* DOCKING CONFIGURATION BLOCK */}
      <section className="phyto-block">
        <h3>Docking configuration & Receptor properties</h3>
        <p className="phyto-caption">Curated AutoDock Vina search box and structure metadata.</p>
        <dl className="phyto-props">
          <Prop label="Research target" value={system?.researchTarget ?? activeRun?.researchTarget ?? pair.protein.name} />
          <Prop
            label="Actual receptor"
            value={profile?.actualDockingReceptor ?? activeRun?.actualDockingReceptor ?? profile?.dockingReceptor ?? pair.protein.name}
          />
          <Prop label="Structure source" value={isPredicted ? "Predicted structure" : "Experimental structure"} />
          <Prop label="Model / PDB ID" value={isPredicted ? `AlphaFold DB ${displayStructureId}` : `PDB ${displayStructureId}`} />
          <Prop label="Reference entity" value={profile?.referenceEntityLabel ?? activeRun?.referenceEntity ?? "—"} />
          <Prop label="Binding site" value={profile?.bindingSiteLabel ?? activeRun?.bindingSiteSource ?? "Curated verified pocket"} />
          <Prop label="Method" value="AutoDock Vina" />
          <Prop label="Vina version" value={activeRun?.vinaVersion ?? "AutoDock Vina 1.2.5"} />
          <Prop
            label="Grid center"
            value={activeRun?.gridCenter ? `(${activeRun.gridCenter.x.toFixed(1)}, ${activeRun.gridCenter.y.toFixed(1)}, ${activeRun.gridCenter.z.toFixed(1)}) Å` : "Pre-configured pocket"}
          />
          <Prop
            label="Grid size"
            value={activeRun?.gridSize ? `(${activeRun.gridSize.x.toFixed(1)} × ${activeRun.gridSize.y.toFixed(1)} × ${activeRun.gridSize.z.toFixed(1)}) Å` : "20 × 20 × 20 Å"}
          />
          <Prop label="Profile ID" value={profile?.id ?? activeRun?.dockingProfileId ?? "Verified profile"} />
          <Prop
            label="Completed at"
            value={
              activeRun?.completedAt
                ? new Date(activeRun.completedAt).toLocaleString()
                : activeRun?.createdAt
                  ? new Date(activeRun.createdAt).toLocaleString()
                  : "—"
            }
          />
        </dl>
      </section>

      {/* SCIENTIFIC SOURCE BLOCK */}
      <section className="phyto-block">
        <h3>Scientific source</h3>
        <div className="phyto-source-card">
          <p>{isPredicted ? "AlphaFold DB" : "RCSB PDB"}</p>
          <p>
            {isPredicted
              ? `Predicted model record · ${displayStructureId}`
              : `Experimental crystal structure · PDB ${displayStructureId}`}
          </p>
          <a
            href={
              isPredicted
                ? "https://alphafold.ebi.ac.uk/entry/AF-O95835-F1"
                : `https://www.rcsb.org/structure/${displayStructureId}`
            }
            target="_blank"
            rel="noreferrer"
          >
            View source
            <ExternalLink size={12} aria-hidden />
          </a>
        </div>
      </section>
    </article>
  )
}

function Fact({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function Prop({ label, value }: { label: string; value?: string | React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  )
}

function isStagePassed(currentStage: string | null | undefined, stageName: string): boolean {
  if (!currentStage) return false
  const order = [
    "Preparing ligand",
    "Preparing receptor",
    "Generating PDBQT",
    "Running AutoDock Vina",
    "Processing results",
    "Completed",
  ]
  const currentIdx = order.indexOf(currentStage)
  const stageIdx = order.indexOf(stageName)
  return currentIdx > stageIdx
}

function buildPairs(
  compounds: Compound[],
  proteins: Protein[],
  runs: DockingRun[],
  skips: SkippedDockingPair[],
  runsByPair: Record<string, DockingRun[]> = {},
): DockingPairView[] {
  return [...compounds]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((compound) =>
      [...proteins]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((protein) => {
          const pairKey = canonicalDockingPairDocId(compound.id, protein.id)
          const pairRuns = (
            runsByPair[pairKey] ||
            runs.filter((run) => run.compoundId === compound.id && run.proteinId === protein.id)
          ).filter((run) => run.modes && run.modes.length > 0 && Number.isFinite(run.bestBindingAffinityKcalMol))

          pairRuns.sort((a, b) => {
            const timeA = a.completedAt || a.updatedAt || a.createdAt
            const timeB = b.completedAt || b.updatedAt || b.createdAt
            return timeB.localeCompare(timeA)
          })

          const latestRun = pairRuns[0]
          const skip = skips.find((s) => s.compoundId === compound.id && s.proteinId === protein.id)

          return {
            id: pairKey,
            compound,
            protein,
            run: latestRun,
            runs: pairRuns,
            skip,
          }
        }),
    )
}

function jobFor(pair: DockingPairView, jobs: JobView[]): JobView | undefined {
  return jobs.find((job) => job.compoundId === pair.compound.id && job.proteinId === pair.protein.id)
}

function canRun(pair: DockingPairView, jobs: JobView[]): boolean {
  if (pairStatus(pair, jobFor(pair, jobs)) === "SKIPPED") return false
  if (!dockingProfileReport(pair.protein).ready || pair.compound.pubchemCid == null) return false
  const job = jobFor(pair, jobs)
  if (job?.status === "waiting" || job?.status === "preparing" || job?.status === "running") return false
  return !pair.run
}

function pairStatus(pair: DockingPairView, job?: JobView): DockingPairStatus {
  return dockingPairStatus({
    completed: Boolean(pair.run),
    skipped: Boolean(pair.skip) && !pair.run,
    profileReady: dockingProfileReport(pair.protein).ready && pair.compound.pubchemCid != null,
    jobStatus: job?.status ?? null,
  })
}

function statusLine(
  pair: DockingPairView,
  job?: JobView,
): {
  text: string
  affinity?: number
  failed: boolean
  running: boolean
  unavailable: boolean
  status: DockingPairStatus
} {
  const status = pairStatus(pair, job)
  if (status === "PENDING" && job?.status === "waiting") {
    return { text: "Waiting...", failed: false, running: false, unavailable: false, status }
  }
  if (status === "RUNNING" && job) {
    return { text: activityLabel(job), failed: false, running: true, unavailable: false, status }
  }
  if (status === "COMPLETED" && pair.run) {
    return {
      text: "Completed",
      affinity: pair.run.bestBindingAffinityKcalMol,
      failed: false,
      running: false,
      unavailable: false,
      status,
    }
  }
  if (status === "SKIPPED") {
    return { text: "Skipped", failed: false, running: false, unavailable: false, status }
  }
  if (status === "FAILED") {
    return { text: researcherDockingError(job?.error || DOCKING_FAILED), failed: true, running: false, unavailable: false, status }
  }
  if (status === "UNAVAILABLE") {
    return {
      text: pair.compound.pubchemCid == null ? "Configuration unavailable" : dockingUnavailableText(pair.protein.name),
      failed: false,
      running: false,
      unavailable: pair.compound.pubchemCid != null,
      status,
    }
  }
  return { text: "Ready", failed: false, running: false, unavailable: false, status }
}

function activityLabel(job: JobView): string {
  if (job.status === "waiting") return "Waiting..."
  if (job.status === "running" || job.stage === "Running AutoDock Vina" || job.stage === "Processing results")
    return "Running AutoDock Vina..."
  if (job.stage === "Preparing ligand") return "Preparing ligand..."
  return "Preparing receptor..."
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value)
}
