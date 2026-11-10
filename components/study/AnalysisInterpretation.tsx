"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useIntegratedInterpretation } from "@/components/analysis/AiInterpretationWorkspace"
import { isSyntheticDemo, Stage6Report } from "@/components/analysis/Stage6Report"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { useWorkflowStatus } from "@/components/study/WorkflowStatus"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { computeComparison, type ComparisonComputation } from "@/lib/comparison/runComparison"
import type { DockingRun, Interpretation, LabDataset, PredictionRun } from "@/lib/domain/models"
import { sanitizedPredictionLines } from "@/lib/predictions/displaySanitization"
import {
  CHARACTERIZATION_ASSAYS,
  CHARACTERIZATION_LABELS,
  getLabAssayConfig,
  type CharacterizationAssay,
} from "@/lib/lab/labAssayConfig"
import {
  ldhNanoparticleSetupSummary,
  ldhSelectivityIndexDisplay,
  normalizeLdhNanoparticleSetup,
} from "@/lib/lab/ldhNanoparticleSetup"
import {
  endpointCoverageStatus,
  PREDICTION_LAB_ENDPOINTS,
  type EndpointCoverageStatus,
} from "@/lib/lab/sections"
import { listLabDatasets, listLabReplicates } from "@/lib/repositories/labRepository"
import { createComparison } from "@/lib/repositories/comparisonRepository"
import { createInterpretation, listInterpretations, updateInterpretation } from "@/lib/repositories/interpretationRepository"
import { listCompounds, listCellLines, listProteins, listReferences } from "@/lib/repositories/researchDataRepository"
import { listDockingRuns, listAdmetRuns, listPredictionRuns } from "@/lib/repositories/scientificRunRepository"
import { createStatisticsAnalysis, listStatisticsAnalyses, recalculateStatisticsAnalysis } from "@/lib/repositories/statisticsRepository"
import {
  computeExperimentalStatistics,
  STATISTICS_CALCULATION_METHOD,
  STATISTICS_CALCULATION_VERSION,
  type ExperimentalStatsComputation,
} from "@/lib/statistics/runAnalysis"
import { screenedCompoundIds } from "@/lib/adme/service"
import { stepRecordStatus, WORKFLOW_STEPS, type StudyReadiness } from "@/lib/workflow/studyFlow"

const INCOMPARABLE = "Direct numerical comparison is not available for these measurements."

const DOSE: Record<"T3" | "T4" | "T5" | "T6", number> = { T3: 50, T4: 100, T5: 250, T6: 500 }

const ENDPOINT_LABEL = {
  dpph: "DPPH",
  mtt: "MTT",
  ldh: "LDH",
  ros: "ROS",
  bax: "BAX",
  hippo_yap: "Hippo–YAP",
} as const

interface CoverageRow {
  id: keyof typeof ENDPOINT_LABEL
  label: string
  status: EndpointCoverageStatus
  simulation: boolean
}

export interface AnalysisInterpretationProps {
  readiness: StudyReadiness | null
  checkError: string | null
  onBackAction?: () => void
  onCompletedAction?: () => void
}

interface AssayReview {
  assay: "dpph" | "ldh"
  title: string
  dataset: LabDataset | null
  prediction: PredictionRun | null
  stats: ExperimentalStatsComputation | null
  comparison: ComparisonComputation | null
  error: string | null
}

function evidencePresentation(row: CoverageRow, reviews: AssayReview[]): {
  tone: "pair" | "simulation" | "experimental" | "untested" | "empty"
  title: string
  note: string
} {
  const comparable = row.status === "recorded"
    && row.simulation
    && (row.id === "dpph" || row.id === "ldh")
    && reviews.some((review) => review.assay === row.id && review.comparison?.canPersist)
  if (row.status === "not_tested") {
    return { tone: "untested", title: "Not tested", note: "Not experimental evidence" }
  }
  if (comparable) {
    return { tone: "pair", title: "Simulation ↔ Experimental", note: "Comparison available" }
  }
  if (row.status !== "recorded" && row.simulation) {
    return { tone: "simulation", title: "Simulation only", note: "No experimental result recorded" }
  }
  if (row.status === "recorded") {
    return { tone: "experimental", title: "Experimental", note: "Experimental result recorded" }
  }
  return { tone: "empty", title: "No simulation recorded", note: "No experimental result recorded" }
}

