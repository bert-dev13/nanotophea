import { useState, useEffect, useRef, useCallback } from "react"
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts"
import {
  Play, Plus, X, Beaker, Microscope, Zap, Dna, Activity,
  Clock, CheckCircle2, RotateCcw, Layers, TrendingDown,
  BarChart3, Info, BookmarkPlus, Atom,
} from "lucide-react"
import { PHYTOCHEMICALS } from "../data/compounds"
import { CELL_LINES, type CellLineKey } from "../data/celllines"

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssayType = "mtt" | "ros" | "yap" | "bax" | "ldh" | "dpph"

export interface SavedResult {
  id: string
  savedAt: string
  assay: AssayType
  assayLabel: string
  cellLine: CellLineKey
  cellLineName: string
  compound: string
  compoundName: string
  ic50: number
  maxInhibition: number
  selectivityIndex: number
  posControl: string
  posControlName: string
  posControlIC50: number
  timePoint: number
  concentrations: number[]
  replicates: number
  color: string
}

interface RunConfig {
  assay: AssayType
  cellLine: CellLineKey
  compoundId: string
  concentrations: number[]
  positiveControlId: string
  timePoint: 24 | 48 | 72 | 96
  replicates: number
}

interface ConcentrationResult {
  conc: number; reps: number[]; mean: number; sd: number
  inhibition: number; absorbance: number; absSD: number
}

interface ExperimentResults {
  config: RunConfig
  ic50: number; maxInhibition: number; selectivityIndex: number
  data: ConcentrationResult[]
  posControlData: ConcentrationResult[]
  posControlIC50: number
  rosData?: { conc: number; fold: number; fluorescence: number }[]
  enzymeData?: { label: string; change: string; up: boolean }[]
  yapData?: { protein: string; control: number; treated: number; change: number }[]
  baxData?: { marker: string; val: number; direction: "up" | "down" }[]
  flowData?: { viable: number; earlyApo: number; lateApo: number; necrosis: number }
  ldhData?: { conc: number; cytotox: number; ldh_abs: number; ldh_activity: number }[]
}

// ── Positive controls ─────────────────────────────────────────────────────────

interface PosControl {
  id: string; name: string; type: string; color: string
  description: string; hillN: number
  ic50Factors: Partial<Record<CellLineKey, number>>
}

const POS_CONTROLS: PosControl[] = [
  {
    id: "sorafenib", name: "Sorafenib", color: "#e879f9",
    type: "Targeted therapy · Raf/VEGFR inhibitor",
    description: "FDA-approved standard of care for advanced HCC. Targets Raf kinase and VEGFR2.",
    hillN: 1.8,
    ic50Factors: { HepG2: 0.31, Huh7: 0.39, Hep3B: 0.29, PLCPRF5: 0.47, SNU449: 0.56, SNU182: 0.28, SNU387: 0.68, SKHEP1: 0.44, L02: 3.14, WRL68: 2.95, LX2: 3.77 },
  },
  {
    id: "doxorubicin", name: "Doxorubicin", color: "#f97316",
    type: "Anthracycline · DNA intercalator",
    description: "Broad-spectrum cytotoxic antibiotic. Very high potency but significant hepatotoxicity.",
    hillN: 2.1,
    ic50Factors: { HepG2: 0.042, Huh7: 0.056, Hep3B: 0.046, PLCPRF5: 0.069, SNU449: 0.082, SNU182: 0.039, SNU387: 0.096, SKHEP1: 0.062, L02: 0.62, WRL68: 0.59, LX2: 0.81 },
  },
  {
    id: "5fu", name: "5-Fluorouracil", color: "#34d399",
    type: "Antimetabolite · Pyrimidine analog",
    description: "Inhibits thymidylate synthase and RNA processing. Used in FOLFOX regimens.",
    hillN: 1.6,
    ic50Factors: { HepG2: 0.93, Huh7: 1.11, Hep3B: 1.00, PLCPRF5: 1.35, SNU449: 1.57, SNU182: 0.86, SNU387: 1.79, SKHEP1: 1.43, L02: 7.15, WRL68: 6.89, LX2: 8.18 },
  },
  {
    id: "cisplatin", name: "Cisplatin", color: "#a78bfa",
    type: "Platinum compound · DNA crosslinker",
    description: "Alkylates DNA causing intrastrand crosslinks. Classic reference cytotoxic.",
    hillN: 1.9,
    ic50Factors: { HepG2: 0.61, Huh7: 0.79, Hep3B: 0.67, PLCPRF5: 0.90, SNU449: 1.08, SNU182: 0.56, SNU387: 1.20, SKHEP1: 0.97, L02: 3.44, WRL68: 3.23, LX2: 3.96 },
  },
  {
    id: "freequercetin", name: "Free Quercetin", color: "#fbbf24",
    type: "Unencapsulated control · same phytochemical",
    description: "Quercetin without nanocarrier. IC₅₀ 3–5× higher — directly shows nanoencapsulation benefit.",
    hillN: 1.4,
    ic50Factors: { HepG2: 3.79, Huh7: 3.65, Hep3B: 3.74, PLCPRF5: 3.50, SNU449: 3.27, SNU182: 3.79, SNU387: 3.17, SKHEP1: 3.35, L02: 2.99, WRL68: 2.91, LX2: 3.15 },
  },
  {
    id: "dmso", name: "DMSO (vehicle)", color: "#546e8a",
    type: "Negative control · solvent vehicle",
    description: "0.1% DMSO vehicle. Establishes minimal baseline cytotoxicity (<5% viability loss).",
    hillN: 1.0,
    ic50Factors: { HepG2: 50, Huh7: 50, Hep3B: 50, PLCPRF5: 50, SNU449: 50, SNU182: 50, SNU387: 50, SKHEP1: 50, L02: 50, WRL68: 50, LX2: 50 },
  },
]

const COMPOUND_FACTORS: Record<string, number> = {
  quercetin: 1.00, rutin: 1.10, luteolin: 1.05, kaempferol: 1.20,
  ellagicacid: 0.95, gallicacid: 3.00, corilagin: 0.62, geraniin: 0.41,
  phyllanthin: 1.80, hypophyllanthin: 1.90, astragalin: 1.30,
  betasitosterol: 2.50, niranthin: 2.00, securinine: 2.80,
}

const TIME_FACTORS: Record<number, number> = { 24: 1.55, 48: 1.22, 72: 1.00, 96: 0.88 }

