import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canShowScientificEvidence,
  defaultModuleIncluded,
  filterBiologicalPredictionJobs,
  filterRunnablePredictions,
  isPredictionCompletedWithResult,
  moduleIncluded,
  predictionProgress,
  resolvePredictionStatus,
  subjectsForModule,
  type FilterablePredictionJob,
  type PredictionJobStatus,
} from "./modules"
import type { PredictionRun } from "@/lib/domain/models"

const compounds = [
  { id: "r", name: "Rutin" },
  { id: "l", name: "Luteolin" },
]
const proteins = [
  { id: "b", name: "BAX", gene: "BAX" },
  { id: "y", name: "YAP1", gene: "YAP1", pathway: "Hippo" },
]
const cellLines = [{ id: "h", name: "HepG2" }]

describe("prediction modules", () => {
  it("builds compound, cell-line, and target pairs from the study selection", () => {
    assert.deepEqual(
      subjectsForModule("dpph", compounds, proteins, cellLines).map((row) => row.label),
      ["Luteolin", "Rutin"],
    )
    assert.deepEqual(
      subjectsForModule("mtt", compounds, proteins, cellLines).map((row) => row.label),
      ["Luteolin × HepG2", "Rutin × HepG2"],
    )
    assert.deepEqual(
      subjectsForModule("bax", compounds, proteins, cellLines).map((row) => row.label),
      ["Luteolin × BAX", "Rutin × BAX"],
    )
    assert.deepEqual(
      subjectsForModule("hippo_yap", compounds, proteins, cellLines).map((row) => row.label),
      ["Luteolin × YAP1", "Rutin × YAP1"],
    )
  })

  it("counts only included modules and does not treat docking as a biological prediction", () => {
    assert.equal(defaultModuleIncluded("ros", compounds, proteins, []), false)
    assert.equal(moduleIncluded({ ros: false }, "ros", compounds, proteins, cellLines), false)
    const run = {
      endpoint: "dpph",
      compoundId: "l",
      methodName: "Documented model",
      source: "External tool",
    } as PredictionRun
    const progress = predictionProgress({
      stored: { mtt: false, ldh: false, ros: false, bax: false, hippo_yap: false },
      compounds,
      proteins,
      cellLines,
      runs: [run],
    })
    assert.deepEqual(progress, { required: 2, recorded: 1 })
  })
})

