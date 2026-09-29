"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { ModuleShell } from "@/components/ui/ModuleShell"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useStudy } from "@/components/providers/StudyProvider"
import { useAuth } from "@/components/providers/AuthProvider"
import {
  canEditScientificRuns,
  scientificRunRoleLabel,
} from "@/lib/permissions/researchAccess"
import { ResearchToolbar } from "@/components/research/ResearchToolbar"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import {
  FieldGrid,
  FormField,
  MetaField,
  inputClass,
  inputStyle,
  textareaClass,
} from "@/components/research/FormFields"
import {
  PredictionChart,
  PredictionMethodCard,
  PredictionResultsTable,
} from "@/components/insilico/prediction/PredictionParts"
import type {
  CellLineRecord,
  Compound,
  Formulation,
  PredictionEndpoint,
  PredictionMethodType,
  PredictionRun,
  PredictionRunInput,
} from "@/lib/domain/models"
import { getPredictionEndpoint } from "@/lib/insilico/predictionEndpoints"
import {
  listCellLines,
  listCompounds,
  listFormulations,
} from "@/lib/repositories/researchDataRepository"
import {
  createPredictionRun,
  deletePredictionRun,
  listPredictionRuns,
  updatePredictionRun,
} from "@/lib/repositories/scientificRunRepository"
import { toUserFacingError } from "@/lib/errors/userFacing"

type Mode = "view" | "create" | "edit"

const METHOD_TYPES: PredictionMethodType[] = [
  "documented_model",
  "external_tool",
  "literature_derived_computation",
  "exploratory_math",
  "other",
]

interface PointRow {
  concentration: string
  metric: string
  value: string
  valueUnit: string
  notes: string
}

interface FormState {
  runName: string
  compoundId: string
  formulationId: string
  cellLineId: string
  methodName: string
  methodVersion: string
  methodType: PredictionMethodType
  source: string
  assumptions: string
  limitations: string
  dateGenerated: string
  operatorName: string
  evidenceClass: "PREDICTED" | "SIMULATION"
  points: PointRow[]
  notes: string
}

function blankForm(endpoint: PredictionEndpoint, cfg = getPredictionEndpoint(endpoint)): FormState {
  return {
    runName: "",
    compoundId: "",
    formulationId: "",
    cellLineId: "",
    methodName: "",
    methodVersion: "",
    methodType: "documented_model",
    source: "",
    assumptions: "",
    limitations: "",
    dateGenerated: new Date().toISOString().slice(0, 10),
    operatorName: "",
    evidenceClass: "PREDICTED",
    points: [],
    notes: "",
  }
}

function fromRecord(r: PredictionRun, cfgMetric: string, cfgUnit: string): FormState {
  return {
    runName: r.runName,
    compoundId: r.compoundId ?? "",
    formulationId: r.formulationId ?? "",
    cellLineId: r.cellLineId ?? "",
    methodName: r.methodName,
    methodVersion: r.methodVersion ?? "",
    methodType: r.methodType,
    source: r.source,
    assumptions: r.assumptions ?? "",
    limitations: r.limitations ?? "",
    dateGenerated: r.dateGenerated.slice(0, 10),
    operatorName: r.operatorName ?? "",
    evidenceClass:
      r.provenance.evidenceClass === "SIMULATION" ? "SIMULATION" : "PREDICTED",
    points: (r.resultPoints ?? []).map((p) => ({
      concentration: String(p.concentration),
      metric: p.metric || cfgMetric,
      value: String(p.value),
      valueUnit: p.valueUnit || cfgUnit,
      notes: p.notes ?? "",
    })),
    notes: r.notes ?? "",
  }
}

