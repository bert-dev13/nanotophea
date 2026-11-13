"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Edit3 } from "lucide-react"
import { ChitosanTppInteractionSection } from "@/components/study/setup/ChitosanTppInteractionSection"
import { EditFormulationModal } from "@/components/study/setup/EditFormulationModal"
import { NanoparticlePreparationProtocolPanel } from "@/components/study/setup/NanoparticlePreparationProtocolPanel"
import type { NanoparticleFormulation } from "@/lib/domain/models"
import {
  buildNanoparticleFormulationOverview,
  sourceLabel,
  type FormulationDisplayRow,
} from "@/lib/setup/nanoparticleFormulationDisplay"

interface NanoparticleFormulationWorkspaceProps {
  studyId: string
  onChangedAction?: () => void
}

/** Chitosan–TPP formulation overview with optional study-specific Edit Formulation. */
export function NanoparticleFormulationWorkspace({
  studyId,
  onChangedAction,
}: NanoparticleFormulationWorkspaceProps) {
  const [record, setRecord] = useState<NanoparticleFormulation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  const loadRecord = useCallback(async () => {
    if (!studyId) {
      setRecord(null)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/studies/${studyId}/nanoparticle`)
      if (!res.ok) throw new Error("Failed to load nanoparticle formulation record")
      const data = await res.json()
      setRecord(data.record ?? null)
    } catch (err: any) {
      setError(err.message || "Error loading nanoparticle formulation")
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    void loadRecord()
  }, [loadRecord])

  const overview = buildNanoparticleFormulationOverview(record)
  const isTestData = record?.recordType === "test_synthetic"

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
        Loading nanoparticle formulation…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              04 · Nanoparticle Formulation
            </p>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-100">
              Chitosan–TPP Nanoparticle
            </h2>
            <p className="mt-0.5 max-w-xl text-xs text-slate-400">
              Review the formulation overview, or edit study-specific quantities. Optional step — skip or continue to
              In-Silico.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isTestData ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                TEST DATA
              </span>
            ) : null}
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                overview.dataSource === "study"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-700 bg-slate-800/80 text-slate-300"
              }`}
            >
              {overview.dataSource === "study" ? "Study formulation" : "Default formulation"}
            </span>
          </div>
        </div>
        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
        {saveNotice ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {saveNotice}
          </div>
        ) : null}
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Formulation Overview</h3>
            <p className="text-[11px] text-slate-500">{overview.systemName}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSaveNotice(null)
              setEditOpen(true)
            }}
            disabled={!studyId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Formulation
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          {overview.dataSource === "study"
            ? "Saved study values take precedence over protocol defaults."
            : "No study-specific quantities yet — showing protocol defaults. Missing amounts are not invented."}
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {overview.ingredients.map((row) => (
            <IngredientCard key={row.id} row={row} />
          ))}
          <IngredientCard row={overview.ratio} />
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <p>
            <span className="font-medium text-slate-300">Study</span> = saved for this study ·{" "}
            <span className="font-medium text-slate-300">Default</span> = protocol preset ·{" "}
            <span className="font-medium text-slate-300">Not recorded</span> = no value available
          </p>
        </div>
      </section>

      <ChitosanTppInteractionSection record={record} />

      <NanoparticlePreparationProtocolPanel />

      <EditFormulationModal
        studyId={studyId}
        record={record}
        isOpen={editOpen}
        onCloseAction={() => setEditOpen(false)}
        onSavedAction={(saved) => {
          setRecord(saved)
          setSaveNotice("Formulation saved for this study.")
          onChangedAction?.()
        }}
      />
    </div>
  )
}

function IngredientCard({ row }: { row: FormulationDisplayRow }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{row.name}</p>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
            row.source === "study"
              ? "bg-emerald-500/15 text-emerald-300"
              : row.source === "default"
                ? "bg-sky-500/15 text-sky-300"
                : "bg-slate-800 text-slate-500"
          }`}
        >
          {sourceLabel(row.source)}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-100 font-mono">{row.value}</p>
      {row.functionInFormulation ? (
        <p className="mt-0.5 text-[11px] text-slate-400">{row.functionInFormulation}</p>
      ) : null}
      {row.detail ? <p className="mt-0.5 text-[10px] text-slate-500">{row.detail}</p> : null}
    </div>
  )
}
