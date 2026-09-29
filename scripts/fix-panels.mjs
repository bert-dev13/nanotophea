import fs from "node:fs"

// Fix LDHPanel from legacy
let ldh = fs.readFileSync("_vite_legacy/src/panels/LDHPanel.tsx", "utf8")
if (!ldh.startsWith('"use client"')) ldh = '"use client"\n\n' + ldh
ldh = ldh.replaceAll("./AssayLabSection", "@/components/panels/AssayLabSection")
fs.writeFileSync("components/panels/LDHPanel.tsx", ldh)
console.log("LDHPanel restored")

const APP = fs.readFileSync("_vite_legacy/src/App.tsx", "utf8")

function extractFn(name) {
  const re = new RegExp("function " + name + "\\b")
  const m = re.exec(APP)
  if (!m) throw new Error("missing " + name)
  const i = m.index
  const openParen = APP.indexOf("(", i)
  let depth = 0
  let mode = "code"
  let j = openParen
  for (; j < APP.length; j++) {
    const c = APP[j]
    if (mode === "code") {
      if (c === '"' || c === "'" || c === "`") {
        mode = c
        continue
      }
      if (c === "(" || c === "{" || c === "[") depth++
      if (c === ")" || c === "}" || c === "]") {
        depth--
        if (depth === 0 && c === ")") {
          j++
          break
        }
      }
    } else if (c === mode && APP[j - 1] !== "\\") {
      mode = "code"
    }
  }
  while (j < APP.length && /\s/.test(APP[j])) j++
  if (APP[j] !== "{") throw new Error("no body for " + name)
  let bodyDepth = 0
  for (; j < APP.length; j++) {
    const c = APP[j]
    if (c === "{") bodyDepth++
    else if (c === "}") {
      bodyDepth--
      if (bodyDepth === 0) return APP.slice(i, j + 1)
    }
  }
  throw new Error("unclosed " + name)
}

const sidebar = extractFn("CellLineSidebar")
const panel = extractFn("CellLinePanel").replace(
  "function CellLinePanel",
  "export default function CellLinePanel",
)

const cellFile = `"use client"

import { useState } from "react"
import {
  Microscope, TrendingDown, Shield, Activity, CheckCircle2, SlidersHorizontal,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts"
import { CELL_LINES, type CellLineKey } from "@/data/celllines"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"

${sidebar}

${panel}
`
fs.writeFileSync("components/panels/CellLinePanel.tsx", cellFile)
console.log("CellLinePanel rewritten", sidebar.length, panel.length)

// Fix broken rect -> Cell if present
let cell = fs.readFileSync("components/panels/CellLinePanel.tsx", "utf8")
cell = cell.replace(
  /<rect key=\{idx\} fill=\{entry\.type === "cancer" \? entry\.color : "#c0ccd8"\} \/>/g,
  '<Cell key={idx} fill={entry.type === "cancer" ? entry.color : "#c0ccd8"} />',
)
fs.writeFileSync("components/panels/CellLinePanel.tsx", cell)

let dock = fs.readFileSync("components/panels/DockingPanel.tsx", "utf8")
dock = dock.replace(
  'import { Cpu, Atom, Activity, CheckCircle2, BrainCircuit } from "lucide-react"',
  'import { Cpu, Atom, Activity, CheckCircle2, BrainCircuit, Database } from "lucide-react"',
)
fs.writeFileSync("components/panels/DockingPanel.tsx", dock)

// Re-extract ProteinPanel completely
const protein = extractFn("ProteinPanel").replace(
  "function ProteinPanel",
  "export default function ProteinPanel",
)
const proteinFile = `"use client"

import { useState } from "react"
import {
  Atom, Activity, CheckCircle2, BrainCircuit, ArrowUpRight, ArrowDownRight, ExternalLink,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { PROTEINS, type ProteinTarget } from "@/data/proteins"
import { DockingViewer3D } from "@/lib/mol3d"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { ConfidenceBar } from "@/components/ui/ConfidenceBar"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"

${protein}
`
fs.writeFileSync("components/panels/ProteinPanel.tsx", proteinFile)
console.log("ProteinPanel rewritten", protein.length)

// Re-extract remaining panels that may be truncated
for (const [name, file, deps] of [
  [
    "ROSPanel",
    "ROSPanel.tsx",
    `import { Zap, Activity, Shield, TrendingDown, CheckCircle2 } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts"
import { ROS_TABLE, ROS_DUAL, ROS_ENZYME } from "@/data/assay-tables"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
  ],
  [
    "BAXPanel",
    "BAXPanel.tsx",
    `import { Activity, TrendingDown, Shield, CheckCircle2, Zap } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts"
import { BAX_TABLE } from "@/data/assay-tables"
import { DockingViewer3D } from "@/lib/mol3d"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
  ],
  [
    "YAPPanel",
    "YAPPanel.tsx",
    `import { Dna, TrendingDown, Activity, Zap, Shield, ChevronRight } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { YAP_TABLE } from "@/data/assay-tables"
import { DockingViewer3D } from "@/lib/mol3d"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
  ],
  [
    "DockingPanel",
    "DockingPanel.tsx",
    `import { useState } from "react"
import { Cpu, Atom, Activity, CheckCircle2, BrainCircuit, Database } from "lucide-react"
import { DOCKING_TARGETS } from "@/data/assay-tables"
import { DockingViewer3D } from "@/lib/mol3d"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { ConfidenceBar } from "@/components/ui/ConfidenceBar"
import { Interpretation } from "@/components/ui/Interpretation"`,
  ],
  [
    "MTTPanel",
    "MTTPanel.tsx",
    `import { FlaskConical, TrendingDown, Activity, Shield, CheckCircle2 } from "lucide-react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { MTT_TABLE } from "@/data/assay-tables"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"`,
  ],
  [
    "ResearchInterpreterPanel",
    "ResearchInterpreterPanel.tsx",
    `import { useState } from "react"
import { BookOpen, BrainCircuit, ChevronUp, ChevronDown, ChevronRight } from "lucide-react"
import { INTERPRETER_SECTIONS } from "@/data/interpreter"
import { SectionHeader } from "@/components/ui/SectionHeader"`,
  ],
  [
    "LoadingScreen",
    "LoadingScreen.tsx",
    `import { useState, useEffect } from "react"
import { FlaskConical } from "lucide-react"`,
  ],
]) {
  const body = extractFn(name).replace(`function ${name}`, `export default function ${name}`)
  fs.writeFileSync(
    `components/panels/${file}`,
    `"use client"\n\n${deps}\n\n${body}\n`,
  )
  console.log("rewrote", file, body.length)
}

console.log("done")
