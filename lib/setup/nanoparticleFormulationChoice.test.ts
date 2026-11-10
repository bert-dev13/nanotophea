import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  configuredNanoparticleSummary,
  nanoparticleChoiceFromStudy,
  skippedNanoparticleSummary,
} from "@/lib/setup/nanoparticleFormulationChoice"

describe("optional nanoparticle formulation choice", () => {
  it("treats nanoparticle as unresolved until skip or configuration is recorded", () => {
    assert.equal(nanoparticleChoiceFromStudy({ formulationSummary: "" }), "unresolved")
    assert.equal(nanoparticleChoiceFromStudy({ formulationSummary: null }), "unresolved")
  })

  it("records an explicit skip without requiring a nanoparticle record", () => {
    const summary = skippedNanoparticleSummary("2026-11-11T00:00:00.000Z")
    assert.match(summary, /skipped/i)
    assert.equal(nanoparticleChoiceFromStudy({ formulationSummary: summary }), "skipped")
  })

  it("recognizes a configured nanoparticle choice from summary or study nanoparticle record", () => {
    assert.equal(
      nanoparticleChoiceFromStudy({
        formulationSummary: configuredNanoparticleSummary("Chitosan–TPP Nanoparticle System"),
      }),
      "configured",
    )
    assert.equal(
      nanoparticleChoiceFromStudy({
        formulationSummary: "",
        nanoparticleConfigured: true,
      }),
      "configured",
    )
  })
})