const ASSAY_META: Record<AssayType, { label: string; color: string; abbr: string }> = {
  mtt:  { label: "MTT Cytotoxicity Assay",    color: "#4fc3f7", abbr: "MTT"  },
  ros:  { label: "ROS / Oxidative Stress Assay", color: "#a78bfa", abbr: "ROS" },
  yap:  { label: "Hippo–YAP Signaling",        color: "#4fc3f7", abbr: "YAP"  },
  bax:  { label: "BAX Apoptosis Pathway",      color: "#fb923c", abbr: "BAX"  },
  ldh:  { label: "LDH Cytotoxicity Assay",     color: "#f472b6", abbr: "LDH"  },
  dpph: { label: "DPPH Antioxidant Assay",     color: "#34d399", abbr: "DPPH" },
}

// ── Computation ───────────────────────────────────────────────────────────────

const seededRand = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const hillViability = (C: number, ic50: number, n: number): number =>
  C === 0 ? 100 : Math.max(2, 100 / (1 + (C / ic50) ** n))

const computeIC50 = (clKey: CellLineKey, compId: string, time: number): number => {
  const cl = CELL_LINES[clKey]
  const base = cl?.ic50 ?? 20
  return base * (COMPOUND_FACTORS[compId] ?? 1) * (TIME_FACTORS[time] ?? 1)
}

function runExperiment(config: RunConfig, seed: number): ExperimentResults {
  const rand = seededRand(seed)
  const noise = () => 1 + (rand() * 2 - 1) * 0.055
  const ic50 = computeIC50(config.cellLine, config.compoundId, config.timePoint)
  const pc = POS_CONTROLS.find(p => p.id === config.positiveControlId)!
  const cl = CELL_LINES[config.cellLine]
  const baseIC50 = cl?.ic50 ?? 20
  const pcIC50 = baseIC50 * (pc.ic50Factors[config.cellLine] ?? 1) * (TIME_FACTORS[config.timePoint] ?? 1)
  const hillN = 1.6

  const makeRow = (C: number, ic50val: number, n: number): ConcentrationResult => {
    const mean = hillViability(C, ic50val, n)
    const reps = Array.from({ length: config.replicates }, () => +(mean * noise()).toFixed(1))
    const actualMean = +(reps.reduce((a, b) => a + b, 0) / reps.length).toFixed(1)
    const sdVal = reps.length > 1
      ? +(Math.sqrt(reps.reduce((s, r) => s + (r - actualMean) ** 2, 0) / (reps.length - 1))).toFixed(2)
      : 0
    const absMean = +(actualMean / 100 * 1.842 * noise()).toFixed(3)
    const absSD = +(sdVal / 100 * 1.842).toFixed(3)
    return { conc: C, reps, mean: actualMean, sd: sdVal, inhibition: +(100 - actualMean).toFixed(1), absorbance: absMean, absSD }
  }

  const data = config.concentrations.map(c => makeRow(c, ic50, hillN))
  const posControlData = config.concentrations.map(c => makeRow(c, pcIC50, pc.hillN))
  const maxInhibition = Math.max(...data.map(d => d.inhibition))
  const normalIC50 = computeIC50("L02", config.compoundId, config.timePoint)
  const siIndex = +(normalIC50 / ic50).toFixed(1)

  let rosData, enzymeData, yapData, baxData, flowData, ldhData

  if (config.assay === "ros") {
    rosData = config.concentrations.map(c => ({
      conc: c,
      fold: c === 0 ? 1 : +( 1 + (c / ic50) * 2.4 * noise()).toFixed(2),
      fluorescence: c === 0 ? 100 : +(100 * (1 + (c / ic50) * 2.4 * noise())).toFixed(1),
    }))
    const d = data.at(-2)!
    enzymeData = [
      { label: "SOD", change: `+${(d.inhibition * 1.4).toFixed(0)}%`, up: true },
      { label: "Catalase", change: `+${(d.inhibition * 1.1).toFixed(0)}%`, up: true },
      { label: "GPx", change: `+${(d.inhibition * 0.88).toFixed(0)}%`, up: true },
      { label: "MDA", change: `-${(d.inhibition * 0.89).toFixed(0)}%`, up: false },
      { label: "4-HNE", change: `-${(d.inhibition * 0.74).toFixed(0)}%`, up: false },
      { label: "Carbonyl", change: `-${(d.inhibition * 0.63).toFixed(0)}%`, up: false },
    ]
  }

  if (config.assay === "yap") {
    const doseRatio = Math.min((config.concentrations.at(-2) ?? 50) / ic50, 2.5)
    yapData = [
      { protein: "YAP1",      treated: +(1 / (1 + doseRatio * 0.9)).toFixed(2) },
      { protein: "TEAD4",     treated: +(1 / (1 + doseRatio * 0.78)).toFixed(2) },
      { protein: "LATS1",     treated: +(1 + doseRatio * 0.82).toFixed(2) },
      { protein: "MOB1",      treated: +(1 + doseRatio * 0.68).toFixed(2) },
      { protein: "p-YAP S127",treated: +(1 + doseRatio * 1.14).toFixed(2) },
      { protein: "CYR61",     treated: +(1 / (1 + doseRatio * 0.75)).toFixed(2) },
      { protein: "CTGF",      treated: +(1 / (1 + doseRatio * 0.71)).toFixed(2) },
    ].map(r => ({ ...r, control: 1.0, change: +((r.treated - 1) * 100).toFixed(0) }))
  }

  if (config.assay === "bax") {
    const doseRatio = Math.min((config.concentrations.at(-2) ?? 50) / ic50, 2.5)
    baxData = [
      { marker: "BAX",        val: +(1 + doseRatio * 2.24 * noise()).toFixed(2), direction: "up" as const },
      { marker: "BCL-2",      val: +(1 / (1 + doseRatio * 1.2) * noise()).toFixed(2), direction: "down" as const },
      { marker: "BAX/BCL-2", val: +(1 + doseRatio * 10.57 * noise()).toFixed(2), direction: "up" as const },
      { marker: "Cyt-c",      val: +(1 + doseRatio * 1.87 * noise()).toFixed(2), direction: "up" as const },
      { marker: "CASP-9",     val: +(1 + doseRatio * 1.51 * noise()).toFixed(2), direction: "up" as const },
      { marker: "CASP-3",     val: +(1 + doseRatio * 2.08 * noise()).toFixed(2), direction: "up" as const },
      { marker: "PARP",       val: +(1 / (1 + doseRatio * 3.2) * noise()).toFixed(2), direction: "down" as const },
    ]
    const liveBase = hillViability(config.concentrations.at(-2) ?? 50, ic50, hillN)
    const apoPct = 100 - liveBase
    flowData = {
      viable: +(liveBase * 0.14 * noise()).toFixed(1),
      earlyApo: +(apoPct * 0.48 * noise()).toFixed(1),
      lateApo: +(apoPct * 0.44 * noise()).toFixed(1),
      necrosis: +(apoPct * 0.08 * noise()).toFixed(1),
    }
  }

  if (config.assay === "ldh") {
    const ldhIC50 = ic50 * 1.38
    const spon = +(3 + rand() * 2).toFixed(1)
    ldhData = config.concentrations.map(c => {
      if (c === 0) {
        return { conc: 0, cytotox: +spon.toFixed(1), ldh_abs: +(0.05 + spon / 100 * 2.05 * noise()).toFixed(3), ldh_activity: +(spon / 100 * 445 * noise()).toFixed(1) }
      }
      const viab = hillViability(c, ldhIC50, hillN)
      const cytotox = Math.min(94, Math.max(spon, 100 - viab) * noise())
      return {
        conc: c,
        cytotox: +cytotox.toFixed(1),
        ldh_abs: +(0.05 + cytotox / 100 * 2.05 * noise()).toFixed(3),
        ldh_activity: +(cytotox / 100 * 445 * noise()).toFixed(1),
      }
    })
  }

  return {
    config, ic50: +ic50.toFixed(2), maxInhibition: +maxInhibition.toFixed(1),
    selectivityIndex: siIndex, data, posControlData, posControlIC50: +pcIC50.toFixed(2),
    rosData, enzymeData, yapData, baxData, flowData, ldhData,
  }
}

