import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  analysisFinalizeBlockers,
  analysisStageStatus,
  continueAdvisory,
  continueRequirements,
  emptyReadiness,
  parseWorkspaceSlug,
  stepAvailability,
  stepIdFromPathname,
  stepRecordStatus,
  studyPath,
  WORKFLOW_STEPS,
} from "./studyFlow"

describe("study workspace routing", () => {
  it("opens Research Setup on the phytochemicals tab", () => {
    const parsed = parseWorkspaceSlug([])
    assert.equal(parsed.step.id, "setup")
    assert.equal(parsed.tab, "phytochemicals")
    assert.equal(studyPath("abc", "setup"), "/study/abc/setup/phytochemicals")
  })

  it("keeps docking as a single workspace without a tab segment", () => {
    assert.equal(studyPath("abc", "docking"), "/study/abc/docking")
    const parsed = parseWorkspaceSlug(["docking"])
    assert.equal(parsed.step.id, "docking")
    assert.equal(parsed.tab, "")
  })

  it("does not keep a standalone references section in Research Setup", () => {
    assert.equal(
      WORKFLOW_STEPS[0].tabs.some((tab) => tab.id === "references"),
      false
    )
    const parsed = parseWorkspaceSlug(["setup", "references"])
    assert.equal(parsed.step.id, "setup")
    assert.equal(parsed.tab, "phytochemicals")
    assert.equal(
      WORKFLOW_STEPS[0].tabs.some((tab) => tab.id === "formulation"),
      false
    )
  })

  it("falls back when a tab id is unknown", () => {
    const parsed = parseWorkspaceSlug(["predictions", "not-a-tab"])
    assert.equal(parsed.step.id, "predictions")
    assert.equal(parsed.tab, "all")
  })

  it("exposes the six locked workflow steps", () => {
    assert.deepEqual(
      WORKFLOW_STEPS.map((s) => s.label),
      [
        "Research Setup",
        "In-Silico Screening",
        "Molecular Docking",
        "Biological Predictions",
        "Laboratory Validation",
        "Analysis & Interpretation",
      ]
    )
  })
})

describe("guided continue requirements", () => {
  it("names each missing setup record", () => {
    assert.deepEqual(continueRequirements("setup", emptyReadiness()), [
      "Select at least one phytochemical before continuing to In-Silico Screening.",
      "Select at least one target protein before continuing to In-Silico Screening.",
      "Select at least one cell line before continuing to In-Silico Screening.",
    ])
  })

  it("requires at least one selected phytochemical to be reviewed before docking", () => {
    assert.deepEqual(continueRequirements("insilico", emptyReadiness({ proteins: 1 })), [
      "Select at least one phytochemical before continuing to Molecular Docking.",
    ])
    assert.deepEqual(
      continueRequirements("insilico", emptyReadiness({ compounds: 2, screenedCompounds: 0, proteins: 1 })),
      ["Complete PubChem, drug-likeness, and ADME screening for at least one selected phytochemical before continuing to Molecular Docking."],
    )
    assert.deepEqual(
      continueRequirements("insilico", emptyReadiness({ compounds: 2, screenedCompounds: 2, proteins: 1 })),
      [],
    )
    assert.deepEqual(
      continueRequirements("insilico", emptyReadiness({ compounds: 2, screenedCompounds: 1, proteins: 1 })),
      [],
    )
    assert.equal(
      continueAdvisory("insilico", emptyReadiness({ compounds: 2, screenedCompounds: 1 })),
      "1 of 2 phytochemicals completed screening. The remaining 1 compound is pending or excluded from Molecular Docking.",
    )
  })

  it("allows Biological Predictions without requiring every docking pair to finish", () => {
    assert.deepEqual(continueRequirements("docking", emptyReadiness({ compounds: 2, proteins: 2 })), [])
    assert.deepEqual(
      continueRequirements("docking", emptyReadiness({ compounds: 2, proteins: 2, dockingCompleted: 4 })),
      [],
    )
    assert.deepEqual(
      continueRequirements("docking", emptyReadiness({
        compounds: 1,
        proteins: 2,
        dockingCompleted: 1,
        dockingSkipped: 1,
        dockingResolved: 2,
      })),
      [],
    )
    assert.match(
      continueAdvisory("docking", emptyReadiness({ compounds: 2, proteins: 2, dockingCompleted: 1 })) ?? "",
      /Docking is incomplete/i,
    )
    assert.equal(
      continueAdvisory("docking", emptyReadiness({ compounds: 1, proteins: 1, dockingCompleted: 1 })),
      null,
    )
  })

  it("does not require fabricated predictions before laboratory validation", () => {
    assert.deepEqual(continueRequirements("predictions", emptyReadiness()), [])
    assert.deepEqual(
      continueRequirements("predictions", emptyReadiness({ predictionRequired: 2, predictionRecorded: 0 })),
      [],
    )
    assert.equal(continueAdvisory("analysis", emptyReadiness()), null)
    assert.deepEqual(continueRequirements("laboratory", emptyReadiness()), [])
    assert.deepEqual(
      continueRequirements("laboratory", emptyReadiness({ labRequired: 6, labRecorded: 2 })),
      [],
    )
    assert.deepEqual(
      continueRequirements("laboratory", emptyReadiness({ labRequired: 0, labRecorded: 0 })),
      [],
    )
  })
})

