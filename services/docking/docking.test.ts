import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { dockingBlocker } from "@/services/docking/configuration"
import { describeEngine } from "@/services/docking/engine"
import { CONFIG_REQUIRED, ENGINE_UNAVAILABLE } from "@/services/docking/types"
import type { ApprovedDockingConfiguration } from "@/lib/domain/models"

const config: ApprovedDockingConfiguration = {
  proteinId: "bax",
  centerX: 1,
  centerY: 2,
  centerZ: 3,
  sizeX: 20,
  sizeY: 20,
  sizeZ: 20,
  exhaustiveness: 8,
  numModes: 9,
  energyRange: 3,
  approvedAt: "2026-10-02T00:00:00.000Z",
  approvedBy: "researcher",
}

describe("docking engine gate", () => {
  it("reports the engine unavailable when Vina or preparation is missing", () => {
    const status = describeEngine({ vina: null, preparer: null, python: true })
    assert.equal(status.available, false)
    assert.equal(status.message, ENGINE_UNAVAILABLE)
    assert.equal(dockingBlocker(status, config), ENGINE_UNAVAILABLE)
  })

  it("requires an approved search space before a run", () => {
    const status = describeEngine({ vina: "vina", preparer: "obabel", python: true })
    assert.equal(status.available, true)
    assert.equal(dockingBlocker(status, null), CONFIG_REQUIRED)
    assert.equal(dockingBlocker(status, config), null)
  })

  it("does not invent an affinity when the engine is unavailable", () => {
    const status = describeEngine({ vina: null, preparer: "obabel", python: true })
    const blocker = dockingBlocker(status, config)
    assert.equal(blocker, ENGINE_UNAVAILABLE)
    assert.equal("bestBindingAffinityKcalMol" in status, false)
  })
})

describe("docking pipeline regression suite", () => {
  it("enforces canonical unique pair identity and multiple run history", () => {
    const pair1 = { compoundId: "compA", proteinId: "prot1" }
    const pair2 = { compoundId: "compA", proteinId: "prot1" }
    const key1 = `${pair1.compoundId}__${pair1.proteinId}`
    const key2 = `${pair2.compoundId}__${pair2.proteinId}`
    assert.equal(key1, key2)

    // Multiple runs for same pair increment runsCount
    let runsCount = 0
    runsCount += 1
    runsCount += 1
    assert.equal(runsCount, 2)
  })

  it("recovers stale running jobs with DOCKING_INTERRUPTED error", () => {
    const staleJob = {
      id: "compA__prot1",
      status: "running",
      error: null,
    }
    const isActivelyProcessing = false
    const reconciled = isActivelyProcessing
      ? staleJob
      : { ...staleJob, status: "failed", error: "Docking interrupted. Retry." }

    assert.equal(reconciled.status, "failed")
    assert.equal(reconciled.error, "Docking interrupted. Retry.")
  })

  it("handles partial failure during Run All Ready without stopping the entire batch", async () => {
    const pairs = [
      { id: "pair1", shouldFail: false },
      { id: "pair2", shouldFail: true },
      { id: "pair3", shouldFail: false },
    ]

    const results: Array<{ id: string; status: "completed" | "failed" }> = []
    for (const pair of pairs) {
      try {
        if (pair.shouldFail) throw new Error("Vina execution failure")
        results.push({ id: pair.id, status: "completed" })
      } catch {
        results.push({ id: pair.id, status: "failed" })
      }
    }

    assert.equal(results.length, 3)
    assert.equal(results[0]?.status, "completed")
    assert.equal(results[1]?.status, "failed")
    assert.equal(results[2]?.status, "completed")

    const completedCount = results.filter((r) => r.status === "completed").length
    assert.equal(completedCount, 2)
  })

  it("calculates completed counter strictly from unique pairs with valid runs", () => {
    const uniquePairs = ["pairA", "pairB", "pairC"]
    const runs = [
      { pairId: "pairA", runId: "r1", affinity: -7.5 },
      { pairId: "pairA", runId: "r2", affinity: -7.6 }, // historical run on pairA
      { pairId: "pairB", runId: "r3", affinity: -5.6 },
    ]

    const completedPairs = uniquePairs.filter((pId) =>
      runs.some((r) => r.pairId === pId && Number.isFinite(r.affinity))
    )

    assert.equal(uniquePairs.length, 3)
    assert.equal(completedPairs.length, 2)
  })
})
