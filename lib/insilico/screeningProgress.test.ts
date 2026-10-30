import assert from "node:assert/strict"
import test from "node:test"
import { screeningComponentStatus } from "./screeningProgress"

test("screening progress counts the three automatic components", () => {
  const running = screeningComponentStatus({
    pubchem: "ready",
    likeness: "ready",
    likenessLabel: "Passes Lipinski screening",
    adme: "running",
  })
  assert.equal(running.complete, 2)
  assert.equal(running.total, 3)
  assert.equal(running.lines[0]?.text, "PubChem molecular properties retrieved")
  assert.equal(running.lines[1]?.text, "Passes Lipinski screening")
  assert.equal(running.lines[2]?.text, "Assessment running")

  const done = screeningComponentStatus({
    pubchem: "ready",
    likeness: "ready",
    likenessLabel: "Passes Lipinski screening",
    adme: "ready",
    admeProvider: "ADMET-AI",
  })
  assert.equal(done.complete, 3)
  assert.equal(done.lines[2]?.text, "Assessment completed")
  assert.equal(done.lines[2]?.detail, undefined)

  const failed = screeningComponentStatus({
    pubchem: "missing",
    likeness: "missing",
    adme: "failed",
  })
  assert.equal(failed.complete, 0)
  assert.equal(failed.lines[2]?.text, "ADME assessment could not be completed.")
})
