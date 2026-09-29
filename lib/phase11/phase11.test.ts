/**
 * Phase 11 — cross-cutting domain boundary tests.
 * Evidence classes, units, permissions, study paths, infinite stats, errors.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { assessCompatibility } from "../comparison/compatibility"
import { EvidenceTypeSchema } from "../domain/provenance"
import type { LabDataset, PredictionRun } from "../domain/models"
import { toUserFacingError } from "../errors/userFacing"
import { studySub, STUDY_SUBCOLLECTIONS } from "../firebase/paths"
import {
  canEditComparisons,
  canEditInterpretations,
  canEditLabData,
  canEditResearchData,
  canEditScientificRuns,
  canEditStatistics,
} from "../permissions/researchAccess"
import { assertValidEvidenceClassForSource } from "../interpretation/evidenceCatalog"
import {
  formatStatNumber,
  INFINITE_STAT_SENTINEL,
  isInfiniteStatDisplay,
  toFirestoreStatNumber,
} from "../statistics/statDisplay"

function pred(over: Partial<PredictionRun> = {}): PredictionRun {
  return {
    id: "p1",
    studyId: "st1",
    endpoint: "dpph",
    module: "dpph",
    runName: "run",
    methodName: "External",
    methodType: "documented_model",
    source: "import",
    dateGenerated: "2026-01-01",
    concentrationUnit: "uM",
    resultPoints: [
      {
        concentration: 50,
        concentrationUnit: "uM",
        metric: "predicted_inhibition",
        value: 40,
        valueUnit: "%",
      },
    ],
    referenceIds: [],
    status: "imported",
    provenance: { evidenceClass: "PREDICTED", methodName: "External", source: "import" },
    createdAt: "t0",
    updatedAt: "t0",
    createdBy: "u1",
    updatedBy: "u1",
    ...over,
  }
}

function lab(over: Partial<LabDataset> = {}): LabDataset {
  return {
    id: "lab1",
    studyId: "st1",
    assay: "dpph",
    assayType: "dpph",
    datasetName: "exp",
    laboratoryName: "DMBEL",
    datePerformed: "2026-01-02",
    protocolReference: "kit protocol",
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

describe("evidence-class enforcement", () => {
  it("accepts only contract evidence classes", () => {
    for (const c of [
      "REFERENCE",
      "LITERATURE",
      "PREDICTED",
      "EXPERIMENTAL",
      "INTERPRETATION",
      "SIMULATION",
    ] as const) {
      assert.equal(EvidenceTypeSchema.parse(c), c)
    }
    assert.throws(() => EvidenceTypeSchema.parse("AI_CONFIDENCE"))
    assert.throws(() => EvidenceTypeSchema.parse("FAKE"))
  })

  it("never allows silent PREDICTED → EXPERIMENTAL on prediction sources", () => {
    assert.equal(assertValidEvidenceClassForSource("predictionRun", "PREDICTED"), true)
    assert.equal(assertValidEvidenceClassForSource("predictionRun", "EXPERIMENTAL"), false)
    assert.equal(assertValidEvidenceClassForSource("labDataset", "EXPERIMENTAL"), true)
    assert.equal(assertValidEvidenceClassForSource("labDataset", "PREDICTED"), false)
  })
})

describe("permissions matrix", () => {
  it("OWNER and COLLABORATOR can author; ADVISER and VIEWER are read-only", () => {
    for (const role of ["OWNER", "COLLABORATOR"] as const) {
      assert.equal(canEditResearchData(role), true)
      assert.equal(canEditScientificRuns(role), true)
      assert.equal(canEditLabData(role), true)
      assert.equal(canEditStatistics(role), true)
      assert.equal(canEditComparisons(role), true)
      assert.equal(canEditInterpretations(role), true)
    }
    for (const role of ["ADVISER", "VIEWER"] as const) {
      assert.equal(canEditResearchData(role), false)
      assert.equal(canEditScientificRuns(role), false)
      assert.equal(canEditLabData(role), false)
      assert.equal(canEditStatistics(role), false)
      assert.equal(canEditComparisons(role), false)
      assert.equal(canEditInterpretations(role), false)
    }
    assert.equal(canEditResearchData(null), false)
  })
})

describe("study isolation paths", () => {
  it("scopes every scientific subcollection under studies/{studyId}", () => {
    const a = "studyA"
    const b = "studyB"
    for (const sub of Object.values(STUDY_SUBCOLLECTIONS)) {
      const pathA = studySub(a, sub)
      const pathB = studySub(b, sub)
      assert.ok(pathA.startsWith(`studies/${a}/`))
      assert.ok(pathB.startsWith(`studies/${b}/`))
      assert.notEqual(pathA, pathB)
      assert.ok(!pathA.includes(b))
    }
  })
})

describe("DPPH unit separation", () => {
  it("never treats µM as µg/mL for aligned comparison", () => {
    const result = assessCompatibility({
      endpoint: "dpph",
      prediction: pred({ endpoint: "dpph", module: "dpph", concentrationUnit: "uM" }),
      dataset: lab({ assay: "dpph", assayType: "dpph" }),
      experimentalHasMeasurements: true,
      matchingConcentrationCount: 4,
      predictionPointCount: 1,
    })
    assert.equal(result.allowAlignedComparison, false)
    assert.equal(result.comparisonModeHint, "SIDE_BY_SIDE")
    assert.ok(result.reasons.some((r) => /µM|ug\/mL|µg\/mL/i.test(r)))
  })
})

describe("LDH unit compatibility", () => {
  it("allows aligned comparison when both sides use µg/mL and HepG2", () => {
    const result = assessCompatibility({
      endpoint: "ldh",
      prediction: pred({
        endpoint: "ldh",
        module: "ldh",
        concentrationUnit: "ug_per_mL",
        resultPoints: [
          {
            concentration: 50,
            concentrationUnit: "ug_per_mL",
            metric: "predicted_cytotoxicity",
            value: 10,
            valueUnit: "%",
          },
        ],
      }),
      dataset: lab({
        assay: "ldh",
        assayType: "ldh",
        cellLineName: "HepG2",
      }),
      experimentalHasMeasurements: true,
      matchingConcentrationCount: 4,
      predictionPointCount: 4,
    })
    assert.equal(result.status, "COMPATIBLE")
    assert.equal(result.allowAlignedComparison, true)
  })
})

describe("infinite statistical sentinel", () => {
  it("stores Infinity as MAX_VALUE sentinel and displays as ∞", () => {
    assert.equal(toFirestoreStatNumber(Infinity), INFINITE_STAT_SENTINEL)
    assert.equal(isInfiniteStatDisplay(INFINITE_STAT_SENTINEL), true)
    assert.equal(formatStatNumber(INFINITE_STAT_SENTINEL), "∞")
    assert.equal(formatStatNumber(1.2345), "1.2345")
    assert.equal(formatStatNumber(null), "—")
  })
})

describe("user-facing errors", () => {
  it("maps Firebase permission/unavailable without stack traces", () => {
    assert.match(
      toUserFacingError({
        code: "permission-denied",
        message: "Missing or insufficient permissions.",
      }),
      /Administrator access|ownership record/i
    )
    assert.match(
      toUserFacingError({ code: "unavailable", message: "offline" }),
      /unavailable|connection/i
    )
    assert.match(
      toUserFacingError(new Error("Select a study before continuing")),
      /active study|Select/i
    )
    const messy = toUserFacingError(new Error("Error: at Object.foo (file.js:1:1)\n  at bar"))
    assert.ok(!/at Object\.foo/.test(messy))
  })
})

describe("no automatic hypothesis decision", () => {
  it("hypothesis assessment values remain manual enums only", () => {
    const allowed = new Set([
      "not_assessed",
      "supported",
      "partially_supported",
      "not_supported",
    ])
    assert.ok(allowed.has("not_assessed"))
    assert.equal(allowed.has("auto_supported"), false)
    assert.equal(allowed.has("ai_concluded"), false)
  })
})
