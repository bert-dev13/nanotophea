"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, Atom, BrainCircuit, Check, CheckCircle2, Cpu, Dna, FlaskConical, Loader2, Microscope, Scale, ScanSearch, Sparkles, SunMedium, TestTubes, Zap, type LucideIcon } from "lucide-react"
import { AskAiLink } from "@/components/ai/ask-ai-link"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import type { ComparisonComputation } from "@/lib/comparison/runComparison"
import type { StructuredInterpretation } from "@/lib/ai/interpretation-schema"
import type { LabDataset, LabObservation, PredictionRun } from "@/lib/domain/models"
import { deriveMttObservations, summarizeObservations } from "@/lib/lab/derivedAssays"
import { PREDICTION_LAB_ENDPOINTS } from "@/lib/lab/sections"
import { sanitizedPredictionSummary } from "@/lib/predictions/displaySanitization"
import type { ExperimentalStatsComputation } from "@/lib/statistics/runAnalysis"

const ENDPOINT_LABEL: Record<string, string> = {
  dpph: "DPPH",
  mtt: "MTT",
  ldh: "LDH",
  ros: "ROS",
  bax: "BAX",
  hippo_yap: "Hippo–YAP",
}

const FINDING_KEY = {
  dpph: "dpph",
  mtt: "mtt",
  ldh: "ldh",
  ros: "ros",
  bax: "bax",
  hippo_yap: "hippoYap",
} as const

const DOSE: Record<string, string> = { T3: "50 µg/mL", T4: "100 µg/mL", T5: "250 µg/mL", T6: "500 µg/mL" }

export interface Stage6Review {
  assay: "dpph" | "ldh"
  dataset: LabDataset | null
  prediction: PredictionRun | null
  stats: ExperimentalStatsComputation | null
  comparison: ComparisonComputation | null
}

export interface Stage6Docking {
  id: string
  compound: string
  target: string
  affinity: number
}

interface Stage6ReportProps {
  loading: boolean
  loadError: string | null
  checkError?: string | null
  reviews: Stage6Review[]
  datasets: LabDataset[]
  predictions: PredictionRun[]
  docking: Stage6Docking[]
  literatureCount: number
  predictionCount: number
  labCount: number
  aiStatus: "loading" | "ready" | "failed"
  aiPhase: string
  interpretation: StructuredInterpretation | null
  onRegenerate: () => void
  saveError: string | null
  saving: boolean
  completed: boolean
  canComplete: boolean
  onBack: () => void
  onComplete: () => void
}

interface ResponseRow {
  treatment: string
  concentration: string | null
  parameter: string
  mean: number | null
  sd: number | null
  unit: string
  n: number
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return "—"
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 1 : abs >= 10 ? 2 : 3
  return value.toFixed(digits).replace(/\.?0+$/, "")
}

export function isSyntheticDemo(dataset: LabDataset | null | undefined): boolean {
  return dataset?.provenance.evidenceClass === "SYNTHETIC"
}

function latestByUpdate<T extends { updatedAt: string }>(rows: T[]): T | null {
  return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
}

function isConcentrationUnit(unit: string): boolean {
  return /µg|μg|ug\/|µM|μM|\buM\b|mg\/mL|ng\/mL|g\/mL/i.test(unit)
}

function normalizeConcentrationUnit(unit: string): string {
  if (/ug\/ml|μg\/ml|µg\/ml/i.test(unit)) return "µg/mL"
  if (/µm|\buM\b/i.test(unit)) return "µM"
  return unit
}

function concentrationOf(row: LabObservation): string | null {
  if (row.concentration?.trim()) {
    const unit = row.unit && isConcentrationUnit(row.unit) ? normalizeConcentrationUnit(row.unit) : ""
    if (isConcentrationUnit(row.concentration)) return row.concentration.trim()
    return [row.concentration.trim(), unit].filter(Boolean).join(" ")
  }
  const match = row.treatment?.match(/(\d+(?:\.\d+)?)\s*(µg\/mL|ug\/mL|μg\/mL|µM|uM|mg\/mL)/i)
  if (!match) return null
  return `${match[1]} ${normalizeConcentrationUnit(match[2])}`
}

function defaultParameter(endpoint: string): string {
  switch (endpoint) {
    case "dpph":
    case "mtt":
      return "Absorbance"
    case "ldh":
      return "LDH measurement"
    case "ros":
      return "ROS measurement"
    case "bax":
      return "BAX expression"
    case "hippo_yap":
      return "YAP1 response"
    default:
      return "Measurement"
  }
}

