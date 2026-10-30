import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DOCKING_SKIP_REASON, SkippedDockingPairSchema } from "@/lib/domain/models"
import { dockingPairResolved, dockingPairStatus } from "@/lib/docking/pairStatus"

describe("docking pair status", () => {
  it("resolves only completed and skipped pairs", () => {
    assert.equal(dockingPairResolved("COMPLETED"), true)
    assert.equal(dockingPairResolved("SKIPPED"), true)
    assert.equal(dockingPairResolved("FAILED"), false)
    assert.equal(dockingPairResolved("UNAVAILABLE"), false)
    assert.equal(dockingPairResolved("PENDING"), false)
    assert.equal(dockingPairResolved("RUNNING"), false)
  })

  it("keeps an unsupported target unavailable until the researcher skips it", () => {
    assert.equal(dockingPairStatus({ completed: false, skipped: false, profileReady: false }), "UNAVAILABLE")
    assert.equal(dockingPairStatus({ completed: false, skipped: true, profileReady: false }), "SKIPPED")
    assert.equal(dockingPairStatus({ completed: true, skipped: false, profileReady: true }), "COMPLETED")
    assert.equal(
      dockingPairStatus({ completed: false, skipped: false, profileReady: true, jobStatus: "running" }),
      "RUNNING",
    )
    assert.equal(
      dockingPairStatus({ completed: false, skipped: false, profileReady: true, jobStatus: "failed" }),
      "FAILED",
    )
  })

  it("stores a skip with a null affinity and without a predicted classification", () => {
    const record = SkippedDockingPairSchema.parse({
      id: "skip-1",
      studyId: "study-1",
      compoundId: "compound-1",
      compoundName: "Quercetin",
      proteinId: "protein-1",
      targetId: "protein-1",
      targetName: "BAX",
      runName: "Quercetin × BAX",
      status: "SKIPPED",
      dockingStatus: "SKIPPED",
      bindingAffinity: null,
      bestBindingAffinityKcalMol: null,
      reason: DOCKING_SKIP_REASON,
      createdAt: "2026-10-08T00:00:00.000Z",
      updatedAt: "2026-10-08T00:00:00.000Z",
      createdBy: "researcher",
      updatedBy: "researcher",
    })
    assert.equal(record.bindingAffinity, null)
    assert.equal(record.bestBindingAffinityKcalMol, null)
    assert.equal(record.reason, "AutoDock Vina docking profile unavailable")
    assert.equal("provenance" in record, false)
    assert.equal("evidenceClass" in record, false)
  })
})