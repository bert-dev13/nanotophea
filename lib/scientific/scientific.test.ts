import assert from "node:assert/strict"
import test from "node:test"
import { normalizePubChem } from "./pubchem"
import { normalizeRcsb } from "./rcsb"

test("normalizePubChem keeps only returned descriptors", () => {
  const row = normalizePubChem(5280343, {
    PropertyTable: {
      Properties: [{
        CID: 5280343,
        MolecularFormula: "C15H10O7",
        MolecularWeight: "302.23",
        ConnectivitySMILES: "C1=CC=O",
        SMILES: "C1=CC=O",
        IUPACName: "quercetin",
        XLogP: 1.5,
        TPSA: 127,
        HBondDonorCount: 5,
        HBondAcceptorCount: 7,
        RotatableBondCount: 1,
      }],
    },
  })
  assert.equal(row.formula, "C15H10O7")
  assert.equal(row.molecularWeight, 302.23)
  assert.equal(row.xLogP, 1.5)
  assert.equal(row.tpsa, 127)
  assert.equal(row.source, "PubChem")
})

test("normalizeRcsb reads entry and polymer fields", () => {
  const row = normalizeRcsb(
    "5ylh",
    {
      struct: { title: "Example structure" },
      rcsb_entry_info: { experimental_method: "X-ray", resolution_combined: [2.29] },
      rcsb_accession_info: { initial_release_date: "2018-06-20T00:00:00.000+00:00" },
      rcsb_primary_citation: { pdbx_database_id_DOI: "10.0000/example" },
    },
    {
      rcsb_polymer_entity: { pdbx_description: "Example protein" },
      rcsb_entity_source_organism: [{ scientific_name: "Homo sapiens" }],
    },
  )
  assert.equal(row.pdbId, "5YLH")
  assert.equal(row.title, "Example structure")
  assert.equal(row.resolution, "2.29 Å")
  assert.equal(row.organism, "Homo sapiens")
  assert.equal(row.released, "2018-06-20")
  assert.equal(row.doi, "10.0000/example")
  assert.equal(row.source, "RCSB PDB")
})
