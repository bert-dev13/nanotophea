/**
 * Unit tests for Prediction vs Experimental comparison (Phase 9).
 * Run via: npm test
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { assessCompatibility } from "./compatibility"
import { computeDifferences, metricsAreCompatible } from "./metrics"
import {
  buildComparisonFingerprint,
  computeComparison,
} from "./runComparison"
import type { LabDataset, LabReplicate, PredictionRun } from "../domain/models"

function basePrediction(over: Partial<PredictionRun> = {}): PredictionRun {
  return {
    id: "pred1",
    studyId: "st1",
    endpoint: "ldh",
    module: "ldh",
    runName: "LDH run",
    methodName: "External model",
    methodType: "documented_model",
    source: "lab notebook",
    dateGenerated: "2026-01-01",
    concentrationUnit: "ug_per_mL",
    resultPoints: [
      {
        concentration: 50,
        concentrationUnit: "ug_per_mL",
        metric: "predicted_cytotoxicity",
        value: 10,
        valueUnit: "%",
      },
      {
        concentration: 100,
        concentrationUnit: "ug_per_mL",
        metric: "predicted_cytotoxicity",
        value: 20,
        valueUnit: "%",
      },
      {
        concentration: 250,
        concentrationUnit: "ug_per_mL",
        metric: "predicted_cytotoxicity",
        value: 40,
        valueUnit: "%",
      },
      {
        concentration: 500,
        concentrationUnit: "ug_per_mL",
        metric: "predicted_cytotoxicity",
        value: 70,
        valueUnit: "%",
      },
    ],
    referenceIds: [],
    status: "imported",
    provenance: {
      evidenceClass: "PREDICTED",
      methodName: "External model",
      source: "lab notebook",
    },
    createdAt: "t0",
    updatedAt: "t0",
    createdBy: "u1",
    updatedBy: "u1",
    ...over,
  }
}

function baseDataset(over: Partial<LabDataset> = {}): LabDataset {
  return {
    id: "lab1",
    studyId: "st1",
    assay: "ldh",
    assayType: "ldh",
    datasetName: "LDH exp",
    laboratoryName: "DMBEL",
    datePerformed: "2026-01-02",
    protocolReference: "kit protocol",
    cellLineName: "HepG2",
    treatmentSummaries: [],
    outsourcedLab: false,
    status: "draft",
    provenance: { evidenceClass: "EXPERIMENTAL", laboratoryName: "DMBEL" },
    createdAt: "t0",
    updatedAt: "t0",
    createdBy: "u1",
    updatedBy: "u1",
    ...over,
  }
}

function rep(
  treatmentCode: LabReplicate["treatmentCode"],
  replicateCode: LabReplicate["replicateCode"],
  measurements: Record<string, number>,
  updatedAt = "t0"
): LabReplicate {
  return {
    id: `${treatmentCode}-${replicateCode}`,
    datasetId: "lab1",
    studyId: "st1",
    treatmentCode,
    replicateCode,
    measurements,
    dataClass: "RAW_EXPERIMENTAL",
    createdAt: updatedAt,
    updatedAt,
    createdBy: "u1",
  }
}

describe("metric compatibility", () => {
  it("allows LDH cytotoxicity pair", () => {
    assert.equal(
      metricsAreCompatible("ldh", "predicted_cytotoxicity", "percentCytotoxicity"),
      true
    )
  })

  it("rejects incompatible metric subtraction targets", () => {
    assert.equal(metricsAreCompatible("ldh", "predicted_cytotoxicity", "absorbanceA490"), false)
    assert.equal(metricsAreCompatible("dpph", "predicted_scavenging", "absorbance"), false)
  })

  it("computes signed/absolute/percent difference", () => {
    const d = computeDifferences(12, 10)
    assert.equal(d.signedDifference, 2)
    assert.equal(d.absoluteDifference, 2)
    assert.equal(d.percentDifference, 20)
  })
})

describe("DPPH side-by-side behavior", () => {
  it("never auto-matches µM to µg/mL", () => {
    const prediction = basePrediction({
      endpoint: "dpph",
      module: "dpph",
      concentrationUnit: "uM",
      resultPoints: [
        {
          concentration: 50,
          concentrationUnit: "uM",
          metric: "predicted_scavenging",
          value: 55,
          valueUnit: "%",
        },
        {
          concentration: 100,
          concentrationUnit: "uM",
          metric: "predicted_scavenging",
          value: 70,
          valueUnit: "%",
        },
      ],
    })
    const dataset = baseDataset({ assay: "dpph", assayType: "dpph", cellLineName: undefined })
    const replicates = [
      rep("T3", "R1", { radicalScavengingPercent: 40 }),
      rep("T3", "R2", { radicalScavengingPercent: 42 }),
      rep("T3", "R3", { radicalScavengingPercent: 41 }),
      rep("T4", "R1", { radicalScavengingPercent: 55 }),
      rep("T4", "R2", { radicalScavengingPercent: 57 }),
      rep("T4", "R3", { radicalScavengingPercent: 56 }),
    ]

    const result = computeComparison({
      endpoint: "dpph",
      prediction,
      dataset,
      replicates,
    })

    assert.equal(result.compatibility.status, "PARTIAL")
    assert.equal(result.comparisonMode, "SIDE_BY_SIDE")
    assert.equal(result.alignedPoints.length, 0)
    assert.ok(
      result.compatibility.reasons.some((r) => /not automatically equivalent/i.test(r))
    )
    assert.equal(result.canPersist, true)
  })

  it("preserves evidence separation notice", () => {
    const prediction = basePrediction({
      endpoint: "dpph",
      module: "dpph",
      concentrationUnit: "uM",
      resultPoints: [
        {
          concentration: 25,
          concentrationUnit: "uM",
          metric: "predicted_scavenging",
          value: 30,
          valueUnit: "%",
        },
      ],
      provenance: { evidenceClass: "SIMULATION", methodName: "exploratory", assumptions: "demo" },
    })
    const result = computeComparison({
      endpoint: "dpph",
      prediction,
      dataset: baseDataset({ assay: "dpph", assayType: "dpph" }),
      replicates: [rep("T3", "R1", { radicalScavengingPercent: 40 })],
    })
    assert.equal(result.predictionEvidenceClass, "SIMULATION")
    assert.ok(result.notices.some((n) => /distinct evidence layers/i.test(n)))
  })
})

describe("LDH alignment", () => {
  it("marks fully matched LDH as COMPATIBLE with aligned points", () => {
    const replicates: LabReplicate[] = []
    for (const [code, conc] of [
      ["T3", 50],
      ["T4", 100],
      ["T5", 250],
      ["T6", 500],
    ] as const) {
      for (const r of ["R1", "R2", "R3"] as const) {
        replicates.push(rep(code, r, { percentCytotoxicity: conc / 10 }))
      }
    }
    const result = computeComparison({
      endpoint: "ldh",
      prediction: basePrediction(),
      dataset: baseDataset(),
      replicates,
    })
    assert.equal(result.compatibility.status, "COMPATIBLE")
    assert.equal(result.comparisonMode, "ALIGNED")
    assert.equal(result.alignedPoints.length, 4)
    const p50 = result.alignedPoints.find((p) => p.concentration === 50)
    assert.ok(p50)
    assert.equal(p50!.differencesComputed, true)
    assert.equal(p50!.predictedValue, 10)
    assert.equal(p50!.experimentalMean, 5)
  })

  it("marks partially matched LDH as PARTIAL and does not invent points", () => {
    const replicates = [
      rep("T3", "R1", { percentCytotoxicity: 8 }),
      rep("T3", "R2", { percentCytotoxicity: 9 }),
      rep("T3", "R3", { percentCytotoxicity: 10 }),
      // only 50 µg/mL experimental — prediction has 50/100/250/500
    ]
    const result = computeComparison({
      endpoint: "ldh",
      prediction: basePrediction(),
      dataset: baseDataset(),
      replicates,
    })
    assert.equal(result.compatibility.status, "PARTIAL")
    assert.equal(result.alignedPoints.length, 1)
    assert.equal(result.alignedPoints[0].concentration, 50)
  })

  it("does not fabricate missing matching concentrations", () => {
    const result = computeComparison({
      endpoint: "ldh",
      prediction: basePrediction({
        resultPoints: [
          {
            concentration: 75,
            concentrationUnit: "ug_per_mL",
            metric: "predicted_cytotoxicity",
            value: 15,
            valueUnit: "%",
          },
        ],
      }),
      dataset: baseDataset(),
      replicates: [
        rep("T3", "R1", { percentCytotoxicity: 10 }),
        rep("T3", "R2", { percentCytotoxicity: 11 }),
        rep("T3", "R3", { percentCytotoxicity: 12 }),
      ],
    })
    assert.equal(result.alignedPoints.length, 0)
    assert.equal(result.compatibility.status, "PARTIAL")
  })
})

describe("incompatible endpoints", () => {
  it("rejects MTT-style endpoints", () => {
    const c = assessCompatibility({
      endpoint: "dpph",
      prediction: basePrediction({ endpoint: "mtt" as "dpph", module: "mtt" as "dpph" }),
      dataset: baseDataset({ assay: "dpph", assayType: "dpph" }),
      experimentalHasMeasurements: true,
      matchingConcentrationCount: 0,
      predictionPointCount: 1,
    })
    assert.equal(c.status, "INCOMPATIBLE")
  })

  it("rejects DPPH prediction vs LDH experiment", () => {
    const result = computeComparison({
      endpoint: "ldh",
      prediction: basePrediction({ endpoint: "dpph", module: "dpph", concentrationUnit: "uM" }),
      dataset: baseDataset(),
      replicates: [rep("T3", "R1", { percentCytotoxicity: 10 })],
    })
    assert.equal(result.compatibility.status, "INCOMPATIBLE")
    assert.equal(result.canPersist, false)
  })

  it("rejects empty experimental measurements", () => {
    const result = computeComparison({
      endpoint: "ldh",
      prediction: basePrediction(),
      dataset: baseDataset(),
      replicates: [],
    })
    assert.equal(result.compatibility.status, "INCOMPATIBLE")
  })
})

describe("fingerprint / stale", () => {
  it("changes fingerprint when replicates change", () => {
    const a = buildComparisonFingerprint({
      predictionUpdatedAt: "t0",
      predictionId: "p1",
      predictionPoints: basePrediction().resultPoints,
      labDatasetUpdatedAt: "t0",
      labDatasetId: "lab1",
      replicates: [rep("T3", "R1", { percentCytotoxicity: 10 }, "t0")],
    })
    const b = buildComparisonFingerprint({
      predictionUpdatedAt: "t0",
      predictionId: "p1",
      predictionPoints: basePrediction().resultPoints,
      labDatasetUpdatedAt: "t0",
      labDatasetId: "lab1",
      replicates: [rep("T3", "R1", { percentCytotoxicity: 99 }, "t1")],
    })
    assert.notEqual(a, b)
  })

  it("changes fingerprint when prediction changes", () => {
    const pts = basePrediction().resultPoints
    const a = buildComparisonFingerprint({
      predictionUpdatedAt: "t0",
      predictionId: "p1",
      predictionPoints: pts,
      labDatasetUpdatedAt: "t0",
      labDatasetId: "lab1",
      replicates: [],
    })
    const b = buildComparisonFingerprint({
      predictionUpdatedAt: "t1",
      predictionId: "p1",
      predictionPoints: pts,
      labDatasetUpdatedAt: "t0",
      labDatasetId: "lab1",
      replicates: [],
    })
    assert.notEqual(a, b)
  })

  it("warns when linked statistics are stale", () => {
    const result = computeComparison({
      endpoint: "ldh",
      prediction: basePrediction(),
      dataset: baseDataset(),
      replicates: [
        rep("T3", "R1", { percentCytotoxicity: 10 }),
        rep("T3", "R2", { percentCytotoxicity: 11 }),
        rep("T3", "R3", { percentCytotoxicity: 12 }),
        rep("T4", "R1", { percentCytotoxicity: 20 }),
        rep("T4", "R2", { percentCytotoxicity: 21 }),
        rep("T4", "R3", { percentCytotoxicity: 22 }),
        rep("T5", "R1", { percentCytotoxicity: 40 }),
        rep("T5", "R2", { percentCytotoxicity: 41 }),
        rep("T5", "R3", { percentCytotoxicity: 42 }),
        rep("T6", "R1", { percentCytotoxicity: 70 }),
        rep("T6", "R2", { percentCytotoxicity: 71 }),
        rep("T6", "R3", { percentCytotoxicity: 72 }),
      ],
      statistics: {
        id: "stat1",
        studyId: "st1",
        assayType: "ldh",
        labDatasetId: "lab1",
        labDatasetName: "LDH exp",
        measurementKey: "percentCytotoxicity",
        measurementLabel: "% cytotoxicity",
        alpha: 0.05,
        sourceDatasetUpdatedAt: "t0",
        sourceFingerprint: "x",
        treatmentSummaries: [],
        completeness: {
          expectedCells: 18,
          observedCells: 12,
          missingCells: 6,
          incomplete: true,
          warnings: [],
        },
        anova: {
          k: 4,
          N: 12,
          groupLabels: [],
          groupNs: [],
          groupMeans: [],
          grandMean: 0,
          ssBetween: 0,
          ssWithin: 0,
          ssTotal: 0,
          dfBetween: 3,
          dfWithin: 8,
          dfTotal: 11,
          msBetween: 0,
          msWithin: 0,
          fStatistic: 0,
          pValue: 1,
          alpha: 0.05,
          significant: false,
          message: "n/a",
        },
        scheffeComparisons: [],
        calculationMethod: "ONE_WAY_ANOVA_SCHEFFE",
        calculationVersion: "1.0.0",
        calculatedAt: "t0",
        calculatedBy: "u1",
        status: "final",
        provenance: { evidenceClass: "EXPERIMENTAL" },
        createdAt: "t0",
        updatedAt: "t0",
        createdBy: "u1",
        updatedBy: "u1",
      },
      statisticsFreshness: "STALE",
    })
    assert.equal(result.statisticsRef?.freshness, "STALE")
    assert.ok(result.notices.some((n) => /STALE/i.test(n)))
  })
})
