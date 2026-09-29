/**
 * Metric compatibility for Prediction vs Experimental comparisons.
 * Differences are only computed when metric meanings align.
 */

export type ComparisonEndpoint = "dpph" | "ldh"

export interface MetricPair {
  /** Accepted prediction metric name variants (case-insensitive match after normalize) */
  predictionMetrics: string[]
  experimentalKey: string
  experimentalLabel: string
  valueUnitHint: string
  allowNumericDifference: boolean
}

const DPPH_PAIRS: MetricPair[] = [
  {
    predictionMetrics: [
      "predicted_scavenging",
      "predicted scavenging",
      "radical_scavenging",
      "% radical scavenging",
      "percent_scavenging",
      "scavenging",
    ],
    experimentalKey: "radicalScavengingPercent",
    experimentalLabel: "% radical scavenging",
    valueUnitHint: "%",
    allowNumericDifference: true,
  },
]

const LDH_PAIRS: MetricPair[] = [
  {
    predictionMetrics: [
      "predicted_cytotoxicity",
      "predicted cytotoxicity",
      "percent_cytotoxicity",
      "% cytotoxicity",
      "cytotoxicity",
    ],
    experimentalKey: "percentCytotoxicity",
    experimentalLabel: "% cytotoxicity",
    valueUnitHint: "%",
    allowNumericDifference: true,
  },
]

export function metricPairsFor(endpoint: ComparisonEndpoint): MetricPair[] {
  return endpoint === "dpph" ? DPPH_PAIRS : LDH_PAIRS
}

function normalizeMetric(s: string): string {
  return s.trim().toLowerCase().replace(/[%]/g, "").replace(/\s+/g, "_")
}

export function findMetricPair(
  endpoint: ComparisonEndpoint,
  predictionMetric: string,
  experimentalKey: string
): MetricPair | null {
  const pairs = metricPairsFor(endpoint)
  const pred = normalizeMetric(predictionMetric)
  for (const pair of pairs) {
    if (pair.experimentalKey !== experimentalKey) continue
    if (pair.predictionMetrics.some((m) => normalizeMetric(m) === pred)) return pair
  }
  return null
}

/** Pick best experimental metric for a prediction metric, if any. */
export function resolveExperimentalKeyForPredictionMetric(
  endpoint: ComparisonEndpoint,
  predictionMetric: string
): MetricPair | null {
  const pred = normalizeMetric(predictionMetric)
  for (const pair of metricPairsFor(endpoint)) {
    if (pair.predictionMetrics.some((m) => normalizeMetric(m) === pred)) return pair
  }
  return null
}

export function metricsAreCompatible(
  endpoint: ComparisonEndpoint,
  predictionMetric: string,
  experimentalKey: string
): boolean {
  return findMetricPair(endpoint, predictionMetric, experimentalKey) != null
}

export function computeDifferences(
  predicted: number,
  experimentalMean: number
): { signedDifference: number; absoluteDifference: number; percentDifference: number | null } {
  const signedDifference = predicted - experimentalMean
  const absoluteDifference = Math.abs(signedDifference)
  const percentDifference =
    experimentalMean === 0 ? null : (signedDifference / experimentalMean) * 100
  return { signedDifference, absoluteDifference, percentDifference }
}
