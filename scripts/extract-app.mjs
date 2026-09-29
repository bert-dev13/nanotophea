/**
 * Extract monolithic src/App.tsx into organized Next.js source files.
 * Run: node scripts/extract-app.mjs
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const APP = fs.readFileSync(path.join(ROOT, "src", "App.tsx"), "utf8")
const OUT = path.join(ROOT, "next-src")

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function write(rel, content) {
  const full = path.join(OUT, rel)
  ensureDir(path.dirname(full))
  fs.writeFileSync(full, content)
  console.log("wrote", rel)
}

function slice(startMarker, endMarker) {
  const start = APP.indexOf(startMarker)
  if (start < 0) throw new Error("Missing start: " + startMarker.slice(0, 60))
  const end = endMarker ? APP.indexOf(endMarker, start + startMarker.length) : APP.length
  if (end < 0) throw new Error("Missing end: " + (endMarker || "").slice(0, 60))
  return APP.slice(start, end)
}

function extractFunction(name) {
  const re = new RegExp(`(?:export\\s+default\\s+)?function ${name}\\b`)
  const m = re.exec(APP)
  if (!m) throw new Error("Function not found: " + name)
  let i = m.index
  // find opening brace of function body
  const braceStart = APP.indexOf("{", i)
  let depth = 0
  for (let j = braceStart; j < APP.length; j++) {
    const c = APP[j]
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return APP.slice(i, j + 1)
    }
  }
  throw new Error("Unclosed function: " + name)
}

function extractConstBlock(name) {
  const re = new RegExp(`const ${name}\\b`)
  const m = re.exec(APP)
  if (!m) throw new Error("Const not found: " + name)
  let i = m.index
  // Find = then determine if object/array/arrow
  const eq = APP.indexOf("=", i)
  let j = eq + 1
  while (/\s/.test(APP[j])) j++
  if (APP[j] === "{" || APP[j] === "[") {
    const open = APP[j]
    const close = open === "{" ? "}" : "]"
    let depth = 0
    for (let k = j; k < APP.length; k++) {
      if (APP[k] === open) depth++
      else if (APP[k] === close) {
        depth--
        if (depth === 0) {
          // include trailing assignment junk until newline after ;
          let end = k + 1
          while (end < APP.length && APP[end] !== "\n") end++
          return APP.slice(i, end)
        }
      }
    }
  }
  // simple assignment to EOL or next blank line after ;
  const semi = APP.indexOf("\n", i)
  // Prefer finding end of statement with ; at line level for multi-line
  let depth = 0
  let inStr = null
  for (let k = eq + 1; k < APP.length; k++) {
    const c = APP[k]
    if (inStr) {
      if (c === "\\" ) { k++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue }
    if (c === "(" || c === "[" || c === "{") depth++
    if (c === ")" || c === "]" || c === "}") depth--
    if (c === ";" && depth <= 0) return APP.slice(i, k + 1)
  }
  throw new Error("Could not extract const: " + name)
}

ensureDir(OUT)

// ── types ────────────────────────────────────────────────────────────────────
write(
  "types/index.ts",
  `export type CellLineKey =
  | "HepG2" | "Huh7" | "Hep3B" | "PLCPRF5" | "SNU449"
  | "SNU182" | "SNU387" | "SKHEP1" | "LX2" | "L02" | "WRL68"

export interface CellLine {
  id: CellLineKey
  name: string
  fullName: string
  type: "cancer" | "normal"
  p53: string
  hbv: string
  source: string
  ic50: number
  ic50Free: number
  maxInhibition: number
  selectivityIndex: number
  doubling: string
  passage: string
  morphology: string
  controlOD: number
  dose: number[]
  viability: number[]
  absorbance: number[]
  apoptosis: number
  rosInduction: number
  baxRatio: number
  yapSuppression: number
  clinicalRelevance: string
  color: string
}

export interface ProteinTarget {
  id: string
  name: string
  gene: string
  pdb: string
  pathway: string
  role: "tumor-suppressor" | "oncogene" | "apoptosis" | "antioxidant" | "invasion"
  bindingScore: number
  ki: string
  rmsd: string
  confidence: number
  interactions: { type: string; residue: string; dist: string }[]
  function: string
  effect: "upregulated" | "downregulated" | "phosphorylated"
  foldChange: number
  color: string
}

export type AssayType = "mtt" | "ros" | "yap" | "bax" | "ldh" | "dpph"

export interface SavedResult {
  id: string
  assay: AssayType
  compound: string
  compoundId: string
  cellLine: string
  cellLineId: string
  timepoint: number
  seed: number
  timestamp: string
  label: string
  ic50: number | null
  maxInhibition: number | null
  notes?: string
  metrics: Record<string, string | number>
}

export type TabId =
  | "overview" | "celllines" | "proteins" | "phytochemicals" | "dockinglab"
  | "dpph" | "mtt" | "ldh" | "ros" | "bax" | "yap" | "docking"
  | "results" | "interpreter" | "dosage"
`
)

// Fix SavedResult by reading AssayLabSection
const assayLab = fs.readFileSync(path.join(ROOT, "src", "panels", "AssayLabSection.tsx"), "utf8")
const savedMatch = assayLab.match(/export interface SavedResult \{[\s\S]*?\n\}/)
if (savedMatch) {
  write(
    "types/index.ts",
    fs.readFileSync(path.join(OUT, "types", "index.ts"), "utf8").replace(
      /export interface SavedResult \{[\s\S]*?\n\}/,
      savedMatch[0].replace("export interface", "export interface")
    )
  )
}

// ── data/celllines.ts ────────────────────────────────────────────────────────
{
  const helpers = slice(
    "const DOSE_POINTS = [0, 6.25, 12.5, 25, 50, 100, 200]",
    "// ── Protein Targets"
  )
  write(
    "data/celllines.ts",
    `import type { CellLine, CellLineKey } from "@/types"\n\nexport type { CellLine, CellLineKey }\n\n${helpers.trim()}\n\nexport { CELL_LINES }\n`
      .replace(/^type CellLineKey[\s\S]*?^}/m, "")
      .replace(/^interface CellLine[\s\S]*?^}/m, "")
      // The slice starts at DOSE_POINTS — CELL_LINES is included. Types were above DOSE_POINTS so OK.
  )
  // Cleaner rewrite: include from DOSE_POINTS through CELL_LINES closing
  write(
    "data/celllines.ts",
    `import type { CellLine, CellLineKey } from "@/types"\n\nexport type { CellLine, CellLineKey }\n\n${helpers.trim()}\n`
  )
}

// ── data/proteins.ts ─────────────────────────────────────────────────────────
{
  const block = slice("// ── Protein Targets", "// ── Shared utilities")
  // strip comment header and interface (use types), keep PROTEINS
  const proteinsOnly = block
    .replace(/^\/\/[^\n]*\n+/, "")
    .replace(/^interface ProteinTarget[\s\S]*?^}\n+/m, "")
  write(
    "data/proteins.ts",
    `import type { ProteinTarget } from "@/types"\n\nexport type { ProteinTarget }\n\n${proteinsOnly.trim()}\n\nexport { PROTEINS }\n`
  )
}

// ── data/assay-tables.ts ─────────────────────────────────────────────────────
{
  const mtt = slice(
    "const DOSE_ARRAY = [0, 6.25, 12.5, 25, 50, 100, 200]",
    "function NanoMascot()"
  )
  const rosExtra = slice(
    "// ROS dual-mechanism chart data",
    "function ROSPanel()"
  )
  const docking = slice(
    "const DOCKING_TARGETS = [",
    "function YAPPanel()"
  )
  write(
    "data/assay-tables.ts",
    `${mtt.trim()}\n\n${rosExtra.replace(/^\/\/[^\n]*\n/, "").trim()}\n\n${docking.trim()}\n\nexport {\n  DOSE_ARRAY, BASE_VIAB, BASE_ABS, MTT_TABLE, ROS_TABLE, YAP_TABLE, BAX_TABLE, RADAR_DATA,\n  ROS_DUAL, ROS_ENZYME, DOCKING_TARGETS,\n}\n`
  )
}

// ── data/tabs.ts ─────────────────────────────────────────────────────────────
write(
  "data/tabs.ts",
  `import type { TabId } from "@/types"

export type { TabId }

export interface NavItem {
  id: TabId
  label: string
  href: string
  color: string
  iconName:
    | "BarChart3" | "Microscope" | "Atom" | "FlaskConical" | "Cpu" | "Zap"
    | "Beaker" | "Activity" | "Dna" | "Database" | "BookOpen" | "Calendar"
}

export const NAV_ITEMS: NavItem[] = [
  { id: "overview",       label: "Overview",         href: "/",              color: "#00d4aa", iconName: "BarChart3" },
  { id: "celllines",      label: "Cell Lines",        href: "/cell-lines",    color: "#00d4aa", iconName: "Microscope" },
  { id: "proteins",       label: "Proteins",          href: "/proteins",      color: "#a78bfa", iconName: "Atom" },
  { id: "phytochemicals", label: "Phytochemicals",    href: "/phytochemicals",color: "#34d399", iconName: "FlaskConical" },
  { id: "dockinglab",     label: "Docking Lab",       href: "/docking-lab",   color: "#4fc3f7", iconName: "Cpu" },
  { id: "dpph",           label: "DPPH Assay",        href: "/dpph",          color: "#34d399", iconName: "Zap" },
  { id: "mtt",            label: "MTT Assay",          href: "/mtt",           color: "#4fc3f7", iconName: "FlaskConical" },
  { id: "ldh",            label: "LDH Assay",          href: "/ldh",           color: "#f472b6", iconName: "Beaker" },
  { id: "ros",            label: "ROS Assay",         href: "/ros",           color: "#a78bfa", iconName: "Zap" },
  { id: "bax",            label: "BAX Pathway",       href: "/bax",           color: "#fb923c", iconName: "Activity" },
  { id: "yap",            label: "Hippo–YAP",         href: "/yap",           color: "#4fc3f7", iconName: "Dna" },
  { id: "docking",        label: "AutoDock Vina",     href: "/docking",       color: "#34d399", iconName: "Cpu" },
  { id: "results",        label: "Results Record",    href: "/results",       color: "#fbbf24", iconName: "Database" },
  { id: "interpreter",    label: "Interpreter",       href: "/interpreter",   color: "#fbbf24", iconName: "BookOpen" },
  { id: "dosage",         label: "Dosage Planner",    href: "/dosage",        color: "#4ade80", iconName: "Calendar" },
]
`
)

// ── UI components ────────────────────────────────────────────────────────────
write(
  "components/ui/tooltip-style.ts",
  `export const TOOLTIP_STYLE = {
  backgroundColor: "#1a2744", border: "1px solid #2d4470",
  borderRadius: 8, color: "#e8f4ff", fontSize: 13, fontFamily: "monospace",
} as const
`
)

{
  const metric = extractFunction("MetricCard")
  write(
    "components/ui/MetricCard.tsx",
    `"use client"\n\nimport type { ElementType } from "react"\n\n${metric.replace(
      "function MetricCard({ label, value, unit, sub, color = \"#00d4aa\", icon: Icon }: {\n  label: string; value: string | number; unit?: string; sub?: string;\n  color?: string; icon?: React.ElementType\n})",
      "export function MetricCard({ label, value, unit, sub, color = \"#00d4aa\", icon: Icon }: {\n  label: string; value: string | number; unit?: string; sub?: string;\n  color?: string; icon?: ElementType\n})"
    )}\n`
  )
}

{
  const fn = extractFunction("SectionHeader")
  write(
    "components/ui/SectionHeader.tsx",
    `"use client"\n\nimport type { ElementType } from "react"\n\n${fn.replace(
      "function SectionHeader({ icon: Icon, title, color, badge }: {\n  icon: React.ElementType; title: string; color: string; badge?: string\n})",
      "export function SectionHeader({ icon: Icon, title, color, badge }: {\n  icon: ElementType; title: string; color: string; badge?: string\n})"
    )}\n`
  )
}

{
  write(
    "components/ui/ConfidenceBar.tsx",
    `"use client"\n\n${extractFunction("ConfidenceBar").replace("function ConfidenceBar", "export function ConfidenceBar")}\n`
  )
}

{
  const fn = extractFunction("Interpretation")
  write(
    "components/ui/Interpretation.tsx",
    `"use client"\n\nimport { Info, Database } from "lucide-react"\n\n${fn.replace("function Interpretation", "export function Interpretation")}\n`
  )
}

// ── Helper to wrap a panel ───────────────────────────────────────────────────
function writePanel(filename, deps, body) {
  write(`components/panels/${filename}`, `"use client"\n\n${deps}\n\n${body}\n`)
}

// CellLinePanel + sidebar
{
  const sidebar = extractFunction("CellLineSidebar")
  const panel = extractFunction("CellLinePanel")
  writePanel(
    "CellLinePanel.tsx",
    `import { useState } from "react"
import {
  Microscope, TrendingDown, Shield, Activity, CheckCircle2, SlidersHorizontal,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"
import { CELL_LINES, type CellLineKey } from "@/data/celllines"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
    `${sidebar}\n\n${panel.replace("function CellLinePanel", "export default function CellLinePanel")}`
  )
}

// ProteinPanel
{
  writePanel(
    "ProteinPanel.tsx",
    `import { useState } from "react"
import {
  Atom, Activity, CheckCircle2, BrainCircuit, ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { PROTEINS, type ProteinTarget } from "@/data/proteins"
import { DockingViewer3D } from "@/lib/mol3d"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { ConfidenceBar } from "@/components/ui/ConfidenceBar"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
    extractFunction("ProteinPanel").replace("function ProteinPanel", "export default function ProteinPanel")
  )
}

// LoadingScreen
{
  writePanel(
    "LoadingScreen.tsx",
    `import { useState, useEffect } from "react"
import { FlaskConical } from "lucide-react"`,
    extractFunction("LoadingScreen").replace("function LoadingScreen", "export default function LoadingScreen")
  )
}

// NanoMascot + MascotGuide + Overview
{
  const mascot = extractFunction("NanoMascot")
  const guide = extractFunction("MascotGuide")
  const overview = extractFunction("OverviewPanel")
  writePanel(
    "OverviewPanel.tsx",
    `import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  FlaskConical, Atom, Shield, BarChart3, Microscope, Cpu, Zap, Beaker,
  Activity, Dna, Database, BookOpen, Calendar, CheckCircle2,
} from "lucide-react"
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts"
import { NAV_ITEMS, type TabId } from "@/data/tabs"
import { RADAR_DATA } from "@/data/assay-tables"
import { SectionHeader } from "@/components/ui/SectionHeader"`,
    `${mascot}

function MascotGuide({ onNavigate }: { onNavigate: (href: string) => void }) {
  const tips = [
    { msg: "Hi! I'm Nano — your NANO-HEPATOTEA research guide! Click me for tips!", href: null as string | null },
    { msg: "Start with Cell Lines to see how I fight liver cancer across 11 cell lines!", href: "/cell-lines" },
    { msg: "Visit Proteins to view animated 3D structures of my 12 molecular targets!", href: "/proteins" },
    { msg: "The DPPH tab shows my antioxidant power against free radicals!", href: "/dpph" },
    { msg: "Try AutoDock Vina for interactive 3D docking simulation!", href: "/docking" },
    { msg: "I'm from Sampasampalukan, wrapped in chitosan-TPP nanocarriers!", href: null },
    { msg: "Visit the Interpreter for plain-English explanations of all results!", href: "/interpreter" },
    { msg: "Check the Hippo–YAP tab to see how I suppress tumor growth signals!", href: "/yap" },
  ]
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIdx(i => (i + 1) % tips.length); setVisible(true) }, 300)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleClick = () => {
    const tip = tips[idx]
    if (tip.href) { onNavigate(tip.href); return }
    setVisible(false)
    setTimeout(() => { setIdx(i => (i + 1) % tips.length); setVisible(true) }, 200)
  }

  const tip = tips[idx]
  return (
    <div className="flex items-end gap-3 justify-end mt-6">
      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
        transition: "all 0.3s ease",
        maxWidth: 260,
      }}>
        <div className="relative rounded-2xl rounded-br-sm px-4 py-3 shadow-lg text-sm font-medium leading-relaxed"
          style={{ background: "#ffffff", border: "2px solid #00a88230", color: "#0d1f3c", boxShadow: "0 4px 20px #00a88218" }}>
          {tip.msg}
          {tip.href && (
            <div className="mt-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#00a88215", color: "#00a882" }}>
                → Click Nano to go there
              </span>
            </div>
          )}
          <div className="absolute -bottom-2.5 right-8 w-0 h-0"
            style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid #ffffff" }} />
        </div>
      </div>
      <button onClick={handleClick}
        className="shrink-0 transition-transform hover:scale-110 active:scale-95"
        style={{ animation: "mascot-pulse 3s ease-in-out infinite" }}>
        <NanoMascot />
      </button>
    </div>
  )
}

export default function OverviewPanel() {
  const router = useRouter()
  const onNavigate = (href: string) => router.push(href)
  const MODULE_META: Record<string, string> = {
    celllines: "11 HCC + normal cell lines", proteins: "12 targets · animated 3D PDB",
    phytochemicals: "14 compounds · PubChem 3D animated", dockinglab: "Interactive docking workflow",
    dpph: "Free-radical scavenging · OS proteins", mtt: "Cell viability · IC₅₀ dose–response",
    ldh: "LDH cytotoxicity release assay", ros: "Oxidative stress profiling",
    bax: "Intrinsic apoptosis · 3D BAX structure", yap: "Hippo–YAP · 3D YAP1 structure",
    docking: "AutoDock Vina · animated 3D docking", results: "Saved experiment records",
    interpreter: "Plain-language result guide", dosage: "Tea dosage schedule",
  }

${overview
  .replace(/^function OverviewPanel[\s\S]*?\{[\s\S]*?const MODULE_META[\s\S]*?\n  \}/, "")
  .replace("onTabChange={onTabChange}", "onNavigate={onNavigate}")
  .replace(/onTabChange/g, "onNavigate")
  // Fix module cards that use TABS - replace with NAV_ITEMS
  .replace(/\bTABS\b/g, "NAV_ITEMS")
  .replace(/t\.id !== "overview"/g, 't.id !== "overview"')
  .replace(/onClick=\{\(\) => onNavigate\(t\.id\)\}/g, "onClick={() => onNavigate(t.href)}")
  .replace(/onClick=\{\(\) => onTabChange\(t\.id\)\}/g, "onClick={() => onNavigate(t.href)}")
}
`
  )
}

console.log("Partial extraction complete — continuing with remaining panels via second pass...")

// MTT, ROS, BAX, YAP, Docking, Interpreter — extract raw and wrap
const panelSpecs = [
  {
    name: "MTTPanel",
    file: "MTTPanel.tsx",
    deps: `import { FlaskConical, TrendingDown, Activity, Shield, CheckCircle2 } from "lucide-react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { MTT_TABLE } from "@/data/assay-tables"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
  },
  {
    name: "ROSPanel",
    file: "ROSPanel.tsx",
    deps: `import { Zap, Activity, Shield, TrendingDown, CheckCircle2 } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts"
import { ROS_TABLE, ROS_DUAL, ROS_ENZYME } from "@/data/assay-tables"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
  },
  {
    name: "BAXPanel",
    file: "BAXPanel.tsx",
    deps: `import { Activity, TrendingDown, Shield, CheckCircle2, Zap } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts"
import { BAX_TABLE } from "@/data/assay-tables"
import { DockingViewer3D } from "@/lib/mol3d"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
  },
  {
    name: "YAPPanel",
    file: "YAPPanel.tsx",
    deps: `import { Dna, TrendingDown, Activity, Zap, Shield, ChevronRight } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { YAP_TABLE } from "@/data/assay-tables"
import { DockingViewer3D } from "@/lib/mol3d"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
  },
  {
    name: "DockingPanel",
    file: "DockingPanel.tsx",
    deps: `import { useState } from "react"
import { Cpu, Atom, Activity, CheckCircle2, BrainCircuit } from "lucide-react"
import { DOCKING_TARGETS } from "@/data/assay-tables"
import { DockingViewer3D } from "@/lib/mol3d"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { ConfidenceBar } from "@/components/ui/ConfidenceBar"
import { Interpretation } from "@/components/ui/Interpretation"`,
  },
]

for (const spec of panelSpecs) {
  const body = extractFunction(spec.name).replace(`function ${spec.name}`, `export default function ${spec.name}`)
  writePanel(spec.file, spec.deps, body)
}

// Interpreter — needs INTERPRETER_SECTIONS with icons
{
  const sectionsStart = APP.indexOf("const INTERPRETER_SECTIONS = [")
  const sectionsEnd = APP.indexOf("\nfunction ResearchInterpreterPanel")
  const sections = APP.slice(sectionsStart, sectionsEnd)
  write(
    "data/interpreter.ts",
    `import type { ElementType } from "react"
import { Beaker, FlaskConical, Zap, Dna, Activity, Cpu } from "lucide-react"

export interface InterpreterSection {
  id: string
  icon: ElementType
  color: string
  title: string
  subtitle: string
  content: { heading: string; body: string }[]
}

${sections.replace("const INTERPRETER_SECTIONS", "export const INTERPRETER_SECTIONS: InterpreterSection[]")}
`
  )
  writePanel(
    "ResearchInterpreterPanel.tsx",
    `import { useState } from "react"
import { BookOpen, BrainCircuit, ChevronUp, ChevronDown, ChevronRight } from "lucide-react"
import { INTERPRETER_SECTIONS } from "@/data/interpreter"
import { SectionHeader } from "@/components/ui/SectionHeader"`,
    extractFunction("ResearchInterpreterPanel").replace(
      "function ResearchInterpreterPanel",
      "export default function ResearchInterpreterPanel"
    )
  )
}

// Copy existing panel files with path rewrites
const panelDir = path.join(ROOT, "src", "panels")
for (const file of fs.readdirSync(panelDir)) {
  if (!file.endsWith(".tsx")) continue
  let src = fs.readFileSync(path.join(panelDir, file), "utf8")
  if (!src.startsWith('"use client"') && !src.startsWith("'use client'")) {
    src = '"use client"\n\n' + src
  }
  src = src
    .replaceAll('../data/compounds', '@/data/compounds')
    .replaceAll('../data/celllines', '@/data/celllines')
    .replaceAll('../utils/mol3d', '@/lib/mol3d')
    .replaceAll('./AssayLabSection', '@/components/panels/AssayLabSection')
  write(`components/panels/${file}`, src)
}

// Copy compounds + mol3d
{
  let compounds = fs.readFileSync(path.join(ROOT, "src", "data", "compounds.ts"), "utf8")
  write("data/compounds.ts", compounds)

  let mol = fs.readFileSync(path.join(ROOT, "src", "utils", "mol3d.tsx"), "utf8")
  if (!mol.startsWith('"use client"')) mol = '"use client"\n\n' + mol
  // Use next/image for PubChem fallback optionally — keep img for dynamic external URLs for now
  write("lib/mol3d.tsx", mol)
}

// Copy CSS
write(
  "app/globals.css",
  fs.readFileSync(path.join(ROOT, "src", "index.css"), "utf8") +
    `\nhtml, body { min-height: 100%; }\n`
)

console.log("\\nExtraction finished →", OUT)
