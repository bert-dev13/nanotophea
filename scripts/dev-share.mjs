import { spawn, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const python = process.platform === "win32"
  ? path.join(root, ".adme-venv", "Scripts", "python.exe")
  : path.join(root, ".adme-venv", "bin", "python")

const vinaBin = process.platform === "win32"
  ? path.join(root, "tools", "vina", "vina.exe")
  : path.join(root, "tools", "vina", "vina")

console.log("")
console.log("===============================================================================")
console.log("                         NANO-HEPATOTEA DEVELOPMENT")
console.log("===============================================================================")
console.log("")

// 1. Environment & Python check
let pythonOk = false
let rdkitOk = false
let admeReady = false
let vinaVer = "Not found"
let vinaOk = false
let dockingOk = false

if (existsSync(python)) {
  pythonOk = true
  const rdkitCheck = spawnSync(python, ["-c", "import rdkit; print('OK')"], { encoding: "utf8" })
  if (rdkitCheck.status === 0 && (rdkitCheck.stdout || "").includes("OK")) {
    rdkitOk = true
  }
  const admeCheck = spawnSync(python, ["-c", "import admet_ai, fastapi, uvicorn; print('OK')"], { encoding: "utf8" })
  if (admeCheck.status === 0 && (admeCheck.stdout || "").includes("OK")) {
    admeReady = true
  }
  const meekoCheck = spawnSync(python, ["-c", "import meeko, gemmi, openbabel; print('OK')"], { encoding: "utf8" })
  if (meekoCheck.status === 0 && (meekoCheck.stdout || "").includes("OK")) {
    dockingOk = true
  }
}

if (existsSync(vinaBin)) {
  const vRes = spawnSync(vinaBin, ["--version"], { encoding: "utf8" })
  const out = (vRes.stdout || vRes.stderr || "").trim()
  if (vRes.status === 0 && out.toLowerCase().includes("vina")) {
    vinaOk = true
    vinaVer = out.replace(/^AutoDock Vina\s*/i, "").trim() || "v1.2.7"
  }
}

console.log(`Environment ....... \x1b[32m✓\x1b[0m`)
console.log(`Python ............ ${pythonOk ? `\x1b[32m✓\x1b[0m ${python}` : `\x1b[31m✗ (Missing: run setup.bat)\x1b[0m`}`)
console.log(`RDKit ............. ${rdkitOk ? `\x1b[32m✓\x1b[0m` : `\x1b[31m✗\x1b[0m`}`)
console.log(`ADME Engine ....... ${admeReady ? `\x1b[32m✓ Ready\x1b[0m` : `\x1b[33m! Standby\x1b[0m`}`)
console.log(`AutoDock Vina ..... ${vinaOk ? `\x1b[32m✓ ${vinaVer}\x1b[0m` : `\x1b[31m✗\x1b[0m`}`)
console.log(`Docking Engine .... ${dockingOk && vinaOk ? `\x1b[32m✓ Ready\x1b[0m` : `\x1b[33m! Standby\x1b[0m`}`)
console.log("")

const children = []
let closing = false

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  })
  children.push(child)
  return child
}

function stop(child) {
  if (!child?.pid || child.killed) return
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true })
    return
  }
  child.kill("SIGTERM")
}

function shutdown() {
  if (closing) return
  closing = true
  for (const child of children) stop(child)
}

console.log("Starting NANO-HEPATOTEA...")
console.log("Starting local ADME service...")
console.log("")
console.log(`Next.js ........... \x1b[32m✓ Running\x1b[0m (http://localhost:3000)`)
console.log(`ADME Service ...... \x1b[32m✓ Running\x1b[0m (http://127.0.0.1:8000)`)
console.log("")
console.log("Local: http://localhost:3000")
console.log("Press Ctrl+C to stop all services.")
console.log("-------------------------------------------------------------------------------")
console.log("")

// 1. Local ADME service
const adme = start(python, ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000"], {
  cwd: path.join(root, "services", "admet-api"),
})

// 2. Next.js development server
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next")
const next = start(process.execPath, [nextBin, "dev", "--port", "3000"])

adme.on("error", (error) => {
  console.error(error.code === "ENOENT"
    ? "The local ADME environment was not found at .adme-venv. Run .\\setup.bat to configure it."
    : `ADME error: ${error.message}`)
})

adme.on("exit", (code) => {
  if (!closing) {
    console.warn(`ADME service exited with code ${code ?? 0}.`)
  }
})

next.on("exit", (code) => {
  if (closing) return
  shutdown()
  process.exit(code ?? 0)
})

process.on("SIGINT", () => {
  shutdown()
  process.exit(0)
})
process.on("SIGTERM", shutdown)
