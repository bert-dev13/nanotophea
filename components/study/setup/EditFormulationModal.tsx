"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { AlertCircle, Save, X } from "lucide-react"
import { NanoparticleModalPortal } from "@/components/study/setup/NanoparticleModalPortal"
import type { NanoparticleFormulation } from "@/lib/domain/models"
import {
  buildFormulationSavePayload,
  emptyFormulationEditForm,
  formulationEditFormFromRecord,
  previewCalculatedRatio,
  validateFormulationEditForm,
  type FormulationEditForm,
} from "@/lib/setup/nanoparticleFormulationEdit"

interface EditFormulationModalProps {
  studyId: string
  record: NanoparticleFormulation | null
  isOpen: boolean
  onCloseAction: () => void
  onSavedAction: (record: NanoparticleFormulation) => void
}

export function EditFormulationModal({
  studyId,
  record,
  isOpen,
  onCloseAction,
  onSavedAction,
}: EditFormulationModalProps) {
  const [form, setForm] = useState<FormulationEditForm>(emptyFormulationEditForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(formulationEditFormFromRecord(record))
    setError(null)
  }, [isOpen, record])

  const calculatedPreview = useMemo(() => previewCalculatedRatio(form), [form])

  const patch = (partial: Partial<FormulationEditForm>) => {
    setForm((current) => ({ ...current, ...partial }))
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    const validation = validateFormulationEditForm(form)
    if (validation) {
      setError(validation)
      return
    }
    try {
      setSaving(true)
      setError(null)
      const payload = buildFormulationSavePayload(record, form)
      const res = await fetch(`/api/studies/${studyId}/nanoparticle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Failed to save formulation")
      }
      const result = await res.json()
      if (!result.record) throw new Error("Save succeeded but no record was returned")
      onSavedAction(result.record)
      onCloseAction()
    } catch (err: any) {
      setError(err.message || "Failed to save formulation")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <NanoparticleModalPortal
      isOpen={isOpen}
      onClose={onCloseAction}
      ariaLabel="Edit Formulation"
      cardClassName="border-emerald-500/40"
    >
      <div className="flex items-center justify-between border-b border-slate-800 p-4 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Edit Formulation</h3>
          <p className="text-[11px] text-slate-500">
            Enter actual laboratory quantities for this study. Protocol defaults are not overwritten.
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseAction}
          className="rounded p-1 text-slate-400 hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="space-y-4 overflow-y-auto p-4">
          <FieldGroup title="Chitosan">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Amount">
                <input
                  value={form.chitosanAmount}
                  onChange={(e) => patch({ chitosanAmount: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. 1.00"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Unit">
                <select
                  value={form.chitosanUnit}
                  onChange={(e) => patch({ chitosanUnit: e.target.value as "g" | "mg" | "" })}
                  className={inputClass}
                >
                  <option value="g">g</option>
                  <option value="mg">mg</option>
                </select>
              </Field>
              <Field label="Concentration (optional)">
                <input
                  value={form.chitosanConcentration}
                  onChange={(e) => patch({ chitosanConcentration: e.target.value })}
                  className={inputClass}
                  placeholder="optional"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Conc. unit">
                <input
                  value={form.chitosanConcentrationUnit}
                  onChange={(e) => patch({ chitosanConcentrationUnit: e.target.value })}
                  className={inputClass}
                  placeholder="mg/mL"
                />
              </Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Tripolyphosphate (TPP)">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Amount">
                <input
                  value={form.tppAmount}
                  onChange={(e) => patch({ tppAmount: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. 0.50"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Unit">
                <select
                  value={form.tppUnit}
                  onChange={(e) => patch({ tppUnit: e.target.value as "g" | "mg" | "" })}
                  className={inputClass}
                >
                  <option value="g">g</option>
                  <option value="mg">mg</option>
                </select>
              </Field>
              <Field label="Concentration (optional)">
                <input
                  value={form.tppConcentration}
                  onChange={(e) => patch({ tppConcentration: e.target.value })}
                  className={inputClass}
                  placeholder="optional"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Conc. unit">
                <input
                  value={form.tppConcentrationUnit}
                  onChange={(e) => patch({ tppConcentrationUnit: e.target.value })}
                  className={inputClass}
                  placeholder="mg/mL"
                />
              </Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Maltodextrin">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Amount">
                <input
                  value={form.maltodextrinAmount}
                  onChange={(e) => patch({ maltodextrinAmount: e.target.value })}
                  className={inputClass}
                  placeholder="7.00"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Unit">
                <select
                  value={form.maltodextrinUnit}
                  onChange={(e) => patch({ maltodextrinUnit: e.target.value as "g" | "mg" | "" })}
                  className={inputClass}
                >
                  <option value="g">g</option>
                  <option value="mg">mg</option>
                </select>
              </Field>
              <p className="col-span-2 self-end text-[11px] text-slate-500">Protocol default: 7.00 g</p>
            </div>
          </FieldGroup>

          <FieldGroup title="Solvent / Vehicle">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <Field label="Name or type" className="sm:col-span-2">
                <input
                  value={form.solventName}
                  onChange={(e) => patch({ solventName: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. 1% acetic acid"
                />
              </Field>
              <Field label="Amount">
                <input
                  value={form.solventAmount}
                  onChange={(e) => patch({ solventAmount: e.target.value })}
                  className={inputClass}
                  placeholder="optional"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Unit">
                <select
                  value={form.solventUnit}
                  onChange={(e) => patch({ solventUnit: e.target.value as "mL" | "L" | "" })}
                  className={inputClass}
                >
                  <option value="mL">mL</option>
                  <option value="L">L</option>
                </select>
              </Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Formulation Ratio (Chitosan:TPP)">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Manual ratio (optional)">
                <input
                  value={form.ratioManual}
                  onChange={(e) => patch({ ratioManual: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. 2:1"
                />
              </Field>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400">
                <p className="font-medium text-slate-300">Calculated preview</p>
                <p className="mt-1 font-mono text-slate-200">
                  {form.ratioManual.trim()
                    ? "Using researcher-supplied ratio"
                    : calculatedPreview || "Not recorded"}
                </p>
                <p className="mt-1 text-slate-500">
                  Calculated only from compatible mass amounts (g/mg). Concentrations are not used.
                </p>
              </div>
            </div>
          </FieldGroup>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/90 p-4 shrink-0">
          <button
            type="button"
            onClick={onCloseAction}
            disabled={saving}
            className="rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save Formulation"}
          </button>
        </div>
      </form>
    </NanoparticleModalPortal>
  )
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">{title}</h4>
      {children}
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block text-[11px] font-medium text-slate-400 ${className ?? ""}`}>
      {label}
      {children}
    </label>
  )
}
