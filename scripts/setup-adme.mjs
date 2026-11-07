import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const isWin = process.platform === "win32"
const venvDir = path.join(root, ".adme-venv")
const venvPython = isWin
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python")

function logOk(msg) {
  console.log(`  \x1b[32m[OK]\x1b[0m ${msg}`)
}

function logInfo(msg) {
  console.log(`  \x1b[90m[..]\x1b[0m ${msg}`)
}

function logWarn(msg) {
  console.log(`  \x1b[33m[WARN]\x1b[0m ${msg}`)
}

function logFail(msg) {
  console.error(`  \x1b[31m[FAIL]\x1b[0m ${msg}`)
}

export function detectPython311() {
  logInfo("Scanning for Python 3.11 runtime...")

  // 1. Try py -3.11 launcher (standard on Windows)
  try {
    const res = spawnSync("py", ["-3.11", "-c", "import sys; print(sys.executable)"], {
      encoding: "utf8",
      windowsHide: true,
    })
    if (res.status === 0 && res.stdout.trim()) {
      const exe = res.stdout.trim()
      if (existsSync(exe)) return exe
    }
  } catch {}

  // 2. Try python3.11 command
  try {
    const res = spawnSync("python3.11", ["-c", "import sys; print(sys.executable)"], {
      encoding: "utf8",
      windowsHide: true,
    })
    if (res.status === 0 && res.stdout.trim()) {
      const exe = res.stdout.trim()
      if (existsSync(exe)) return exe
    }
  } catch {}

  // 3. Probe known Windows filesystem locations
  if (isWin) {
    const candidates = [
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python311", "python.exe"),
      "C:\\Python311\\python.exe",
      path.join(process.env.ProgramFiles || "", "Python311", "python.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "", "Python311", "python.exe"),
    ]

    for (const cand of candidates) {
      if (cand && existsSync(cand)) {
        try {
          const test = spawnSync(cand, ["-c", "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"], {
            encoding: "utf8",
            windowsHide: true,
          })
          if (test.status === 0 && test.stdout.trim() === "3.11") {
            return cand
          }
        } catch {}
      }
    }

    // 4. Probe py -0p
    try {
      const listRes = spawnSync("py", ["-0p"], { encoding: "utf8", windowsHide: true })
      if (listRes.status === 0) {
        for (const line of listRes.stdout.split(/\r?\n/)) {
          const m = line.match(/-V:3\.11\s+\*?\s+(.*\.exe)/i)
          if (m && m[1] && existsSync(m[1].trim())) {
            return m[1].trim()
          }
        }
      }
    } catch {}
  }

  // 5. Fallback to default python if version is 3.11
  try {
    const defRes = spawnSync("python", ["-c", "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"], {
      encoding: "utf8",
      windowsHide: true,
    })
    if (defRes.status === 0 && defRes.stdout.trim() === "3.11") {
      const p = spawnSync("python", ["-c", "import sys; print(sys.executable)"], { encoding: "utf8", windowsHide: true })
      return p.stdout.trim()
    }
  } catch {}

  return null
}

export function checkVenvHealth(pythonPath) {
  if (!existsSync(pythonPath)) return false
  const testScript = `
import sys
required = ['rdkit', 'meeko', 'gemmi', 'openbabel', 'scipy', 'numpy', 'fastapi', 'uvicorn', 'pydantic', 'torch', 'chemprop', 'admet_ai']
missing = []
for m in required:
    try:
        __import__(m)
    except ImportError:
        missing.append(m)
if missing:
    print("MISSING:" + ",".join(missing))
    sys.exit(1)
print("HEALTHY")
`
  const res = spawnSync(pythonPath, ["-c", testScript], { encoding: "utf8", windowsHide: true })
  return res.status === 0 && res.stdout.includes("HEALTHY")
}

export async function setupAdmeEnvironment() {
  logInfo("Checking Python scientific environment (.adme-venv)...")

  if (existsSync(venvPython) && checkVenvHealth(venvPython)) {
    const vRes = spawnSync(venvPython, ["--version"], { encoding: "utf8", windowsHide: true })
    const ver = (vRes.stdout || vRes.stderr || "").trim()
    logOk(`.adme-venv is healthy and ready (${ver}): ${venvPython}`)
    return true
  }

  // Find host Python 3.11
  const hostPython = detectPython311()
  if (!hostPython) {
    logFail("Python 3.11 is required for HEPATOTEA's scientific stack (RDKit, Chemprop, Meeko, OpenBabel).")
    logWarn("Please install Python 3.11 from https://www.python.org/downloads/release/python-3110/")
    logWarn("Make sure to check 'Add Python to PATH' and install the 'py' launcher during installation.")
    return false
  }

  const hostVerRes = spawnSync(hostPython, ["--version"], { encoding: "utf8", windowsHide: true })
  const hostVer = (hostVerRes.stdout || hostVerRes.stderr || "").trim()
  logOk(`Found validated Python runtime (${hostVer}): ${hostPython}`)

  // Create virtual environment
  if (!existsSync(venvPython)) {
    logInfo("Creating dedicated .adme-venv virtual environment...")
    const createRes = spawnSync(hostPython, ["-m", "venv", venvDir], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    })
    if (createRes.status !== 0 || !existsSync(venvPython)) {
      logFail("Failed to create .adme-venv virtual environment.")
      return false
    }
    logOk("Virtual environment created at .adme-venv")
  }

  // Install pinned requirements
  const reqPath = path.join(root, "requirements-adme.txt")
  if (!existsSync(reqPath)) {
    logFail("requirements-adme.txt is missing from project root.")
    return false
  }

  logInfo("Upgrading pip in .adme-venv...")
  spawnSync(venvPython, ["-m", "pip", "install", "--upgrade", "pip", "--quiet"], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  })

  logInfo("Installing pinned scientific requirements from requirements-adme.txt...")
  const pipRes = spawnSync(venvPython, ["-m", "pip", "install", "-r", reqPath], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  })

  if (pipRes.status !== 0) {
    logFail("Failed to install scientific requirements into .adme-venv.")
    return false
  }

  // Verify health
  if (checkVenvHealth(venvPython)) {
    logOk("Scientific packages successfully installed and verified in .adme-venv.")
    return true
  } else {
    logFail("Verification of scientific packages failed after installation.")
    return false
  }
}

// Standalone execution
if (process.argv[1] && process.argv[1].endsWith("setup-adme.mjs")) {
  console.log("")
  console.log("===============================================================================")
  console.log("              HEPATOTEA PYTHON SCIENTIFIC SETUP (.adme-venv)")
  console.log("===============================================================================")
  console.log("")
  setupAdmeEnvironment().then((ok) => {
    if (!ok) process.exit(1)
    process.exit(0)
  })
}

