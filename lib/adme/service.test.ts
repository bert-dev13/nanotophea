import assert from "node:assert/strict"
import test from "node:test"
import { AdmePredictionError } from "./errors"
import { buildStoredAdmeRun, isCompletedScreeningRun, planAdmeWork, predictPlannedAdme, screenedCompoundIds, type ResolvedCompound } from "./service"
import { ADME_ASSESSMENT_FAILED, ADME_METHOD_LABEL, ADME_MODEL_NAME, ADME_NO_CID, ADME_PROTOCOL_NOTE, ADME_PROVIDER_NAME, type AdmeProvider } from "./types"
import { toAdmeResult } from "./normalize"

const engine = {
  name: ADME_PROVIDER_NAME,
  version: "2.0.0",
  method: ADME_METHOD_LABEL,
  model: ADME_MODEL_NAME,
}

function compound(partial: Partial<ResolvedCompound> = {}): ResolvedCompound {
  return {
    compoundId: "quercetin",
    compoundName: "Quercetin",
    pubchemCid: 5280343,
    smiles: "C1=CC(=C(C=C1)O)O",
    pubchemRetrieved: true,
    lipinskiOverall: "pass",
    ...partial,
  }
}

function provider(values: Record<string, number>): AdmeProvider {
  return {
    ...engine,
    async predict(input) {
      const result = toAdmeResult(input, values, engine)
      if (!result) throw new AdmePredictionError("assessment_failed")
      return result
    },
  }
}

test("a matching saved result is reused and a changed structure is not", async () => {
  const model = provider({ HIA_Hou: 0.91, BBB_Martins: 0.2 })
  const first = await predictPlannedAdme({
    plan: planAdmeWork([compound()], [], engine),
    provider: model,
    studyId: "study",
    actorId: "user",
    now: "2026-10-03T00:00:00.000Z",
    existing: [],
    nextId: () => "run-1",
  })
  assert.equal(first.records.length, 1)
  assert.equal(first.records[0]?.provenance.evidenceClass, "PREDICTED")
  assert.equal(first.records[0]?.provider, "ADMET-AI")
  assert.match(first.records[0]?.provenance.limitations ?? "", /SwissADME/)
  assert.match(ADME_PROTOCOL_NOTE, /not SwissADME results/)
  assert.equal(first.records[0]?.descriptors.giAbsorption, "Absorbed (0.91)")
  assert.equal("lipinski" in (first.records[0]?.descriptors ?? {}), false)

  const cached = planAdmeWork([compound()], first.records, engine)
  assert.equal(cached.pending.length, 0)
  assert.equal(cached.cached.length, 1)

  const changed = planAdmeWork([compound({ smiles: "CCO" })], first.records, engine)
  assert.equal(changed.pending.length, 1)
  assert.equal(changed.cached.length, 0)

  const upgraded = planAdmeWork([compound()], first.records, { ...engine, version: "2.1.0" })
  assert.equal(upgraded.pending.length, 1)
})

test("missing identity and a failed model do not create an assessment", async () => {
  const missing = planAdmeWork([compound({ pubchemCid: undefined, smiles: undefined })], [], engine)
  assert.deepEqual(missing.errors, [{ compoundId: "quercetin", message: ADME_NO_CID }])
  assert.equal(missing.pending.length, 0)

  const failed = await predictPlannedAdme({
    plan: planAdmeWork([compound(), compound({ compoundId: "rutin", compoundName: "Rutin", pubchemCid: 5280805 })], [], engine),
    provider: {
      ...engine,
      async predict() {
        throw new AdmePredictionError("assessment_failed")
      },
    },
    studyId: "study",
    actorId: "user",
    now: "2026-10-03T00:00:00.000Z",
    existing: [],
    nextId: () => "run-2",
  })
  assert.equal(failed.records.length, 0)
  assert.equal(failed.errors.every((error) => error.message === ADME_ASSESSMENT_FAILED), true)
})

test("screening completion counts PubChem, drug-likeness, and ADME together", async () => {
  const saved = buildStoredAdmeRun({
    id: "run-1",
    studyId: "study",
    actorId: "user",
    compound: compound(),
    result: toAdmeResult({ compoundId: "quercetin", smiles: "C1=CC(=C(C=C1)O)O", pubchemCid: 5280343 }, { HIA_Hou: 0.4 }, engine)!,
    now: "2026-10-03T00:00:00.000Z",
  })
  assert.equal(saved.assessmentOrigin, "calculated")
  assert.equal(isCompletedScreeningRun(saved), true)
  const incomplete = { ...saved, lipinskiOverall: "incomplete" as const }
  assert.equal(isCompletedScreeningRun(incomplete), false)
  assert.deepEqual(screenedCompoundIds(["quercetin", "rutin"], [saved]), ["quercetin"])
})

test("a manual SwissADME record is not reused as the automatic assessment", () => {
  const manual = buildStoredAdmeRun({
    id: "manual",
    studyId: "study",
    actorId: "user",
    compound: compound(),
    result: toAdmeResult({ compoundId: "quercetin", smiles: "C1=CC(=C(C=C1)O)O", pubchemCid: 5280343 }, { HIA_Hou: 0.2 }, engine)!,
    now: "2026-10-03T00:00:00.000Z",
  })
  manual.provider = "SwissADME"
  manual.toolName = "SwissADME"
  const plan = planAdmeWork([compound()], [manual], engine)
  assert.equal(plan.cached.length, 0)
  assert.equal(plan.pending.length, 1)
})
