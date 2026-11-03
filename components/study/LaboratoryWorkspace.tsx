"use client"

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ArrowRight, Check, Circle, FlaskConical, Minus, Pencil, Search, X } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AskAiLink } from "@/components/ai/ask-ai-link"
import { assistantFocusId } from "@/lib/ai/focus"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import type {
  CellLineRecord,
  Compound,
  LabDataset,
  LabDatasetInput,
  LaboratoryOmissionReason,
  LaboratoryOmissions,
  LabReplicate,
  LabReplicateCode,
  LabTreatmentCode,
  PredictionRun,
  Protein,
} from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"
import {
  CHARACTERIZATION_ASSAYS,
  CHARACTERIZATION_LABELS,
  LOCKED_TREATMENT_CONCENTRATIONS,
  type CharacterizationAssay,
} from "@/lib/lab/labAssayConfig"
import { FlexibleLabDialog, FlexibleResult } from "@/components/study/LaboratoryFlexiblePanel"
import {
  deriveExperimentalResults,
  DPPH_SCAVENGING_FORMULA,
  formatLabNumber,
  LDH_CYTOTOXICITY_FORMULA,
} from "@/lib/lab/derivedAssays"
import { numericMeasurement } from "@/lib/lab/labCalculations"
import {
  endpointCoverageStatus,
  experimentalCoverage,
  OMISSION_REASON_OPTIONS,
  PREDICTION_LAB_ENDPOINTS,
  visibleLaboratorySections,
  type EndpointCoverageStatus,
  type LaboratorySectionKey,
  type LaboratorySectionSelection,
} from "@/lib/lab/sections"
import { runMatchesSubject, subjectsForModule } from "@/lib/predictions/modules"
import {
  createLabDataset,
  createLabReplicate,
  deleteLabDataset,
  deleteLabReplicate,
  listLabDatasets,
  listLabReplicates,
  updateLabDataset,
} from "@/lib/repositories/labRepository"
import { listCellLines, listCompounds, listProteins } from "@/lib/repositories/researchDataRepository"
import { listPredictionRuns } from "@/lib/repositories/scientificRunRepository"

const REPS: LabReplicateCode[] = ["R1", "R2", "R3"]
const CODES: LabTreatmentCode[] = ["T1", "T2", "T3", "T4", "T5", "T6"]

const DPPH_LABEL: Record<LabTreatmentCode, string> = {
  T1: "Solvent control",
  T2: "Ascorbic acid control",
  T3: "NanoHepatoTea",
  T4: "NanoHepatoTea",
  T5: "NanoHepatoTea",
  T6: "NanoHepatoTea",
}

const LDH_LABEL: Record<LabTreatmentCode, string> = {
  T1: "Control",
  T2: "Maximum LDH release",
  T3: "NanoHepatoTea",
  T4: "NanoHepatoTea",
  T5: "NanoHepatoTea",
  T6: "NanoHepatoTea",
}

type Grid = Record<LabTreatmentCode, [string, string, string]>

interface AssayDraft {
  date: string
  operator: string
  batch: string
  instrument: string
  ascorbic: string
  lysisNote: string
  notes: string
  ic50: string
  ic50Unit: string
  ic50Method: string
  grid: Grid
}

interface CharDraft {
  assayType: CharacterizationAssay
  date: string
  method: string
  instrument: string
  batch: string
  notes: string
  analyte: string
  retention: string
  peakArea: string
  concentration: string
  unit: string
  parameter: string
  value: string
}

const CHAR_LABELS: Record<CharacterizationAssay, string> = {
  ...CHARACTERIZATION_LABELS,
  pb: "Chemical Analysis — Pb",
  sensory: "Sensory Evaluation",
  microbial: "Microbial Analysis",
  stability: "Stability Testing",
}

function emptyGrid(): Grid {
  return { T1: ["", "", ""], T2: ["", "", ""], T3: ["", "", ""], T4: ["", "", ""], T5: ["", "", ""], T6: ["", "", ""] }
}

function emptyAssayDraft(): AssayDraft {
  return {
    date: "",
    operator: "",
    batch: "",
    instrument: "",
    ascorbic: "",
    lysisNote: "",
    notes: "",
    ic50: "",
    ic50Unit: "",
    ic50Method: "",
    grid: emptyGrid(),
  }
}

function emptyCharDraft(): CharDraft {
  return {
    assayType: "hplc",
    date: "",
    method: "",
    instrument: "",
    batch: "",
    notes: "",
    analyte: "",
    retention: "",
    peakArea: "",
    concentration: "",
    unit: "",
    parameter: "",
    value: "",
  }
}

export interface LaboratoryWorkspaceProps {
  tab: string
  onTabAction?: (tab: string) => void
  onBackAction?: () => void
  onContinueAction?: () => void
  onChangedAction?: () => void
  continueDisabled?: boolean
  checking?: boolean
  missing?: string[]
  checkError?: string | null
}

