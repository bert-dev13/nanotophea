import type { PredictionRun } from "@/lib/domain/models"
import { classifyPredictionProvenance } from "@/lib/predictions/provenanceClassification"

export const LEGACY_SIMULATION_WARNING =
  "Historical / legacy simulation fields. These values were stored before scientific-integrity remediation and must not be treated as experimental measurements, fitted IC50 values, Trolox TEAC, absorbance (OD), selectivity index, or cytometry populations. They are retained for audit traceability only."

export const UNVERIFIED_PREDICTED_WARNING =
  "Historical / unverified computational record. A PREDICTED or documented_model label alone is not proof of a registered validated model. Do not present these values as validated scientific evidence."

export type DisplayMetricKind = "current" | "legacy"

export interface DisplayMetricRow {
  label: string
  value: string
  kind: DisplayMetricKind
}

export interface SanitizedPredictionDisplay {
  evidenceClass: string | undefined
  methodType: string | undefined
  isExploratorySimulation: boolean
  isUnverifiedPredicted: boolean
  primary: DisplayMetricRow[]
  legacy: DisplayMetricRow[]
  legacyWarning: string | null
  summaryLine: string | null
  provenanceLabel: string | null
  provenanceWarning: string | null
}

/** Labels that must never appear as current scientific assay measurements for SIMULATION / exploratory_math. */
const LEGACY_OUTPUT_LABEL_PATTERNS: RegExp[] = [
  /^TEAC$/i,
  /^IC50$/i,
  /^Predicted IC50$/i,
  /^Selectivity index$/i,
  /^Selectivity Index$/i,
  /^Predicted OD$/i,
  /^Predicted OD\/absorbance$/i,
  /^BAX response$/i,
  /^BCL-2 response$/i,
  /^BAX\/BCL-2 ratio$/i,
  /^Caspase-3/i,
  /^Caspase-3 activation$/i,
  /^Caspase-3 response$/i,
  /^Viable$/i,
  /^Early apoptotic$/i,
  /^Late apoptotic$/i,
  /^Necrotic$/i,
  /^Apoptosis probability$/i,
  /^Mitochondrial membrane potential loss$/i,
  /^Predicted viable/i,
  /^Relative potency$/i,
]

const CURRENT_FRIENDLY_RELABEL: Array<{ match: RegExp; label: string }> = [
  { match: /^Exploratory Hill midpoint/i, label: "Exploratory Hill midpoint (not fitted IC50)" },
]

function isExploratorySimulationRun(run: Pick<PredictionRun, "provenance" | "methodType" | "source">): boolean {
  if (run.provenance?.evidenceClass === "SIMULATION") return true
  if (run.methodType === "exploratory_math") return true
  if (/exploratory simulation/i.test(run.source ?? "")) return true
  return false
}

export function isLegacySimulationOutputLabel(label: string): boolean {
  return LEGACY_OUTPUT_LABEL_PATTERNS.some((pattern) => pattern.test(label.trim()))
}

function relabelCurrent(label: string): string {
  for (const row of CURRENT_FRIENDLY_RELABEL) {
    if (row.match.test(label)) return row.label
  }
  return label
}

function outputRowsFromParameters(
  inputParameters?: Record<string, string | number | boolean | null> | null,
): Array<{ label: string; value: string }> {
  if (!inputParameters) return []
  const rows: Array<{ label: string; value: string }> = []
  for (const [key, value] of Object.entries(inputParameters)) {
    if (!key.startsWith("output:")) continue
    const label = key.slice("output:".length)
    const unit = inputParameters[`unit:${label}`]
    rows.push({ label, value: unit ? `${value} ${unit}` : String(value) })
  }
  return rows
}

