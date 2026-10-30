import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { blindSearchBox, boxContainsAtoms, calculateSearchBox, listReferenceEntities, receptorChains, referenceEntityAtoms, referenceLigands } from "@/lib/docking/searchBox"

function pdbLine(record: "ATOM" | "HETATM", residue: string, chain: string, sequence: number, x: number, y: number, z: number, alt = " "): string {
  const line = Array.from({ length: 66 }, () => " ")
  write(line, 0, record.padEnd(6))
  write(line, 16, alt)
  write(line, 17, residue.padStart(3).slice(0, 3))
  write(line, 21, chain)
  write(line, 22, String(sequence).padStart(4))
  write(line, 30, x.toFixed(3).padStart(8))
  write(line, 38, y.toFixed(3).padStart(8))
  write(line, 46, z.toFixed(3).padStart(8))
  return line.join("")
}

function write(line: string[], start: number, value: string) {
  for (let index = 0; index < value.length; index += 1) line[start + index] = value[index] ?? " "
}

const SAMPLE = [
  pdbLine("ATOM", "ALA", "A", 1, 0, 0, 0),
  pdbLine("ATOM", "ALA", "A", 2, 10, 4, 6),
  pdbLine("HETATM", "HOH", "A", 201, 1, 1, 1),
  pdbLine("HETATM", "HOH", "A", 202, 2, 2, 2),
  pdbLine("HETATM", "LIG", "A", 401, 1, 2, 3),
  pdbLine("HETATM", "LIG", "A", 401, 5, 6, 9),
].join("\n")

describe("search box derivation", () => {
  it("derives a reference-ligand box from ligand atoms and skips water", () => {
    const ligands = referenceLigands(SAMPLE)
    assert.equal(ligands.length, 1)
    assert.equal(ligands[0]?.label, "LIG A401")
    assert.equal(ligands[0]?.centerX, 3)
    assert.equal(ligands[0]?.centerY, 4)
    assert.equal(ligands[0]?.centerZ, 6)
    assert.equal(ligands[0]?.sizeX, 4)
    assert.equal(ligands[0]?.sizeY, 4)
    assert.equal(ligands[0]?.sizeZ, 6)
  })

  it("derives a blind box from protein atoms only", () => {
    const box = blindSearchBox(SAMPLE)
    assert.equal(box?.centerX, 5)
    assert.equal(box?.centerY, 2)
    assert.equal(box?.centerZ, 3)
    assert.equal(box?.sizeX, 10)
    assert.equal(box?.sizeY, 4)
    assert.equal(box?.sizeZ, 6)
  })

  it("returns nothing when the file has no usable coordinates", () => {
    assert.deepEqual(referenceLigands("HEADER\n"), [])
    assert.equal(blindSearchBox("HEADER\n"), null)
  })

  it("treats a short peptide chain as the reference and the long protein as the receptor", () => {
    const pdb = [
      pdbLine("ATOM", "ALA", "A", 1, 0, 0, 0),
      pdbLine("ATOM", "ALA", "A", 2, 4, 0, 0),
      pdbLine("ATOM", "GLY", "C", 1, 10, 2, 3),
      pdbLine("ATOM", "GLY", "C", 2, 14, 6, 9),
      pdbLine("HETATM", "HOH", "A", 9, 1, 1, 1),
    ].join("\n")
    const polymers = [
      { description: "Kelch-like ECH-associated protein 1", chains: ["A"], length: 336 },
      { description: "Linear peptide from Nuclear factor erythroid 2-related factor 2", chains: ["C"], length: 9 },
    ]
    assert.deepEqual(receptorChains(pdb, polymers), ["A"])
    const entities = listReferenceEntities(pdb, polymers)
    assert.equal(entities.length, 1)
    assert.equal(entities[0]?.chain, "C")
    assert.equal(entities[0]?.kind, "peptide")
    assert.equal(entities[0]?.residueCount, 2)
    const atoms = referenceEntityAtoms(pdb, entities[0]!)
    const box = calculateSearchBox(atoms, 5, entities[0]!.name)
    assert.equal(box?.centerX, 12)
    assert.equal(box?.centerY, 4)
    assert.equal(box?.centerZ, 6)
    assert.equal(box?.sizeX, 14)
    assert.equal(box?.sizeY, 14)
    assert.equal(box?.sizeZ, 16)
    assert.equal(boxContainsAtoms(box!, atoms), true)
    assert.equal(boxContainsAtoms({ ...box!, sizeX: 1, sizeY: 1, sizeZ: 1 }, atoms), false)
  })

  it("reports no reference entity when the structure has only receptor protein", () => {
    const pdb = [
      pdbLine("ATOM", "ALA", "A", 1, 0, 0, 0),
      pdbLine("ATOM", "ALA", "A", 2, 2, 0, 0),
    ].join("\n")
    assert.deepEqual(listReferenceEntities(pdb, [{ description: "Docking receptor", chains: ["A"], length: 200 }]), [])
  })
})
