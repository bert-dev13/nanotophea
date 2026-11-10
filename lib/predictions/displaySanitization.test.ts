import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { PredictionRun } from "@/lib/domain/models"
import {
  LEGACY_SIMULATION_WARNING,
  sanitizePredictionDisplay,
  sanitizedPredictionLines,
  sanitizedPredictionSummary,
} from "@/lib/predictions/displaySanitization"
import { storedSimulationFromPrototype } from "@/lib/predictions/store"
import { simulateDpph } from "@/lib/predictions/prototype/dpph"
import { stampExploratoryAcknowledgement } from "@/lib/predictions/acknowledgement"

function baseRun(patch: Partial<PredictionRun> = {}): PredictionRun {
  return {
    id: "run-1",
    studyId: "study-1",
    endpoint: "dpph",
    module: "dpph",
    runName: "legacy",
    compoundId: "c1",
    methodName: "legacy",
    methodType: "exploratory_math",
    source: "Exploratory simulation",
    referenceIds: [],
    concentrationUnit: "uM",
    dateGenerated: "2026-01-01T00:00:00.000Z",
    resultPoints: [
      { concentration: 100, concentrationUnit: "uM", metric: "predicted_scavenging", value: 80, valueUnit: "%" },
    ],
    status: "final",
    provenance: {
      evidenceClass: "SIMULATION",
      methodName: "legacy",
      recordedAt: "2026-01-01T00:00:00.000Z",
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
    updatedBy: "u1",
    ...patch,
  } as PredictionRun
}

describe("legacy simulation display sanitization", () => {
  it("quarantines TEAC, IC50, and selectivity index for SIMULATION runs", () => {
    const display = sanitizePredictionDisplay(
      baseRun({
        summaryIc50: 12.5,
        summaryIc50Unit: "uM",
        teac: "0.94",
        selectivityIndex: "4.2",
        inputParameters: {
          "output:TEAC": 0.94,
          "unit:TEAC": "ratio",
          "output:Scavenging response": 80,
          "unit:Scavenging response": "% at 100 µM",
        },
      }),
    )
    assert.equal(display.isExploratorySimulation, true)
    assert.ok(display.primary.some((row) => /Scavenging/i.test(row.label)))
    assert.ok(!display.primary.some((row) => /^TEAC$/i.test(row.label) || /^IC50$/i.test(row.label)))
    assert.ok(display.legacy.some((row) => /TEAC/i.test(row.label)))
    assert.ok(display.legacy.some((row) => /IC50/i.test(row.label)))
    assert.ok(display.legacy.some((row) => /selectivity/i.test(row.label)))
    assert.equal(display.legacyWarning, LEGACY_SIMULATION_WARNING)
    assert.match(sanitizedPredictionSummary(baseRun({ summaryIc50: 12.5 })), /Exploratory/)
    assert.doesNotMatch(sanitizedPredictionSummary(baseRun({ summaryIc50: 12.5 })), /^IC50 /)
  })

  it("quarantines fabricated BAX populations and markers", () => {
    const display = sanitizePredictionDisplay(
      baseRun({
        endpoint: "bax",
        module: "bax",
        inputParameters: {
          "output:Viable": 40,
          "unit:Viable": "%",
          "output:Early apoptotic": 20,
          "unit:Early apoptotic": "%",
          "output:Late apoptotic": 25,
          "unit:Late apoptotic": "%",
          "output:Necrotic": 15,
          "unit:Necrotic": "%",
          "output:BCL-2 response": 0.5,
          "unit:BCL-2 response": "fold",
          "output:Caspase-3 response": 1.2,
          "unit:Caspase-3 response": "fold",
          "output:Exploratory BAX-target context response": 33,
          "unit:Exploratory BAX-target context response": "index",
        },
      }),
    )
    assert.ok(display.primary.some((row) => /BAX-target context/i.test(row.label)))
    assert.ok(display.legacy.some((row) => /Viable|Early apoptotic|BCL-2|Caspase/i.test(row.label)))
    assert.ok(!display.primary.some((row) => /Viable|Early apoptotic|BCL-2|Caspase/i.test(row.label)))
  })

  it("keeps current exploratory outputs as primary without legacy quarantine", () => {
    const features = {
      studyId: "s",
      phytochemicalId: "c1",
      phytochemicalName: "Quercetin",
      targetProteinIds: [] as string[],
      docking: [] as Array<{ proteinId: string; affinityKcalMol: number }>,
      admeDescriptors: {},
    }
    const ack = stampExploratoryAcknowledgement({ endpoint: "dpph", actorId: "researcher-1" })
    const stored = storedSimulationFromPrototype(simulateDpph(features), features, { acknowledgement: ack })
    const display = sanitizePredictionDisplay({
      ...baseRun(),
      ...stored,
      id: "run-new",
      studyId: "s",
      createdAt: stored.dateGenerated,
      updatedAt: stored.dateGenerated,
      createdBy: "researcher-1",
      updatedBy: "researcher-1",
    } as PredictionRun)
    assert.ok(display.primary.length > 0)
    assert.equal(display.legacy.length, 0)
    assert.equal(display.legacyWarning, null)
    const run = {
      ...baseRun(),
      ...stored,
      id: "run-new",
      studyId: "s",
      createdAt: stored.dateGenerated,
      updatedAt: stored.dateGenerated,
      createdBy: "researcher-1",
      updatedBy: "researcher-1",
    } as PredictionRun
    assert.ok(sanitizedPredictionLines(run).some((line) => /Scavenging|Hill midpoint|Maximum/i.test(line)))
    assert.equal(stored.inputParameters?.["meta:acknowledgedExploratory"], true)
    assert.equal(stored.inputParameters?.["meta:acknowledgedBy"], "researcher-1")
  })

  it("treats PREDICTED labels without a registered model as historical/unverified, not validated science", () => {
    const display = sanitizePredictionDisplay(
      baseRun({
        methodType: "documented_model",
        source: "Named QSAR v1",
        methodName: "Named QSAR",
        provenance: {
          evidenceClass: "PREDICTED",
          methodName: "Named QSAR",
          recordedAt: "2026-01-01T00:00:00.000Z",
        },
        summaryIc50: 10,
        summaryIc50Unit: "uM",
        teac: undefined,
        selectivityIndex: undefined,
        inputParameters: {},
      }),
    )
    assert.equal(display.isExploratorySimulation, false)
    assert.equal(display.isUnverifiedPredicted, true)
    assert.ok(!display.primary.some((row) => row.label === "IC50"))
    assert.ok(display.legacy.some((row) => /IC50/i.test(row.label)))
  })
})