function buildInput(
  endpoint: PredictionEndpoint,
  form: FormState
): PredictionRunInput {
  const cfg = getPredictionEndpoint(endpoint)
  if (!form.runName.trim()) throw new Error("Run name is required.")
  if (!form.methodName.trim()) throw new Error("Method name is required.")
  if (!form.source.trim()) throw new Error("Source description is required.")
  if (!form.dateGenerated.trim()) throw new Error("Date generated is required.")

  if (form.evidenceClass === "PREDICTED" && form.methodType === "exploratory_math") {
    throw new Error("Use SIMULATION evidence for exploratory_math methods.")
  }
  if (form.evidenceClass === "SIMULATION" && !form.assumptions.trim()) {
    throw new Error("SIMULATION runs require assumptions.")
  }

  const resultPoints = form.points
    .filter((p) => p.concentration.trim() !== "" || p.value.trim() !== "")
    .map((p, idx) => {
      if (p.concentration.trim() === "" || p.value.trim() === "") {
        throw new Error(`Result row ${idx + 1}: enter both concentration and value, or clear the row.`)
      }
      const concentration = Number(p.concentration)
      const value = Number(p.value)
      if (Number.isNaN(concentration) || Number.isNaN(value)) {
        throw new Error(`Result row ${idx + 1}: concentration and value must be numbers from a documented method.`)
      }
      return {
        concentration,
        concentrationUnit: cfg.concentrationUnit,
        metric: (p.metric.trim() || cfg.defaultMetric),
        value,
        valueUnit: (p.valueUnit.trim() || cfg.defaultValueUnit),
        notes: p.notes.trim() || undefined,
      }
    })

  return {
    endpoint,
    module: endpoint,
    runName: form.runName.trim(),
    compoundId: cfg.subjectType === "compound" ? form.compoundId || undefined : undefined,
    formulationId: cfg.subjectType === "formulation" ? form.formulationId || undefined : undefined,
    cellLineId: cfg.requiresCellLine ? form.cellLineId || undefined : undefined,
    methodName: form.methodName.trim(),
    methodVersion: form.methodVersion.trim() || undefined,
    methodType: form.methodType,
    source: form.source.trim(),
    referenceIds: [],
    assumptions: form.assumptions.trim() || undefined,
    limitations: form.limitations.trim() || undefined,
    concentrationUnit: cfg.concentrationUnit,
    dateGenerated: form.dateGenerated.trim(),
    operatorName: form.operatorName.trim() || undefined,
    resultPoints,
    notes: form.notes.trim() || undefined,
    status: "imported",
    provenance: {
      evidenceClass: form.evidenceClass,
      methodName: form.methodName.trim(),
      methodVersion: form.methodVersion.trim() || undefined,
      source: form.source.trim(),
      recordedAt: form.dateGenerated.trim(),
      assumptions: form.assumptions.trim() || undefined,
      limitations: form.limitations.trim() || undefined,
    },
  }
}

