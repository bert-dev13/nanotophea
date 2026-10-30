import assert from "node:assert/strict"
import test from "node:test"
import { ADME_ENDPOINTS, normalizeAdmeValues, toAdmeResult } from "./normalize"
import { ADME_METHOD_LABEL, ADME_PROVIDER_NAME } from "./types"

test("normalization keeps only endpoints the model returned", () => {
  const normalized = normalizeAdmeValues({
    HIA_Hou: 0.91,
    Pgp_Broccatelli: 0.2,
    BBB_Martins: 0.14,
    CYP3A4_Veith: 0.8,
    CYP1A2_Veith: Number.NaN,
    Solubility_AqSolDB: -3.456,
  })
  assert.ok(normalized)
  assert.equal(normalized.descriptors.giAbsorption, "Absorbed (0.91)")
  assert.equal(normalized.descriptors.pgpInhibition, "No (0.20)")
  assert.equal(normalized.descriptors.bbbPermeability, "No (0.14)")
  assert.equal(normalized.descriptors.cyp3a4Inhibitor, "Yes (0.80)")
  assert.equal(normalized.descriptors.aqueousSolubility, "-3.46 log(mol/L)")
  assert.equal(normalized.descriptors.cyp1a2Inhibitor, undefined)
  assert.equal("cyp2d6Inhibitor" in normalized.descriptors, false)
})

test("Lipinski and other physicochemical fields are not presented as ADME", () => {
  const normalized = normalizeAdmeValues({
    molecular_weight: 302.24,
    logP: 1.5,
    Lipinski: 0,
    QED: 0.55,
    tpsa: 131.36,
    HIA_Hou: 0.5,
  })
  assert.ok(normalized)
  assert.equal(normalized.descriptors.giAbsorption, "Absorbed (0.50)")
  assert.deepEqual(Object.keys(normalized.descriptors), ["giAbsorption"])
  assert.equal(normalized.raw.Lipinski, 0)
  assert.equal(normalized.raw.molecular_weight, 302.24)
})

test("a physicochemical-only payload is not an ADME result", () => {
  assert.equal(normalizeAdmeValues({ Lipinski: 0, molecular_weight: 180 }), null)
  assert.equal(toAdmeResult(
    { compoundId: "rutin", smiles: "C" },
    { Lipinski: 1 },
    { name: ADME_PROVIDER_NAME, version: "2.0.0", method: ADME_METHOD_LABEL },
  ), null)
})

test("classification probabilities outside 0 to 1 are dropped", () => {
  const normalized = normalizeAdmeValues({ HIA_Hou: 1.2, BBB_Martins: -0.01, CYP2D6_Veith: 0.494 })
  assert.ok(normalized)
  assert.equal(normalized.descriptors.giAbsorption, undefined)
  assert.equal(normalized.descriptors.bbbPermeability, undefined)
  assert.equal(normalized.descriptors.cyp2d6Inhibitor, "No (0.49)")
})

test("the result names ADMET-AI and not SwissADME", () => {
  const result = toAdmeResult(
    { compoundId: "luteolin", smiles: "O=C1", pubchemCid: 5280445 },
    { HIA_Hou: 0.77 },
    { name: ADME_PROVIDER_NAME, version: "2.0.0", method: ADME_METHOD_LABEL },
  )
  assert.ok(result)
  assert.equal(result.provider, "ADMET-AI")
  assert.equal(result.evidenceClass, "PREDICTED")
  assert.equal(result.provider.includes("Swiss"), false)
  assert.equal(ADME_ENDPOINTS.some((endpoint) => endpoint.modelKey === "Pgp_Broccatelli" && endpoint.label === "P-gp Inhibitor"), true)
})