function summaryLegacyRows(run: PredictionRun): DisplayMetricRow[] {
  const rows: DisplayMetricRow[] = []
  if (run.summaryIc50 != null) {
    rows.push({
      label: "Historical summary IC50 (not fitted experimental IC50)",
      value: `${run.summaryIc50}${run.summaryIc50Unit ? ` ${run.summaryIc50Unit}` : ""}`,
      kind: "legacy",
    })
  }
  if (run.teac) {
    rows.push({
      label: "Historical TEAC-labeled value (not Trolox-calibrated)",
      value: String(run.teac),
      kind: "legacy",
    })
  }
  if (run.selectivityIndex) {
    rows.push({
      label: "Historical selectivity index (not paired IC50 SI)",
      value: String(run.selectivityIndex),
      kind: "legacy",
    })
  }
  return rows
}

/**
 * Builds UI/export display rows for a prediction run without rewriting stored data.
 * For exploratory SIMULATION runs, obsolete metrics are quarantined into `legacy`.
 * Experimental / PREDICTED / documented_model paths keep summary fields as primary
 * (subject to their own evidence class labels elsewhere).
 */
export function sanitizePredictionDisplay(run?: PredictionRun | null): SanitizedPredictionDisplay {
  if (!run) {
    return {
      evidenceClass: undefined,
      methodType: undefined,
      isExploratorySimulation: false,
      isUnverifiedPredicted: false,
      primary: [],
      legacy: [],
      legacyWarning: null,
      summaryLine: null,
      provenanceLabel: null,
      provenanceWarning: null,
    }
  }

  const provenance = classifyPredictionProvenance(run)
  const exploratory = provenance.class === "exploratory_simulation" || isExploratorySimulationRun(run)
  const unverified = provenance.class === "historical_unverified_provenance"
  const evidenceClass = run.provenance?.evidenceClass
  const methodType = run.methodType
  const fromOutputs = outputRowsFromParameters(run.inputParameters)

  if (!exploratory) {
    const primary: DisplayMetricRow[] = []
    const legacy: DisplayMetricRow[] = []
    const pushMetric = (label: string, value: string, forceLegacy = false) => {
      const target = unverified || forceLegacy || isLegacySimulationOutputLabel(label) ? legacy : primary
      target.push({
        label: unverified || forceLegacy ? `Historical: ${label}` : label,
        value,
        kind: unverified || forceLegacy ? "legacy" : "current",
      })
    }

    if (run.summaryIc50 != null) {
      pushMetric("IC50", `${run.summaryIc50}${run.summaryIc50Unit ? ` ${run.summaryIc50Unit}` : ""}`, unverified)
    }
    if (run.summaryMaximum != null) {
      pushMetric(
        "Maximum",
        `${run.summaryMaximum}${run.summaryMaximumUnit ? ` ${run.summaryMaximumUnit}` : ""}`,
        unverified,
      )
    }
    if (run.teac) pushMetric("TEAC", String(run.teac), true)
    if (run.selectivityIndex) pushMetric("Selectivity index", String(run.selectivityIndex), true)
    if (run.pathwayEffect) pushMetric("Pathway", String(run.pathwayEffect), unverified)
    for (const row of fromOutputs) {
      pushMetric(row.label, row.value, unverified || isLegacySimulationOutputLabel(row.label))
    }
    if (!fromOutputs.length && !primary.length && !legacy.length) {
      for (const point of run.resultPoints ?? []) {
        pushMetric(`${point.metric} at ${point.concentration}`, `${point.value} ${point.valueUnit}`, unverified)
      }
    }

    // Prefer series as primary when documented prediction is registered and verified.
    if (!primary.length && !unverified) {
      for (const point of run.resultPoints ?? []) {
        primary.push({
          label: `${point.metric} at ${point.concentration}`,
          value: `${point.value} ${point.valueUnit}`,
          kind: "current",
        })
      }
    }

    return {
      evidenceClass,
      methodType,
      isExploratorySimulation: false,
      isUnverifiedPredicted: unverified,
      primary,
      legacy,
      legacyWarning: legacy.length ? (unverified ? UNVERIFIED_PREDICTED_WARNING : LEGACY_SIMULATION_WARNING) : provenance.warning,
      summaryLine: primary[0]
        ? `${primary[0].label}: ${primary[0].value}`
        : legacy[0]
          ? `${legacy[0].label}: ${legacy[0].value}`
          : null,
      provenanceLabel: provenance.label,
      provenanceWarning: provenance.warning,
    }
  }

  const primary: DisplayMetricRow[] = []
  const legacy: DisplayMetricRow[] = []

  for (const row of fromOutputs) {
    if (isLegacySimulationOutputLabel(row.label)) {
      legacy.push({
        label: `Historical: ${row.label}`,
        value: row.value,
        kind: "legacy",
      })
    } else {
      primary.push({
        label: relabelCurrent(row.label),
        value: row.value,
        kind: "current",
      })
    }
  }

  // Column-level legacy summaries (often present when output:* keys are missing).
  for (const row of summaryLegacyRows(run)) legacy.push(row)

  if (run.summaryMaximum != null && !primary.some((row) => /maximum/i.test(row.label))) {
    primary.push({
      label: "Maximum (exploratory)",
      value: `${run.summaryMaximum}${run.summaryMaximumUnit ? ` ${run.summaryMaximumUnit}` : ""}`,
      kind: "current",
    })
  }

  if (run.pathwayEffect) {
    primary.push({ label: "Pathway note", value: String(run.pathwayEffect), kind: "current" })
  }

  // If there are no current outputs, surface series points as exploratory metrics —
  // never fall back to unlabeled IC50/TEAC/SI as primary.
  if (!primary.length) {
    for (const point of run.resultPoints ?? []) {
      primary.push({
        label: `${point.metric} at ${point.concentration}`,
        value: `${point.value} ${point.valueUnit}`,
        kind: "current",
      })
    }
  }

  const preferred =
    primary.find((row) =>
      /Scavenging|Metabolic viability|membrane-damage|ROS index|BAX-target context|YAP–TEAD residual|YAP-TEAD residual|Estimated YAP suppression|Hill midpoint/i.test(
        row.label,
      ),
    ) ?? primary[0]

  return {
    evidenceClass,
    methodType,
    isExploratorySimulation: true,
    isUnverifiedPredicted: false,
    primary,
    legacy,
    legacyWarning: legacy.length ? LEGACY_SIMULATION_WARNING : provenance.warning,
    summaryLine: preferred ? `${preferred.label}: ${preferred.value}` : null,
    provenanceLabel: provenance.label,
    provenanceWarning: provenance.warning,
  }
}

