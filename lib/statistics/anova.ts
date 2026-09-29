/**
 * One-way ANOVA across treatment groups.
 *
 * Formulas (balanced or unbalanced):
 *   Grand mean ȳ·· = (Σ n_i ȳ_i) / N
 *   SS_between = Σ n_i (ȳ_i − ȳ··)²
 *   SS_within  = Σ_i Σ_j (y_ij − ȳ_i)²
 *   SS_total   = SS_between + SS_within
 *   df_b = k − 1,  df_w = N − k,  df_t = N − 1
 *   MS_b = SS_b / df_b,  MS_w = SS_w / df_w
 *   F = MS_b / MS_w
 *   p = P(F_{df_b, df_w} ≥ F)
 *
 * Groups with n = 0 are excluded (never filled with zeros).
 */

import { mean, sum } from "@/lib/statistics/descriptive"
import { fSurvival } from "@/lib/statistics/fDistribution"

export interface AnovaGroupInput {
  label: string
  values: number[]
}

export interface AnovaResult {
  k: number
  N: number
  groupLabels: string[]
  groupNs: number[]
  groupMeans: number[]
  grandMean: number
  ssBetween: number
  ssWithin: number
  ssTotal: number
  dfBetween: number
  dfWithin: number
  dfTotal: number
  msBetween: number | null
  msWithin: number | null
  fStatistic: number | null
  pValue: number | null
  alpha: number
  significant: boolean | null
  message: string
  warnings: string[]
}

export function oneWayAnova(groups: AnovaGroupInput[], alpha = 0.05): AnovaResult {
  const warnings: string[] = []
  const usable = groups
    .map((g) => ({
      label: g.label,
      values: g.values.filter((v) => typeof v === "number" && Number.isFinite(v)),
    }))
    .filter((g) => g.values.length > 0)

  for (const g of groups) {
    const missing = g.values.length - g.values.filter((v) => Number.isFinite(v)).length
    // values array may already be filtered by caller; informational only
    if (missing > 0) {
      warnings.push(`Group ${g.label}: ${missing} non-finite value(s) ignored.`)
    }
  }

  const k = usable.length
  const groupNs = usable.map((g) => g.values.length)
  const N = sum(groupNs)
  const groupMeans = usable.map((g) => mean(g.values) as number)
  const groupLabels = usable.map((g) => g.label)

  const empty: AnovaResult = {
    k,
    N,
    groupLabels,
    groupNs,
    groupMeans,
    grandMean: NaN,
    ssBetween: NaN,
    ssWithin: NaN,
    ssTotal: NaN,
    dfBetween: Math.max(0, k - 1),
    dfWithin: Math.max(0, N - k),
    dfTotal: Math.max(0, N - 1),
    msBetween: null,
    msWithin: null,
    fStatistic: null,
    pValue: null,
    alpha,
    significant: null,
    message: "",
    warnings,
  }

  if (k < 2) {
    return {
      ...empty,
      message: "Insufficient groups with usable observations (need ≥ 2 treatments with data).",
    }
  }

  if (N < k + 1) {
    return {
      ...empty,
      message:
        "Insufficient observations for within-group degrees of freedom (need N > k so df_within ≥ 1).",
    }
  }

  const grandMean = sum(usable.map((g, i) => groupMeans[i] * groupNs[i])) / N

  let ssBetween = 0
  for (let i = 0; i < k; i++) {
    ssBetween += groupNs[i] * (groupMeans[i] - grandMean) ** 2
  }

  let ssWithin = 0
  for (let i = 0; i < k; i++) {
    const m = groupMeans[i]
    for (const v of usable[i].values) {
      ssWithin += (v - m) ** 2
    }
  }

  const ssTotal = ssBetween + ssWithin
  const dfBetween = k - 1
  const dfWithin = N - k
  const dfTotal = N - 1
  const msBetween = ssBetween / dfBetween
  const msWithin = ssWithin / dfWithin

  let fStatistic: number | null
  let pValue: number | null
  let significant: boolean | null
  let message: string

  if (msWithin === 0) {
    if (ssBetween === 0) {
      fStatistic = 0
      pValue = 1
      significant = false
      message = "All group means identical with zero within-group variance."
      warnings.push("Zero within-group variance with identical means.")
    } else {
      fStatistic = Infinity
      pValue = 0
      significant = true
      message =
        alpha < 1
          ? `Statistically significant difference detected at α = ${alpha} (zero within-group variance).`
          : "Between-group differences with zero within-group variance."
      warnings.push("Zero within-group variance — F is undefined/infinite; treat with caution.")
    }
  } else {
    fStatistic = msBetween / msWithin
    pValue = fSurvival(fStatistic, dfBetween, dfWithin)
    significant = pValue < alpha
    message = significant
      ? `Statistically significant difference detected at α = ${alpha}.`
      : `No statistically significant difference detected at α = ${alpha}.`
  }

  return {
    k,
    N,
    groupLabels,
    groupNs,
    groupMeans,
    grandMean,
    ssBetween,
    ssWithin,
    ssTotal,
    dfBetween,
    dfWithin,
    dfTotal,
    msBetween,
    msWithin,
    fStatistic,
    pValue,
    alpha,
    significant,
    message,
    warnings,
  }
}