function latestByUpdate<T extends { updatedAt: string }>(rows: T[]): T | null {
  if (!rows.length) return null
  return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
}

function fmt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const rounded = Math.round(value * 10000) / 10000
  return String(rounded)
}

function formatP(p: number): string {
  if (p < 0.0001) return "p < 0.0001"
  return `p = ${fmt(p)}`
}

function formatPCell(p: number): string {
  if (p < 0.0001) return "< 0.0001"
  return fmt(p)
}

function statisticalSentence(stats: ExperimentalStatsComputation): string {
  if (stats.completeness.incomplete) {
    return "The recorded measurements are incomplete, so a statistical result is not reported."
  }
  if (stats.anova.pValue == null || stats.anova.significant == null) {
    return stats.blockReason || "A statistical comparison could not be calculated from the recorded measurements."
  }
  const p = formatP(stats.anova.pValue)
  if (stats.anova.significant) {
    return `Significant differences were detected among the analyzed treatment groups (${p}).`
  }
  return `No significant differences were detected among the analyzed treatment groups (${p}).`
}

function experimentalFinding(assay: "dpph" | "ldh", stats: ExperimentalStatsComputation): string {
  const metric = assay === "dpph" ? "radical scavenging" : "cytotoxicity"
  const doses = (["T3", "T4", "T5", "T6"] as const)
    .map((code) => stats.treatmentSummaries.find((row) => row.treatmentCode === code))
    .filter((row) => row?.mean != null && Number.isFinite(row.mean))
  if (doses.length < 2) return "Not enough concentration groups have measured values to describe a trend."
  const low = doses[0]!
  const high = doses[doses.length - 1]!
  const from = `${fmt2(low.mean as number)}% at ${DOSE[low.treatmentCode as keyof typeof DOSE]} µg/mL`
  const to = `${fmt2(high.mean as number)}% at ${DOSE[high.treatmentCode as keyof typeof DOSE]} µg/mL`
  if ((high.mean as number) > (low.mean as number)) return `Mean ${metric} increased from ${from} to ${to}.`
  if ((high.mean as number) < (low.mean as number)) return `Mean ${metric} decreased from ${from} to ${to}.`
  return `Mean ${metric} was ${from} and ${to}.`
}

function directionOf(values: number[]): "increasing" | "decreasing" | null {
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) return null
  let up = true
  let down = true
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) up = false
    if (values[index] > values[index - 1]) down = false
  }
  if (up && !down) return "increasing"
  if (down && !up) return "decreasing"
  return null
}

function comparisonStatement(review: AssayReview): string | null {
  const points = review.comparison?.alignedPoints ?? []
  if (!review.comparison?.compatibility.allowAlignedComparison || points.length < 2) return null
  const experimental = points.map((point) => point.experimentalMean)
  if (experimental.some((value) => value == null || !Number.isFinite(value))) return null
  const predicted = directionOf(points.map((point) => point.predictedValue))
  const measured = directionOf(experimental as number[])
  if (!predicted || predicted !== measured) return null
  return `Both datasets show ${predicted === "increasing" ? "an increasing" : "a decreasing"} trend across the tested concentrations.`
}

function concentrationUnit(unit: string): string {
  if (unit === "ug_per_mL") return "µg/mL"
  if (unit === "uM") return "µM"
  return unit
}

function fmt2(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2)
}