function responseUnit(endpoint: string, parameter: string, storedUnit: string): string {
  if (storedUnit && !isConcentrationUnit(storedUnit)) return storedUnit
  if (/fold/i.test(parameter)) return "fold"
  if (/%|viability|scaveng|cytotox|inhibition/i.test(parameter)) return "%"
  if (/absorbance/i.test(parameter)) return "AU"
  if (endpoint === "dpph" || endpoint === "mtt") return "AU"
  return ""
}

function responseRows(endpoint: string, dataset: LabDataset): ResponseRow[] {
  const source = endpoint === "mtt"
    ? deriveMttObservations(dataset.observations ?? [])
    : summarizeObservations(dataset.observations ?? [])
  return source.map((row) => {
    const n = row.replicates.filter((value) => Number.isFinite(value)).length
    if (endpoint === "mtt" && row.viabilityPercent != null) {
      return {
        treatment: row.treatment || "Treatment",
        concentration: concentrationOf(row),
        parameter: "Cell viability",
        mean: row.viabilityPercent,
        sd: null,
        unit: "%",
        n,
      }
    }
    if (endpoint === "dpph" && row.inhibitionPercent != null) {
      return {
        treatment: row.treatment || "Treatment",
        concentration: concentrationOf(row),
        parameter: "% radical scavenging",
        mean: row.inhibitionPercent,
        sd: row.sd ?? null,
        unit: "%",
        n,
      }
    }
    if (endpoint === "ldh" && row.inhibitionPercent != null) {
      return {
        treatment: row.treatment || "Treatment",
        concentration: concentrationOf(row),
        parameter: "% cytotoxicity",
        mean: row.inhibitionPercent,
        sd: row.sd ?? null,
        unit: "%",
        n,
      }
    }
    const parameter = row.parameter?.trim() || defaultParameter(endpoint)
    return {
      treatment: row.treatment || "Treatment",
      concentration: concentrationOf(row),
      parameter,
      mean: row.mean ?? row.value ?? null,
      sd: row.sd ?? null,
      unit: responseUnit(endpoint, parameter, row.unit?.trim() ?? ""),
      n,
    }
  })
}

function withUnit(value: string, unit: string): string {
  return unit ? `${value} ${unit}` : value
}

function formatMean(mean: number, sd: number | null, unit: string): string {
  const body = sd != null ? `${fmt(mean)} ± ${fmt(sd)}` : fmt(mean)
  return withUnit(body, unit)
}

function endpointRecord(datasets: LabDataset[], endpoint: string): { experimental: LabDataset | null; synthetic: LabDataset | null } {
  const rows = datasets.filter((row) => row.assayType === endpoint)
  return {
    experimental: latestByUpdate(rows.filter((row) => row.provenance.evidenceClass !== "SYNTHETIC")),
    synthetic: latestByUpdate(rows.filter((row) => row.provenance.evidenceClass === "SYNTHETIC")),
  }
}

function genuineDataset(datasets: LabDataset[], endpoint: string): LabDataset | null {
  return endpointRecord(datasets, endpoint).experimental
}

function predictionSummary(run: PredictionRun | null): string {
  if (!run) return "Not recorded"
  // Sanitized display: exploratory SIMULATION never presents legacy IC50/TEAC/SI as assay truth.
  return sanitizedPredictionSummary(run)
}

function labSummary(endpoint: string, dataset: LabDataset | null, review: Stage6Review | undefined): string {
  if (!dataset) return "Not recorded"
  if (dataset.ic50?.value != null && Number.isFinite(dataset.ic50.value)) {
    return `IC50 ${fmt(dataset.ic50.value)}${dataset.ic50.unit ? ` ${dataset.ic50.unit}` : ""}`
  }
  const doses = review?.stats?.treatmentSummaries.filter((row) => row.mean != null && !row.notApplicable && DOSE[row.treatmentCode]) ?? []
  if (doses.length > 0 && review?.stats) {
    const label = review.stats.measurementLabel
    if (doses.length === 1) return `${fmt(doses[0].mean!)} ${label}`
    return `${fmt(doses[0].mean!)}–${fmt(doses[doses.length - 1].mean!)} ${label}`
  }
  const rows = responseRows(endpoint, dataset).filter((row) => row.mean != null)
  const measured = rows.filter((row) => row.concentration)
  const use = measured.length > 0 ? measured : rows
  if (use.length === 0) return "Recorded"
  const name = use[0].parameter
  if (use.length === 1) return `${name} ${formatMean(use[0].mean!, use[0].sd, use[0].unit)}`
  return `${name} ${fmt(use[0].mean!)}–${fmt(use[use.length - 1].mean!)}${use[0].unit ? ` ${use[0].unit}` : ""}`
}

