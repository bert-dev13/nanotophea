import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const isWin = process.platform === "win32"
const python = isWin
  ? path.join(root, ".adme-venv", "Scripts", "python.exe")
  : path.join(root, ".adme-venv", "bin", "python")

const vina = isWin
  ? path.join(root, "tools", "vina", "vina.exe")
  : path.join(root, "tools", "vina", "vina")

console.log("=======================================================")
console.log("        HEPATOTEA REAL AUTODOCK VINA DOCKING TEST")
console.log("=======================================================\n")

// 1. Toolchain Check
if (!existsSync(vina)) {
  console.error("  [FAIL] AutoDock Vina binary missing at tools/vina/vina.exe")
  process.exit(1)
}

if (!existsSync(python)) {
  console.error("  [FAIL] Python environment missing at .adme-venv")
  process.exit(1)
}

console.log("  Toolchain .......... \x1b[32mPASS\x1b[0m")

// 2. Prepare lightweight real 3D ligand & receptor in temp directory
const work = mkdtempSync(path.join(tmpdir(), "nanotophea-test-dock-"))

try {
  // Generate 3D ligand SDF using RDKit
  const genLigandScript = `
import sys
from rdkit import Chem
from rdkit.Chem import AllChem

m = Chem.AddHs(Chem.MolFromSmiles('CC(=O)O'))
AllChem.EmbedMolecule(m, randomSeed=42)
Chem.MolToMolFile(m, sys.argv[1])
`
  const genRes = spawnSync(python, ["-c", genLigandScript, path.join(work, "ligand.sdf")], {
    windowsHide: true,
    encoding: "utf8",
  })
  if (genRes.status !== 0 || !existsSync(path.join(work, "ligand.sdf"))) {
    console.error("  [FAIL] Could not generate 3D test ligand via RDKit")
    process.exit(1)
  }

  // Real peptide receptor PDB (Alanine dipeptide)
  const receptorPdb = `ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00 20.00           N  
ATOM      2  CA  ALA A   1       1.458   0.000   0.000  1.00 20.00           C  
ATOM      3  C   ALA A   1       2.009   1.423   0.000  1.00 20.00           C  
ATOM      4  O   ALA A   1       1.272   2.404   0.000  1.00 20.00           O  
ATOM      5  CB  ALA A   1       2.000  -0.771  -1.205  1.00 20.00           C  
ATOM      6  N   ALA A   2       3.323   1.528   0.000  1.00 20.00           N  
ATOM      7  CA  ALA A   2       3.987   2.828   0.000  1.00 20.00           C  
ATOM      8  C   ALA A   2       5.500   2.665   0.000  1.00 20.00           C  
ATOM      9  O   ALA A   2       6.220   3.660   0.000  1.00 20.00           O  
ATOM     10  CB  ALA A   2       3.535   3.619   1.233  1.00 20.00           C  
END
`
  writeFileSync(path.join(work, "receptor.pdb"), receptorPdb, "utf8")

  const job = {
    configuration: {
      centerX: 2.5,
      centerY: 1.5,
      centerZ: 0.0,
      sizeX: 16.0,
      sizeY: 16.0,
      sizeZ: 16.0,
      exhaustiveness: 1,
      numModes: 2,
      energyRange: 3.0,
    },
    timeoutSeconds: 30,
  }
  writeFileSync(path.join(work, "job.json"), JSON.stringify(job), "utf8")

  // Execute worker.py
  const workerPy = path.join(root, "services", "docking", "worker.py")
  const workerRes = spawnSync(python, [workerPy, work], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  })

  // 3. Verify Ligand Prep
  if (!existsSync(path.join(work, "ligand.pdbqt"))) {
    console.error("  Ligand Prep ........ \x1b[31mFAIL\x1b[0m")
    console.error(workerRes.stdout || workerRes.stderr)
    process.exit(1)
  }
  console.log("  Ligand Prep ........ \x1b[32mPASS\x1b[0m")

  // 4. Verify Receptor Prep
  if (!existsSync(path.join(work, "receptor.pdbqt"))) {
    console.error("  Receptor Prep ...... \x1b[31mFAIL\x1b[0m")
    console.error(workerRes.stdout || workerRes.stderr)
    process.exit(1)
  }
  console.log("  Receptor Prep ...... \x1b[32mPASS\x1b[0m")

  // 5. Verify Vina Execution
  if (!existsSync(path.join(work, "poses.pdbqt")) || !existsSync(path.join(work, "vina.log"))) {
    console.error("  Vina Execution ..... \x1b[31mFAIL\x1b[0m")
    console.error(workerRes.stdout || workerRes.stderr)
    process.exit(1)
  }
  console.log("  Vina Execution ..... \x1b[32mPASS\x1b[0m")

  // 6. Verify Result Parsing
  const logContent = readFileSync(path.join(work, "vina.log"), "utf8")
  const posesContent = readFileSync(path.join(work, "poses.pdbqt"), "utf8")

  const combined = `${logContent}\n${posesContent}`
  const modeMatch = combined.match(/\s+1\s+([-\d.]+)\s+/i)
  if (!modeMatch) {
    console.error("  Result Parsing ..... \x1b[31mFAIL\x1b[0m")
    process.exit(1)
  }
  const affinity = parseFloat(modeMatch[1])
  console.log(`  Result Parsing ..... \x1b[32mPASS\x1b[0m (Affinity: ${affinity} kcal/mol)`)
  console.log("\n  \x1b[32m[OK]\x1b[0m Complete AutoDock Vina Docking Integration: SUCCESS\n")
  process.exit(0)
} finally {
  try {
    rmSync(work, { recursive: true, force: true })
  } catch {}
}