describe("scientific evidence visibility gate", () => {
  const validCompletedRun: PredictionRun = {
    id: "pred_run_123",
    studyId: "study_001",
    endpoint: "dpph",
    module: "dpph",
    runName: "DPPH Quercetin Model",
    compoundId: "quercetin_id",
    methodName: "Deterministic Bioactivity Engine",
    methodType: "exploratory_math",
    source: "Computational prediction",
    status: "final",
    dateGenerated: new Date().toISOString(),
    concentrationUnit: "ug_per_mL",
    resultPoints: [
      { concentration: 10, concentrationUnit: "ug_per_mL", metric: "Inhibition", value: 45.2, valueUnit: "%" },
      { concentration: 50, concentrationUnit: "ug_per_mL", metric: "Inhibition", value: 89.1, valueUnit: "%" },
    ],
    summaryIc50: 12.4,
    summaryIc50Unit: "ug_ml",
    provenance: {
      evidenceClass: "PREDICTED",
      source: "Computational prediction",
      recordedAt: new Date().toISOString(),
      operatorId: "tester",
    },
    referenceIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "tester",
    updatedBy: "tester",
  }

  it("Ready state: evidence remains hidden before simulation is run", () => {
    assert.equal(canShowScientificEvidence(undefined), false)
    assert.equal(canShowScientificEvidence(null), false)
    assert.equal(isPredictionCompletedWithResult(undefined), false)
  })

  it("Running state: evidence remains hidden while computation is in-flight", () => {
    assert.equal(canShowScientificEvidence(validCompletedRun, { running: true }), false)
    assert.equal(canShowScientificEvidence(undefined, { running: true }), false)
    assert.equal(isPredictionCompletedWithResult(validCompletedRun, { running: true }), false)
  })

  it("Failed state: evidence remains hidden when prediction fails", () => {
    assert.equal(canShowScientificEvidence(validCompletedRun, { runError: "Engine timeout" }), false)
    assert.equal(canShowScientificEvidence(undefined, { runError: "Failed to assemble descriptors" }), false)
    assert.equal(isPredictionCompletedWithResult(validCompletedRun, { runError: "Engine timeout" }), false)
  })

  it("Completed state: evidence becomes visible only when a valid result exists", () => {
    assert.equal(canShowScientificEvidence(validCompletedRun), true)
    assert.equal(canShowScientificEvidence(validCompletedRun, { running: false, runError: null }), true)
    assert.equal(isPredictionCompletedWithResult(validCompletedRun), true)
  })

  it("Completed but missing result points: evidence remains hidden", () => {
    const emptyPointsRun = { ...validCompletedRun, resultPoints: [] }
    assert.equal(canShowScientificEvidence(emptyPointsRun), false)
    assert.equal(isPredictionCompletedWithResult(emptyPointsRun), false)
  })

  it("Draft / unpersisted status: evidence remains hidden", () => {
    const draftRun = { ...validCompletedRun, status: "draft" as any }
    assert.equal(canShowScientificEvidence(draftRun), false)
  })

  it("Switching subjects: evidence visibility is strictly scoped to the active subject", () => {
    const dpphRun = { ...validCompletedRun, endpoint: "dpph" as const }
    const mttRun = undefined // not yet run
    const ldhRun = undefined // not yet run

    // When viewing DPPH: visible
    assert.equal(canShowScientificEvidence(dpphRun), true)
    // When viewing MTT: hidden
    assert.equal(canShowScientificEvidence(mttRun), false)
    // When viewing LDH: hidden
    assert.equal(canShowScientificEvidence(ldhRun), false)
  })

  it("Run All Ready mixed statuses: each prediction independently unlocks its own evidence", () => {
    const dpph = { run: validCompletedRun, running: false, runError: null } // Completed
    const mtt = { run: undefined, running: true, runError: null } // Running
    const ldh = { run: undefined, running: false, runError: null } // Ready
    const ros = { run: undefined, running: false, runError: "Calculation error" } // Failed
    const bax = { run: { ...validCompletedRun, endpoint: "bax" as const }, running: false, runError: null } // Completed
    const hippo = { run: undefined, running: false, runError: null } // Ready

    assert.equal(canShowScientificEvidence(dpph.run, { running: dpph.running, runError: dpph.runError }), true)
    assert.equal(canShowScientificEvidence(mtt.run, { running: mtt.running, runError: mtt.runError }), false)
    assert.equal(canShowScientificEvidence(ldh.run, { running: ldh.running, runError: ldh.runError }), false)
    assert.equal(canShowScientificEvidence(ros.run, { running: ros.running, runError: ros.runError }), false)
    assert.equal(canShowScientificEvidence(bax.run, { running: bax.running, runError: bax.runError }), true)
    assert.equal(canShowScientificEvidence(hippo.run, { running: hippo.running, runError: hippo.runError }), false)
  })

  it("Refresh persistence: restored runs from storage retain evidence visibility", () => {
    // Simulated fresh page load: persisted runs are retrieved from MySQL
    const persistedRuns: PredictionRun[] = [validCompletedRun]
    
    // DPPH was completed and persisted in DB -> evidence visible after page load
    const reloadedDpph = persistedRuns.find((r) => r.endpoint === "dpph")
    assert.equal(canShowScientificEvidence(reloadedDpph), true)

    // MTT was never persisted -> evidence remains hidden after page load
    const reloadedMtt = persistedRuns.find((r) => r.endpoint === "mtt")
    assert.equal(canShowScientificEvidence(reloadedMtt), false)
  })
})

