import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import type { ApprovedDockingConfiguration } from "@/lib/domain/models"
import { fetchLigandStructure, StructureError } from "@/services/docking/ligand-preparation"
import { fetchReceptorStructure, receptorChainPdb, type ReceptorRestore } from "@/services/docking/receptor-preparation"
import { parseVinaOutput } from "@/services/docking/parser"
import { dockingProcessEnv, getDockingPython } from "@/services/docking/engine"
import { type DockingStage } from "@/services/docking/types"

export interface VinaExecution {
  vinaVersion?: string
  ligandTool: string
  receptorTool: string
  log: string
  poses: string
  configText: string
  ligandSdf: string
  ligandPdbqt: string
  receptorPdb: string
  receptorPdbqt: string
  ligandSource: string
  receptorSource: string
}

export async function executeVina(input: {
  cid: number | undefined
  pdbId: string | undefined
  receptorChains: string[]
  receptorRestore?: ReceptorRestore
  residueRange?: [number, number]
  configuration: ApprovedDockingConfiguration
  onStage?: (stage: DockingStage) => Promise<void> | void
}): Promise<VinaExecution> {
  await input.onStage?.("Preparing ligand")
  const ligand = await fetchLigandStructure(input.cid)
  await input.onStage?.("Preparing receptor")
  const receptor = await fetchReceptorStructure(input.pdbId)
  const receptorPdb = receptorChainPdb(receptor.pdb, input.receptorChains, input.receptorRestore, input.residueRange)
  if (!receptorPdb) {
    console.error("[docking] receptor preparation produced no ATOM records", input.pdbId, input.receptorChains)
    throw new Error("invalid PDB")
  }
  const work = mkdtempSync(join(tmpdir(), "nanotophea-dock-"))
  const stopWatch = watchStage(work, input.onStage)
  try {
    writeFileSync(join(work, "ligand.sdf"), ligand.sdf, "utf8")
    writeFileSync(join(work, "receptor.pdb"), receptorPdb, "utf8")
    writeFileSync(
      join(work, "job.json"),
      JSON.stringify({
        configuration: input.configuration,
        timeoutSeconds: Number(process.env.DOCKING_TIMEOUT_SECONDS || 900),
      }),
      "utf8",
    )
    const worker = join(process.cwd(), "services", "docking", "worker.py")
    const python = pythonInvocation(worker, work)
    const outcome = await runProcess(python.command, python.args, Number(process.env.DOCKING_TIMEOUT_SECONDS || 900) * 1000)
    const resultPath = join(work, "result.json")
    const result = readJson(resultPath)
    if (!result?.ok) {
      const technical = typeof result?.error === "string" ? result.error : "Vina execution failure"
      console.error("[docking]", technical, result?.detail || outcome.stderr || outcome.stdout)
      throw new Error(technical)
    }
    if (outcome.code !== 0 && !result.ok) {
      throw new Error("Vina execution failure")
    }
    const log = readOptional(join(work, "vina.log"))
    const poses = readOptional(join(work, "poses.pdbqt"))
    const parsed = parseVinaOutput(`${log}\n${poses}`)
    if (!parsed.ok) throw new Error("parsing failure")
    return {
      ...(typeof result.vinaVersion === "string" && result.vinaVersion ? { vinaVersion: result.vinaVersion } : {}),
      ligandTool: String(result.ligandTool ?? "ligand preparation"),
      receptorTool: String(result.receptorTool ?? "receptor preparation"),
      log,
      poses,
      configText: readOptional(join(work, "vina.txt")),
      ligandSdf: ligand.sdf,
      ligandPdbqt: readOptional(join(work, "ligand.pdbqt")),
      receptorPdb: receptorPdb,
      receptorPdbqt: readOptional(join(work, "receptor.pdbqt")),
      ligandSource: ligand.source,
      receptorSource: receptor.source,
    }
  } catch (error) {
    if (error instanceof StructureError) throw error
    const message = error instanceof Error ? error.message : "Vina execution failure"
    if (message === "timeout" || /timed out/i.test(message)) throw new Error("timeout")
    if (
      message === "Docking engine unavailable" ||
      message === "ligand preparation failure" ||
      message === "receptor preparation failure" ||
      message === "parsing failure" ||
      message === "invalid PDB"
    ) {
      throw new Error(message)
    }
    throw new Error(message === "Vina execution failure" ? message : "Vina execution failure")
  } finally {
    stopWatch()
    rmSync(work, { recursive: true, force: true })
  }
}

function watchStage(work: string, onStage?: (stage: DockingStage) => Promise<void> | void): () => void {
  let last = ""
  const timer = setInterval(() => {
    const stage = readOptional(join(work, "stage.txt")).trim()
    if (!stage || stage === last || !onStage) return
    if (
      stage !== "Preparing ligand" &&
      stage !== "Preparing receptor" &&
      stage !== "Running AutoDock Vina" &&
      stage !== "Processing results" &&
      stage !== "Completed"
    ) return
    last = stage
    void onStage(stage)
  }, 800)
  return () => clearInterval(timer)
}

function pythonInvocation(worker: string, workdir: string): { command: string; args: string[] } {
  const python = getDockingPython()
  if (python) return { command: python, args: [worker, workdir] }
  return { command: "py", args: ["-3", worker, workdir] }
}

function runProcess(command: string, args: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, env: dockingProcessEnv() })
    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout = `${stdout}${chunk}`.slice(-12000)
    })
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = `${stderr}${chunk}`.slice(-12000)
    })
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error("timeout"))
    }, timeoutMs + 5_000)
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

function readOptional(path: string): string {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return ""
  }
}

function readJson(path: string): { ok?: boolean; error?: string; detail?: string; vinaVersion?: string; ligandTool?: string; receptorTool?: string } | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as { ok?: boolean; error?: string }
  } catch {
    return null
  }
}

export function newJobId(): string {
  return randomUUID()
}
