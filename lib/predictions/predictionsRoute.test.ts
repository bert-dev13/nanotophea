import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { postScientificPredictions } from "@/lib/predictions/predictionsRoute"
import type { PredictionFeatures } from "@/lib/predictions/types"

const features: PredictionFeatures = {
  studyId: "study-1",
  phytochemicalId: "c1",
  phytochemicalName: "Quercetin",
  cellLineId: "hepg2",
  cellLineName: "HepG2",
  targetProteinIds: ["bax-1"],
  docking: [],
  admeDescriptors: {},
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/scientific/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("actual Predictions API route boundary", () => {
  it("returns 401 when session is missing", async () => {
    const response = await postScientificPredictions(request({
      studyId: "study-1",
      endpoint: "dpph",
      features,
      mode: "exploratory_simulation",
      acknowledgeExploratory: true,
    }), {
      getSessionUser: async () => null,
      loadStudyAccess: async () => ({ ownerId: "owner-1", memberIds: [] }),
    })
    assert.equal(response.status, 401)
    const body = await response.json()
    assert.match(String(body.error), /Sign in/i)
  })

  it("returns 403 when authenticated user lacks study access", async () => {
    const response = await postScientificPredictions(request({
      studyId: "study-1",
      endpoint: "mtt",
      features,
      mode: "exploratory_simulation",
      acknowledgeExploratory: true,
      actorId: "owner-1",
    }), {
      getSessionUser: async () => ({ id: "intruder" }),
      loadStudyAccess: async () => ({ ownerId: "owner-1", memberIds: ["member-1"] }),
    })
    assert.equal(response.status, 403)
  })

  it("returns 400 when exploratory acknowledgement is missing", async () => {
    const response = await postScientificPredictions(request({
      studyId: "study-1",
      endpoint: "ldh",
      features,
      mode: "exploratory_simulation",
    }), {
      getSessionUser: async () => ({ id: "owner-1" }),
      loadStudyAccess: async () => ({ ownerId: "owner-1", memberIds: [] }),
    })
    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.status, "acknowledgement_required")
  })

  it("returns 200 SIMULATION and server-stamped acknowledgement for authorized exploratory runs", async () => {
    const response = await postScientificPredictions(request({
      studyId: "study-1",
      endpoint: "dpph",
      features,
      mode: "exploratory_simulation",
      acknowledgeExploratory: true,
      actorId: "spoofed",
      acknowledgedBy: "spoofed",
    }), {
      getSessionUser: async () => ({ id: "owner-1" }),
      loadStudyAccess: async () => ({ ownerId: "owner-1", memberIds: [] }),
    })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.evidenceClass, "SIMULATION")
    assert.equal(body.acknowledgement.acknowledgedBy, "owner-1")
    assert.equal(body.acknowledgedByServer, "owner-1")
    assert.notEqual(body.acknowledgement.acknowledgedBy, "spoofed")
  })

  it("returns 404 not_configured for validated mode without falling back to prototype", async () => {
    const response = await postScientificPredictions(request({
      studyId: "study-1",
      endpoint: "ros",
      features,
      mode: "validated",
    }), {
      getSessionUser: async () => ({ id: "owner-1" }),
      loadStudyAccess: async () => ({ ownerId: "owner-1", memberIds: [] }),
    })
    assert.equal(response.status, 404)
    const body = await response.json()
    assert.equal(body.status, "not_configured")
    assert.equal(body.outputs, undefined)
    assert.equal(body.series, undefined)
    assert.equal(body.acknowledgement, undefined)
  })

  it("does not expose SQL-like private error details from access loading failures", async () => {
    const response = await postScientificPredictions(request({
      studyId: "study-1",
      endpoint: "bax",
      features,
      mode: "exploratory_simulation",
      acknowledgeExploratory: true,
    }), {
      getSessionUser: async () => ({ id: "owner-1" }),
      loadStudyAccess: async () => {
        throw new Error("ECONNREFUSED mysql password=secret")
      },
    })
    assert.equal(response.status, 403)
    const body = await response.json()
    assert.doesNotMatch(JSON.stringify(body), /password=secret|ECONNREFUSED/i)
  })
})
