import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"
import { inspectEngine, getDockingPython, getVinaBinary } from "../services/docking/engine"

// 1. Load env vars
function loadEnv() {
  const envFiles = [".env.local", ".env"]
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file)
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, "utf-8")
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIdx = trimmed.indexOf("=")
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        let val = trimmed.slice(eqIdx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (process.env[key] === undefined) {
          process.env[key] = val
        }
      }
    }
  }
}

loadEnv()

async function main() {
  console.log("=======================================================")
  console.log("  NANO-HEPATOTEA MOLECULAR DOCKING WORKER VERIFICATION")
  console.log("=======================================================\n")

  let allOk = true

  // 1. AutoDock Vina Binary Check
  const vinaBin = getVinaBinary()
  if (!vinaBin || !fs.existsSync(vinaBin)) {
    console.error(`[FAIL] AutoDock Vina binary not found (expected at tools/vina/vina.exe or VINA_BIN)`)
    allOk = false
  } else {
    const vRes = spawnSync(vinaBin, ["--version"], { encoding: "utf-8" })
    const out = (vRes.stdout || vRes.stderr || "").trim()
    if (vRes.status === 0 && out.toLowerCase().includes("vina")) {
      console.log(`[OK] AutoDock Vina binary: ${out} (${vinaBin})`)
    } else {
      console.error(`[FAIL] Vina execution check failed: ${out || "Exit status: " + vRes.status}`)
      allOk = false
    }
  }

  // 2. Python Runtime Check (.adme-venv preferred)
  const pythonBin = getDockingPython()
  if (!pythonBin || !fs.existsSync(pythonBin)) {
    console.error(`[FAIL] Docking Python not found (expected at .adme-venv/Scripts/python.exe)`)
    allOk = false
  } else {
    const pyVerRes = spawnSync(pythonBin, ["--version"], { encoding: "utf-8" })
    const pyVer = (pyVerRes.stdout || pyVerRes.stderr || "").trim()
    console.log(`[OK] Docking Python runtime: ${pyVer} (${pythonBin})`)

    // 3. Import Scientific Packages Check
    const pyCheckScript = `
import sys
modules = ["rdkit", "meeko", "gemmi", "openbabel", "scipy", "numpy"]
missing = []
for m in modules:
    try:
        __import__(m)
    except ImportError as e:
        missing.append(f"{m} ({e})")
if missing:
    print("MISSING:" + ",".join(missing))
    sys.exit(1)
print("ALL_IMPORTS_OK")
`
    const pyImportRes = spawnSync(pythonBin, ["-c", pyCheckScript], { encoding: "utf-8" })
    const importOut = (pyImportRes.stdout || pyImportRes.stderr || "").trim()
    if (pyImportRes.status === 0 && importOut.includes("ALL_IMPORTS_OK")) {
      console.log(`[OK] Python scientific packages verified: RDKit, Meeko, Gemmi, OpenBabel, SciPy, NumPy`)
    } else {
      console.error(`[FAIL] Python packages verification failed: ${importOut}`)
      allOk = false
    }

    // 4. Meeko CLI Scripts Check
    const scriptsDir = path.dirname(pythonBin)
    const meekoLigand = path.join(scriptsDir, "mk_prepare_ligand.exe")
    const meekoReceptor = path.join(scriptsDir, "mk_prepare_receptor.exe")
    const meekoLigandPy = path.join(scriptsDir, "mk_prepare_ligand.py")
    const meekoReceptorPy = path.join(scriptsDir, "mk_prepare_receptor.py")

    const hasLigandPrep = fs.existsSync(meekoLigand) || fs.existsSync(meekoLigandPy)
    const hasReceptorPrep = fs.existsSync(meekoReceptor) || fs.existsSync(meekoReceptorPy)

    if (hasLigandPrep && hasReceptorPrep) {
      console.log(`[OK] Meeko structure preparation tools verified (mk_prepare_ligand & mk_prepare_receptor)`)
    } else {
      console.error(`[FAIL] Meeko preparation scripts missing in ${scriptsDir}`)
      allOk = false
    }
  }

  // 5. Worker Script Exists
  const workerPy = path.resolve(process.cwd(), "services/docking/worker.py")
  if (fs.existsSync(workerPy)) {
    console.log(`[OK] AutoDock Vina worker script verified: services/docking/worker.py`)
  } else {
    console.error(`[FAIL] worker.py missing at: ${workerPy}`)
    allOk = false
  }

  // 6. Docking Engine Status Gate Check
  const engineStatus = inspectEngine()
  if (engineStatus.available) {
    console.log(`[OK] Docking engine gate status: AVAILABLE (${engineStatus.message})`)
  } else {
    console.error(`[FAIL] Docking engine gate status: UNAVAILABLE (${engineStatus.missing.join("; ")})`)
    allOk = false
  }

  // 7. Docking Artifacts Directory Check
  const artifactDir = process.env.DOCKING_ARTIFACT_DIR || path.resolve(process.cwd(), ".docking-artifacts")
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true })
    console.log(`[OK] Created docking artifacts directory: ${artifactDir}`)
  } else {
    console.log(`[OK] Docking artifacts directory verified: ${artifactDir}`)
  }

  console.log("")
  if (allOk) {
    console.log("=======================================================")
    console.log("  [SUCCESS] COMPLETE MOLECULAR DOCKING PIPELINE READY")
    console.log("=======================================================\n")
    process.exit(0)
  } else {
    console.error("=======================================================")
    console.error("  [FAILURE] MOLECULAR DOCKING PIPELINE HAS ISSUES")
    console.error("=======================================================\n")
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("Docking verification script failed:", err)
  process.exit(1)
})
