import type { DockingMode, DockingSearchBox } from "@/lib/domain/models"

export interface ParsedVinaOutput {
  modes: DockingMode[]
  bestMode: number
  bestAffinityKcalMol: number
  vinaVersion?: string
  exhaustiveness?: number
  searchBox?: DockingSearchBox
  poseModel?: string
}

export type VinaParseResult =
  | { ok: true; result: ParsedVinaOutput }
  | { ok: false; message: string }

const MODE_ROW = /^\s*(\d+)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/
const REMARK_RESULT = /REMARK\s+VINA\s+RESULT:\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/gi

/**
 * Read an AutoDock Vina log or PDBQT. Affinities come only from the mode table
 * or REMARK VINA RESULT lines. Missing fields stay missing.
 */
export function parseVinaOutput(text: string): VinaParseResult {
  const source = text.replace(/^\uFEFF/, "")
  if (!source.trim()) {
    return { ok: false, message: "The file is empty." }
  }

  const fromTable = modesFromTable(source)
  const modes = fromTable.length > 0 ? fromTable : modesFromRemarks(source)
  if (modes.length === 0) {
    return {
      ok: false,
      message: "This file does not contain an AutoDock Vina mode table. Import the Vina log, or a PDBQT file that includes REMARK VINA RESULT lines.",
    }
  }

  const best = modes.reduce((picked, mode) => {
    if (mode.affinityKcalMol < picked.affinityKcalMol) return mode
    if (mode.affinityKcalMol === picked.affinityKcalMol && mode.mode < picked.mode) return mode
    return picked
  }, modes[0]!)

  const poseModel = extractPoseModel(source, best.mode)
  const vinaVersion = readVersion(source)
  const exhaustiveness = readExhaustiveness(source)
  const searchBox = readSearchBox(source)

  return {
    ok: true,
    result: {
      modes,
      bestMode: best.mode,
      bestAffinityKcalMol: best.affinityKcalMol,
      ...(vinaVersion ? { vinaVersion } : {}),
      ...(exhaustiveness != null ? { exhaustiveness } : {}),
      ...(searchBox ? { searchBox } : {}),
      ...(poseModel ? { poseModel } : {}),
    },
  }
}

/** Coordinates for one mode, when the file actually contains them. */
export function extractPoseModel(text: string, mode: number): string | undefined {
  const blocks = [...text.matchAll(/MODEL\s+(\d+)[^\n]*\n([\s\S]*?)ENDMDL/gi)]
  if (blocks.length > 0) {
    const match = blocks.find((block) => Number(block[1]) === mode) ?? blocks[mode - 1] ?? blocks[0]
    const body = match?.[2] ?? ""
    if (!/^(?:ATOM|HETATM)\s/m.test(body)) return undefined
    return `MODEL ${mode}\n${body.trim()}\nENDMDL\n`
  }
  const lines = text.split(/\r?\n/).filter((line) => /^(?:ATOM|HETATM|CONECT|TER)\s/.test(line))
  if (lines.length === 0) return undefined
  return `MODEL ${mode}\n${lines.join("\n")}\nENDMDL\n`
}

function modesFromTable(text: string): DockingMode[] {
  const modes: DockingMode[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = MODE_ROW.exec(line)
    if (!match) continue
    modes.push({
      mode: Number(match[1]),
      affinityKcalMol: Number(match[2]),
      rmsdLowerBound: Number(match[3]),
      rmsdUpperBound: Number(match[4]),
    })
  }
  return uniqueModes(modes)
}

function modesFromRemarks(text: string): DockingMode[] {
  const modes: DockingMode[] = []
  for (const match of text.matchAll(REMARK_RESULT)) {
    modes.push({
      mode: modes.length + 1,
      affinityKcalMol: Number(match[1]),
      rmsdLowerBound: Number(match[2]),
      rmsdUpperBound: Number(match[3]),
    })
  }
  return modes
}

function uniqueModes(modes: DockingMode[]): DockingMode[] {
  const seen = new Set<number>()
  return modes.filter((mode) => {
    if (seen.has(mode.mode)) return false
    seen.add(mode.mode)
    return true
  })
}

function readVersion(text: string): string | undefined {
  const match = text.match(/(?:AutoDock\s+)?Vina(?:\s+version)?\s+v?(\d+\.\d+(?:\.\d+)?)/i)
  return match?.[1]
}

function readExhaustiveness(text: string): number | undefined {
  const match = text.match(/exhaustiveness\s*[:=]\s*(\d+(?:\.\d+)?)/i)
  if (!match) return undefined
  const value = Number(match[1])
  return value > 0 ? value : undefined
}

function readSearchBox(text: string): DockingSearchBox | undefined {
  const center = text.match(/Center:\s*X\s*(-?\d+(?:\.\d+)?)\s*Y\s*(-?\d+(?:\.\d+)?)\s*Z\s*(-?\d+(?:\.\d+)?)/i)
  const size = text.match(/Size:\s*X\s*(\d+(?:\.\d+)?)\s*Y\s*(\d+(?:\.\d+)?)\s*Z\s*(\d+(?:\.\d+)?)/i)
  if (center && size) {
    return box(center.slice(1), size.slice(1))
  }
  const named = (key: string) => text.match(new RegExp(`${key}\\s*[=:]\\s*(-?\\d+(?:\\.\\d+)?)`, "i"))?.[1]
  const values = ["center_x", "center_y", "center_z", "size_x", "size_y", "size_z"].map(named)
  const found = values.filter((value): value is string => Boolean(value))
  if (found.length === 6) return box(found.slice(0, 3), found.slice(3))
  return undefined
}

function box(center: string[], size: string[]): DockingSearchBox | undefined {
  const [centerX, centerY, centerZ] = center.map(Number)
  const [sizeX, sizeY, sizeZ] = size.map(Number)
  if ([centerX, centerY, centerZ, sizeX, sizeY, sizeZ].some((n) => !Number.isFinite(n))) return undefined
  if (sizeX! <= 0 || sizeY! <= 0 || sizeZ! <= 0) return undefined
  return { centerX: centerX!, centerY: centerY!, centerZ: centerZ!, sizeX: sizeX!, sizeY: sizeY!, sizeZ: sizeZ! }
}