export function LaboratoryWorkspace({
  tab,
  onTabAction,
  onBackAction,
  onContinueAction,
  onChangedAction,
  continueDisabled = false,
  checking = false,
  missing = [],
  checkError = null,
}: LaboratoryWorkspaceProps) {
  const handleTab = onTabAction ?? (() => {})
  const handleBack = onBackAction ?? (() => {})
  const handleContinue = onContinueAction ?? (() => {})
  const handleChanged = onChangedAction ?? (() => {})
  const { user } = useAuth()
  const { activeStudy, updateActiveStudy } = useStudy()
  const sectionTab = ["coverage", "dpph", "mtt", "ldh", "ros", "bax", "hippo-yap", "characterization"].includes(tab) ? tab : "coverage"
  const [compounds, setCompounds] = useState<Compound[]>([])
  const [proteins, setProteins] = useState<Protein[]>([])
  const [cellLines, setCellLines] = useState<CellLineRecord[]>([])
  const [datasets, setDatasets] = useState<LabDataset[]>([])
  const [replicates, setReplicates] = useState<Record<"dpph" | "ldh", LabReplicate[]>>({ dpph: [], ldh: [] })
  const [predictions, setPredictions] = useState<PredictionRun[]>([])
  const [sections, setSections] = useState<LaboratorySectionSelection | undefined>(activeStudy?.laboratorySections)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entryOpen, setEntryOpen] = useState(false)
  const [flexOpen, setFlexOpen] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [marking, setMarking] = useState(false)
  const [charOpen, setCharOpen] = useState<LabDataset | null | "new">(null)
  const [mobilePane, setMobilePane] = useState<"library" | "detail">("library")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "recorded" | "pending">("all")
  const [showPicked, setShowPicked] = useState(false)

  const load = useCallback(async () => {
    if (!activeStudy) return
    setLoading(true)
    setError(null)
    try {
      const [compoundRows, proteinRows, lineRows, datasetRows, predictionRows] = await Promise.all([
        listCompounds(activeStudy.id),
        listProteins(activeStudy.id),
        listCellLines(activeStudy.id),
        listLabDatasets(activeStudy.id),
        listPredictionRuns(activeStudy.id).catch(() => [] as PredictionRun[]),
      ])
      const dpphSet = latestDataset(datasetRows, "dpph")
      const ldhSet = latestDataset(datasetRows, "ldh")
      const [dpphReps, ldhReps] = await Promise.all([
        dpphSet ? listLabReplicates(activeStudy.id, dpphSet.id) : Promise.resolve([]),
        ldhSet ? listLabReplicates(activeStudy.id, ldhSet.id) : Promise.resolve([]),
      ])
      setCompounds(compoundRows)
      setProteins(proteinRows)
      setCellLines(lineRows)
      setDatasets(datasetRows)
      setPredictions(predictionRows)
      setReplicates({ dpph: dpphReps, ldh: ldhReps })
      setSections(activeStudy.laboratorySections)
    } catch (e) {
      setError(toUserFacingError(e, "Laboratory records could not be loaded."))
    } finally {
      setLoading(false)
    }
  }, [activeStudy])

  useEffect(() => {
    void load()
  }, [load])

  const parties = {
    compounds: compounds.map((row) => ({ id: row.id, name: row.name })),
    proteins: proteins.map((row) => ({ id: row.id, name: row.name, gene: row.gene, pathway: row.pathway })),
    cellLines: cellLines.map((row) => ({ id: row.id, name: row.name })),
  }
  const visible = useMemo(
    () => visibleLaboratorySections({
      storedPredictions: activeStudy?.predictionModules,
      compounds: parties.compounds,
      proteins: parties.proteins,
      cellLines: parties.cellLines,
    }),
    [activeStudy?.predictionModules, compounds, proteins, cellLines],
  )

  const [selectedTab, setSelectedTab] = useState<string>(() => {
    return ["dpph", "mtt", "ldh", "ros", "bax", "hippo-yap", "characterization"].includes(tab) ? tab : "dpph"
  })

  useEffect(() => {
    if (tab && tab !== "coverage" && tab !== selectedTab) {
      setSelectedTab(tab)
    }
  }, [tab, selectedTab])

  const selectTab = (nextTab: string) => {
    setSelectedTab(nextTab)
    handleTab(nextTab)
    setMobilePane("detail")
  }

  const resolvedTab = selectedTab || (sectionTab === "coverage" ? (visible[0]?.tab ?? "dpph") : sectionTab)
  const active = visible.find((item) => item.tab === resolvedTab) ?? visible[0]

  const filteredVisible = useMemo(() => {
    return visible.filter((item) => {
      const state = endpointCoverageStatus(item.id, datasets, sections, activeStudy?.laboratoryOmissions)
      if (filter === "recorded" && state !== "recorded") return false
      if (filter === "pending" && state === "recorded") return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        item.label.toLowerCase().includes(q) ||
        (item.endpoint && item.endpoint.toLowerCase().includes(q))
      )
    })
  }, [visible, datasets, sections, activeStudy?.laboratoryOmissions, filter, query])

  useEffect(() => {
    if (loading || sectionTab !== "coverage") return
    const first = visible[0]
    if (first) handleTab(first.tab)
  }, [loading, handleTab, sectionTab, visible])

  useEffect(() => {
    setFlexOpen(false)
    setShowResult(false)
    setMarking(false)
    setEntryOpen(false)
  }, [resolvedTab])
  const coverage = experimentalCoverage({
    datasets,
    stored: sections,
    omissions: activeStudy?.laboratoryOmissions,
  })
  const done = coverage.resolved >= coverage.endpoints
  const hepg2 = cellLines.find((line) => /hepg2/i.test(line.name))
  const names = compounds.map((row) => row.name).sort((a, b) => a.localeCompare(b))

  const saveCoverage = async (nextSections: LaboratorySectionSelection, nextOmissions: LaboratoryOmissions) => {
    setSections(nextSections)
    setError(null)
    try {
      await updateActiveStudy({
        laboratorySections: nextSections,
        laboratoryOmissions: nextOmissions,
        laboratoryEvidenceAt: new Date().toISOString(),
      })
      handleChanged()
    } catch (e) {
      setSections(activeStudy?.laboratorySections)
      setError(toUserFacingError(e, "Could not update this endpoint."))
    }
  }

  const markNotTested = async (key: LaboratorySectionKey, reason: LaboratoryOmissionReason, notes: string) => {
    if (!activeStudy) return
    const trimmed = notes.trim()
    await saveCoverage(
      { ...activeStudy.laboratorySections, [key]: false },
      {
        ...activeStudy.laboratoryOmissions,
        [key]: trimmed ? { reason, notes: trimmed } : { reason },
      },
    )
  }

  const clearNotTested = async (key: LaboratorySectionKey) => {
    if (!activeStudy) return
    const nextSections = { ...activeStudy.laboratorySections, [key]: true }
    const nextOmissions = { ...activeStudy.laboratoryOmissions }
    delete nextOmissions[key]
    await saveCoverage(nextSections, nextOmissions)
  }

  const isCompleteValidation = coverage.tested === coverage.endpoints && coverage.endpoints > 0

  return (
    <div className="nano-setup">
      <header className="nano-setup-intro nano-setup-intro--compact">
        <div className="nano-setup-intro-copy">
          <span className="nano-setup-mark" aria-hidden>
            <FlaskConical size={18} strokeWidth={1.85} />
          </span>
          <div>
            <p className="nano-setup-kicker">05 · Laboratory Validation</p>
            <div className="nano-setup-intro-line">
              <h1 className="nano-setup-title">Laboratory Validation</h1>
              <span className="nano-study-status" data-status={isCompleteValidation ? "active" : "draft"}>
                {isCompleteValidation ? "Completed" : "In progress"}
              </span>
            </div>
            <p className="nano-setup-lead">
              Record available laboratory results and identify computational endpoints that were not experimentally tested.
            </p>
            <AskAiLink context={assistantFocusId(sectionTab === "coverage" ? "laboratory" : sectionTab)} />
          </div>
        </div>
        <div className="nano-setup-progress" aria-live="polite">
          <p className="nano-setup-progress-label">{loading ? "Loading" : `${coverage.endpoints} laboratory endpoints`}</p>
          <p className="nano-setup-progress-value">
            {loading ? (
              "Checking"
            ) : (
              <>
                <span>{coverage.tested}</span>
                <span>of {coverage.endpoints} recorded</span>
              </>
            )}
          </p>
          {!loading && coverage.endpoints > 0 ? (
            <p className="nano-setup-progress-label">
              {coverage.tested} recorded · {Math.max(0, coverage.endpoints - coverage.tested)} pending/omitted
            </p>
          ) : null}
        </div>
      </header>

      {error ? <p className="nano-studies-alert" role="alert">{error}</p> : null}
      {checkError ? <p className="nano-studies-alert" role="alert">{checkError}</p> : null}

      {loading ? (
        <p className="nano-studies-empty">Loading laboratory endpoints…</p>
      ) : visible.length === 0 ? (
        <div className="nano-studies-empty">
          <p>This study has no laboratory endpoints configured.</p>
          <button type="button" className="phyto-back" onClick={handleBack}>
            <ArrowLeft size={15} aria-hidden />
            Biological Predictions
          </button>
        </div>
      ) : (
        <div className="phyto">
          <div className="phyto-workspace" data-pane={mobilePane}>
            <aside className="phyto-library">
              <header className="phyto-library-head">
                <div>
                  <p className="phyto-library-kicker">Library</p>
                  <h2>Lab Endpoints</h2>
                </div>
                <div className="phyto-selection-summary" aria-live="polite">
                  <p className="phyto-count">
                    <span>{visible.length}</span>
                    <small>assays</small>
                  </p>
                  {visible.length > 0 ? (
                    <>
                      <span data-ready="true">✓ {coverage.tested} recorded</span>
                      {coverage.endpoints - coverage.tested > 0 ? (
                        <span data-ready="false">⚠ {coverage.endpoints - coverage.tested} pending</span>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </header>

              <label className="phyto-search">
                <Search size={14} aria-hidden />
                <input
                  value={query}
                  placeholder="Search assay, endpoint..."
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>

              <div className="phyto-filters" role="tablist" aria-label="Validation status">
                {[
                  { id: "all", label: "All" },
                  { id: "recorded", label: "Recorded" },
                  { id: "pending", label: "Pending" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    data-on={filter === item.id ? "true" : "false"}
                    onClick={() => setFilter(item.id as "all" | "recorded" | "pending")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <ul className="phyto-rows">
                {filteredVisible.map((item) => {
                  const state = endpointCoverageStatus(item.id, datasets, sections, activeStudy?.laboratoryOmissions)
                  const isRecorded = state === "recorded"
                  const isSelected = item.tab === resolvedTab
                  return (
                    <li
                      key={item.id}
                      data-view={isSelected ? "true" : "false"}
                      data-viewing={isSelected ? "true" : "false"}
                      data-selected={isRecorded ? "true" : "false"}
                    >
                      <button
                        type="button"
                        className="phyto-row"
                        onClick={() => selectTab(item.tab)}
                      >
                        <span className="phyto-row-mark" aria-hidden />
                        <span className="phyto-row-copy">
                          <span className="phyto-row-name">{item.label}</span>
                          <span className="phyto-row-sub">
                            <span
                              className="phyto-row-class"
                              style={{
                                color: isRecorded ? "#059669" : state === "not_tested" ? "#d97706" : "#64748b",
                                fontWeight: 500,
                              }}
                            >
                              {isRecorded ? "✓ Recorded" : state === "not_tested" ? "Not Tested" : "Not yet recorded"}
                            </span>
                          </span>
                        </span>
                      </button>
                      <label
                        className="phyto-check"
                        title={
                          isRecorded
                            ? `${item.label} recorded`
                            : `Select ${item.label}`
                        }
                        onClick={(event) => {
                          event.stopPropagation()
                          selectTab(item.tab)
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isRecorded}
                          onChange={() => selectTab(item.tab)}
                          aria-label={`${item.label} recorded: ${isRecorded}`}
                        />
                        <span aria-hidden />
                      </label>
                    </li>
                  )
                })}
              </ul>

              {filteredVisible.length === 0 ? <p className="phyto-empty">No laboratory endpoints match that filter.</p> : null}

              <div className="phyto-picked">
                <div className="phyto-picked-bar">
                  <p>
                    Recorded · {coverage.tested} of {coverage.endpoints}
                  </p>
                </div>
                {coverage.tested === 0 ? (
                  <p className="phyto-picked-empty">No experimental endpoints recorded yet</p>
                ) : (
                  <>
                    {coverage.tested > 3 ? (
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
                        {showPicked ? "Hide recorded list" : `View ${coverage.tested} recorded`}
                      </button>
                    ) : null}
                    {showPicked || coverage.tested <= 3 ? (
                      <ul>
                        {visible
                          .filter((item) => endpointCoverageStatus(item.id, datasets, sections, activeStudy?.laboratoryOmissions) === "recorded")
                          .map((item) => (
                            <li key={item.id}>
                              <span>{item.label} (Experimental validation recorded)</span>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            </aside>

            <article className="phyto-detail">
              <button type="button" className="phyto-mobile-back" onClick={() => setMobilePane("library")}>
                <ArrowLeft size={14} aria-hidden />
                Library
              </button>

              {!active ? (
                <p className="dock-note">This study has no laboratory endpoints to record.</p>
              ) : active.endpoint === "dpph" || active.endpoint === "ldh" ? (
                <>
                  {endpointCoverageStatus(active.id, datasets, sections, activeStudy?.laboratoryOmissions) === "recorded" ? (
                    <AssayPanel
                      assay={active.endpoint}
                      dataset={latestDataset(datasets, active.endpoint)}
                      replicates={replicates[active.endpoint]}
                      compounds={names}
                      hepg2={hepg2}
                      predictionLabels={subjectsForModule(active.endpoint, parties.compounds, parties.proteins, parties.cellLines)
                        .filter((subject) => predictions.some((run) => run.endpoint === active.endpoint && runMatchesSubject(run, subject)))
                        .map((subject) => subject.label)}
                      onEnter={() => setEntryOpen(true)}
                    />
                  ) : (
                    <EndpointStatus
                      title={active.label}
                      status={endpointCoverageStatus(active.id, datasets, sections, activeStudy?.laboratoryOmissions)}
                      simulation={predictions.some((run) => (run.endpoint ?? run.module) === active.endpoint)}
                      omission={activeStudy?.laboratoryOmissions?.[active.id]}
                      marking={marking}
                      onAdd={() => setEntryOpen(true)}
                      onEdit={() => setEntryOpen(true)}
                      onMark={() => setMarking(true)}
                      onSave={async (reason, notes) => { await markNotTested(active.id, reason, notes); setMarking(false) }}
                      onClear={async () => { await clearNotTested(active.id); setMarking(false) }}
                    />
                  )}
                </>
              ) : active.endpoint === "mtt" || active.endpoint === "ros" || active.endpoint === "bax" || active.endpoint === "hippo_yap" ? (
                <>
                  <EndpointStatus
                    title={active.label}
                    status={endpointCoverageStatus(active.id, datasets, sections, activeStudy?.laboratoryOmissions)}
                    simulation={predictions.some((run) => (run.endpoint ?? run.module) === active.endpoint)}
                    omission={activeStudy?.laboratoryOmissions?.[active.id]}
                    marking={marking}
                    onAdd={() => setFlexOpen(true)}
                    onView={() => setShowResult((open) => !open)}
                    onEdit={() => setFlexOpen(true)}
                    onMark={() => setMarking(true)}
                    onSave={async (reason, notes) => { await markNotTested(active.id, reason, notes); setMarking(false) }}
                    onClear={async () => { await clearNotTested(active.id); setMarking(false) }}
                  />
                  {showResult && latestDataset(datasets, active.endpoint) ? (
                    <FlexibleResult dataset={latestDataset(datasets, active.endpoint)!} endpoint={active.endpoint} />
                  ) : null}
                </>
              ) : null}
            </article>
          </div>

          <footer className="phyto-nav" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="phyto-back" onClick={handleBack}>
              <ArrowLeft size={15} aria-hidden />
              Biological Predictions
            </button>
            <button type="button" className="phyto-continue" disabled={continueDisabled || loading} onClick={handleContinue}>
              {checking ? "Checking…" : "Continue to Analysis & Interpretation"}
              <ArrowRight size={15} aria-hidden />
            </button>
          </footer>
        </div>
      )}

      <p className="nano-setup-note" role="status">
        {done ? "Laboratory Validation Completed ✓ " : ""}
        Analysis can continue with the laboratory evidence currently available. Missing experiments will be identified in the final interpretation.
      </p>

      {entryOpen && (active?.endpoint === "dpph" || active?.endpoint === "ldh") ? (
        <AssayDialog
          assay={active.endpoint}
          dataset={latestDataset(datasets, active.endpoint)}
          replicates={replicates[active.endpoint]}
          hepg2={hepg2}
          onClose={() => setEntryOpen(false)}
          onSave={async (input, rows) => {
            if (!activeStudy || !user) return
            const actor = { id: user.uid }
            const existing = latestDataset(datasets, active.endpoint)
            const saved = existing
              ? await updateLabDataset(activeStudy.id, existing.id, actor, input)
              : await createLabDataset(activeStudy.id, actor, input)
            const previous = existing ? await listLabReplicates(activeStudy.id, saved.id) : []
            for (const row of previous) await deleteLabReplicate(activeStudy.id, saved.id, row.id, actor)
            for (const row of rows) {
              await createLabReplicate(activeStudy.id, saved.id, actor, {
                treatmentCode: row.treatmentCode,
                replicateCode: row.replicateCode,
                replicateN: row.replicateCode === "R1" ? 1 : row.replicateCode === "R2" ? 2 : 3,
                concentration: row.concentration,
                concentrationUnit: row.concentrationUnit,
                measurements: row.measurements,
                dataClass: "RAW_EXPERIMENTAL",
              })
            }
            await updateLabDataset(activeStudy.id, saved.id, actor, input)
            await clearNotTested(active.id)
            setEntryOpen(false)
            await load()
            handleChanged()
          }}
        />
      ) : null}

      {flexOpen && (active?.endpoint === "mtt" || active?.endpoint === "ros" || active?.endpoint === "bax" || active?.endpoint === "hippo_yap") ? (
        <FlexibleLabDialog
          endpoint={active.endpoint}
          compounds={compounds.map((row) => ({ id: row.id, name: row.name }))}
          cellLines={cellLines.map((row) => ({ id: row.id, name: row.name }))}
          proteins={proteins.map((row) => ({ id: row.id, name: row.name }))}
          defaultCellLineId={hepg2?.id ?? cellLines[0]?.id}
          dataset={latestDataset(datasets, active.endpoint)}
          onClose={() => setFlexOpen(false)}
          onSave={async (input) => {
            if (!activeStudy || !user) return
            const actor = { id: user.uid }
            const existing = latestDataset(datasets, active.endpoint)
            if (existing) await updateLabDataset(activeStudy.id, existing.id, actor, input)
            else await createLabDataset(activeStudy.id, actor, input)
            await clearNotTested(active.id)
            setFlexOpen(false)
            setShowResult(true)
            await load()
            handleChanged()
          }}
        />
      ) : null}

      {charOpen ? (
        <CharacterizationDialog
          dataset={charOpen === "new" ? undefined : charOpen}
          onClose={() => setCharOpen(null)}
          onSave={async (input) => {
            if (!activeStudy || !user) return
            const actor = { id: user.uid }
            if (charOpen !== "new") await updateLabDataset(activeStudy.id, charOpen.id, actor, input)
            else await createLabDataset(activeStudy.id, actor, input)
            await updateActiveStudy({ laboratoryEvidenceAt: new Date().toISOString() })
            setCharOpen(null)
            await load()
            handleChanged()
          }}
        />
      ) : null}
    </div>
  )
}

function coverageLabel(key: LaboratorySectionKey, status: EndpointCoverageStatus): string {
  if (status === "recorded") return "Recorded"
  if (status === "not_tested") return "Not Tested"
  return "Not yet recorded"
}

function NotTestedForm({
  label,
  status,
  omission,
  onSave,
  onClear,
}: {
  label: string
  status: EndpointCoverageStatus
  omission?: LaboratoryOmissions[LaboratorySectionKey]
  onSave: (reason: LaboratoryOmissionReason, notes: string) => void
  onClear: () => void
}) {
  const [reason, setReason] = useState<LaboratoryOmissionReason | "">("")
  const [notes, setNotes] = useState(omission?.notes ?? "")
  if (status === "recorded") return null
  return (
    <section className="phyto-block">
      <h3>{status === "not_tested" ? label : `Mark as ${label}`}</h3>
      {status === "not_tested" && omission ? (
        <p className="dock-note">
          {OMISSION_REASON_OPTIONS.find((item) => item.id === omission.reason)?.label ?? omission.reason}
          {omission.notes ? `. ${omission.notes}` : ""}
        </p>
      ) : (
        <p className="dock-note">{label} is a researcher decision. It is not recorded as a laboratory measurement.</p>
      )}
      <label className="analysis-fields">
        Reason
        <select value={reason} onChange={(event) => setReason(event.target.value as LaboratoryOmissionReason | "")}>
          <option value="">Select a reason</option>
          {OMISSION_REASON_OPTIONS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      <label className="analysis-fields">
        Notes
        <textarea value={notes} rows={2} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="lab-assay-action">
        <button type="button" className="phyto-select" disabled={!reason} onClick={() => { if (reason) onSave(reason, notes) }}>
          Mark as {label}
        </button>
        {status === "not_tested" ? (
          <button type="button" className="phyto-back" onClick={onClear}>Return to not yet recorded</button>
        ) : null}
      </div>
    </section>
  )
}

function EndpointStatus({
  title,
  status,
  simulation,
  omission,
  marking,
  onAdd,
  onView,
  onEdit,
  onMark,
  onSave,
  onClear,
}: {
  title: string
  status: EndpointCoverageStatus
  simulation: boolean
  omission?: LaboratoryOmissions[LaboratorySectionKey]
  marking: boolean
  onAdd: () => void
  onView?: () => void
  onEdit?: () => void
  onMark: () => void
  onSave: (reason: LaboratoryOmissionReason, notes: string) => void
  onClear: () => void
}) {
  const reason = OMISSION_REASON_OPTIONS.find((item) => item.id === omission?.reason)?.label
  return (
    <>
      <header className="phyto-hero">
        <div>
          <p className="phyto-kicker" data-tone="phenolics">
            <FlaskConical size={13} aria-hidden />
            Laboratory Endpoint
          </p>
          <h2>{title}</h2>
          <p className="phyto-subtitle">
            Experimental validation and wet-lab verification for {title.toLowerCase()}.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {status === "recorded" ? <EvidenceBadge type="EXPERIMENTAL" /> : null}
          {status === "recorded" ? (
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {onView ? (
                <button type="button" className="phyto-select" onClick={onView}>
                  View Result
                </button>
              ) : null}
              {onEdit ? (
                <button type="button" className="phyto-select" onClick={onEdit}>
                  <Pencil size={14} aria-hidden />
                  Edit Result
                </button>
              ) : null}
            </div>
          ) : (
            <button type="button" className="phyto-select" onClick={onAdd}>
              <FlaskConical size={14} aria-hidden />
              Add Laboratory Result
            </button>
          )}
        </div>
      </header>

      <ul className="phyto-identity">
        <li>
          <span>Computational Link</span>
          <strong>{simulation ? "Prediction Available (Step 04)" : "No Prior Simulation"}</strong>
        </li>
        <li>
          <span>Validation Status</span>
          <strong style={{ color: status === "recorded" ? "#059669" : status === "not_tested" ? "#d97706" : "#64748b" }}>
            {status === "recorded" ? "✓ Recorded" : status === "not_tested" ? "Not Tested (Omitted)" : "Pending Recording"}
          </strong>
        </li>
        <li>
          <span>Assay Protocol</span>
          <strong>In Vitro Experimental Validation</strong>
        </li>
      </ul>

      {status === "recorded" ? (
        <section className="phyto-block">
          <div className="dock-block-head">
            <h3>Experimental validation recorded</h3>
            <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>✓ Verified in wet-lab</span>
          </div>
          <p className="dock-note">
            Laboratory measurement data has been successfully recorded for this endpoint and will be incorporated into the multi-evidence study analysis.
          </p>
          <div className="lab-assay-action" style={{ marginTop: "0.75rem" }}>
            {onView ? <button type="button" className="phyto-select" onClick={onView}>View Dataset Details</button> : null}
            {onEdit ? <button type="button" className="phyto-back" onClick={onEdit}>Edit Measurement Data</button> : null}
          </div>
        </section>
      ) : status === "not_tested" ? (
        <section className="phyto-block">
          <div className="dock-block-head">
            <h3>Design decision: Not Tested</h3>
            <span style={{ fontSize: "12px", color: "#d97706", fontWeight: 600 }}>Omitted from wet-lab</span>
          </div>
          <p className="dock-note">
            {reason ? <strong>Reason: {reason}. </strong> : null}
            {omission?.notes ? <span>{omission.notes}</span> : "Marked as omitted by the research team."}
          </p>
          <div className="lab-assay-action" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="phyto-select" onClick={onAdd}>Enter Laboratory Results Instead</button>
            <button type="button" className="phyto-back" onClick={onMark}>Change Omission Reason</button>
            <button type="button" className="phyto-back" onClick={onClear}>Clear Omission</button>
          </div>
        </section>
      ) : (
        <section className="phyto-block">
          <div className="dock-block-head">
            <h3>Laboratory result not yet recorded</h3>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Pending experiment</span>
          </div>
          <p className="dock-note">
            No wet-lab experimental measurements have been recorded for {title}. You can record data from spectrophotometric, ELISA, or flow cytometry assays, or formally mark this endpoint as omitted with a documented justification.
          </p>
          <div className="lab-assay-action" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="phyto-select" onClick={onAdd}>Add Laboratory Result</button>
            <button type="button" className="phyto-back" onClick={onMark}>Mark as Not Tested</button>
          </div>
        </section>
      )}

      {marking && status !== "recorded" ? (
        <NotTestedForm label="Not Tested" status={status} omission={omission} onSave={onSave} onClear={onClear} />
      ) : null}
    </>
  )
}

function AssayPanel({
  assay,
  dataset,
  replicates,
  compounds,
  hepg2,
  predictionLabels,
  onEnter,
}: {
  assay: "dpph" | "ldh"
  dataset?: LabDataset
  replicates: LabReplicate[]
  compounds: string[]
  hepg2?: CellLineRecord
  predictionLabels: string[]
  onEnter: () => void
}) {
  const rawKey = assay === "dpph" ? "absorbance" : "absorbanceA490"
  const derivedKey = assay === "dpph" ? "radicalScavengingPercent" : "percentCytotoxicity"
  const live = deriveExperimentalResults(assay, replicates)
  const hasAbsorbance = replicates.some((row) => numericMeasurement(row, rawKey) !== undefined)
  const recorded = Boolean(dataset)
  const labels = assay === "dpph" ? DPPH_LABEL : LDH_LABEL
  const chart = dosePoints(live.summaries, derivedKey)

  return (
    <>
      <header className="phyto-hero">
        <div>
          <p className="phyto-kicker" data-tone={assay === "dpph" ? "flavonoids" : "phenolics"}>
            <FlaskConical size={13} aria-hidden />
            {assay === "dpph" ? "Antioxidant Assay" : "Cytotoxicity Assay"}
          </p>
          <h2>{assay === "dpph" ? "DPPH Radical Scavenging Assay" : "LDH Release Cytotoxicity Assay"}</h2>
          <p className="phyto-subtitle">
            {assay === "dpph"
              ? "Wet-lab antioxidant radical-scavenging spectrophotometric assay at 517 nm."
              : "Wet-lab LDH cytotoxicity and cell membrane integrity assay on HepG2 at 490 nm."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {recorded ? <EvidenceBadge type="EXPERIMENTAL" /> : null}
          <button
            type="button"
            className="phyto-select"
            onClick={onEnter}
            disabled={assay === "ldh" && !hepg2}
          >
            {recorded ? (
              <>
                <Pencil size={14} aria-hidden />
                Edit Laboratory Results
              </>
            ) : (
              <>
                <FlaskConical size={14} aria-hidden />
                Enter Laboratory Results
              </>
            )}
          </button>
        </div>
      </header>

      <ul className="phyto-identity">
        <li>
          <span>Target / Phytochemical</span>
          <strong>{compounds.length ? compounds.join(", ") : "NanoHepatoTea Complex"}</strong>
        </li>
        <li>
          <span>Model & System</span>
          <strong>{assay === "dpph" ? "DPPH Radicals (517 nm)" : (hepg2 ? `${hepg2.name} Cell Culture` : "HepG2 Culture")}</strong>
        </li>
        <li>
          <span>Experimental Coverage</span>
          <strong style={{ color: recorded ? "#059669" : "#64748b" }}>
            {recorded ? "✓ Measurements Recorded (R1·R2·R3)" : "Pending Measurements"}
          </strong>
        </li>
      </ul>

      <dl className="phyto-props lab-assay-facts">
        <div>
          <dt>Phytochemical</dt>
          <dd>{compounds.length ? compounds.join(", ") : "None selected"}</dd>
        </div>
        <div>
          <dt>Step 04 prediction</dt>
          <dd>{predictionLabels.length ? predictionLabels.join(", ") : "Not recorded"}</dd>
        </div>
        {assay === "dpph" ? (
          <div><dt>Wavelength</dt><dd>517 nm</dd></div>
        ) : (
          <div><dt>Cell line</dt><dd>{hepg2 ? hepg2.name : "HepG2 is not selected"}</dd></div>
        )}
        <div><dt>Replicates</dt><dd>R1 · R2 · R3</dd></div>
      </dl>

      {!recorded ? (
        <section className="phyto-block">
          <h3>Treatment design</h3>
          <TreatmentTable assay={assay} />
          <div className="lab-assay-action">
            <div>
              <p className="dock-empty-title">No laboratory results recorded yet.</p>
              <p className="phyto-missing">Status: Not recorded</p>
            </div>
            <button type="button" className="phyto-select" onClick={onEnter} disabled={assay === "ldh" && !hepg2}>
              Enter Laboratory Results
            </button>
          </div>
        </section>
      ) : (
        <section className="phyto-block">
          <div className="dock-block-head">
            <h3>Experimental results</h3>
            <button type="button" className="phyto-select" onClick={onEnter}>
              <Pencil size={14} aria-hidden />
              Edit Laboratory Results
            </button>
          </div>
          <MetaLines dataset={dataset!} />
          <h3>Raw measurements</h3>
          <RawTable assay={assay} replicates={replicates} labels={labels} />
          <h3>Calculated results</h3>
          {hasAbsorbance ? (
            <>
              <p className="dock-note">{assay === "dpph" ? DPPH_SCAVENGING_FORMULA : LDH_CYTOTOXICITY_FORMULA}</p>
              <CalculatedTable assay={assay} summaries={live.summaries} labels={labels} replicates={replicates} />
              {chart.length > 1 ? <DoseChart points={chart} label={assay === "dpph" ? "Inhibition (%)" : "Cytotoxicity (%)"} /> : null}
            </>
          ) : replicates.some((row) => numericMeasurement(row, derivedKey) !== undefined) ? (
            <CalculatedTable assay={assay} summaries={dataset?.treatmentSummaries ?? []} labels={labels} replicates={replicates} />
          ) : (
            <p className="phyto-missing">
              {assay === "dpph"
                ? "Inhibition is calculated when solvent-control and sample absorbances are recorded."
                : "Cytotoxicity is calculated when control, maximum-release, and sample absorbances are recorded."}
            </p>
          )}
          {dataset?.ic50 ? (
            <p className="dock-note">IC50 {dataset.ic50.value} {dataset.ic50.unit}. Method {dataset.ic50.method}</p>
          ) : null}
          {dataset?.notes?.trim() ? <p className="dock-note">{dataset.notes.trim()}</p> : null}
        </section>
      )}
    </>
  )
}

function TreatmentTable({ assay }: { assay: "dpph" | "ldh" }) {
  const labels = assay === "dpph" ? DPPH_LABEL : LDH_LABEL
  return (
    <div className="dock-table-wrap">
      <table className="dock-table lab-design">
        <thead>
          <tr>
            <th>Code</th>
            <th>Treatment</th>
            <th>Concentration</th>
          </tr>
        </thead>
        <tbody>
          {CODES.map((code) => (
            <tr key={code}>
              <td>{code}</td>
              <td>{labels[code]}</td>
              <td>{treatmentConcentration(assay, code)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function treatmentConcentration(assay: "dpph" | "ldh", code: LabTreatmentCode): string {
  if (code === "T3" || code === "T4" || code === "T5" || code === "T6") {
    return `${LOCKED_TREATMENT_CONCENTRATIONS[code]} µg/mL`
  }
  if (code === "T2" && assay === "dpph") return "Record the concentration used"
  return "—"
}

function MetaLines({ dataset }: { dataset: LabDataset }) {
  return (
    <dl className="phyto-props">
      <div><dt>Experiment date</dt><dd>{dataset.datePerformed.slice(0, 10)}</dd></div>
      {dataset.operatorName ? <div><dt>Operator</dt><dd>{dataset.operatorName}</dd></div> : null}
      {dataset.datasetName ? <div><dt>Sample / batch</dt><dd>{dataset.datasetName}</dd></div> : null}
      {dataset.instrument ? <div><dt>Instrument</dt><dd>{dataset.instrument}</dd></div> : null}
      {dataset.cellLineName ? <div><dt>Cell line</dt><dd>{dataset.cellLineName}</dd></div> : null}
      {dataset.controlT2Detail ? <div><dt>{dataset.assayType === "dpph" ? "Ascorbic acid" : "Lysis control"}</dt><dd>{dataset.controlT2Detail}</dd></div> : null}
    </dl>
  )
}

function RawTable({
  assay,
  replicates,
  labels,
}: {
  assay: "dpph" | "ldh"
  replicates: LabReplicate[]
  labels: Record<LabTreatmentCode, string>
}) {
  const key = assay === "dpph" ? "absorbance" : "absorbanceA490"
  return (
    <div className="dock-table-wrap">
      <table className="dock-table">
        <thead>
          <tr>
            <th>Treatment</th>
            <th>Concentration</th>
            <th>R1</th>
            <th>R2</th>
            <th>R3</th>
          </tr>
        </thead>
        <tbody>
          {CODES.map((code) => {
            const cells = REPS.map((rep) => replicates.find((row) => row.treatmentCode === code && row.replicateCode === rep))
            const sample = cells.find(Boolean)
            return (
              <tr key={code}>
                <td>{code} {labels[code]}</td>
                <td>{concentrationText(assay, code, sample)}</td>
                {cells.map((cell, index) => (
                  <td key={REPS[index]}>{formatLabNumber(cell ? numericMeasurement(cell, key) : undefined)}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CalculatedTable({
  assay,
  summaries,
  labels,
  replicates,
}: {
  assay: "dpph" | "ldh"
  summaries: LabDataset["treatmentSummaries"]
  labels: Record<LabTreatmentCode, string>
  replicates: LabReplicate[]
}) {
  const rawKey = assay === "dpph" ? "absorbance" : "absorbanceA490"
  const derivedKey = assay === "dpph" ? "radicalScavengingPercent" : "percentCytotoxicity"
  const rows = CODES.filter((code) => code !== "T1")
  return (
    <div className="dock-table-wrap">
      <table className="dock-table">
        <thead>
          <tr>
            <th>Treatment</th>
            <th>Mean absorbance</th>
            <th>SD</th>
            <th>{assay === "dpph" ? "Inhibition (%)" : "Cytotoxicity (%)"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((code) => {
            const raw = summaries.find((row) => row.treatmentCode === code && row.metric === rawKey)
            const derived = summaries.find((row) => row.treatmentCode === code && row.metric === derivedKey)
            if (!raw && !derived) return null
            const sample = replicates.find((row) => row.treatmentCode === code)
            return (
              <tr key={code}>
                <td>{labels[code]} {concentrationText(assay, code, sample)}</td>
                <td>{formatLabNumber(raw?.mean)}</td>
                <td>{formatLabNumber(raw?.sd)}</td>
                <td>{formatLabNumber(derived?.mean)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DoseChart({ points, label }: { points: Array<{ concentration: number; value: number }>; label: string }) {
  return (
    <div className="pred-chart" aria-label={`${label} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e7eeeb" vertical={false} />
          <XAxis dataKey="concentration" tick={{ fontSize: 11 }} label={{ value: "µg/mL", position: "insideBottom", offset: -2, fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={42} />
          <Tooltip />
          <Line type="linear" dataKey="value" name={label} stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function AssayDialog({
  assay,
  dataset,
  replicates,
  hepg2,
  onClose,
  onSave,
}: {
  assay: "dpph" | "ldh"
  dataset?: LabDataset
  replicates: LabReplicate[]
  hepg2?: CellLineRecord
  onClose: () => void
  onSave: (input: LabDatasetInput, rows: LabReplicate[]) => Promise<void>
}) {
  const [draft, setDraft] = useState<AssayDraft>(() => draftFromDataset(assay, dataset, replicates))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const labels = assay === "dpph" ? DPPH_LABEL : LDH_LABEL

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [busy, onClose])

  if (!mounted) return null

  const set = (key: keyof AssayDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft((current) => ({ ...current, [key]: event.target.value }))
  }

  return createPortal(
    <div className="nano-modal-back" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div className="nano-modal dock-import lab-import" role="dialog" aria-modal="true" aria-labelledby="lab-entry-title">
        <header className="nano-modal-head">
          <div>
            <p className="nano-setup-kicker">{assay === "dpph" ? "DPPH Assay" : "LDH Assay"}</p>
            <h2 id="lab-entry-title">{dataset ? "Edit Laboratory Results" : "Enter Laboratory Results"}</h2>
          </div>
          <button type="button" className="nano-modal-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={16} /></button>
        </header>
        <form id="lab-entry" className="dock-import-body" onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setMessage(null)
          try {
            const built = buildAssayInput(assay, draft, hepg2)
            void onSave(built.input, built.rows).catch((e) => {
              setMessage(toUserFacingError(e, "The laboratory results could not be saved."))
              setBusy(false)
            })
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "The laboratory results could not be saved.")
            setBusy(false)
          }
        }}>
          <div className="dock-field-row">
            <label>Experiment date<input type="date" value={draft.date} onChange={set("date")} required /></label>
            <label>Researcher / operator<input value={draft.operator} onChange={set("operator")} /></label>
          </div>
          <div className="dock-field-row">
            <label>Sample / batch<input value={draft.batch} onChange={set("batch")} /></label>
            <label>Instrument<input value={draft.instrument} onChange={set("instrument")} /></label>
          </div>
          {assay === "dpph" ? (
            <label>Ascorbic acid concentration (µg/mL)<input value={draft.ascorbic} onChange={set("ascorbic")} inputMode="decimal" /></label>
          ) : (
            <label>Maximum LDH release reagent<input value={draft.lysisNote} onChange={set("lysisNote")} placeholder="Record the reagent used" /></label>
          )}
          <div className="dock-table-wrap">
            <table className="dock-table lab-grid">
              <thead>
                <tr>
                  <th>Treatment</th>
                  <th>Concentration</th>
                  <th>R1</th>
                  <th>R2</th>
                  <th>R3</th>
                </tr>
              </thead>
              <tbody>
                {CODES.map((code) => (
                  <tr key={code}>
                    <td>
                      <span className="lab-grid-treatment">
                        <strong>{code}</strong>
                        <span>{labels[code]}</span>
                      </span>
                    </td>
                    <td>{code === "T3" || code === "T4" || code === "T5" || code === "T6" ? `${LOCKED_TREATMENT_CONCENTRATIONS[code]} µg/mL` : "Control"}</td>
                    {REPS.map((rep, index) => (
                      <td key={rep}>
                        <input
                          aria-label={`${code} ${rep}`}
                          value={draft.grid[code][index]}
                          inputMode="decimal"
                          onChange={(event) => {
                            const value = event.target.value
                            setDraft((current) => {
                              const next = [...current.grid[code]] as [string, string, string]
                              next[index] = value
                              return { ...current, grid: { ...current.grid, [code]: next } }
                            })
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dock-note">Absorbance at {assay === "dpph" ? "517 nm" : "490 nm"}. Leave a cell blank when that replicate was not measured.</p>
          <div className="dock-field-row">
            <label>IC50<input value={draft.ic50} onChange={set("ic50")} inputMode="decimal" /></label>
            <label>IC50 unit<input value={draft.ic50Unit} onChange={set("ic50Unit")} placeholder="µg/mL" /></label>
          </div>
          <label>IC50 method<input value={draft.ic50Method} onChange={set("ic50Method")} placeholder="Method used outside NANO-HEPATOTEA" /></label>
          <label>Notes<textarea value={draft.notes} onChange={set("notes")} rows={2} /></label>
          {message ? <p role="alert">{message}</p> : null}
        </form>
        <div className="dock-import-actions">
          <button type="button" className="phyto-back" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="lab-entry" className="phyto-continue" disabled={busy}>{busy ? "Saving…" : "Save Laboratory Results"}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CharacterizationPanel({
  datasets,
  onAdd,
  onEdit,
  onDelete,
}: {
  datasets: LabDataset[]
  onAdd: () => void
  onEdit: (dataset: LabDataset) => void
  onDelete: (dataset: LabDataset) => Promise<void>
}) {
  const [pending, setPending] = useState<string | null>(null)
  return (
    <>
      <header className="phyto-hero">
        <div>
          <p className="phyto-kicker" data-tone="phenolics">
            <FlaskConical size={13} aria-hidden />
            Analytical Chemistry
          </p>
          <h2>Product Characterization</h2>
          <p className="phyto-subtitle">
            Record actual HPLC profiles, heavy metal testing, and physicochemical quality parameters for NanoHepatoTea.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <EvidenceBadge type="EXPERIMENTAL" />
          <button type="button" className="phyto-select" onClick={onAdd}>
            <FlaskConical size={14} aria-hidden />
            Add Characterization Result
          </button>
        </div>
      </header>

      <ul className="phyto-identity">
        <li>
          <span>Product Formulation</span>
          <strong>NanoHepatoTea Complex</strong>
        </li>
        <li>
          <span>Characterization Protocols</span>
          <strong>HPLC · Lead (Pb) · Microbial · Sensory</strong>
        </li>
        <li>
          <span>Logged Records</span>
          <strong style={{ color: datasets.length > 0 ? "#059669" : "#64748b" }}>
            {datasets.length > 0 ? `✓ ${datasets.length} result${datasets.length > 1 ? "s" : ""} recorded` : "No results recorded"}
          </strong>
        </li>
      </ul>

      {!datasets.length ? (
        <section className="phyto-block">
          <p className="dock-empty-title">No laboratory results recorded yet.</p>
          <p className="phyto-missing">Status: Not recorded</p>
          <button type="button" className="phyto-select" onClick={onAdd}>Add Characterization Result</button>
        </section>
      ) : null}
      {datasets.map((dataset) => (
        <section key={dataset.id} className="phyto-block">
          <div className="dock-block-head">
            <h3>{CHAR_LABELS[dataset.assayType as CharacterizationAssay] ?? dataset.assayType}</h3>
            <button type="button" className="phyto-select" onClick={() => onEdit(dataset)}>
              <Pencil size={14} aria-hidden />
              Edit
            </button>
          </div>
          <p className="screen-origin"><EvidenceBadge type="EXPERIMENTAL" /></p>
          <dl className="phyto-props">
            {characterizationLines(dataset).map((line) => (
              <div key={line.label}><dt>{line.label}</dt><dd>{line.value}</dd></div>
            ))}
          </dl>
          <button type="button" className="phyto-back" disabled={pending === dataset.id} onClick={() => {
            setPending(dataset.id)
            void onDelete(dataset).catch(() => setPending(null))
          }}>
            Remove result
          </button>
        </section>
      ))}
      {datasets.length ? (
        <button type="button" className="phyto-select" onClick={onAdd}>Add Characterization Result</button>
      ) : null}
    </>
  )
}

function CharacterizationDialog({
  dataset,
  onClose,
  onSave,
}: {
  dataset?: LabDataset
  onClose: () => void
  onSave: (input: LabDatasetInput) => Promise<void>
}) {
  const [draft, setDraft] = useState<CharDraft>(() => charDraftFromDataset(dataset))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose() }
    window.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [busy, onClose])

  if (!mounted) return null
  const set = (key: keyof CharDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setDraft((current) => ({ ...current, [key]: event.target.value }))
  }

  return createPortal(
    <div className="nano-modal-back" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div className="nano-modal dock-import" role="dialog" aria-modal="true" aria-labelledby="char-entry-title">
        <header className="nano-modal-head">
          <div>
            <p className="nano-setup-kicker">Product Characterization</p>
            <h2 id="char-entry-title">{dataset ? "Edit Characterization Result" : "Add Characterization Result"}</h2>
          </div>
          <button type="button" className="nano-modal-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={16} /></button>
        </header>
        <form id="char-entry" className="dock-import-body" onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setMessage(null)
          try {
            const input = buildCharacterizationInput(draft)
            void onSave(input).catch((e) => {
              setMessage(toUserFacingError(e, "The characterization result could not be saved."))
              setBusy(false)
            })
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "The characterization result could not be saved.")
            setBusy(false)
          }
        }}>
          <label>
            Characterization type
            <select value={draft.assayType} onChange={set("assayType")} disabled={Boolean(dataset)}>
              {CHARACTERIZATION_ASSAYS.map((item) => (
                <option key={item} value={item}>{CHAR_LABELS[item]}</option>
              ))}
            </select>
          </label>
          <div className="dock-field-row">
            <label>Date<input type="date" value={draft.date} onChange={set("date")} required /></label>
            <label>Method<input value={draft.method} onChange={set("method")} /></label>
          </div>
          <div className="dock-field-row">
            <label>Instrument<input value={draft.instrument} onChange={set("instrument")} /></label>
            <label>Sample / batch<input value={draft.batch} onChange={set("batch")} /></label>
          </div>
          {draft.assayType === "hplc" ? (
            <>
              <label>Analyte / compound<input value={draft.analyte} onChange={set("analyte")} /></label>
              <div className="dock-field-row">
                <label>Retention time (min)<input value={draft.retention} onChange={set("retention")} inputMode="decimal" /></label>
                <label>Peak area<input value={draft.peakArea} onChange={set("peakArea")} inputMode="decimal" /></label>
              </div>
              <div className="dock-field-row">
                <label>Concentration<input value={draft.concentration} onChange={set("concentration")} inputMode="decimal" /></label>
                <label>Unit<input value={draft.unit} onChange={set("unit")} /></label>
              </div>
            </>
          ) : (
            <>
              <label>Parameter<input value={draft.parameter} onChange={set("parameter")} /></label>
              <div className="dock-field-row">
                <label>Measured value<input value={draft.value} onChange={set("value")} /></label>
                <label>Unit<input value={draft.unit} onChange={set("unit")} /></label>
              </div>
            </>
          )}
          <label>Notes<textarea value={draft.notes} onChange={set("notes")} rows={2} /></label>
          {message ? <p role="alert">{message}</p> : null}
        </form>
        <div className="dock-import-actions">
          <button type="button" className="phyto-back" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="char-entry" className="phyto-continue" disabled={busy}>{busy ? "Saving…" : "Save Result"}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function latestDataset(datasets: LabDataset[], assay: string): LabDataset | undefined {
  return datasets.filter((row) => row.assayType === assay).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

function concentrationText(assay: "dpph" | "ldh", code: LabTreatmentCode, sample?: LabReplicate): string {
  const locked = LOCKED_TREATMENT_CONCENTRATIONS[code as "T3"]
  if (locked) return `${locked} µg/mL`
  if (code === "T2" && assay === "dpph" && sample?.concentration != null) return `${sample.concentration} µg/mL`
  return "Control"
}

function dosePoints(summaries: LabDataset["treatmentSummaries"], metric: string) {
  return (["T3", "T4", "T5", "T6"] as const)
    .map((code) => {
      const row = summaries.find((item) => item.treatmentCode === code && item.metric === metric && item.mean !== undefined)
      if (!row || row.mean === undefined) return null
      return { concentration: LOCKED_TREATMENT_CONCENTRATIONS[code], value: row.mean }
    })
    .filter((row): row is { concentration: number; value: number } => row !== null)
}

function draftFromDataset(assay: "dpph" | "ldh", dataset: LabDataset | undefined, replicates: LabReplicate[]): AssayDraft {
  const draft = emptyAssayDraft()
  if (!dataset) return draft
  const key = assay === "dpph" ? "absorbance" : "absorbanceA490"
  const grid = emptyGrid()
  for (const row of replicates) {
    const value = numericMeasurement(row, key)
    const index = REPS.indexOf(row.replicateCode)
    if (value === undefined || index < 0) continue
    grid[row.treatmentCode][index] = String(value)
  }
  const t2 = replicates.find((row) => row.treatmentCode === "T2" && row.concentration != null)
  return {
    ...draft,
    date: dataset.datePerformed.slice(0, 10),
    operator: dataset.operatorName ?? "",
    batch: dataset.datasetName === "DPPH Assay" || dataset.datasetName === "LDH Assay" ? "" : dataset.datasetName,
    instrument: dataset.instrument ?? "",
    ascorbic: t2?.concentration != null ? String(t2.concentration) : "",
    lysisNote: assay === "ldh" ? dataset.controlT2Detail ?? "" : "",
    notes: dataset.notes ?? "",
    ic50: dataset.ic50 ? String(dataset.ic50.value) : "",
    ic50Unit: dataset.ic50?.unit ?? "",
    ic50Method: dataset.ic50?.method ?? "",
    grid,
  }
}

function buildAssayInput(
  assay: "dpph" | "ldh",
  draft: AssayDraft,
  hepg2?: CellLineRecord,
): { input: LabDatasetInput; rows: LabReplicate[] } {
  if (!draft.date.trim()) throw new Error("Experiment date is required.")
  if (assay === "ldh" && !hepg2) throw new Error("Experimental LDH uses HepG2. Select HepG2 in Research Setup before recording this assay.")
  const rawKey = assay === "dpph" ? "absorbance" : "absorbanceA490"
  const formula = assay === "dpph" ? DPPH_SCAVENGING_FORMULA : LDH_CYTOTOXICITY_FORMULA
  let ascorbic: number | undefined
  if (assay === "dpph" && draft.ascorbic.trim()) {
    ascorbic = Number(draft.ascorbic)
    if (!Number.isFinite(ascorbic)) throw new Error("Ascorbic acid concentration must be a number.")
  }
  const rows: LabReplicate[] = []
  for (const code of CODES) {
    REPS.forEach((replicateCode, index) => {
      const text = draft.grid[code][index].trim()
      if (!text) return
      const absorbance = Number(text)
      if (!Number.isFinite(absorbance)) throw new Error(`${code} ${replicateCode} must be a number.`)
      const locked = LOCKED_TREATMENT_CONCENTRATIONS[code as "T3"]
      rows.push({
        id: "draft",
        datasetId: "draft",
        studyId: "draft",
        treatmentCode: code,
        replicateCode,
        concentration: locked ?? (code === "T2" ? ascorbic : undefined),
        concentrationUnit: locked != null || ascorbic != null && code === "T2" ? "ug_per_mL" : undefined,
        measurements: { [rawKey]: absorbance },
        dataClass: "RAW_EXPERIMENTAL",
        createdAt: draft.date,
        updatedAt: draft.date,
        createdBy: "draft",
      })
    })
  }
  if (!rows.length) throw new Error("Enter at least one absorbance.")
  const derived = deriveExperimentalResults(assay, rows)
  let ic50: LabDatasetInput["ic50"]
  if (draft.ic50.trim() || draft.ic50Method.trim()) {
    if (!draft.ic50.trim() || !draft.ic50Method.trim()) {
      throw new Error("An IC50 needs both the value and the method used to calculate it.")
    }
    const value = Number(draft.ic50)
    if (!Number.isFinite(value)) throw new Error("IC50 must be a number.")
    ic50 = {
      value,
      unit: draft.ic50Unit.trim() || "µg/mL",
      method: draft.ic50Method.trim(),
      dataClass: "DERIVED_FROM_EXPERIMENTAL",
    }
  }
  const input: LabDatasetInput = {
    assay,
    assayType: assay,
    endpointType: assay,
    datasetName: draft.batch.trim() || (assay === "dpph" ? "DPPH Assay" : "LDH Assay"),
    cellLineId: assay === "ldh" ? hepg2?.id : undefined,
    cellLineName: assay === "ldh" ? hepg2?.name : undefined,
    laboratoryName: draft.operator.trim(),
    datePerformed: draft.date,
    protocolReference: formula,
    instrument: draft.instrument.trim() || undefined,
    wavelengthNm: assay === "dpph" ? 517 : undefined,
    operatorName: draft.operator.trim() || undefined,
    outsourcedLab: false,
    concentrationUnit: "ug_per_mL",
    controlT2Detail: assay === "dpph"
      ? (ascorbic != null ? `${ascorbic} µg/mL` : undefined)
      : (draft.lysisNote.trim() || undefined),
    treatmentSummaries: derived.summaries,
    observations: [],
    ic50,
    notes: draft.notes.trim() || undefined,
    status: "final",
    provenance: {
      evidenceClass: "EXPERIMENTAL",
      methodName: formula,
      source: "Laboratory measurement",
      recordedAt: draft.date,
    },
  }
  return { input, rows: derived.replicates }
}

function optionalNumber(label: string, value: string): number | undefined {
  if (!value.trim()) return undefined
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number.`)
  return number
}

function buildCharacterizationInput(draft: CharDraft): LabDatasetInput {
  if (!draft.date.trim()) throw new Error("Date is required.")
  const notes = [draft.notes.trim(), draft.parameter.trim() && draft.assayType !== "hplc" ? `${draft.parameter.trim()}: ${draft.value.trim()} ${draft.unit.trim()}`.trim() : ""]
    .filter(Boolean)
    .join("\n")
  const payload = characterizationPayload(draft)
  if (!payload) throw new Error("Enter the measured result.")
  return {
    assay: draft.assayType,
    assayType: draft.assayType,
    datasetName: draft.batch.trim() || draft.analyte.trim() || draft.parameter.trim() || CHAR_LABELS[draft.assayType],
    laboratoryName: "",
    datePerformed: draft.date,
    protocolReference: draft.method.trim(),
    instrument: draft.instrument.trim() || undefined,
    outsourcedLab: false,
    characterization: payload,
    treatmentSummaries: [],
    observations: [],
    notes: notes || undefined,
    status: "final",
    provenance: {
      evidenceClass: "EXPERIMENTAL",
      methodName: draft.method.trim() || CHAR_LABELS[draft.assayType],
      source: "Laboratory measurement",
      recordedAt: draft.date,
    },
  }
}

function characterizationPayload(draft: CharDraft): LabDatasetInput["characterization"] | null {
  if (draft.assayType === "hplc") {
    const retentionTimeMin = optionalNumber("Retention time", draft.retention)
    const peakArea = optionalNumber("Peak area", draft.peakArea)
    const measuredQuercetinConcentration = optionalNumber("Concentration", draft.concentration)
    if (!draft.analyte.trim() && retentionTimeMin == null && peakArea == null && measuredQuercetinConcentration == null) return null
    return {
      hplc: {
        markerCompound: draft.analyte.trim() || undefined,
        retentionTimeMin,
        peakArea,
        measuredQuercetinConcentration,
        concentrationUnit: draft.unit.trim() || undefined,
      },
    }
  }
  if (!draft.parameter.trim() || !draft.value.trim()) return null
  const key = draft.parameter.trim().toLowerCase()
  const numeric = Number(draft.value)
  const hasNumber = Number.isFinite(numeric)
  if (draft.assayType === "proximate") {
    const field = proximateField(key)
    return { proximate: { ...(field && hasNumber ? { [field]: numeric } : {}), unit: draft.unit.trim() || undefined } }
  }
  if (draft.assayType === "nutritive") {
    const field = nutritiveField(key)
    return { nutritive: field && hasNumber ? { [field]: numeric, ...(field === "energy" ? { energyUnit: draft.unit.trim() || undefined } : {}) } : { servingInfo: `${draft.parameter.trim()}: ${draft.value.trim()}` } }
  }
  if (draft.assayType === "pb") {
    if (!hasNumber) throw new Error("Pb measurement must be a number.")
    const unit = draft.unit.trim().toLowerCase()
    return {
      pb: {
        measuredValue: numeric,
        unit: unit === "ppm" ? "ppm" : unit === "mg/kg" || unit === "mg_per_kg" ? "mg_per_kg" : "other",
      },
    }
  }
  if (draft.assayType === "sensory") {
    if (key.includes("accept")) return { sensory: { overallAcceptability: hasNumber ? numeric : undefined, scaleProtocol: draft.method.trim() || undefined, timepoint: draft.parameter.trim() } }
    if (key.includes("odor") || key.includes("odour")) return { sensory: { odor: draft.value.trim() } }
    if (key.includes("taste")) return { sensory: { taste: draft.value.trim() } }
    return { sensory: { appearance: `${draft.parameter.trim()}: ${draft.value.trim()}` } }
  }
  if (draft.assayType === "microbial") {
    if (key.includes("yeast") || key.includes("mold") || key.includes("mould")) {
      return { microbial: { yeastMold: hasNumber ? numeric : undefined, units: draft.unit.trim() || undefined, timepoint: draft.parameter.trim() } }
    }
    return { microbial: { apc: hasNumber ? numeric : undefined, units: draft.unit.trim() || undefined, timepoint: draft.parameter.trim() } }
  }
  return {
    stability: {
      timepoint: draft.parameter.trim(),
      observations: `${draft.value.trim()}${draft.unit.trim() ? ` ${draft.unit.trim()}` : ""}`,
    },
  }
}

function proximateField(key: string): "moisture" | "ash" | "protein" | "fat" | "fiber" | null {
  if (key.includes("moisture")) return "moisture"
  if (key.includes("ash")) return "ash"
  if (key.includes("protein")) return "protein"
  if (key.includes("fat")) return "fat"
  if (key.includes("fiber") || key.includes("fibre")) return "fiber"
  return null
}

function nutritiveField(key: string): "carbohydrates" | "energy" | "fat" | "protein" | null {
  if (key.includes("carb")) return "carbohydrates"
  if (key.includes("energy")) return "energy"
  if (key.includes("fat")) return "fat"
  if (key.includes("protein")) return "protein"
  return null
}

function characterizationLines(dataset: LabDataset): Array<{ label: string; value: string }> {
  const lines: Array<{ label: string; value: string }> = []
  const add = (label: string, value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === "") return
    lines.push({ label, value: String(value) })
  }
  add("Date", dataset.datePerformed.slice(0, 10))
  add("Sample / batch", dataset.datasetName)
  add("Method", dataset.protocolReference)
  add("Instrument", dataset.instrument)
  const payload = dataset.characterization
  const hplc = payload?.hplc
  add("Analyte", hplc?.markerCompound)
  add("Retention time (min)", hplc?.retentionTimeMin)
  add("Peak area", hplc?.peakArea)
  add("Concentration", hplc?.measuredQuercetinConcentration != null ? `${hplc.measuredQuercetinConcentration}${hplc.concentrationUnit ? ` ${hplc.concentrationUnit}` : ""}` : undefined)
  const proximate = payload?.proximate
  add("Moisture", proximate?.moisture)
  add("Ash", proximate?.ash)
  add("Protein", proximate?.protein)
  add("Fat", proximate?.fat)
  add("Fiber", proximate?.fiber)
  add("Unit", proximate?.unit)
  const nutritive = payload?.nutritive
  add("Carbohydrates", nutritive?.carbohydrates)
  add("Energy", nutritive?.energy != null ? `${nutritive.energy}${nutritive.energyUnit ? ` ${nutritive.energyUnit}` : ""}` : undefined)
  add("Fat", nutritive?.fat)
  add("Protein", nutritive?.protein)
  add("Serving", nutritive?.servingInfo)
  const pb = payload?.pb
  add("Measured Pb", pb?.measuredValue != null ? `${pb.measuredValue}${pb.unit ? ` ${pb.unit}` : ""}` : undefined)
  const sensory = payload?.sensory
  add("Appearance", sensory?.appearance)
  add("Odor", sensory?.odor)
  add("Taste", sensory?.taste)
  add("Acceptability", sensory?.overallAcceptability)
  const microbial = payload?.microbial
  add("APC", microbial?.apc)
  add("Yeast and mold", microbial?.yeastMold)
  add("Units", microbial?.units)
  const stability = payload?.stability
  add("Timepoint", stability?.timepoint)
  add("Observation", stability?.observations)
  add("Notes", dataset.notes)
  return lines
}

function charDraftFromDataset(dataset?: LabDataset): CharDraft {
  const draft = emptyCharDraft()
  if (!dataset || !CHARACTERIZATION_ASSAYS.includes(dataset.assayType as CharacterizationAssay)) return draft
  const assayType = dataset.assayType as CharacterizationAssay
  const hplc = dataset.characterization?.hplc
  return {
    ...draft,
    assayType,
    date: dataset.datePerformed.slice(0, 10),
    method: dataset.protocolReference === CHAR_LABELS[assayType] ? "" : dataset.protocolReference,
    instrument: dataset.instrument ?? "",
    batch: dataset.datasetName,
    notes: dataset.notes ?? "",
    analyte: hplc?.markerCompound ?? "",
    retention: hplc?.retentionTimeMin != null ? String(hplc.retentionTimeMin) : "",
    peakArea: hplc?.peakArea != null ? String(hplc.peakArea) : "",
    concentration: hplc?.measuredQuercetinConcentration != null ? String(hplc.measuredQuercetinConcentration) : "",
    unit: hplc?.concentrationUnit ?? "",
  }
}
