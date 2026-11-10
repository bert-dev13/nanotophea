import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertAcknowledgementActorIsServer,
  bindAcknowledgementSimulationRunId,
  EXPLORATORY_ACKNOWLEDGEMENT_VERSION,
  readAcknowledgementFromParameters,
  stampExploratoryAcknowledgement,
} from "@/lib/predictions/acknowledgement"
import { storedSimulationFromPrototype } from "@/lib/predictions/store"
import { simulateDpph } from "@/lib/predictions/prototype/dpph"
import type { PredictionFeatures } from "@/lib/predictions/types"

const features: PredictionFeatures = {
  studyId: "study-1",
  phytochemicalId: "c1",
  phytochemicalName: "Quercetin",
  targetProteinIds: [],
  docking: [],
  admeDescriptors: {},
}

describe("acknowledgement persistence consistency", () => {
  it("stamps server actor/time/version and rejects spoofed actors", () => {
    const ack = stampExploratoryAcknowledgement({
      endpoint: "dpph",
      actorId: "session-user",
      acknowledgedAt: "2026-11-11T00:00:00.000Z",
    })
    assert.equal(ack.acknowledgedBy, "session-user")
    assert.equal(ack.acknowledgementVersion, EXPLORATORY_ACKNOWLEDGEMENT_VERSION)
    assert.equal(ack.acknowledgedAt, "2026-11-11T00:00:00.000Z")
    assert.throws(() => assertAcknowledgementActorIsServer(ack, "other-user"))
    assert.doesNotThrow(() => assertAcknowledgementActorIsServer(ack, "session-user"))
  })

  it("binds meta:simulationRunId to the actual persisted run id", () => {
    const ack = stampExploratoryAcknowledgement({ endpoint: "dpph", actorId: "session-user" })
    const stored = storedSimulationFromPrototype(simulateDpph(features), features, { acknowledgement: ack })
    const before = readAcknowledgementFromParameters(stored.inputParameters)
    assert.equal(before.present, true)
    assert.equal(before.simulationRunId, undefined)

    const bound = bindAcknowledgementSimulationRunId(stored.inputParameters, "run-abc-123")
    const after = readAcknowledgementFromParameters(bound)
    assert.equal(after.simulationRunId, "run-abc-123")
    assert.equal(after.acknowledgedBy, "session-user")
  })

  it("distinguishes historical missing consent from newly acknowledged runs", () => {
    const historical = readAcknowledgementFromParameters({
      "meta:evidenceClass": "SIMULATION",
      "output:TEAC": 0.9,
    })
    assert.equal(historical.present, false)
    assert.equal(historical.historicalMissingConsent, true)

    const ack = stampExploratoryAcknowledgement({ endpoint: "dpph", actorId: "u1" })
    const stored = storedSimulationFromPrototype(simulateDpph(features), features, { acknowledgement: ack })
    const current = readAcknowledgementFromParameters(stored.inputParameters)
    assert.equal(current.present, true)
    assert.equal(current.historicalMissingConsent, false)
  })

  it("does not invent acknowledgement metadata when acknowledgement is omitted", () => {
    const stored = storedSimulationFromPrototype(simulateDpph(features), features)
    const meta = readAcknowledgementFromParameters(stored.inputParameters)
    assert.equal(meta.present, false)
    assert.equal(stored.inputParameters?.["meta:acknowledgedExploratory"], undefined)
  })
})