// ── Lab Log ───────────────────────────────────────────────────────────────────

const LAB_STEPS: Record<AssayType, string[]> = {
  mtt: [
    "Seeding 5×10³ cells/well in 96-well flat-bottom plate…",
    "24h pre-incubation at 37°C, 5% CO₂…",
    "Preparing compound serial dilutions in serum-free DMEM…",
    "Adding test compound to designated wells (n replicates)…",
    "Adding positive control compound to reference wells…",
    "Incubating for specified time point at 37°C, 5% CO₂…",
    "Aspirating media; adding 10 µL MTT reagent (0.5 mg/mL)…",
    "4h formazan formation period at 37°C…",
    "Solubilising formazan crystals with 100 µL DMSO/well…",
    "Reading absorbance at 570 nm (reference: 630 nm)…",
    "Computing % viability: (A_treated / A_control) × 100…",
    "Nonlinear regression — Hill equation — IC₅₀ computation…",
    "Statistical analysis: one-way ANOVA, Tukey post-hoc…",
    "Experiment complete. Generating results…",
  ],
  ros: [
    "Seeding 2×10⁴ cells/well in 6-well plates…",
    "24h pre-incubation at 37°C, 5% CO₂…",
    "Loading cells with 10 µM DCFH-DA probe (30 min, 37°C)…",
    "Washing 3× with PBS to remove excess probe…",
    "Adding test compound at specified concentrations…",
    "Incubation for specified time point…",
    "Measuring DCF fluorescence at Ex 488 nm / Em 525 nm…",
    "Quantifying ROS fold-change vs. untreated control…",
    "Measuring antioxidant enzyme activities (SOD, CAT, GPx)…",
    "Quantifying lipid peroxidation markers (MDA, 4-HNE)…",
    "Statistical analysis complete. Results ready…",
  ],
  yap: [
    "Seeding cells in 6-well plates for protein extraction…",
    "Compound treatment and incubation…",
    "Washing with ice-cold PBS; scraping into lysis buffer…",
    "Protein quantification by Bradford assay…",
    "Resolving proteins on 10-12% SDS-PAGE gel…",
    "Transfer to PVDF membrane (wet transfer, 100V, 1h)…",
    "Blocking with 5% skim milk in TBST (1h, RT)…",
    "Incubating with primary antibodies: anti-YAP1, LATS1, TEAD4…",
    "HRP-conjugated secondary antibodies (1h, RT)…",
    "ECL chemiluminescence detection…",
    "Densitometry analysis (ImageJ); normalised to β-actin…",
    "qRT-PCR validation of CYR61, CTGF target genes…",
    "Statistical analysis. Results ready…",
  ],
  bax: [
    "Treating cells at specified concentrations and time point…",
    "Collecting cells by trypsinisation + centrifugation…",
    "Washing 2× with cold PBS; counting 1×10⁵ cells/tube…",
    "Staining with Annexin V-FITC (15 min, dark, RT)…",
    "Adding Propidium Iodide (PI) 2 min before acquisition…",
    "Acquiring on flow cytometer (10,000 events/sample)…",
    "Gating on singlets; setting quadrant gates from unstained ctrl…",
    "Extracting BAX, BCL-2 protein for western blot analysis…",
    "Measuring caspase-3/9 activity (colorimetric kit)…",
    "PARP cleavage confirmation by western blot…",
    "BAX/BCL-2 ratio and apoptotic index computation…",
    "Statistical analysis. Results ready…",
  ],
  ldh: [
    "Seeding 5×10³ cells/well in 96-well flat-bottom plate…",
    "24h pre-incubation at 37°C, 5% CO₂…",
    "Preparing compound serial dilutions in complete DMEM…",
    "Adding compound wells; adding Triton X-100 (max lysis ctrl)…",
    "Adding positive control to reference wells…",
    "Incubating for specified time point at 37°C, 5% CO₂…",
    "Centrifuging plate at 600×g for 5 min (4°C)…",
    "Collecting 50 µL supernatant per well into fresh 96-well plate…",
    "Adding 50 µL CytoTox 96® substrate solution per well…",
    "30 min incubation at RT in dark…",
    "Adding 50 µL stop solution (1 N acetic acid)…",
    "Reading absorbance at 490 nm (reference: 620 nm)…",
    "Computing: %cytotox = (OD_exp − OD_spon)/(OD_max − OD_spon)×100…",
    "Statistical analysis complete. Results ready…",
  ],
  dpph: [
    "Dissolving DPPH• in analytical-grade ethanol to 0.1 mM (amber vials)…",
    "Preparing compound stock; performing 2-fold serial dilutions…",
    "Equilibrating DPPH• solution at 37°C for 10 min in dark…",
    "Pipetting 100 µL DPPH• per well of 96-well microplate…",
    "Adding 50 µL compound dilutions to wells (n replicates)…",
    "Adding 50 µL positive control to reference wells…",
    "Sealing plate; incubating at 37°C in darkness for reaction time…",
    "Reading absorbance at 517 nm (reference: 700 nm)…",
    "Computing % RSA: [(A_control − A_sample) / A_control] × 100…",
    "Nonlinear regression — Hill equation — IC₅₀ and TEAC computation…",
    "DFT parameter analysis (BDE, IP, HOMO). Results ready…",
  ],
}

