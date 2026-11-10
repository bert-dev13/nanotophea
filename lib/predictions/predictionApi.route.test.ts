import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { studyAccessAllowed } from "@/lib/ai/access"
import {
  EXPLORATORY_ACKNOWLEDGEMENT_VERSION,
  readAcknowledgementFromParameters,
  type ExploratoryAcknowledgementRecord,
} from "@/lib/predictions/acknowledgement"
import { handlePredictionRequest } from "@/lib/predictions/predictionRequest"
import { ENDPOINT_SPECS } from "@/lib/predictions/engine"
import { storedSimulationFromPrototype } from "@/lib/predictions/store"
import type { PredictionFeatures } from "@/lib/predictions/types"
import type { PrototypePredictionResult } from "@/lib/predictions/prototype/types"

const features: PredictionFeatures = {
  studyId: "study-1",
  phytochemicalId: "c1",
  phytochemicalName: "Quercetin",
  cellLineId: "hepg2",
  cellLineName: "HepG2",
  targetProteinIds: ["bax-1"],
  docking: [{ proteinId: "bax-1", proteinName: "BAX", affinityKcalMol: -7.2 }],
  admeDescriptors: {},
}

const ownerAccess = { ownerId: "owner-1", memberIds: ["member-1"] }

describe("predictions API route contract", () => {
  it("rejects unauthenticated requests", () => {
    const result = handlePredictionRequest({
      body: {
        studyId: "study-1",
        endpoint: "dpph",
        features,
        mode: "exploratory_simulation",
        acknowledgeExploratory: true,
      },
      actor: null,
      studyAccess: ownerAccess,
      studyAccessAllowed,
    })
    assert.equal(result.httpStatus, 401)
  })

  it("rejects exploratory requests without acknowledgement", () => {
    const result = handlePredictionRequest({
      body: {
        studyId: "study-1",
        endpoint: "mtt",
        features,
        mode: "exploratory_simulation",
        acknowledgeExploratory: false,
      },
      actor: { id: "owner-1" },
      studyAccess: ownerAccess,
      studyAccessAllowed,
    })
    assert.equal(result.httpStatus, 400)
    assert.equal(result.body.status, "acknowledgement_required")
    assert.equal(result.body.evidenceClass, "SIMULATION")
  })

  it("rejects unauthorized study access for exploratory mode", () => {
    const result = handlePredictionRequest({
      body: {
        studyId: "study-1",
        endpoint: "ldh",
        features,
        mode: "exploratory_simulation",
        acknowledgeExploratory: true,
        actorId: "owner-1",
      },
      actor: { id: "intruder" },
      studyAccess: ownerAccess,
      studyAccessAllowed,
    })
    assert.equal(result.httpStatus, 403)
  })

  it("ignores client-supplied actor IDs and stamps the session actor", () => {
    const result = handlePredictionRequest({
      body: {
        studyId: "study-1",
        endpoint: "ros",
        features,
        mode: "exploratory_simulation",
        acknowledgeExploratory: true,
        actorId: "spoofed-user",
        acknowledgedBy: "spoofed-user",
      },
      actor: { id: "owner-1" },
      studyAccess: ownerAccess,
      studyAccessAllowed,
    })
    assert.equal(result.httpStatus, 200)
    assert.equal(result.body.evidenceClass, "SIMULATION")
    assert.equal((result.body.acknowledgement as { acknowledgedBy: string }).acknowledgedBy, "owner-1")
    assert.equal(result.body.acknowledgedByServer, "owner-1")
    assert.notEqual((result.body.acknowledgement as { acknowledgedBy: string }).acknowledgedBy, "spoofed-user")
  })

  it("succeeds for authorized exploratory acknowledgement and persists audit metadata", () => {
    const result = handlePredictionRequest({
      body: {
        studyId: "study-1",
        endpoint: "dpph",
        features,
        mode: "exploratory_simulation",
        acknowledgeExploratory: true,
      },
      actor: { id: "member-1" },
      studyAccess: ownerAccess,
      studyAccessAllowed,
    })
    assert.equal(result.httpStatus, 200)
    assert.equal(result.body.status, "ok")
    assert.equal(result.body.evidenceClass, "SIMULATION")
    assert.equal(result.body.method, "Exploratory simulation")

    const acknowledgement = result.body.acknowledgement as ExploratoryAcknowledgementRecord
    assert.equal(acknowledgement.acknowledgedExploratory, true)
    assert.equal(acknowledgement.acknowledgedBy, "member-1")
    assert.equal(acknowledgement.acknowledgementVersion, EXPLORATORY_ACKNOWLEDGEMENT_VERSION)
    assert.equal(acknowledgement.endpoint, "dpph")
    assert.ok(acknowledgement.acknowledgedAt)
    assert.ok(acknowledgement.acknowledgementText)

    const simulation = result.body as unknown as PrototypePredictionResult
    const stored = storedSimulationFromPrototype(simulation, features, { acknowledgement })
    assert.equal(stored.provenance.evidenceClass, "SIMULATION")
    assert.equal(stored.methodType, "exploratory_math")
    const ackMeta = readAcknowledgementFromParameters(stored.inputParameters)
    assert.equal(ackMeta.present, true)
    assert.equal(ackMeta.historicalMissingConsent, false)
    assert.equal(ackMeta.acknowledgedBy, "member-1")
  })

  it("returns not_configured for validated mode and never falls back to prototype", () => {
    const result = handlePredictionRequest({
      body: {
        studyId: "study-1",
        endpoint: "bax",
        features,
        mode: "validated",
      },
      actor: { id: "owner-1" },
      studyAccess: ownerAccess,
      studyAccessAllowed,
    })
    assert.equal(result.httpStatus, 404)
    assert.equal(result.body.status, "not_configured")
    assert.equal(result.body.evidenceClass, "PREDICTED")
    assert.equal(result.body.hasValidatedModel, false)
    assert.equal(result.body.outputs, undefined)
    assert.equal(result.body.series, undefined)
    assert.equal(result.body.acknowledgement, undefined)
  })

  it("default mode is validated (no silent exploratory)", () => {
    const result = handlePredictionRequest({
      body: {
        studyId: "study-1",
        endpoint: "hippo_yap",
        features,
      },
      actor: { id: "owner-1" },
      studyAccess: ownerAccess,
      studyAccessAllowed,
    })
    assert.equal(result.httpStatus, 404)
    assert.equal(result.body.status, "not_configured")
  })
})

describe("endpoint specifications alignment", () => {
  it("does not advertise obsolete BAX / MTT / LDH / DPPH claims", () => {
    assert.ok(!ENDPOINT_SPECS.bax.outputLabels.some((label) => /BCL-2|Caspase|viable|apoptotic|Necrotic/i.test(label)))
    assert.ok(!ENDPOINT_SPECS.mtt.outputLabels.some((label) => /Selectivity/i.test(label)))
    assert.ok(!ENDPOINT_SPECS.ldh.outputLabels.some((label) => /OD|absorbance/i.test(label)))
    assert.ok(!ENDPOINT_SPECS.dpph.outputLabels.some((label) => /^TEAC$/i.test(label) || label === "IC50"))
    assert.match(ENDPOINT_SPECS.hippo_yap.context, /proxies/i)
    assert.match(ENDPOINT_SPECS.bax.context, /exploratory/i)
  })
})
