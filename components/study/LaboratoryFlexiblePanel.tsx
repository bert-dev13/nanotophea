"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { createPortal } from "react-dom"
import { Plus, X } from "lucide-react"
import type {
  LabDataset,
  LabDatasetInput,
  LabEndpoint,
  LabObservation,
  LabObservationRole,
} from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { deriveMttObservations, formatLabNumber, MTT_INHIBITION_FORMULA, MTT_VIABILITY_FORMULA, summarizeObservations } from "@/lib/lab/derivedAssays"

const COPY: Record<Exclude<LabEndpoint, "dpph" | "ldh">, { title: string; measurement: "absorbance" | "flexible" }> = {
  mtt: { title: "MTT", measurement: "absorbance" },
  ros: { title: "ROS", measurement: "flexible" },
  bax: { title: "BAX", measurement: "flexible" },
  hippo_yap: { title: "Hippo–YAP", measurement: "flexible" },
}

const ROLES: Array<{ id: LabObservationRole | ""; label: string }> = [
  { id: "", label: "Treatment" },
  { id: "untreated", label: "Untreated / negative control" },
  { id: "vehicle", label: "Vehicle control" },
  { id: "positive", label: "Positive control" },
  { id: "treatment", label: "Treatment" },
]

interface Party {
  id: string
  name: string
}

interface RowDraft {
  treatment: string
  concentration: string
  unit: string
  parameter: string
  value: string
  role: LabObservationRole | ""
  replicates: string[]
}

interface Draft {
  date: string
  method: string
  operator: string
  batch: string
  cellLineId: string
  cellLineName: string
  compoundId: string
  proteinId: string
  instrument: string
  wavelength: string
  notes: string
  ic50: string
  ic50Unit: string
  ic50Method: string
  replicateCount: number
  rows: RowDraft[]
}

function emptyRow(replicateCount: number): RowDraft {
  return {
    treatment: "",
    concentration: "",
    unit: "",
    parameter: "",
    value: "",
    role: "",
    replicates: Array.from({ length: replicateCount }, () => ""),
  }
}

function emptyDraft(replicateCount = 3): Draft {
  return {
    date: "",
    method: "",
    operator: "",
    batch: "",
    cellLineId: "",
    cellLineName: "",
    compoundId: "",
    proteinId: "",
    instrument: "",
    wavelength: "",
    notes: "",
    ic50: "",
    ic50Unit: "",
    ic50Method: "",
    replicateCount,
    rows: [emptyRow(replicateCount)],
  }
}

