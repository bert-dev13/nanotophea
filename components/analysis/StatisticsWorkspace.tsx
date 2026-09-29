"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ModuleShell } from "@/components/ui/ModuleShell"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { canEditStatistics, statisticsRoleLabel } from "@/lib/permissions/researchAccess"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import { FormField, inputClass, inputStyle } from "@/components/research/FormFields"
import { getLabAssayConfig } from "@/lib/lab/labAssayConfig"
import { listLabDatasets } from "@/lib/repositories/labRepository"
import {
  createStatisticsAnalysis,
  deleteStatisticsAnalysis,
  listStatisticsAnalyses,
  previewStatisticsAnalysis,
  recalculateStatisticsAnalysis,
} from "@/lib/repositories/statisticsRepository"
import type { LabDataset, StatisticsRecord } from "@/lib/domain/models"
import type { ExperimentalStatsComputation } from "@/lib/statistics/runAnalysis"
import {
  STATISTICS_ALPHA,
  STATISTICS_CALCULATION_METHOD,
  STATISTICS_CALCULATION_VERSION,
} from "@/lib/statistics/runAnalysis"
import { formatStatNumber } from "@/lib/statistics/statDisplay"
import { toUserFacingError } from "@/lib/errors/userFacing"

type AssaySel = "dpph" | "ldh"

function fmt(n: number | null | undefined, digits = 4): string {
  return formatStatNumber(n, digits)
}

function fmtP(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return "—"
  if (p < 0.0001) return "< 0.0001"
  return p.toFixed(4)
}

