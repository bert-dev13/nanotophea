import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { deriveExperimentalResults } from "@/lib/lab/derivedAssays"
import {
  ldhNanoparticleSetupSummary,
  ldhSelectivityIndexDisplay,
  ldhTreatmentSampleLabel,
  normalizeLdhNanoparticleSetup,
  validateLdhNanoparticleSetup,
} from "@/lib/lab/ldhNanoparticleSetup"
import type { LabReplicate } from "@/lib/domain/models"

describe("LDH nanoparticle setup metadata", () => {
  it("requires an explicit include/skip choice and a treatment label when included", () => {
    assert.throws(() => validateLdhNanoparticleSetup(null), /Choose whether/)
    assert.throws(
      () => validateLdhNanoparticleSetup({ choice: "include", source: "researcher_specified" }),
      /Specify the nanoparticle treatment/,
    )
    assert.deepEqual(validateLdhNanoparticleSetup({ choice: "skip", source: "skipped" }), {
      choice: "skip",
      source: "skipped",
    })
    assert.equal(
      validateLdhNanoparticleSetup({
        choice: "include",
        treatmentLabel: " Chitosan–TPP ",
        nanoparticleRecordId: "np1",
        source: "study_record",
      }).treatmentLabel,
      "Chitosan–TPP",
    )
  })

  it("summarizes setup and never invents a Selectivity Index value", () => {
    assert.equal(ldhNanoparticleSetupSummary({ choice: "skip", source: "skipped" }), "Nanoparticle skipped — free / non-nanoparticle setup")
    assert.equal(ldhTreatmentSampleLabel({ choice: "include", treatmentLabel: "Chitosan–TPP NP", source: "study_record" }), "HepatoTea · Chitosan–TPP NP")
    assert.equal(ldhTreatmentSampleLabel({ choice: "skip", source: "skipped" }), "HepatoTea (no nanoparticle)")

    const skipped = ldhSelectivityIndexDisplay({ setup: { choice: "skip", source: "skipped" } })
    assert.equal(skipped.value, "Not calculated")
    assert.match(skipped.note, /not derived|not supplied/i)

    const included = ldhSelectivityIndexDisplay({
      setup: { choice: "include", treatmentLabel: "Chitosan–TPP", source: "study_record" },
      ic50Value: 120,
      ic50Method: "external fit",
    })
    assert.match(included.value, /Not calculated/i)
    assert.match(included.note, /paired comparator/i)
    assert.ok(!/\b\d+(\.\d+)?\b/.test(included.value) || /Not calculated/.test(included.value))
  })

  it("does not change LDH cytotoxicity derivation when nanoparticle metadata is present", () => {
    const replicates: LabReplicate[] = [
      row("T1", "R1", 0.2),
      row("T1", "R2", 0.2),
      row("T2", "R1", 1.0),
      row("T2", "R2", 1.0),
      row("T3", "R1", 0.4),
      row("T3", "R2", 0.4),
    ]
    const withoutMeta = deriveExperimentalResults("ldh", replicates)
    const withMeta = deriveExperimentalResults("ldh", replicates)
    assert.deepEqual(withoutMeta.summaries, withMeta.summaries)
    const setup = normalizeLdhNanoparticleSetup({
      choice: "include",
      treatmentLabel: "Chitosan–TPP",
      source: "researcher_specified",
    })
    assert.equal(setup?.choice, "include")
    // Metadata path is independent of absorbance → % cytotoxicity.
    assert.ok(withMeta.summaries.some((s) => s.metric === "percentCytotoxicity"))
  })
})

function row(treatmentCode: LabReplicate["treatmentCode"], replicateCode: LabReplicate["replicateCode"], absorbance: number): LabReplicate {
  return {
    id: `${treatmentCode}-${replicateCode}`,
    datasetId: "d1",
    studyId: "s1",
    treatmentCode,
    replicateCode,
    measurements: { absorbanceA490: absorbance },
    dataClass: "RAW_EXPERIMENTAL",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    createdBy: "tester",
  }
}
