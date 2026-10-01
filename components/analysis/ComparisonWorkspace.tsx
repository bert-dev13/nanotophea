"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  GitCompare,
  Save,
  Trash2,
} from "lucide-react"
import {
  CartesianGrid,
  ErrorBar,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Legend,
} from "recharts"
import { ModuleShell } from "@/components/ui/ModuleShell"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { canEditComparisons, comparisonRoleLabel } from "@/lib/permissions/researchAccess"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import { FormField, inputClass, inputStyle, textareaClass } from "@/components/research/FormFields"
import { getLabAssayConfig } from "@/lib/lab/labAssayConfig"
import { getPredictionEndpoint } from "@/lib/insilico/predictionEndpoints"
import { listLabDatasets } from "@/lib/repositories/labRepository"
import { listPredictionRuns } from "@/lib/repositories/scientificRunRepository"
import { listStatisticsAnalyses } from "@/lib/repositories/statisticsRepository"
import {
  createComparison,
  deleteComparison,
  listComparisons,
  previewComparison,
  updateComparison,
} from "@/lib/repositories/comparisonRepository"
import type {
  ComparisonRecord,
  LabDataset,
  PredictionRun,
  StatisticsRecord,
} from "@/lib/domain/models"
import type { ComparisonComputation } from "@/lib/comparison/runComparison"
import {
  COMPARISON_CALCULATION_METHOD,
  COMPARISON_CALCULATION_VERSION,
  expChartPoints,
  predChartPoints,
  predictionUnitLabel,
} from "@/lib/comparison/runComparison"

type Endpoint = "dpph" | "ldh"

function fmt(n: number | null | undefined, digits = 3): string {
  if (n == null || Number.isNaN(n)) return "—"
  return Number(n.toFixed(digits)).toString()
}

