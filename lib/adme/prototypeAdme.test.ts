import assert from "node:assert/strict"
import test from "node:test"
import { lookupPrototypeAdme } from "@/data/prototype-adme"
import {
  PROTOTYPE_ADME_HEADLINE,
  PROTOTYPE_ADME_NOTICE,
  PROTOTYPE_ADME_PROVIDER,
  PROTOTYPE_ADME_SUBTITLE,
  prototypeAdmeService,
} from "@/lib/adme/assessmentService"
import { isCompletedScreeningRun, isPrototypeAdmeRun } from "@/lib/adme/service"
import type { AdmetRun } from "@/lib/domain/models"

test("prototype ADME resolves the catalog compound and stays deterministic", async () => {
  const byId = lookupPrototypeAdme({ compoundId: "quercetin" })
  const byCid = lookupPrototypeAdme({ compoundId: "study-compound", pubchemCid: 5280343 })
  const bySmiles = lookupPrototypeAdme({
    compoundId: "study-compound",
    smiles: "C1=CC(=C(C=C1C2=C(C(=O)C3=C(C=C(C=C3O2)O)O)O)O)O",
  })
  assert.equal(byId?.descriptors.giAbsorption, "High")
  assert.equal(byCid?.descriptors.giAbsorption, byId?.descriptors.giAbsorption)
  assert.equal(bySmiles?.descriptors.cyp3a4Inhibitor, "Yes")

  const first = await prototypeAdmeService.assess({ compoundId: "ignored", pubchemCid: 5280343 })
  const second = await prototypeAdmeService.assess({ compoundId: "ignored", pubchemCid: 5280343 })
  assert.deepEqual(first, second)
  assert.equal(first?.kind, "prototype")
  assert.equal(first?.headline, PROTOTYPE_ADME_HEADLINE)
  assert.equal(first?.subtitle, PROTOTYPE_ADME_SUBTITLE)
  assert.equal(first?.notice, PROTOTYPE_ADME_NOTICE)
  assert.equal(first?.provider, PROTOTYPE_ADME_PROVIDER)
  assert.equal(first?.descriptors.giAbsorption, "High")
})

test("a compound outside the prototype set is left unavailable", async () => {
  assert.equal(lookupPrototypeAdme({ compoundId: "unknown", pubchemCid: 1, smiles: "CCO" }), undefined)
  assert.equal(await prototypeAdmeService.assess({ compoundId: "unknown", pubchemCid: 1, smiles: "CCO" }), null)
})

test("a saved prototype assessment can complete screening without claiming ADMET-AI", () => {
  const run: AdmetRun = {
    id: "run-1",
    studyId: "study",
    compoundId: "compound-1",
    provider: PROTOTYPE_ADME_PROVIDER,
    toolName: PROTOTYPE_ADME_PROVIDER,
    pubchemRetrieved: true,
    lipinskiOverall: "pass",
    descriptors: { giAbsorption: "High" },
    status: "final",
    provenance: {
      evidenceClass: "SIMULATION",
      source: PROTOTYPE_ADME_PROVIDER,
      limitations: PROTOTYPE_ADME_NOTICE,
    },
    createdAt: "2026-10-06T00:00:00.000Z",
    updatedAt: "2026-10-06T00:00:00.000Z",
    createdBy: "user",
    updatedBy: "user",
  }
  assert.equal(isPrototypeAdmeRun(run), true)
  assert.equal(isCompletedScreeningRun(run), true)
  assert.notEqual(run.provider, "ADMET-AI")
})