export function FlexibleLabDialog({
  endpoint,
  compounds,
  cellLines,
  proteins,
  defaultCellLineId,
  dataset,
  onClose,
  onSave,
}: {
  endpoint: Exclude<LabEndpoint, "dpph" | "ldh">
  compounds: Party[]
  cellLines: Party[]
  proteins: Party[]
  defaultCellLineId?: string
  dataset?: LabDataset
  onClose: () => void
  onSave: (input: LabDatasetInput) => Promise<void>
}) {
  const copy = COPY[endpoint]
  const [draft, setDraft] = useState<Draft>(() => draftFromDataset(dataset, {
    compoundId: compounds.length === 1 ? compounds[0].id : "",
    cellLineId: defaultCellLineId && cellLines.some((line) => line.id === defaultCellLineId) ? defaultCellLineId : cellLines[0]?.id ?? "",
    cellLineName: cellLines.find((line) => line.id === (defaultCellLineId ?? cellLines[0]?.id))?.name ?? "",
    proteinId: proteins.length === 1 ? proteins[0].id : "",
  }))
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

  const preview = useMemo(() => {
    if (endpoint !== "mtt") return []
    try {
      return deriveMttObservations(observationRows(draft.rows, false))
    } catch {
      return []
    }
  }, [draft.rows, endpoint])

  if (!mounted) return null
  const set = (key: keyof Draft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setDraft((current) => ({ ...current, [key]: event.target.value }))
  }

  return createPortal(
    <div className="nano-modal-back" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div className="nano-modal dock-import lab-import" role="dialog" aria-modal="true" aria-labelledby="flex-lab-title">
        <header className="nano-modal-head">
          <div>
            <p className="nano-setup-kicker">{copy.title}</p>
            <h2 id="flex-lab-title">{dataset ? "Edit Result" : "Add Laboratory Result"}</h2>
          </div>
          <button type="button" className="nano-modal-close" onClick={onClose} disabled={busy} aria-label="Close"><X size={16} /></button>
        </header>
        <form id="flex-lab-entry" className="dock-import-body" onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setMessage(null)
          try {
            const input = buildFlexibleInput(endpoint, draft, compounds, cellLines, proteins)
            void onSave(input).catch((error) => {
              setMessage(toUserFacingError(error, "The laboratory results could not be saved."))
              setBusy(false)
            })
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "The laboratory results could not be saved.")
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
          <div className="dock-field-row">
            <label>Method / protocol<input value={draft.method} onChange={set("method")} required /></label>
            {compounds.length > 1 ? (
              <label>Phytochemical
                <select value={draft.compoundId} onChange={set("compoundId")} required>
                  <option value="">Select</option>
                  {compounds.map((compound) => <option key={compound.id} value={compound.id}>{compound.name}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          {endpoint === "mtt" || endpoint === "ros" ? (
            <div className="dock-field-row">
              {cellLines.length > 0 ? (
                <label>Cell line
                  <select value={draft.cellLineId} onChange={(event) => {
                    const id = event.target.value
                    const line = cellLines.find((item) => item.id === id)
                    setDraft((current) => ({ ...current, cellLineId: id, cellLineName: line?.name ?? current.cellLineName }))
                  }}>
                    <option value="">Recorded below</option>
                    {cellLines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}
                  </select>
                </label>
              ) : null}
              <label>Cell line used<input value={draft.cellLineName} onChange={set("cellLineName")} /></label>
            </div>
          ) : null}
          {endpoint === "bax" || endpoint === "hippo_yap" ? (
            <label>Target
              <select value={draft.proteinId} onChange={set("proteinId")}>
                <option value="">Not linked</option>
                {proteins.map((protein) => <option key={protein.id} value={protein.id}>{protein.name}</option>)}
              </select>
            </label>
          ) : null}
          {endpoint === "mtt" ? (
            <label>Wavelength (nm)<input value={draft.wavelength} onChange={set("wavelength")} inputMode="decimal" placeholder="Record the wavelength used" /></label>
          ) : null}
          <div className="dock-table-wrap">
            <table className="dock-table lab-grid">
              <thead>
                <tr>
                  <th>Treatment</th>
                  {endpoint === "mtt" ? <th>Role</th> : null}
                  <th>Concentration</th>
                  <th>Unit</th>
                  {copy.measurement === "flexible" ? <th>Parameter</th> : null}
                  {copy.measurement === "flexible" ? <th>Value</th> : null}
                  {Array.from({ length: draft.replicateCount }, (_, index) => <th key={index}>R{index + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, index) => (
                  <tr key={index}>
                    <td><input aria-label={`Treatment ${index + 1}`} value={row.treatment} onChange={(event) => setRow(setDraft, index, "treatment", event.target.value)} /></td>
                    {endpoint === "mtt" ? (
                      <td>
                        <select aria-label={`Role ${index + 1}`} value={row.role} onChange={(event) => setRow(setDraft, index, "role", event.target.value)}>
                          {ROLES.map((role) => <option key={`${role.id}-${index}`} value={role.id}>{role.label}</option>)}
                        </select>
                      </td>
                    ) : null}
                    <td><input aria-label={`Concentration ${index + 1}`} value={row.concentration} onChange={(event) => setRow(setDraft, index, "concentration", event.target.value)} /></td>
                    <td><input aria-label={`Unit ${index + 1}`} value={row.unit} onChange={(event) => setRow(setDraft, index, "unit", event.target.value)} /></td>
                    {copy.measurement === "flexible" ? (
                      <td><input aria-label={`Parameter ${index + 1}`} value={row.parameter} onChange={(event) => setRow(setDraft, index, "parameter", event.target.value)} /></td>
                    ) : null}
                    {copy.measurement === "flexible" ? (
                      <td><input aria-label={`Value ${index + 1}`} value={row.value} inputMode="decimal" onChange={(event) => setRow(setDraft, index, "value", event.target.value)} /></td>
                    ) : null}
                    {row.replicates.map((cell, slot) => (
                      <td key={slot}>
                        <input aria-label={`R${slot + 1} row ${index + 1}`} value={cell} inputMode="decimal" onChange={(event) => setReplicate(setDraft, index, slot, event.target.value)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lab-assay-action">
            <button type="button" className="phyto-back" onClick={() => setDraft((current) => ({ ...current, rows: [...current.rows, emptyRow(current.replicateCount)] }))}>
              <Plus size={14} aria-hidden /> Add treatment
            </button>
            <button type="button" className="phyto-back" disabled={draft.rows.length === 1} onClick={() => setDraft((current) => ({ ...current, rows: current.rows.slice(0, -1) }))}>Remove treatment</button>
            <button type="button" className="phyto-back" disabled={draft.replicateCount >= 8} onClick={() => setDraft((current) => ({
              ...current,
              replicateCount: current.replicateCount + 1,
              rows: current.rows.map((row) => ({ ...row, replicates: [...row.replicates, ""] })),
            }))}>Add replicate</button>
            <button type="button" className="phyto-back" disabled={draft.replicateCount <= 1} onClick={() => setDraft((current) => ({
              ...current,
              replicateCount: current.replicateCount - 1,
              rows: current.rows.map((row) => ({ ...row, replicates: row.replicates.slice(0, -1) })),
            }))}>Remove replicate</button>
          </div>
          {endpoint === "mtt" && preview.some((row) => row.viabilityPercent !== undefined) ? (
            <p className="dock-note">
              Cell viability % = {MTT_VIABILITY_FORMULA}. Growth inhibition % = {MTT_INHIBITION_FORMULA}. Calculated only where a control absorbance is recorded.
            </p>
          ) : null}
          {endpoint === "mtt" ? (
            <>
              <div className="dock-field-row">
                <label>IC50, if calculated outside NANOTOPHEA<input value={draft.ic50} onChange={set("ic50")} inputMode="decimal" /></label>
                <label>IC50 unit<input value={draft.ic50Unit} onChange={set("ic50Unit")} placeholder="µg/mL" /></label>
              </div>
              <label>IC50 method<input value={draft.ic50Method} onChange={set("ic50Method")} placeholder="Method used outside NANOTOPHEA" /></label>
            </>
          ) : null}
          <label>Notes<textarea value={draft.notes} onChange={set("notes")} rows={2} /></label>
          {message ? <p role="alert">{message}</p> : null}
        </form>
        <div className="dock-import-actions">
          <button type="button" className="phyto-back" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="flex-lab-entry" className="phyto-continue" disabled={busy}>{busy ? "Saving…" : "Save Laboratory Results"}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function FlexibleResult({ dataset, endpoint }: { dataset: LabDataset; endpoint: Exclude<LabEndpoint, "dpph" | "ldh"> }) {
  const rows = endpoint === "mtt" ? deriveMttObservations(dataset.observations) : dataset.observations
  const replicateCount = Math.max(1, ...rows.map((row) => row.replicates.length), 0)
  return (
    <section className="phyto-block">
      <dl className="phyto-props">
        <div><dt>Experiment date</dt><dd>{dataset.datePerformed.slice(0, 10)}</dd></div>
        {dataset.operatorName ? <div><dt>Researcher</dt><dd>{dataset.operatorName}</dd></div> : null}
        <div><dt>Sample / batch</dt><dd>{dataset.datasetName}</dd></div>
        {dataset.cellLineName ? <div><dt>Cell line</dt><dd>{dataset.cellLineName}</dd></div> : null}
        {dataset.instrument ? <div><dt>Instrument</dt><dd>{dataset.instrument}</dd></div> : null}
        <div><dt>Method</dt><dd>{dataset.protocolReference}</dd></div>
        {dataset.wavelengthNm != null ? <div><dt>Wavelength</dt><dd>{dataset.wavelengthNm} nm</dd></div> : null}
      </dl>
      {rows.length ? (
        <div className="dock-table-wrap">
          <table className="dock-table">
            <thead>
              <tr>
                <th>Treatment</th>
                <th>Concentration</th>
                <th>Parameter</th>
                {Array.from({ length: replicateCount }, (_, index) => <th key={index}>R{index + 1}</th>)}
                <th>Mean</th>
                <th>SD</th>
                {endpoint === "mtt" ? <th>Viability %</th> : null}
                {endpoint === "mtt" ? <th>Inhibition %</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.treatment ?? "row"}-${index}`}>
                  <td>{row.treatment || "—"}</td>
                  <td>{[row.concentration, row.unit].filter(Boolean).join(" ") || "—"}</td>
                  <td>{row.parameter || (endpoint === "mtt" ? "Absorbance" : "—")}</td>
                  {Array.from({ length: replicateCount }, (_, slot) => <td key={slot}>{formatLabNumber(row.replicates[slot])}</td>)}
                  <td>{formatLabNumber(row.mean ?? row.value)}</td>
                  <td>{formatLabNumber(row.sd)}</td>
                  {endpoint === "mtt" ? <td>{formatLabNumber(row.viabilityPercent)}</td> : null}
                  {endpoint === "mtt" ? <td>{formatLabNumber(row.inhibitionPercent)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {endpoint === "mtt" && rows.some((row) => row.viabilityPercent !== undefined) ? (
        <p className="dock-note">Cell viability % = {MTT_VIABILITY_FORMULA}. Growth inhibition % = {MTT_INHIBITION_FORMULA}.</p>
      ) : null}
      {dataset.ic50 ? <p className="dock-note">IC50 {dataset.ic50.value} {dataset.ic50.unit}. Method: {dataset.ic50.method}. Calculated outside NANOTOPHEA.</p> : null}
      {dataset.notes?.trim() ? <p className="dock-note">{dataset.notes.trim()}</p> : null}
    </section>
  )
}

function setRow(setDraft: (value: (current: Draft) => Draft) => void, index: number, key: keyof RowDraft, value: string) {
  setDraft((current) => ({
    ...current,
    rows: current.rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
  }))
}

function setReplicate(setDraft: (value: (current: Draft) => Draft) => void, index: number, slot: number, value: string) {
  setDraft((current) => ({
    ...current,
    rows: current.rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row
      const replicates = [...row.replicates]
      replicates[slot] = value
      return { ...row, replicates }
    }),
  }))
}

function draftFromDataset(dataset: LabDataset | undefined, defaults: Pick<Draft, "compoundId" | "cellLineId" | "cellLineName" | "proteinId">): Draft {
  const base = emptyDraft()
  if (!dataset) {
    return { ...base, ...defaults }
  }
  const replicateCount = Math.max(3, ...dataset.observations.map((row) => row.replicates.length), 1)
  const rows = dataset.observations.length
    ? dataset.observations.map((row) => ({
        treatment: row.treatment ?? "",
        concentration: row.concentration ?? "",
        unit: row.unit ?? "",
        parameter: row.parameter ?? "",
        value: row.value != null ? String(row.value) : "",
        role: row.role ?? ("" as const),
        replicates: Array.from({ length: replicateCount }, (_, slot) => (row.replicates[slot] != null ? String(row.replicates[slot]) : "")),
      }))
    : [emptyRow(replicateCount)]
  return {
    ...base,
    date: dataset.datePerformed.slice(0, 10),
    method: dataset.protocolReference === "unspecified" ? "" : dataset.protocolReference,
    operator: dataset.operatorName ?? "",
    batch: dataset.datasetName,
    cellLineId: dataset.cellLineId ?? defaults.cellLineId,
    cellLineName: dataset.cellLineName ?? defaults.cellLineName,
    compoundId: dataset.compoundId ?? defaults.compoundId,
    proteinId: dataset.proteinId ?? defaults.proteinId,
    instrument: dataset.instrument ?? "",
    wavelength: dataset.wavelengthNm != null ? String(dataset.wavelengthNm) : "",
    notes: dataset.notes ?? "",
    ic50: dataset.ic50 ? String(dataset.ic50.value) : "",
    ic50Unit: dataset.ic50?.unit ?? "",
    ic50Method: dataset.ic50?.method ?? "",
    replicateCount,
    rows,
  }
}

function observationRows(rows: RowDraft[], strict: boolean): LabObservation[] {
  const observations: LabObservation[] = []
  for (const row of rows) {
    const replicates = row.replicates.map((cell) => cell.trim()).filter(Boolean).map((cell) => {
      const value = Number(cell)
      if (!Number.isFinite(value)) {
        if (strict) throw new Error("Replicate measurements must be numbers.")
        return Number.NaN
      }
      return value
    }).filter((value) => Number.isFinite(value))
    let value: number | undefined
    if (row.value.trim()) {
      value = Number(row.value)
      if (!Number.isFinite(value)) {
        if (strict) throw new Error("Measured value must be a number.")
        value = undefined
      }
    }
    const blank = !replicates.length && value == null && !row.treatment.trim() && !row.parameter.trim() && !row.concentration.trim()
    if (blank) continue
    if (strict && !replicates.length && value == null) throw new Error("Each entered row needs a measured value or a replicate.")
    observations.push({
      treatment: row.treatment.trim() || undefined,
      concentration: row.concentration.trim() || undefined,
      parameter: row.parameter.trim() || (strict ? undefined : undefined),
      unit: row.unit.trim() || undefined,
      role: row.role || undefined,
      replicates,
      value,
    })
  }
  return observations
}

function buildFlexibleInput(
  endpoint: Exclude<LabEndpoint, "dpph" | "ldh">,
  draft: Draft,
  compounds: Party[],
  cellLines: Party[],
  proteins: Party[],
): LabDatasetInput {
  if (!draft.date.trim()) throw new Error("Experiment date is required.")
  if (!draft.method.trim()) throw new Error("Experimental method is required.")
  const compoundId = draft.compoundId || (compounds.length === 1 ? compounds[0].id : "")
  if (!compoundId) throw new Error("Select a phytochemical in Research Setup before recording this result.")
  const compound = compounds.find((item) => item.id === compoundId)
  const line = cellLines.find((item) => item.id === draft.cellLineId)
  const cellLineName = (draft.cellLineName.trim() || line?.name || "").trim()
  if ((endpoint === "mtt" || endpoint === "ros") && !cellLineName && !draft.cellLineId) {
    throw new Error("Record the cell line used in this experiment.")
  }
  let wavelengthNm: number | undefined
  if (endpoint === "mtt" && draft.wavelength.trim()) {
    wavelengthNm = Number(draft.wavelength)
    if (!Number.isFinite(wavelengthNm)) throw new Error("Wavelength must be a number.")
  }
  const raw = observationRows(draft.rows, true)
  if (!raw.length) throw new Error("Enter at least one measured value.")
  const observations = endpoint === "mtt"
    ? deriveMttObservations(raw.map((row) => ({ ...row, parameter: row.parameter || "Absorbance" })))
    : summarizeObservations(raw)
  let ic50: LabDatasetInput["ic50"]
  if (endpoint === "mtt" && (draft.ic50.trim() || draft.ic50Method.trim())) {
    if (!draft.ic50.trim() || !draft.ic50Method.trim()) throw new Error("An IC50 needs both the value and the method used to calculate it.")
    const value = Number(draft.ic50)
    if (!Number.isFinite(value)) throw new Error("IC50 must be a number.")
    ic50 = { value, unit: draft.ic50Unit.trim() || "µg/mL", method: draft.ic50Method.trim(), dataClass: "DERIVED_FROM_EXPERIMENTAL" }
  }
  const protein = proteins.find((item) => item.id === draft.proteinId)
  return {
    assay: endpoint,
    assayType: endpoint,
    endpointType: endpoint,
    datasetName: draft.batch.trim() || compound?.name || COPY[endpoint].title,
    compoundId,
    cellLineId: line && (!draft.cellLineName.trim() || draft.cellLineName.trim() === line.name) ? line.id : undefined,
    cellLineName: cellLineName || undefined,
    proteinId: protein?.id,
    laboratoryName: draft.operator.trim(),
    datePerformed: draft.date,
    protocolReference: draft.method.trim(),
    instrument: draft.instrument.trim() || undefined,
    wavelengthNm,
    operatorName: draft.operator.trim() || undefined,
    outsourcedLab: false,
    treatmentSummaries: [],
    observations,
    ic50,
    notes: draft.notes.trim() || undefined,
    status: "final",
    provenance: {
      evidenceClass: "EXPERIMENTAL",
      methodName: draft.method.trim(),
      source: "Laboratory measurement",
      recordedAt: draft.date,
    },
  }
}
