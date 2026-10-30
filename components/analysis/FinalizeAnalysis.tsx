"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { useWorkflowStatus } from "@/components/study/WorkflowStatus"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { listComparisons } from "@/lib/repositories/comparisonRepository"
import { listInterpretations, updateInterpretation } from "@/lib/repositories/interpretationRepository"
import { listLabDatasets } from "@/lib/repositories/labRepository"
import { listStatisticsAnalyses } from "@/lib/repositories/statisticsRepository"
import { analysisFinalizeBlockers, type StudyReadiness } from "@/lib/workflow/studyFlow"
import type { ComparisonRecord, Interpretation, LabDataset, StatisticsRecord } from "@/lib/domain/models"

function filled(row: Interpretation): boolean {
  const overall = (row.interpretationText || row.body || "").trim()
  return Boolean(
    overall &&
      (row.comparisonSummary || "").trim() &&
      (row.limitations || "").trim() &&
      (row.conclusion || "").trim(),
  )
}

interface FinalizeBundle {
  datasets: LabDataset[]
  statistics: StatisticsRecord[]
  comparisons: ComparisonRecord[]
  interpretation: Interpretation
}

export function FinalizeAnalysis({ readiness }: { readiness: StudyReadiness | null }) {
  const { user } = useAuth()
  const { activeStudy, updateActiveStudy } = useStudy()
  const { refresh } = useWorkflowStatus()
  const [open, setOpen] = useState(false)
  const [bundle, setBundle] = useState<FinalizeBundle | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blockers = readiness ? analysisFinalizeBlockers(readiness) : ["Checking study records."]
  const finalizedAt = activeStudy?.analysisFinalizedAt

  const openSummary = async () => {
    if (!activeStudy || blockers.length > 0) return
    setBusy(true)
    setError(null)
    try {
      const [datasets, statistics, comparisons, interpretations] = await Promise.all([
        listLabDatasets(activeStudy.id),
        listStatisticsAnalyses(activeStudy.id),
        listComparisons(activeStudy.id),
        listInterpretations(activeStudy.id),
      ])
      const interpretation =
        interpretations.find((row) => filled(row) && row.status !== "final") ??
        interpretations.find(filled)
      if (!interpretation) {
        setError("Write the interpretation before finalizing.")
        return
      }
      setBundle({
        datasets: datasets.filter((row) => {
          const biological = new Set(["mtt", "ros", "bax", "hippo_yap"])
          return !biological.has(row.assayType)
        }),
        statistics: statistics.filter((row) => row.freshness !== "STALE"),
        comparisons: comparisons.filter((row) => row.freshness !== "STALE"),
        interpretation,
      })
      setOpen(true)
    } catch (e) {
      setError(toUserFacingError(e, "Could not prepare the analysis summary."))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    if (!activeStudy || !user || !bundle) return
    setBusy(true)
    setError(null)
    try {
      await updateInterpretation(activeStudy.id, bundle.interpretation.id, { id: user.uid }, {
        status: "final",
      })
      await updateActiveStudy({
        status: "analysis",
        analysisFinalizedAt: new Date().toISOString(),
      })
      await refresh()
      setOpen(false)
    } catch (e) {
      setError(toUserFacingError(e, "Could not finalize the analysis."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="phyto-block">
      <h3>Finalize analysis</h3>
      <p className="dock-note">
        {finalizedAt
          ? `Finalized ${new Date(finalizedAt).toLocaleString()}. Evidence classes are unchanged.`
          : "Finalizing records this interpretation. Simulation results stay simulations."}
      </p>
      {blockers.map((line) => (
        <p key={line} className="dock-note">{line}</p>
      ))}
      {error ? <p className="nano-studies-alert" role="status">{error}</p> : null}
      <button
        type="button"
        className="phyto-continue"
        disabled={busy || blockers.length > 0}
        onClick={() => void openSummary()}
      >
        <Check size={14} aria-hidden />
        Finalize Analysis
      </button>
      {open && bundle ? (
        <div className="phyto-block" role="region" aria-label="Finalization summary">
          <h4>Experimental datasets</h4>
          {bundle.datasets.length === 0 ? <p className="dock-note">None recorded.</p> : bundle.datasets.map((row) => (
            <p key={row.id} className="dock-note">{row.assayType.toUpperCase()} · {row.datasetName}</p>
          ))}
          <h4>Statistical analyses</h4>
          {bundle.statistics.length === 0 ? <p className="dock-note">None completed.</p> : bundle.statistics.map((row) => (
            <p key={row.id} className="dock-note">
              {row.assayType.toUpperCase()} · {row.measurementLabel}
              {row.anova.pValue != null ? ` · p = ${row.anova.pValue < 0.0001 ? "< 0.0001" : row.anova.pValue.toFixed(4)}` : ""}
            </p>
          ))}
          <h4>Comparisons</h4>
          {bundle.comparisons.length === 0 ? <p className="dock-note">None completed.</p> : bundle.comparisons.map((row) => (
            <p key={row.id} className="dock-note">
              {row.endpoint.toUpperCase()} · {row.comparisonMode} · {row.compatibilityStatus}
            </p>
          ))}
          <h4>Interpretation</h4>
          <p className="dock-note">{bundle.interpretation.interpretationText || bundle.interpretation.body}</p>
          <h4>Relationship</h4>
          <p className="dock-note">{bundle.interpretation.comparisonSummary}</p>
          <h4>Limitations</h4>
          <p className="dock-note">{bundle.interpretation.limitations}</p>
          <h4>Conclusion</h4>
          <p className="dock-note">{bundle.interpretation.conclusion}</p>
          <div className="phyto-nav">
            <button type="button" className="phyto-back" disabled={busy} onClick={() => setOpen(false)}>
              Back
            </button>
            <button type="button" className="phyto-continue" disabled={busy} onClick={() => void confirm()}>
              {busy ? "Finalizing…" : "Confirm finalization"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