function statusStyle(status: string): { bg: string; border: string; color: string } {
  if (status === "COMPATIBLE") return { bg: "#ecfdf5", border: "#6ee7b7", color: "#047857" }
  if (status === "PARTIAL") return { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" }
  return { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" }
}

export function ComparisonWorkspace() {
  const { user } = useAuth()
  const { activeStudy, membership, loading: studyLoading } = useStudy()
  const canEdit = canEditComparisons(membership?.role)

  const [endpoint, setEndpoint] = useState<Endpoint>("dpph")
  const [predictions, setPredictions] = useState<PredictionRun[]>([])
  const [datasets, setDatasets] = useState<LabDataset[]>([])
  const [statsList, setStatsList] = useState<StatisticsRecord[]>([])
  const [predictionId, setPredictionId] = useState("")
  const [datasetId, setDatasetId] = useState("")
  const [metricKey, setMetricKey] = useState("")
  const [statsId, setStatsId] = useState("")
  const [notes, setNotes] = useState("")
  const [concordance, setConcordance] = useState<
    "not_assessed" | "consistent" | "partially_consistent" | "divergent"
  >("not_assessed")

  const [preview, setPreview] = useState<ComparisonComputation | null>(null)
  const [previewPred, setPreviewPred] = useState<PredictionRun | null>(null)
  const [previewLab, setPreviewLab] = useState<LabDataset | null>(null)
  const [saved, setSaved] = useState<ComparisonRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const predCfg = useMemo(() => getPredictionEndpoint(endpoint), [endpoint])
  const labCfg = useMemo(() => getLabAssayConfig(endpoint), [endpoint])

  const selectedSaved = useMemo(
    () => saved.find((s) => s.id === selectedId) ?? null,
    [saved, selectedId]
  )

  const refresh = useCallback(async () => {
    if (!activeStudy) return
    const [preds, labs, stats, comps] = await Promise.all([
      listPredictionRuns(activeStudy.id, endpoint),
      listLabDatasets(activeStudy.id, endpoint),
      listStatisticsAnalyses(activeStudy.id),
      listComparisons(activeStudy.id),
    ])
    setPredictions(preds)
    setDatasets(labs)
    setStatsList(stats.filter((s) => s.assayType === endpoint))
    setSaved(comps)
  }, [activeStudy, endpoint])

  useEffect(() => {
    if (!activeStudy) return
    void refresh().catch((e) => setError(toUserFacingError(e, "Load failed")))
  }, [activeStudy, refresh])

  useEffect(() => {
    setPredictionId("")
    setDatasetId("")
    setStatsId("")
    setMetricKey(labCfg.primaryMetricKey)
    setPreview(null)
    setPreviewPred(null)
    setPreviewLab(null)
    setSelectedId(null)
  }, [endpoint, labCfg.primaryMetricKey])

  useEffect(() => {
    if (!activeStudy || !predictionId || !datasetId) {
      setPreview(null)
      setPreviewPred(null)
      setPreviewLab(null)
      return
    }
    let cancelled = false
    setBusy(true)
    setError(null)
    void previewComparison(activeStudy.id, {
      endpoint,
      predictionRunId: predictionId,
      labDatasetId: datasetId,
      experimentalMetricKey: metricKey || undefined,
      statisticsAnalysisId: statsId || undefined,
    })
      .then((res) => {
        if (cancelled) return
        setPreview(res.computed)
        setPreviewPred(res.prediction)
        setPreviewLab(res.dataset)
      })
      .catch((e) => {
        if (cancelled) return
        setPreview(null)
        setError(toUserFacingError(e, "Preview failed"))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeStudy, endpoint, predictionId, datasetId, metricKey, statsId])

  const onSave = async () => {
    if (!activeStudy || !user || !canEdit || !predictionId || !datasetId) return
    setBusy(true)
    setError(null)
    try {
      const record = await createComparison(activeStudy.id, { id: user.uid }, {
        endpoint,
        predictionRunId: predictionId,
        labDatasetId: datasetId,
        experimentalMetricKey: metricKey || undefined,
        statisticsAnalysisId: statsId || undefined,
        researcherNotes: notes.trim() || undefined,
        concordanceFlag: concordance,
      })
      await refresh()
      setSelectedId(record.id)
    } catch (e) {
      setError(toUserFacingError(e, "Save failed"))
    } finally {
      setBusy(false)
    }
  }

  const onUpdateNotes = async () => {
    if (!activeStudy || !user || !canEdit || !selectedId) return
    setBusy(true)
    try {
      await updateComparison(activeStudy.id, selectedId, { id: user.uid }, {
        researcherNotes: notes,
        concordanceFlag: concordance,
      })
      await refresh()
    } catch (e) {
      setError(toUserFacingError(e, "Update failed"))
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!activeStudy || !user || !canEdit || !deleteId) return
    setBusy(true)
    try {
      await deleteComparison(activeStudy.id, deleteId, { id: user.uid })
      if (selectedId === deleteId) setSelectedId(null)
      setDeleteId(null)
      await refresh()
    } catch (e) {
      setError(toUserFacingError(e, "Delete failed"))
    } finally {
      setBusy(false)
    }
  }

  if (studyLoading) {
    return <p className="text-sm" style={{ color: "#64748b" }}>Loading study…</p>
  }
  if (!activeStudy) {
    return (
      <ResearchEmptyState
        title="Select a study"
        body="Prediction vs Experimental comparison requires an active study."
        canEdit={false}
      />
    )
  }

  const compat = preview?.compatibility
  const compatStyle = statusStyle(compat?.status ?? "INCOMPATIBLE")
  const predChart = previewPred ? predChartPoints(previewPred) : []
  const expChart = preview ? expChartPoints(preview.experimentalSummaries) : []
  const alignedChart =
    preview?.alignedPoints.map((p) => ({
      concentration: p.concentration,
      predicted: p.predictedValue,
      experimental: p.experimentalMean,
      sd: p.experimentalSd ?? 0,
    })) ?? []

  return (
    <ModuleShell
      icon={GitCompare}
      title="Prediction vs Experimental"
      subtitle="Transparent side-by-side comparison for DPPH and LDH only — never automatic validation."
      evidence={["PREDICTED", "EXPERIMENTAL"]}
      phase="analysis"
      contractNote="Never auto-label concordance as proven validation. MTT / ROS / BAX / Hippo–YAP have no experimental pair in this study. No automatic µM ↔ µg/mL conversion."
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "#64748b" }}>
        <span>{comparisonRoleLabel(membership?.role)}</span>
        <span className="font-mono">
          {COMPARISON_CALCULATION_METHOD} · v{COMPARISON_CALCULATION_VERSION}
        </span>
      </div>

      <div
        className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
        style={{ borderColor: "#bfdbfe", background: "#eff6ff", color: "#1e3a8a" }}
        role="note"
      >
        Computational predictions and experimental measurements are distinct evidence layers.
        Agreement does not by itself establish experimental validation of the computational method.
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
          Comparison setup
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FormField label="Endpoint" required>
            <select
              className={inputClass}
              style={inputStyle}
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value as Endpoint)}
            >
              <option value="dpph">DPPH</option>
              <option value="ldh">LDH</option>
            </select>
          </FormField>
          <FormField label="Prediction run" required>
            <select
              className={inputClass}
              style={inputStyle}
              value={predictionId}
              onChange={(e) => setPredictionId(e.target.value)}
            >
              <option value="">Select prediction…</option>
              {predictions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.runName} ({p.provenance.evidenceClass})
                </option>
              ))}
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
          <FormField label="Experimental metric">
            <select
              className={inputClass}
              style={inputStyle}
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              disabled={!datasetId}
            >
              {labCfg.measurementKeys.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="Statistics analysis (optional)">
          <select
            className={inputClass}
            style={inputStyle}
            value={statsId}
            onChange={(e) => setStatsId(e.target.value)}
          >
            <option value="">None</option>
            {statsList
              .filter((s) => !datasetId || s.labDatasetId === datasetId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.measurementLabel} · {s.freshness === "STALE" ? "STALE" : "CURRENT"} ·{" "}
                  {new Date(s.calculatedAt).toLocaleDateString()}
                </option>
              ))}
          </select>
        </FormField>
      </section>

      {/* Saved */}
      <section className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#dde5ef" }}>
        <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ background: "#f8fafc", color: "#546e8a" }}>
          Saved comparisons ({saved.length})
        </div>
        {saved.length === 0 ? (
          <p className="px-3 py-3 text-sm" style={{ color: "#94a3b8" }}>No saved comparisons yet.</p>
        ) : (
          <ul>
            {saved.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs border-t"
                style={{ borderColor: "#eef2f7" }}
              >
                <button
                  type="button"
                  className="flex-1 text-left font-semibold min-w-[12rem]"
                  style={{ color: selectedId === c.id ? "#00a882" : "#0d1f3c" }}
                  onClick={() => {
                    setSelectedId(c.id)
                    setEndpoint(c.endpoint)
                    setPredictionId(c.predictionRunId)
                    setDatasetId(c.labDatasetId)
                    setMetricKey(c.experimentalMetricKey)
                    setStatsId(c.statisticsAnalysisId ?? "")
                    setNotes(c.researcherNotes ?? "")
                    setConcordance(c.concordanceFlag)
                  }}
                >
                  {c.endpoint.toUpperCase()} · {c.comparisonMode} · {c.compatibilityStatus}
                  <span className="block font-normal" style={{ color: "#64748b" }}>
                    {c.predictionRunName} vs {c.labDatasetName}
                  </span>
                </button>
                {c.freshness === "STALE" ? (
                  <span
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-bold uppercase"
                    style={{ borderColor: "#fcd34d", background: "#fffbeb", color: "#b45309" }}
                  >
                    <AlertTriangle size={11} /> Stale / requires review
                  </span>
                ) : (
                  <span className="font-mono" style={{ color: "#64748b" }}>CURRENT</span>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                    onClick={() => setDeleteId(c.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedSaved?.freshness === "STALE" ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm flex gap-2"
          style={{ borderColor: "#fcd34d", background: "#fffbeb", color: "#92400e" }}
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">STALE / REQUIRES REVIEW</p>
            <p className="text-xs mt-1">
              Source prediction, laboratory data, and/or linked statistics changed after this comparison
              was saved. Do not treat it as current.
            </p>
          </div>
        </div>
      ) : null}

      {compat ? (
        <section
          className="rounded-xl border p-4 space-y-2"
          style={{ background: "#fff", borderColor: "#dde5ef" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
              Compatibility
            </h2>
            <span
              className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
              style={{
                background: compatStyle.bg,
                borderColor: compatStyle.border,
                color: compatStyle.color,
              }}
            >
              {compat.status}
            </span>
            <span className="text-[11px]" style={{ color: "#64748b" }}>
              Mode: {preview?.comparisonMode}
            </span>
          </div>
          <ul className="text-xs list-disc pl-4 space-y-0.5" style={{ color: "#475569" }}>
            {compat.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {preview?.statisticsRef?.freshness === "STALE" ? (
            <p className="text-xs font-semibold" style={{ color: "#b45309" }}>
              {preview.statisticsRef.warning}
            </p>
          ) : null}
        </section>
      ) : null}

      {preview && previewPred && previewLab ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              title="Computational"
              badge={preview.predictionEvidenceClass}
              meta={[
                ["Run", previewPred.runName],
                ["Method", previewPred.methodName],
                ["Subject", predCfg.subjectType],
                ["Units", predictionUnitLabel(previewPred.concentrationUnit)],
                ["Source", previewPred.source],
              ]}
            >
              <ResultTable
                headers={["Conc.", "Unit", "Metric", "Value"]}
                rows={preview.predictionPoints.map((p) => [
                  String(p.concentration),
                  predictionUnitLabel(p.concentrationUnit),
                  p.metric,
                  `${p.value} ${p.valueUnit}`,
                ])}
              />
            </Panel>
            <Panel
              title="Experimental"
              badge="EXPERIMENTAL"
              meta={[
                ["Dataset", previewLab.datasetName],
                ["Laboratory", previewLab.laboratoryName],
                ["Protocol", previewLab.protocolReference],
                ["Units", "µg/mL"],
                ["Cell line", previewLab.cellLineName || "—"],
              ]}
            >
              <ResultTable
                headers={["Tx", "Conc.", "n", "Mean", "SD"]}
                rows={preview.experimentalSummaries.map((s) => [
                  s.treatmentCode,
                  s.concentrationUgPerMl != null ? String(s.concentrationUgPerMl) : "—",
                  String(s.n),
                  fmt(s.mean),
                  fmt(s.sd),
                ])}
              />
            </Panel>
          </div>

          {/* Charts */}
          <section className="rounded-xl border p-4 space-y-4" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <h3 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
              Comparison visualization
            </h3>

            {endpoint === "dpph" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard
                  title="Computational DPPH"
                  subtitle="µM — compound-level"
                  evidence="PREDICTED"
                >
                  <SimpleLine data={predChart} xKey="concentration" yKey="value" color="#2196d3" />
                </ChartCard>
                <ChartCard
                  title="Experimental DPPH"
                  subtitle="µg/mL — formulation-level"
                  evidence="EXPERIMENTAL"
                >
                  <SimpleBar data={expChart} />
                </ChartCard>
              </div>
            ) : preview.comparisonMode === "ALIGNED" && alignedChart.length > 0 ? (
              <ChartCard
                title="Aligned LDH (µg/mL)"
                subtitle="Predicted vs experimental mean ± SD at matching concentrations"
                evidence="EXPERIMENTAL"
              >
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={alignedChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="concentration"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        label={{ value: "µg/mL", position: "insideBottom", offset: -2, fontSize: 10 }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        name="Computational"
                        stroke="#2196d3"
                        strokeWidth={2}
                        dot
                      />
                      <Line
                        type="monotone"
                        dataKey="experimental"
                        name="Experimental mean"
                        stroke="#00a882"
                        strokeWidth={2}
                        dot
                      >
                        <ErrorBar dataKey="sd" width={4} strokeWidth={1.5} stroke="#0d1f3c" />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Computational LDH" subtitle="µg/mL" evidence="PREDICTED">
                  <SimpleLine data={predChart} xKey="concentration" yKey="value" color="#2196d3" />
                </ChartCard>
                <ChartCard title="Experimental LDH" subtitle="µg/mL mean ± SD" evidence="EXPERIMENTAL">
                  <SimpleBar data={expChart} />
                </ChartCard>
              </div>
            )}
          </section>

          {preview.alignedPoints.length > 0 ? (
            <section className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#dde5ef" }}>
              <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ background: "#f8fafc", color: "#546e8a" }}>
                Agreement / difference (aligned concentrations only)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ color: "#546e8a" }}>
                      <th className="text-left p-2 font-mono">Conc.</th>
                      <th className="text-left p-2 font-mono">Predicted</th>
                      <th className="text-left p-2 font-mono">Exp. mean</th>
                      <th className="text-left p-2 font-mono">Exp. SD</th>
                      <th className="text-left p-2 font-mono">Δ</th>
                      <th className="text-left p-2 font-mono">|Δ|</th>
                      <th className="text-left p-2 font-mono">% Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.alignedPoints.map((p) => (
                      <tr key={p.concentration} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td className="p-2 font-mono">
                          {p.concentration} µg/mL ({p.treatmentCode})
                        </td>
                        <td className="p-2 font-mono">
                          {fmt(p.predictedValue)} {p.predictedValueUnit}
                        </td>
                        <td className="p-2 font-mono">{fmt(p.experimentalMean)}</td>
                        <td className="p-2 font-mono">{fmt(p.experimentalSd)}</td>
                        <td className="p-2 font-mono">
                          {p.differencesComputed ? fmt(p.signedDifference) : "—"}
                        </td>
                        <td className="p-2 font-mono">
                          {p.differencesComputed ? fmt(p.absoluteDifference) : "—"}
                        </td>
                        <td className="p-2 font-mono">
                          {p.differencesComputed && p.percentDifference != null
                            ? `${fmt(p.percentDifference)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-3 py-2 text-[10px]" style={{ color: "#94a3b8", background: "#f8fafc" }}>
                Differences only when metric meanings are compatible. Not a model validation score.
              </p>
            </section>
          ) : (
            <p className="text-xs" style={{ color: "#64748b" }}>
              No concentration-aligned difference table for this comparison (side-by-side only).
            </p>
          )}

          <section className="rounded-xl border p-4 space-y-3" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <h3 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
              Researcher notes <EvidenceBadge type="INTERPRETATION" className="ml-2 align-middle" />
            </h3>
            <p className="text-[11px]" style={{ color: "#64748b" }}>
              Human-authored observations only. Do not auto-decide hypothesis acceptance, efficacy, or
              mechanism here.
            </p>
            {canEdit ? (
              <>
                <FormField label="Observed concordance (researcher judgment)">
                  <select
                    className={inputClass}
                    style={inputStyle}
                    value={concordance}
                    onChange={(e) =>
                      setConcordance(e.target.value as typeof concordance)
                    }
                  >
                    <option value="not_assessed">Not assessed</option>
                    <option value="consistent">Consistent</option>
                    <option value="partially_consistent">Partially consistent</option>
                    <option value="divergent">Divergent</option>
                  </select>
                </FormField>
                <FormField label="Notes">
                  <textarea
                    className={textareaClass}
                    style={inputStyle}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Agreement/disagreement, methodological limits, next experimental step…"
                  />
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !preview.canPersist}
                    onClick={() => void onSave()}
                    className="nano-setup-save"
                  >
                    <Save size={13} />
                    Save comparison
                  </button>
                  {selectedId ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onUpdateNotes()}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                      style={{ borderColor: "#dde5ef", color: "#475569" }}
                    >
                      Update notes
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: "#64748b" }}>
                {notes || selectedSaved?.researcherNotes || "No researcher notes."}
              </p>
            )}
          </section>

          <section className="rounded-xl border p-4 text-xs space-y-1" style={{ background: "#fff", borderColor: "#dde5ef", color: "#475569" }}>
            <h3 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
              Source provenance
            </h3>
            <p>
              Trace: Comparison → Prediction run ({previewPred.id}) + Lab dataset ({previewLab.id})
              {preview.statisticsRef ? ` + Statistics (${preview.statisticsRef.analysisId})` : ""}
            </p>
            <p>
              Prediction updated {previewPred.updatedAt} · Lab updated {previewLab.updatedAt}
            </p>
            {preview.notices.map((n) => (
              <p key={n}>• {n}</p>
            ))}
          </section>
        </>
      ) : (
        <p className="text-sm" style={{ color: "#94a3b8" }}>
          {busy ? "Computing…" : "Select a prediction run and experimental dataset to compare."}
        </p>
      )}

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        title="Delete comparison?"
        message="Removes the saved comparison record. Prediction runs and laboratory data are not deleted."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void onDelete()}
        busy={busy}
      />
    </ModuleShell>
  )
}

function Panel({
  title,
  badge,
  meta,
  children,
}: {
  title: string
  badge: "PREDICTED" | "SIMULATION" | "EXPERIMENTAL"
  meta: [string, string][]
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#dde5ef" }}>
      <div className="px-3 py-2 flex items-center justify-between gap-2" style={{ background: "#f8fafc" }}>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
          {title}
        </span>
        <EvidenceBadge type={badge} />
      </div>
      <div className="px-3 py-2 grid grid-cols-2 gap-2 text-[11px]">
        {meta.map(([k, v]) => (
          <div key={k}>
            <div className="font-mono uppercase tracking-wider text-[9px]" style={{ color: "#94a3b8" }}>
              {k}
            </div>
            <div style={{ color: "#0d1f3c" }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="border-t" style={{ borderColor: "#eef2f7" }}>
        {children}
      </div>
    </section>
  )
}

function ResultTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (!rows.length) {
    return <p className="px-3 py-3 text-xs" style={{ color: "#94a3b8" }}>No result points.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: "#546e8a" }}>
            {headers.map((h) => (
              <th key={h} className="text-left p-2 font-mono">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid #eef2f7" }}>
              {row.map((cell, j) => (
                <td key={j} className="p-2 font-mono">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  evidence,
  children,
}: {
  title: string
  subtitle: string
  evidence: "PREDICTED" | "EXPERIMENTAL"
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "#e2e8f0" }}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div>
          <p className="text-xs font-bold" style={{ color: "#0d1f3c" }}>
            {title}
          </p>
          <p className="text-[10px]" style={{ color: "#64748b" }}>
            {subtitle}
          </p>
        </div>
        <EvidenceBadge type={evidence} />
      </div>
      {children}
    </div>
  )
}

function SimpleLine({
  data,
  xKey,
  yKey,
  color,
}: {
  data: Record<string, number | string>[]
  xKey: string
  yKey: string
  color: string
}) {
  if (!data.length) {
    return <p className="text-xs py-8 text-center" style={{ color: "#94a3b8" }}>No computational results recorded.</p>
  }
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function SimpleBar({
  data,
}: {
  data: { concentration: number; mean: number; sd: number; treatment: string }[]
}) {
  if (!data.length) {
    return (
      <p className="text-xs py-8 text-center" style={{ color: "#94a3b8" }}>
        No experimental results recorded for charting.
      </p>
    )
  }
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="concentration" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="mean" fill="#00a882" radius={[4, 4, 0, 0]}>
            <ErrorBar dataKey="sd" width={4} strokeWidth={1.5} stroke="#0d1f3c" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