function LabLog({ assay, onDone }: { assay: AssayType; onDone: () => void }) {
  const [lines, setLines] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const steps = LAB_STEPS[assay]
  const endRef = useRef<HTMLDivElement>(null)
  const TT = ASSAY_META[assay]

  useEffect(() => {
    if (step >= steps.length) { onDone(); return }
    const t = setTimeout(() => {
      const now = new Date()
      const ts = `[${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}]`
      setLines(l => [...l, `${ts} ${steps[step]}`])
      setStep(s => s + 1)
    }, step === 0 ? 200 : 300 + Math.random() * 260)
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [lines])

  const pct = Math.round((step / steps.length) * 100)
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#f4f9ff", borderColor: "#dde5ef" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#dde5ef" }}>
        <span className="text-xs font-mono" style={{ color: TT.color }}>◉ RUNNING — {TT.abbr} EXPERIMENT</span>
        <span className="text-xs font-mono" style={{ color: "#546e8a" }}>{pct}%</span>
      </div>
      <div className="h-1" style={{ background: "#dde5ef" }}>
        <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${TT.color},#4fc3f7)` }} />
      </div>
      <div className="p-3 h-48 overflow-y-auto font-mono text-xs space-y-0.5" style={{ color: "#546e8a" }}>
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2">
            <span style={{ color: "#8098b4", flexShrink: 0 }}>{l.slice(0, 11)}</span>
            <span style={{ color: i === lines.length - 1 ? TT.color : "#546e8a" }}>{l.slice(12)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

// ── Visualisation components ──────────────────────────────────────────────────

const TT_STYLE = {
  backgroundColor: "#1a2744", border: "1px solid #2d4470",
  borderRadius: 8, color: "#e8f4ff", fontSize: 11, fontFamily: "monospace",
}

function MetricCard({ label, value, unit, sub, color = "#00d4aa", icon: Icon }: {
  label: string; value: string | number; unit?: string; sub?: string
  color?: string; icon?: React.ElementType
}) {
  return (
    <div className="rounded-xl p-3 border flex flex-col gap-0.5" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={11} style={{ color }} />}
        <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-xs" style={{ color: "#546e8a" }}>{unit}</span>}
      </div>
      {sub && <span className="text-[11px]" style={{ color: "#546e8a" }}>{sub}</span>}
    </div>
  )
}

function WesternBlot({ yapData, lanes }: { yapData: NonNullable<ExperimentResults["yapData"]>; lanes: number[] }) {
  const laneLabels = ["Control", ...lanes.filter(c => c > 0).slice(0, 4).map(c => `${c}µM`)]
  const laneCount = laneLabels.length
  const laneW = Math.min(60, (340 - 60) / laneCount)
  const getBandOp = (p: typeof yapData[0], li: number) =>
    li === 0 ? 0.85 : Math.max(0.05, 0.85 * (1 - (li / (laneCount - 1)) * (1 - p.treated)))
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#f4f9ff", borderColor: "#dde5ef" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#dde5ef" }}>
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>Western Blot Simulation · Densitometry</span>
      </div>
      <div className="p-3">
        <svg viewBox={`0 0 ${60 + laneCount * laneW + 16} ${yapData.length * 34 + 28}`} className="w-full">
          {laneLabels.map((l, i) => (
            <text key={l} x={60 + i * laneW + laneW / 2} y={12} textAnchor="middle" fill="#546e8a" fontSize="7" fontFamily="monospace">{l}</text>
          ))}
          <text x={4} y={yapData.length * 34 + 20} fill="#546e8a" fontSize="6.5" fontFamily="monospace">β-Actin</text>
          {laneLabels.map((_, i) => <rect key={i} x={60 + i * laneW + 3} y={yapData.length * 34 + 12} width={laneW - 6} height={10} rx={2} fill="#0d1f3c" opacity="0.75" />)}
          {yapData.map((p, pi) => {
            const y = pi * 34 + 18; const isUp = p.treated > 1; const bc = isUp ? "#00d4aa" : "#fb923c"
            return (
              <g key={p.protein}>
                <text x={4} y={y + 7} fill={bc} fontSize="6.5" fontFamily="monospace">{p.protein}</text>
                <text x={4} y={y + 15} fill="#dde5ef" fontSize="5.5" fontFamily="monospace">{p.treated.toFixed(2)}×</text>
                {laneLabels.map((_, li) => {
                  const op = getBandOp(p, li)
                  return <rect key={li} x={60 + li * laneW + 3} y={y} width={laneW - 6} height={13} rx={2} fill={bc} opacity={op} />
                })}
              </g>
            )
          })}
        </svg>
        <div className="flex gap-3 mt-1 text-[11px] font-mono" style={{ color: "#546e8a" }}>
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: "#00d4aa" }} />Up</span>
          <span><span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: "#fb923c" }} />Down</span>
        </div>
      </div>
    </div>
  )
}