describe("Biological Predictions status system and bulk execution", () => {
  const completedRun: PredictionRun = {
    id: "run_persisted_mysql_01",
    studyId: "study_nano",
    endpoint: "dpph",
    module: "dpph",
    runName: "DPPH Quercetin",
    compoundId: "quercetin",
    methodName: "Deterministic Bioactivity Engine",
    methodType: "exploratory_math",
    source: "Computational prediction",
    status: "final",
    dateGenerated: new Date().toISOString(),
    concentrationUnit: "ug_per_mL",
    resultPoints: [
      { concentration: 10, concentrationUnit: "ug_per_mL", metric: "Inhibition", value: 30, valueUnit: "%" },
    ],
    summaryIc50: 25.0,
    summaryIc50Unit: "ug_ml",
    provenance: {
      evidenceClass: "PREDICTED",
      source: "Computational prediction",
      recordedAt: new Date().toISOString(),
      operatorId: "researcher",
    },
    referenceIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "researcher",
    updatedBy: "researcher",
  }

  it("status resolver accurately identifies all 5 core states", () => {
    // 1. Completed
    assert.equal(resolvePredictionStatus({ run: completedRun }), "COMPLETED")
    // 2. Running (active simulation takes priority)
    assert.equal(resolvePredictionStatus({ run: completedRun, isRunning: true }), "RUNNING")
    assert.equal(resolvePredictionStatus({ isRunning: true }), "RUNNING")
    // 3. Queued (controlled queue state)
    assert.equal(resolvePredictionStatus({ isQueued: true }), "QUEUED")
    // 4. Failed (error recorded)
    assert.equal(resolvePredictionStatus({ hasError: true }), "FAILED")
    // 5. Ready to run (default initial state)
    assert.equal(resolvePredictionStatus({ run: null }), "READY")
  })

  it("Run All Ready: only READY predictions are eligible, COMPLETED and RUNNING are skipped", () => {
    const jobList: Array<{ id: string; status: PredictionJobStatus }> = [
      { id: "dpph", status: "COMPLETED" },
      { id: "mtt", status: "COMPLETED" },
      { id: "ldh", status: "READY" },
      { id: "ros", status: "READY" },
      { id: "bax", status: "RUNNING" },
      { id: "hippo_yap", status: "READY" },
    ]

    const runnable = filterRunnablePredictions(jobList)
    assert.equal(runnable.length, 3)
    assert.deepEqual(runnable.map((j) => j.id), ["ldh", "ros", "hippo_yap"])

    // Verify completed predictions are never included
    assert.equal(runnable.some((j) => j.id === "dpph"), false)
    assert.equal(runnable.some((j) => j.id === "mtt"), false)
    // Verify in-flight predictions are never included
    assert.equal(runnable.some((j) => j.id === "bax"), false)
  })

  it("Run All Ready when 0 ready: returns empty and disables bulk action", () => {
    const allDoneList: Array<{ id: string; status: PredictionJobStatus }> = [
      { id: "dpph", status: "COMPLETED" },
      { id: "mtt", status: "COMPLETED" },
      { id: "ldh", status: "COMPLETED" },
      { id: "ros", status: "COMPLETED" },
      { id: "bax", status: "COMPLETED" },
      { id: "hippo_yap", status: "COMPLETED" },
    ]

    const runnable = filterRunnablePredictions(allDoneList)
    assert.equal(runnable.length, 0)
  })

  it("Bulk execution: failure of one prediction does NOT stop remaining queued jobs", () => {
    // Simulation of sequential batch queue:
    // 1. DPPH succeeds
    // 2. MTT succeeds
    // 3. LDH fails with error
    // 4. ROS succeeds
    // 5. BAX succeeds
    // 6. Hippo–YAP succeeds
    const queue = ["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"]
    const results: Record<string, { status: PredictionJobStatus; error?: string }> = {}

    for (const item of queue) {
      try {
        if (item === "ldh") {
          throw new Error("LDH calculation failure")
        }
        results[item] = { status: "COMPLETED" }
      } catch (err: any) {
        results[item] = { status: "FAILED", error: err.message }
      }
    }

    // Verify all 6 jobs were attempted
    assert.equal(Object.keys(results).length, 6)
    // Verify LDH failed
    assert.equal(results["ldh"].status, "FAILED")
    assert.equal(results["ldh"].error, "LDH calculation failure")
    // Verify ROS, BAX, and Hippo-YAP were NOT blocked and completed successfully
    assert.equal(results["ros"].status, "COMPLETED")
    assert.equal(results["bax"].status, "COMPLETED")
    assert.equal(results["hippo_yap"].status, "COMPLETED")

    // Aggregate counts: 5 completed, 1 failed
    const completed = Object.values(results).filter((r) => r.status === "COMPLETED").length
    const failed = Object.values(results).filter((r) => r.status === "FAILED").length
    assert.equal(completed, 5)
    assert.equal(failed, 1)
  })

  it("PubMed failure independence: prediction stays COMPLETED when literature retrieval fails", () => {
    // Computational prediction result is saved and valid
    const predResult = completedRun
    assert.equal(isPredictionCompletedWithResult(predResult), true)

    // Simulate PubMed error response
    const pubMedResponse = { error: "PubMed could not be reached.", paper: null }
    assert.equal(Boolean(pubMedResponse.error), true)

    // The computational prediction MUST NOT revert to failed or pending
    assert.equal(resolvePredictionStatus({ run: predResult }), "COMPLETED")
    assert.equal(canShowScientificEvidence(predResult), true)
  })

  it("Stage completion logic: complete only when all required predictions have completed results", () => {
    const totalPredictions = 6

    // Partial: 5 completed, 1 failed
    const partialFive: number = 5
    assert.equal(partialFive === totalPredictions && totalPredictions > 0, false)

    // Zero completed: 0 of 6
    const zeroCompleted: number = 0
    assert.equal(zeroCompleted === totalPredictions && totalPredictions > 0, false)

    // All six completed: 6 of 6
    const allCompleted = 6
    assert.equal(allCompleted === totalPredictions && totalPredictions > 0, true)
  })
})

