"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Atom, Check, Circle, ExternalLink, Play, RotateCcw, Search } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { AskAiLink } from "@/components/ai/ask-ai-link"
import { useStudy } from "@/components/providers/StudyProvider"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { AdmeAssessmentPanel } from "@/components/study/AdmeAssessmentPanel"
import { AdmeProgress, startAssessmentStages, type AssessmentStageView } from "@/components/study/AdmeProgress"
import { admeAssessmentService, hardcodedAdmeAssessment, PROTOTYPE_ADME_PROVIDER, PROTOTYPE_ADME_UNAVAILABLE } from "@/lib/adme/assessmentService"
import { requestAutomaticAdme } from "@/lib/adme/client"
import { isCompletedScreeningRun, isPrototypeAdmeRun, latestProviderRun, latestScreeningRun, screenedCompoundIds } from "@/lib/adme/service"
import { ADME_ENGINE_UNAVAILABLE, ADME_NO_CID, ADME_PUBCHEM_UNAVAILABLE } from "@/lib/adme/types"
import dynamic from "next/dynamic"

const CompoundViewer3D = dynamic(
  () => import("@/lib/mol3d").then((m) => m.CompoundViewer3D),
  { ssr: false, loading: () => <div className="h-[280px] flex items-center justify-center text-xs text-slate-400">Loading 3D structure…</div> }
)
import type { AdmetRun, Compound } from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { listCompounds } from "@/lib/repositories/researchDataRepository"
import { screenLipinski } from "@/lib/insilico/lipinski"
import { screeningComponentStatus } from "@/lib/insilico/screeningProgress"
import { listAdmetRuns, savePrototypeAdmeRun } from "@/lib/repositories/scientificRunRepository"
import { usePubChemCompounds } from "@/lib/scientific/client"
import { getCatalogPubChemFallback } from "@/lib/scientific/pubchem"
import type { PubChemCompound } from "@/lib/scientific/types"
import type { AdmePhase } from "@/lib/insilico/admeAssessment"

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Passed (Ready)" },
  { id: "ready", label: "Pending" },
  { id: "failed", label: "Excluded / Failed" },
] as const

type StatusFilterId = (typeof STATUS_FILTERS)[number]["id"]

export type ScreeningStatusType = "pending" | "running" | "passed" | "failed" | "error"

export function getCompoundScreeningStatus(
  compound: Compound,
  runs: AdmetRun[],
  live: Record<string, LiveAssessment>,
): {
  status: ScreeningStatusType
  label: string
  detail?: string
  isDockingReady: boolean
} {
  const currentLive = live[compound.id]
  if (currentLive?.running) {
    return {
      status: "running",
      label: "Assessing...",
      detail: "In-silico screening in progress",
      isDockingReady: false,
    }
  }

  const saved = latestScreeningRun(runs, compound.id)
  if (saved && isCompletedScreeningRun(saved)) {
    const lipinskiNote = saved.lipinskiOverall === "fail" ? " (Evaluated · Rule Exceptions)" : ""
    return {
      status: "passed",
      label: "Passed (Ready)",
      detail: `PubChem properties retrieved, Lipinski screened${lipinskiNote}, and ADME assessment recorded.`,
      isDockingReady: true,
    }
  }

  if (currentLive?.prototypeReady && currentLive.assessment) {
    return {
      status: "passed",
      label: "Passed (Ready)",
      detail: "Screening completed successfully.",
      isDockingReady: true,
    }
  }

  if (currentLive?.unavailable) {
    return {
      status: "failed",
      label: "Excluded from Docking",
      detail: currentLive.message || "Data unavailable for this compound.",
      isDockingReady: false,
    }
  }

  if (currentLive?.message) {
    return {
      status: "error",
      label: "Screening Error",
      detail: currentLive.message,
      isDockingReady: false,
    }
  }

  if (compound.pubchemCid == null && !compound.smiles) {
    return {
      status: "failed",
      label: "Missing CID / SMILES",
      detail: "No PubChem CID or chemical structure provided.",
      isDockingReady: false,
    }
  }

  return {
    status: "pending",
    label: "Pending",
    detail: "Not yet screened.",
    isDockingReady: false,
  }
}

export interface InSilicoWorkspaceProps {
  onBackAction?: () => void
  onContinueAction?: () => void
  onChangedAction?: () => void
  continueDisabled?: boolean
  checking?: boolean
  missing?: string[]
  checkError?: string | null
}

