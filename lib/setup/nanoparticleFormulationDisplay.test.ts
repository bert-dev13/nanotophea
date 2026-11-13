import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildNanoparticleFormulationOverview } from "@/lib/setup/nanoparticleFormulationDisplay"

describe("nanoparticleFormulationDisplay", () => {
  it("shows default maltodextrin without inventing chitosan or TPP amounts", () => {
    const overview = buildNanoparticleFormulationOverview(null)
    assert.equal(overview.dataSource, "default")
    const chitosan = overview.ingredients.find((row) => row.id === "chitosan")
    const tpp = overview.ingredients.find((row) => row.id === "tpp")
    const maltodextrin = overview.ingredients.find((row) => row.id === "maltodextrin")
    assert.equal(chitosan?.value, "Not recorded")
    assert.equal(chitosan?.source, "not_recorded")
    assert.equal(tpp?.value, "Not recorded")
    assert.equal(maltodextrin?.value, "7.00 g")
    assert.equal(maltodextrin?.source, "default")
    assert.equal(overview.ratio.source, "not_recorded")
  })

  it("prefers study chitosan/TPP amounts when present", () => {
    const overview = buildNanoparticleFormulationOverview({
      id: "np1",
      studyId: "s1",
      systemName: "Chitosan–TPP Nanoparticle System",
      carrierType: "chitosan_tpp",
      recordType: "research",
      chitosanConcentration: "1.0",
      chitosanConcentrationUnit: "mg/mL",
      chitosanMwUnit: "kDa",
      tppConcentration: "0.5",
      tppConcentrationUnit: "mg/mL",
      chitosanTppRatio: "2:1",
      computationalStatus: "not_configured",
      provenance: { evidenceClass: "REFERENCE" },
      referenceIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "u1",
      updatedBy: "u1",
    } as any)
    assert.equal(overview.dataSource, "study")
    assert.equal(overview.ingredients.find((row) => row.id === "chitosan")?.value, "1.0 mg/mL")
    assert.equal(overview.ingredients.find((row) => row.id === "chitosan")?.source, "study")
    assert.equal(overview.ingredients.find((row) => row.id === "tpp")?.value, "0.5 mg/mL")
    assert.equal(overview.ratio.value, "2:1")
    assert.equal(overview.ratio.source, "study")
  })
})