function simulationLines(run: PredictionRun | null): string[] {
  if (!run) return []
  // Prefer sanitized lines so legacy TEAC/IC50/SI/populations are not presented as assay truth.
  const sanitized = sanitizedPredictionLines(run)
  if (sanitized.length) return sanitized
  const points = [...run.resultPoints].sort((a, b) => a.concentration - b.concentration)
  if (points.length === 0) return []
  const metric = points[0].metric
  const same = points.filter((point) => point.metric === metric)
  const first = same[0]
  const last = same[same.length - 1]
  if (same.length === 1) {
    return [`${first.metric}: ${first.value} ${first.valueUnit} at ${first.concentration} ${concentrationUnit(first.concentrationUnit)}`]
  }
  return [`${metric}: ${first.value} ${first.valueUnit} at ${first.concentration} ${concentrationUnit(first.concentrationUnit)} to ${last.value} ${last.valueUnit} at ${last.concentration} ${concentrationUnit(last.concentrationUnit)}`]
}

function simulationFields(lines: string[]): Array<{ label: string; value: string }> {
  return lines.map((line) => {
    const split = line.indexOf(": ")
    if (split <= 0) return { label: line, value: "" }
    return { label: line.slice(0, split), value: line.slice(split + 2) }
  })
}

const POPULATION_LABELS = new Set(["Viable", "Early apoptotic", "Late apoptotic", "Necrotic"])

function populationShares(fields: Array<{ label: string; value: string }>): Array<{ label: string; value: string; percent: number }> | null {
  const picked = fields.filter((field) => POPULATION_LABELS.has(field.label))
  if (picked.length < 3) return null
  const parsed = picked.map((field) => {
    const match = field.value.match(/^([\d.]+)\s*%/)
    const percent = match ? Number(match[1]) : Number.NaN
    return { label: field.label, value: field.value, percent }
  })
  if (parsed.some((field) => !Number.isFinite(field.percent))) return null
  const sum = parsed.reduce((total, field) => total + field.percent, 0)
  if (sum < 99 || sum > 101) return null
  return parsed
}

function characterizationLines(dataset: LabDataset): Array<{ label: string; value: string }> {
  const lines: Array<{ label: string; value: string }> = []
  const add = (label: string, value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === "" || value === "unspecified") return
    lines.push({ label, value: String(value) })
  }
  const hplc = dataset.characterization?.hplc
  add("Retention time", hplc?.retentionTimeMin != null ? `${hplc.retentionTimeMin} min` : undefined)
  add("Peak area", hplc?.peakArea)
  add(
    "Concentration",
    hplc?.measuredQuercetinConcentration != null
      ? `${hplc.measuredQuercetinConcentration}${hplc.concentrationUnit ? ` ${hplc.concentrationUnit}` : ""}`
      : undefined,
  )
  const proximate = dataset.characterization?.proximate
  add("Moisture", proximate?.moisture)
  add("Ash", proximate?.ash)
  add("Protein", proximate?.protein)
  add("Fat", proximate?.fat)
  add("Fiber", proximate?.fiber)
  const nutritive = dataset.characterization?.nutritive
  add("Carbohydrates", nutritive?.carbohydrates)
  add("Energy", nutritive?.energy != null ? `${nutritive.energy}${nutritive.energyUnit ? ` ${nutritive.energyUnit}` : ""}` : undefined)
  add("Fat", nutritive?.fat)
  add("Protein", nutritive?.protein)
  const pb = dataset.characterization?.pb
  add("Measured Pb", pb?.measuredValue != null ? `${pb.measuredValue}${pb.unit ? ` ${pb.unit}` : ""}` : undefined)
  const sensory = dataset.characterization?.sensory
  add("Appearance", sensory?.appearance)
  add("Odor", sensory?.odor)
  add("Taste", sensory?.taste)
  add("Acceptability", sensory?.overallAcceptability)
  const microbial = dataset.characterization?.microbial
  add("APC", microbial?.apc)
  add("Yeast and mold", microbial?.yeastMold)
  const stability = dataset.characterization?.stability
  add("Timepoint", stability?.timepoint)
  add("Observation", stability?.observations)
  add("Notes", dataset.notes)
  return lines
}