function FlowPlot({ flow, seed }: { flow: ExperimentResults["flowData"]; seed: number }) {
  if (!flow) return null
  const rand = seededRand(seed + 99)
  const scale = (pct: number) => Math.round((pct / 100) * 380)
  type Dot = { x: number; y: number; color: string }
  const dots: Dot[] = []
  const addDots = (n: number, xRange: [number,number], yRange: [number,number], color: string) => {
    for (let i = 0; i < n; i++) dots.push({ x: xRange[0] + rand() * (xRange[1] - xRange[0]), y: yRange[0] + rand() * (yRange[1] - yRange[0]), color })
  }
  addDots(scale(flow.viable),  [5,95],  [5,95],  "#00d4aa")
  addDots(scale(flow.earlyApo),[105,195],[5,95],  "#4fc3f7")
  addDots(scale(flow.lateApo), [105,195],[105,195],"#fb923c")
  addDots(scale(flow.necrosis),[5,95],  [105,195],"#f472b6")
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#f4f9ff", borderColor: "#dde5ef" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#dde5ef" }}>
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>Flow Cytometry · Annexin V (x) / PI (y) · 10,000 events</span>
      </div>
      <div className="p-3 flex gap-3">
        <svg viewBox="0 0 210 210" className="flex-1">
          <rect width="210" height="210" fill="#f4f9ff" />
          <rect x="5" y="5" width="200" height="200" fill="#f4f7fc" />
          <line x1="105" y1="5" x2="105" y2="205" stroke="#dde5ef" strokeWidth="1" />
          <line x1="5" y1="105" x2="205" y2="105" stroke="#dde5ef" strokeWidth="1" />
          <text x="55" y="16" textAnchor="middle" fill="#546e8a" fontSize="6.5" fontFamily="monospace">Necrosis</text>
          <text x="157" y="16" textAnchor="middle" fill="#546e8a" fontSize="6.5" fontFamily="monospace">Late Apo</text>
          <text x="55" y="115" textAnchor="middle" fill="#546e8a" fontSize="6.5" fontFamily="monospace">Viable</text>
          <text x="157" y="115" textAnchor="middle" fill="#546e8a" fontSize="6.5" fontFamily="monospace">Early Apo</text>
          {dots.map((d, i) => <circle key={i} cx={5 + d.x} cy={5 + d.y} r={0.9} fill={d.color} opacity={0.7} />)}
          <text x="105" y="208" textAnchor="middle" fill="#546e8a" fontSize="6.5" fontFamily="monospace">Annexin V-FITC</text>
        </svg>
        <div className="space-y-1.5 min-w-24">
          {[
            { label: "Viable", pct: flow.viable, color: "#00d4aa" },
            { label: "Early Apo", pct: flow.earlyApo, color: "#4fc3f7" },
            { label: "Late Apo", pct: flow.lateApo, color: "#fb923c" },
            { label: "Necrosis", pct: flow.necrosis, color: "#f472b6" },
          ].map(q => (
            <div key={q.label} className="rounded-lg px-2 py-1 border text-center" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <div className="text-sm font-bold font-mono" style={{ color: q.color }}>{q.pct.toFixed(1)}%</div>
              <div className="text-[11px]" style={{ color: "#546e8a" }}>{q.label}</div>
            </div>
          ))}
          <p className="text-[11px] font-mono pt-0.5" style={{ color: "#546e8a" }}>
            Total apo: <span style={{ color: "#00d4aa" }}>{(flow.earlyApo + flow.lateApo).toFixed(1)}%</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Results sections ──────────────────────────────────────────────────────────

function DoseResponseChart({ results, pc }: { results: ExperimentResults; pc: PosControl }) {
  const chartData = results.data.map((d, i) => ({
    conc: d.conc, compound: d.mean, posCtrl: results.posControlData[i]?.mean ?? 0,
  }))
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Dose–Response Curve · Cell Viability (%)</p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
          <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 9 }} label={{ value: "µM", position: "insideBottomRight", offset: 0, fill: "#546e8a", fontSize: 9 }} />
          <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} domain={[0, 110]} />
          <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
          <ReferenceLine y={50} stroke="#fb923c" strokeDasharray="4 4" label={{ value: "IC₅₀", fill: "#fb923c", fontSize: 9 }} />
          <Line type="monotone" dataKey="compound" stroke="#00d4aa" strokeWidth={2} dot={{ r: 3, fill: "#00d4aa" }} name="Test compound" />
          <Line type="monotone" dataKey="posCtrl" stroke={pc.color} strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 2, fill: pc.color }} name={pc.name} />
          <Legend wrapperStyle={{ fontSize: 10, color: "#546e8a" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function LDHCytotoxChart({ results, pc }: { results: ExperimentResults; pc: PosControl }) {
  if (!results.ldhData) return null
  const posIC50 = results.posControlIC50 * 1.38
  const ldhN = 1.6
  const chartData = results.ldhData.map((d, i) => ({
    conc: d.conc,
    compound: d.cytotox,
    posCtrl: d.conc === 0 ? 3 : Math.min(94, 100 - Math.max(2, 100 / (1 + (d.conc / posIC50) ** ldhN))),
  }))
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>LDH Release · % Cytotoxicity (490 nm)</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
          <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 9 }} label={{ value: "µM", position: "insideBottomRight", offset: 0, fill: "#546e8a", fontSize: 9 }} />
          <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} domain={[0, 105]} />
          <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
          <ReferenceLine y={50} stroke="#fb923c" strokeDasharray="4 4" label={{ value: "50%", fill: "#fb923c", fontSize: 9 }} />
          <ReferenceLine y={95} stroke="#546e8a" strokeDasharray="2 4" label={{ value: "Triton max", fill: "#546e8a", fontSize: 8 }} />
          <Bar dataKey="compound" fill="#f472b6" radius={[2, 2, 0, 0]} name="Test compound" opacity={0.85} />
          <Bar dataKey="posCtrl" fill={pc.color} radius={[2, 2, 0, 0]} name={pc.name} opacity={0.55} />
          <Legend wrapperStyle={{ fontSize: 10, color: "#546e8a" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DataTable({ results }: { results: ExperimentResults }) {
  const isLDH = results.config.assay === "ldh"
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>
        Raw Data Table (n={results.config.replicates}, mean ± SD)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ borderBottom: "1px solid #1a3050" }}>
              {["Conc (µM)", "Replicates", "Mean ± SD", isLDH ? "LDH A₄₉₀ ± SD" : "A₅₇₀ ± SD", isLDH ? "Cytotox %" : "Inhibition %", "Grade"].map(h => (
                <th key={h} className="text-left py-1.5 pr-3 font-normal" style={{ color: "#546e8a" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(isLDH ? (results.ldhData ?? results.data).map((d: any, i: number) => ({
              conc: d.conc, reps: results.data[i]?.reps ?? [],
              mean: isLDH ? d.cytotox : results.data[i]?.mean,
              sd: results.data[i]?.sd,
              absorbance: d.ldh_abs ?? results.data[i]?.absorbance,
              absSD: results.data[i]?.absSD ?? 0,
              inhibition: d.cytotox ?? results.data[i]?.inhibition,
            })) : results.data).map((row: any, i: number) => {
              const inh = row.inhibition ?? row.cytotox ?? 0
              const grade = inh > 70 ? "High" : inh > 40 ? "Moderate" : inh > 15 ? "Low" : "Minimal"
              const gc = inh > 70 ? "#fb923c" : inh > 40 ? "#f472b6" : inh > 15 ? "#4fc3f7" : "#34d399"
              return (
                <tr key={i} style={{ borderBottom: "1px solid #0f2240" }}>
                  <td className="py-1 pr-3" style={{ color: "#0d1f3c" }}>{row.conc === 0 ? "0 (ctrl)" : row.conc}</td>
                  <td className="py-1 pr-3" style={{ color: "#546e8a" }}>{(row.reps ?? []).join(" · ")}</td>
                  <td className="py-1 pr-3" style={{ color: "#00d4aa" }}>{(row.mean ?? 0).toFixed(1)} ± {(row.sd ?? 0).toFixed(1)}</td>
                  <td className="py-1 pr-3" style={{ color: "#4fc3f7" }}>{(row.absorbance ?? 0).toFixed(3)} ± {(row.absSD ?? 0).toFixed(3)}</td>
                  <td className="py-1 pr-3" style={{ color: inh > 50 ? "#fb923c" : "#0d1f3c" }}>{inh.toFixed(1)}</td>
                  <td style={{ color: gc }}>{grade}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ROSSection({ results }: { results: ExperimentResults }) {
  if (!results.rosData) return null
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>ROS Fold-Change vs Control</p>
        <ResponsiveContainer width="100%" height={170}>
          <AreaChart data={results.rosData} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
            <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} /><stop offset="95%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
            <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 9 }} />
            <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [`${v.toFixed(2)}×`, "ROS Fold"]} />
            <ReferenceLine y={1} stroke="#546e8a" strokeDasharray="4 4" label={{ value: "Baseline", fill: "#546e8a", fontSize: 8 }} />
            <Area type="monotone" dataKey="fold" stroke="#a78bfa" fill="url(#rg)" strokeWidth={2} dot={{ r: 2.5, fill: "#a78bfa" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Antioxidant Enzyme Panel</p>
        <div className="grid grid-cols-2 gap-2">
          {results.enzymeData?.map(e => (
            <div key={e.label} className="rounded-lg p-2 border text-center" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
              <div className="text-sm font-bold font-mono" style={{ color: e.up ? "#00d4aa" : "#fb923c" }}>{e.change}</div>
              <div className="text-xs" style={{ color: "#546e8a" }}>{e.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function YAPSection({ results }: { results: ExperimentResults }) {
  if (!results.yapData) return null
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Protein Expression Fold-Change</p>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={results.yapData} layout="vertical" margin={{ top: 5, right: 30, left: -5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" horizontal={false} />
            <XAxis type="number" stroke="#546e8a" tick={{ fontSize: 9 }} domain={[0, 2.5]} />
            <YAxis type="category" dataKey="protein" stroke="#546e8a" tick={{ fontSize: 8 }} width={65} />
            <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [`${v.toFixed(2)}×`]} />
            <ReferenceLine x={1} stroke="#546e8a" strokeDasharray="4 4" />
            <Bar dataKey="treated" fill="#4fc3f7" radius={[0, 2, 2, 0]}
              label={{ position: "right", fill: "#546e8a", fontSize: 8, formatter: (v: number) => v.toFixed(2) }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <WesternBlot yapData={results.yapData} lanes={results.config.concentrations} />
    </div>
  )
}

function BAXSection({ results, seed }: { results: ExperimentResults; seed: number }) {
  if (!results.baxData) return null
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Apoptosis Marker Fold-Change</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={results.baxData} margin={{ top: 5, right: 8, left: -15, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
            <XAxis dataKey="marker" stroke="#546e8a" tick={{ fontSize: 8 }} angle={-30} textAnchor="end" />
            <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [`${v.toFixed(2)}×`]} />
            <ReferenceLine y={1} stroke="#546e8a" strokeDasharray="4 4" />
            <Bar dataKey="val" fill="#fb923c" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <FlowPlot flow={results.flowData} seed={seed} />
    </div>
  )
}

function LDHSection({ results }: { results: ExperimentResults }) {
  if (!results.ldhData) return null
  const ldhActData = results.ldhData.map(d => ({ conc: d.conc, activity: d.ldh_activity, abs: d.ldh_abs }))
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>LDH Enzyme Activity (mU/mL) vs. Concentration</p>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={ldhActData} margin={{ top: 5, right: 8, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
          <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 9 }} label={{ value: "µM", position: "insideBottomRight", offset: 0, fill: "#546e8a", fontSize: 9 }} />
          <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} />
          <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [`${v.toFixed(1)} mU/mL`, "LDH Activity"]} />
          <Bar dataKey="activity" fill="#f472b6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs mt-2" style={{ color: "#1e4878" }}>
        <Info size={10} className="inline mr-1" style={{ color: "#4fc3f7" }} />
        Higher LDH activity indicates greater membrane disruption. Complementary to MTT: when MTT viability decreases, LDH release correspondingly increases — confirming true cytotoxicity rather than metabolic suppression alone.
      </p>
    </div>
  )
}

// ── Results dashboard ─────────────────────────────────────────────────────────

function ResultsDashboard({
  results, seed, pc, onSave, saved,
}: {
  results: ExperimentResults; seed: number; pc: PosControl; onSave: () => void; saved: boolean
}) {
  const compound = PHYTOCHEMICALS.find(c => c.id === results.config.compoundId)!
  const cl = CELL_LINES[results.config.cellLine]
  const meta = ASSAY_META[results.config.assay]
  const siColor = results.selectivityIndex >= 3 ? "#00d4aa" : results.selectivityIndex >= 2 ? "#fbbf24" : "#fb923c"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: meta.color + "40" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <CheckCircle2 size={14} style={{ color: meta.color }} />
              <span className="text-sm font-bold" style={{ color: meta.color }}>Experiment Complete</span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: meta.color + "20", color: meta.color }}>{meta.label}</span>
            </div>
            <p className="text-xs font-mono" style={{ color: "#546e8a" }}>
              {compound.name} · {cl?.name ?? results.config.cellLine} · {results.config.timePoint}h · vs {pc.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs font-mono" style={{ color: "#546e8a" }}>{results.config.assay === "ldh" ? "LDH IC₅₀" : "IC₅₀"}</div>
              <div className="text-2xl font-bold font-mono" style={{ color: meta.color }}>{results.ic50}</div>
              <div className="text-xs font-mono" style={{ color: "#546e8a" }}>µM</div>
            </div>
            {!saved ? (
              <button onClick={onSave}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all"
                style={{ borderColor: "#00d4aa", color: "#00d4aa", background: "#00d4aa12" }}>
                <BookmarkPlus size={13} /> Save to Records
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ background: "#00d4aa20", color: "#00d4aa" }}>
                <CheckCircle2 size={13} /> Saved
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="IC₅₀" value={results.ic50} unit="µM" sub="Hill regression" color={meta.color} icon={TrendingDown} />
        <MetricCard label={`${pc.name.slice(0,10)} IC₅₀`} value={results.posControlIC50} unit="µM" sub="positive control" color={pc.color} />
        <MetricCard label={results.config.assay === "ldh" ? "Max Cytotox" : "Max Inhibition"} value={`${results.maxInhibition}%`} sub="at max dose" color="#a78bfa" icon={Activity} />
        <MetricCard label="Selectivity Index" value={results.selectivityIndex} sub="vs L02 (normal)" color={siColor} icon={CheckCircle2} />
      </div>

      {/* Charts */}
      {results.config.assay === "ldh"
        ? <LDHCytotoxChart results={results} pc={pc} />
        : <DoseResponseChart results={results} pc={pc} />
      }
      <DataTable results={results} />
      {results.config.assay === "ros" && <ROSSection results={results} />}
      {results.config.assay === "yap" && <YAPSection results={results} />}
      {results.config.assay === "bax" && <BAXSection results={results} seed={seed} />}
      {results.config.assay === "ldh" && <LDHSection results={results} />}

      {/* IC50 comparison */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>IC₅₀ Comparison</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart
            data={[
              { name: compound.name.slice(0, 12), ic50: results.ic50 },
              { name: pc.name.slice(0, 12), ic50: results.posControlIC50 },
            ]}
            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
            <XAxis dataKey="name" stroke="#546e8a" tick={{ fontSize: 10 }} />
            <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} />
            <Tooltip contentStyle={TT_STYLE} formatter={(v: number) => [`${v.toFixed(2)} µM`, "IC₅₀"]} />
            <Bar dataKey="ic50" radius={[4, 4, 0, 0]}>
              {[meta.color, pc.color].map((c, i) => <rect key={i} fill={c} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs mt-2" style={{ color: "#1e4878" }}>
          <Info size={10} className="inline mr-1" style={{ color: "#4fc3f7" }} />
          {results.ic50 < results.posControlIC50
            ? `${compound.name} (${results.ic50} µM) is more potent than ${pc.name} (${results.posControlIC50} µM) against ${cl?.name ?? results.config.cellLine} at ${results.config.timePoint}h.`
            : `${pc.name} (${results.posControlIC50} µM) outperforms ${compound.name} (${results.ic50} µM) in raw potency; however, selectivity index (SI = ${results.selectivityIndex}×) favours ${compound.name}.`
          }
        </p>
      </div>
    </div>
  )
}

// ── Concentration builder ─────────────────────────────────────────────────────

const PRESETS: Record<string, number[]> = {
  standard: [0, 6.25, 12.5, 25, 50, 100, 200],
  low: [0, 1, 2.5, 5, 10, 25, 50],
  high: [0, 25, 50, 100, 200, 400, 800],
  narrow: [0, 15, 17.5, 20, 22.5, 25, 30],
}

function ConcBuilder({ concs, onChange }: { concs: number[]; onChange: (c: number[]) => void }) {
  const [input, setInput] = useState("")
  const add = () => {
    const v = parseFloat(input)
    if (!isNaN(v) && v >= 0 && !concs.includes(v)) { onChange([...concs, v].sort((a, b) => a - b)); setInput("") }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {concs.map(c => (
          <span key={c} className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border"
            style={{ background: "#ffffff", borderColor: "#dde5ef", color: "#0d1f3c" }}>
            {c === 0 ? "0 (ctrl)" : `${c} µM`}
            <button onClick={() => onChange(concs.filter(x => x !== c))} style={{ color: "#546e8a" }}><X size={9} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input type="number" min={0} step={1} placeholder="Add µM…" value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && add()}
          className="flex-1 rounded-lg px-2 py-1 text-xs font-mono border outline-none"
          style={{ background: "#ffffff", borderColor: "#dde5ef", color: "#0d1f3c" }} />
        <button onClick={add} className="px-2 py-1 rounded-lg border text-xs"
          style={{ borderColor: "#00d4aa", color: "#00d4aa", background: "#00d4aa12" }}>
          <Plus size={11} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {Object.entries(PRESETS).map(([label, vals]) => (
          <button key={label} onClick={() => onChange(vals)}
            className="text-[11px] font-mono px-2 py-0.5 rounded border capitalize"
            style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AssayLabSection({
  fixedAssay,
  onSave,
}: {
  fixedAssay: AssayType
  onSave: (result: SavedResult) => void
}) {
  const meta = ASSAY_META[fixedAssay]
  const [cellLine, setCellLine] = useState<CellLineKey>("HepG2")
  const [compoundId, setCompoundId] = useState("quercetin")
  const [concentrations, setConcentrations] = useState<number[]>(PRESETS.standard)
  const [posControlId, setPosControlId] = useState("sorafenib")
  const [timePoint, setTimePoint] = useState<24 | 48 | 72 | 96>(72)
  const [replicates, setReplicates] = useState(3)
  const [status, setStatus] = useState<"setup" | "running" | "complete">("setup")
  const [results, setResults] = useState<ExperimentResults | null>(null)
  const [seed, setSeed] = useState(12345)
  const [saved, setSaved] = useState(false)

  const runHandler = useCallback(() => {
    setSaved(false); setStatus("running"); setSeed(Date.now())
  }, [])

  const handleLogDone = useCallback(() => {
    const config: RunConfig = { assay: fixedAssay, cellLine, compoundId, concentrations, positiveControlId: posControlId, timePoint, replicates }
    setResults(runExperiment(config, seed))
    setStatus("complete")
  }, [fixedAssay, cellLine, compoundId, concentrations, posControlId, timePoint, replicates, seed])

  const handleSave = useCallback(() => {
    if (!results) return
    const compound = PHYTOCHEMICALS.find(c => c.id === compoundId)!
    const cl = CELL_LINES[cellLine]
    const pc = POS_CONTROLS.find(p => p.id === posControlId)!
    onSave({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      savedAt: new Date().toISOString(),
      assay: fixedAssay, assayLabel: meta.label,
      cellLine, cellLineName: cl?.name ?? cellLine,
      compound: compoundId, compoundName: compound?.name ?? compoundId,
      ic50: results.ic50, maxInhibition: results.maxInhibition,
      selectivityIndex: results.selectivityIndex,
      posControl: posControlId, posControlName: pc.name,
      posControlIC50: results.posControlIC50,
      timePoint, concentrations: [...concentrations], replicates,
      color: meta.color,
    })
    setSaved(true)
  }, [results, fixedAssay, cellLine, compoundId, concentrations, posControlId, timePoint, replicates])

  const reset = () => { setStatus("setup"); setResults(null); setSaved(false) }

  const cl = CELL_LINES[cellLine]
  const compound = PHYTOCHEMICALS.find(c => c.id === compoundId)!
  const pc = POS_CONTROLS.find(p => p.id === posControlId)!

  return (
    <div className="space-y-4">
      {/* Divider */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px" style={{ background: "#dde5ef" }} />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ background: meta.color + "12", borderColor: meta.color + "50" }}>
          <Beaker size={12} style={{ color: meta.color }} />
          <span className="text-xs font-bold" style={{ color: meta.color }}>Run Your Own In Silico Experiment</span>
        </div>
        <div className="flex-1 h-px" style={{ background: "#dde5ef" }} />
      </div>

      {status === "running" && <LabLog assay={fixedAssay} onDone={handleLogDone} />}

      {status === "complete" && results && (
        <>
          <ResultsDashboard results={results} seed={seed}
            pc={POS_CONTROLS.find(p => p.id === posControlId)!}
            onSave={handleSave} saved={saved} />
          <button onClick={reset}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
            <RotateCcw size={12} /> New Experiment
          </button>
        </>
      )}

      {status === "setup" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Left: Cell line */}
          <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
            <p className="text-xs font-mono uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#546e8a" }}>
              <Microscope size={10} /> Cell Line
            </p>
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {[
                { group: "HCC Cancer Lines", keys: ["HepG2","Huh7","Hep3B","PLCPRF5","SNU449","SNU182","SNU387","SKHEP1"] as CellLineKey[] },
                { group: "Normal Controls", keys: ["L02","WRL68","LX2"] as CellLineKey[] },
              ].map(g => (
                <div key={g.group}>
                  <p className="text-[11px] font-mono uppercase py-1.5 px-1" style={{ color: "#8098b4" }}>{g.group}</p>
                  {g.keys.map(k => {
                    const c = CELL_LINES[k]
                    return (
                      <button key={k} onClick={() => setCellLine(k)}
                        className="w-full text-left rounded-lg px-2 py-1.5 transition-all"
                        style={{ background: cellLine === k ? (c?.color ?? "#00d4aa") + "18" : "transparent", borderLeft: `2px solid ${cellLine === k ? (c?.color ?? "#00d4aa") : "transparent"}` }}>
                        <span className="text-xs" style={{ color: cellLine === k ? (c?.color ?? "#00d4aa") : "#1a3558" }}>{c?.name ?? k}</span>
                        <span className="text-[11px] ml-1 font-mono" style={{ color: "#546e8a" }}>p53: {c?.p53?.split(" ")[0]}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Middle: Compound + concentrations */}
          <div className="space-y-4">
            <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#546e8a" }}>
                <Atom size={10} /> Test Compound
              </p>
              <div className="space-y-0.5 max-h-44 overflow-y-auto">
                {PHYTOCHEMICALS.map(c => (
                  <button key={c.id} onClick={() => setCompoundId(c.id)}
                    className="w-full text-left rounded-lg px-2 py-1.5 transition-all"
                    style={{ background: compoundId === c.id ? c.color + "18" : "transparent", borderLeft: `2px solid ${compoundId === c.id ? c.color : "transparent"}` }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-xs" style={{ color: compoundId === c.id ? c.color : "#1a3558" }}>{c.name}</span>
                    </div>
                    <div className="text-[11px] ml-3 font-mono" style={{ color: "#546e8a" }}>{c.class}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#546e8a" }}>
                <Layers size={10} /> Concentrations (µM)
              </p>
              <ConcBuilder concs={concentrations} onChange={setConcentrations} />
            </div>
          </div>

          {/* Right: Pos control + time + run */}
          <div className="space-y-4">
            <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Positive Control</p>
              <div className="space-y-1">
                {POS_CONTROLS.map(p => (
                  <button key={p.id} onClick={() => setPosControlId(p.id)}
                    className="w-full text-left rounded-lg px-2 py-1.5 border transition-all"
                    style={{ background: posControlId === p.id ? p.color + "18" : "transparent", borderColor: posControlId === p.id ? p.color : "transparent" }}>
                    <div className="text-xs font-semibold" style={{ color: posControlId === p.id ? p.color : "#1a3558" }}>{p.name}</div>
                    <div className="text-[11px]" style={{ color: "#546e8a" }}>{p.type}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: "#546e8a" }}><Clock size={10} /> Incubation Time</p>
              <div className="grid grid-cols-4 gap-1 mb-3">
                {([24, 48, 72, 96] as const).map(t => (
                  <button key={t} onClick={() => setTimePoint(t)}
                    className="py-1.5 rounded-lg text-xs font-mono font-bold border transition-all"
                    style={{ background: timePoint === t ? meta.color + "18" : "transparent", borderColor: timePoint === t ? meta.color : "#dde5ef", color: timePoint === t ? meta.color : "#546e8a" }}>
                    {t}h
                  </button>
                ))}
              </div>
              <p className="text-xs font-mono uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: "#546e8a" }}><BarChart3 size={10} /> Replicates</p>
              <div className="grid grid-cols-3 gap-1">
                {[2, 3, 6].map(n => (
                  <button key={n} onClick={() => setReplicates(n)}
                    className="py-1.5 rounded-lg text-xs font-mono font-bold border transition-all"
                    style={{ background: replicates === n ? "#4fc3f720" : "transparent", borderColor: replicates === n ? "#4fc3f7" : "#dde5ef", color: replicates === n ? "#4fc3f7" : "#546e8a" }}>
                    n={n}
                  </button>
                ))}
              </div>
            </div>
            {/* Summary */}
            <div className="rounded-xl border p-3" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
              {[
                ["Cell Line", cl?.name ?? cellLine],
                ["Compound", compound?.name ?? compoundId],
                ["Conc. points", concentrations.length.toString()],
                ["Control", pc?.name ?? posControlId],
                ["Time", `${timePoint}h`],
                ["Replicates", `n=${replicates}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs font-mono">
                  <span style={{ color: "#546e8a" }}>{k}</span>
                  <span style={{ color: "#1a3558" }}>{v}</span>
                </div>
              ))}
            </div>
            <button
              onClick={runHandler}
              disabled={concentrations.length < 2}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: concentrations.length < 2 ? "#dde5ef" : `linear-gradient(135deg, ${meta.color}, #4fc3f7)`,
                color: concentrations.length < 2 ? "#546e8a" : "#f4f7fc",
                cursor: concentrations.length < 2 ? "not-allowed" : "pointer",
              }}>
              <Play size={16} /> Run {meta.abbr} Experiment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
