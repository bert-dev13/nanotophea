import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  appendPreparationHistory,
  emptyNanoparticlePreparationProtocol,
  ovenThermalWarning,
  parseNanoparticlePreparationProtocol,
  preparationProgress,
  valueOrNotRecorded,
} from "@/lib/setup/nanoparticlePreparationProtocol"

describe("nanoparticlePreparationProtocol", () => {
  it("prepopulates maltodextrin at 7.00 g without inventing chitosan/TPP amounts", () => {
    const protocol = emptyNanoparticlePreparationProtocol()
    const chitosan = protocol.ingredients.find((row) => row.id === "chitosan")
    const tpp = protocol.ingredients.find((row) => row.id === "tpp")
    const maltodextrin = protocol.ingredients.find((row) => row.id === "maltodextrin")

    assert.equal(chitosan?.amount, "")
    assert.equal(tpp?.amount, "")
    assert.equal(maltodextrin?.amount, "7.00")
    assert.equal(maltodextrin?.unit, "g")
    assert.equal(maltodextrin?.prescribedAmount, "7.00")
    assert.equal(protocol.maltodextrin.actualAmountG, "7.00")
    assert.equal(protocol.ovenDrying.prescribedTemperatureC, "50")
  })

  it("warns when oven temperature exceeds 60°C without thermal stability", () => {
    const protocol = emptyNanoparticlePreparationProtocol()
    assert.match(
      ovenThermalWarning({
        ...protocol.ovenDrying,
        actualTemperatureC: "65",
        thermalStabilityAbove60: "not_established",
      }) ?? "",
      /exceeds 60/i,
    )

    assert.equal(
      ovenThermalWarning({
        ...protocol.ovenDrying,
        actualTemperatureC: "65",
        thermalStabilityAbove60: "yes",
      }),
      null,
    )

    assert.equal(
      ovenThermalWarning({
        ...protocol.ovenDrying,
        actualTemperatureC: "50",
        thermalStabilityAbove60: "not_established",
      }),
      null,
    )
  })

  it("tracks completed / pending / skipped progress", () => {
    const protocol = emptyNanoparticlePreparationProtocol()
    protocol.stabilization.status = "completed"
    protocol.maltodextrin.status = "skipped"
    assert.deepEqual(preparationProgress(protocol), {
      completed: 1,
      skipped: 1,
      pending: 2,
      total: 4,
    })
  })

  it("parses stored JSON and appends edit history", () => {
    const stored = {
      version: 1 as const,
      ingredients: [],
      stabilization: { status: "completed" as const, actualStirringRpm: "250" },
      maltodextrin: {},
      dryingTrays: {},
      ovenDrying: {},
    }
    const parsed = parseNanoparticlePreparationProtocol(stored)
    assert.equal(parsed.stabilization.actualStirringRpm, "250")
    assert.equal(
      parsed.ingredients.some((row) => row.id === "maltodextrin"),
      true,
    )

    const withHistory = appendPreparationHistory(parsed, "stabilization", "Saved step")
    assert.equal(withHistory.editHistory.at(-1)?.section, "stabilization")
    assert.equal(valueOrNotRecorded(""), "Not recorded")
    assert.equal(valueOrNotRecorded("250"), "250")
  })
})