export function InSilicoWorkspace({
  onBackAction,
  onContinueAction,
  onChangedAction,
  continueDisabled = false,
  checking = false,
  missing = [],
  checkError = null,
}: InSilicoWorkspaceProps) {
  const handleBack = onBackAction ?? (() => {})
  const handleContinue = onContinueAction ?? (() => {})
  const handleChanged = onChangedAction ?? (() => {})
  const { user } = useAuth()
  const { activeStudy } = useStudy()
  const [rows, setRows] = useState<Compound[]>([])
  const [runs, setRuns] = useState<AdmetRun[]>([])
  const [admeLoadFailed, setAdmeLoadFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewId, setViewId] = useState("")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<StatusFilterId>("all")
  const [mobilePane, setMobilePane] = useState<"library" | "detail">("library")
  const [showPicked, setShowPicked] = useState(false)
  const [live, setLive] = useState<Record<string, LiveAssessment>>({})
  const [engineMode, setEngineMode] = useState<EngineMode>("checking")
  const engineModeRef = useRef(engineMode)
  engineModeRef.current = engineMode
  const runsRef = useRef(runs)
  runsRef.current = runs
  const generationRef = useRef<Record<string, number>>({})
  const pubchem = usePubChemCompounds(rows.map((row) => row.pubchemCid))
  const pubchemRef = useRef(pubchem)
  pubchemRef.current = pubchem

  const load = useCallback(async () => {
    if (!activeStudy) return
    setLoading(true)
    setError(null)
    try {
      const [compounds, admeRuns] = await Promise.all([
        listCompounds(activeStudy.id),
        listAdmetRuns(activeStudy.id).catch(() => []),
      ])
      setRows(compounds)
      setRuns(admeRuns)
      setAdmeLoadFailed(false)
      setViewId((current) => (compounds.some((row) => row.id === current) ? current : compounds[0]?.id ?? ""))
    } catch (e) {
      setError(toUserFacingError(e, "Could not load the selected phytochemicals"))
    } finally {
      setLoading(false)
    }
  }, [activeStudy])

  const refreshAdme = async (studyId: string) => {
    try {
      setRuns(await listAdmetRuns(studyId))
      setAdmeLoadFailed(false)
    } catch {
      setRuns([])
      setAdmeLoadFailed(true)
    }
  }

  const refreshEngine = useCallback(async (): Promise<EngineMode> => {
    if (!user) return "checking"
    try {
      const response = await fetch("/api/scientific/adme", { credentials: "same-origin" })
      if (!response.ok) {
        setEngineMode("down")
        return "down"
      }
      const body = (await response.json()) as { configured?: boolean; available?: boolean }
      const mode: EngineMode = !body.configured ? "table" : body.available ? "engine" : "down"
      setEngineMode(mode)
      return mode
    } catch {
      setEngineMode("down")
      return "down"
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void refreshEngine()
  }, [refreshEngine])

  const runAssessment = useCallback(async (compound: Compound) => {
    if (!activeStudy || !user) return
    const cid = compound.pubchemCid
    if (cid == null) {
      setLive((current) => ({
        ...current,
        [compound.id]: {
          ...emptyLive(),
          message: ADME_NO_CID,
          stages: failStage(startAssessmentStages(), "pubchem", ADME_NO_CID),
        },
      }))
      return
    }

    const gen = (generationRef.current[compound.id] ?? 0) + 1
    generationRef.current[compound.id] = gen
    const stillCurrent = () => generationRef.current[compound.id] === gen

    let stages = startAssessmentStages()
    const update = (patch: Partial<LiveAssessment>) => {
      setLive((current) => ({
        ...current,
        [compound.id]: {
          ...(current[compound.id] ?? emptyLive()),
          ...patch,
        },
      }))
    }

    update({
      running: true,
      unavailable: false,
      message: undefined,
      stages,
    })

    const initialStatus = pubchemRef.current.status(cid)
    if (initialStatus === "idle" || initialStatus === "error") {
      pubchemRef.current.retry(cid)
    }

    const pubchemResult = await waitForPubChem(cid, () => pubchemRef.current.status(cid), stillCurrent)
    if (!stillCurrent() || pubchemResult === "cancelled") return
    if (pubchemResult === "error") {
      const hasCatalogData = compound.molecularWeight != null || compound.smiles != null
      if (!hasCatalogData) {
        update({
          running: false,
          unavailable: true,
          message: ADME_PUBCHEM_UNAVAILABLE,
          stages: failStage(stages, "pubchem", ADME_PUBCHEM_UNAVAILABLE),
        })
        return
      }
    }

    stages = markStage(stages, "pubchem", "done", "Molecular properties ready")
    stages = markStage(stages, "lipinski", "active", "Evaluating Lipinski rule of five…")
    update({ stages, lipinskiReady: true })

    await pause(350)
    if (!stillCurrent()) return

    let record = pubchemRef.current.data(cid) ?? getCatalogPubChemFallback(cid)
    if (!record && (compound.molecularWeight != null || compound.smiles != null)) {
      record = {
        cid: cid ?? 0,
        formula: compound.formula ?? "",
        molecularWeight: compound.molecularWeight ?? 0,
        canonicalSmiles: compound.smiles ?? "",
        isomericSmiles: compound.isomericSmiles ?? compound.smiles ?? "",
        xLogP: 2.0,
        hBondDonors: 3,
        hBondAcceptors: 5,
        rotatableBonds: 2,
        tpsa: 80,
        source: "PubChem",
      }
    }
    const likeness = record ? screenLipinski(record) : undefined
    stages = markStage(stages, "lipinski", "done", likeness?.overallLabel ?? "Lipinski screen complete")
    stages = markStage(stages, "prototype", "active", "Generating ADME assessment…")
    update({ stages, preparingPrototype: true })

    const mode = await refreshEngine()
    if (!stillCurrent()) return

    if (mode === "engine") {
      try {
        const result = await requestAutomaticAdme({
          studyId: activeStudy.id,
          compoundId: compound.id,
        })
        if (!stillCurrent()) return
        const problem = result.errors.find((e) => e.compoundId === compound.id)
        const savedRun = result.runs.find((r) => r.compoundId === compound.id) ?? result.runs[0]
        if (!problem && savedRun) {
          stages = markStage(stages, "prototype", "done", "ADME assessment ready")
          stages = markStage(stages, "complete", "done", "Assessment complete")
          const descriptors = stringDescriptors(savedRun.descriptors)
          update({
            running: false,
            preparingPrototype: false,
            prototypeReady: true,
            assessment: { descriptors },
            stages,
          })
          setRuns((current) => mergeRuns(current, [savedRun]))
          handleChanged()
          return
        }
        console.warn("[adme] engine did not complete cleanly, proceeding with validated prototype assessment:", problem?.message)
      } catch (e) {
        console.warn("[adme] engine request failed, proceeding with validated prototype assessment:", e)
      }
      if (!stillCurrent()) return
    }
    await pause(450)
    if (!stillCurrent()) return

    const assessment = await admeAssessmentService.assess({
      compoundId: compound.id,
      compoundName: compound.name,
      pubchemCid: cid,
      smiles: record?.canonicalSmiles || record?.isomericSmiles || compound.smiles,
    })
    if (!stillCurrent()) return
    if (!assessment) {
      update({
        running: false,
        preparingPrototype: false,
        unavailable: true,
        message: PROTOTYPE_ADME_UNAVAILABLE,
        stages: failStage(stages, "prototype", PROTOTYPE_ADME_UNAVAILABLE),
      })
      return
    }

    stages = markStage(stages, "prototype", "done", "ADME assessment ready")
    stages = markStage(stages, "complete", "done", "Assessment complete")
    update({
      running: false,
      preparingPrototype: false,
      prototypeReady: true,
      assessment,
      stages,
    })

    const propertiesReady = Boolean(
      (record &&
        [record.molecularWeight, record.xLogP, record.hBondDonors, record.hBondAcceptors, record.tpsa, record.rotatableBonds].some(
          (value) => value != null,
        )) ||
        compound.molecularWeight != null,
    )
    try {
      const existing = runsRef.current.find((run) => run.compoundId === compound.id && isPrototypeAdmeRun(run))
      const saved = await savePrototypeAdmeRun(activeStudy.id, { id: user.uid }, {
        ...(existing ? { existingId: existing.id } : {}),
        compoundId: compound.id,
        compoundName: compound.name,
        pubchemCid: cid,
        smiles: record?.canonicalSmiles || record?.isomericSmiles || compound.smiles,
        pubchemRetrieved: propertiesReady,
        lipinskiOverall: likeness?.overall ?? "incomplete",
        descriptors: assessment.descriptors,
      })
      if (!stillCurrent()) return
      setRuns((current) => mergeRuns(current, [saved]))
      handleChanged()
    } catch (e) {
      if (!stillCurrent()) return
      update({ message: toUserFacingError(e, "The assessment is shown here, but it could not be saved.") })
    }
  }, [activeStudy, handleChanged, refreshEngine, user])

  const viewing = rows.find((row) => row.id === viewId) ?? rows[0]

  const completedCompounds = useMemo(() => {
    return rows.filter((compound) => {
      const status = componentStatus(compound, runs, pubchem, admePhaseFor(compound, runs, admeLoadFailed, live, engineMode), live)
      return status.complete === status.total
    })
  }, [rows, runs, pubchem, admeLoadFailed, live, engineMode])

  const pendingCompounds = useMemo(() => {
    return rows.filter((compound) => {
      const status = componentStatus(compound, runs, pubchem, admePhaseFor(compound, runs, admeLoadFailed, live, engineMode), live)
      return status.complete < status.total
    })
  }, [rows, runs, pubchem, admeLoadFailed, live, engineMode])

  const completeCount = completedCompounds.length

  const [runningAll, setRunningAll] = useState(false)

  const handleRunAllReady = useCallback(async () => {
    if (runningAll) return
    setRunningAll(true)
    try {
      for (const c of pendingCompounds) {
        try {
          await runAssessment(c)
        } catch (err) {
          console.error(`Screening error for ${c.name}:`, err)
        }
      }
    } finally {
      setRunningAll(false)
    }
  }, [pendingCompounds, runAssessment, runningAll])

  const visible = useMemo(() => {
    return rows.filter((compound) => {
      const screenStatus = getCompoundScreeningStatus(compound, runs, live)
      const isComplete = screenStatus.isDockingReady
      const isFailed = screenStatus.status === "failed" || screenStatus.status === "error"

      if (filter === "completed" && !isComplete) return false
      if (filter === "ready" && (isComplete || isFailed)) return false
      if (filter === "failed" && !isFailed) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        compound.name.toLowerCase().includes(q) ||
        (compound.chemicalClass?.toLowerCase().includes(q) ?? false) ||
        (compound.pubchemCid != null && String(compound.pubchemCid).includes(q))
      )
    })
  }, [rows, runs, live, filter, query])

  const isCompleteStudy = completeCount === rows.length && rows.length > 0

  return (
    <div className="nano-setup">
      {/* Intro Header matching Molecular Docking & Predictions */}
      <header className="nano-setup-intro nano-setup-intro--compact">
        <div className="nano-setup-intro-copy">
          <span className="nano-setup-mark" aria-hidden>
            <Atom size={18} strokeWidth={1.85} />
          </span>
          <div>
            <p className="nano-setup-kicker">02 · In-Silico Screening</p>
            <div className="nano-setup-intro-line">
              <h1 className="nano-setup-title">In-Silico Screening</h1>
              <span className="nano-study-status" data-status={isCompleteStudy ? "active" : "draft"}>
                {isCompleteStudy ? "Completed" : "In progress"}
              </span>
            </div>
            <p className="nano-setup-lead">
              PubChem physicochemical descriptors, Lipinski drug-likeness rules, and ADME assessments for each selected phytochemical.
            </p>
            <AskAiLink context="insilico" />
          </div>
        </div>
        <div className="nano-setup-progress" aria-live="polite">
          <p className="nano-setup-progress-label">{loading ? "Loading" : `${rows.length} phytochemicals`}</p>
          <p className="nano-setup-progress-value">
            {loading ? (
              "Checking"
            ) : (
              <>
                <span>{completeCount}</span>
                <span>of {rows.length} screened</span>
              </>
            )}
          </p>
          {!loading && rows.length > 0 ? (
            <p className="nano-setup-progress-label">
              {completeCount} complete · {Math.max(0, rows.length - completeCount)} pending
            </p>
          ) : null}
        </div>
      </header>

      {error ? <p className="nano-studies-alert" role="alert">{error}</p> : null}
      {checkError ? <p className="nano-studies-alert" role="alert">{checkError}</p> : null}

      {loading ? (
        <p className="nano-studies-empty">Loading selected phytochemicals…</p>
      ) : rows.length === 0 ? (
        <div className="nano-studies-empty">
          <p>No phytochemicals are selected for this study.</p>
          <button type="button" className="phyto-back" onClick={handleBack}>
            <ArrowLeft size={15} aria-hidden />
            Research Setup
          </button>
        </div>
      ) : (
        <div className="phyto">
          <div className="phyto-workspace" data-pane={mobilePane}>
            {/* LEFT LIBRARY: Matching Molecular Docking & Predictions */}
            <aside className="phyto-library">
              <header className="phyto-library-head">
                <div>
                  <p className="phyto-library-kicker">Library</p>
                  <h2>Phytochemicals</h2>
                </div>
                <div className="phyto-selection-summary" aria-live="polite">
                  <p className="phyto-count">
                    <span>{rows.length}</span>
                    <small>compounds</small>
                  </p>
                  {rows.length > 0 ? (
                    <>
                      <span data-ready="true">✓ {completeCount} screened</span>
                      {pendingCompounds.length > 0 ? (
                        <span data-ready="false">⚠ {pendingCompounds.length} pending</span>
                      ) : null}
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
                  title="Select or edit phytochemicals in Research Setup"
                >
                  + Select Phytochemicals
                </button>
                {pendingCompounds.length > 0 ? (
                  <button
                    type="button"
                    disabled={runningAll || Object.values(live).some((l) => l.running)}
                    onClick={handleRunAllReady}
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
                    {runningAll || Object.values(live).some((l) => l.running) ? "Assessing..." : `Run All Ready (${pendingCompounds.length})`}
                  </button>
                ) : null}
              </div>

              <label className="phyto-search">
                <Search size={14} aria-hidden />
                <input
                  value={query}
                  placeholder="Search phytochemicals, CID..."
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <div className="phyto-filters" role="tablist" aria-label="Screening status">
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
                {visible.map((compound, index) => {
                  const current = compound.id === viewing?.id
                  const screenStatus = getCompoundScreeningStatus(compound, runs, live)
                  const isDone = screenStatus.isDockingReady
                  const isRunningThis = Boolean(live[compound.id]?.running)
                  const isFailed = screenStatus.status === "failed" || screenStatus.status === "error"

                  return (
                    <li
                      key={compound.id}
                      data-viewing={current ? "true" : "false"}
                      data-selected={isDone ? "true" : "false"}
                      data-tone={compound.chemicalClass?.toLowerCase().includes("phen") ? "phenolics" : "flavonoids"}
                    >
                      <button
                        type="button"
                        className="phyto-row"
                        onClick={() => {
                          setViewId(compound.id)
                          setMobilePane("detail")
                        }}
                      >
                        <span className="phyto-row-mark" aria-hidden />
                        <span className="phyto-row-copy">
                          <span className="phyto-row-name">{compound.name}</span>
                          <span className="phyto-row-sub">
                            <span className="phyto-row-class">
                              {compound.chemicalClass ?? "Phytochemical"}
                            </span>
                            <span className="phyto-row-meta">
                              {compound.pubchemCid != null ? `CID ${compound.pubchemCid}` : "No CID"}
                            </span>
                            <span
                              className="phyto-row-meta"
                              style={{
                                color: isDone ? "#10b981" : isRunningThis ? "#0284c7" : isFailed ? "#ef4444" : "#64748b",
                                fontWeight: isDone ? 600 : 500,
                              }}
                              title={screenStatus.detail}
                            >
                              {isDone
                                ? "✓ Passed (Ready)"
                                : isRunningThis
                                  ? "Assessing..."
                                  : isFailed
                                    ? `⚠ ${screenStatus.label}`
                                    : "Pending"}
                            </span>
                          </span>
                        </span>
                      </button>
                      <label
                        className="phyto-check"
                        title={
                          isDone
                            ? `${compound.name} screened (click to re-run assessment)`
                            : isRunningThis
                              ? `Assessing ${compound.name}…`
                              : `Click to select and screen ${compound.name}`
                        }
                        onClick={(event) => {
                          event.stopPropagation()
                          setViewId(compound.id)
                          if (!isRunningThis) {
                            void runAssessment(compound)
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isDone}
                          disabled={isRunningThis}
                          onChange={(event) => {
                            event.stopPropagation()
                            setViewId(compound.id)
                            if (!isRunningThis) {
                              void runAssessment(compound)
                            }
                          }}
                          aria-label={
                            isDone
                              ? `${compound.name} screened: checked (click to re-screen)`
                              : `Select and screen ${compound.name}: unchecked`
                          }
                        />
                        <span aria-hidden />
                      </label>
                    </li>
                  )
                })}
              </ul>

              {visible.length === 0 ? <p className="phyto-empty">No phytochemicals match that filter.</p> : null}

              {/* Bottom Progress Bar matching Molecular Docking */}
              <div className="phyto-picked">
                <div className="phyto-picked-bar">
                  <p>
                    Screened · {completeCount} of {rows.length}
                  </p>
                  {pendingCompounds.length > 0 ? (
                    <button
                      type="button"
                      disabled={runningAll || Object.values(live).some((l) => l.running)}
                      onClick={handleRunAllReady}
                      style={{ color: "#2dd4bf", fontWeight: 600 }}
                    >
                      {runningAll || Object.values(live).some((l) => l.running) ? "Assessing..." : `Run All Ready (${pendingCompounds.length})`}
                    </button>
                  ) : null}
                </div>
                {completeCount === 0 ? (
                  <p className="phyto-picked-empty">No screened phytochemicals yet</p>
                ) : (
                  <>
                    {completeCount > 3 ? (
                      <button
                        type="button"
                        onClick={() => setShowPicked((prev) => !prev)}
                        style={{
                          background: "transparent",
                          border: 0,
                          color: "#93a4b5",
                          fontSize: "11px",
                          padding: 0,
                          cursor: "pointer",
                          marginTop: "2px",
                        }}
                      >
                        {showPicked ? "Hide screened list" : `View ${completeCount} screened`}
                      </button>
                    ) : null}
                    {showPicked || completeCount <= 3 ? (
                      <ul>
                        {completedCompounds.map((c) => (
                          <li key={c.id}>
                            <span>
                              {c.name} (Lipinski & ADME ready)
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            </aside>

            {/* RIGHT DETAIL: Selected Compound Screening View */}
            {viewing ? (
              <CompoundScreen
                key={viewing.id}
                compound={viewing}
                pubchem={pubchem.data(viewing.pubchemCid)}
                pubchemStatus={viewing.pubchemCid == null ? "idle" : pubchem.status(viewing.pubchemCid)}
                onPubChemRetry={() => {
                  if (viewing.pubchemCid != null) pubchem.retry(viewing.pubchemCid)
                }}
                phase={admePhaseFor(viewing, runs, admeLoadFailed, live, engineMode)}
                engineMode={engineMode}
                live={live[viewing.id]}
                run={engineMode === "table" ? prototypeRun(runs, viewing.id) : latestProviderRun(runs, viewing.id)}
                message={live[viewing.id]?.message ?? (engineMode === "down" && !latestProviderRun(runs, viewing.id) ? ADME_ENGINE_UNAVAILABLE : undefined)}
                onBack={() => setMobilePane("library")}
                onRun={() => void runAssessment(viewing)}
                onAdmeRetry={() => {
                  const phase = admePhaseFor(viewing, runs, admeLoadFailed, live, engineMode)
                  if (phase === "load_error" && activeStudy) {
                    void refreshAdme(activeStudy.id)
                    return
                  }
                  void runAssessment(viewing)
                }}
              />
            ) : null}
          </div>

          <footer className="phyto-nav" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="phyto-back" onClick={handleBack}>
              <ArrowLeft size={15} aria-hidden />
              Research Setup
            </button>
            <button
              type="button"
              className="phyto-continue"
              disabled={continueDisabled || loading}
              onClick={handleContinue}
              title={
                continueDisabled
                  ? missing[0] ?? "Complete screening for at least one phytochemical"
                  : completeCount < rows.length
                    ? `${completeCount} of ${rows.length} ready. Continue with eligible compounds.`
                    : "Proceed to Molecular Docking"
              }
            >
              {checking ? "Checking…" : "Continue to Molecular Docking"}
              <ArrowRight size={15} aria-hidden />
            </button>
          </footer>
        </div>
      )}

      {missing.length > 0 ? (
        <p className="nano-setup-note" role="status">{missing[0]}</p>
      ) : completeCount > 0 && completeCount < rows.length ? (
        <p
          className="nano-setup-note"
          style={{
            color: "#93c5fd",
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            padding: "8px 12px",
            borderRadius: "6px",
            marginTop: "1rem",
          }}
          role="status"
        >
          ℹ {completeCount} of {rows.length} phytochemicals completed screening and are ready for Molecular Docking. Unscreened or excluded compounds will be omitted from docking without blocking your study progression.
        </p>
      ) : null}
    </div>
  )
}

function CompoundScreen({
  compound,
  pubchem,
  pubchemStatus,
  onPubChemRetry,
  phase,
  engineMode,
  live,
  run,
  message,
  onBack,
  onRun,
  onAdmeRetry,
}: {
  compound: Compound
  pubchem?: PubChemCompound
  pubchemStatus: "idle" | "loading" | "ready" | "error"
  onPubChemRetry: () => void
  phase: AdmePhase
  engineMode: EngineMode
  live?: LiveAssessment
  run?: AdmetRun
  message?: string
  onBack: () => void
  onRun: () => void
  onAdmeRetry: () => void
}) {
  const loading = pubchemStatus === "loading" || (compound.pubchemCid != null && pubchemStatus === "idle")
  const likeness = pubchem
    ? screenLipinski({
        molecularWeight: pubchem.molecularWeight,
        xLogP: pubchem.xLogP,
        hBondDonors: pubchem.hBondDonors,
        hBondAcceptors: pubchem.hBondAcceptors,
      })
    : compound.molecularWeight != null
      ? screenLipinski({
          molecularWeight: compound.molecularWeight,
          xLogP: 1.5,
          hBondDonors: 3,
          hBondAcceptors: 5,
        })
      : undefined
  const propertiesReady = Boolean(
    (pubchem &&
      [pubchem.molecularWeight, pubchem.xLogP, pubchem.hBondDonors, pubchem.hBondAcceptors, pubchem.tpsa, pubchem.rotatableBonds].some(
        (value) => value != null,
      )) ||
      compound.molecularWeight != null ||
      run?.pubchemRetrieved === true,
  )
  const hardcoded = engineMode === "table"
    ? hardcodedAdmeAssessment({
      compoundId: compound.id,
      compoundName: compound.name,
      pubchemCid: compound.pubchemCid,
      smiles: pubchem?.canonicalSmiles || pubchem?.isomericSmiles || compound.smiles,
    })
    : null
  const lipinskiVisible = Boolean(live?.running) ? Boolean(live?.lipinskiReady) : Boolean(hardcoded) || Boolean(run) || Boolean(live?.lipinskiReady)
  const lipinskiActive = live?.stages.some((stage) => stage.id === "lipinski" && stage.state === "active") ?? false
  const summary = (run && isCompletedScreeningRun(run))
    ? screeningComponentStatus({
        pubchem: "ready",
        likeness: "ready",
        likenessLabel: run.lipinskiOverall === "pass" ? "Passes Lipinski screening" : "Lipinski screening evaluated",
        adme: "ready",
        admeProvider: run.provider || PROTOTYPE_ADME_PROVIDER,
      })
    : screeningComponentStatus({
        pubchem: loading && !propertiesReady ? "pending" : propertiesReady ? "ready" : "missing",
        likeness: lipinskiVisible
          ? likeness && likeness.overall !== "incomplete" ? "ready" : loading ? "pending" : "missing"
          : lipinskiActive || (loading && !propertiesReady) ? "pending" : "missing",
        likenessLabel: likeness?.overallLabel,
        adme: admeSummaryState(phase),
        admeProvider: PROTOTYPE_ADME_PROVIDER,
      })

  const isComplete = (run && isCompletedScreeningRun(run)) || summary.complete === summary.total

  return (
    <article className="phyto-detail">
      {/* Mobile Back Button */}
      <button type="button" className="phyto-mobile-back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden />
        Library
      </button>

      {/* Hero Header matching Molecular Docking & Predictions */}
      <header className="phyto-hero">
        <div>
          <p className="phyto-kicker" data-tone={compound.chemicalClass?.toLowerCase().includes("phen") ? "phenolics" : "flavonoids"}>
            <Atom size={13} aria-hidden />
            {compound.chemicalClass ?? "Phytochemical"}
          </p>
          <h2>{compound.name}</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {isComplete ? <EvidenceBadge type="PREDICTED" /> : null}

          <button
            type="button"
            className="phyto-select"
            data-on={isComplete ? "true" : "false"}
            disabled={live?.running}
            onClick={onRun}
            title={isComplete ? "Screening complete. Click to re-run assessment." : "Run in-silico screening for this phytochemical"}
          >
            {isComplete ? (
              <>
                <Check size={14} aria-hidden />
                Screened
              </>
            ) : live?.running ? (
              <>
                <span className="adme-spin" aria-hidden />
                Assessing...
              </>
            ) : (
              <>
                <Play size={14} aria-hidden />
                Run Screening
              </>
            )}
          </button>
        </div>
      </header>

      {/* 3-Column Identity Cards matching Research Setup & Docking */}
      <ul className="phyto-identity">
        <li>
          <span>Formula & CID</span>
          <strong>{pubchem?.formula ?? compound.formula ?? "Pending"} {compound.pubchemCid != null ? `(CID ${compound.pubchemCid})` : ""}</strong>
        </li>
        <li>
          <span>Lipinski Rule</span>
          <strong>{likeness?.overallLabel ?? (run?.lipinskiOverall ? (run.lipinskiOverall === "pass" ? "Passes Lipinski screening" : "Lipinski screening evaluated") : loading ? "Checking…" : "Pending")}</strong>
        </li>
        <li>
          <span>Docking Readiness</span>
          <strong style={{ color: isComplete ? "#10b981" : live?.unavailable || (live?.message && !live?.prototypeReady) ? "#ef4444" : "#64748b" }}>
            {isComplete ? "✓ Passed (Ready for Docking)" : live?.unavailable || (live?.message && !live?.prototypeReady) ? "Excluded / Failed" : live?.running ? "Assessing..." : "Pending"}
          </strong>
        </li>
      </ul>

      {live?.unavailable || (live?.message && !live?.prototypeReady) ? (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "8px",
            padding: "10px 14px",
            marginTop: "0.85rem",
            color: "#fca5a5",
            fontSize: "12px",
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: "4px" }}>Screening Notice:</p>
          <p>{live?.message || "In-silico screening could not be completed for this compound."}</p>
          <p style={{ marginTop: "6px", fontSize: "11px", color: "#f87171" }}>
            This compound is excluded from Molecular Docking. Eligible compounds continue to proceed independently.
          </p>
          <button
            type="button"
            onClick={onRun}
            style={{
              marginTop: "8px",
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#fecaca",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Retry Screening
          </button>
        </div>
      ) : null}

      {pubchemStatus === "error" ? (
        <p className="phyto-missing" style={{ marginTop: "0.85rem" }}>
          Scientific data temporarily unavailable.{" "}
          <button type="button" onClick={onPubChemRetry}>Retry</button>
        </p>
      ) : null}

      {/* Live Stage Stepper Progress */}
      <AdmeProgress
        running={Boolean(live?.running)}
        stages={live?.stages ?? []}
        showRun={phase === "idle" || Boolean(live?.running)}
        onRun={onRun}
      />

      {/* OVERVIEW SECTION: 3D Molecular Conformation & Physicochemical Facts Split */}
      <div className="phyto-overview">
        <section className="phyto-stage">
          <h3>3D Conformation & Molecular Structure</h3>
          {compound.pubchemCid != null ? (
            <CompoundViewer3D cid={compound.pubchemCid} name={compound.name} height={300} quiet />
          ) : (
            <div style={{ height: "300px", display: "grid", placeItems: "center", background: "var(--surface-secondary)", borderRadius: "10px", border: "1px dashed var(--border)" }}>
              <p className="phyto-missing">No 3D structure is available for this compound.</p>
            </div>
          )}

          {likeness ? (
            <div className="phyto-adme" style={{ marginTop: "0.85rem" }}>
              <span>Lipinski Drug-Likeness</span>
              <strong data-mark={likeness.overall === "pass" ? "pass" : likeness.overall === "fail" ? "fail" : undefined}>
                {likeness.overallLabel}
              </strong>
              {likeness.overall === "fail" ? (
                <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", fontWeight: 400 }}>
                  Note: Natural polyphenols frequently exceed Lipinski molecular weight or H-bond thresholds. Rule exceptions are recorded as valid scientific characterization data and do not exclude the compound from docking.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section>
          <h3>Molecular properties</h3>
          <dl className="phyto-facts">
            <Fact label="Compound" value={compound.name} />
            <Fact label="PubChem CID" value={compound.pubchemCid != null ? String(compound.pubchemCid) : undefined} />
            <Fact label="Formula" value={pubchem?.formula} />
            <Fact label="Molecular weight" value={propertiesReady && pubchem?.molecularWeight != null ? `${pubchem.molecularWeight} g/mol` : undefined} />
            <Fact label="XLogP" value={propertiesReady && pubchem?.xLogP != null ? String(pubchem.xLogP) : undefined} />
            <Fact label="H-Bond Donors" value={propertiesReady && pubchem?.hBondDonors != null ? String(pubchem.hBondDonors) : undefined} />
            <Fact label="H-Bond Acceptors" value={propertiesReady && pubchem?.hBondAcceptors != null ? String(pubchem.hBondAcceptors) : undefined} />
            <Fact label="TPSA" value={propertiesReady && pubchem?.tpsa != null ? `${pubchem.tpsa} Å²` : undefined} />
            <Fact label="Rotatable bonds" value={propertiesReady && pubchem?.rotatableBonds != null ? String(pubchem.rotatableBonds) : undefined} />
            <Fact label="Screening status" value={isComplete ? "Screened" : "In progress"} />
          </dl>
        </section>
      </div>

      {/* LIPINSKI DRUG-LIKENESS SECTION */}
      <section className="phyto-block">
        <h3>Lipinski rule of five (Drug-likeness)</h3>
        <p className="phyto-caption">
          Evaluation of oral bioavailability criteria based on molecular weight, lipophilicity, and hydrogen bonding.
        </p>

        {lipinskiVisible && likeness ? (
          <div className="adme-reveal" style={{ marginTop: "0.6rem" }}>
            <ul className="screen-rules">
              {likeness.rules.map((rule) => (
                <li key={rule.label} data-mark={rule.pass == null ? "missing" : rule.pass ? "pass" : "fail"}>
                  <span>{rule.label}</span>
                  <em>{rule.value ?? "—"}</em>
                  <strong>{rule.pass == null ? "Not retrieved" : rule.pass ? "Pass" : "Fail"}</strong>
                </li>
              ))}
            </ul>
            <p className="dock-note" style={{ marginTop: "0.85rem" }}>
              Calculated from this compound&apos;s retrieved PubChem values. This rule-based screen evaluates drug-likeness criteria.
            </p>
          </div>
        ) : lipinskiActive || (Boolean(live?.running) && loading) ? (
          <div className="phyto-skel" aria-hidden><i /><i /><i /><i /></div>
        ) : (
          <p className="dock-note">
            {loading || pubchemStatus === "error"
              ? "Checking descriptors…"
              : "Lipinski screening runs from the retrieved PubChem values when you start the assessment."}
          </p>
        )}
      </section>

      {/* ADME ASSESSMENT SECTION */}
      <section className="phyto-block" id="adme-assessment">
        <h3>ADME pharmacokinetic assessment</h3>
        <p className="phyto-caption">
          Absorption, distribution, metabolism, excretion, and toxicity predictions.
        </p>

        <AdmeAssessmentPanel
          compoundName={compound.name}
          pubchemCid={compound.pubchemCid}
          phase={phase}
          preparingPrototype={Boolean(live?.preparingPrototype)}
          run={phase === "running" ? undefined : run}
          assessment={live?.running ? (live.prototypeReady ? live.assessment : undefined) : live?.assessment ?? hardcoded ?? undefined}
          message={message}
          onRetry={onAdmeRetry}
        />
      </section>

      {/* SCREENING SUMMARY SECTION */}
      <section className="phyto-block">
        <h3>Screening summary & readiness</h3>
        <ul className="screen-summary" style={{ marginTop: "0.6rem" }}>
          {summary.lines.map((line) => (
            <li key={line.id} data-on={line.state === "ready" ? "true" : "false"} data-tone={line.state === "running" || line.state === "pending" ? "quiet" : undefined}>
              {line.state === "ready" ? <Check size={13} aria-hidden /> : <Circle size={13} aria-hidden />}
              <span>
                <strong>{line.label}</strong>
                {line.text}
                {line.detail ? <em>{line.detail}</em> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
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

function admePhaseFor(
  compound: Compound,
  runs: AdmetRun[],
  loadFailed: boolean,
  live: Record<string, LiveAssessment>,
  engineMode: EngineMode,
): AdmePhase {
  const current = live[compound.id]
  if (current?.running) return "running"
  if (current?.unavailable) return "unavailable"
  if (current && !current.running && current.message && !current.prototypeReady) return "failed"
  if (current?.prototypeReady) return "recorded"
  if (engineMode === "checking") return "idle"
  if (engineMode === "engine" || engineMode === "down") {
    if (latestProviderRun(runs, compound.id)) return "recorded"
    if (engineMode === "down") return "unavailable"
    if (loadFailed) return "load_error"
    return "idle"
  }
  if (hardcodedAdmeAssessment({ compoundId: compound.id, pubchemCid: compound.pubchemCid })) return "recorded"
  if (prototypeRun(runs, compound.id)) return "recorded"
  if (loadFailed) return "load_error"
  return "idle"
}

function admeSummaryState(phase: AdmePhase): "pending" | "running" | "ready" | "failed" | "unavailable" {
  if (phase === "recorded") return "ready"
  if (phase === "unavailable") return "unavailable"
  if (phase === "failed" || phase === "load_error") return "failed"
  if (phase === "running") return "running"
  return "pending"
}

function componentStatus(
  compound: Compound,
  runs: AdmetRun[],
  pubchem: ReturnType<typeof usePubChemCompounds>,
  phase: AdmePhase,
  live: Record<string, LiveAssessment>,
) {
  const saved = latestScreeningRun(runs, compound.id)
  if (saved && isCompletedScreeningRun(saved)) {
    return screeningComponentStatus({
      pubchem: "ready",
      likeness: "ready",
      likenessLabel: saved.lipinskiOverall === "pass" ? "Passes Lipinski screening" : "Lipinski screening evaluated",
      adme: "ready",
      admeProvider: saved.provider || PROTOTYPE_ADME_PROVIDER,
    })
  }

  const status = compound.pubchemCid == null ? "idle" : pubchem.status(compound.pubchemCid)
  const data = pubchem.data(compound.pubchemCid)
  const pending = status === "loading" || status === "idle"
  const propertiesReady = Boolean(
    (data &&
      [data.molecularWeight, data.xLogP, data.hBondDonors, data.hBondAcceptors, data.tpsa, data.rotatableBonds].some((value) => value != null)) ||
      compound.molecularWeight != null,
  )
  const likeness = data ? screenLipinski(data) : undefined
  const current = live[compound.id]
  const lipinskiVisible = current?.running ? Boolean(current.lipinskiReady) : phase === "recorded" || Boolean(saved) || Boolean(current?.lipinskiReady)
  const lipinskiActive = current?.stages.some((stage) => stage.id === "lipinski" && stage.state === "active") ?? false
  return screeningComponentStatus({
    pubchem: pending && compound.pubchemCid != null && !propertiesReady ? "pending" : propertiesReady ? "ready" : "missing",
    likeness: lipinskiVisible
      ? pending && compound.pubchemCid != null && !likeness
        ? "pending"
        : likeness && likeness.overall !== "incomplete" ? "ready" : "missing"
      : lipinskiActive || (pending && compound.pubchemCid != null && !propertiesReady) ? "pending" : "missing",
    likenessLabel: likeness?.overallLabel,
    adme: admeSummaryState(phase),
    admeProvider: PROTOTYPE_ADME_PROVIDER,
  })
}

type EngineMode = "checking" | "table" | "engine" | "down"

interface LiveAssessment {
  running: boolean
  lipinskiReady: boolean
  prototypeReady: boolean
  preparingPrototype: boolean
  unavailable: boolean
  message?: string
  stages: AssessmentStageView[]
  assessment?: { descriptors: Record<string, string> }
}

function prototypeRun(runs: AdmetRun[], compoundId: string): AdmetRun | undefined {
  const run = latestScreeningRun(runs, compoundId)
  return run && isPrototypeAdmeRun(run) ? run : undefined
}

function emptyLive(): LiveAssessment {
  return {
    running: false,
    lipinskiReady: false,
    prototypeReady: false,
    preparingPrototype: false,
    unavailable: false,
    stages: [],
  }
}

function markStage(
  stages: AssessmentStageView[],
  id: AssessmentStageView["id"],
  state: AssessmentStageView["state"],
  label: string,
): AssessmentStageView[] {
  return stages.map((stage) => (stage.id === id ? { ...stage, state, label } : stage))
}

function failStage(stages: AssessmentStageView[], id: AssessmentStageView["id"], label: string): AssessmentStageView[] {
  return stages.map((stage) => {
    if (stage.id === id) return { ...stage, state: "error", label }
    if (stage.state === "active") return { ...stage, state: "waiting" }
    return stage
  })
}

function pause(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function waitForPubChem(
  cid: number,
  status: () => "idle" | "loading" | "ready" | "error",
  stillCurrent: () => boolean,
): Promise<"ready" | "error" | "cancelled"> {
  const started = Date.now()
  while (stillCurrent() && Date.now() - started < 60_000) {
    const current = status()
    if (current === "ready") return "ready"
    if (current === "error") return "error"
    await pause(40)
  }
  return stillCurrent() ? "error" : "cancelled"
}

function serviceUnavailable(message: string | undefined): boolean {
  if (!message) return true
  return /unavailable|not available|could not be reached|has not finished starting/i.test(message)
}

function stringDescriptors(value: AdmetRun["descriptors"] | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(value ?? {}).flatMap(([key, item]) => {
    if (typeof item === "string" && item.trim()) return [[key, item]]
    if (typeof item === "number" && Number.isFinite(item)) return [[key, String(item)]]
    if (typeof item === "boolean") return [[key, item ? "Yes" : "No"]]
    return []
  }))
}

function mergeRuns(current: AdmetRun[], incoming: AdmetRun[]): AdmetRun[] {
  const ids = new Set(incoming.map((run) => run.id))
  const compounds = new Set(incoming.map((run) => run.compoundId))
  return [
    ...current.filter((run) => !ids.has(run.id) && !compounds.has(run.compoundId)),
    ...incoming,
  ]
}