export function StatisticsWorkspace() {
  const { user } = useAuth()
  const { activeStudy, membership, loading: studyLoading } = useStudy()
  const canEdit = canEditStatistics(membership?.role)

  const [assay, setAssay] = useState<AssaySel>("dpph")
  const [datasets, setDatasets] = useState<LabDataset[]>([])
  const [datasetId, setDatasetId] = useState("")
  const [measurementKey, setMeasurementKey] = useState("")
  const [preview, setPreview] = useState<ExperimentalStatsComputation | null>(null)
  const [previewDataset, setPreviewDataset] = useState<LabDataset | null>(null)
  const [saved, setSaved] = useState<StatisticsRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")

  const cfg = useMemo(() => getLabAssayConfig(assay), [assay])

  const selectedSaved = useMemo(
    () => saved.find((s) => s.id === selectedId) ?? null,
    [saved, selectedId]
  )

  const refreshLists = useCallback(async () => {
    if (!activeStudy) return
    const [ds, stats] = await Promise.all([
      listLabDatasets(activeStudy.id, assay),
      listStatisticsAnalyses(activeStudy.id),
    ])
    setDatasets(ds)
    setSaved(stats)
  }, [activeStudy, assay])

  useEffect(() => {
    if (!activeStudy) return
    void refreshLists().catch((e) =>
      setError(toUserFacingError(e, "Failed to load statistics"))
    )
  }, [activeStudy, refreshLists])

  useEffect(() => {
    setDatasetId("")
    setMeasurementKey(cfg.primaryMetricKey)
    setPreview(null)
    setPreviewDataset(null)
    setSelectedId(null)
  }, [assay, cfg.primaryMetricKey])

  useEffect(() => {
    if (!datasetId || !measurementKey || !activeStudy) {
      setPreview(null)
      setPreviewDataset(null)
      return
    }
    let cancelled = false
    setBusy(true)
    setError(null)
    void previewStatisticsAnalysis(activeStudy.id, {
      labDatasetId: datasetId,
      assayType: assay,
      measurementKey,
    })
      .then(({ dataset, computed }) => {
        if (cancelled) return
        setPreview(computed)
        setPreviewDataset(dataset)
      })
      .catch((e) => {
        if (cancelled) return
        setPreview(null)
        setPreviewDataset(null)
        setError(toUserFacingError(e, "Preview failed"))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeStudy, assay, datasetId, measurementKey])

  const onSave = async () => {
    if (!activeStudy || !user || !canEdit || !datasetId || !measurementKey) return
    setBusy(true)
    setError(null)
    try {
      const record = await createStatisticsAnalysis(activeStudy.id, { id: user.uid }, {
        labDatasetId: datasetId,
        assayType: assay,
        measurementKey,
        notes: notes.trim() || undefined,
      })
      await refreshLists()
      setSelectedId(record.id)
    } catch (e) {
      setError(toUserFacingError(e, "Save failed"))
    } finally {
      setBusy(false)
    }
  }

  const onRecalc = async (id: string) => {
    if (!activeStudy || !user || !canEdit) return
    setBusy(true)
    setError(null)
    try {
      await recalculateStatisticsAnalysis(activeStudy.id, id, { id: user.uid })
      await refreshLists()
    } catch (e) {
      setError(toUserFacingError(e, "Recalculation failed"))
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!activeStudy || !user || !canEdit || !deleteId) return
    setBusy(true)
    try {
      await deleteStatisticsAnalysis(activeStudy.id, deleteId, { id: user.uid })
      if (selectedId === deleteId) setSelectedId(null)
      setDeleteId(null)
      await refreshLists()
    } catch (e) {
      setError(toUserFacingError(e, "Delete failed"))
    } finally {
      setBusy(false)
    }
  }

  const display = selectedSaved
    ? {
        kind: "saved" as const,
        anova: selectedSaved.anova,
        scheffe: selectedSaved.scheffeComparisons,
        scheffeMessage: selectedSaved.scheffeMessage,
        summaries: selectedSaved.treatmentSummaries,
        completeness: selectedSaved.completeness,
        measurementLabel: selectedSaved.measurementLabel,
        datasetName: selectedSaved.labDatasetName,
        freshness: selectedSaved.freshness,
        alpha: selectedSaved.alpha,
      }
    : preview
      ? {
          kind: "preview" as const,
          anova: {
            k: preview.anova.k,
            N: preview.anova.N,
            groupLabels: preview.anova.groupLabels,
            groupNs: preview.anova.groupNs,
            groupMeans: preview.anova.groupMeans,
            grandMean: preview.anova.grandMean,
            ssBetween: preview.anova.ssBetween,
            ssWithin: preview.anova.ssWithin,
            ssTotal: preview.anova.ssTotal,
            dfBetween: preview.anova.dfBetween,
            dfWithin: preview.anova.dfWithin,
            dfTotal: preview.anova.dfTotal,
            msBetween: preview.anova.msBetween,
            msWithin: preview.anova.msWithin,
            fStatistic: preview.anova.fStatistic,
            pValue: preview.anova.pValue,
            alpha: preview.anova.alpha,
            significant: preview.anova.significant,
            message: preview.anova.message,
          },
          scheffe: preview.scheffe.comparisons,
          scheffeMessage: preview.scheffe.message,
          summaries: preview.treatmentSummaries,
          completeness: preview.completeness,
          measurementLabel: preview.measurementLabel,
          datasetName: previewDataset?.datasetName ?? "",
          freshness: "CURRENT" as const,
          alpha: preview.alpha,
        }
      : null

  const chartData =
    display?.summaries
      .filter((s) => s.mean != null && s.n > 0)
      .map((s) => ({
        treatment: s.treatmentCode,
        mean: s.mean as number,
        sd: s.sd ?? 0,
      })) ?? []

  if (studyLoading) {
    return <p className="text-sm" style={{ color: "#64748b" }}>Loading study…</p>
  }

  if (!activeStudy) {
    return (
      <ResearchEmptyState
        title="Select a study"
        body="Statistical analysis requires an active study with experimental laboratory datasets."
        canEdit={false}
      />
    )
  }

  return (
    <ModuleShell
      icon={BarChart3}
      title="Statistical Analysis"
      subtitle="One-way ANOVA and Scheffé post-hoc on Experimental DPPH and LDH raw replicates only."
      evidence="EXPERIMENTAL"
      phase="analysis"
      contractNote="Statistics apply to EXPERIMENTAL datasets only (α = 0.05). Do not treat Predicted/Simulation series as wet-lab ANOVA input. Statistical significance does not decide research hypotheses or efficacy."
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "#64748b" }}>
        <span>{statisticsRoleLabel(membership?.role)}</span>
        <span className="font-mono">
          {STATISTICS_CALCULATION_METHOD} · v{STATISTICS_CALCULATION_VERSION} · α = {STATISTICS_ALPHA}
        </span>
      </div>

      {error ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}
        >
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border p-4 space-y-3" style={{ background: "#fff", borderColor: "#dde5ef" }}>
        <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
          Analysis setup
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Assay" required>
            <select
              className={inputClass}
              style={inputStyle}
              value={assay}
              onChange={(e) => setAssay(e.target.value as AssaySel)}
            >
              <option value="dpph">Experimental DPPH</option>
              <option value="ldh">Experimental LDH</option>
            </select>
          </FormField>
          <FormField label="Experimental dataset" required>
            <select
              className={inputClass}
              style={inputStyle}
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
            >
              <option value="">Select dataset…</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.datasetName} ({d.datePerformed})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Measurement" required>
            <select
              className={inputClass}
              style={inputStyle}
              value={measurementKey}
              onChange={(e) => setMeasurementKey(e.target.value)}
              disabled={!datasetId}
            >
              {cfg.measurementKeys.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        {canEdit ? (
          <FormField label="Notes (optional)">
            <input
              className={inputClass}
              style={inputStyle}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Analysis notes — not an interpretation of hypotheses"
            />
          </FormField>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <button
              type="button"
              disabled={busy || !preview?.canPersist || !datasetId}
              onClick={() => void onSave()}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "#00a882" }}
            >
              <Save size={13} />
              Save analysis
            </button>
          ) : null}
          <span className="text-[11px] self-center" style={{ color: "#94a3b8" }}>
            Source: labDatasets only · Prediction runs excluded
          </span>
        </div>
      </section>

      {/* Saved analyses */}
      <section className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#dde5ef" }}>
        <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ background: "#f8fafc", color: "#546e8a" }}>
          Saved analyses ({saved.length})
        </div>
        {saved.length === 0 ? (
          <p className="px-3 py-3 text-sm" style={{ color: "#94a3b8" }}>
            No saved statistical analyses yet.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "#eef2f7" }}>
            {saved.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                <button
                  type="button"
                  className="text-left flex-1 min-w-[12rem] font-semibold"
                  style={{ color: selectedId === s.id ? "#00a882" : "#0d1f3c" }}
                  onClick={() => {
                    setSelectedId(s.id)
                    setAssay(s.assayType)
                    setDatasetId(s.labDatasetId)
                    setMeasurementKey(s.measurementKey)
                  }}
                >
                  {s.assayType.toUpperCase()} · {s.measurementLabel}
                  <span className="block font-normal" style={{ color: "#64748b" }}>
                    {s.labDatasetName} · {new Date(s.calculatedAt).toLocaleString()}
                  </span>
                </button>
                {s.freshness === "STALE" ? (
                  <span
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-bold uppercase tracking-wide"
                    style={{ borderColor: "#fcd34d", background: "#fffbeb", color: "#b45309" }}
                  >
                    <AlertTriangle size={11} /> Stale / requires recalculation
                  </span>
                ) : (
                  <span className="font-mono" style={{ color: "#64748b" }}>
                    CURRENT
                  </span>
                )}
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border px-2 py-1"
                      style={{ borderColor: "#dde5ef", color: "#475569" }}
                      disabled={busy}
                      onClick={() => void onRecalc(s.id)}
                    >
                      <RefreshCw size={12} /> Recalculate
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border px-2 py-1"
                      style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                      onClick={() => setDeleteId(s.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {display?.freshness === "STALE" ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm flex gap-2 items-start"
          style={{ borderColor: "#fcd34d", background: "#fffbeb", color: "#92400e" }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">STALE / REQUIRES RECALCULATION</p>
            <p className="text-xs mt-1">
              The source laboratory dataset or replicates changed after this analysis was calculated.
              Do not treat these statistics as current until recalculated.
            </p>
          </div>
        </div>
      ) : null}

      {display?.completeness.incomplete ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#fdba74", background: "#fff7ed", color: "#9a3412" }}
        >
          <p className="font-bold text-xs uppercase tracking-wide">Incomplete experimental dataset</p>
          <ul className="mt-1 text-xs list-disc pl-4 space-y-0.5">
            {display.completeness.warnings.slice(0, 12).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Raw grid — always from live lab replicates when a dataset is selected */}
      {preview ? (
        <RawGridPanel
          assay={assay}
          measurementLabel={preview.measurementLabel}
          rawGrid={preview.rawGrid}
          datasetName={previewDataset?.datasetName}
        />
      ) : null}

      {display ? (
        <>
          <section className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <div className="px-3 py-2 flex items-center justify-between gap-2" style={{ background: "#f8fafc" }}>
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
                Descriptive statistics · {display.measurementLabel}
              </span>
              <EvidenceBadge type="EXPERIMENTAL" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "#546e8a" }}>
                    <th className="text-left p-2 font-mono">Treatment</th>
                    <th className="text-left p-2 font-mono">n</th>
                    <th className="text-left p-2 font-mono">Mean</th>
                    <th className="text-left p-2 font-mono">SD</th>
                    <th className="text-left p-2 font-mono">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {display.summaries.map((t) => (
                    <tr key={t.treatmentCode} style={{ borderTop: "1px solid #eef2f7" }}>
                      <td className="p-2 font-semibold">
                        {t.treatmentCode}
                        <span className="block font-normal" style={{ color: "#94a3b8" }}>
                          {t.label}
                        </span>
                      </td>
                      <td className="p-2 font-mono">{t.n}</td>
                      <td className="p-2 font-mono">{fmt(t.mean)}</td>
                      <td className="p-2 font-mono">{fmt(t.sd)}</td>
                      <td className="p-2 font-mono">{fmt(t.variance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-3 py-2 text-[10px]" style={{ color: "#94a3b8", background: "#f8fafc" }}>
              Derived from raw experimental replicates (sample SD, n − 1). Missing cells are omitted — never zero-filled.
            </p>
          </section>

          {chartData.length > 0 ? (
            <section className="rounded-xl border p-4" style={{ background: "#fff", borderColor: "#dde5ef" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
                  Treatment means (± SD)
                </h3>
                <span
                  className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                  style={{ borderColor: "#6ee7b7", background: "#ecfdf5", color: "#047857" }}
                >
                  Experimental data
                </span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="treatment" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
                      formatter={(value: number) => [fmt(value, 3), "Mean"]}
                    />
                    <Bar dataKey="mean" fill="#00a882" radius={[4, 4, 0, 0]} name="Mean">
                      <ErrorBar dataKey="sd" width={4} strokeWidth={1.5} stroke="#0d1f3c" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ background: "#f8fafc", color: "#546e8a" }}>
              One-way ANOVA
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "#546e8a" }}>
                    <th className="text-left p-2 font-mono">Source</th>
                    <th className="text-left p-2 font-mono">SS</th>
                    <th className="text-left p-2 font-mono">df</th>
                    <th className="text-left p-2 font-mono">MS</th>
                    <th className="text-left p-2 font-mono">F</th>
                    <th className="text-left p-2 font-mono">p</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid #eef2f7" }}>
                    <td className="p-2">Between treatments</td>
                    <td className="p-2 font-mono">{fmt(display.anova.ssBetween)}</td>
                    <td className="p-2 font-mono">{display.anova.dfBetween}</td>
                    <td className="p-2 font-mono">{fmt(display.anova.msBetween)}</td>
                    <td className="p-2 font-mono">{fmt(display.anova.fStatistic)}</td>
                    <td className="p-2 font-mono">{fmtP(display.anova.pValue)}</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid #eef2f7" }}>
                    <td className="p-2">Within treatments</td>
                    <td className="p-2 font-mono">{fmt(display.anova.ssWithin)}</td>
                    <td className="p-2 font-mono">{display.anova.dfWithin}</td>
                    <td className="p-2 font-mono">{fmt(display.anova.msWithin)}</td>
                    <td className="p-2 font-mono">—</td>
                    <td className="p-2 font-mono">—</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid #eef2f7" }}>
                    <td className="p-2 font-semibold">Total</td>
                    <td className="p-2 font-mono">{fmt(display.anova.ssTotal)}</td>
                    <td className="p-2 font-mono">{display.anova.dfTotal}</td>
                    <td className="p-2 font-mono">—</td>
                    <td className="p-2 font-mono">—</td>
                    <td className="p-2 font-mono">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 text-xs space-y-1" style={{ background: "#f8fafc", color: "#475569" }}>
              <p>
                Groups k = {display.anova.k} · Observations N = {display.anova.N} · α = {display.alpha}
              </p>
              <p className="font-semibold" style={{ color: "#0d1f3c" }}>
                {display.anova.message}
              </p>
            </div>
          </section>

          <section className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ background: "#f8fafc", color: "#546e8a" }}>
              Scheffé post-hoc
            </div>
            {display.scheffe.length === 0 ? (
              <p className="px-3 py-3 text-sm" style={{ color: "#64748b" }}>
                {display.scheffeMessage || "No Scheffé comparisons."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: "#546e8a" }}>
                      <th className="text-left p-2 font-mono">Comparison</th>
                      <th className="text-left p-2 font-mono">Difference</th>
                      <th className="text-left p-2 font-mono">F_S</th>
                      <th className="text-left p-2 font-mono">Critical F</th>
                      <th className="text-left p-2 font-mono">CD</th>
                      <th className="text-left p-2 font-mono">p</th>
                      <th className="text-left p-2 font-mono">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {display.scheffe.map((c) => (
                      <tr
                        key={`${c.treatmentA}-${c.treatmentB}`}
                        style={{ borderTop: "1px solid #eef2f7" }}
                      >
                        <td className="p-2 font-semibold">
                          {c.treatmentA} vs {c.treatmentB}
                        </td>
                        <td className="p-2 font-mono">{fmt(c.meanDifference)}</td>
                        <td className="p-2 font-mono">{fmt(c.scheffeStatistic)}</td>
                        <td className="p-2 font-mono">{fmt(c.criticalF)}</td>
                        <td className="p-2 font-mono">{fmt(c.criticalDifference)}</td>
                        <td className="p-2 font-mono">{fmtP(c.pValue)}</td>
                        <td className="p-2">
                          {c.significant ? (
                            <span style={{ color: "#047857" }}>Significant at α = 0.05</span>
                          ) : (
                            <span style={{ color: "#64748b" }}>Not significant</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="px-3 py-2 text-[10px]" style={{ color: "#94a3b8", background: "#f8fafc" }}>
              {display.scheffeMessage}
            </p>
          </section>

          <section className="rounded-xl border p-4 space-y-2" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <h3 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
              Statistical summary
            </h3>
            <ul className="text-xs space-y-1" style={{ color: "#475569" }}>
              <li>
                Traceability: Statistics → {display.datasetName || "laboratory dataset"} → treatments →
                raw replicates
              </li>
              <li>Measurement: {display.measurementLabel}</li>
              <li>
                Omnibus ANOVA:{" "}
                {display.anova.significant == null
                  ? "not computed"
                  : display.anova.significant
                    ? "statistically significant difference detected at α = 0.05"
                    : "no statistically significant difference detected at α = 0.05"}
              </li>
              <li>
                Hypothesis acceptance/rejection, efficacy, and biological mechanism are{" "}
                <strong>not</strong> decided here — those belong to Researcher Interpretation.
              </li>
            </ul>
          </section>
        </>
      ) : (
        <p className="text-sm" style={{ color: "#94a3b8" }}>
          {busy
            ? "Computing…"
            : "Select an experimental dataset and measurement to preview statistics."}
        </p>
      )}

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        title="Delete statistical analysis?"
        message="This removes the stored ANOVA/Scheffé record. Raw laboratory replicates are not deleted."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void onDelete()}
        busy={busy}
      />
    </ModuleShell>
  )
}

function RawGridPanel({
  assay,
  measurementLabel,
  rawGrid,
  datasetName,
}: {
  assay: AssaySel
  measurementLabel: string
  rawGrid: ExperimentalStatsComputation["rawGrid"]
  datasetName?: string
}) {
  const treatments = ["T1", "T2", "T3", "T4", "T5", "T6"] as const
  const reps = ["R1", "R2", "R3"] as const
  return (
    <section className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#dde5ef" }}>
      <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2" style={{ background: "#f8fafc" }}>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
          Raw experimental data · {assay.toUpperCase()} · {measurementLabel}
          {datasetName ? ` · ${datasetName}` : ""}
        </span>
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
          style={{ borderColor: "#6ee7b7", background: "#ecfdf5", color: "#047857" }}
        >
          Raw experimental data
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "#546e8a" }}>
              <th className="text-left p-2 font-mono">Treatment</th>
              {reps.map((r) => (
                <th key={r} className="text-left p-2 font-mono">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {treatments.map((t) => (
              <tr key={t} style={{ borderTop: "1px solid #eef2f7" }}>
                <td className="p-2 font-mono font-semibold">{t}</td>
                {reps.map((r) => {
                  const cell = rawGrid.find((c) => c.treatmentCode === t && c.replicateCode === r)
                  return (
                    <td key={r} className="p-2 font-mono" style={{ color: cell?.present ? "#0d1f3c" : "#cbd5e1" }}>
                      {cell?.present ? fmt(cell.value, 4) : "—"}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
