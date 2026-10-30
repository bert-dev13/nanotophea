import { existsSync } from "node:fs"
import { delimiter, dirname, join } from "node:path"
import { spawnSync } from "node:child_process"
import { ENGINE_UNAVAILABLE, type EngineStatus } from "@/services/docking/types"

export function describeEngine(found: {
  vina: string | null
  preparer: string | null
  python: boolean
}): EngineStatus {
  const missing: string[] = []
  if (!found.python) {
    missing.push("Python 3 was not found. The docking worker runs on the server, not in the browser.")
  }
  if (!found.vina) {
    missing.push("AutoDock Vina was not found. Install it on the server and set VINA_BIN, or put vina on PATH.")
  }
  if (!found.preparer) {
    missing.push("A structure-preparation tool was not found. Install Meeko (mk_prepare_ligand.py and mk_prepare_receptor.py) or Open Babel (obabel).")
  }
  return {
    available: missing.length === 0,
    message: missing.length === 0 ? "AutoDock Vina" : ENGINE_UNAVAILABLE,
    vinaPath: found.vina,
    preparer: found.preparer,
    python: found.python,
    missing,
  }
}

export function inspectEngine(): EngineStatus {
  return describeEngine({
    vina:
      existing(process.env.VINA_BIN) ||
      existing("C:/projects/nanotophea/tools/vina/vina.exe") ||
      which("vina") ||
      which("vina.exe"),
    preparer:
      besidePython("mk_prepare_ligand.exe") ||
      besidePython("mk_prepare_ligand.py") ||
      existing("C:/projects/nanotophea/.docking-venv/Scripts/mk_prepare_ligand.exe") ||
      which("mk_prepare_ligand.py") ||
      which("mk_prepare_ligand.exe") ||
      besidePython("obabel.exe") ||
      which("obabel") ||
      which("obabel.exe"),
    python: Boolean(
      existing(process.env.DOCKING_PYTHON) ||
      existing("C:/projects/nanotophea/.docking-venv/Scripts/python.exe") ||
      which("py") ||
      which("python") ||
      which("python3")
    ),
  })
}

export function dockingProcessEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  const python = process.env.DOCKING_PYTHON?.trim()
  if (python) {
    const scripts = dirname(python)
    env.PATH = `${scripts}${delimiter}${env.PATH ?? ""}`
  }
  return env
}

function besidePython(name: string): string | null {
  const python = process.env.DOCKING_PYTHON?.trim()
  if (!python) return null
  return existing(join(dirname(python), name))
}

function existing(path: string | null | undefined): string | null {
  const value = path?.trim()
  if (!value || !existsSync(value)) return null
  return value
}

function which(command: string): string | null {
  const finder = process.platform === "win32" ? "where.exe" : "which"
  const result = spawnSync(finder, [command], { encoding: "utf8", windowsHide: true, env: dockingProcessEnv() })
  if (result.status !== 0) return null
  const line = result.stdout.split(/\r?\n/).map((row) => row.trim()).find((row) => existsSync(row))
  return line || null
}
