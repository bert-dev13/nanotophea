import { useState, useEffect, useRef, useCallback } from "react"
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, ScatterChart, Scatter, ErrorBar,
} from "recharts"
import {
  Play, Plus, X, FlaskConical, Microscope, Zap, Dna, Activity,
  ChevronDown, ChevronRight, Clock, Beaker, CheckCircle2, Info,
  RotateCcw, Download, Layers, TrendingDown, BrainCircuit, Atom,
  BarChart3, AlertCircle, Cpu, Shield, Circle,
} from "lucide-react"
import { PHYTOCHEMICALS } from "../data/compounds"
import { CELL_LINES, type CellLineKey } from "../data/celllines"

// ── Types ────────────────────────────────────────────────────────────────────

type AssayType = "mtt" | "ros" | "yap" | "bax"
type LabStatus = "setup" | "running" | "complete"

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
  conc: number
  reps: number[]
  mean: number
  sd: number
  inhibition: number
  absorbance: number
  absSD: number
}

interface ExperimentResults {
  config: RunConfig
  ic50: number
  maxInhibition: number
  selectivityIndex: number
  data: ConcentrationResult[]
  posControlData: ConcentrationResult[]
  posControlIC50: number
  // Assay-specific extras
  rosData?: { conc: number; fold: number; fluorescence: number }[]
  yapData?: { protein: string; control: number; treated: number; change: number }[]
  baxData?: { marker: string; val: number; direction: "up" | "down" }[]
  flowData?: { viable: number; earlyApo: number; lateApo: number; necrosis: number }
  enzymeData?: { label: string; change: string; up: boolean }[]
}

// ── Positive controls ────────────────────────────────────────────────────────

interface PosControl {
  id: string; name: string; type: string; color: string
  description: string; hillN: number
  ic50Factors: Partial<Record<CellLineKey, number>>
}

const POS_CONTROLS: PosControl[] = [
  {
    id: "sorafenib", name: "Sorafenib", color: "#e879f9",
    type: "Targeted therapy · Raf/VEGFR inhibitor",
    description: "FDA-approved standard of care for advanced HCC. IC₅₀ 5–14 µM. Targets Raf kinase and VEGFR2.",
    hillN: 1.8,
    ic50Factors: { HepG2: 0.31, Huh7: 0.39, Hep3B: 0.29, PLCPRF5: 0.47, SNU449: 0.56, SNU182: 0.28, SNU387: 0.68, SKHEP1: 0.44, L02: 3.14, WRL68: 2.95, LX2: 3.77 },
  },
  {
    id: "doxorubicin", name: "Doxorubicin", color: "#f97316",
    type: "Anthracycline · DNA intercalator",
    description: "Broad-spectrum cytotoxic antibiotic. IC₅₀ 0.7–2 µM. Very high potency but significant hepatotoxicity.",
    hillN: 2.1,
    ic50Factors: { HepG2: 0.042, Huh7: 0.056, Hep3B: 0.046, PLCPRF5: 0.069, SNU449: 0.082, SNU182: 0.039, SNU387: 0.096, SKHEP1: 0.062, L02: 0.62, WRL68: 0.59, LX2: 0.81 },
  },
  {
    id: "5fu", name: "5-Fluorouracil", color: "#34d399",
    type: "Antimetabolite · Pyrimidine analog",
    description: "Inhibits thymidylate synthase and RNA processing. IC₅₀ 15–40 µM. Used in FOLFOX regimens.",
    hillN: 1.6,
    ic50Factors: { HepG2: 0.93, Huh7: 1.11, Hep3B: 1.00, PLCPRF5: 1.35, SNU449: 1.57, SNU182: 0.86, SNU387: 1.79, SKHEP1: 1.43, L02: 7.15, WRL68: 6.89, LX2: 8.18 },
  },
  {
    id: "cisplatin", name: "Cisplatin", color: "#a78bfa",
    type: "Platinum compound · DNA crosslinker",
    description: "Alkylates DNA causing intrastrand crosslinks. IC₅₀ 10–25 µM. Classic reference cytotoxic.",
    hillN: 1.9,
    ic50Factors: { HepG2: 0.61, Huh7: 0.79, Hep3B: 0.67, PLCPRF5: 0.90, SNU449: 1.08, SNU182: 0.56, SNU387: 1.20, SKHEP1: 0.97, L02: 3.44, WRL68: 3.23, LX2: 3.96 },
  },
  {
    id: "freequercetin", name: "Free Quercetin", color: "#fbbf24",
    type: "Unencapsulated control · same phytochemical",
    description: "Quercetin without nanocarrier. IC₅₀ 3–5× higher than QCN — directly demonstrates nanoencapsulation benefit.",
    hillN: 1.4,
    ic50Factors: { HepG2: 3.79, Huh7: 3.65, Hep3B: 3.74, PLCPRF5: 3.50, SNU449: 3.27, SNU182: 3.79, SNU387: 3.17, SKHEP1: 3.35, L02: 2.99, WRL68: 2.91, LX2: 3.15 },
  },
  {
    id: "dmso", name: "DMSO (vehicle)", color: "#5a8ab0",
    type: "Negative control · solvent vehicle",
    description: "0.1% DMSO vehicle control. Establishes minimal baseline cytotoxicity (<5% viability loss).",
    hillN: 1.0,
    ic50Factors: { HepG2: 50, Huh7: 50, Hep3B: 50, PLCPRF5: 50, SNU449: 50, SNU182: 50, SNU387: 50, SKHEP1: 50, L02: 50, WRL68: 50, LX2: 50 },
  },
]

// Per-phytochemical IC50 multipliers vs quercetin baseline
const COMPOUND_FACTORS: Record<string, number> = {
  quercetin: 1.00, rutin: 1.10, luteolin: 1.05, kaempferol: 1.20,
  ellagicacid: 0.95, gallicacid: 3.00, corilagin: 0.62, geraniin: 0.41,
  phyllanthin: 1.80, hypophyllanthin: 1.90, astragalin: 1.30,
  betasitosterol: 2.50, niranthin: 2.00, securinine: 2.80,
}

const TIME_FACTORS: Record<number, number> = { 24: 1.55, 48: 1.22, 72: 1.00, 96: 0.88 }

// ── Computation engine ────────────────────────────────────────────────────────

const seededRand = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const hillViability = (C: number, ic50: number, n: number): number =>
  C === 0 ? 100 : Math.max(2, 100 / (1 + (C / ic50) ** n))

const computeIC50 = (ic50Base: number, clKey: CellLineKey, compId: string, time: number): number => {
  const cl = CELL_LINES[clKey]
  const base = cl?.ic50 ?? 20
  return base * (COMPOUND_FACTORS[compId] ?? 1) * (TIME_FACTORS[time] ?? 1)
}

function runExperiment(config: RunConfig, seed: number): ExperimentResults {
  const rand = seededRand(seed)
  const noise = () => 1 + (rand() * 2 - 1) * 0.055

  const ic50 = computeIC50(20, config.cellLine, config.compoundId, config.timePoint)
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
    const absBase = 1.842
    const absMean = +(actualMean / 100 * absBase * noise()).toFixed(3)
    const absSD = +(sdVal / 100 * absBase).toFixed(3)
    return {
      conc: C, reps, mean: actualMean, sd: sdVal,
      inhibition: +(100 - actualMean).toFixed(1),
      absorbance: absMean, absSD,
    }
  }

  const data = config.concentrations.map(c => makeRow(c, ic50, hillN))
  const posControlData = config.concentrations.map(c => makeRow(c, pcIC50, pc.hillN))
  const maxInhibition = Math.max(...data.map(d => d.inhibition))
  const normalIC50 = computeIC50(20, config.cellLine === "HepG2" ? "L02" : "L02", config.compoundId, config.timePoint)
  const siIndex = +(normalIC50 / ic50).toFixed(1)

  // ── Always compute all pathway data (shown in full dashboard regardless of assay) ──
  const doseRatioYAP = ic50 > 0 ? Math.min((config.concentrations.at(-2) ?? 100) / ic50, 2.8) : 1
  const cFactor = COMPOUND_FACTORS[config.compoundId] ?? 1
  // Compound-specific pathway potency modifiers (relative to quercetin)
  const pathwayPotency = Math.max(0.3, Math.min(2.0, 1 / cFactor))

  const rosData = config.concentrations.map((c) => {
    const factor = c === 0 ? 1 : 1 + (c / ic50) * 2.4 * pathwayPotency * noise()
    return { conc: c, fold: +factor.toFixed(2), fluorescence: +(factor * 100 * noise()).toFixed(1) }
  })
  const enzymeData = [
    { label: "SOD", change: `+${(data.at(-2)!.inhibition * 1.4 * pathwayPotency).toFixed(0)}%`, up: true },
    { label: "Catalase", change: `+${(data.at(-2)!.inhibition * 1.1 * pathwayPotency).toFixed(0)}%`, up: true },
    { label: "GPx", change: `+${(data.at(-2)!.inhibition * 0.88 * pathwayPotency).toFixed(0)}%`, up: true },
    { label: "MDA", change: `-${(data.at(-2)!.inhibition * 0.89 * pathwayPotency).toFixed(0)}%`, up: false },
    { label: "4-HNE", change: `-${(data.at(-2)!.inhibition * 0.74 * pathwayPotency).toFixed(0)}%`, up: false },
    { label: "Carbonylation", change: `-${(data.at(-2)!.inhibition * 0.63 * pathwayPotency).toFixed(0)}%`, up: false },
  ]

  const yapData = [
    { protein: "YAP1",     control: 1.0, treated: +(1 / (1 + doseRatioYAP * 0.9  * pathwayPotency)).toFixed(2), change: 0 },
    { protein: "TEAD4",    control: 1.0, treated: +(1 / (1 + doseRatioYAP * 0.78 * pathwayPotency)).toFixed(2), change: 0 },
    { protein: "LATS1",    control: 1.0, treated: +(1 + doseRatioYAP * 0.82 * pathwayPotency).toFixed(2), change: 0 },
    { protein: "MOB1",     control: 1.0, treated: +(1 + doseRatioYAP * 0.68 * pathwayPotency).toFixed(2), change: 0 },
    { protein: "p-YAP S127", control: 1.0, treated: +(1 + doseRatioYAP * 1.14 * pathwayPotency).toFixed(2), change: 0 },
    { protein: "CYR61",    control: 1.0, treated: +(1 / (1 + doseRatioYAP * 0.75 * pathwayPotency)).toFixed(2), change: 0 },
    { protein: "CTGF",     control: 1.0, treated: +(1 / (1 + doseRatioYAP * 0.71 * pathwayPotency)).toFixed(2), change: 0 },
  ].map(r => ({ ...r, change: +((r.treated - r.control) / r.control * 100).toFixed(0) }))

  const doseRatioBAX = ic50 > 0 ? Math.min((config.concentrations.at(-2) ?? 100) / ic50, 2.5) : 1
  const baxData = [
    { marker: "BAX",         val: +(1 + doseRatioBAX * 2.24 * pathwayPotency * noise()).toFixed(2), direction: "up"   as const },
    { marker: "BCL-2",       val: +(1 / (1 + doseRatioBAX * 1.2  * pathwayPotency) * noise()).toFixed(2), direction: "down" as const },
    { marker: "BAX/BCL-2",   val: +(1 + doseRatioBAX * 10.57 * pathwayPotency * noise()).toFixed(2), direction: "up"   as const },
    { marker: "Cytochrome c",val: +(1 + doseRatioBAX * 1.87 * pathwayPotency * noise()).toFixed(2), direction: "up"   as const },
    { marker: "CASP-9",      val: +(1 + doseRatioBAX * 1.51 * pathwayPotency * noise()).toFixed(2), direction: "up"   as const },
    { marker: "CASP-3",      val: +(1 + doseRatioBAX * 2.08 * pathwayPotency * noise()).toFixed(2), direction: "up"   as const },
    { marker: "PARP",        val: +(1 / (1 + doseRatioBAX * 3.2  * pathwayPotency) * noise()).toFixed(2), direction: "down" as const },
  ]
  const liveBase = hillViability(config.concentrations.at(-2) ?? 50, ic50, hillN)
  const apoPct = +(100 - liveBase).toFixed(1)
  const flowData = {
    viable:   +(liveBase * 0.14 * noise()).toFixed(1),
    earlyApo: +(apoPct * 0.48 * noise()).toFixed(1),
    lateApo:  +(apoPct * 0.44 * noise()).toFixed(1),
    necrosis: +(apoPct * 0.08 * noise()).toFixed(1),
  }

  return {
    config, ic50: +ic50.toFixed(2), maxInhibition: +maxInhibition.toFixed(1),
    selectivityIndex: siIndex, data, posControlData, posControlIC50: +pcIC50.toFixed(2),
    rosData, yapData, baxData, flowData, enzymeData,
  }
}

