/**
 * Unit tests for experimental statistics (mean, sample SD, ANOVA, Scheffé).
 * Run: npm test
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { oneWayAnova } from "./anova"
import { mean, sampleSd, sampleVariance } from "./descriptive"
import { fCdf, fCritical, fSurvival } from "./fDistribution"
import { scheffePostHoc } from "./scheffe"
import { buildSourceFingerprint, computeExperimentalStatistics } from "./runAnalysis"
import type { LabReplicate } from "../domain/models"

describe("descriptive statistics", () => {
  it("computes mean", () => {
    assert.equal(mean([2, 4, 6]), 4)
    assert.equal(mean([]), undefined)
  })

  it("computes sample variance and SD (Bessel n-1)", () => {
    // values 2,4,6 → mean 4, variance ((4+0+4)/2)=4, sd=2
    assert.equal(sampleVariance([2, 4, 6]), 4)
    assert.equal(sampleSd([2, 4, 6]), 2)
    assert.equal(sampleSd([5]), undefined)
    assert.equal(sampleVariance([5]), undefined)
  })
})

describe("F distribution", () => {
  it("matches known critical value F(0.05; 2, 6) ≈ 5.143", () => {
    const crit = fCritical(0.05, 2, 6)
    assert.ok(Math.abs(crit - 5.143253) < 0.01)
  })

  it("survival at critical ≈ alpha", () => {
    const crit = fCritical(0.05, 2, 6)
    const p = fSurvival(crit, 2, 6)
    assert.ok(Math.abs(p - 0.05) < 1e-4)
  })

  it("CDF(0)=0 and CDF(∞)→1", () => {
    assert.equal(fCdf(0, 2, 6), 0)
    assert.ok(fCdf(1e6, 2, 6) > 0.999)
  })
})

describe("one-way ANOVA", () => {
  // Classic balanced example: F = 27 exactly
  const groups = [
    { label: "T1", values: [2, 3, 4] },
    { label: "T2", values: [5, 6, 7] },
    { label: "T3", values: [8, 9, 10] },
  ]

  it("matches reference SS / F", () => {
    const r = oneWayAnova(groups, 0.05)
    assert.equal(r.k, 3)
    assert.equal(r.N, 9)
    assert.equal(r.ssBetween, 54)
    assert.equal(r.ssWithin, 6)
    assert.equal(r.ssTotal, 60)
    assert.equal(r.dfBetween, 2)
    assert.equal(r.dfWithin, 6)
    assert.equal(r.msBetween, 27)
    assert.equal(r.msWithin, 1)
    assert.equal(r.fStatistic, 27)
    assert.ok(r.pValue != null && r.pValue <= 0.001 + 1e-9)
    assert.equal(r.significant, true)
    assert.match(r.message, /Statistically significant difference detected/)
  })

  it("rejects insufficient groups", () => {
    const r = oneWayAnova([{ label: "T1", values: [1, 2, 3] }], 0.05)
    assert.equal(r.fStatistic, null)
    assert.match(r.message, /Insufficient groups/)
  })

  it("rejects insufficient observations for df_within", () => {
    const r = oneWayAnova(
      [
        { label: "T1", values: [1] },
        { label: "T2", values: [2] },
      ],
      0.05
    )
    assert.equal(r.fStatistic, null)
    assert.match(r.message, /Insufficient observations/)
  })

  it("handles identical groups (F=0)", () => {
    const r = oneWayAnova(
      [
        { label: "T1", values: [5, 5, 5] },
        { label: "T2", values: [5, 5, 5] },
      ],
      0.05
    )
    assert.equal(r.fStatistic, 0)
    assert.equal(r.significant, false)
  })

  it("handles zero within variance with different means", () => {
    const r = oneWayAnova(
      [
        { label: "T1", values: [1, 1, 1] },
        { label: "T2", values: [2, 2, 2] },
      ],
      0.05
    )
    assert.equal(r.fStatistic, Infinity)
    assert.equal(r.significant, true)
  })

  it("never invents missing values from empty groups", () => {
    const r = oneWayAnova(
      [
        { label: "T1", values: [] },
        { label: "T2", values: [1, 2, 3] },
        { label: "T3", values: [4, 5, 6] },
      ],
      0.05
    )
    assert.equal(r.k, 2)
    assert.ok(r.fStatistic != null)
  })
})

describe("Scheffé post-hoc", () => {
  it("runs when ANOVA is significant and detects T1 vs T3", () => {
    const anova = oneWayAnova(
      [
        { label: "T1", values: [2, 3, 4] },
        { label: "T2", values: [5, 6, 7] },
        { label: "T3", values: [8, 9, 10] },
      ],
      0.05
    )
    const s = scheffePostHoc(anova)
    assert.ok(s.comparisons.length === 3)
    const t1t3 = s.comparisons.find((c) => c.treatmentA === "T1" && c.treatmentB === "T3")
    assert.ok(t1t3)
    assert.equal(t1t3!.meanDifference, -6)
    assert.equal(t1t3!.significant, true)
    assert.ok(t1t3!.criticalDifference != null)
    assert.ok(Math.abs(t1t3!.meanDifference) > (t1t3!.criticalDifference as number))
  })

  it("skips post-hoc when ANOVA not significant", () => {
    const anova = oneWayAnova(
      [
        { label: "T1", values: [5, 5.1, 4.9] },
        { label: "T2", values: [5, 5.05, 4.95] },
      ],
      0.05
    )
    const s = scheffePostHoc(anova)
    assert.equal(s.comparisons.length, 0)
    assert.match(s.message, /not significant/)
  })
})

function fakeRep(
  treatmentCode: LabReplicate["treatmentCode"],
  replicateCode: LabReplicate["replicateCode"],
  value: number | undefined,
  updatedAt = "2026-01-01T00:00:00.000Z",
  measurementKey = "radicalScavengingPercent"
): LabReplicate {
  return {
    id: `${treatmentCode}-${replicateCode}`,
    datasetId: "ds1",
    studyId: "st1",
    treatmentCode,
    replicateCode,
    measurements: value === undefined ? {} : { [measurementKey]: value },
    dataClass: "RAW_EXPERIMENTAL",
    createdAt: updatedAt,
    updatedAt,
    createdBy: "u1",
  }
}

describe("experimental orchestration", () => {
  it("computes DPPH statistics from raw replicates", () => {
    const reps: LabReplicate[] = []
    const base = [10, 12, 11, 20, 22, 21, 30, 31, 32, 40, 41, 42, 50, 51, 52, 60, 61, 62]
    let i = 0
    for (const t of ["T1", "T2", "T3", "T4", "T5", "T6"] as const) {
      for (const r of ["R1", "R2", "R3"] as const) {
        reps.push(fakeRep(t, r, base[i++]))
      }
    }
    const result = computeExperimentalStatistics({
      assayType: "dpph",
      measurementKey: "radicalScavengingPercent",
      replicates: reps,
    })
    assert.equal(result.canPersist, true)
    assert.equal(result.completeness.incomplete, false)
    assert.equal(result.anova.k, 6)
    assert.equal(result.anova.N, 18)
    assert.equal(result.anova.significant, true)
    assert.ok(result.scheffe.comparisons.length > 0)
  })

  it("warns on incomplete datasets without filling zeros", () => {
    const reps = [
      fakeRep("T1", "R1", 1, "t", "percentCytotoxicity"),
      fakeRep("T1", "R2", 2, "t", "percentCytotoxicity"),
      fakeRep("T2", "R1", 5, "t", "percentCytotoxicity"),
      fakeRep("T2", "R2", 6, "t", "percentCytotoxicity"),
      fakeRep("T2", "R3", 7, "t", "percentCytotoxicity"),
    ]
    const result = computeExperimentalStatistics({
      assayType: "ldh",
      measurementKey: "percentCytotoxicity",
      replicates: reps,
    })
    assert.equal(result.completeness.incomplete, true)
    assert.ok(result.completeness.warnings.some((w) => /Missing values were not replaced/.test(w)))
    const t1 = result.treatmentSummaries.find((t) => t.treatmentCode === "T1")
    assert.equal(t1?.n, 2)
    assert.equal(t1?.mean, 1.5)
  })

  it("rejects non-eligible assays", () => {
    assert.throws(
      () =>
        computeExperimentalStatistics({
          assayType: "hplc",
          measurementKey: "radicalScavengingPercent",
          replicates: [],
        }),
      /not eligible/
    )
  })

  it("detects fingerprint change for stale analyses", () => {
    const a = [
      fakeRep("T1", "R1", 1, "t1"),
      fakeRep("T1", "R2", 2, "t1"),
    ]
    const b = [
      fakeRep("T1", "R1", 1, "t1"),
      fakeRep("T1", "R2", 9, "t2"),
    ]
    const fa = buildSourceFingerprint("dsA", a, "radicalScavengingPercent")
    const fb = buildSourceFingerprint("dsA", b, "radicalScavengingPercent")
    assert.notEqual(fa, fb)
  })
})