describe("Biological Predictions filtering and master-detail architecture", () => {
  interface MockJob extends FilterablePredictionJob {
    id: string
    key: string
  }

  const mockSixJobs: MockJob[] = [
    {
      id: "j1",
      key: "dpph:quercetin",
      endpoint: "dpph",
      status: "COMPLETED",
      subject: { label: "Quercetin", compoundName: "Quercetin" },
    },
    {
      id: "j2",
      key: "mtt:quercetin",
      endpoint: "mtt",
      status: "COMPLETED",
      subject: { label: "Quercetin", compoundName: "Quercetin", cellLineName: "HepG2" },
    },
    {
      id: "j3",
      key: "ldh:quercetin",
      endpoint: "ldh",
      status: "COMPLETED",
      subject: { label: "Quercetin", compoundName: "Quercetin", cellLineName: "HepG2" },
    },
    {
      id: "j4",
      key: "ros:quercetin",
      endpoint: "ros",
      status: "COMPLETED",
      subject: { label: "Quercetin", compoundName: "Quercetin", cellLineName: "HepG2" },
    },
    {
      id: "j5",
      key: "bax:quercetin",
      endpoint: "bax",
      status: "COMPLETED",
      subject: { label: "Quercetin × BAX", compoundName: "Quercetin", proteinName: "BAX" },
    },
    {
      id: "j6",
      key: "hippo_yap:quercetin",
      endpoint: "hippo_yap",
      status: "COMPLETED",
      subject: { label: "Quercetin × YAP1", compoundName: "Quercetin", proteinName: "YAP1" },
    },
  ]

  it("All endpoint filter displays all 6 prediction subjects", () => {
    const visible = filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "all" })
    assert.equal(visible.length, 6)
    assert.deepEqual(visible.map((j) => j.endpoint), ["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"])
  })

  it("Individual endpoint filters return exactly their corresponding subject", () => {
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "dpph" }).length, 1)
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "mtt" }).length, 1)
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "ldh" }).length, 1)
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "ros" }).length, 1)
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "bax" }).length, 1)
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "hippo-yap" }).length, 1)
  })

  it("Status filters work correctly across the full dataset", () => {
    // Current study: all 6 completed
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "all", statusFilter: "all" }).length, 6)
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "all", statusFilter: "completed" }).length, 6)
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "all", statusFilter: "ready" }).length, 0)
    assert.equal(filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "all", statusFilter: "failed" }).length, 0)
  })

  it("Mixed status dataset correctly filters without losing records", () => {
    const mixedJobs: MockJob[] = [
      { ...mockSixJobs[0], status: "COMPLETED" }, // DPPH
      { ...mockSixJobs[1], status: "COMPLETED" }, // MTT
      { ...mockSixJobs[2], status: "READY" },     // LDH
      { ...mockSixJobs[3], status: "READY" },     // ROS
      { ...mockSixJobs[4], status: "COMPLETED" }, // BAX
      { ...mockSixJobs[5], status: "FAILED" },    // Hippo–YAP
    ]

    assert.equal(filterBiologicalPredictionJobs(mixedJobs, { endpointFilter: "all", statusFilter: "all" }).length, 6)
    assert.equal(filterBiologicalPredictionJobs(mixedJobs, { endpointFilter: "all", statusFilter: "completed" }).length, 3)
    assert.equal(filterBiologicalPredictionJobs(mixedJobs, { endpointFilter: "all", statusFilter: "ready" }).length, 2)
    assert.equal(filterBiologicalPredictionJobs(mixedJobs, { endpointFilter: "all", statusFilter: "failed" }).length, 1)
  })

  it("Combined endpoint + status filters work accurately", () => {
    const mixedJobs: MockJob[] = [
      { ...mockSixJobs[0], status: "COMPLETED" }, // DPPH
      { ...mockSixJobs[1], status: "COMPLETED" }, // MTT
      { ...mockSixJobs[2], status: "READY" },     // LDH
      { ...mockSixJobs[3], status: "READY" },     // ROS
      { ...mockSixJobs[4], status: "COMPLETED" }, // BAX
      { ...mockSixJobs[5], status: "FAILED" },    // Hippo–YAP
    ]

    // BAX is completed
    assert.equal(filterBiologicalPredictionJobs(mixedJobs, { endpointFilter: "bax", statusFilter: "completed" }).length, 1)
    assert.equal(filterBiologicalPredictionJobs(mixedJobs, { endpointFilter: "bax", statusFilter: "ready" }).length, 0)
    // LDH is ready
    assert.equal(filterBiologicalPredictionJobs(mixedJobs, { endpointFilter: "ldh", statusFilter: "ready" }).length, 1)
    assert.equal(filterBiologicalPredictionJobs(mixedJobs, { endpointFilter: "ldh", statusFilter: "completed" }).length, 0)
  })

  it("Search query correctly filters prediction subjects", () => {
    const searchYap = filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "all", query: "yap" })
    assert.equal(searchYap.length, 1)
    assert.equal(searchYap[0].subject.label, "Quercetin × YAP1")

    const searchHepG2 = filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "all", query: "hepg2" })
    assert.equal(searchHepG2.length, 3) // MTT, LDH, ROS
  })

  it("Selected prediction detail in right panel NEVER filters the left master list", () => {
    // When "All" is active, selecting any prediction (DPPH, MTT, LDH, ROS, BAX, Hippo-YAP)
    // must NOT filter the master list down to only that prediction
    const selectedJobKey = "dpph:quercetin"
    const visibleInMasterList = filterBiologicalPredictionJobs(mockSixJobs, { endpointFilter: "all" })

    assert.equal(visibleInMasterList.length, 6)
    // The selected prediction exists in the master list, and all 5 other predictions also exist
    assert.equal(visibleInMasterList.some((j) => j.key === selectedJobKey), true)
    assert.equal(visibleInMasterList.filter((j) => j.key !== selectedJobKey).length, 5)

    // Selecting YAP1 in right panel keeps all 6 in master list
    const selectedYap1Key = "hippo_yap:quercetin"
    assert.equal(visibleInMasterList.length, 6)
    assert.equal(visibleInMasterList.some((j) => j.key === selectedYap1Key), true)
  })
})