function statisticalSentence(stats: ExperimentalStatsComputation): string | null {
  if (stats.completeness.incomplete || stats.anova.pValue == null || stats.anova.significant == null) return null
  const p = stats.anova.pValue < 0.0001 ? "p < 0.0001" : `p = ${fmt(stats.anova.pValue)}`
  if (stats.anova.significant) return `The calculated comparison detected a difference among treatment groups (${p}).`
  return `The calculated comparison did not detect a difference among treatment groups (${p}).`
}

function affinityText(value: number): string {
  const digits = Math.abs(value).toFixed(3)
  return `${value < 0 ? "−" : ""}${digits} kcal/mol`
}

function chartSeries(endpoint: string, dataset: LabDataset | null, review: Stage6Review | undefined, kind: string): ResponseRow[] {
  if (!dataset || kind !== "EXPERIMENTAL") return []
  const doses = review?.stats?.treatmentSummaries.filter((row) => row.mean != null && !row.notApplicable && DOSE[row.treatmentCode]) ?? []
  if (doses.length >= 2 && review?.stats) {
    const unit = review.stats.measurementLabel.includes("%") ? "%" : ""
    return doses.map((row) => ({
      treatment: row.treatmentCode,
      concentration: DOSE[row.treatmentCode] ?? row.treatmentCode,
      parameter: review.stats?.measurementLabel ?? "Measurement",
      mean: row.mean ?? null,
      sd: row.sd ?? null,
      unit,
      n: row.n,
    }))
  }
  const rows = responseRows(endpoint, dataset).filter((row) => row.mean != null && row.concentration)
  const grouped = new Map<string, ResponseRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.unit) ?? []
    list.push(row)
    grouped.set(row.unit, list)
  }
  const best = [...grouped.values()].sort((a, b) => b.length - a.length)[0]
  return best && best.length >= 2 ? best : []
}

function measurementLines(endpoint: string, dataset: LabDataset | null, review: Stage6Review | undefined): Array<{ label: string; value: string }> {
  if (!dataset) return []
  const doses = review?.stats?.treatmentSummaries.filter((row) => row.mean != null && !row.notApplicable) ?? []
  if (doses.length > 0 && review?.stats) {
    const unit = review.stats.measurementLabel.includes("%") ? "%" : ""
    return doses.map((row) => ({
      label: DOSE[row.treatmentCode] ?? row.treatmentCode,
      value: formatMean(row.mean!, row.sd ?? null, unit),
    }))
  }
  return responseRows(endpoint, dataset)
    .filter((row) => row.mean != null)
    .slice(0, 6)
    .map((row) => ({
      label: row.concentration ?? row.treatment,
      value: formatMean(row.mean!, row.sd, row.unit),
    }))
}

function evidenceLimitations(datasets: LabDataset[], reviews: Stage6Review[], dockingCount: number, literatureCount: number): string[] {
  const items: string[] = []
  const missing: string[] = []
  const syntheticOnly: string[] = []
  for (const id of PREDICTION_LAB_ENDPOINTS) {
    const record = endpointRecord(datasets, id)
    if (record.experimental) continue
    if (record.synthetic) syntheticOnly.push(ENDPOINT_LABEL[id])
    else missing.push(ENDPOINT_LABEL[id])
  }
  if (missing.length === PREDICTION_LAB_ENDPOINTS.length) {
    items.push("No experimental laboratory records are stored for the six endpoints.")
  } else if (missing.length > 0) {
    items.push(`No experimental record is stored for ${missing.join(", ")}.`)
  }
  if (syntheticOnly.length > 0) {
    items.push(`${syntheticOnly.join(", ")} ${syntheticOnly.length === 1 ? "has" : "have"} a synthetic test record and ${syntheticOnly.length === 1 ? "is" : "are"} not experimental evidence.`)
  }
  for (const id of PREDICTION_LAB_ENDPOINTS) {
    const dataset = genuineDataset(datasets, id)
    if (!dataset) continue
    const review = reviews.find((row) => row.assay === id && row.dataset?.id === dataset.id)
    const rows = responseRows(id, dataset)
    const measured = rows.filter((row) => row.concentration || !/control/i.test(row.treatment))
    if (measured.length > 0 && measured.every((row) => row.n < 2) && !review?.stats) {
      items.push(`${ENDPOINT_LABEL[id]} does not include replicate measurements.`)
    }
    if (review?.comparison && !review.comparison.compatibility.allowAlignedComparison) {
      items.push(`Prediction and laboratory measurements for ${ENDPOINT_LABEL[id]} are not in compatible units.`)
    }
    if ((id === "dpph" || id === "ldh") && (!review?.stats || statisticalSentence(review.stats) == null)) {
      items.push(`Statistical analysis is not available for ${ENDPOINT_LABEL[id]}.`)
    }
  }
  if (dockingCount > 0) items.push("Docking affinity is a computational prediction and is not experimental binding evidence.")
  if (literatureCount === 0) items.push("No literature record is attached to this study.")
  return items
}

