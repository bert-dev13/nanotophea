/**
 * Scheffé post-hoc pairwise comparisons (after one-way ANOVA).
 *
 * For groups i and j:
 *   F_S = (ȳ_i − ȳ_j)² / [ (k − 1) · MSW · (1/n_i + 1/n_j) ]
 *
 * Compared to F_crit = F_{α; k−1, N−k} (same critical F as the ANOVA omnibus).
 * Significant if F_S > F_crit (equivalently |ȳ_i − ȳ_j| > criticalDifference).
 *
 * Critical difference:
 *   CD = √[ (k − 1) · F_crit · MSW · (1/n_i + 1/n_j) ]
 *
 * This is Scheffé — not Tukey, Bonferroni, or Dunn.
 */

import { fCritical, fSurvival } from "@/lib/statistics/fDistribution"
import type { AnovaResult } from "@/lib/statistics/anova"

export interface ScheffeComparison {
  treatmentA: string
  treatmentB: string
  meanA: number
  meanB: number
  meanDifference: number
  nA: number
  nB: number
  scheffeStatistic: number | null
  criticalF: number | null
  criticalDifference: number | null
  pValue: number | null
  significant: boolean | null
  note?: string
}

export interface ScheffeResult {
  comparisons: ScheffeComparison[]
  criticalF: number | null
  alpha: number
  k: number
  dfWithin: number
  msWithin: number | null
  message: string
  warnings: string[]
}

export function scheffePostHoc(anova: AnovaResult): ScheffeResult {
  const warnings = [...anova.warnings]
  const alpha = anova.alpha
  const { k, dfWithin, msWithin, groupLabels, groupMeans, groupNs } = anova

  if (anova.fStatistic == null || anova.significant == null) {
    return {
      comparisons: [],
      criticalF: null,
      alpha,
      k,
      dfWithin,
      msWithin,
      message: "Scheffé post-hoc requires a completed one-way ANOVA.",
      warnings,
    }
  }

  // Standard practice: proceed when omnibus ANOVA is significant
  if (!anova.significant) {
    return {
      comparisons: [],
      criticalF: null,
      alpha,
      k,
      dfWithin,
      msWithin,
      message:
        "Omnibus ANOVA was not significant at α = 0.05; Scheffé post-hoc pairwise tests were not performed.",
      warnings,
    }
  }

  if (msWithin == null || !(msWithin >= 0) || dfWithin < 1 || k < 2) {
    return {
      comparisons: [],
      criticalF: null,
      alpha,
      k,
      dfWithin,
      msWithin,
      message: "Insufficient ANOVA parameters for Scheffé comparisons.",
      warnings,
    }
  }

  const dfBetween = k - 1
  const criticalF =
    msWithin === 0 ? null : fCritical(alpha, dfBetween, dfWithin)

  const comparisons: ScheffeComparison[] = []

  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const meanDifference = groupMeans[i] - groupMeans[j]
      const nA = groupNs[i]
      const nB = groupNs[j]
      const denomFactor = 1 / nA + 1 / nB

      if (msWithin === 0) {
        const identical = Math.abs(meanDifference) < 1e-15
        comparisons.push({
          treatmentA: groupLabels[i],
          treatmentB: groupLabels[j],
          meanA: groupMeans[i],
          meanB: groupMeans[j],
          meanDifference,
          nA,
          nB,
          scheffeStatistic: identical ? 0 : Infinity,
          criticalF: null,
          criticalDifference: 0,
          pValue: identical ? 1 : 0,
          significant: !identical,
          note: "Zero within-group MS — Scheffé F is undefined/infinite when means differ.",
        })
        continue
      }

      const scheffeStatistic =
        meanDifference ** 2 / (dfBetween * msWithin * denomFactor)
      const criticalDifference = Math.sqrt(dfBetween * (criticalF as number) * msWithin * denomFactor)
      const pValue = fSurvival(scheffeStatistic, dfBetween, dfWithin)
      const significant = scheffeStatistic > (criticalF as number)

      comparisons.push({
        treatmentA: groupLabels[i],
        treatmentB: groupLabels[j],
        meanA: groupMeans[i],
        meanB: groupMeans[j],
        meanDifference,
        nA,
        nB,
        scheffeStatistic,
        criticalF,
        criticalDifference,
        pValue,
        significant,
      })
    }
  }

  return {
    comparisons,
    criticalF,
    alpha,
    k,
    dfWithin,
    msWithin,
    message:
      "Scheffé post-hoc pairwise comparisons (family-wise control). Statistical significance does not imply efficacy or hypothesis acceptance.",
    warnings,
  }
}
