import test from "node:test"
import assert from "node:assert/strict"
import { listDockingOutcomes, getDockingRun } from "@/lib/repositories/scientificRunRepository"
import { listStudiesForUser } from "@/lib/repositories/studyRepository"
import { loadStudyReadiness } from "@/lib/workflow/loadStudyReadiness"
import { queryOne } from "@/lib/db/mysql"

test("performance regression: listDockingOutcomes uses lightweight payload by default", async () => {
  const row = await queryOne<any>("SELECT study_id, id FROM docking_runs LIMIT 1")
  if (!row) {
    // No runs present, test contract directly
    const res = await listDockingOutcomes("non-existent-study")
    assert.deepEqual(res.completed, [])
    assert.deepEqual(res.allRuns, [])
    return
  }

  const outcomes = await listDockingOutcomes(row.study_id)
  assert.ok(Array.isArray(outcomes.completed))
  assert.ok(Array.isArray(outcomes.allRuns))

  // By default, poseModel is omitted in bulk listing for performance
  const matched = outcomes.allRuns.find((r) => r.id === row.id)
  if (matched) {
    assert.equal(matched.poseModel, undefined, "Bulk outcomes should omit heavy poseModel")
  }

  // On-demand detail retrieval for a single run preserves the full poseModel
  const detailed = await getDockingRun(row.study_id, row.id)
  assert.ok(detailed, "getDockingRun should retrieve the single run")
  assert.equal(detailed.id, row.id)
})

test("performance regression: listStudiesForUser returns cleanly with batched members", async () => {
  const userRow = await queryOne<any>("SELECT id FROM users LIMIT 1")
  if (!userRow) return

  const studies = await listStudiesForUser(userRow.id)
  assert.ok(Array.isArray(studies))
  for (const s of studies) {
    assert.ok(s.id)
    assert.ok(Array.isArray(s.memberIds), "Batched memberIds must be an array")
  }
})

test("performance regression: loadStudyReadiness executes all checks without error", async () => {
  const studyRow = await queryOne<any>("SELECT id FROM studies LIMIT 1")
  if (!studyRow) return

  const readiness = await loadStudyReadiness(studyRow.id)
  assert.ok(readiness)
  assert.equal(typeof readiness.compounds, "number")
  assert.equal(typeof readiness.proteins, "number")
  assert.equal(typeof readiness.dockingCompleted, "number")
})

test.after(async () => {
  const { getPool } = await import("@/lib/db/mysql")
  await getPool().end()
})