describe("record-backed step status", () => {
  const setupRecords = emptyReadiness({
    compounds: 1,
    proteins: 1,
    cellLines: 1,
  })

  it("locks later steps until phytochemicals, proteins, and cell lines are selected", () => {
    assert.equal(stepAvailability("insilico", emptyReadiness(), false), "locked")
    assert.equal(stepAvailability("docking", emptyReadiness(), false), "locked")
    assert.equal(stepAvailability("setup", emptyReadiness(), true), "current")
    assert.equal(
      stepAvailability("insilico", emptyReadiness({ formulations: 1 }), false),
      "locked"
    )
    const done = emptyReadiness({
      compounds: 1,
      proteins: 1,
      cellLines: 1,
    })
    assert.equal(stepAvailability("setup", done, false), "completed")
    assert.equal(stepAvailability("insilico", done, false), "available")
    assert.equal(stepAvailability("insilico", done, true), "current")
    assert.equal(stepAvailability("predictions", done, false), "locked")
  })

  it("unlocks biological predictions after screening even when docking is incomplete", () => {
    const partial = emptyReadiness({
      compounds: 2,
      proteins: 2,
      cellLines: 1,
      screenedCompounds: 2,
      dockingCompleted: 2,
    })
    const unscreened = emptyReadiness({ compounds: 2, proteins: 2, cellLines: 1, dockingCompleted: 2 })
    const finished = emptyReadiness({
      compounds: 2,
      proteins: 2,
      cellLines: 1,
      screenedCompounds: 2,
      dockingCompleted: 4,
    })
    const skipped = emptyReadiness({
      compounds: 1,
      proteins: 2,
      cellLines: 1,
      screenedCompounds: 1,
      dockingCompleted: 1,
      dockingSkipped: 1,
      dockingResolved: 2,
    })
    assert.equal(stepAvailability("predictions", unscreened, false), "locked")
    assert.equal(stepAvailability("predictions", partial, false), "available")
    assert.equal(stepRecordStatus("docking", partial), "in_progress")
    assert.equal(stepAvailability("laboratory", partial, false), "locked")
    assert.equal(stepAvailability("analysis", partial, false), "locked")
    assert.equal(stepAvailability("predictions", finished, false), "available")
    assert.equal(stepAvailability("laboratory", finished, false), "locked")
    assert.equal(stepAvailability("analysis", finished, false), "locked")
    assert.equal(stepRecordStatus("docking", finished), "complete")
    assert.equal(stepRecordStatus("docking", skipped), "complete")
    assert.equal(stepAvailability("docking", skipped, false), "completed")
    assert.equal(stepAvailability("predictions", skipped, false), "available")
    assert.equal(stepAvailability("laboratory", skipped, false), "locked")
    assert.equal(stepAvailability("analysis", skipped, false), "locked")
  })

  it("leaves status unknown until records are loaded", () => {
    assert.equal(stepRecordStatus("setup", null), "unknown")
    assert.equal(stepRecordStatus("docking", null), "unknown")
  })

  it("completes setup only when a phytochemical, protein, and cell line are selected", () => {
    assert.equal(stepRecordStatus("setup", setupRecords), "complete")
    assert.equal(stepRecordStatus("setup", emptyReadiness()), "incomplete")
  })

  it("completes in-silico screening only after every selected phytochemical is reviewed", () => {
    assert.equal(stepRecordStatus("insilico", setupRecords), "incomplete")
    assert.equal(stepRecordStatus("insilico", emptyReadiness({ admetRuns: 1 })), "incomplete")
    assert.equal(
      stepRecordStatus("insilico", emptyReadiness({ compounds: 2, screenedCompounds: 2, proteins: 1 })),
      "complete",
    )
  })

  it("marks docking complete only when every ligand–protein pair is resolved", () => {
    assert.equal(stepRecordStatus("docking", setupRecords), "incomplete")
    assert.equal(stepRecordStatus("docking", emptyReadiness({ dockingRuns: 2 })), "incomplete")
    assert.equal(
      stepRecordStatus("docking", emptyReadiness({ compounds: 2, proteins: 2, dockingCompleted: 3 })),
      "in_progress",
    )
    assert.equal(
      stepRecordStatus("docking", emptyReadiness({ compounds: 2, proteins: 2, dockingCompleted: 4 })),
      "complete",
    )
    assert.equal(stepRecordStatus("predictions", emptyReadiness()), "incomplete")
    assert.equal(stepRecordStatus("predictions", emptyReadiness({ predictionRuns: 1 })), "incomplete")
    assert.equal(
      stepRecordStatus("predictions", emptyReadiness({ predictionRequired: 2, predictionRecorded: 2 })),
      "complete",
    )
    assert.equal(stepRecordStatus("laboratory", emptyReadiness({ labDpph: 1 })), "in_progress")
    assert.equal(
      stepRecordStatus("laboratory", emptyReadiness({ labRequired: 6, labRecorded: 2, labDpph: 1, labLdh: 1 })),
      "in_progress",
    )
    assert.equal(stepRecordStatus("laboratory", emptyReadiness({ labRequired: 6, labRecorded: 0 })), "incomplete")
    assert.equal(
      stepRecordStatus("laboratory", emptyReadiness({ labRequired: 1, labRecorded: 1 })),
      "complete",
    )
    assert.equal(
      stepRecordStatus("laboratory", emptyReadiness({ labRequired: 0, labRecorded: 0 })),
      "complete",
    )
  })

  it("marks analysis review-required when a stored freshness check is STALE", () => {
    assert.equal(
      stepRecordStatus("analysis", emptyReadiness({ statistics: 1, staleStatistics: 1 })),
      "review"
    )
    assert.equal(
      stepRecordStatus("analysis", emptyReadiness({ comparisons: 1, staleComparisons: 1 })),
      "review"
    )
    assert.equal(
      stepRecordStatus(
        "analysis",
        emptyReadiness({ interpretations: 1, staleInterpretations: 1 })
      ),
      "review"
    )
    assert.equal(
      stepRecordStatus("analysis", emptyReadiness({ statistics: 1 })),
      "incomplete"
    )
    assert.equal(
      stepRecordStatus(
        "analysis",
        emptyReadiness({ statistics: 1, staleStatistics: 1, interpretationFinal: 1 }),
      ),
      "complete"
    )
    assert.equal(
      stepRecordStatus("analysis", emptyReadiness({ interpretationFinal: 1 })),
      "complete"
    )
    assert.equal(
      stepRecordStatus(
        "analysis",
        emptyReadiness({ interpretationFinal: 1, laboratoryChangedAfterAnalysis: true }),
      ),
      "review",
    )
    assert.equal(
      stepAvailability(
        "analysis",
        emptyReadiness({ compounds: 1, proteins: 1, cellLines: 1, labRequired: 6, labRecorded: 2, labDpph: 1 }),
        false,
      ),
      "locked",
    )
    assert.equal(stepRecordStatus("docking", emptyReadiness({ staleStatistics: 1 })), "incomplete")
  })

  it("opens Analysis on the overview", () => {
    assert.equal(studyPath("abc", "analysis"), "/study/abc/analysis/overview")
    assert.equal(parseWorkspaceSlug(["analysis"]).tab, "overview")
  })

  it("derives analysis stage status from stored records", () => {
    assert.equal(analysisStageStatus("statistics", emptyReadiness()), "not_started")
    assert.equal(analysisStageStatus("statistics", emptyReadiness({ labDpph: 1 })), "ready")
    assert.equal(analysisStageStatus("statistics", emptyReadiness({ statistics: 1 })), "completed")
    assert.equal(
      analysisStageStatus("statistics", emptyReadiness({ statistics: 1, staleStatistics: 1 })),
      "in_progress",
    )
    assert.equal(analysisStageStatus("comparison", emptyReadiness({ predictionMtt: 1 })), "not_started")
    assert.equal(
      analysisStageStatus("comparison", emptyReadiness({ predictionDpph: 1, labDpph: 1 })),
      "ready",
    )
    assert.equal(analysisStageStatus("comparison", emptyReadiness({ comparisons: 1 })), "completed")
    assert.equal(analysisStageStatus("interpretation", emptyReadiness()), "not_started")
    assert.equal(analysisStageStatus("interpretation", emptyReadiness({ statistics: 1 })), "ready")
    assert.equal(
      analysisStageStatus("interpretation", emptyReadiness({ interpretations: 1 })),
      "in_progress",
    )
    assert.equal(
      analysisStageStatus("interpretation", emptyReadiness({ interpretationFinal: 1 })),
      "completed",
    )
  })

  it("blocks finalizing until statistics, compatible comparisons, and the written interpretation exist", () => {
    const blocked = analysisFinalizeBlockers(
      emptyReadiness({ labDpph: 1, predictionDpph: 1, labLdh: 0 }),
    )
    assert.ok(blocked.some((line) => /statistical analysis/i.test(line)))
    assert.ok(blocked.some((line) => /DPPH/i.test(line)))
    assert.ok(blocked.some((line) => /interpretation/i.test(line)))
    assert.equal(
      analysisFinalizeBlockers(
        emptyReadiness({
          labDpph: 1,
          predictionDpph: 1,
          statistics: 1,
          comparisons: 1,
          comparisonsDpph: 1,
          interpretationReady: 1,
        }),
      ).length,
      0,
    )
  })

  it("reads the open step from the study path", () => {
    assert.equal(stepIdFromPathname("/study/abc/docking", "abc"), "docking")
    assert.equal(stepIdFromPathname("/study/abc/predictions/ldh", "abc"), "predictions")
    assert.equal(stepIdFromPathname("/", "abc"), null)
    assert.equal(stepIdFromPathname("/study/other/setup/formulation", "abc"), null)
    assert.equal(stepIdFromPathname("/study/abc/assistant", "abc"), null)
  })
})