export function Stage6Report({
  loading,
  loadError,
  checkError,
  reviews,
  datasets,
  predictions,
  docking,
  literatureCount,
  predictionCount,
  aiStatus,
  aiPhase,
  interpretation,
  onRegenerate,
  saveError,
  saving,
  completed,
  canComplete,
  onBack,
  onComplete,
}: Stage6ReportProps) {
  const genuineCount = PREDICTION_LAB_ENDPOINTS.filter((id) => genuineDataset(datasets, id)).length
  const [updated, setUpdated] = useState(false)
  const previousStatus = useRef(aiStatus)
  const sawReady = useRef(false)
  useEffect(() => {
    const prior = previousStatus.current
    previousStatus.current = aiStatus
    if (prior === "loading" && aiStatus === "ready" && sawReady.current) {
      setUpdated(true)
      const timer = window.setTimeout(() => setUpdated(false), 4200)
      return () => window.clearTimeout(timer)
    }
    if (aiStatus === "ready") sawReady.current = true
  }, [aiStatus])
  const limitations = evidenceLimitations(datasets, reviews, docking.length, literatureCount)
  const computational = interpretation?.computationalFindings
    || (predictionCount > 0
      ? `${predictionCount} biological prediction ${predictionCount === 1 ? "record is" : "records are"} stored${docking.length ? `, with ${docking.length} completed docking ${docking.length === 1 ? "result" : "results"}` : ""}.`
      : "No biological prediction is stored.")
  const laboratory = interpretation?.laboratoryFindings
    || (genuineCount > 0
      ? `${genuineCount} experimental laboratory ${genuineCount === 1 ? "record is" : "records are"} stored.`
      : "No experimental laboratory record is stored for these endpoints.")
  const integrated = interpretation?.computationalVsExperimental

  return (
    <div className="nano-setup">
      <header className="nano-setup-intro nano-setup-intro--compact">
        <div className="nano-setup-intro-copy">
          <span className="nano-setup-mark" aria-hidden>
            <Scale size={18} strokeWidth={1.85} />
          </span>
          <div>
            <p className="nano-setup-kicker">06 · Analysis & Interpretation</p>
            <h1 className="nano-setup-title">Analysis & Interpretation</h1>
            <p className="nano-setup-lead">Integrated assessment of computational predictions, molecular docking, and laboratory evidence.</p>
            <div className="stage6-actions">
              <AskAiLink context="analysis" label="Ask AI" className="phyto-back" icon />
              <button type="button" className="phyto-continue" onClick={onRegenerate} disabled={aiStatus === "loading"}>
                <Sparkles size={14} strokeWidth={1.85} aria-hidden />
                {aiStatus === "loading" ? "Generating..." : "Regenerate Interpretation"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="stage6-strip" aria-label="Study evidence">
        <StatusChip icon={FlaskConical} label="Biological Predictions" value={loading ? "…" : `${predictionCount}/6`} on={!loading && predictionCount === 6} />
        <StatusChip icon={TestTubes} label="Laboratory Validation" value={loading ? "…" : `${genuineCount}/6`} on={!loading && genuineCount === 6} />
        <StatusChip icon={Atom} label="Molecular Docking" value={loading ? "…" : docking.length > 0 ? "Complete" : "Pending"} on={!loading && docking.length > 0} />
        <StatusChip icon={Sparkles} label="AI Interpretation" value={aiStatus === "ready" ? "Generated" : aiStatus === "failed" ? "Unavailable" : "Pending"} on={aiStatus === "ready"} />
      </div>

      {checkError ? <p className="nano-studies-alert" role="alert">{checkError}</p> : null}
      {loadError ? <p className="nano-studies-alert" role="alert">{loadError}</p> : null}

      <EvidenceFlow />

      <section className="stage6-section" aria-labelledby="stage6-compare">
        <div className="stage6-section-head">
          <h2 id="stage6-compare">Prediction vs Laboratory Results</h2>
          <p>Each endpoint keeps its computational result and laboratory record side by side.</p>
        </div>
        <div className="stage6-cards">
          {PREDICTION_LAB_ENDPOINTS.map((id) => {
            const record = endpointRecord(datasets, id)
            const dataset = record.experimental ?? record.synthetic
            const kind = record.experimental ? "EXPERIMENTAL" : record.synthetic ? "SYNTHETIC" : "none"
            const prediction = latestByUpdate(predictions.filter((row) => (row.endpoint ?? row.module) === id))
            const review = reviews.find((row) => row.assay === id && record.experimental && row.dataset?.id === record.experimental.id)
            const statsLine = review?.stats ? statisticalSentence(review.stats) : null
            const finding = interpretation?.endpointFindings[FINDING_KEY[id]]
            const series = chartSeries(id, dataset, review, kind)
            const lines = measurementLines(id, dataset, review)
            const EndpointIcon = ENDPOINT_ICON[id] ?? FlaskConical
            const compared = review?.comparison?.compatibility.allowAlignedComparison
            return (
              <article key={id} className="stage6-card">
                <header className="stage6-card-head">
                  <span className="stage6-card-mark" aria-hidden><EndpointIcon size={16} strokeWidth={1.85} /></span>
                  <h3>{ENDPOINT_LABEL[id]}</h3>
                  <span className="stage6-badges">
                    {prediction ? <EvidenceBadge type="PREDICTED" /> : null}
                    {kind === "EXPERIMENTAL" ? <EvidenceBadge type="EXPERIMENTAL" /> : null}
                    {kind === "SYNTHETIC" ? <EvidenceBadge type="SYNTHETIC" /> : null}
                  </span>
                </header>
                <div className="stage6-evidence">
                  <div>
                    <p className="stage6-kicker"><Cpu size={12} aria-hidden /> Computational result</p>
                    <strong>{predictionSummary(prediction)}</strong>
                  </div>
                  <span className="stage6-connector" aria-hidden><ArrowDown size={14} /></span>
                  <div>
                    <p className="stage6-kicker">
                      {kind === "SYNTHETIC" ? <FlaskConical size={12} aria-hidden /> : <TestTubes size={12} aria-hidden />}
                      {kind === "SYNTHETIC" ? "Synthetic record" : "Laboratory result"}
                    </p>
                    <strong>{kind === "none" ? "Not recorded" : labSummary(id, dataset, review)}</strong>
                    {kind === "SYNTHETIC" ? <p>Stored as SYNTHETIC. This is not experimental evidence.</p> : null}
                    {lines.filter((line) => !series.some((row) => row.concentration === line.label)).length > 0 && kind !== "none" ? (
                      <ul className="stage6-measures">
                        {lines.filter((line) => !series.some((row) => row.concentration === line.label)).map((line) => (
                          <li key={`${line.label}-${line.value}`}><span>{line.label}</span><b>{line.value}</b></li>
                        ))}
                      </ul>
                    ) : null}
                    <ResponseChart rows={series} />
                  </div>
                </div>
                <div className="stage6-assess">
                  <p className="stage6-kicker">Assessment</p>
                  <p>{assessmentCopy(kind, Boolean(prediction), statsLine, finding)}</p>
                  {review?.comparison && compared === false ? <p>These prediction and laboratory measurements are not numerically compared.</p> : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="stage6-section" aria-labelledby="stage6-docking">
        <div className="stage6-dock">
          <header className="stage6-section-head">
            <span className="stage6-card-mark" aria-hidden><Atom size={16} strokeWidth={1.85} /></span>
            <div>
              <h2 id="stage6-docking">Molecular Docking</h2>
              <p>Predicted compound–target interactions</p>
            </div>
          </header>
          {docking.length === 0 ? <p className="stage6-muted">No completed docking result is stored.</p> : (
            <ul className="stage6-dock-list">
              {docking.map((row) => (
                <li key={row.id}>
                  <Atom size={15} aria-hidden />
                  <p><strong>{row.compound}</strong><ArrowRight size={13} aria-hidden /><strong>{row.target}</strong></p>
                  <em>{affinityText(row.affinity)}</em>
                  <EvidenceBadge type="PREDICTED" />
                </li>
              ))}
            </ul>
          )}
          <p className="stage6-disclaimer">Docking affinities are computational predictions and do not constitute experimental binding evidence.</p>
        </div>
      </section>

      <section className="stage6-ai" aria-labelledby="stage6-ai" aria-busy={aiStatus === "loading"}>
        <header className="stage6-ai-head">
          <span className="stage6-ai-mark" data-busy={aiStatus === "loading" ? "true" : "false"} aria-hidden>
            <Sparkles size={18} strokeWidth={1.85} />
          </span>
          <div>
            <p>HEPATOTEA AI</p>
            <h2 id="stage6-ai">Research AI Interpretation</h2>
          </div>
          {updated ? <p className="stage6-updated" role="status"><Check size={14} aria-hidden /> Interpretation updated</p> : null}
        </header>
        {aiStatus === "loading" ? <AiProcessing phase={aiPhase} /> : (
          <div className="stage6-reveal" key={interpretation?.conclusion ?? "stored"}>
            <AiBlock icon={Cpu} title="Computational Findings" text={computational} />
            <AiBlock icon={TestTubes} title="Laboratory Findings" text={laboratory} />
            <AiBlock icon={Scale} title="Integrated Interpretation" text={integrated || "Integrated interpretation is generated from the stored study evidence."} />
          </div>
        )}
        {aiStatus === "failed" ? (
          <div className="stage6-ai-error" role="alert">
            <p>{interpretation ? "The new interpretation could not be generated. The previous interpretation is unchanged." : "The interpretation could not be generated."}</p>
            <button type="button" onClick={onRegenerate}>Try Again</button>
          </div>
        ) : null}
      </section>

      <section className="stage6-section stage6-limits" aria-labelledby="stage6-limits">
        <div className="stage6-section-head">
          <span className="stage6-card-mark" aria-hidden><Scale size={16} strokeWidth={1.85} /></span>
          <h2 id="stage6-limits">Limitations</h2>
        </div>
        {aiStatus === "loading" ? <div className="stage6-skeleton" aria-hidden><span /><span /><span /></div> : limitations.length === 0 ? (
          <p className="stage6-muted">No additional evidence limitations were identified from the stored records.</p>
        ) : (
          <ul>
            {limitations.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </section>

      <section className="stage6-close" aria-labelledby="stage6-close">
        <header>
          <span className="stage6-card-mark" aria-hidden><BrainCircuit size={18} strokeWidth={1.85} /></span>
          <h2 id="stage6-close">Overall Study Conclusion</h2>
        </header>
        {aiStatus === "loading" ? <div className="stage6-skeleton" aria-hidden><span /><span /><span /></div> : (
          <p className="stage6-reveal">{interpretation?.conclusion || "The study conclusion will appear when the interpretation is generated from the stored evidence."}</p>
        )}
        <div className="stage6-badges">
          {(predictionCount > 0 || docking.length > 0) ? <EvidenceBadge type="PREDICTED" /> : null}
          {genuineCount > 0 ? <EvidenceBadge type="EXPERIMENTAL" /> : null}
          {literatureCount > 0 ? <EvidenceBadge type="LITERATURE" /> : null}
          {aiStatus === "ready" ? <EvidenceBadge type="INTERPRETATION" /> : null}
        </div>
      </section>

      {completed ? (
        <div className="stage6-success" role="status">
          <CheckCircle2 size={22} aria-hidden />
          <div>
            <strong>Analysis Completed</strong>
            <p>Stage 6 has been completed successfully.</p>
          </div>
        </div>
      ) : null}
      {saveError && !completed ? (
        <div className="stage6-ai-error" role="alert">
          <p>{saveError}</p>
          <button type="button" onClick={onComplete} disabled={saving}>Retry</button>
        </div>
      ) : null}
      <footer className="phyto-nav">
        <button type="button" className="phyto-back" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden />
          Laboratory Validation
        </button>
        <button
          type="button"
          className={`phyto-continue${completed ? " stage6-done" : ""}${saving ? " stage6-busy" : ""}`}
          disabled={completed || saving || !canComplete}
          aria-busy={saving || undefined}
          onClick={onComplete}
        >
          {completed ? <Check size={15} aria-hidden /> : saving ? <Loader2 size={15} className="stage6-spin" aria-hidden /> : null}
          {completed ? "Analysis Completed" : saving ? "Completing Analysis..." : "Complete Analysis"}
          {completed || saving ? null : <ArrowRight size={15} aria-hidden />}
        </button>
      </footer>
    </div>
  )
}

function StatusChip({ icon: Icon, label, value, on }: { icon: typeof FlaskConical; label: string; value: string; on: boolean }) {
  return (
    <div className="stage6-chip" data-on={on ? "true" : "false"}>
      <span className="stage6-chip-icon" aria-hidden><Icon size={15} strokeWidth={1.85} /></span>
      <span>
        <strong>{label}</strong>
        <em>{value}</em>
      </span>
      {on ? <Check size={14} aria-hidden /> : null}
    </div>
  )
}

const ENDPOINT_ICON: Record<string, LucideIcon> = {
  dpph: SunMedium,
  mtt: Microscope,
  ldh: TestTubes,
  ros: Zap,
  bax: Dna,
  hippo_yap: Atom,
}

const FLOW: Array<{ label: string; icon: LucideIcon; current?: boolean }> = [
  { label: "Computational Screening", icon: ScanSearch },
  { label: "Molecular Docking", icon: Atom },
  { label: "Biological Predictions", icon: FlaskConical },
  { label: "Laboratory Validation", icon: TestTubes },
  { label: "Interpretation", icon: Scale, current: true },
]

const AI_STEPS = [
  "Reading computational predictions",
  "Reviewing molecular docking results",
  "Analyzing laboratory evidence",
  "Comparing evidence",
  "Generating interpretation",
]

function assessmentCopy(kind: "EXPERIMENTAL" | "SYNTHETIC" | "none", prediction: boolean, statsLine: string | null, finding?: string | null): string {
  if (finding?.trim()) return finding.trim()
  if (kind === "SYNTHETIC") return "This stored record is synthetic test data and is not experimental evidence."
  if (kind === "none" && !prediction) return "No computational prediction or laboratory record is stored."
  if (kind === "none") return "Only a computational prediction is stored. Experimental validation is still required."
  if (statsLine) return statsLine
  if (!prediction) return "An experimental laboratory record is stored for this endpoint."
  return "Computational and laboratory records are both stored."
}

function EvidenceFlow() {
  return (
    <ol className="stage6-flow" aria-label="Research evidence flow">
      {FLOW.map((step) => {
        const Icon = step.icon
        return (
          <li key={step.label} data-current={step.current ? "true" : "false"}>
            <Icon size={14} strokeWidth={1.85} aria-hidden />
            <span>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function AiProcessing({ phase }: { phase: string }) {
  const active = Math.max(0, AI_STEPS.indexOf(phase))
  return (
    <div className="stage6-processing" role="status" aria-live="polite">
      <p>Analyzing study evidence...</p>
      <span className="stage6-progress" aria-hidden><span /></span>
      <ol>
        {AI_STEPS.map((step, index) => (
          <li key={step} data-state={index < active ? "done" : index === active ? "active" : "wait"}>{step}</li>
        ))}
      </ol>
      <div className="stage6-skeleton" aria-hidden><span /><span /><span /></div>
    </div>
  )
}

function AiBlock({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article>
      <h3><Icon size={15} strokeWidth={1.85} aria-hidden /> {title}</h3>
      <p>{text}</p>
    </article>
  )
}

function ResponseChart({ rows }: { rows: ResponseRow[] }) {
  const plotted = rows.filter((row) => row.mean != null && (row.concentration || row.treatment))
  if (plotted.length < 2) return null
  const max = Math.max(...plotted.map((row) => Math.abs(row.mean!)), 1)
  return (
    <div className="stage6-chart" role="img" aria-label="Concentration response">
      {plotted.map((row) => (
        <div key={`${row.treatment}-${row.concentration ?? ""}`}>
          <span>{row.concentration ?? row.treatment}</span>
          <span className="stage6-track" aria-hidden><span style={{ width: `${(Math.abs(row.mean!) / max) * 100}%` }} /></span>
          <strong>{formatMean(row.mean!, row.sd, row.unit)}</strong>
        </div>
      ))}
    </div>
  )
}