/** Flat lines for AI / exports — legacy values are explicitly prefixed. */
export function sanitizedPredictionLines(run?: PredictionRun | null): string[] {
  const display = sanitizePredictionDisplay(run)
  const lines: string[] = []
  if (display.provenanceLabel) lines.push(`Provenance: ${display.provenanceLabel}`)
  if (display.isExploratorySimulation) {
    lines.push("Evidence class: SIMULATION (exploratory — not experimental)")
  } else if (display.isUnverifiedPredicted) {
    lines.push("Evidence class: historical/unverified (not validated science)")
  } else if (display.evidenceClass) {
    lines.push(`Evidence class: ${display.evidenceClass}`)
  }
  if (display.provenanceWarning) lines.push(display.provenanceWarning)
  for (const row of display.primary) {
    lines.push(`${row.label}: ${row.value}`)
  }
  if (display.legacy.length) {
    lines.push(display.legacyWarning ?? LEGACY_SIMULATION_WARNING)
    for (const row of display.legacy) {
      lines.push(`${row.label}: ${row.value}`)
    }
  }
  return lines
}

export function sanitizedPredictionSummary(run?: PredictionRun | null): string {
  const display = sanitizePredictionDisplay(run)
  if (display.summaryLine) {
    if (display.isExploratorySimulation) return `Exploratory: ${display.summaryLine}`
    if (display.isUnverifiedPredicted) return `Historical/unverified: ${display.summaryLine}`
    return display.summaryLine
  }
  if (!run) return "Not recorded"
  if (display.isExploratorySimulation) return "Exploratory simulation recorded"
  if (display.isUnverifiedPredicted) return "Historical/unverified computational record"
  return "Recorded"
}
