"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { ModuleShell } from "@/components/ui/ModuleShell"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useStudy } from "@/components/providers/StudyProvider"
import { useAuth } from "@/components/providers/AuthProvider"
import { canEditLabData } from "@/lib/permissions/researchAccess"
import { ResearchToolbar } from "@/components/research/ResearchToolbar"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import {
  FieldGrid,
  FormField,
  inputClass,
  inputStyle,
  textareaClass,
} from "@/components/research/FormFields"
import {
  DerivedSummaryPanel,
  LabAssayChart,
  LabBanner,
  LabProvenanceCard,
  RawReplicatesTable,
  TreatmentDesignCard,
} from "@/components/lab/AssayParts"
import { getLabAssayConfig } from "@/lib/lab/labAssayConfig"
import { summarizeMetricByTreatment } from "@/lib/lab/labCalculations"
import type {
  CellLineRecord,
  Formulation,
  LabDataset,
  LabDatasetInput,
  LabReplicate,
  LabReplicateCode,
  LabTreatmentCode,
} from "@/lib/domain/models"
import {
  createLabDataset,
  createLabReplicate,
  deleteLabDataset,
  deleteLabReplicate,
  listLabDatasets,
  listLabReplicates,
  updateLabDataset,
  updateLabReplicate,
} from "@/lib/repositories/labRepository"
import { listCellLines, listFormulations } from "@/lib/repositories/researchDataRepository"
import { toUserFacingError } from "@/lib/errors/userFacing"

type Mode = "view" | "create" | "edit"

interface MeasurementRow {
  treatmentCode: LabTreatmentCode
  replicateCode: LabReplicateCode
  values: Record<string, string>
  notes: string
  existingId?: string
}

interface FormState {
  datasetName: string
  formulationId: string
  cellLineId: string
  cellLineName: string
  laboratoryName: string
  datePerformed: string
  protocolReference: string
  kitName: string
  kitManufacturer: string
  instrument: string
  wavelengthNm: string
  operatorName: string
  outsourcedLab: boolean
  controlT1Detail: string
  controlT2Detail: string
  notes: string
  assumptions: string
  limitations: string
  status: "draft" | "locked" | "final"
  ic50Value: string
  ic50Unit: string
  ic50Method: string
  ic50By: string
  ic50Notes: string
  rows: MeasurementRow[]
}

function emptyRows(assay: "dpph" | "ldh"): MeasurementRow[] {
  const cfg = getLabAssayConfig(assay)
  const reps: LabReplicateCode[] = ["R1", "R2", "R3"]
  const rows: MeasurementRow[] = []
  for (const t of cfg.treatments) {
    for (const r of reps) {
      rows.push({
        treatmentCode: t.code,
        replicateCode: r,
        values: Object.fromEntries(cfg.measurementKeys.map((m) => [m.key, ""])),
        notes: "",
      })
    }
  }
  return rows
}

function blankForm(assay: "dpph" | "ldh"): FormState {
  const cfg = getLabAssayConfig(assay)
  return {
    datasetName: "",
    formulationId: "",
    cellLineId: "",
    cellLineName: assay === "ldh" ? "HepG2" : "",
    laboratoryName: "",
    datePerformed: new Date().toISOString().slice(0, 10),
    protocolReference: "",
    kitName: "",
    kitManufacturer: "",
    instrument: "",
    wavelengthNm: cfg.defaultWavelengthNm != null ? String(cfg.defaultWavelengthNm) : "",
    operatorName: "",
    outsourcedLab: false,
    controlT1Detail: "",
    controlT2Detail: "",
    notes: "",
    assumptions: "",
    limitations: "",
    status: "draft",
    ic50Value: "",
    ic50Unit: "µg/mL",
    ic50Method: "",
    ic50By: "",
    ic50Notes: "",
    rows: emptyRows(assay),
  }
}

