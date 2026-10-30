import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { LabReplicate, LabTreatmentCode } from "@/lib/domain/models"
import { deriveExperimentalResults, deriveMttObservations } from "@/lib/lab/derivedAssays"
import { laboratoryProgress, visibleLaboratorySections } from "@/lib/lab/sections"

function rep(
  treatmentCode: LabTreatmentCode,
  replicateCode: "R1" | "R2" | "R3",
  absorbance: number,
  assay: "dpph" | "ldh",
): LabReplicate {
  const key = assay === "dpph" ? "absorbance" : "absorbanceA490"
  return {
    id: `${treatmentCode}-${replicateCode}`,
    datasetId: "d",
    studyId: "s",
    treatmentCode,
    replicateCode,
    measurements: { [key]: absorbance },
    dataClass: "RAW_EXPERIMENTAL",
    createdAt: "t",
    updatedAt: "t",
    createdBy: "u",
  }
}

describe("experimental derived results", () => {
  it("calculates DPPH scavenging from the solvent-control mean", () => {
    const raw = [
      rep("T1", "R1", 1, "dpph"),
      rep("T1", "R2", 1, "dpph"),
      rep("T3", "R1", 0.5, "dpph"),
      rep("T3", "R2", 0.5, "dpph"),
    ]
    const derived = deriveExperimentalResults("dpph", raw)
    const sample = derived.replicates.find((row) => row.treatmentCode === "T3")
    assert.equal(sample?.measurements.absorbance, 0.5)
    assert.equal(sample?.measurements.radicalScavengingPercent, 50)
    const control = derived.replicates.find((row) => row.treatmentCode === "T1")
    assert.equal(control?.measurements.radicalScavengingPercent, undefined)
    const summary = derived.summaries.find(
      (row) => row.treatmentCode === "T3" && row.metric === "radicalScavengingPercent",
    )
    assert.equal(summary?.mean, 50)
    assert.equal(summary?.n, 2)
  })

  it("does not calculate DPPH scavenging without a solvent control", () => {
    const derived = deriveExperimentalResults("dpph", [rep("T3", "R1", 0.4, "dpph")])
    assert.equal(derived.replicates[0]?.measurements.radicalScavengingPercent, undefined)
  })

  it("calculates LDH cytotoxicity from spontaneous and maximum controls", () => {
    const derived = deriveExperimentalResults("ldh", [
      rep("T1", "R1", 0.1, "ldh"),
      rep("T2", "R1", 1.1, "ldh"),
      rep("T4", "R1", 0.6, "ldh"),
    ])
    assert.equal(derived.replicates[2]?.measurements.absorbanceA490, 0.6)
    assert.equal(derived.replicates[2]?.measurements.percentCytotoxicity, 50)
    assert.equal(derived.replicates[0]?.measurements.percentCytotoxicity, undefined)
  })

  it("does not calculate LDH cytotoxicity when a control is missing", () => {
    const derived = deriveExperimentalResults("ldh", [
      rep("T1", "R1", 0.1, "ldh"),
      rep("T4", "R1", 0.6, "ldh"),
    ])
    assert.equal(derived.replicates[1]?.measurements.percentCytotoxicity, undefined)
  })
})

describe("MTT derived results", () => {
  it("derives viability and inhibition from an untreated control", () => {
    const derived = deriveMttObservations([
      { role: "untreated", replicates: [1, 1], treatment: "Untreated" },
      { role: "treatment", replicates: [0.5, 0.5], treatment: "NanoHepatoTea", concentration: "100" },
    ])
    assert.equal(derived[1]?.mean, 0.5)
    assert.equal(derived[1]?.viabilityPercent, 50)
    assert.equal(derived[1]?.inhibitionPercent, 50)
    assert.equal(derived[0]?.viabilityPercent, undefined)
    assert.deepEqual(derived[1]?.replicates, [0.5, 0.5])
  })

  it("does not derive MTT percentages without a control absorbance", () => {
    const derived = deriveMttObservations([
      { role: "treatment", replicates: [0.4], treatment: "NanoHepatoTea" },
    ])
    assert.equal(derived[0]?.viabilityPercent, undefined)
    assert.equal(derived[0]?.inhibitionPercent, undefined)
    assert.equal(derived[0]?.mean, 0.4)
  })
})

describe("laboratory section progress", () => {
  it("counts tested prediction endpoints and treats an explicit not-tested mark as resolved", () => {
    assert.deepEqual(
      laboratoryProgress({
        datasets: [{ assayType: "dpph" }, { assayType: "ldh" }],
        stored: { mtt: false, ros: false, bax: false, hippo_yap: false },
      }),
      { endpoints: 6, tested: 2, required: 6, recorded: 6 },
    )
    assert.deepEqual(
      laboratoryProgress({
        datasets: [{ assayType: "dpph" }],
      }),
      { endpoints: 6, tested: 1, required: 6, recorded: 1 },
    )
  })

  it("keeps every biological prediction endpoint visible", () => {
    const sections = visibleLaboratorySections({
      storedPredictions: { dpph: true, mtt: true, ldh: true, ros: true, bax: true, hippo_yap: true },
      compounds: [{ id: "c", name: "Luteolin" }],
      proteins: [{ id: "p", name: "BAX" }],
      cellLines: [{ id: "h", name: "HepG2" }],
    }).map((section) => section.label)
    assert.deepEqual(sections, ["DPPH", "MTT", "LDH", "ROS", "BAX", "Hippo–YAP", "Product Characterization"])
  })
})