export function PredictionWorkspace({ endpoint }: { endpoint: PredictionEndpoint }) {
  const cfg = getPredictionEndpoint(endpoint)
  const Icon = cfg.icon
  const { user, profile } = useAuth()
  const { activeStudy, membership } = useStudy()
  const canEdit = canEditScientificRuns(membership?.role)

  const [compounds, setCompounds] = useState<Compound[]>([])
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [cellLines, setCellLines] = useState<CellLineRecord[]>([])
  const [runs, setRuns] = useState<PredictionRun[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("view")
  const [form, setForm] = useState<FormState>(() => blankForm(endpoint))
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!activeStudy) return
    setLoading(true)
    setError(null)
    try {
      const [c, f, cl, r] = await Promise.all([
        listCompounds(activeStudy.id),
        listFormulations(activeStudy.id),
        listCellLines(activeStudy.id),
        listPredictionRuns(activeStudy.id, endpoint),
      ])
      setCompounds(c)
      setFormulations(f)
      setCellLines(cl)
      setRuns(r)
      setSelectedId((prev) => prev ?? r[0]?.id ?? null)
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load prediction workspace"))
    } finally {
      setLoading(false)
    }
  }, [activeStudy, endpoint])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setMode("view")
    setForm(blankForm(endpoint))
    setSelectedId(null)
    setSearch("")
  }, [endpoint])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return runs
    return runs.filter(
      (r) =>
        r.runName.toLowerCase().includes(q) ||
        r.methodName.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q)
    )
  }, [runs, search])

  const selected = runs.find((r) => r.id === selectedId) ?? null

  const startCreate = () => {
    const next = blankForm(endpoint)
    if (cfg.subjectType === "compound") {
      next.compoundId = compounds.find((c) => c.isPrimaryMarker)?.id ?? compounds[0]?.id ?? ""
    } else {
      next.formulationId =
        formulations.find((f) => f.isCanonical)?.id ?? formulations[0]?.id ?? ""
    }
    if (cfg.requiresCellLine) {
      next.cellLineId =
        cellLines.find((c) => c.isPrimaryExperimental)?.id ??
        cellLines.find((c) => c.name.toLowerCase() === "hepg2")?.id ??
        cellLines[0]?.id ??
        ""
    }
    next.operatorName = profile?.displayName ?? ""
    setForm(next)
    setMode("create")
    setError(null)
  }

  const save = async () => {
    if (!activeStudy || !user) return
    setBusy(true)
    setError(null)
    try {
      const input = buildInput(endpoint, form)
      if (mode === "create") {
        const created = await createPredictionRun(activeStudy.id, { id: user.uid }, input)
        setSelectedId(created.id)
      } else if (mode === "edit" && selected) {
        await updatePredictionRun(activeStudy.id, selected.id, { id: user.uid }, input)
      }
      setMode("view")
      await load()
    } catch (e) {
      setError(toUserFacingError(e, "Save failed"))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!activeStudy || !user || !deleteId) return
    setBusy(true)
    try {
      await deletePredictionRun(activeStudy.id, deleteId, { id: user.uid })
      setDeleteId(null)
      setSelectedId(null)
      setMode("view")
      await load()
    } catch (e) {
      setError(toUserFacingError(e, "Delete failed"))
    } finally {
      setBusy(false)
    }
  }

  const addEmptyPoint = () => {
    setForm({
      ...form,
      points: [
        ...form.points,
        {
          concentration: "",
          metric: cfg.defaultMetric,
          value: "",
          valueUnit: cfg.defaultValueUnit,
          notes: "",
        },
      ],
    })
  }

  const addSuggestedGrid = () => {
    setForm({
      ...form,
      points: cfg.suggestedConcentrations.map((c) => ({
        concentration: String(c),
        metric: cfg.defaultMetric,
        value: "",
        valueUnit: cfg.defaultValueUnit,
        notes: "",
      })),
    })
  }

  if (!activeStudy) {
    return (
      <ModuleShell
        icon={Icon}
        title={cfg.title}
        subtitle={cfg.subtitle}
        evidence={["PREDICTED", "SIMULATION"]}
        phase="insilico"
      >
        <ResearchEmptyState title="No active study" body="Create or select a study first." canEdit={false} />
      </ModuleShell>
    )
  }

  const subjectLabel =
    cfg.subjectType === "compound"
      ? compounds.find((c) => c.id === selected?.compoundId)?.name
      : formulations.find((f) => f.id === selected?.formulationId)?.name
  const cellLabel = cellLines.find((c) => c.id === selected?.cellLineId)?.name

  return (
    <ModuleShell
      icon={Icon}
      title={cfg.title}
      subtitle={cfg.subtitle}
      evidence={["PREDICTED", "SIMULATION"]}
      phase="insilico"
      contractNote={cfg.contractNote}
    >
      <div
        className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
        style={{ background: "#f0fdf9", borderColor: "#00a88244", color: "#0f766e" }}
      >
        <strong>{cfg.banner}</strong> {cfg.forbiddenClaims} {cfg.experimentalNote}
      </div>

      <ResearchToolbar
        search={search}
        onSearchChange={setSearch}
        canEdit={canEdit}
        role={membership?.role}
        onAdd={startCreate}
        addLabel="New prediction run"
        count={filtered.length}
        filterSlot={
          <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
            {scientificRunRoleLabel(membership?.role)}
          </span>
        }
      />

      {error && (
        <p
          className="text-xs rounded-lg px-3 py-2 border"
          style={{ color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
        >
          {error}
        </p>
      )}
      {loading && <p className="text-sm" style={{ color: "#94a3b8" }}>Loading…</p>}

      {!loading && filtered.length === 0 && mode === "view" ? (
        <ResearchEmptyState
          title={`No ${cfg.shortLabel} prediction runs`}
          body="Record outputs from a documented computational method. Do not invent values. Incomplete result tables are allowed."
          canEdit={canEdit}
          actionLabel="New prediction run"
          onAction={startCreate}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div
            className="rounded-xl border p-3 space-y-1 max-h-[640px] overflow-y-auto"
            style={{ background: "#ffffff", borderColor: "#dde5ef" }}
          >
            <p className="text-[10px] font-mono uppercase px-2 mb-1" style={{ color: "#94a3b8" }}>
              Previous runs
            </p>
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedId(r.id)
                  setMode("view")
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold"
                style={{
                  background: r.id === selectedId ? "#00a88212" : "transparent",
                  color: r.id === selectedId ? "#00a882" : "#1a3558",
                }}
              >
                {r.runName}
                <div className="text-[10px] font-mono font-normal" style={{ color: "#94a3b8" }}>
                  {r.provenance.evidenceClass} · {r.resultPoints.length} point
                  {r.resultPoints.length === 1 ? "" : "s"}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {(mode === "create" || mode === "edit") && (
              <div className="rounded-xl border p-4 space-y-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
                    {mode === "create" ? "New prediction run" : "Edit prediction run"}
                  </h2>
                  <button type="button" onClick={() => setMode("view")}>
                    <X size={16} style={{ color: "#94a3b8" }} />
                  </button>
                </div>

                {form.evidenceClass === "SIMULATION" && (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ background: "#fff7ed", borderColor: "#fdba74", color: "#c2410c" }}
                  >
                    Exploratory simulation — not a validated predictive model and not an experimental
                    result.
                  </div>
                )}

                <FormField label="Run name" required>
                  <input
                    className={inputClass}
                    style={inputStyle}
                    value={form.runName}
                    onChange={(e) => setForm({ ...form, runName: e.target.value })}
                  />
                </FormField>

                <FieldGrid>
                  {cfg.subjectType === "compound" ? (
                    <FormField label="Compound" required>
                      <select
                        className={inputClass}
                        style={inputStyle}
                        value={form.compoundId}
                        onChange={(e) => setForm({ ...form, compoundId: e.target.value })}
                      >
                        <option value="">Select compound…</option>
                        {compounds.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  ) : (
                    <FormField label="Formulation" required>
                      <select
                        className={inputClass}
                        style={inputStyle}
                        value={form.formulationId}
                        onChange={(e) => setForm({ ...form, formulationId: e.target.value })}
                      >
                        <option value="">Select formulation…</option>
                        {formulations.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  )}
                  {cfg.requiresCellLine && (
                    <FormField label="Cell line" required hint={cfg.primaryCellLineHint ? `Primary: ${cfg.primaryCellLineHint}` : undefined}>
                      <select
                        className={inputClass}
                        style={inputStyle}
                        value={form.cellLineId}
                        onChange={(e) => setForm({ ...form, cellLineId: e.target.value })}
                      >
                        <option value="">Select cell line…</option>
                        {cellLines.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.isPrimaryExperimental ? " (primary)" : ""}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  )}
                </FieldGrid>

                <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
                  <p className="text-[10px] font-mono uppercase" style={{ color: "#546e8a" }}>
                    Evidence & method
                  </p>
                  <FieldGrid>
                    <FormField label="Evidence class" required>
                      <select
                        className={inputClass}
                        style={inputStyle}
                        value={form.evidenceClass}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            evidenceClass: e.target.value as "PREDICTED" | "SIMULATION",
                          })
                        }
                      >
                        <option value="PREDICTED">PREDICTED (documented method)</option>
                        <option value="SIMULATION">SIMULATION (exploratory only)</option>
                      </select>
                    </FormField>
                    <FormField label="Method type" required>
                      <select
                        className={inputClass}
                        style={inputStyle}
                        value={form.methodType}
                        onChange={(e) =>
                          setForm({ ...form, methodType: e.target.value as PredictionMethodType })
                        }
                      >
                        {METHOD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Method name" required>
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.methodName}
                        onChange={(e) => setForm({ ...form, methodName: e.target.value })}
                        placeholder="Documented model / tool name"
                      />
                    </FormField>
                    <FormField label="Method version">
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.methodVersion}
                        onChange={(e) => setForm({ ...form, methodVersion: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Source" required>
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.source}
                        onChange={(e) => setForm({ ...form, source: e.target.value })}
                        placeholder="Export, notebook, citation, or tool log"
                      />
                    </FormField>
                    <FormField label="Date generated" required>
                      <input
                        type="date"
                        className={inputClass}
                        style={inputStyle}
                        value={form.dateGenerated}
                        onChange={(e) => setForm({ ...form, dateGenerated: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Operator">
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.operatorName}
                        onChange={(e) => setForm({ ...form, operatorName: e.target.value })}
                      />
                    </FormField>
                  </FieldGrid>
                  <FormField label="Assumptions" required={form.evidenceClass === "SIMULATION"}>
                    <textarea
                      className={textareaClass}
                      style={inputStyle}
                      value={form.assumptions}
                      onChange={(e) => setForm({ ...form, assumptions: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Limitations">
                    <textarea
                      className={textareaClass}
                      style={inputStyle}
                      value={form.limitations}
                      onChange={(e) => setForm({ ...form, limitations: e.target.value })}
                    />
                  </FormField>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-[10px] font-mono uppercase" style={{ color: "#546e8a" }}>
                      Result points ({cfg.concentrationUnitLabel}) — enter only real method outputs
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs font-semibold"
                        style={{ color: "#0369a1" }}
                        onClick={addSuggestedGrid}
                      >
                        Prefill concentration grid (blank values)
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "#00a882" }}
                        onClick={addEmptyPoint}
                      >
                        <Plus size={12} /> Add row
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] mb-2" style={{ color: "#94a3b8" }}>
                    Suggested grid: {cfg.suggestedConcentrations.join(", ")} {cfg.concentrationUnitLabel}.
                    Values stay empty until you enter documented outputs. Incomplete datasets are allowed.
                  </p>
                  {form.points.length === 0 ? (
                    <p className="text-xs mb-2" style={{ color: "#94a3b8" }}>
                      No result rows yet — you may save method metadata without points.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#dde5ef" }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "#f8fafc", color: "#546e8a" }}>
                            <th className="text-left p-2">Conc.</th>
                            <th className="text-left p-2">Metric</th>
                            <th className="text-left p-2">Value</th>
                            <th className="text-left p-2">Unit</th>
                            <th className="text-left p-2">Notes</th>
                            <th className="p-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {form.points.map((p, idx) => (
                            <tr key={idx} style={{ borderTop: "1px solid #e2e8f0" }}>
                              {(
                                [
                                  ["concentration", "conc"],
                                  ["metric", "metric"],
                                  ["value", "value"],
                                  ["valueUnit", "unit"],
                                  ["notes", "notes"],
                                ] as const
                              ).map(([field]) => (
                                <td key={field} className="p-1">
                                  <input
                                    className={inputClass}
                                    style={inputStyle}
                                    value={p[field]}
                                    onChange={(e) => {
                                      const next = [...form.points]
                                      next[idx] = { ...p, [field]: e.target.value }
                                      setForm({ ...form, points: next })
                                    }}
                                  />
                                </td>
                              ))}
                              <td className="p-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      points: form.points.filter((_, i) => i !== idx),
                                    })
                                  }
                                >
                                  <Trash2 size={12} style={{ color: "#b91c1c" }} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <FormField label="Notes">
                  <textarea
                    className={textareaClass}
                    style={inputStyle}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </FormField>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("view")}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold border"
                    style={{ borderColor: "#dde5ef", color: "#546e8a" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save()}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ background: "#00a882" }}
                  >
                    {busy ? "Saving…" : "Save run"}
                  </button>
                </div>
              </div>
            )}

            {mode === "view" && selected && (
              <div className="space-y-4">
                {selected.provenance.evidenceClass === "SIMULATION" && (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ background: "#fff7ed", borderColor: "#fdba74", color: "#c2410c" }}
                  >
                    Exploratory simulation — not a validated predictive model and not an experimental
                    result.
                  </div>
                )}

                <div className="rounded-xl border p-4 space-y-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <EvidenceBadge type={selected.provenance.evidenceClass} />
                      </div>
                      <h2 className="text-lg font-bold" style={{ color: "#0d1f3c" }}>
                        {selected.runName}
                      </h2>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForm(fromRecord(selected, cfg.defaultMetric, cfg.defaultValueUnit))
                            setMode("edit")
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                          style={{ borderColor: "#dde5ef", color: "#1a3558" }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(selected.id)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                          style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <FieldGrid>
                    <MetaField
                      label={cfg.subjectType === "compound" ? "Compound" : "Formulation"}
                      value={subjectLabel}
                    />
                    {cfg.requiresCellLine && <MetaField label="Cell line" value={cellLabel} />}
                    <MetaField label="Unit" value={cfg.concentrationUnitLabel} />
                  </FieldGrid>

                  {selected.notes && <MetaField label="Notes" value={selected.notes} />}

                  <div>
                    <p className="text-[10px] font-mono uppercase mb-2" style={{ color: "#94a3b8" }}>
                      Results
                    </p>
                    <PredictionResultsTable run={selected} unitLabel={cfg.concentrationUnitLabel} />
                  </div>

                  <div>
                    <p className="text-[10px] font-mono uppercase mb-2" style={{ color: "#94a3b8" }}>
                      Chart (stored points only)
                    </p>
                    <PredictionChart run={selected} unitLabel={cfg.concentrationUnitLabel} />
                  </div>

                  <PredictionMethodCard run={selected} config={cfg} />
                </div>
              </div>
            )}

            {mode === "view" && !selected && !loading && (
              <ResearchEmptyState
                title="Select a prediction run"
                body="Choose a previous run or create a new documented import."
                canEdit={canEdit}
                actionLabel="New prediction run"
                onAction={startCreate}
              />
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete prediction run?"
        message="Removes this computational prediction record from the current study."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
      />
    </ModuleShell>
  )
}