function rowsFromReplicates(assay: "dpph" | "ldh", reps: LabReplicate[]): MeasurementRow[] {
  const base = emptyRows(assay)
  return base.map((row) => {
    const found = reps.find(
      (r) => r.treatmentCode === row.treatmentCode && r.replicateCode === row.replicateCode
    )
    if (!found) return row
    const values = { ...row.values }
    for (const key of Object.keys(values)) {
      const v = found.measurements[key]
      values[key] = v == null || v === "" ? "" : String(v)
    }
    return {
      ...row,
      values,
      notes: found.notes ?? "",
      existingId: found.id,
    }
  })
}

function fromDataset(assay: "dpph" | "ldh", d: LabDataset, reps: LabReplicate[]): FormState {
  return {
    datasetName: d.datasetName,
    formulationId: d.formulationId ?? "",
    cellLineId: d.cellLineId ?? "",
    cellLineName: d.cellLineName ?? (assay === "ldh" ? "HepG2" : ""),
    laboratoryName: d.laboratoryName,
    datePerformed: d.datePerformed.slice(0, 10),
    protocolReference: d.protocolReference,
    kitName: d.kitName ?? "",
    kitManufacturer: d.kitManufacturer ?? "",
    instrument: d.instrument ?? "",
    wavelengthNm: d.wavelengthNm != null ? String(d.wavelengthNm) : "",
    operatorName: d.operatorName ?? "",
    outsourcedLab: d.outsourcedLab,
    controlT1Detail: d.controlT1Detail ?? "",
    controlT2Detail: d.controlT2Detail ?? "",
    notes: d.notes ?? "",
    assumptions: d.provenance.assumptions ?? "",
    limitations: d.provenance.limitations ?? "",
    status: d.status,
    ic50Value: d.ic50 ? String(d.ic50.value) : "",
    ic50Unit: d.ic50?.unit ?? "µg/mL",
    ic50Method: d.ic50?.method ?? "",
    ic50By: d.ic50?.calculatedBy ?? "",
    ic50Notes: d.ic50?.notes ?? "",
    rows: rowsFromReplicates(assay, reps),
  }
}