function MeanProfile({ stats }: { stats: ExperimentalStatsComputation }) {
  const values = stats.treatmentSummaries.flatMap((row) => (
    row.mean != null && Number.isFinite(row.mean) ? [row.mean] : []
  ))
  const max = Math.max(1, ...values)
  return (
    <div className="assay-profile">
      <p>Recorded means · {stats.measurementLabel}</p>
      <ol>
        {stats.treatmentSummaries.map((row) => {
          const value = row.notApplicable || row.mean == null || !Number.isFinite(row.mean) ? null : row.mean
          return (
            <li key={row.treatmentCode}>
              <span>{row.treatmentCode}</span>
              <span className="assay-track" aria-hidden>
                <span style={{ width: value == null ? "0%" : `${(value / max) * 100}%` }} />
              </span>
              <strong>{value == null ? "N/A" : fmt(value)}</strong>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function BarChart({ rows, series }: { rows: Array<{ label: string; value: number; second?: number }>; series?: [string, string] }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.value, row.second ?? 0]))
  return (
    <div className="review-chart" role="img" aria-label={series ? `${series[0]} and ${series[1]}` : "Experimental means"}>
      {rows.map((row) => (
        <div key={row.label} className="review-chart-col">
          <div className="review-chart-bars">
            <span style={{ height: `${Math.max(4, (row.value / max) * 100)}%` }} title={`${fmt(row.value)}`} />
            {row.second != null ? (
              <span className="review-chart-bar--alt" style={{ height: `${Math.max(4, (row.second / max) * 100)}%` }} title={`${fmt(row.second)}`} />
            ) : null}
          </div>
          <p>{row.label}</p>
        </div>
      ))}
      {series ? (
        <p className="review-chart-key">
          <span /> {series[0]} <span className="review-chart-bar--alt" /> {series[1]}
        </p>
      ) : null}
    </div>
  )
}

function AssaySection({ review }: { review: AssayReview }) {
  const stats = review.stats
  const comparable = Boolean(
    review.comparison?.compatibility.allowAlignedComparison && review.comparison.alignedPoints.length > 0,
  )
  const statement = comparisonStatement(review)
  const note = review.assay === "dpph"
    ? "T1 is the solvent control used to calculate inhibition. A derived % radical scavenging value is not applicable."
    : "T1 and T2 are the reference controls used to calculate % cytotoxicity. A derived value is not applicable."
  const ldhSetup =
    review.assay === "ldh"
      ? normalizeLdhNanoparticleSetup(review.dataset?.characterization?.ldhNanoparticleSetup)
      : null
  const siDisplay =
    review.assay === "ldh"
      ? ldhSelectivityIndexDisplay({
          setup: ldhSetup,
          ic50Value: review.dataset?.ic50?.value,
          ic50Method: review.dataset?.ic50?.method,
        })
      : null

  return (
    <section className="phyto-block">
      <header className="phyto-hero">
        <div>
          <p className="phyto-kicker">EXPERIMENTAL</p>
          <h2>{review.title}</h2>
        </div>
        <EvidenceBadge type="EXPERIMENTAL" />
      </header>
      {!review.dataset ? (
        <p className="phyto-missing">No experimental dataset is recorded.</p>
      ) : review.error ? (
        <p className="nano-studies-alert" role="alert">{review.error}</p>
      ) : stats ? (
        <>
          {review.assay === "ldh" ? (
            <p className="dock-note" style={{ marginBottom: "0.85rem" }}>
              Experimental setup: {ldhNanoparticleSetupSummary(ldhSetup)}
              {siDisplay ? ` · ${siDisplay.label}: ${siDisplay.value}` : ""}
            </p>
          ) : null}
          <div className="assay-findings">
            <article>
              <p>Experimental finding</p>
              <strong>{experimentalFinding(review.assay, stats)}</strong>
            </article>
            <article data-tone={stats.anova.significant ? "sig" : "quiet"}>
              <p>Statistical result</p>
              <strong>{statisticalSentence(stats)}</strong>
            </article>
            <article data-tone={comparable ? "pair" : "quiet"}>
              <p>Prediction vs experimental</p>
              {!review.prediction ? (
                <strong>No simulation is recorded for this endpoint.</strong>
              ) : comparable && statement ? (
                <strong>{statement}</strong>
              ) : (
                <strong>{INCOMPARABLE}</strong>
              )}
            </article>
          </div>
          {comparable && review.comparison ? (
            <BarChart
              series={["Simulation", "Experimental"]}
              rows={review.comparison.alignedPoints.flatMap((point) => (
                point.experimentalMean != null && Number.isFinite(point.experimentalMean)
                  ? [{ label: `${point.concentration} µg/mL`, value: point.predictedValue, second: point.experimentalMean }]
                  : []
              ))}
            />
          ) : null}
          <MeanProfile stats={stats} />
          <details className="assay-details">
            <summary>View statistical details</summary>
            <p className="assay-note">{note}</p>
            <h3>Raw replicates · {stats.measurementLabel}</h3>
            <div className="dock-table-wrap">
              <table className="dock-table">
                <thead>
                  <tr>
                    <th>Treatment</th>
                    <th>R1</th>
                    <th>R2</th>
                    <th>R3</th>
                  </tr>
                </thead>
                <tbody>
                  {(["T1", "T2", "T3", "T4", "T5", "T6"] as const).map((code) => (
                    <tr key={code}>
                      <td>{code}</td>
                      {(["R1", "R2", "R3"] as const).map((rep) => {
                        const cell = stats.rawGrid.find((item) => item.treatmentCode === code && item.replicateCode === rep)
                        const text = !cell || !cell.applicable ? "N/A" : cell.present ? fmt(cell.value) : "Missing"
                        return <td key={rep}>{text}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Descriptive statistics</h3>
            <div className="dock-table-wrap">
              <table className="dock-table">
                <thead>
                  <tr>
                    <th>Treatment</th>
                    <th>n</th>
                    <th>Mean</th>
                    <th>SD</th>
                    <th>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.treatmentSummaries.map((row) => (
                    <tr key={row.treatmentCode}>
                      <td>{row.treatmentCode}</td>
                      <td>{row.notApplicable ? "N/A" : row.n}</td>
                      <td>{row.notApplicable ? "N/A" : fmt(row.mean)}</td>
                      <td>{row.notApplicable ? "N/A" : fmt(row.sd)}</td>
                      <td>{row.notApplicable ? "N/A" : fmt(row.variance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>ANOVA</h3>
            <div className="dock-table-wrap">
              <table className="dock-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>SS</th>
                    <th>df</th>
                    <th>MS</th>
                    <th>F</th>
                    <th>p</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Between</td>
                    <td>{fmt(stats.anova.ssBetween)}</td>
                    <td>{stats.anova.dfBetween}</td>
                    <td>{fmt(stats.anova.msBetween)}</td>
                    <td rowSpan={2}>{fmt(stats.anova.fStatistic)}</td>
                    <td rowSpan={2}>{stats.anova.pValue == null ? "—" : formatPCell(stats.anova.pValue)}</td>
                  </tr>
                  <tr>
                    <td>Within</td>
                    <td>{fmt(stats.anova.ssWithin)}</td>
                    <td>{stats.anova.dfWithin}</td>
                    <td>{fmt(stats.anova.msWithin)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {stats.scheffe.comparisons.length > 0 ? (
              <>
              <h3>Scheffé comparisons</h3>
              <div className="dock-table-wrap">
                <table className="dock-table">
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th>Mean difference</th>
                      <th>Statistic</th>
                      <th>p</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.scheffe.comparisons.map((row) => (
                      <tr key={`${row.treatmentA}-${row.treatmentB}`}>
                        <td>{row.treatmentA} vs {row.treatmentB}</td>
                        <td>{fmt(row.meanDifference)}</td>
                        <td>{fmt(row.scheffeStatistic)}</td>
                        <td>{row.pValue == null ? "—" : formatPCell(row.pValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : null}
            <p className="assay-source">
              {STATISTICS_CALCULATION_METHOD} · version {STATISTICS_CALCULATION_VERSION} · alpha {stats.alpha}.
              {" "}Source: laboratory dataset {review.dataset.datasetName}, measured {review.dataset.datePerformed.slice(0, 10)}.
              {" "}Analyzed measurement: {stats.measurementLabel}. Missing values were not replaced.
            </p>
          </details>
        </>
      ) : null}
    </section>
  )
}

export function AnalysisInterpretation({
  readiness,
  checkError,
  onBackAction,
  onCompletedAction,
}: AnalysisInterpretationProps) {
  const handleBack = onBackAction ?? (() => {})
  const handleCompleted = onCompletedAction ?? (() => {})
  const { user } = useAuth()
  const { activeStudy, updateActiveStudy } = useStudy()
  const { refresh } = useWorkflowStatus()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<AssayReview[]>([])
  const [coverageRows, setCoverageRows] = useState<CoverageRow[]>([])
  const [characterization, setCharacterization] = useState<LabDataset[]>([])
  const [predictions, setPredictions] = useState<PredictionRun[]>([])
  const [labDatasets, setLabDatasets] = useState<LabDataset[]>([])
  const [docking, setDocking] = useState<Array<{ id: string; compound: string; target: string; affinity: number }>>([])
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null)
  const [fields, setFields] = useState({ overall: "", relationship: "", limitations: "", conclusion: "" })
  const [setupCounts, setSetupCounts] = useState({ compounds: 0, reviewed: 0, proteins: 0, cellLines: 0, literature: 0 })
  const [compoundNames, setCompoundNames] = useState<string[]>([])
  const [labEvidenceAt, setLabEvidenceAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const hydrated = useRef(false)

  const studyId = activeStudy?.id ?? null
  const labSectionsStamp = `${activeStudy?.updatedAt ?? ""}|${JSON.stringify(activeStudy?.laboratorySections ?? null)}|${JSON.stringify(activeStudy?.laboratoryOmissions ?? null)}`

  useEffect(() => {
    if (!studyId || !activeStudy) return
    const study = activeStudy
    let cancel = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const [datasets, predictionRows, interpretations, dockingRuns, compounds, proteins, cellLines, references, admetRuns] = await Promise.all([
          listLabDatasets(study.id),
          listPredictionRuns(study.id),
          listInterpretations(study.id),
          listDockingRuns(study.id),
          listCompounds(study.id),
          listProteins(study.id),
          listCellLines(study.id),
          listReferences(study.id),
          listAdmetRuns(study.id),
        ])
        const predictions = predictionRows
        if (cancel) return
        const next: AssayReview[] = []
        const dpphDataset = latestByUpdate(datasets.filter((row) => row.assayType === "dpph" && !isSyntheticDemo(row)))
        const ldhDataset = latestByUpdate(datasets.filter((row) => row.assayType === "ldh" && !isSyntheticDemo(row)))
        const [dpphReplicates, ldhReplicates] = await Promise.all([
          dpphDataset ? listLabReplicates(study.id, dpphDataset.id).catch(() => []) : Promise.resolve([]),
          ldhDataset ? listLabReplicates(study.id, ldhDataset.id).catch(() => []) : Promise.resolve([]),
        ])

        for (const assay of ["dpph", "ldh"] as const) {
          const dataset = assay === "dpph" ? dpphDataset : ldhDataset
          const prediction = latestByUpdate(predictions.filter((row) => (row.endpoint ?? row.module) === assay))
          const replicates = assay === "dpph" ? dpphReplicates : ldhReplicates
          let stats: ExperimentalStatsComputation | null = null
          let comparison: ComparisonComputation | null = null
          let error: string | null = null
          if (dataset) {
            try {
              const cfg = getLabAssayConfig(assay)
              stats = computeExperimentalStatistics({
                assayType: assay,
                measurementKey: cfg.primaryMetricKey,
                replicates,
              })
              if (prediction) {
                comparison = computeComparison({
                  endpoint: assay,
                  prediction,
                  dataset,
                  replicates,
                  experimentalMetricKey: cfg.primaryMetricKey,
                })
              }
            } catch (e) {
              error = e instanceof Error ? e.message : "The recorded results could not be analyzed."
            }
          }
          next.push({
            assay,
            title: assay === "dpph" ? "DPPH Results" : "LDH Results",
            dataset,
            prediction,
            stats,
            comparison,
            error,
          })
        }
        const chars = datasets.filter((row) =>
          CHARACTERIZATION_ASSAYS.includes(row.assayType as CharacterizationAssay),
        )
        const saved = latestByUpdate(interpretations)
        if (cancel) return
        setReviews(next)
        setPredictions(predictions)
        setLabDatasets(datasets)
        setDocking(dockingRuns.flatMap((run: DockingRun) => {
          if (!run.modes.length || !Number.isFinite(run.bestBindingAffinityKcalMol)) return []
          const compound = compounds.find((row) => row.id === run.compoundId)
          const protein = proteins.find((row) => row.id === run.proteinId)
          const ligand = run.ligandName || compound?.name
          const target = protein?.gene || protein?.geneSymbol || protein?.name
          if (!ligand || !target) return []
          return [{ id: run.id, compound: ligand, target, affinity: run.bestBindingAffinityKcalMol }]
        }))
        setCoverageRows(PREDICTION_LAB_ENDPOINTS.map((id) => ({
          id,
          label: ENDPOINT_LABEL[id],
          status: endpointCoverageStatus(id, datasets, study.laboratorySections, study.laboratoryOmissions),
          simulation: predictions.some((run) => (run.endpoint ?? run.module) === id),
        })))
        setCharacterization(chars)
        setInterpretation(saved)
        setLabEvidenceAt(datasets.map((row) => row.updatedAt).filter(Boolean).sort().at(-1) ?? "")
        setSetupCounts({
          compounds: compounds.length,
          reviewed: screenedCompoundIds(compounds.map((row) => row.id), admetRuns).length,
          proteins: proteins.length,
          cellLines: cellLines.length,
          literature: references.length,
        })
        setCompoundNames(compounds.map((row) => row.name).filter(Boolean))
        if (saved && !hydrated.current) {
          hydrated.current = true
          setFields({
            overall: saved.interpretationText ?? "",
            relationship: saved.comparisonSummary ?? "",
            limitations: saved.limitations ?? "",
            conclusion: saved.conclusion ?? "",
          })
        }
      } catch (e) {
        if (!cancel) setLoadError(e instanceof Error ? e.message : "Study results could not be loaded.")
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
    // Reload when study identity or lab coverage metadata changes — not on every activeStudy object replace.
  }, [studyId, labSectionsStamp])

  const completed = stepRecordStatus("analysis", readiness) === "complete"
  const written = [fields.overall, fields.relationship, fields.limitations, fields.conclusion].filter((value) => value.trim().length > 0).length
  const fieldsReady = written === 4

  const requiredAssays = (["dpph", "ldh"] as const).filter((assay) =>
    coverageRows.find((row) => row.id === assay)?.status === "recorded",
  )
  const analysisReady = requiredAssays.every((assay) => {
    const review = reviews.find((row) => row.assay === assay)
    return Boolean(review?.stats && !review.stats.completeness.incomplete && review.stats.canPersist)
  })
  const testedCount = coverageRows.filter((row) => row.status === "recorded").length
  const canComplete = analysisReady && fieldsReady && !completed && !saving && !loading

  const characterizationReady = characterization.some((dataset) => characterizationLines(dataset).length > 0 || dataset.characterization?.hplc?.markerCompound)

  async function complete() {
    if (!activeStudy || !user || saving || completed || !canComplete) return
    setSaving(true)
    setSaveError(null)
    let confirmed = false
    try {
      const actor = { id: user.uid }
      const existingStats = await listStatisticsAnalyses(activeStudy.id)
      for (const review of reviews) {
        if (!review.dataset || !review.stats?.canPersist || review.stats.completeness.incomplete) continue
        const metric = getLabAssayConfig(review.assay).primaryMetricKey
        const already = existingStats.find((row) => row.labDatasetId === review.dataset?.id && row.measurementKey === metric)
        const analysis = already
          ? await recalculateStatisticsAnalysis(activeStudy.id, already.id, actor)
          : await createStatisticsAnalysis(activeStudy.id, actor, {
            labDatasetId: review.dataset.id,
            assayType: review.assay,
            measurementKey: metric,
          })
        if (review.prediction && review.comparison?.canPersist) {
          await createComparison(activeStudy.id, actor, {
            endpoint: review.assay,
            predictionRunId: review.prediction.id,
            labDatasetId: review.dataset.id,
            experimentalMetricKey: metric,
            statisticsAnalysisId: analysis.id,
          })
        }
      }
      const payload = {
        title: "Research interpretation",
        interpretationText: fields.overall.trim(),
        comparisonSummary: fields.relationship.trim(),
        limitations: fields.limitations.trim(),
        conclusion: fields.conclusion.trim(),
        experimentalSummary: reviews
          .filter((review) => review.stats)
          .map((review) => `${review.assay.toUpperCase()}: ${experimentalFinding(review.assay, review.stats!)}`)
          .join(" "),
        statisticalSummary: reviews
          .filter((review) => review.stats)
          .map((review) => `${review.assay.toUpperCase()}: ${statisticalSentence(review.stats!)}`)
          .join(" "),
        status: "final" as const,
        hypothesisAssessment: "not_assessed" as const,
      }
      const interpretationId = aiInterpretationId || interpretation?.id
      if (interpretationId) await updateInterpretation(activeStudy.id, interpretationId, actor, payload)
      else await createInterpretation(activeStudy.id, actor, payload)
      await updateActiveStudy({ analysisFinalizedAt: new Date().toISOString() })
      const next = await refresh()
      if (!next || stepRecordStatus("analysis", next) !== "complete") {
        throw new Error("Stage 6 completion was not confirmed")
      }
      confirmed = true
      const studyComplete = WORKFLOW_STEPS.every((step) => stepRecordStatus(step.id, next) === "complete")
      if (studyComplete && activeStudy.status !== "completed") {
        await updateActiveStudy({ status: "completed" })
      }
      handleCompleted()
    } catch (error) {
      if (!confirmed) setSaveError("Unable to complete analysis. Please try again.")
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const computationalOnly = coverageRows.filter((row) => row.status !== "recorded")
  const predictionFor = (id: CoverageRow["id"]) =>
    latestByUpdate(predictions.filter((run) => (run.endpoint ?? run.module) === id))

  const [aiInterpretationId, setAiInterpretationId] = useState<string | null>(null)
  const acceptInterpretation = useCallback((narrative: {
    id: string
    overall: string
    relationship: string
    limitations: string
    conclusion: string
  }) => {
    setAiInterpretationId(narrative.id)
    setFields({
      overall: narrative.overall,
      relationship: narrative.relationship,
      limitations: narrative.limitations,
      conclusion: narrative.conclusion,
    })
  }, [])

  const evidenceKey = [
    labEvidenceAt,
    docking.length,
    predictions.length,
    setupCounts.literature,
    setupCounts.reviewed,
    characterization.length,
  ].join("|")
  const ai = useIntegratedInterpretation(evidenceKey, acceptInterpretation)

  return (
    <Stage6Report
      loading={loading}
      loadError={loadError}
      checkError={checkError}
      reviews={reviews}
      datasets={labDatasets}
      predictions={predictions}
      docking={docking}
      literatureCount={setupCounts.literature}
      predictionCount={coverageRows.filter((row) => row.simulation).length}
      labCount={testedCount}
      aiStatus={ai.status}
      aiPhase={ai.phaseLabel}
      interpretation={ai.interpretation}
      onRegenerate={ai.regenerate}
      saveError={saveError}
      saving={saving}
      completed={completed}
      canComplete={canComplete}
      onBack={handleBack}
      onComplete={() => void complete()}
    />
  )
}