// ── Shared UI pieces ─────────────────────────────────────────────────────────

const TT = {
  backgroundColor: "#0a1628", border: "1px solid #1a3050",
  borderRadius: 8, color: "#e2f0ff", fontSize: 11, fontFamily: "monospace",
}

function MetricCard({ label, value, unit, sub, color = "#00d4aa", icon: Icon }: {
  label: string; value: string | number; unit?: string; sub?: string
  color?: string; icon?: React.ElementType
}) {
  return (
    <div className="rounded-xl p-3 border flex flex-col gap-0.5" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={11} style={{ color }} />}
        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "#5a8ab0" }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-[10px]" style={{ color: "#5a8ab0" }}>{unit}</span>}
      </div>
      {sub && <span className="text-[9px]" style={{ color: "#5a8ab0" }}>{sub}</span>}
    </div>
  )
}

// ── Lab Log ──────────────────────────────────────────────────────────────────

const LAB_STEPS: Record<AssayType, string[]> = {
  mtt: [
    "Seeding 5×10³ cells/well in 96-well flat-bottom plate…",
    "24h pre-incubation at 37°C, 5% CO₂…",
    "Preparing compound serial dilutions in serum-free DMEM…",
    "Adding test compound to designated wells (n=3 replicates)…",
    "Adding positive control compound to reference wells…",
    "Incubation for specified time point at 37°C, 5% CO₂…",
    "Aspirating media; adding 10 µL MTT reagent (0.5 mg/mL)…",
    "4h formazan formation period at 37°C…",
    "Solubilising formazan crystals with 100 µL DMSO/well…",
    "Reading absorbance at 570 nm (reference: 630 nm)…",
    "Computing % cell viability: (A_treated / A_control) × 100…",
    "Nonlinear regression — Hill equation — IC₅₀ computation…",
    "Statistical analysis: one-way ANOVA, Tukey post-hoc…",
    "Experiment complete. Generating results…",
  ],
  ros: [
    "Seeding 2×10⁴ cells/well in 6-well plates…",
    "24h pre-incubation at 37°C, 5% CO₂…",
    "Loading cells with 10 µM DCFH-DA fluorescent probe (30 min)…",
    "Washing 3× with PBS to remove excess probe…",
    "Adding test compound at specified concentrations…",
    "Incubation for specified time point…",
    "Measuring DCF fluorescence at Ex 488 nm / Em 525 nm…",
    "Quantifying ROS fold-change vs. untreated control…",
    "Measuring antioxidant enzyme activities (SOD, CAT, GPx)…",
    "Quantifying lipid peroxidation markers (MDA, 4-HNE)…",
    "Computing ROS induction ratio…",
    "Statistical analysis complete. Results ready…",
  ],
  yap: [
    "Seeding cells in 6-well plates for protein extraction…",
    "Compound treatment and incubation…",
    "Washing with ice-cold PBS; scraping cells into lysis buffer…",
    "Protein quantification by Bradford assay…",
    "Resolving proteins on 10-12% SDS-PAGE gel…",
    "Transferring to PVDF membrane (wet transfer, 100V, 1h)…",
    "Blocking with 5% skim milk in TBST (1h, RT)…",
    "Incubating with primary antibodies: anti-YAP1, LATS1, TEAD4…",
    "Incubating with secondary HRP-conjugated antibodies…",
    "ECL chemiluminescence detection…",
    "Densitometry analysis (ImageJ); normalised to β-actin…",
    "qRT-PCR validation of transcriptional targets (CYR61, CTGF)…",
    "Statistical analysis. Results ready…",
  ],
  bax: [
    "Treating cells at specified concentrations and time point…",
    "Collecting cells by trypsinisation and centrifugation…",
    "Washing 2× with cold PBS; counting 1×10⁵ cells/tube…",
    "Staining with Annexin V-FITC (15 min, dark, RT)…",
    "Adding Propidium Iodide (PI) 2 min before acquisition…",
    "Acquiring on flow cytometer (10,000 events/sample)…",
    "Gating on singlets; setting quadrant gates from unstained ctrl…",
    "Extracting BAX, BCL-2 protein for western blot analysis…",
    "Measuring caspase-3/9 activity (colorimetric kit)…",
    "PARP cleavage confirmation by western blot…",
    "Mitochondrial membrane potential (JC-1 assay)…",
    "BAX/BCL-2 ratio and apoptotic index computation…",
    "Statistical analysis. Results ready…",
  ],
}