function parseOptionalNumber(s: string): number | undefined {
  if (!s.trim()) return undefined
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${s}`)
  return n
}

export function AssayWorkspace({ assay }: { assay: "dpph" | "ldh" }) {
  const cfg = getLabAssayConfig(assay)
  const { user } = useAuth()
  const { activeStudy, membership } = useStudy()
  const canEdit = canEditLabData(membership?.role)
  const studyId = activeStudy?.id

  const [search, setSearch] = useState("")
  const [datasets, setDatasets] = useState<LabDataset[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replicates, setReplicates] = useState<LabReplicate[]>([])
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [cellLines, setCellLines] = useState<CellLineRecord[]>([])
  const [mode, setMode] = useState<Mode>("view")
  const [form, setForm] = useState<FormState>(() => blankForm(assay))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filteredDatasets = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return datasets
    return datasets.filter(
      (d) =>
        d.datasetName.toLowerCase().includes(q) ||
        d.laboratoryName.toLowerCase().includes(q)
    )
  }, [datasets, search])

  const selected = useMemo(
    () => datasets.find((d) => d.id === selectedId) ?? null,
    [datasets, selectedId]
  )

  const liveSummaries = useMemo(() => {
    const metrics = cfg.measurementKeys.map((m) => m.key)
    return metrics.flatMap((m) => summarizeMetricByTreatment(replicates, m))
  }, [replicates, cfg.measurementKeys])

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    setError(null)
    try {
      const [ds, forms, cells] = await Promise.all([
        listLabDatasets(studyId, assay),
        listFormulations(studyId),
        listCellLines(studyId),
      ])
      setDatasets(ds)
      setFormulations(forms)
      setCellLines(cells)
      if (selectedId && !ds.some((d) => d.id === selectedId)) {
        setSelectedId(null)
        setReplicates([])
      }
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load lab datasets"))
    } finally {
      setLoading(false)
    }
  }, [studyId, assay, selectedId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!studyId || !selectedId || mode !== "view") return
    let cancelled = false
    ;(async () => {
      try {
        const reps = await listLabReplicates(studyId, selectedId)
        if (!cancelled) setReplicates(reps)
      } catch (e) {
        if (!cancelled) setError(toUserFacingError(e, "Failed to load replicates"))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studyId, selectedId, mode])

  const startCreate = () => {
    setMode("create")
    setForm(blankForm(assay))
    setSelectedId(null)
    setReplicates([])
    setError(null)
  }

  const startEdit = async () => {
    if (!studyId || !selected) return
    setError(null)
    try {
      const reps = await listLabReplicates(studyId, selected.id)
      setReplicates(reps)
      setForm(fromDataset(assay, selected, reps))
      setMode("edit")
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load replicates for edit"))
    }
  }

  const cancelForm = () => {
    setMode("view")
    setError(null)
  }

  const buildInput = (): LabDatasetInput => {
    const wavelength = parseOptionalNumber(form.wavelengthNm)
    const ic50Value = parseOptionalNumber(form.ic50Value)
    if (ic50Value !== undefined && !form.ic50Method.trim()) {
      throw new Error("IC50 requires an external calculation method.")
    }

    const hepg2 = cellLines.find((c) => /hepg2/i.test(c.name))
    const cellLineId =
      form.cellLineId ||
      (assay === "ldh" ? hepg2?.id : undefined) ||
      undefined

    return {
      assay,
      assayType: assay,
      datasetName: form.datasetName.trim(),
      formulationId: form.formulationId || undefined,
      cellLineId,
      cellLineName:
        form.cellLineName.trim() ||
        (assay === "ldh" ? "HepG2" : undefined) ||
        cellLines.find((c) => c.id === cellLineId)?.name,
      laboratoryName: form.laboratoryName.trim(),
      datePerformed: form.datePerformed,
      protocolReference: form.protocolReference.trim(),
      protocolRef: form.protocolReference.trim(),
      kitName: form.kitName.trim() || undefined,
      kitManufacturer: form.kitManufacturer.trim() || undefined,
      instrument: form.instrument.trim() || undefined,
      wavelengthNm: wavelength,
      operatorName: form.operatorName.trim() || undefined,
      outsourcedLab: form.outsourcedLab,
      concentrationUnit: "ug_per_mL",
      controlT1Detail: form.controlT1Detail.trim() || undefined,
      controlT2Detail: form.controlT2Detail.trim() || undefined,
      notes: form.notes.trim() || undefined,
      status: form.status,
      treatmentSummaries: [],
      ic50:
        ic50Value !== undefined
          ? {
              value: ic50Value,
              unit: form.ic50Unit.trim() || "µg/mL",
              method: form.ic50Method.trim(),
              calculatedBy: form.ic50By.trim() || undefined,
              notes: form.ic50Notes.trim() || undefined,
              dataClass: "DERIVED_FROM_EXPERIMENTAL",
            }
          : undefined,
      provenance: {
        evidenceClass: "EXPERIMENTAL",
        laboratoryName: form.laboratoryName.trim(),
        protocolRef: form.protocolReference.trim(),
        methodName: form.protocolReference.trim(),
        source: form.laboratoryName.trim(),
        recordedAt: form.datePerformed,
        assumptions: form.assumptions.trim() || undefined,
        limitations: form.limitations.trim() || undefined,
      },
    }
  }

  const syncReplicates = async (datasetId: string, actorId: string) => {
    if (!studyId) return
    const existing = await listLabReplicates(studyId, datasetId)
    const existingByKey = new Map(
      existing.map((r) => [`${r.treatmentCode}:${r.replicateCode}`, r])
    )

    for (const row of form.rows) {
      const measurements: Record<string, number | null> = {}
      let hasAny = false
      for (const m of cfg.measurementKeys) {
        const raw = row.values[m.key]?.trim() ?? ""
        if (raw === "") {
          measurements[m.key] = null
        } else {
          const n = Number(raw)
          if (!Number.isFinite(n)) throw new Error(`Invalid ${m.label} for ${row.treatmentCode} ${row.replicateCode}`)
          measurements[m.key] = n
          hasAny = true
        }
      }
      if (!hasAny && !row.notes.trim() && !row.existingId) continue

      const def = cfg.treatments.find((t) => t.code === row.treatmentCode)!
      const payload = {
        treatmentCode: row.treatmentCode,
        replicateCode: row.replicateCode,
        replicateN: row.replicateCode === "R1" ? 1 : row.replicateCode === "R2" ? 2 : 3,
        concentration: def.concentrationUgPerMl,
        concentrationUnit: "ug_per_mL" as const,
        measurements,
        notes: row.notes.trim() || undefined,
        dataClass: "RAW_EXPERIMENTAL" as const,
      }

      const key = `${row.treatmentCode}:${row.replicateCode}`
      const prev = existingByKey.get(key)
      if (prev) {
        if (!hasAny && !row.notes.trim()) {
          await deleteLabReplicate(studyId, datasetId, prev.id, { id: actorId })
        } else {
          await updateLabReplicate(studyId, datasetId, prev.id, { id: actorId }, payload)
        }
        existingByKey.delete(key)
      } else if (hasAny || row.notes.trim()) {
        await createLabReplicate(studyId, datasetId, { id: actorId }, payload)
      }
    }

    // Leave orphaned replicates untouched only if not in grid — grid covers all T×R
    for (const leftover of existingByKey.values()) {
      // Rows with no values were skipped on create; if previously existed and now empty, deleted above
      void leftover
    }
  }

  const save = async () => {
    if (!studyId || !user) return
    setSaving(true)
    setError(null)
    try {
      const input = buildInput()
      let datasetId: string
      if (mode === "create") {
        const created = await createLabDataset(studyId, { id: user.uid }, input)
        datasetId = created.id
      } else if (mode === "edit" && selected) {
        await updateLabDataset(studyId, selected.id, { id: user.uid }, input)
        datasetId = selected.id
      } else {
        throw new Error("Invalid save mode")
      }

      await syncReplicates(datasetId, user.uid)

      // Persist derived summaries without inventing values
      const reps = await listLabReplicates(studyId, datasetId)
      const summaries = cfg.measurementKeys.flatMap((m) =>
        summarizeMetricByTreatment(reps, m.key)
      )
      const current = await listLabDatasets(studyId, assay)
      const ds = current.find((d) => d.id === datasetId)
      if (ds) {
        await updateLabDataset(studyId, datasetId, { id: user.uid }, {
          ...ds,
          treatmentSummaries: summaries,
          provenance: ds.provenance,
        })
      }

      setMode("view")
      setSelectedId(datasetId)
      await load()
      setReplicates(reps)
    } catch (e) {
      setError(toUserFacingError(e, "Save failed"))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!studyId || !user || !deleteId) return
    setSaving(true)
    setError(null)
    try {
      await deleteLabDataset(studyId, deleteId, { id: user.uid })
      setDeleteId(null)
      setSelectedId(null)
      setReplicates([])
      await load()
    } catch (e) {
      setError(toUserFacingError(e, "Delete failed"))
    } finally {
      setSaving(false)
    }
  }

  const updateRow = (index: number, patch: Partial<MeasurementRow>) => {
    setForm((f) => ({
      ...f,
      rows: f.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }))
  }

  if (!studyId) {
    return (
      <ModuleShell
        icon={cfg.icon}
        title={cfg.title}
        subtitle={cfg.subtitle}
        evidence="EXPERIMENTAL"
        phase="lab"
        contractNote={cfg.contractNote}
      >
        <ResearchEmptyState
          title="Select or create a study"
          body="Laboratory datasets are study-scoped."
          canEdit={false}
        />
      </ModuleShell>
    )
  }

  return (
    <ModuleShell
      icon={cfg.icon}
      title={cfg.title}
      subtitle={cfg.subtitle}
      evidence="EXPERIMENTAL"
      phase="lab"
      contractNote={cfg.contractNote}
    >
      <LabBanner text={cfg.banner} />

      <ResearchToolbar
        search={search}
        onSearchChange={setSearch}
        canEdit={canEdit}
        role={membership?.role}
        onAdd={startCreate}
        addLabel="New dataset"
        count={filteredDatasets.length}
      />

      {error && (
        <div className="rounded-lg border px-3 py-2 text-sm" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {mode === "view" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
              Datasets
            </h2>
            {loading && <p className="text-xs" style={{ color: "#94a3b8" }}>Loading…</p>}
            {!loading && !filteredDatasets.length && (
              <ResearchEmptyState
                title="No experimental datasets"
                body="Create a dataset to record actual laboratory measurements. No values are generated."
                canEdit={canEdit}
                actionLabel="New dataset"
                onAction={startCreate}
              />
            )}
            {filteredDatasets.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className="w-full text-left rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: selectedId === d.id ? "#00a882" : "#dde5ef",
                  background: selectedId === d.id ? "#00a88210" : "#ffffff",
                  color: "#0d1f3c",
                }}
              >
                <div className="font-semibold">{d.datasetName}</div>
                <div className="text-[10px] font-mono" style={{ color: "#64748b" }}>
                  {d.datePerformed} · {d.laboratoryName}
                </div>
                <EvidenceBadge type="EXPERIMENTAL" className="mt-1" />
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {!selected && (
              <p className="text-sm" style={{ color: "#94a3b8" }}>
                Select a dataset to view treatment design, raw replicates, and derived summaries.
              </p>
            )}
            {selected && (
              <>
                <div className="flex flex-wrap gap-2">
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => void startEdit()}
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold"
                        style={{ borderColor: "#dde5ef", color: "#0d1f3c" }}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(selected.id)}
                        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold"
                        style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </>
                  )}
                </div>

                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                    Dataset information
                  </h3>
                  <LabProvenanceCard dataset={selected} />
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                    Treatment design
                  </h3>
                  <TreatmentDesignCard config={cfg} dataset={selected} />
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                    Raw replicates
                  </h3>
                  <RawReplicatesTable config={cfg} replicates={replicates} />
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                    Derived summary
                  </h3>
                  <DerivedSummaryPanel
                    config={cfg}
                    summaries={selected.treatmentSummaries.length ? selected.treatmentSummaries : liveSummaries}
                    ic50={selected.ic50}
                  />
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                    Visualization
                  </h3>
                  <LabAssayChart
                    config={cfg}
                    summaries={selected.treatmentSummaries.length ? selected.treatmentSummaries : liveSummaries}
                  />
                </section>
              </>
            )}
          </div>
        </div>
      )}

      {(mode === "create" || mode === "edit") && (
        <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: "#dde5ef", background: "#ffffff" }}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
              {mode === "create" ? "Create experimental dataset" : "Edit experimental dataset"}
            </h2>
            <button type="button" onClick={cancelForm} className="p-1 rounded" style={{ color: "#64748b" }}>
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <EvidenceBadge type="EXPERIMENTAL" size="md" />
            <span className="text-xs" style={{ color: "#047857" }}>
              Evidence locked to EXPERIMENTAL — enter only real laboratory measurements.
            </span>
          </div>

          <FieldGrid>
            <FormField label="Dataset name *">
              <input className={inputClass} style={inputStyle} value={form.datasetName} onChange={(e) => setForm({ ...form, datasetName: e.target.value })} />
            </FormField>
            <FormField label="Formulation">
              <select className={inputClass} style={inputStyle} value={form.formulationId} onChange={(e) => setForm({ ...form, formulationId: e.target.value })}>
                <option value="">—</option>
                {formulations.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </FormField>
            {assay === "ldh" && (
              <>
                <FormField label="Cell line * (HepG2)">
                  <select
                    className={inputClass}
                    style={inputStyle}
                    value={form.cellLineId}
                    onChange={(e) => {
                      const cl = cellLines.find((c) => c.id === e.target.value)
                      setForm({
                        ...form,
                        cellLineId: e.target.value,
                        cellLineName: cl?.name || "HepG2",
                      })
                    }}
                  >
                    <option value="">HepG2 (default)</option>
                    {cellLines.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Cell line name">
                  <input className={inputClass} style={inputStyle} value={form.cellLineName} onChange={(e) => setForm({ ...form, cellLineName: e.target.value })} />
                </FormField>
              </>
            )}
            <FormField label="Laboratory / facility *">
              <input className={inputClass} style={inputStyle} value={form.laboratoryName} onChange={(e) => setForm({ ...form, laboratoryName: e.target.value })} />
            </FormField>
            <FormField label="Date performed *">
              <input type="date" className={inputClass} style={inputStyle} value={form.datePerformed} onChange={(e) => setForm({ ...form, datePerformed: e.target.value })} />
            </FormField>
            <FormField label="Protocol / method reference *">
              <input className={inputClass} style={inputStyle} value={form.protocolReference} onChange={(e) => setForm({ ...form, protocolReference: e.target.value })} />
            </FormField>
            <FormField label="Operator">
              <input className={inputClass} style={inputStyle} value={form.operatorName} onChange={(e) => setForm({ ...form, operatorName: e.target.value })} />
            </FormField>
            <FormField label="Outsourced laboratory">
              <label className="flex items-center gap-2 text-xs" style={{ color: "#0d1f3c" }}>
                <input type="checkbox" checked={form.outsourcedLab} onChange={(e) => setForm({ ...form, outsourcedLab: e.target.checked })} />
                Results from external laboratory report
              </label>
            </FormField>
            <FormField label="Kit name">
              <input className={inputClass} style={inputStyle} value={form.kitName} onChange={(e) => setForm({ ...form, kitName: e.target.value })} />
            </FormField>
            <FormField label="Kit manufacturer">
              <input className={inputClass} style={inputStyle} value={form.kitManufacturer} onChange={(e) => setForm({ ...form, kitManufacturer: e.target.value })} />
            </FormField>
            <FormField label="Instrument">
              <input className={inputClass} style={inputStyle} value={form.instrument} onChange={(e) => setForm({ ...form, instrument: e.target.value })} />
            </FormField>
            <FormField label={assay === "dpph" ? "Wavelength (nm) — default 517" : "Wavelength (nm)"}>
              <input className={inputClass} style={inputStyle} value={form.wavelengthNm} onChange={(e) => setForm({ ...form, wavelengthNm: e.target.value })} />
            </FormField>
            <FormField label="T1 protocol detail">
              <input className={inputClass} style={inputStyle} placeholder="Do not invent — record actual solvent/vehicle" value={form.controlT1Detail} onChange={(e) => setForm({ ...form, controlT1Detail: e.target.value })} />
            </FormField>
            <FormField label="T2 protocol detail">
              <input className={inputClass} style={inputStyle} placeholder={assay === "dpph" ? "Ascorbic acid concentration as used" : "Lysis reagent as used (e.g. Triton)"} value={form.controlT2Detail} onChange={(e) => setForm({ ...form, controlT2Detail: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <select className={inputClass} style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}>
                <option value="draft">draft</option>
                <option value="locked">locked</option>
                <option value="final">final</option>
              </select>
            </FormField>
          </FieldGrid>

          <TreatmentDesignCard config={cfg} />

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#64748b" }}>
              Raw replicates (leave blank if not measured)
            </h3>
            <p className="text-[10px] mb-2 font-mono" style={{ color: "#047857" }}>
              RAW EXPERIMENTAL DATA · incomplete datasets allowed · no auto-fill
            </p>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#dde5ef" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#546e8a" }}>
                    <th className="text-left p-2 font-mono">T</th>
                    <th className="text-left p-2 font-mono">R</th>
                    <th className="text-left p-2 font-mono">µg/mL</th>
                    {cfg.measurementKeys.map((m) => (
                      <th key={m.key} className="text-left p-2 font-mono">{m.label}</th>
                    ))}
                    <th className="text-left p-2 font-mono">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {form.rows.map((row, index) => {
                    const def = cfg.treatments.find((t) => t.code === row.treatmentCode)!
                    return (
                      <tr key={`${row.treatmentCode}-${row.replicateCode}`} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td className="p-1.5 font-mono font-semibold">{row.treatmentCode}</td>
                        <td className="p-1.5 font-mono">{row.replicateCode}</td>
                        <td className="p-1.5 font-mono">{def.concentrationUgPerMl ?? "—"}</td>
                        {cfg.measurementKeys.map((m) => (
                          <td key={m.key} className="p-1">
                            <input
                              className={inputClass}
                              style={{ ...inputStyle, minWidth: 72 }}
                              value={row.values[m.key] ?? ""}
                              onChange={(e) =>
                                updateRow(index, {
                                  values: { ...row.values, [m.key]: e.target.value },
                                })
                              }
                            />
                          </td>
                        ))}
                        <td className="p-1">
                          <input
                            className={inputClass}
                            style={{ ...inputStyle, minWidth: 80 }}
                            value={row.notes}
                            onChange={(e) => updateRow(index, { notes: e.target.value })}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: "#fcd34d", background: "#fffbeb" }}>
            <h3 className="text-xs font-bold" style={{ color: "#92400e" }}>
              IC₅₀ (optional — externally calculated only)
            </h3>
            <p className="text-[10px]" style={{ color: "#a16207" }}>
              Do not invent fitting. Record an IC₅₀ only when calculated outside this app with method provenance.
            </p>
            <FieldGrid>
              <FormField label="IC₅₀ value">
                <input className={inputClass} style={inputStyle} value={form.ic50Value} onChange={(e) => setForm({ ...form, ic50Value: e.target.value })} />
              </FormField>
              <FormField label="Unit">
                <input className={inputClass} style={inputStyle} value={form.ic50Unit} onChange={(e) => setForm({ ...form, ic50Unit: e.target.value })} />
              </FormField>
              <FormField label="Method * (if value set)">
                <input className={inputClass} style={inputStyle} value={form.ic50Method} onChange={(e) => setForm({ ...form, ic50Method: e.target.value })} />
              </FormField>
              <FormField label="Calculated by">
                <input className={inputClass} style={inputStyle} value={form.ic50By} onChange={(e) => setForm({ ...form, ic50By: e.target.value })} />
              </FormField>
            </FieldGrid>
            <FormField label="IC₅₀ notes">
              <textarea className={textareaClass} style={inputStyle} value={form.ic50Notes} onChange={(e) => setForm({ ...form, ic50Notes: e.target.value })} />
            </FormField>
          </div>

          <FieldGrid>
            <FormField label="Assumptions">
              <textarea className={textareaClass} style={inputStyle} value={form.assumptions} onChange={(e) => setForm({ ...form, assumptions: e.target.value })} />
            </FormField>
            <FormField label="Limitations / notes">
              <textarea className={textareaClass} style={inputStyle} value={form.limitations || form.notes} onChange={(e) => setForm({ ...form, limitations: e.target.value, notes: e.target.value })} />
            </FormField>
          </FieldGrid>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-bold text-white"
              style={{ background: "#00a882" }}
            >
              <Plus size={12} /> {saving ? "Saving…" : "Save dataset"}
            </button>
            <button type="button" onClick={cancelForm} className="rounded-md border px-3 py-2 text-xs font-semibold" style={{ borderColor: "#dde5ef" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        title="Delete laboratory dataset?"
        message="This permanently removes the dataset and its raw replicates. Derived summaries are removed with it."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={saving}
      />
    </ModuleShell>
  )
}
