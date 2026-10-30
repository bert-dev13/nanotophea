import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { assessTargetStructure, TARGET_UNVERIFIED, type StructureExpectation } from "@/lib/docking/targetVerification"
import type { RcsbPolymer } from "@/lib/scientific/types"

const yap: StructureExpectation = {
  title: "human YAP and TEAD complex",
  method: "X-ray",
  resolution: "2.8",
  organism: "Homo sapiens",
  chains: ["A", "B", "C", "D"],
  entities: [
    { label: "Transcriptional enhancer factor TEF-1", uniprotId: "P28347" },
    { label: "Yes-associated protein", uniprotId: "P46937" },
  ],
}

const keap: StructureExpectation = {
  title: "KEAP1 bound to Nrf2",
  method: "X-ray",
  resolution: "2.08",
  organism: "Homo sapiens",
  chains: ["A", "B", "C"],
  entities: [
    { label: "Kelch-like ECH-associated protein 1", uniprotId: "Q14145" },
    { label: "Nuclear factor erythroid 2-related factor 2", uniprotId: "Q16236" },
  ],
}

describe("assessTargetStructure", () => {
  it("verifies 3KYS only as the human YAP–TEAD complex", () => {
    const verdict = assessTargetStructure({
      expectation: yap,
      retrieved: true,
      title: "Crystal structure of human YAP and TEAD complex",
      method: "X-ray",
      resolution: "2.8 Å",
      polymers: [
        polymer("Transcriptional enhancer factor TEF-1", "Homo sapiens", ["P28347"], ["A", "C"]),
        polymer("65 kDa Yes-associated protein", "Homo sapiens", ["P46937"], ["B", "D"]),
      ],
    })
    assert.equal(verdict.status, "verified")
    assert.equal(TARGET_UNVERIFIED, "Target structure requires verification")
  })

  it("does not verify a successful RCSB response that lacks an expected identity", () => {
    const verdict = assessTargetStructure({
      expectation: null,
      retrieved: true,
      title: "Crystal structure of human YAP and TEAD complex",
      method: "X-ray",
      resolution: "2.8 Å",
      polymers: [polymer("65 kDa Yes-associated protein", "Homo sapiens", ["P46937"], ["B"])],
    })
    assert.equal(verdict.status, "needs_verification")
  })

  it("marks the old YAP1 and Nrf2 PDB records as mismatches", () => {
    assert.equal(assessTargetStructure({
      expectation: yap,
      retrieved: true,
      title: "Structure of GH113 beta-1,4-mannanase",
      method: "X-ray",
      resolution: "1.6 Å",
      polymers: [polymer("beta-1,4-mannanase", "Bacillus sp.", ["P00000"], ["A"])],
    }).status, "mismatch")
    assert.equal(assessTargetStructure({
      expectation: keap,
      retrieved: true,
      title: "Crystal Structure of the Escherichia coli LpxC/L-161,240 complex",
      method: "X-ray",
      resolution: "2.1 Å",
      polymers: [polymer("UDP-3-O-[3-hydroxymyristoyl] N-acetylglucosamine deacetylase", "Escherichia coli", ["P0A725"], ["A"])],
    }).status, "mismatch")
  })

  it("verifies 8EJR as KEAP1 bound to an Nrf2 peptide", () => {
    assert.equal(assessTargetStructure({
      expectation: keap,
      retrieved: true,
      title: "Kelch domain of human KEAP1 bound to Nrf2 linear peptide, Ac-GDPETGE-NH2",
      method: "X-ray",
      resolution: "2.08 Å",
      polymers: [
        polymer("Kelch-like ECH-associated protein 1", "Homo sapiens", ["Q14145"], ["A", "B"]),
        polymer("Linear peptide from Nuclear factor erythroid 2-related factor 2", "Homo sapiens", ["Q16236"], ["C"]),
      ],
    }).status, "verified")
  })

  it("rejects a UniProt or organism mismatch", () => {
    assert.equal(assessTargetStructure({
      expectation: yap,
      retrieved: true,
      title: "Crystal structure of human YAP and TEAD complex",
      method: "X-ray",
      resolution: "2.8 Å",
      polymers: [
        polymer("Transcriptional enhancer factor TEF-1", "Homo sapiens", ["P28347"], ["A", "C"]),
        polymer("65 kDa Yes-associated protein", "Mus musculus", ["P46937"], ["B", "D"]),
      ],
    }).status, "mismatch")
  })
})

function polymer(description: string, organism: string, uniprotIds: string[], chains: string[]): RcsbPolymer {
  return { description, organism, uniprotIds, chains }
}