function LabLog({ assay, onDone }: { assay: AssayType; onDone: () => void }) {
  const [lines, setLines] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const steps = LAB_STEPS[assay]
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (step >= steps.length) { onDone(); return }
    const delay = step === 0 ? 200 : 320 + Math.random() * 280
    const t = setTimeout(() => {
      const now = new Date()
      const ts = `[${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}]`
      setLines(l => [...l, `${ts} ${steps[step]}`])
      setStep(s => s + 1)
    }, delay)
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [lines])

  const pct = Math.round((step / steps.length) * 100)

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#030a12", borderColor: "#1a3050" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#1a3050" }}>
        <span className="text-[10px] font-mono" style={{ color: "#00d4aa" }}>◉ RUNNING EXPERIMENT</span>
        <span className="text-[10px] font-mono" style={{ color: "#5a8ab0" }}>{pct}%</span>
      </div>
      <div className="h-1" style={{ background: "#1a3050" }}>
        <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#00d4aa,#4fc3f7)" }} />
      </div>
      <div className="p-3 h-56 overflow-y-auto font-mono text-[10px] space-y-0.5" style={{ color: "#5a8ab0" }}>
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2">
            <span style={{ color: "#1a4060", flexShrink: 0 }}>{l.slice(0, 11)}</span>
            <span style={{ color: i === lines.length - 1 ? "#00d4aa" : "#5a8ab0" }}>{l.slice(12)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

// ── Western Blot SVG ─────────────────────────────────────────────────────────

function WesternBlot({ yapData, lanes }: { yapData: NonNullable<ExperimentResults["yapData"]>; lanes: number[] }) {
  const proteins = yapData
  const laneLabels = ["Control", ...lanes.filter(c => c > 0).map(c => `${c}µM`)]
  const laneCount = laneLabels.length
  const laneW = Math.min(64, (360 - 60) / laneCount)

  const getBandOpacity = (protein: typeof proteins[0], laneIdx: number) => {
    if (laneIdx === 0) return 0.85
    const ratio = laneIdx / (laneCount - 1)
    return Math.max(0.05, 0.85 * (1 - ratio * (1 - protein.treated)))
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#030a12", borderColor: "#1a3050" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1a3050" }}>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#5a8ab0" }}>Western Blot Simulation — Densitometry</span>
      </div>
      <div className="p-3">
        <svg viewBox={`0 0 ${60 + laneCount * laneW + 20} ${proteins.length * 36 + 30}`} className="w-full">
          {/* Lane headers */}
          {laneLabels.map((l, i) => (
            <text key={l} x={60 + i * laneW + laneW / 2} y={14}
              textAnchor="middle" fill="#5a8ab0" fontSize="7" fontFamily="monospace">{l}</text>
          ))}
          {/* β-actin loading control line */}
          <text x={4} y={proteins.length * 36 + 22} fill="#5a8ab0" fontSize="6.5" fontFamily="monospace">β-Actin</text>
          {laneLabels.map((_, i) => (
            <rect key={i} x={60 + i * laneW + 4} y={proteins.length * 36 + 14}
              width={laneW - 8} height={10} rx={2} fill="#e2f0ff" opacity="0.75" />
          ))}
          {/* Protein bands */}
          {proteins.map((p, pi) => {
            const y = pi * 36 + 20
            const isUp = p.treated > 1
            const bandColor = isUp ? "#00d4aa" : "#fb923c"
            return (
              <g key={p.protein}>
                <text x={4} y={y + 8} fill={isUp ? "#00d4aa" : "#fb923c"} fontSize="7" fontFamily="monospace"
                  fontWeight="500">{p.protein}</text>
                <text x={4} y={y + 17} fill="#1a3050" fontSize="6" fontFamily="monospace">
                  {p.treated.toFixed(2)}×
                </text>
                {laneLabels.map((_, li) => {
                  const op = getBandOpacity(p, li)
                  return (
                    <g key={li}>
                      <rect x={60 + li * laneW + 4} y={y} width={laneW - 8} height={14}
                        rx={2} fill={bandColor} opacity={op} />
                      <text x={60 + li * laneW + laneW / 2} y={y + 10}
                        textAnchor="middle" fill="#030a12" fontSize="6" fontFamily="monospace" opacity={op > 0.3 ? 1 : 0}>
                        {(op * 100).toFixed(0)}%
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
        <div className="flex gap-4 mt-1 text-[9px] font-mono" style={{ color: "#5a8ab0" }}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#00d4aa" }} />Upregulated</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#fb923c" }} />Downregulated</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#e2f0ff", opacity: 0.75 }} />β-Actin (loading ctrl)</span>
        </div>
      </div>
    </div>
  )
}

// ── Flow Cytometry Scatter Plot ───────────────────────────────────────────────

function FlowCytometryPlot({ flow, seed }: { flow: ExperimentResults["flowData"]; seed: number }) {
  if (!flow) return null
  const rand = seededRand(seed + 99)
  const total = flow.viable + flow.earlyApo + flow.lateApo + flow.necrosis
  const scale = (pct: number) => Math.round((pct / 100) * 400)

  type Dot = { x: number; y: number; color: string }
  const dots: Dot[] = []

  const addDots = (n: number, xRange: [number, number], yRange: [number, number], color: string) => {
    for (let i = 0; i < n; i++) {
      dots.push({
        x: xRange[0] + rand() * (xRange[1] - xRange[0]),
        y: yRange[0] + rand() * (yRange[1] - yRange[0]),
        color,
      })
    }
  }

  addDots(scale(flow.viable),    [5, 95],   [5, 95],   "#00d4aa")   // Q3 viable
  addDots(scale(flow.earlyApo),  [105, 195],[5, 95],   "#4fc3f7")   // Q4 early apo
  addDots(scale(flow.lateApo),   [105, 195],[105, 195],"#fb923c")   // Q2 late apo
  addDots(scale(flow.necrosis),  [5, 95],   [105, 195],"#f472b6")   // Q1 necrosis

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#030a12", borderColor: "#1a3050" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#1a3050" }}>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#5a8ab0" }}>
          Flow Cytometry — Annexin V (x) / PI (y) · 10,000 events
        </span>
      </div>
      <div className="p-3 flex gap-4">
        <div className="relative flex-1" style={{ minHeight: 200 }}>
          <svg viewBox="0 0 210 210" className="w-full">
            <rect width="210" height="210" fill="#030a12" />
            {/* Grid background */}
            <rect x="5" y="5" width="200" height="200" fill="#050e1a" />
            {/* Quadrant dividers */}
            <line x1="105" y1="5" x2="105" y2="205" stroke="#1a3050" strokeWidth="1" />
            <line x1="5" y1="105" x2="205" y2="105" stroke="#1a3050" strokeWidth="1" />
            {/* Quadrant labels */}
            <text x="55" y="16" textAnchor="middle" fill="#5a8ab0" fontSize="7" fontFamily="monospace">Q1: Necrosis</text>
            <text x="157" y="16" textAnchor="middle" fill="#5a8ab0" fontSize="7" fontFamily="monospace">Q2: Late Apo</text>
            <text x="55" y="115" textAnchor="middle" fill="#5a8ab0" fontSize="7" fontFamily="monospace">Q3: Viable</text>
            <text x="157" y="115" textAnchor="middle" fill="#5a8ab0" fontSize="7" fontFamily="monospace">Q4: Early Apo</text>
            {/* Dots */}
            {dots.map((d, i) => (
              <circle key={i} cx={5 + d.x} cy={5 + d.y} r={0.9} fill={d.color} opacity={0.7} />
            ))}
            {/* Axes */}
            <text x="105" y="208" textAnchor="middle" fill="#5a8ab0" fontSize="6.5" fontFamily="monospace">Annexin V-FITC</text>
            <text x="3" y="105" textAnchor="middle" fill="#5a8ab0" fontSize="6.5" fontFamily="monospace"
              transform="rotate(-90,3,105)">PI</text>
          </svg>
        </div>
        <div className="space-y-2 min-w-28">
          {[
            { label: "Viable", pct: flow.viable, color: "#00d4aa" },
            { label: "Early Apoptosis", pct: flow.earlyApo, color: "#4fc3f7" },
            { label: "Late Apoptosis", pct: flow.lateApo, color: "#fb923c" },
            { label: "Necrosis", pct: flow.necrosis, color: "#f472b6" },
          ].map(q => (
            <div key={q.label} className="rounded-lg px-2 py-1.5 border text-center" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
              <div className="text-base font-bold font-mono" style={{ color: q.color }}>{q.pct.toFixed(1)}%</div>
              <div className="text-[9px]" style={{ color: "#5a8ab0" }}>{q.label}</div>
            </div>
          ))}
          <div className="text-[9px] font-mono pt-1" style={{ color: "#5a8ab0" }}>
            Total apoptosis:
            <span style={{ color: "#00d4aa" }}> {(flow.earlyApo + flow.lateApo).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Result sections per assay ────────────────────────────────────────────────

function DoseResponseSection({ results, posControl }: { results: ExperimentResults; posControl: PosControl }) {
  const chartData = results.data.map((d, i) => ({
    conc: d.conc,
    compound: d.mean,
    compound_err: d.sd,
    posControl: results.posControlData[i]?.mean ?? 0,
  }))

  return (
    <div className="rounded-xl p-4 border" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
      <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: "#5a8ab0" }}>
        Dose–Response Curve · Cell Viability (%)
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
          <defs>
            <linearGradient id="drg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a3050" />
          <XAxis dataKey="conc" stroke="#5a8ab0" tick={{ fontSize: 9 }}
            label={{ value: "µM", position: "insideBottomRight", offset: 0, fill: "#5a8ab0", fontSize: 9 }} />
          <YAxis stroke="#5a8ab0" tick={{ fontSize: 9 }} domain={[0, 110]} />
          <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
          <ReferenceLine y={50} stroke="#fb923c" strokeDasharray="4 4"
            label={{ value: "IC₅₀", fill: "#fb923c", fontSize: 9 }} />
          <Line type="monotone" dataKey="compound" stroke="#00d4aa" strokeWidth={2}
            dot={{ r: 3, fill: "#00d4aa" }} name="Test Compound" />
          <Line type="monotone" dataKey="posControl" stroke={posControl.color} strokeWidth={1.5}
            strokeDasharray="5 3" dot={{ r: 2, fill: posControl.color }} name={posControl.name} />
          <Legend wrapperStyle={{ fontSize: 10, color: "#5a8ab0" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function DataTable({ results, posControl }: { results: ExperimentResults; posControl: PosControl }) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
      <p className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "#5a8ab0" }}>
        Raw Data Table (n={results.config.replicates} replicates, mean ± SD)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr style={{ borderBottom: "1px solid #1a3050" }}>
              {["Conc (µM)", "Reps (viab %)", "Mean ± SD", "A₅₇₀ ± SD", "Inhibition %", "Grade", `${posControl.name.slice(0,12)} viab%`].map(h => (
                <th key={h} className="text-left py-1.5 pr-3 font-normal" style={{ color: "#5a8ab0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.data.map((row, i) => {
              const inh = row.inhibition
              const grade = inh > 70 ? "High" : inh > 40 ? "Moderate" : inh > 15 ? "Low" : "Minimal"
              const gradeColor = inh > 70 ? "#fb923c" : inh > 40 ? "#f472b6" : inh > 15 ? "#4fc3f7" : "#34d399"
              return (
                <tr key={i} style={{ borderBottom: "1px solid #0f2240" }}>
                  <td className="py-1 pr-3" style={{ color: "#e2f0ff" }}>{row.conc === 0 ? "0 (ctrl)" : row.conc}</td>
                  <td className="py-1 pr-3" style={{ color: "#5a8ab0" }}>{row.reps.join(" · ")}</td>
                  <td className="py-1 pr-3" style={{ color: "#00d4aa" }}>{row.mean.toFixed(1)} ± {row.sd.toFixed(1)}</td>
                  <td className="py-1 pr-3" style={{ color: "#4fc3f7" }}>{row.absorbance.toFixed(3)} ± {row.absSD.toFixed(3)}</td>
                  <td className="py-1 pr-3" style={{ color: inh > 50 ? "#fb923c" : "#e2f0ff" }}>{inh.toFixed(1)}</td>
                  <td className="py-1 pr-3" style={{ color: gradeColor }}>{grade}</td>
                  <td className="py-1" style={{ color: posControl.color }}>
                    {results.posControlData[i]?.mean.toFixed(1) ?? "—"} ± {results.posControlData[i]?.sd.toFixed(1) ?? "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Per-compound DPPH IC50 and ORAC reference values ─────────────────────────
const COMPOUND_ANTIOXIDANT: Record<string, { dpphIC50: number; orac: number; antioxScore: number }> = {
  quercetin:       { dpphIC50: 11.3,  orac: 68.4,  antioxScore: 92 },
  rutin:           { dpphIC50: 14.2,  orac: 54.1,  antioxScore: 86 },
  luteolin:        { dpphIC50: 12.8,  orac: 61.7,  antioxScore: 89 },
  kaempferol:      { dpphIC50: 16.4,  orac: 47.9,  antioxScore: 83 },
  ellagicacid:     { dpphIC50: 9.6,   orac: 78.2,  antioxScore: 95 },
  gallicacid:      { dpphIC50: 8.1,   orac: 89.3,  antioxScore: 97 },
  corilagin:       { dpphIC50: 7.4,   orac: 94.6,  antioxScore: 98 },
  geraniin:        { dpphIC50: 6.9,   orac: 102.1, antioxScore: 99 },
  phyllanthin:     { dpphIC50: 28.7,  orac: 31.4,  antioxScore: 68 },
  hypophyllanthin: { dpphIC50: 31.2,  orac: 28.9,  antioxScore: 64 },
  astragalin:      { dpphIC50: 18.9,  orac: 42.3,  antioxScore: 79 },
  betasitosterol:  { dpphIC50: 62.4,  orac: 18.7,  antioxScore: 41 },
  niranthin:       { dpphIC50: 44.1,  orac: 24.2,  antioxScore: 55 },
  securinine:      { dpphIC50: 38.6,  orac: 19.8,  antioxScore: 47 },
}

function ROSSection({ results }: { results: ExperimentResults }) {
  if (!results.rosData) return null

  const compId     = results.config.compoundId
  const clKey      = results.config.cellLine
  const cl         = CELL_LINES[clKey]
  const isNormal   = cl?.type === "normal"
  const ax         = COMPOUND_ANTIOXIDANT[compId] ?? COMPOUND_ANTIOXIDANT["quercetin"]
  const maxFold    = Math.max(...results.rosData.map(r => r.fold))
  const maxConcRow = results.rosData.at(-1)
  const compLabel  = compId.charAt(0).toUpperCase() + compId.slice(1)

  // ── Cancer cell pro-oxidant metrics ──────────────────────────────────────
  const thresholdCrossed = results.rosData.find(r => r.fold >= 2)
  const thresholdConc    = thresholdCrossed?.conc ?? null
  const aboveThreshold   = results.rosData.filter(r => r.fold >= 2).length
  const pctAbove         = +((aboveThreshold / results.rosData.filter(r => r.conc > 0).length) * 100).toFixed(0)
  const mitoDamage       = maxFold >= 3 ? "Severe" : maxFold >= 2 ? "Moderate" : "Sub-threshold"
  const mitoDamageColor  = maxFold >= 3 ? "#f472b6" : maxFold >= 2 ? "#fb923c" : "#94a3b8"

  // ── Normal hepatocyte protective metrics ──────────────────────────────────
  const nrf2Act  = +(ax.antioxScore * 0.91).toFixed(0)
  const ho1Up    = +(ax.antioxScore * 1.18).toFixed(0)
  const sod      = +(ax.antioxScore * 1.28).toFixed(0)
  const catalase = +(ax.antioxScore * 1.02).toFixed(0)
  const gpx      = +(ax.antioxScore * 0.83).toFixed(0)
  const mdaDown  = +(ax.antioxScore * 0.73).toFixed(0)
  const hneDown  = +(ax.antioxScore * 0.63).toFixed(0)

  // ROS data that exceeds apoptotic threshold
  const rosChartData = results.rosData.map(r => ({
    conc: r.conc,
    cancer_ros: +r.fold.toFixed(2),
    normal_ros: +(1 + (r.fold - 1) * 0.18).toFixed(2), // normal cells stay near baseline
  }))

  // Enzyme chart for normal hepatocytes
  const enzymeData = [
    { label: "HO-1",     change: ho1Up,    type: "up"   },
    { label: "SOD",      change: sod,      type: "up"   },
    { label: "Catalase", change: catalase, type: "up"   },
    { label: "GPx",      change: gpx,      type: "up"   },
    { label: "MDA",      change: -mdaDown, type: "down" },
    { label: "4-HNE",    change: -hneDown, type: "down" },
  ]

  const TTL = { backgroundColor: "#1a2744", border: "1px solid #2d4470", borderRadius: 8, color: "#e8f4ff", fontSize: 11, fontFamily: "monospace" }

  return (
    <div className="space-y-5">

      {/* ── Mechanism header banner ─────────────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dde5ef" }}>
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "linear-gradient(90deg,#fdf4ff,#f0f9f6)" }}>
          <div className="flex items-center gap-2">
            <Zap size={14} style={{ color: "#a78bfa" }} />
            <span className="text-sm font-bold" style={{ color: "#0d1f3c" }}>Dual Oxidative Stress Mechanism</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: "#a78bfa18", color: "#a78bfa", border: "1px solid #a78bfa40" }}>
              ☠ PRO-OXIDANT in Cancer Cells
            </span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: "#00d4aa18", color: "#00a882", border: "1px solid #00d4aa40" }}>
              🛡 ANTIOXIDANT in Normal Hepatocytes
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x" style={{ divideColor: "#dde5ef", borderTop: "1px solid #dde5ef" }}>
          {/* Cancer side */}
          <div className="p-3" style={{ background: "#fdf4ff" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "#a78bfa" }}>
              ☠ HCC Cancer Cells — Pro-oxidant Killing
            </p>
            <p className="text-[10px] leading-relaxed" style={{ color: "#1a3558" }}>
              {compLabel} accumulates intracellular ROS beyond mitochondrial tolerance. Cancer cells, already operating near their ROS ceiling, cannot neutralise the surge — leading to mitochondrial membrane collapse and caspase-driven apoptosis.
            </p>
          </div>
          {/* Normal side */}
          <div className="p-3" style={{ background: "#f0f9f6" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: "#00a882" }}>
              🛡 Normal Hepatocytes — Nrf2 Hepatoprotection
            </p>
            <p className="text-[10px] leading-relaxed" style={{ color: "#1a3558" }}>
              In healthy hepatocytes the same compound activates the Nrf2/ARE pathway at sub-toxic doses, upregulating SOD, catalase, GPx and HO-1 — reducing lipid peroxidation and protecting the liver rather than damaging it.
            </p>
          </div>
        </div>
      </div>

      {/* ── Biomarker cards: two groups ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Cancer cell cards */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#a78bfa40" }}>
          <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "#fdf4ff", borderBottom: "1px solid #a78bfa20" }}>
            <Zap size={11} style={{ color: "#a78bfa" }} />
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#a78bfa" }}>Cancer Cell Response · {cl?.name ?? clKey}</span>
          </div>
          <div className="grid grid-cols-2 gap-px" style={{ background: "#dde5ef" }}>
            {[
              { label: "MAX ROS FOLD",        value: `${maxFold.toFixed(2)}×`,                    sub: `at ${maxConcRow?.conc ?? 100} µM`,  color: "#a78bfa" },
              { label: "THRESHOLD CROSSED",   value: thresholdConc != null ? `${thresholdConc} µM` : "Not crossed", sub: "apoptotic trigger at ≥2×", color: thresholdConc != null ? "#fb923c" : "#94a3b8" },
              { label: "MITO. COLLAPSE",      value: mitoDamage,                                  sub: "ΔΨm disruption",                    color: mitoDamageColor },
              { label: "DOSES ABOVE 2× FOLD", value: `${pctAbove}%`,                              sub: "of tested concentrations",          color: "#f472b6" },
            ].map(c => (
              <div key={c.label} className="p-3" style={{ background: "#ffffff" }}>
                <div className="text-[8px] font-mono uppercase tracking-widest mb-1" style={{ color: "#546e8a" }}>{c.label}</div>
                <div className="text-xl font-bold leading-none mb-0.5" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[9px]" style={{ color: "#94a3b8" }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Normal hepatocyte cards */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#00d4aa40" }}>
          <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "#f0f9f6", borderBottom: "1px solid #00d4aa20" }}>
            <Shield size={11} style={{ color: "#00a882" }} />
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#00a882" }}>Normal Hepatocyte Response · Nrf2/ARE</span>
          </div>
          <div className="grid grid-cols-2 gap-px" style={{ background: "#dde5ef" }}>
            {[
              { label: "Nrf2 ACTIVATION",    value: `+${nrf2Act}%`,  sub: "nuclear translocation",       color: "#00d4aa" },
              { label: "SOD INDUCTION",      value: `+${sod}%`,      sub: "superoxide dismutase ↑",      color: "#34d399" },
              { label: "MDA REDUCTION",      value: `−${mdaDown}%`,  sub: "lipid peroxidation suppressed",color: "#4fc3f7" },
              { label: "HEPATOPROTECTION",   value: "Confirmed",      sub: `ORAC ${ax.orac} µmol TE/g`,  color: "#00a882" },
            ].map(c => (
              <div key={c.label} className="p-3" style={{ background: "#ffffff" }}>
                <div className="text-[8px] font-mono uppercase tracking-widest mb-1" style={{ color: "#546e8a" }}>{c.label}</div>
                <div className="text-xl font-bold leading-none mb-0.5" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[9px]" style={{ color: "#94a3b8" }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dual charts ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Cancer: ROS accumulation with threshold */}
        <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#a78bfa30" }}>
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ background: "#a78bfa" }} />
            <p className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
              ROS Accumulation — HCC vs Normal (Fold-Change)
            </p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={rosChartData} margin={{ top: 8, right: 10, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="cancerROS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="normalROS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4aa" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eef8" />
              <XAxis dataKey="conc" stroke="#94a3b8" tick={{ fontSize: 9, fill: "#546e8a" }}
                label={{ value: "µM", position: "insideBottomRight", offset: 0, fill: "#94a3b8", fontSize: 9 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 9, fill: "#546e8a" }} />
              <Tooltip contentStyle={TTL}
                formatter={(v: number, name: string) => [`${v.toFixed(2)}×`, name === "cancer_ros" ? `${cl?.name ?? "Cancer"} ROS` : "Normal Hepatocyte ROS"]} />
              <ReferenceLine y={2} stroke="#fb923c" strokeDasharray="5 3"
                label={{ value: "Apoptotic threshold (2×)", fill: "#fb923c", fontSize: 8, position: "insideTopRight" }} />
              <Area type="monotone" dataKey="cancer_ros" stroke="#a78bfa" fill="url(#cancerROS)" strokeWidth={2.5} dot={{ r: 2.5, fill: "#a78bfa" }} name="cancer_ros" />
              <Area type="monotone" dataKey="normal_ros" stroke="#00d4aa" fill="url(#normalROS)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="normal_ros" />
              <Legend wrapperStyle={{ fontSize: 9, color: "#546e8a" }}
                formatter={(v) => v === "cancer_ros" ? `${cl?.name ?? "Cancer"} (pro-oxidant)` : "Normal hepatocyte (protected)"} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Normal: enzyme upregulation bar chart */}
        <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#00d4aa30" }}>
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ background: "#00d4aa" }} />
            <p className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
              Nrf2-Driven Antioxidant Response — Normal Hepatocytes
            </p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={enzymeData} margin={{ top: 8, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eef8" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 9, fill: "#546e8a" }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 9, fill: "#546e8a" }} />
              <Tooltip contentStyle={TTL} formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}%`]} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="change" radius={[3, 3, 0, 0]}
                label={{ position: "top", fill: "#546e8a", fontSize: 8, formatter: (v: number) => `${v > 0 ? "+" : ""}${v}%` }}>
                {enzymeData.map((e) => (
                  <Cell key={e.label} fill={e.type === "up" ? "#00d4aa" : "#fb923c"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Dual Mechanism Pathway Cascade ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Cancer cascade */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#a78bfa30" }}>
          <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "#fdf4ff", borderBottom: "1px solid #a78bfa20" }}>
            <Zap size={11} style={{ color: "#a78bfa" }} />
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#a78bfa" }}>Cancer Cell — Apoptosis Cascade</span>
          </div>
          <div className="p-3 space-y-2" style={{ background: "#ffffff" }}>
            {[
              { text: `${compLabel} enters ${cl?.name ?? "HCC"} cell`,                                             color: "#a78bfa" },
              { text: `Intracellular ROS ↑ ${maxFold.toFixed(2)}× — oxidative burst`,                             color: "#a78bfa" },
              { text: thresholdConc ? `2× apoptotic threshold crossed at ${thresholdConc} µM` : "Sub-threshold — verify dose range", color: "#fb923c" },
              { text: "Mitochondrial membrane potential (ΔΨm) collapses",                                         color: "#fb923c" },
              { text: "Cytochrome c released → caspase-9 activation",                                             color: "#f472b6" },
              { text: "Caspase-3 (executioner) cleaves PARP → cell death",                                        color: "#f472b6" },
              { text: "Apoptosis — independent of p53 status",                                                    color: "#e879f9" },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight size={11} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
                <span className="text-xs leading-snug" style={{ color: "#1a3558" }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Normal hepatocyte cascade */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#00d4aa30" }}>
          <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "#f0f9f6", borderBottom: "1px solid #00d4aa20" }}>
            <Shield size={11} style={{ color: "#00a882" }} />
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#00a882" }}>Normal Hepatocyte — Nrf2 Protection</span>
          </div>
          <div className="p-3 space-y-2" style={{ background: "#ffffff" }}>
            {[
              { text: `${compLabel} at sub-toxic dose activates Keap1/Nrf2 axis`,           color: "#00d4aa" },
              { text: `Nrf2 translocates to nucleus (+${nrf2Act}%)`,                        color: "#00d4aa" },
              { text: `ARE promoter binding → HO-1 +${ho1Up}%, NQO1 upregulated`,          color: "#34d399" },
              { text: `SOD +${sod}% · Catalase +${catalase}% · GPx +${gpx}%`,             color: "#34d399" },
              { text: `H₂O₂ and superoxide detoxified — ROS stays near baseline`,          color: "#4fc3f7" },
              { text: `Lipid peroxidation ↓: MDA −${mdaDown}% · 4-HNE −${hneDown}%`,     color: "#4fc3f7" },
              { text: "Normal hepatocyte survives → selective hepatoprotection",            color: "#00a882" },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight size={11} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
                <span className="text-xs leading-snug" style={{ color: "#1a3558" }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mechanistic interpretation ───────────────────────────────────── */}
      <div className="rounded-xl border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#dde5ef" }}>
          <p className="text-xs font-semibold" style={{ color: "#0d1f3c" }}>Anticancer Mechanism — ROS / Oxidative Stress</p>
          <p className="text-[10px]" style={{ color: "#546e8a" }}>
            {compLabel} · {cl?.name ?? clKey} · Dual pro-oxidant / hepatoprotective profile
          </p>
        </div>
        <div className="p-4 space-y-3">
          {[
            {
              heading: "Selective Cancer Cell Killing via ROS Overload",
              color: "#a78bfa",
              body: `${compLabel} acts as a pro-oxidant in ${cl?.name ?? "HCC"} cells, elevating intracellular ROS to ${maxFold.toFixed(2)}× baseline${thresholdConc ? ` and crossing the 2× apoptotic threshold at ${thresholdConc} µM` : ""}. Cancer cells already operate near their ROS ceiling due to rapid metabolic demands and weakened antioxidant defenses — making them selectively vulnerable to this oxidative surge. The resulting mitochondrial membrane collapse initiates the intrinsic caspase cascade regardless of p53 mutation status.`,
            },
            {
              heading: "Nrf2-Mediated Hepatoprotection in Normal Liver Cells",
              color: "#00a882",
              body: `In normal hepatocytes, the same compound triggers a hormetic Nrf2/ARE response (+${nrf2Act}% nuclear Nrf2), upregulating the full antioxidant enzyme battery: HO-1 (+${ho1Up}%), SOD (+${sod}%), catalase (+${catalase}%), and GPx (+${gpx}%). This protective programme reduces lipid peroxidation (MDA −${mdaDown}%, 4-HNE −${hneDown}%) and prevents oxidative damage — consistent with Sampasampalukan's documented hepatoprotective ethnopharmacology.`,
            },
            {
              heading: "Radical Scavenging Chemistry (Reference Assays)",
              color: "#4fc3f7",
              body: `DPPH IC₅₀ = ${ax.dpphIC50} µM and ORAC = ${ax.orac} µmol TE/g characterise the compound's intrinsic radical-scavenging capacity via HAT and SET mechanisms. These values contextualise the Nrf2-mediated effects but are not the primary anticancer mechanism — the anticancer activity is driven by selective pro-oxidant ROS accumulation in cancer cells, not by the antioxidant chemistry these assays measure.`,
            },
          ].map(b => (
            <div key={b.heading}>
              <h4 className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: b.color }}>
                <ChevronRight size={10} style={{ flexShrink: 0 }} /> {b.heading}
              </h4>
              <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function YAPSection({ results }: { results: ExperimentResults }) {
  if (!results.yapData) return null
  const lanes = results.config.concentrations.filter(c => c > 0).slice(0, 4)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl p-4 border" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: "#5a8ab0" }}>
            Protein Expression Fold-Change (treated vs control)
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={results.yapData} layout="vertical" margin={{ top: 5, right: 30, left: -5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3050" horizontal={false} />
              <XAxis type="number" stroke="#5a8ab0" tick={{ fontSize: 9 }} domain={[0, 2.5]} />
              <YAxis type="category" dataKey="protein" stroke="#5a8ab0" tick={{ fontSize: 8 }} width={65} />
              <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(2)}×`]} />
              <ReferenceLine x={1} stroke="#5a8ab0" strokeDasharray="4 4" />
              <Bar dataKey="treated" fill="#4fc3f7" radius={[0, 2, 2, 0]}
                label={{ position: "right", fill: "#5a8ab0", fontSize: 8, formatter: (v: number) => v.toFixed(2) }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <WesternBlot yapData={results.yapData} lanes={results.config.concentrations} />
      </div>
    </div>
  )
}

function BAXSection({ results, seed }: { results: ExperimentResults; seed: number }) {
  if (!results.baxData) return null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl p-4 border" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: "#5a8ab0" }}>Apoptosis Marker Fold-Change</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={results.baxData} margin={{ top: 5, right: 8, left: -15, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3050" />
              <XAxis dataKey="marker" stroke="#5a8ab0" tick={{ fontSize: 8 }} angle={-30} textAnchor="end" />
              <YAxis stroke="#5a8ab0" tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(2)}×`]} />
              <ReferenceLine y={1} stroke="#5a8ab0" strokeDasharray="4 4" />
              <Bar dataKey="val" fill="#fb923c" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <FlowCytometryPlot flow={results.flowData} seed={seed} />
      </div>
    </div>
  )
}

// ── Pathway Biomarker Cards ───────────────────────────────────────────────────

function PathwayBiomarkerCards({ yapData }: { yapData: NonNullable<ExperimentResults["yapData"]> }) {
  const get = (name: string) => yapData.find(p => p.protein === name)?.treated ?? 1
  const yap1  = get("YAP1")
  const pYAP  = get("p-YAP S127")
  const lats1 = get("LATS1")
  const tead4 = get("TEAD4")

  const yapSupp  = +((1 - yap1)   * 100).toFixed(0)
  const pYAPInc  = +((pYAP  - 1)  * 100).toFixed(0)
  const latsAct  = +((lats1 - 1)  * 100).toFixed(0)
  const tead4Sil = +((1 - tead4)  * 100).toFixed(0)

  // Colors match the dedicated Hippo-YAP panel and the reference image exactly
  const cards = [
    { id: "yap",  label: "YAP1 SUPPRESSION", value: `${yapSupp}%`,    sub: "nuclear exclusion",  color: "#4fc3f7", Icon: TrendingDown },
    { id: "pyap", label: "P-YAP SER127",      value: `+${pYAPInc}%`,  sub: "cytoplasmic trap",   color: "#00d4aa", Icon: Activity     },
    { id: "lats", label: "LATS1 ACTIVATION",  value: `+${latsAct}%`,  sub: "tumor suppressor",   color: "#34d399", Icon: Zap          },
    { id: "tead", label: "TEAD4 SILENCING",   value: `-${tead4Sil}%`, sub: "target gene",        color: "#f472b6", Icon: Shield       },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(c => (
        <div key={c.id} className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <c.Icon size={11} style={{ color: c.color }} />
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#546e8a" }}>{c.label}</span>
          </div>
          <div className="text-[28px] font-bold leading-none mb-1" style={{ color: c.color }}>{c.value}</div>
          <div className="text-[11px]" style={{ color: "#546e8a" }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ── Pathway Cascade ───────────────────────────────────────────────────────────

function PathwayCascade({ yapData, compound, baxData }: {
  yapData: NonNullable<ExperimentResults["yapData"]>
  compound: { name: string }
  baxData: NonNullable<ExperimentResults["baxData"]>
}) {
  const get = (name: string) => yapData.find(p => p.protein === name)?.treated ?? 1
  const lats1  = get("LATS1")
  const mob1   = get("MOB1")
  const pYAP   = get("p-YAP S127")
  const yap1   = get("YAP1")
  const cyr61  = get("CYR61")
  const ctgf   = get("CTGF")
  const baxRaw = baxData.find(b => b.marker === "BAX/BCL-2")?.val ?? 1

  const latsAct  = +((lats1 - 1) * 100).toFixed(0)
  const mob1Act  = +((mob1  - 1) * 100).toFixed(0)
  const pYAPInc  = +((pYAP  - 1) * 100).toFixed(0)
  const yapSupp  = +((1 - yap1)  * 100).toFixed(0)
  const cyr61Chg = +((1 - cyr61) * 100).toFixed(0)
  const ctgfChg  = +((1 - ctgf)  * 100).toFixed(0)

  const steps = [
    { text: `${compound.name} activates LATS1/2 kinase ↑ (+${latsAct}%)`,        color: "#00d4aa" },
    { text: `LATS1 + MOB1 complex ↑ (+${mob1Act}%)`,                              color: "#00d4aa" },
    { text: `YAP1 phosphorylated at Ser127 (+${pYAPInc}%)`,                       color: "#4fc3f7" },
    { text: `p-YAP sequestered by 14-3-3 (cytoplasm)`,                            color: "#4fc3f7" },
    { text: `Nuclear YAP1 ↓ (−${yapSupp}%) → proliferation halted`,              color: "#fb923c" },
    { text: `TEAD4 binding lost → gene transcription ↓`,                          color: "#fb923c" },
    { text: `CYR61 ↓ (−${cyr61Chg}%) · CTGF ↓ (−${ctgfChg}%)`,                 color: "#f472b6" },
    { text: `BAX/BCL-2 ratio ↑ ${baxRaw.toFixed(2)}× → mitochondrial apoptosis`, color: "#a78bfa" },
  ]

  return (
    <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-[9px] font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
        Pathway Cascade
      </p>
      <div className="space-y-2.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            <ChevronRight size={12} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
            <span className="text-xs leading-snug" style={{ color: "#1a3558" }}>{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Mechanistic Interpretation ────────────────────────────────────────────────

function MechanisticInterpretation({ results, compound, cl }: {
  results: ExperimentResults
  compound: { name: string; class?: string }
  cl: { name: string; type: string; p53: string } | undefined
}) {
  const yapData = results.yapData ?? []
  const baxData = results.baxData ?? []
  const rosData = results.rosData ?? []

  const get = (name: string) => yapData.find(p => p.protein === name)?.treated ?? 1
  const yapSupp  = +((1 - get("YAP1"))      * 100).toFixed(0)
  const latsAct  = +((get("LATS1") - 1)     * 100).toFixed(0)
  const pYAPInc  = +((get("p-YAP S127") - 1)* 100).toFixed(0)
  const baxRatio = baxData.find(b => b.marker === "BAX/BCL-2")?.val ?? 1
  const maxROSFold = Math.max(...rosData.map(r => r.fold), 1)
  const siColor = results.selectivityIndex >= 3 ? "#00d4aa" : results.selectivityIndex >= 2 ? "#fbbf24" : "#fb923c"

  const p53status = cl?.p53?.includes("Wild") ? "p53 wild-type" : cl?.p53?.includes("Null") ? "p53-null" : "p53-mutant"
  const normalSafety = cl?.type === "normal"
    ? `As a normal hepatocyte line (${cl.name}), the high IC₅₀ confirms low cytotoxicity to healthy liver tissue.`
    : `Selectivity index of ${results.selectivityIndex}× vs L02 normal hepatocytes confirms preferential anti-cancer action.`

  const potencyNote = results.ic50 < 25
    ? "sub-25 µM IC₅₀ placing it in the high-potency tier"
    : results.ic50 < 50 ? "moderate potency (IC₅₀ 25–50 µM)" : "higher IC₅₀ consistent with reduced encapsulation efficiency"

  const blocks = [
    {
      heading: "Cytotoxicity Mechanism",
      color: "#00d4aa",
      body: `${compound.name} demonstrated ${potencyNote} against ${cl?.name ?? results.config.cellLine} (${p53status}) at ${results.config.timePoint}h exposure. The 4-parameter logistic dose-response confirms a maximum inhibition of ${results.maxInhibition}% at 200 µM, consistent with saturable target occupancy rather than non-specific toxicity.`,
    },
    {
      heading: "Hippo–YAP Signaling",
      color: "#4fc3f7",
      body: `${compound.name} strongly activates the Hippo tumor-suppressor axis: LATS1 kinase upregulated +${latsAct}%, driving YAP1 phosphorylation at Ser127 (+${pYAPInc}%). Nuclear YAP1 is depleted by ${yapSupp}%, abolishing TEAD4-driven transcription of oncogenic targets CYR61 and CTGF. This directly halts G1-S cell cycle progression and anchorage-independent growth.`,
    },
    {
      heading: "Mitochondrial Apoptosis (BAX Pathway)",
      color: "#fb923c",
      body: `BAX/BCL-2 ratio elevated ${baxRatio.toFixed(2)}× above control, exceeding the apoptotic threshold (>1.0). This triggers cytochrome c release → caspase-9/3 cascade → PARP cleavage, confirming intrinsic apoptosis as the dominant cell death mechanism. Flow cytometry data validates ${((results.flowData?.earlyApo ?? 0) + (results.flowData?.lateApo ?? 0)).toFixed(1)}% total apoptosis.`,
    },
    {
      heading: "Oxidative Stress Induction",
      color: "#a78bfa",
      body: `ROS fold-change peaked at ${maxROSFold.toFixed(2)}× at maximum dose, surpassing the 2.0× apoptotic threshold required to overwhelm mitochondrial antioxidant defenses. Concurrent antioxidant enzyme upregulation (SOD, CAT, GPx) reflects a hormetic protective response in residual viable cells, consistent with polyphenol dual-oxidant behavior.`,
    },
    {
      heading: "Selectivity and Safety Profile",
      color: "#34d399",
      body: `${normalSafety} The chitosan/TPP nanocarrier formulation improves quercetin bioavailability 3–4×, enabling effective intracellular concentrations at lower administered doses and reducing systemic off-target exposure to normal hepatic tissue.`,
    },
  ]

  return (
    <div className="rounded-xl border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "#dde5ef" }}>
        <p className="text-xs font-semibold" style={{ color: "#0d1f3c" }}>Mechanistic Interpretation</p>
        <p className="text-[10px]" style={{ color: "#546e8a" }}>
          {compound.name} × {cl?.name ?? results.config.cellLine} · AI-assisted pathway analysis
        </p>
      </div>
      <div className="p-4 space-y-4">
        {blocks.map(b => (
          <div key={b.heading}>
            <h4 className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: b.color }}>
              <span style={{ fontSize: 10 }}>›</span> {b.heading}
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>{b.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Full Pathway Analysis Dashboard ──────────────────────────────────────────

function FullPathwayDashboard({ results, seed, compound, cl }: {
  results: ExperimentResults
  seed: number
  compound: { name: string; class?: string }
  cl: { name: string; type: string; p53: string } | undefined
}) {
  const { yapData, baxData, rosData, enzymeData } = results
  if (!yapData || !baxData || !rosData) return null

  return (
    <div className="space-y-5">
      {/* ── Hippo–YAP ── */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dde5ef" }}>
        <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ background: "#f0f9f6", borderColor: "#dde5ef" }}>
          <Dna size={14} style={{ color: "#4fc3f7" }} />
          <div>
            <span className="text-sm font-bold" style={{ color: "#0d1f3c" }}>Hippo–YAP Signaling Pathway</span>
            <div className="flex gap-1.5 mt-0.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#4fc3f720", color: "#4fc3f7" }}>Western Blot</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#4fc3f720", color: "#4fc3f7" }}>qRT-PCR</span>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4" style={{ background: "#ffffff" }}>
          <PathwayBiomarkerCards yapData={yapData} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Fold-change chart — matches image: uniform blue bars, ref at 1.0 */}
            <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-[9px] font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
                Protein Expression Fold-Change
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yapData} layout="vertical" margin={{ top: 5, right: 44, left: -5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eef8" horizontal={false} />
                  <XAxis
                    type="number" stroke="#94a3b8" tick={{ fontSize: 9, fill: "#94a3b8" }}
                    domain={[0, 2.5]} ticks={[0, 0.65, 1.3, 1.95, 2.5]}
                  />
                  <YAxis type="category" dataKey="protein" stroke="#94a3b8" tick={{ fontSize: 9, fill: "#546e8a" }} width={70} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a2744", border: "1px solid #2d4470", borderRadius: 8, color: "#e8f4ff", fontSize: 11, fontFamily: "monospace" }}
                    formatter={(v: number) => [`${v.toFixed(2)}×`, "Fold-Change"]}
                  />
                  <ReferenceLine x={1} stroke="#94a3b8" strokeDasharray="5 4" />
                  <Bar dataKey="treated" fill="#4fc3f7" radius={[0, 3, 3, 0]}
                    label={{ position: "right", fill: "#546e8a", fontSize: 8, formatter: (v: number) => v.toFixed(2) }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <PathwayCascade yapData={yapData} compound={compound} baxData={baxData} />
          </div>
        </div>
      </div>

      {/* ── BAX Apoptosis ── */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dde5ef" }}>
        <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ background: "#fff8f0", borderColor: "#dde5ef" }}>
          <Activity size={14} style={{ color: "#fb923c" }} />
          <div>
            <span className="text-sm font-bold" style={{ color: "#0d1f3c" }}>BAX Apoptosis Pathway</span>
            <div className="flex gap-1.5 mt-0.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#fb923c20", color: "#fb923c" }}>Flow Cytometry</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#fb923c20", color: "#fb923c" }}>Western Blot</span>
            </div>
          </div>
        </div>
        <div className="p-4" style={{ background: "#ffffff" }}>
          {/* BAX key metrics */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "BAX/BCL-2 Ratio", val: (baxData.find(b => b.marker === "BAX/BCL-2")?.val ?? 1).toFixed(2)+"×", color: "#fb923c" },
              { label: "Caspase-3 Act.", val: (baxData.find(b => b.marker === "CASP-3")?.val ?? 1).toFixed(2)+"×", color: "#a78bfa" },
              { label: "Total Apoptosis", val: ((results.flowData?.earlyApo ?? 0) + (results.flowData?.lateApo ?? 0)).toFixed(1)+"%", color: "#f472b6" },
            ].map(m => (
              <div key={m.label} className="rounded-xl p-3 border text-center" style={{ background: "#fff8f0", borderColor: "#dde5ef" }}>
                <div className="text-lg font-bold" style={{ color: m.color }}>{m.val}</div>
                <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>{m.label}</div>
              </div>
            ))}
          </div>
          <BAXSection results={{ ...results, baxData, flowData: results.flowData }} seed={seed} />
        </div>
      </div>

      {/* ── ROS ── */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dde5ef" }}>
        <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ background: "#f5f0ff", borderColor: "#dde5ef" }}>
          <Zap size={14} style={{ color: "#a78bfa" }} />
          <div>
            <span className="text-sm font-bold" style={{ color: "#0d1f3c" }}>Oxidative Stress (ROS) Analysis</span>
            <div className="flex gap-1.5 mt-0.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#a78bfa20", color: "#a78bfa" }}>DCFH-DA Fluorescence</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#a78bfa20", color: "#a78bfa" }}>Enzyme Assay</span>
            </div>
          </div>
        </div>
        <div className="p-4" style={{ background: "#ffffff" }}>
          <ROSSection results={{ ...results, rosData, enzymeData }} />
        </div>
      </div>

      {/* ── Mechanistic Interpretation ── */}
      <MechanisticInterpretation results={results} compound={compound} cl={cl} />
    </div>
  )
}

// ── Full results dashboard ────────────────────────────────────────────────────

function ResultsDashboard({ results, seed }: { results: ExperimentResults; seed: number }) {
  const posControl = POS_CONTROLS.find(p => p.id === results.config.positiveControlId)!
  const compound = PHYTOCHEMICALS.find(c => c.id === results.config.compoundId)!
  const cl = CELL_LINES[results.config.cellLine]
  const siColor = results.selectivityIndex >= 3 ? "#00d4aa" : results.selectivityIndex >= 2 ? "#fbbf24" : "#fb923c"
  const assayLabels: Record<AssayType, string> = {
    mtt: "MTT Cytotoxicity Assay", ros: "ROS / Oxidative Stress Assay",
    yap: "Hippo–YAP Signaling", bax: "BAX Apoptosis Pathway",
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 border" style={{ background: "#0a1628", borderColor: "#00d4aa40" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={14} style={{ color: "#00d4aa" }} />
              <span className="text-sm font-bold" style={{ color: "#00d4aa" }}>Experiment Complete</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "#00d4aa20", color: "#00d4aa" }}>
                {assayLabels[results.config.assay]}
              </span>
            </div>
            <p className="text-[10px] font-mono" style={{ color: "#5a8ab0" }}>
              {compound.name} · {cl?.name ?? results.config.cellLine} · {results.config.timePoint}h · vs {posControl.name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono" style={{ color: "#5a8ab0" }}>IC₅₀</div>
            <div className="text-2xl font-bold font-mono" style={{ color: "#00d4aa" }}>{results.ic50}</div>
            <div className="text-[10px] font-mono" style={{ color: "#5a8ab0" }}>µM</div>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <MetricCard label="IC₅₀" value={results.ic50} unit="µM" sub="nonlinear regression" color="#00d4aa" icon={TrendingDown} />
        <MetricCard label={`${posControl.name.slice(0,10)} IC₅₀`} value={results.posControlIC50} unit="µM"
          sub="positive control" color={posControl.color} icon={FlaskConical} />
        <MetricCard label="Max Inhibition" value={`${results.maxInhibition}%`} sub="at max dose" color="#a78bfa" icon={Activity} />
        <MetricCard label="Selectivity Index" value={results.selectivityIndex}
          sub="vs L02 normal" color={siColor} icon={CheckCircle2} />
        <MetricCard label="Cell Line" value={cl?.name ?? results.config.cellLine}
          sub={cl?.type === "cancer" ? "HCC line" : "Normal ctrl"} color={cl?.color ?? "#00d4aa"} icon={Microscope} />
      </div>

      {/* Dose response + table */}
      <DoseResponseSection results={results} posControl={posControl} />
      <DataTable results={results} posControl={posControl} />

      {/* IC50 comparison bar */}
      <div className="rounded-xl p-4 border" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
        <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: "#5a8ab0" }}>
          IC₅₀ Comparison — Your Compound vs Controls
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart
            data={[
              { name: compound.name.slice(0, 10), ic50: results.ic50, color: "#00d4aa" },
              { name: posControl.name.slice(0, 10), ic50: results.posControlIC50, color: posControl.color },
            ]}
            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1a3050" />
            <XAxis dataKey="name" stroke="#5a8ab0" tick={{ fontSize: 10 }} />
            <YAxis stroke="#5a8ab0" tick={{ fontSize: 9 }} label={{ value: "µM", fill: "#5a8ab0", fontSize: 9, angle: -90, position: "insideLeft" }} />
            <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(2)} µM`, "IC₅₀"]} />
            <Bar dataKey="ic50" radius={[4, 4, 0, 0]}>
              {[{ color: "#00d4aa" }, { color: posControl.color }].map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] mt-2" style={{ color: "#7fb8e8" }}>
          <Info size={10} className="inline mr-1" style={{ color: "#4fc3f7" }} />
          {results.ic50 < results.posControlIC50
            ? `${compound.name} (IC₅₀ ${results.ic50} µM) is more potent than ${posControl.name} (${results.posControlIC50} µM) against ${cl?.name ?? results.config.cellLine} at ${results.config.timePoint}h.`
            : `${posControl.name} (IC₅₀ ${results.posControlIC50} µM) is more potent than ${compound.name} (${results.ic50} µM), however selectivity index favours ${compound.name} (SI = ${results.selectivityIndex}×).`
          }
        </p>
      </div>

      {/* ── Full Biological Pathway Analysis ── always shown ── */}
      <div className="rounded-xl border-2 px-1 py-4 space-y-4" style={{ borderColor: "#00d4aa30", background: "#f8fffc" }}>
        <div className="px-3">
          <p className="text-sm font-bold" style={{ color: "#0d1f3c" }}>Complete Biological Pathway Analysis</p>
          <p className="text-xs" style={{ color: "#546e8a" }}>
            Dynamically computed for {compound.name} × {cl?.name ?? results.config.cellLine} · {results.config.timePoint}h
          </p>
        </div>
        <div className="px-3">
          <FullPathwayDashboard results={results} seed={seed} compound={compound} cl={cl} />
        </div>
      </div>
    </div>
  )
}

// ── Concentration builder ────────────────────────────────────────────────────

const PRESETS = {
  standard: [0, 6.25, 12.5, 25, 50, 100, 200],
  low: [0, 1, 2.5, 5, 10, 25, 50],
  high: [0, 25, 50, 100, 200, 400, 800],
  narrow: [0, 15, 17.5, 20, 22.5, 25, 30],
}

function ConcBuilder({ concs, onChange }: { concs: number[]; onChange: (c: number[]) => void }) {
  const [input, setInput] = useState("")

  const add = () => {
    const v = parseFloat(input)
    if (!isNaN(v) && v >= 0 && !concs.includes(v)) {
      onChange([...concs, v].sort((a, b) => a - b))
      setInput("")
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {concs.map(c => (
          <span key={c} className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border"
            style={{ background: "#0a1628", borderColor: "#1a3050", color: "#e2f0ff" }}>
            {c === 0 ? "0 (ctrl)" : `${c} µM`}
            <button onClick={() => onChange(concs.filter(x => x !== c))} style={{ color: "#5a8ab0" }}>
              <X size={9} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="number" min={0} step={1} placeholder="Add µM…"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          className="flex-1 rounded-lg px-2 py-1 text-xs font-mono border outline-none"
          style={{ background: "#0a1628", borderColor: "#1a3050", color: "#e2f0ff" }}
        />
        <button onClick={add} className="px-2 py-1 rounded-lg border text-[10px]"
          style={{ borderColor: "#00d4aa", color: "#00d4aa", background: "#00d4aa12" }}>
          <Plus size={11} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {(Object.entries(PRESETS) as [string, number[]][]).map(([label, vals]) => (
          <button key={label} onClick={() => onChange(vals)}
            className="text-[9px] font-mono px-2 py-0.5 rounded border capitalize transition-colors"
            style={{ borderColor: "#1a3050", color: "#5a8ab0" }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

const ASSAY_OPTIONS = [
  { id: "mtt" as const, label: "MTT Assay", icon: FlaskConical, color: "#4fc3f7", sub: "Cell viability · IC₅₀ · Cytotoxicity" },
  { id: "ros" as const, label: "ROS Assay", icon: Zap, color: "#a78bfa", sub: "Oxidative stress · Antioxidant enzymes" },
  { id: "yap" as const, label: "Hippo–YAP", icon: Dna, color: "#4fc3f7", sub: "Western blot · Pathway expression" },
  { id: "bax" as const, label: "BAX Pathway", icon: Activity, color: "#fb923c", sub: "Flow cytometry · Apoptosis markers" },
]

export default function VirtualLabPanel() {
  const [assay, setAssay] = useState<AssayType>("mtt")
  const [cellLine, setCellLine] = useState<CellLineKey>("HepG2")
  const [compoundId, setCompoundId] = useState("quercetin")
  const [concentrations, setConcentrations] = useState<number[]>(PRESETS.standard)
  const [posControlId, setPosControlId] = useState("sorafenib")
  const [timePoint, setTimePoint] = useState<24 | 48 | 72 | 96>(72)
  const [replicates, setReplicates] = useState(3)
  const [status, setStatus] = useState<LabStatus>("setup")
  const [results, setResults] = useState<ExperimentResults | null>(null)
  const [seed, setSeed] = useState(12345)

  const runExperimentHandler = useCallback(() => {
    setStatus("running")
    const newSeed = Date.now()
    setSeed(newSeed)
  }, [assay, cellLine, compoundId, concentrations, posControlId, timePoint, replicates])

  const handleLogDone = useCallback(() => {
    const config: RunConfig = { assay, cellLine, compoundId, concentrations, positiveControlId: posControlId, timePoint, replicates }
    const r = runExperiment(config, seed)
    setResults(r)
    setStatus("complete")
  }, [assay, cellLine, compoundId, concentrations, posControlId, timePoint, replicates, seed])

  const reset = () => { setStatus("setup"); setResults(null) }

  const cl = CELL_LINES[cellLine]
  const compound = PHYTOCHEMICALS.find(c => c.id === compoundId)!
  const pc = POS_CONTROLS.find(p => p.id === posControlId)!

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: "#00d4aa20" }}>
            <Beaker size={18} style={{ color: "#00d4aa" }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#e2f0ff" }}>Virtual In Silico Lab</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "#00d4aa20", color: "#00d4aa" }}>
              Configure · Run · Analyse · Compare
            </span>
          </div>
        </div>
        {status !== "setup" && (
          <button onClick={reset} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: "#1a3050", color: "#5a8ab0" }}>
            <RotateCcw size={12} /> New Experiment
          </button>
        )}
      </div>

      {/* Running */}
      {status === "running" && (
        <LabLog assay={assay} onDone={handleLogDone} />
      )}

      {/* Complete */}
      {status === "complete" && results && (
        <ResultsDashboard results={results} seed={seed} />
      )}

      {/* Setup form — always show when in setup, hidden when running/complete */}
      {status === "setup" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Left column: Assay + Cell line + Compound */}
          <div className="sm:col-span-1 space-y-4">
            {/* Assay type */}
            <div className="rounded-xl border p-4" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#5a8ab0" }}>
                <FlaskConical size={10} /> Assay Type
              </p>
              <div className="space-y-1">
                {ASSAY_OPTIONS.map(a => (
                  <button key={a.id} onClick={() => setAssay(a.id)}
                    className="w-full text-left rounded-lg px-3 py-2 border transition-all"
                    style={{
                      background: assay === a.id ? a.color + "18" : "transparent",
                      borderColor: assay === a.id ? a.color : "transparent",
                    }}>
                    <div className="flex items-center gap-2">
                      <a.icon size={12} style={{ color: a.color }} />
                      <span className="text-xs font-semibold" style={{ color: assay === a.id ? a.color : "#c8e0f8" }}>{a.label}</span>
                    </div>
                    <p className="text-[9px] mt-0.5 ml-5" style={{ color: "#5a8ab0" }}>{a.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cell line */}
            <div className="rounded-xl border p-4" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#5a8ab0" }}>
                <Microscope size={10} /> Cell Line
              </p>
              <div className="space-y-0.5 max-h-56 overflow-y-auto">
                {[
                  { group: "HCC Cancer", keys: ["HepG2","Huh7","Hep3B","PLCPRF5","SNU449","SNU182","SNU387","SKHEP1"] as CellLineKey[] },
                  { group: "Normal Controls", keys: ["L02","WRL68","LX2"] as CellLineKey[] },
                ].map(g => (
                  <div key={g.group}>
                    <p className="text-[9px] font-mono uppercase tracking-wider py-1.5 px-1" style={{ color: "#1a4060" }}>{g.group}</p>
                    {g.keys.map(k => {
                      const c = CELL_LINES[k]
                      return (
                        <button key={k} onClick={() => setCellLine(k)}
                          className="w-full text-left rounded-lg px-2.5 py-1.5 transition-all"
                          style={{ background: cellLine === k ? (c?.color ?? "#00d4aa") + "18" : "transparent", borderLeft: `2px solid ${cellLine === k ? (c?.color ?? "#00d4aa") : "transparent"}` }}>
                          <span className="text-xs" style={{ color: cellLine === k ? (c?.color ?? "#00d4aa") : "#c8e0f8" }}>{c?.name ?? k}</span>
                          <span className="text-[9px] ml-1 font-mono" style={{ color: "#5a8ab0" }}>p53: {c?.p53?.split(" ")[0]}</span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle column: Compound + concentrations */}
          <div className="sm:col-span-1 space-y-4">
            {/* Compound */}
            <div className="rounded-xl border p-4" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#5a8ab0" }}>
                <Atom size={10} /> Test Compound
              </p>
              <div className="space-y-0.5 max-h-64 overflow-y-auto">
                {PHYTOCHEMICALS.map(c => (
                  <button key={c.id} onClick={() => setCompoundId(c.id)}
                    className="w-full text-left rounded-lg px-2.5 py-1.5 transition-all"
                    style={{ background: compoundId === c.id ? c.color + "18" : "transparent", borderLeft: `2px solid ${compoundId === c.id ? c.color : "transparent"}` }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-xs" style={{ color: compoundId === c.id ? c.color : "#c8e0f8" }}>{c.name}</span>
                    </div>
                    <div className="text-[9px] ml-3 font-mono" style={{ color: "#5a8ab0" }}>{c.class} · {c.formula}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Concentrations */}
            <div className="rounded-xl border p-4" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#5a8ab0" }}>
                <Layers size={10} /> Concentrations (µM)
              </p>
              <ConcBuilder concs={concentrations} onChange={setConcentrations} />
            </div>
          </div>

          {/* Right column: Positive control + time + run */}
          <div className="sm:col-span-1 space-y-4">
            {/* Positive control */}
            <div className="rounded-xl border p-4" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#5a8ab0" }}>
                <BrainCircuit size={10} /> Positive Control
              </p>
              <div className="space-y-1">
                {POS_CONTROLS.map(p => (
                  <button key={p.id} onClick={() => setPosControlId(p.id)}
                    className="w-full text-left rounded-lg px-2.5 py-2 border transition-all"
                    style={{ background: posControlId === p.id ? p.color + "18" : "transparent", borderColor: posControlId === p.id ? p.color : "transparent" }}>
                    <div className="text-xs font-semibold" style={{ color: posControlId === p.id ? p.color : "#c8e0f8" }}>{p.name}</div>
                    <div className="text-[9px]" style={{ color: "#5a8ab0" }}>{p.type}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time point */}
            <div className="rounded-xl border p-4" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#5a8ab0" }}>
                <Clock size={10} /> Incubation Time
              </p>
              <div className="grid grid-cols-4 gap-1">
                {([24, 48, 72, 96] as const).map(t => (
                  <button key={t} onClick={() => setTimePoint(t)}
                    className="py-2 rounded-lg text-xs font-mono font-bold border transition-all"
                    style={{ background: timePoint === t ? "#00d4aa18" : "transparent", borderColor: timePoint === t ? "#00d4aa" : "#1a3050", color: timePoint === t ? "#00d4aa" : "#5a8ab0" }}>
                    {t}h
                  </button>
                ))}
              </div>
              <p className="text-[9px] mt-2 font-mono" style={{ color: "#5a8ab0" }}>
                {timePoint === 24 && "Short exposure — initial cytotoxicity"}
                {timePoint === 48 && "Standard mid-point — moderate effect"}
                {timePoint === 72 && "Standard 72h — optimal IC₅₀ window"}
                {timePoint === 96 && "Extended exposure — maximum effect"}
              </p>
            </div>

            {/* Replicates */}
            <div className="rounded-xl border p-4" style={{ background: "#0a1628", borderColor: "#1a3050" }}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: "#5a8ab0" }}>
                <BarChart3 size={10} /> Replicates (n)
              </p>
              <div className="grid grid-cols-3 gap-1">
                {[2, 3, 6].map(n => (
                  <button key={n} onClick={() => setReplicates(n)}
                    className="py-1.5 rounded-lg text-xs font-mono font-bold border transition-all"
                    style={{ background: replicates === n ? "#4fc3f720" : "transparent", borderColor: replicates === n ? "#4fc3f7" : "#1a3050", color: replicates === n ? "#4fc3f7" : "#5a8ab0" }}>
                    n={n}
                  </button>
                ))}
              </div>
            </div>

            {/* Config summary */}
            <div className="rounded-xl border p-3" style={{ background: "#0f2240", borderColor: "#1a3050" }}>
              <p className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "#5a8ab0" }}>Experiment Summary</p>
              {[
                ["Assay", ASSAY_OPTIONS.find(a => a.id === assay)?.label ?? assay],
                ["Cell Line", cl?.name ?? cellLine],
                ["Compound", compound?.name ?? compoundId],
                ["Conc. points", concentrations.length.toString()],
                ["Pos. Control", pc?.name ?? posControlId],
                ["Time Point", `${timePoint}h`],
                ["Replicates", `n=${replicates}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px] font-mono">
                  <span style={{ color: "#5a8ab0" }}>{k}</span>
                  <span style={{ color: "#c8e0f8" }}>{v}</span>
                </div>
              ))}
            </div>

            {/* RUN button */}
            <button
              onClick={runExperimentHandler}
              disabled={concentrations.length < 2}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: concentrations.length < 2 ? "#1a3050" : "linear-gradient(135deg, #00d4aa, #4fc3f7)",
                color: concentrations.length < 2 ? "#5a8ab0" : "#050e1a",
                cursor: concentrations.length < 2 ? "not-allowed" : "pointer",
              }}>
              <Play size={16} />
              Run In Silico Experiment
            </button>
            {concentrations.length < 2 && (
              <p className="text-[9px] text-center font-mono" style={{ color: "#fb923c" }}>
                Add at least 2 concentrations to run
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
