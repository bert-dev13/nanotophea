import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const python = process.platform === "win32"
  ? path.join(root, ".adme-venv", "Scripts", "python.exe")
  : path.join(root, ".adme-venv", "bin", "python")

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

console.log("")
console.log("Starting NANOTOPHEA, the local ADME service, and the public link.")
console.log("Keep this window open. Ctrl+C stops all of them.")
console.log("")

const adme = start(python, ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000"], {
  cwd: path.join(root, "services", "admet-api"),
})
const next = start(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "--port", "3000"])
const tunnel = start(process.execPath, ["scripts/tunnel.mjs"])

adme.on("error", (error) => {
  console.error(error.code === "ENOENT"
    ? "The local ADME environment was not found at .adme-venv."
    : error.message)
})

adme.on("exit", (code) => {
  if (!closing) console.error(`ADME service stopped (${code ?? 0}). The public link stays up, but assessments cannot run until you start this command again.`)
})

for (const child of [next, tunnel]) {
  child.on("exit", (code) => {
    if (closing) return
    shutdown()
    process.exit(code ?? 0)
  })
}

process.on("SIGINT", () => {
  shutdown()
  process.exit(0)
})
process.on("SIGTERM", shutdown)
