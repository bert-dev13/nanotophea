import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildFormulationSavePayload,
  calculateChitosanTppRatio,
  emptyFormulationEditForm,
  resolveFormulationRatio,
  validateFormulationEditForm,
} from "@/lib/setup/nanoparticleFormulationEdit"
import { buildNanoparticleFormulationOverview } from "@/lib/setup/nanoparticleFormulationDisplay"
import { parseNanoparticlePreparationProtocol } from "@/lib/setup/nanoparticlePreparationProtocol"

describe("nanoparticleFormulationEdit", () => {
  it("calculates Chitosan:TPP ratio only from compatible mass units", () => {
    assert.equal(calculateChitosanTppRatio("2", "g", "1", "g"), "2:1")
    assert.equal(calculateChitosanTppRatio("2000", "mg", "1", "g"), "2:1")
    assert.equal(calculateChitosanTppRatio("", "g", "1", "g"), null)
    assert.equal(calculateChitosanTppRatio("1", "mg/mL", "1", "g"), null)
  })

  it("prefers manual ratio over calculated", () => {
    const form = emptyFormulationEditForm()
    form.chitosanAmount = "2"
    form.chitosanUnit = "g"
    form.tppAmount = "1"
    form.tppUnit = "g"
    form.ratioManual = "3:1"
    assert.deepEqual(resolveFormulationRatio(form), { value: "3:1", provenance: "manual" })
    form.ratioManual = ""
    assert.deepEqual(resolveFormulationRatio(form), { value: "2:1", provenance: "calculated" })
  })

  it("rejects invalid numeric inputs", () => {
    const form = emptyFormulationEditForm()
    form.chitosanAmount = "abc"
    assert.match(validateFormulationEditForm(form) ?? "", /Chitosan amount/i)
  })

  it("persists study ingredients without inventing chitosan/TPP defaults", () => {
    const form = emptyFormulationEditForm()
    form.chitosanAmount = "1.5"
    form.chitosanUnit = "g"
    form.tppAmount = "0.75"
    form.tppUnit = "g"
    form.maltodextrinAmount = "7.00"
    form.solventName = "1% acetic acid"
    form.solventAmount = "100"
    form.solventUnit = "mL"

    const payload = buildFormulationSavePayload(null, form)
    const protocol = parseNanoparticlePreparationProtocol(payload.preparationProtocol)
    const chitosan = protocol.ingredients.find((row) => row.id === "chitosan")
    const tpp = protocol.ingredients.find((row) => row.id === "tpp")
    const maltodextrin = protocol.ingredients.find((row) => row.id === "maltodextrin")

    assert.equal(chitosan?.amount, "1.5")
    assert.equal(tpp?.amount, "0.75")
    assert.equal(maltodextrin?.prescribedAmount, "7.00")
    assert.equal(payload.chitosanTppRatio, "2:1")
    assert.equal(protocol.formulationRatio.provenance, "calculated")

    const overview = buildNanoparticleFormulationOverview(payload as any)
    assert.equal(overview.dataSource, "study")
    assert.equal(overview.ingredients.find((row) => row.id === "chitosan")?.source, "study")
    assert.equal(overview.ingredients.find((row) => row.id === "maltodextrin")?.source, "default")
  })
})
