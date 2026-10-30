import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { extractPoseModel, parseVinaOutput } from "./parseVinaOutput"

const LOG = `
AutoDock Vina v1.2.5
Exhaustiveness: 8
Center: X 15.2 Y 20.1 Z -8.4
Size: X 22 Y 18 Z 20

mode |   affinity | dist from best mode
     | (kcal/mol) | rmsd l.b.| rmsd u.b.
-----+------------+----------+----------
   1         -7.2      0.000      0.000
   2         -6.8      1.817      2.044
   3         -6.5      3.102      5.551
`

const PDBQT = `
REMARK VINA RESULT:      -9.1      0.000      0.000
MODEL        1
HETATM    1  C   LIG A   1      10.000  11.000  12.000  1.00  0.00     0.000 C
ENDMDL
REMARK VINA RESULT:      -8.4      1.200      2.200
MODEL        2
HETATM    1  C   LIG A   1      14.000  15.000  16.000  1.00  0.00     0.000 C
ENDMDL
`

describe("parseVinaOutput", () => {
  it("reads the mode table and optional run settings", () => {
    const parsed = parseVinaOutput(LOG)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.result.modes.length, 3)
    assert.equal(parsed.result.bestMode, 1)
    assert.equal(parsed.result.bestAffinityKcalMol, -7.2)
    assert.equal(parsed.result.modes[1]?.rmsdLowerBound, 1.817)
    assert.equal(parsed.result.vinaVersion, "1.2.5")
    assert.equal(parsed.result.exhaustiveness, 8)
    assert.deepEqual(parsed.result.searchBox, {
      centerX: 15.2,
      centerY: 20.1,
      centerZ: -8.4,
      sizeX: 22,
      sizeY: 18,
      sizeZ: 20,
    })
    assert.equal(parsed.result.poseModel, undefined)
  })

  it("reads REMARK VINA RESULT lines and the matching pose", () => {
    const parsed = parseVinaOutput(PDBQT)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.result.bestMode, 1)
    assert.equal(parsed.result.bestAffinityKcalMol, -9.1)
    assert.match(parsed.result.poseModel || "", /10\.000/)
    assert.equal(extractPoseModel(PDBQT, 2)?.includes("14.000"), true)
  })

  it("rejects a file with no Vina scores", () => {
    const parsed = parseVinaOutput("ATOM      1  N   ALA A   1      0.000  0.000  0.000\n")
    assert.equal(parsed.ok, false)
  })
})
