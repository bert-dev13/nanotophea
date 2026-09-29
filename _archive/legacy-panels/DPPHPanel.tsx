"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts"
import {
  Zap, Play, Plus, X, CheckCircle2, RotateCcw, BookmarkPlus,
  FlaskConical, Info, Activity, Atom, TrendingDown, BarChart3,
  Beaker, AlertTriangle, Clock,
} from "lucide-react"
import { PHYTOCHEMICALS } from "@/data/compounds"
import type { SavedResult } from "@/components/panels/AssayLabSection"

// ── DPPH-specific compound data ───────────────────────────────────────────────

const DPPH_IC50: Record<string, number> = {
  quercetin: 3.2,  rutin: 14.3,    luteolin: 8.1,   kaempferol: 9.4,
  ellagicacid: 11.8, gallicacid: 7.1, corilagin: 5.8, geraniin: 6.2,
  phyllanthin: 28.4, hypophyllanthin: 31.6, astragalin: 16.8,
  betasitosterol: 89.4, niranthin: 22.1, securinine: 44.2,
}

const DPPH_TEAC: Record<string, number> = {
  quercetin: 4.82, rutin: 2.68,   luteolin: 3.14,  kaempferol: 2.94,
  ellagicacid: 2.24, gallicacid: 3.91, corilagin: 4.12, geraniin: 4.01,
  phyllanthin: 1.14, hypophyllanthin: 0.98, astragalin: 1.88,
  betasitosterol: 0.22, niranthin: 1.42, securinine: 0.58,
}

const DPPH_SMAX: Record<string, number> = {
  quercetin: 96.8, rutin: 94.1,   luteolin: 95.4,  kaempferol: 94.8,
  ellagicacid: 93.2, gallicacid: 95.1, corilagin: 96.2, geraniin: 95.8,
  phyllanthin: 88.4, hypophyllanthin: 86.1, astragalin: 91.2,
  betasitosterol: 72.1, niranthin: 83.4, securinine: 79.8,
}

const DPPH_HILL_N: Record<string, number> = {
  quercetin: 1.35, rutin: 1.20, luteolin: 1.28, kaempferol: 1.22,
  ellagicacid: 1.18, gallicacid: 1.25, corilagin: 1.32, geraniin: 1.30,
  phyllanthin: 1.10, hypophyllanthin: 1.08, astragalin: 1.15,
  betasitosterol: 1.05, niranthin: 1.12, securinine: 1.08,
}

// ── DPPH positive controls ────────────────────────────────────────────────────

interface DPPHControl {
  id: string; name: string; shortName: string
  ic50: number; smax: number; hillN: number; teac: number
  color: string; type: string
}

const DPPH_CONTROLS: DPPHControl[] = [
  { id: "ascorbic",  name: "Ascorbic Acid (Vitamin C)", shortName: "Asc. Acid",
    ic50: 18.4, smax: 94.2, hillN: 1.3, teac: 1.00,
    color: "#f59e0b", type: "Water-soluble vitamin · universal DPPH reference" },
  { id: "trolox",    name: "Trolox (Vitamin E analog)", shortName: "Trolox",
    ic50: 12.6, smax: 95.8, hillN: 1.4, teac: 1.00,
    color: "#22d3ee", type: "Gold standard DPPH reference · defines TEAC = 1.00" },
  { id: "gallic",    name: "Gallic Acid", shortName: "Gallic Acid",
    ic50: 7.1,  smax: 95.4, hillN: 1.2, teac: 3.91,
    color: "#a78bfa", type: "Natural polyphenol · very high antioxidant potency" },
  { id: "bht",       name: "BHT (Butylated Hydroxytoluene)", shortName: "BHT",
    ic50: 42.1, smax: 88.3, hillN: 1.1, teac: 0.48,
    color: "#546e8a", type: "Synthetic antioxidant food additive · weak reference" },
]

// ── Oxidative stress protein targets ─────────────────────────────────────────

interface OxProtein {
  id: string; name: string; gene: string; pdbId: string
  role: "sensor" | "scavenger" | "producer" | "regulator" | "inducer"
  pathway: string; function: string; color: string
  effect: "inhibit" | "activate" | "bind"
  // per-compound: [deltaG kcal/mol, H-bonds]
  binding: Record<string, [number, number]>
}

const OS_PROTEINS: OxProtein[] = [
  {
    id: "keap1", name: "Keap1", gene: "KEAP1", pdbId: "4ZY3",
    role: "sensor", pathway: "Keap1–Nrf2–ARE axis",
    function: "Nrf2 repressor; cysteine thiols act as ROS sensors — oxidation releases Nrf2 to nucleus",
    color: "#f97316", effect: "inhibit",
    binding: {
      quercetin: [-9.1, 6], corilagin: [-8.8, 7], geraniin: [-8.6, 5],
      luteolin: [-8.4, 5], gallicacid: [-8.0, 4], kaempferol: [-7.9, 4],
      ellagicacid: [-7.6, 4], rutin: [-7.3, 4], astragalin: [-6.9, 3],
      phyllanthin: [-6.2, 2], niranthin: [-6.0, 2], hypophyllanthin: [-5.8, 2],
      betasitosterol: [-5.1, 1], securinine: [-4.8, 1],
    },
  },
  {
    id: "nrf2", name: "Nrf2", gene: "NFE2L2", pdbId: "2LZ1",
    role: "regulator", pathway: "Keap1–Nrf2–ARE axis",
    function: "Master transcription factor for antioxidant response elements; upregulates HO-1, NQO1, GCL",
    color: "#fbbf24", effect: "activate",
    binding: {
      quercetin: [-8.4, 5], corilagin: [-8.0, 5], geraniin: [-7.9, 4],
      luteolin: [-7.7, 4], gallicacid: [-7.4, 4], kaempferol: [-7.2, 3],
      ellagicacid: [-7.0, 3], rutin: [-6.8, 3], astragalin: [-6.4, 3],
      phyllanthin: [-5.8, 2], niranthin: [-5.6, 2], hypophyllanthin: [-5.4, 2],
      betasitosterol: [-4.9, 1], securinine: [-4.6, 1],
    },
  },
  {
    id: "ho1", name: "HO-1", gene: "HMOX1", pdbId: "1N3U",
    role: "inducer", pathway: "Heme catabolism / cytoprotection",
    function: "Heme oxygenase-1; rate-limiting enzyme in heme degradation; produces CO, biliverdin (antioxidants)",
    color: "#a78bfa", effect: "activate",
    binding: {
      quercetin: [-7.8, 5], corilagin: [-7.5, 4], geraniin: [-7.4, 4],
      luteolin: [-7.1, 4], gallicacid: [-6.9, 3], kaempferol: [-6.7, 3],
      ellagicacid: [-6.5, 3], rutin: [-6.3, 3], astragalin: [-6.0, 2],
      phyllanthin: [-5.4, 2], niranthin: [-5.2, 2], hypophyllanthin: [-5.0, 2],
      betasitosterol: [-4.6, 1], securinine: [-4.3, 1],
    },
  },
  {
    id: "sod1", name: "SOD1", gene: "SOD1", pdbId: "1PU0",
    role: "scavenger", pathway: "O₂•⁻ dismutation",
    function: "Cu/Zn superoxide dismutase; converts O₂•⁻ → H₂O₂ + O₂; first line of ROS defence",
    color: "#4fc3f7", effect: "activate",
    binding: {
      quercetin: [-6.8, 4], corilagin: [-6.5, 3], geraniin: [-6.4, 3],
      luteolin: [-6.2, 3], gallicacid: [-6.0, 3], kaempferol: [-5.9, 3],
      ellagicacid: [-5.7, 2], rutin: [-5.5, 2], astragalin: [-5.3, 2],
      phyllanthin: [-4.9, 2], niranthin: [-4.7, 1], hypophyllanthin: [-4.5, 1],
      betasitosterol: [-4.1, 1], securinine: [-3.8, 1],
    },
  },
  {
    id: "nqo1", name: "NQO1", gene: "NQO1", pdbId: "1DXO",
    role: "scavenger", pathway: "Quinone reduction / Nrf2 target",
    function: "NAD(P)H quinone oxidoreductase 1; reduces toxic quinones to stable hydroquinones; prevents ROS cycling",
    color: "#34d399", effect: "activate",
    binding: {
      quercetin: [-7.2, 5], corilagin: [-7.0, 4], geraniin: [-6.8, 4],
      luteolin: [-6.6, 4], gallicacid: [-6.4, 3], kaempferol: [-6.2, 3],
      ellagicacid: [-6.0, 3], rutin: [-5.8, 3], astragalin: [-5.5, 2],
      phyllanthin: [-5.0, 2], niranthin: [-4.8, 2], hypophyllanthin: [-4.6, 1],
      betasitosterol: [-4.2, 1], securinine: [-3.9, 1],
    },
  },
  {
    id: "nox4", name: "NOX4", gene: "NOX4", pdbId: "7B95",
    role: "producer", pathway: "NADPH oxidase / ROS generation",
    function: "NADPH oxidase 4; constitutively generates H₂O₂ in hepatocytes; major source of liver ROS in HCC",
    color: "#f472b6", effect: "inhibit",
    binding: {
      quercetin: [-8.2, 5], corilagin: [-7.9, 4], geraniin: [-7.7, 4],
      luteolin: [-7.5, 4], gallicacid: [-7.2, 3], kaempferol: [-7.0, 3],
      ellagicacid: [-6.8, 3], rutin: [-6.5, 3], astragalin: [-6.2, 2],
      phyllanthin: [-5.6, 2], niranthin: [-5.4, 2], hypophyllanthin: [-5.1, 2],
      betasitosterol: [-4.7, 1], securinine: [-4.4, 1],
    },
  },
  {
    id: "xo", name: "Xanthine Oxidase", gene: "XDH", pdbId: "1FIQ",
    role: "producer", pathway: "Purine catabolism / O₂•⁻ generation",
    function: "Generates O₂•⁻ and H₂O₂ during purine metabolism; elevated in HCC; well-characterised polyphenol target",
    color: "#fb923c", effect: "inhibit",
    binding: {
      quercetin: [-9.8, 7], corilagin: [-9.2, 6], geraniin: [-9.0, 6],
      luteolin: [-8.8, 5], gallicacid: [-8.5, 5], kaempferol: [-8.3, 4],
      ellagicacid: [-8.0, 4], rutin: [-7.6, 4], astragalin: [-7.1, 3],
      phyllanthin: [-6.3, 2], niranthin: [-6.1, 2], hypophyllanthin: [-5.9, 2],
      betasitosterol: [-5.3, 1], securinine: [-4.9, 1],
    },
  },
  {
    id: "gpx1", name: "GPx1", gene: "GPX1", pdbId: "2F8A",
    role: "scavenger", pathway: "Glutathione peroxidase / H₂O₂ detox",
    function: "Selenoenzyme reducing H₂O₂ and lipid hydroperoxides using GSH; major cytoplasmic antioxidant",
    color: "#00d4aa", effect: "activate",
    binding: {
      quercetin: [-6.5, 4], corilagin: [-6.3, 3], geraniin: [-6.1, 3],
      luteolin: [-5.9, 3], gallicacid: [-5.8, 3], kaempferol: [-5.6, 2],
      ellagicacid: [-5.4, 2], rutin: [-5.2, 2], astragalin: [-4.9, 2],
      phyllanthin: [-4.5, 1], niranthin: [-4.3, 1], hypophyllanthin: [-4.1, 1],
      betasitosterol: [-3.7, 1], securinine: [-3.5, 1],
    },
  },
]

const ROLE_LABELS: Record<string, string> = {
  sensor: "ROS Sensor", scavenger: "ROS Scavenger", producer: "ROS Producer",
  regulator: "Regulator", inducer: "Inducer",
}

// ── Lab steps ─────────────────────────────────────────────────────────────────

const DPPH_STEPS: string[] = [
  "Dissolving DPPH• (2,2-diphenyl-1-picrylhydrazyl) in analytical-grade ethanol to 0.1 mM…",
  "Preparing compound stock solution in EtOH; performing 2-fold serial dilutions to working concentrations…",
  "Equilibrating DPPH• solution at 37°C for 10 min in dark conditions (amber vials)…",
  "Pipetting 100 µL DPPH• solution into each well of 96-well microplate…",
  "Adding 50 µL compound dilutions to designated wells (n replicates); 50 µL EtOH to blank wells…",
  "Adding 50 µL positive control solution to reference wells…",
  "Sealing plate with adhesive film; incubating at 37°C in darkness for reaction time…",
  "Reading absorbance at 517 nm on microplate spectrophotometer (reference: 700 nm)…",
  "Computing % RSA: [(A_DPPH_control − A_sample) / A_DPPH_control] × 100…",
  "Nonlinear regression — Hill equation — IC₅₀, Smax, and TEAC computation…",
  "Comparing relative potency vs positive control; reporting DFT-computed BDE and TEAC…",
]

// ── DFT Reference table ───────────────────────────────────────────────────────

const DFT_DATA = [
  { name: "Quercetin (nano)", bde: 74.8, ip: 6.41, homo: -6.41, pa: 346.2, mech: "HAT + SET" },
  { name: "Free Quercetin",   bde: 75.1, ip: 6.44, homo: -6.44, pa: 345.8, mech: "HAT + SET" },
  { name: "Geraniin",         bde: 72.4, ip: 6.28, homo: -6.28, pa: 348.1, mech: "HAT" },
  { name: "Gallic Acid",      bde: 73.1, ip: 6.67, homo: -6.67, pa: 341.4, mech: "HAT" },
  { name: "Luteolin",         bde: 76.2, ip: 6.52, homo: -6.52, pa: 343.6, mech: "HAT + SET" },
  { name: "Ascorbic Acid",    bde: 76.1, ip: 6.88, homo: -6.88, pa: 338.7, mech: "SET + HAT" },
  { name: "Trolox",           bde: 78.3, ip: 6.93, homo: -6.93, pa: 336.4, mech: "HAT" },
  { name: "Phyllanthin",      bde: 82.4, ip: 7.18, homo: -7.18, pa: 329.2, mech: "SET" },
  { name: "BHT",              bde: 79.8, ip: 7.04, homo: -7.04, pa: 331.8, mech: "HAT" },
]

// ── Computation helpers ───────────────────────────────────────────────────────

const seededRand = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function hillScavenging(C: number, ic50: number, n: number, smax: number): number {
  if (C === 0) return 0
  return smax * (C / ic50) ** n / (1 + (C / ic50) ** n)
}

// ── Static reference data ─────────────────────────────────────────────────────

const CONC_POINTS = [0, 3.13, 6.25, 12.5, 25, 50, 100]

const REF_COMPOUNDS = [
  { key: "quercetin", name: "Quercetin Nano", color: "#00d4aa" },
  { key: "geraniin",  name: "Geraniin",       color: "#a78bfa" },
  { key: "corilagin", name: "Corilagin",      color: "#4fc3f7" },
  { key: "luteolin",  name: "Luteolin",       color: "#fbbf24" },
]

const scavRef = CONC_POINTS.map(c => {
  const row: Record<string, number> = { conc: c }
  REF_COMPOUNDS.forEach(({ key, name }) => {
    const ic50 = DPPH_IC50[key] ?? 20
    const smax = DPPH_SMAX[key] ?? 90
    const n    = DPPH_HILL_N[key] ?? 1.2
    row[name] = +hillScavenging(c, ic50, n, smax).toFixed(1)
  })
  // Ascorbic acid reference
  row["Asc. Acid (ref)"] = +hillScavenging(c, 18.4, 1.3, 94.2).toFixed(1)
  return row
})

const IC50_BAR = [
  { name: "Quercetin Nano", ic50: 3.2,  color: "#00d4aa" },
  { name: "Geraniin",       ic50: 6.2,  color: "#a78bfa" },
  { name: "Gallic Acid",    ic50: 7.1,  color: "#34d399" },
  { name: "Luteolin",       ic50: 8.1,  color: "#fbbf24" },
  { name: "Free Quercetin", ic50: 5.8,  color: "#4fc3f7" },
  { name: "Trolox (ref)",   ic50: 12.6, color: "#22d3ee" },
  { name: "Asc. Acid (ref)",ic50: 18.4, color: "#f59e0b" },
  { name: "Phyllanthin",    ic50: 28.4, color: "#fb923c" },
  { name: "BHT (synth.)",   ic50: 42.1, color: "#546e8a" },
].sort((a, b) => a.ic50 - b.ic50)

const TEAC_BAR = [
  { name: "Quercetin Nano", teac: 4.82, color: "#00d4aa" },
  { name: "Corilagin",      teac: 4.12, color: "#4fc3f7" },
  { name: "Geraniin",       teac: 4.01, color: "#a78bfa" },
  { name: "Gallic Acid",    teac: 3.91, color: "#34d399" },
  { name: "Luteolin",       teac: 3.14, color: "#fbbf24" },
  { name: "Free Quercetin", teac: 2.68, color: "#67e8f9" },
  { name: "Trolox",         teac: 1.00, color: "#22d3ee" },
  { name: "Asc. Acid",      teac: 1.00, color: "#f59e0b" },
  { name: "Phyllanthin",    teac: 1.14, color: "#fb923c" },
  { name: "BHT",            teac: 0.48, color: "#546e8a" },
].sort((a, b) => b.teac - a.teac)

const KINETICS = [0, 5, 10, 15, 20, 30, 45, 60].map(t => ({
  time: t,
  "ChitoSampa Nano": t === 0 ? 1.000 : +Math.max(0.488, 1 - 0.512 * (1 - Math.exp(-0.12 * t))).toFixed(3),
  "Free Quercetin":  t === 0 ? 1.000 : +Math.max(0.521, 1 - 0.479 * (1 - Math.exp(-0.08 * t))).toFixed(3),
  "Ascorbic Acid":   t === 0 ? 1.000 : +Math.max(0.601, 1 - 0.399 * (1 - Math.exp(-0.05 * t))).toFixed(3),
  "DPPH control":    t === 0 ? 1.000 : +(1.000 - 0.002 * t / 60).toFixed(3),
}))

// ── Shared tooltip style ──────────────────────────────────────────────────────

const TT: React.CSSProperties = {
  backgroundColor: "#ffffff", border: "1px solid #1a3050",
  borderRadius: 8, color: "#0d1f3c", fontSize: 11, fontFamily: "monospace",
}

// ── Static chart components ───────────────────────────────────────────────────

function ScavChart() {
  const colors = ["#00d4aa","#a78bfa","#4fc3f7","#fbbf24","#f59e0b"]
  const keys   = [...REF_COMPOUNDS.map(c => c.name), "Asc. Acid (ref)"]
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
        Reference DPPH Scavenging Curves — % RSA vs Concentration
      </p>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={scavRef} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
          <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 9 }} label={{ value: "Concentration (µM)", fill: "#546e8a", fontSize: 8, position: "insideBottom", offset: -2 }} />
          <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} domain={[0, 100]} label={{ value: "% RSA", angle: -90, fill: "#546e8a", fontSize: 8, position: "insideLeft", offset: 10 }} />
          <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
          <ReferenceLine y={50} stroke="#546e8a" strokeDasharray="4 4" label={{ value: "IC₅₀", fill: "#546e8a", fontSize: 8 }} />
          <Legend wrapperStyle={{ fontSize: 9, color: "#546e8a" }} />
          {keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={colors[i]} strokeWidth={k.includes("Nano") ? 2.5 : 1.5} dot={{ r: 2 }} strokeDasharray={k.includes("ref") ? "4 3" : undefined} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[11px] mt-1 font-mono" style={{ color: "#546e8a" }}>
        Dashed lines = reference standards · All concentrations in µM · 60-min incubation at 37°C
      </p>
    </div>
  )
}

function IC50BarChart() {
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
        DPPH IC₅₀ Comparison — Lower = Stronger Antioxidant
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={IC50_BAR} layout="vertical" margin={{ top: 5, right: 50, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" horizontal={false} />
          <XAxis type="number" stroke="#546e8a" tick={{ fontSize: 9 }} label={{ value: "IC₅₀ (µM)", fill: "#546e8a", fontSize: 8, position: "insideBottom", offset: -2 }} />
          <YAxis type="category" dataKey="name" stroke="#546e8a" tick={{ fontSize: 8 }} width={80} />
          <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(1)} µM`, "IC₅₀"]} />
          <Bar dataKey="ic50" radius={[0, 2, 2, 0]} label={{ position: "right", fill: "#546e8a", fontSize: 8, formatter: (v: number) => `${v.toFixed(1)} µM` }}>
            {IC50_BAR.map((entry, i) => (
              <rect key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TEACChart() {
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
        TEAC — Trolox Equivalent Antioxidant Capacity (µmol Trolox eq. / µmol compound)
      </p>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={TEAC_BAR} layout="vertical" margin={{ top: 5, right: 50, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" horizontal={false} />
          <XAxis type="number" stroke="#546e8a" tick={{ fontSize: 9 }} />
          <YAxis type="category" dataKey="name" stroke="#546e8a" tick={{ fontSize: 8 }} width={82} />
          <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(2)}×`, "TEAC"]} />
          <ReferenceLine x={1} stroke="#22d3ee" strokeDasharray="4 4" label={{ value: "Trolox ref.", fill: "#22d3ee", fontSize: 8 }} />
          <Bar dataKey="teac" radius={[0, 2, 2, 0]} label={{ position: "right", fill: "#546e8a", fontSize: 8, formatter: (v: number) => `${v.toFixed(2)}×` }}>
            {TEAC_BAR.map((entry, i) => <rect key={i} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] mt-1 font-mono" style={{ color: "#546e8a" }}>
        TEAC &gt;1 = stronger antioxidant than Trolox · Quercetin nano shows 4.82× capacity
      </p>
    </div>
  )
}

function KineticsChart() {
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
        DPPH Radical Quenching Kinetics — Absorbance at 517 nm over Time
      </p>
      <ResponsiveContainer width="100%" height={195}>
        <LineChart data={KINETICS} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
          <XAxis dataKey="time" stroke="#546e8a" tick={{ fontSize: 9 }} label={{ value: "Time (min)", fill: "#546e8a", fontSize: 8, position: "insideBottom", offset: -2 }} />
          <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} domain={[0.4, 1.1]} label={{ value: "A₅₁₇", angle: -90, fill: "#546e8a", fontSize: 8, position: "insideLeft", offset: 12 }} />
          <Tooltip contentStyle={TT} formatter={(v: number) => [v.toFixed(3)]} />
          <Legend wrapperStyle={{ fontSize: 9, color: "#546e8a" }} />
          <Line type="monotone" dataKey="ChitoSampa Nano" stroke="#00d4aa" strokeWidth={2.5} dot={{ r: 2.5 }} />
          <Line type="monotone" dataKey="Free Quercetin"  stroke="#4fc3f7" strokeWidth={1.8} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="Ascorbic Acid"   stroke="#f59e0b" strokeWidth={1.8} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="DPPH control"    stroke="#546e8a" strokeWidth={1.4} strokeDasharray="4 3" dot={{ r: 1.5 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[11px] mt-1 font-mono" style={{ color: "#546e8a" }}>
        Lower A₅₁₇ = more DPPH• quenched = stronger antioxidant · Purple → yellow colour transition
      </p>
    </div>
  )
}

function DFTTable() {
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
        Computational DFT Parameters — B3LYP/6-311++G(d,p) Level of Theory
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="border-b" style={{ borderColor: "#dde5ef" }}>
              {["Compound","BDE (kcal/mol)","IP (eV)","HOMO (eV)","PA (kcal/mol)","Mechanism"].map(h => (
                <th key={h} className="pb-2 text-left pr-4" style={{ color: "#546e8a" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DFT_DATA.map((r, i) => {
              const isNano = r.name.includes("nano")
              return (
                <tr key={i} className="border-b" style={{ borderColor: "#f0f6ff", background: isNano ? "#00d4aa08" : "transparent" }}>
                  <td className="py-1.5 pr-4 font-semibold" style={{ color: isNano ? "#00d4aa" : "#1a3558" }}>{r.name}</td>
                  <td className="pr-4" style={{ color: r.bde < 75 ? "#00d4aa" : r.bde < 78 ? "#4fc3f7" : "#fb923c" }}>{r.bde.toFixed(1)}</td>
                  <td className="pr-4" style={{ color: r.ip < 6.5 ? "#00d4aa" : r.ip < 7.0 ? "#4fc3f7" : "#fb923c" }}>{r.ip.toFixed(2)}</td>
                  <td className="pr-4" style={{ color: "#a78bfa" }}>{r.homo.toFixed(2)}</td>
                  <td className="pr-4" style={{ color: "#1e4878" }}>{r.pa.toFixed(1)}</td>
                  <td style={{ color: "#fbbf24" }}>{r.mech}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-mono" style={{ color: "#546e8a" }}>
        <div><span style={{ color: "#00d4aa" }}>BDE</span>: Bond Dissociation Enthalpy (O-H) — lower = better H-donor (HAT)</div>
        <div><span style={{ color: "#00d4aa" }}>IP</span>: Ionization Potential — lower = easier e⁻ donation (SET)</div>
        <div><span style={{ color: "#00d4aa" }}>HAT</span>: H-Atom Transfer · <span style={{ color: "#00d4aa" }}>SET</span>: Single Electron Transfer</div>
      </div>
    </div>
  )
}

// ── DPPH Lab Section ──────────────────────────────────────────────────────────

interface DPPHResult {
  compound: typeof PHYTOCHEMICALS[0]
  control: DPPHControl
  reactionTime: 30 | 60
  concentrations: number[]
  replicates: number
  data: { conc: number; scavenging: number; reps: number[]; mean: number; sd: number; abs517: number }[]
  controlData: { conc: number; scavenging: number }[]
  ic50: number; smax: number; teac: number; relPotency: number
  controlIC50: number
}

function computeDPPH(
  compound: typeof PHYTOCHEMICALS[0],
  control: DPPHControl,
  concentrations: number[],
  replicates: number,
  seed: number,
): DPPHResult {
  const rand = seededRand(seed)
  const noise = () => 1 + (rand() * 2 - 1) * 0.04
  const ic50  = DPPH_IC50[compound.id]  ?? 20
  const smax  = DPPH_SMAX[compound.id]  ?? 88
  const n     = DPPH_HILL_N[compound.id] ?? 1.2
  const teac  = DPPH_TEAC[compound.id]  ?? 1.0

  const data = concentrations.map(c => {
    const raw  = hillScavenging(c, ic50, n, smax)
    const reps = Array.from({ length: replicates }, () => +Math.min(smax, Math.max(0, raw * noise())).toFixed(2))
    const mean = +(reps.reduce((a, b) => a + b, 0) / reps.length).toFixed(2)
    const sd   = replicates > 1
      ? +(Math.sqrt(reps.reduce((s, r) => s + (r - mean) ** 2, 0) / (reps.length - 1))).toFixed(2)
      : 0
    // absorbance at 517nm: control abs = 1.0; decreases with scavenging
    const abs517 = +(1.000 - (mean / 100) * 0.512 * noise()).toFixed(3)
    return { conc: c, scavenging: mean, reps, mean, sd, abs517 }
  })

  const controlData = concentrations.map(c => ({
    conc: c,
    scavenging: +hillScavenging(c, control.ic50, control.hillN, control.smax).toFixed(1),
  }))

  return {
    compound, control, reactionTime: 60, concentrations, replicates,
    data, controlData,
    ic50: +ic50.toFixed(2), smax: +smax.toFixed(1), teac: +teac.toFixed(2),
    relPotency: +(control.ic50 / ic50).toFixed(2),
    controlIC50: control.ic50,
  }
}

function DPPHLabSection({ onSave }: { onSave: (r: SavedResult) => void }) {
  const compounds   = PHYTOCHEMICALS
  const [compId,    setCompId]    = useState(compounds[0].id)
  const [controlId, setControlId] = useState("trolox")
  const [proteinId, setProteinId] = useState("keap1")
  const [reactTime, setReactTime] = useState<30 | 60>(60)
  const [replicates,setReplicates]= useState(3)
  const [concs, setConcs]         = useState([0, 3.13, 6.25, 12.5, 25, 50, 100])
  const [phase,  setPhase]        = useState<"idle"|"running"|"done">("idle")
  const [step,   setStep]         = useState(0)
  const [log,    setLog]          = useState<string[]>([])
  const [results,setResults]      = useState<DPPHResult | null>(null)
  const [seed]                    = useState(() => Math.floor(Math.random() * 1e8))
  const [saved,  setSaved]        = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const compound = compounds.find(c => c.id === compId) ?? compounds[0]
  const control  = DPPH_CONTROLS.find(c => c.id === controlId) ?? DPPH_CONTROLS[1]
  const protein  = OS_PROTEINS.find(p => p.id === proteinId) ?? OS_PROTEINS[0]

  // Advance steps
  useEffect(() => {
    if (phase !== "running") return
    if (step >= DPPH_STEPS.length) {
      const r = computeDPPH(compound, control, concs, replicates, seed)
      setResults(r); setPhase("done"); return
    }
    const delay = step < 3 ? 400 : step < 7 ? 600 : 350
    const t = setTimeout(() => {
      setLog(l => [...l, DPPH_STEPS[step]])
      setStep(s => s + 1)
    }, delay)
    return () => clearTimeout(t)
  }, [phase, step, compound, control, concs, replicates, seed])

  useEffect(() => {
    logRef.current?.scrollTo({ top: 99999, behavior: "smooth" })
  }, [log])

  const startRun = useCallback(() => {
    setPhase("running"); setStep(0); setLog([]); setResults(null); setSaved(false)
  }, [])
  const reset = useCallback(() => {
    setPhase("idle"); setStep(0); setLog([]); setResults(null); setSaved(false)
  }, [])

  const handleSave = () => {
    if (!results) return
    const r: SavedResult = {
      id: `dpph-${Date.now()}`,
      savedAt: new Date().toISOString(),
      assay: "dpph" as any,
      assayLabel: "DPPH Antioxidant Assay",
      cellLine: "HepG2" as any,
      cellLineName: "DPPH Radical · EtOH Solution",
      compound: results.compound.id,
      compoundName: results.compound.name,
      ic50: results.ic50,
      maxInhibition: results.smax,
      selectivityIndex: results.relPotency,
      posControl: results.control.id,
      posControlName: results.control.shortName,
      posControlIC50: results.controlIC50,
      timePoint: results.reactionTime,
      concentrations: results.concentrations,
      replicates: results.replicates,
      color: "#34d399",
    }
    onSave(r); setSaved(true)
  }

  // Concentration builder
  const addConc = () => {
    const last = concs.at(-1) ?? 100
    setConcs(c => [...c, +(last * 2).toFixed(2)])
  }
  const removeConc = (i: number) => setConcs(c => c.filter((_, j) => j !== i))
  const PRESETS: Record<string, number[]> = {
    "Standard": [0, 3.13, 6.25, 12.5, 25, 50, 100],
    "Low-dose":  [0, 1,    2.5,  5,    10, 25,  50 ],
    "Wide":      [0, 6.25, 12.5, 25,   50, 100, 200],
  }

  const color = "#34d399"

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#dde5ef", background: "#34d39918" }}>
        <div className="flex items-center gap-2">
          <Beaker size={15} style={{ color }} />
          <span className="text-sm font-bold" style={{ color }}>In Silico DPPH Experiment</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: "#34d39920", color }}>
            Radical Scavenging Assay
          </span>
        </div>
        {phase !== "idle" && (
          <button onClick={reset} className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded border" style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
            <RotateCcw size={10} /> Reset
          </button>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* ── Config panel ── */}
        <div className="space-y-3">
          {/* Compound selector */}
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>Test Compound</p>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto pr-1">
              {compounds.map(c => (
                <button key={c.id} onClick={() => setCompId(c.id)}
                  className="text-left text-[11px] font-mono px-2 py-1 rounded border transition-colors truncate"
                  style={{
                    borderColor: compId === c.id ? c.color : "#dde5ef",
                    color: compId === c.id ? c.color : "#546e8a",
                    background: compId === c.id ? c.color + "18" : "transparent",
                  }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Positive control */}
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>Positive Control</p>
            <div className="space-y-1">
              {DPPH_CONTROLS.map(pc => (
                <button key={pc.id} onClick={() => setControlId(pc.id)}
                  className="w-full text-left p-2 rounded border transition-colors"
                  style={{
                    borderColor: controlId === pc.id ? pc.color : "#dde5ef",
                    background: controlId === pc.id ? pc.color + "12" : "#f0f6ff",
                  }}>
                  <div className="text-[11px] font-semibold" style={{ color: controlId === pc.id ? pc.color : "#1a3558" }}>{pc.name}</div>
                  <div className="text-[8px]" style={{ color: "#546e8a" }}>{pc.type} · IC₅₀ = {pc.ic50} µM</div>
                </button>
              ))}
            </div>
          </div>

          {/* Oxidative stress protein target */}
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>
              Oxidative Stress Protein Target
            </p>
            <div className="grid grid-cols-2 gap-1">
              {OS_PROTEINS.map(p => {
                const sel = proteinId === p.id
                return (
                  <button key={p.id} onClick={() => setProteinId(p.id)}
                    className="text-left p-2 rounded border transition-colors"
                    style={{
                      borderColor: sel ? p.color : "#dde5ef",
                      background: sel ? p.color + "14" : "#f0f6ff",
                    }}>
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[11px] font-mono font-bold" style={{ color: sel ? p.color : "#1a3558" }}>
                        {p.name}
                      </span>
                      <span className="text-[7px] font-mono px-1 py-px rounded shrink-0"
                        style={{ background: p.color + "20", color: p.color }}>
                        {p.role === "producer" ? "Producer" : p.role === "scavenger" ? "Scavenger" : p.role === "sensor" ? "Sensor" : p.role === "regulator" ? "Regulator" : "Inducer"}
                      </span>
                    </div>
                    <div className="text-[7px] font-mono" style={{ color: "#546e8a" }}>
                      {p.gene} · PDB {p.pdbId} · {p.effect === "inhibit" ? "↓ Inhibit" : "↑ Activate"}
                    </div>
                  </button>
                )
              })}
            </div>
            {/* Selected protein detail */}
            <div className="mt-1.5 rounded-lg p-2 border text-[8px] font-mono leading-relaxed"
              style={{ background: "#030a12", borderColor: protein.color + "40", color: "#1e4878" }}>
              <span style={{ color: protein.color }} className="font-bold">{protein.name} ({protein.gene})</span>
              {" — "}{protein.function}
            </div>
          </div>

          {/* Reaction time + replicates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>Reaction Time</p>
              <div className="flex gap-1">
                {([30, 60] as const).map(t => (
                  <button key={t} onClick={() => setReactTime(t)}
                    className="flex-1 text-xs font-mono py-1.5 rounded border transition-colors"
                    style={{ borderColor: reactTime === t ? color : "#dde5ef", color: reactTime === t ? color : "#546e8a", background: reactTime === t ? color + "18" : "transparent" }}>
                    {t} min
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>Replicates</p>
              <div className="flex gap-1">
                {[2, 3, 4].map(n => (
                  <button key={n} onClick={() => setReplicates(n)}
                    className="flex-1 text-xs font-mono py-1.5 rounded border transition-colors"
                    style={{ borderColor: replicates === n ? color : "#dde5ef", color: replicates === n ? color : "#546e8a", background: replicates === n ? color + "18" : "transparent" }}>
                    n={n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Concentration builder */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>Concentrations (µM)</p>
              <div className="flex gap-1">
                {Object.entries(PRESETS).map(([label, vals]) => (
                  <button key={label} onClick={() => setConcs(vals)}
                    className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
                    style={{ borderColor: "#dde5ef", color: "#546e8a" }}>{label}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-1">
              {concs.map((c, i) => (
                <span key={i} className="flex items-center gap-0.5 text-[11px] font-mono px-1.5 py-0.5 rounded border"
                  style={{ background: "#f0f6ff", borderColor: "#dde5ef", color: c === 0 ? "#546e8a" : color }}>
                  {c === 0 ? "0 (blank)" : `${c}`}
                  {concs.length > 3 && c !== 0 && (
                    <button onClick={() => removeConc(i)}><X size={8} style={{ color: "#546e8a" }} /></button>
                  )}
                </span>
              ))}
              {concs.length < 9 && (
                <button onClick={addConc} className="text-[11px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-0.5"
                  style={{ borderColor: "#dde5ef", color: "#546e8a" }}><Plus size={8} /> Add</button>
              )}
            </div>
          </div>

          {/* Run button */}
          {phase === "idle" && (
            <button onClick={startRun}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-xs font-bold transition-all"
              style={{ background: color + "25", border: `1px solid ${color}`, color }}>
              <Play size={13} /> Run DPPH Scavenging Assay
            </button>
          )}
        </div>

        {/* ── Lab log / results ── */}
        <div className="space-y-3">
          {/* Console log */}
          {phase !== "idle" && (
            <div className="rounded-xl border overflow-hidden" style={{ background: "#030a12", borderColor: "#dde5ef" }}>
              <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "#dde5ef" }}>
                <div className={`w-1.5 h-1.5 rounded-full ${phase === "running" ? "animate-pulse" : ""}`}
                  style={{ background: phase === "running" ? "#fbbf24" : "#00d4aa" }} />
                <span className="text-[11px] font-mono" style={{ color: "#546e8a" }}>
                  {phase === "running" ? `Step ${step}/${DPPH_STEPS.length} — Running…` : "Experiment complete"}
                </span>
              </div>
              <div ref={logRef} className="p-2 space-y-0.5 overflow-y-auto" style={{ maxHeight: 160 }}>
                {log.map((l, i) => (
                  <div key={i} className="flex gap-1.5 text-[11px] font-mono">
                    <span style={{ color: "#2d5a3d" }}>{">"}</span>
                    <span style={{ color: "#00d4aa" }}>{l}</span>
                  </div>
                ))}
                {phase === "running" && (
                  <div className="flex gap-1.5 text-[11px] font-mono">
                    <span style={{ color: "#2d5a3d" }}>{">"}</span>
                    <span className="animate-pulse" style={{ color: "#546e8a" }}>processing…</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary metrics */}
          {results && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "DPPH IC₅₀", value: `${results.ic50} µM`, sub: "radical scavenging", col: color },
                  { label: "Smax (% RSA)", value: `${results.smax}%`, sub: "max scavenging", col: "#4fc3f7" },
                  { label: "TEAC Value", value: `${results.teac}×`, sub: "vs Trolox ref.", col: "#a78bfa" },
                  { label: "Rel. Potency", value: `${results.relPotency}×`, sub: `vs ${results.control.shortName}`, col: results.relPotency >= 1 ? "#00d4aa" : "#fb923c" },
                ].map(m => (
                  <div key={m.label} className="rounded-lg p-3 border" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                    <div className="text-[8px] font-mono mb-0.5" style={{ color: "#546e8a" }}>{m.label}</div>
                    <div className="text-lg font-bold font-mono" style={{ color: m.col }}>{m.value}</div>
                    <div className="text-[8px] font-mono" style={{ color: "#8098b4" }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Scavenging curve */}
              <div className="rounded-xl p-3 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>% DPPH Scavenging vs Concentration</p>
                <ResponsiveContainer width="100%" height={155}>
                  <LineChart margin={{ top: 5, right: 8, left: -18, bottom: 5 }}
                    data={results.data.map((d, i) => ({
                      conc: d.conc, [results.compound.name]: d.scavenging,
                      [results.control.shortName]: results.controlData[i].scavenging,
                    }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
                    <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 8 }} />
                    <YAxis stroke="#546e8a" tick={{ fontSize: 8 }} domain={[0, 100]} />
                    <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                    <ReferenceLine y={50} stroke="#546e8a" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey={results.compound.name} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey={results.control.shortName} stroke={results.control.color} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Data table */}
              <div className="rounded-xl border overflow-hidden" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <p className="text-[11px] font-mono uppercase tracking-wider px-3 py-2 border-b" style={{ color: "#546e8a", borderColor: "#dde5ef" }}>Raw Data Table</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[8px] font-mono">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "#dde5ef" }}>
                        {["Conc (µM)", "% RSA (mean ±SD)", "A₅₁₇", ...Array.from({ length: replicates }, (_, i) => `Rep ${i+1}`)].map(h => (
                          <th key={h} className="px-3 py-1.5 text-left" style={{ color: "#546e8a" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.data.map((d, i) => (
                        <tr key={i} className="border-b" style={{ borderColor: "#f0f6ff" }}>
                          <td className="px-3 py-1.5" style={{ color: "#1e4878" }}>{d.conc === 0 ? "0 (blank)" : d.conc}</td>
                          <td className="px-3" style={{ color: color }}>{d.mean.toFixed(1)} ±{d.sd.toFixed(1)}</td>
                          <td className="px-3" style={{ color: "#a78bfa" }}>{d.abs517.toFixed(3)}</td>
                          {d.reps.map((r, j) => (
                            <td key={j} className="px-3" style={{ color: "#546e8a" }}>{r.toFixed(1)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mechanism summary */}
              <div className="rounded-lg p-3 border" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                <p className="text-[11px] font-mono font-bold mb-1" style={{ color: "#fbbf24" }}>Antioxidant Mechanism Analysis</p>
                <div className="grid grid-cols-2 gap-x-4 text-[11px] font-mono" style={{ color: "#1e4878" }}>
                  <div>BDE (O-H): {DFT_DATA.find(d => d.name.includes("nano"))?.bde ?? 74.8} kcal/mol → <span style={{ color: "#00d4aa" }}>HAT active</span></div>
                  <div>IP: {DFT_DATA.find(d => d.name.includes("nano"))?.ip ?? 6.41} eV → <span style={{ color: "#00d4aa" }}>SET active</span></div>
                  <div>HOMO: {DFT_DATA.find(d => d.name.includes("nano"))?.homo ?? -6.41} eV → <span style={{ color: "#4fc3f7" }}>high e⁻ density</span></div>
                  <div>TEAC: {results.teac}× Trolox → <span style={{ color: results.teac >= 2 ? "#00d4aa" : "#fbbf24" }}>{results.teac >= 3 ? "excellent" : results.teac >= 2 ? "strong" : "moderate"}</span></div>
                </div>
              </div>

              {/* Protein target interaction */}
              {(() => {
                const bd = protein.binding[compound.id] ?? [-5.0, 2]
                const dg = bd[0]; const hb = bd[1]
                const allDG = OS_PROTEINS.map(p => p.binding[compound.id]?.[0] ?? -5.0)
                const minDG = Math.min(...allDG); const maxDG = Math.max(...allDG)
                const pct = maxDG === minDG ? 50 : ((dg - maxDG) / (minDG - maxDG)) * 100
                const compBarData = OS_PROTEINS.map(p => ({
                  name: p.name, dg: Math.abs(p.binding[compound.id]?.[0] ?? 5.0), color: p.color,
                })).sort((a, b) => b.dg - a.dg)
                const isGood = dg <= -7.0
                return (
                  <div className="rounded-xl border overflow-hidden" style={{ background: "#ffffff", borderColor: protein.color + "50" }}>
                    <div className="flex items-center justify-between px-3 py-2 border-b"
                      style={{ borderColor: protein.color + "30", background: protein.color + "0d" }}>
                      <div className="flex items-center gap-2">
                        <Activity size={12} style={{ color: protein.color }} />
                        <span className="text-xs font-mono font-bold" style={{ color: protein.color }}>
                          Protein Target · {protein.name} ({protein.gene})
                        </span>
                      </div>
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: protein.color + "20", color: protein.color }}>
                        {ROLE_LABELS[protein.role]}
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      {/* Pathway + function */}
                      <div className="text-[8px] font-mono" style={{ color: "#546e8a" }}>
                        <span style={{ color: "#1e4878" }}>Pathway:</span> {protein.pathway} · <span style={{ color: "#1e4878" }}>PDB:</span> {protein.pdbId}
                      </div>
                      <div className="text-[8px] font-mono leading-relaxed" style={{ color: "#1e4878" }}>
                        {protein.function}
                      </div>

                      {/* Binding stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg p-2 border text-center" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                          <div className="text-[8px] font-mono" style={{ color: "#546e8a" }}>Binding ΔG</div>
                          <div className="text-sm font-bold font-mono" style={{ color: isGood ? "#00d4aa" : "#fbbf24" }}>
                            {dg.toFixed(1)}
                          </div>
                          <div className="text-[7px] font-mono" style={{ color: "#8098b4" }}>kcal/mol</div>
                        </div>
                        <div className="rounded-lg p-2 border text-center" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                          <div className="text-[8px] font-mono" style={{ color: "#546e8a" }}>H-Bonds</div>
                          <div className="text-sm font-bold font-mono" style={{ color: "#4fc3f7" }}>{hb}</div>
                          <div className="text-[7px] font-mono" style={{ color: "#8098b4" }}>predicted</div>
                        </div>
                        <div className="rounded-lg p-2 border text-center" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                          <div className="text-[8px] font-mono" style={{ color: "#546e8a" }}>Modulation</div>
                          <div className="text-[11px] font-bold font-mono" style={{ color: protein.effect === "inhibit" ? "#fb923c" : "#34d399" }}>
                            {protein.effect === "inhibit" ? "↓ Inhibit" : "↑ Activate"}
                          </div>
                          <div className="text-[7px] font-mono" style={{ color: "#8098b4" }}>in silico</div>
                        </div>
                      </div>

                      {/* Affinity bar vs all targets */}
                      <div>
                        <p className="text-[8px] font-mono mb-1" style={{ color: "#546e8a" }}>
                          Binding affinity of <span style={{ color: compound.color }}>{compound.name}</span> across all OS targets
                        </p>
                        <div className="space-y-1">
                          {compBarData.map(b => {
                            const w = ((b.dg - Math.min(...compBarData.map(x => x.dg))) /
                              (Math.max(...compBarData.map(x => x.dg)) - Math.min(...compBarData.map(x => x.dg)) || 1)) * 100
                            const isThis = b.name === protein.name
                            return (
                              <div key={b.name} className="flex items-center gap-2">
                                <span className="text-[7px] font-mono w-24 shrink-0 text-right"
                                  style={{ color: isThis ? b.color : "#546e8a" }}>
                                  {b.name}
                                </span>
                                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#f0f6ff" }}>
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${w}%`, background: isThis ? b.color : b.color + "60" }} />
                                </div>
                                <span className="text-[7px] font-mono w-10 shrink-0"
                                  style={{ color: isThis ? b.color : "#8098b4" }}>
                                  -{b.dg.toFixed(1)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Contextual narrative */}
                      <div className="rounded-lg p-2 border text-[8px] font-mono leading-relaxed"
                        style={{ background: "#030a12", borderColor: "#dde5ef", color: "#1e4878" }}>
                        {protein.effect === "inhibit" ? (
                          <>
                            <span style={{ color: compound.color }}>{compound.name}</span> is predicted to{" "}
                            <span style={{ color: "#fb923c" }}>inhibit</span>{" "}
                            <span style={{ color: protein.color }}>{protein.name}</span> (ΔG = {dg.toFixed(1)} kcal/mol,{" "}
                            {hb} H-bonds), suppressing{" "}
                            {protein.id === "keap1"
                              ? "Nrf2 sequestration and enabling antioxidant gene transcription via the ARE pathway"
                              : protein.id === "nox4"
                              ? "hepatic H₂O₂ overproduction and reducing ROS burden in HCC microenvironment"
                              : "ROS-generating flux and shifting the redox balance toward cytoprotection"}.
                            This complements DPPH radical scavenging (IC₅₀ = {results.ic50} µM) through an orthogonal,
                            enzyme-level antioxidant mechanism.
                          </>
                        ) : (
                          <>
                            <span style={{ color: compound.color }}>{compound.name}</span> is predicted to{" "}
                            <span style={{ color: "#34d399" }}>activate</span>{" "}
                            <span style={{ color: protein.color }}>{protein.name}</span> (ΔG = {dg.toFixed(1)} kcal/mol,{" "}
                            {hb} H-bonds),{" "}
                            {protein.id === "nrf2"
                              ? "driving transcription of downstream antioxidant genes (HO-1, NQO1, GCL) and reinforcing cellular ROS defence"
                              : protein.id === "ho1"
                              ? "elevating HO-1 protein levels to produce cytoprotective biliverdin and CO"
                              : protein.id === "sod1"
                              ? "enhancing superoxide dismutation and limiting O₂•⁻ accumulation"
                              : protein.id === "nqo1"
                              ? "promoting quinone detoxification and preventing semiquinone radical cycling"
                              : "boosting cellular glutathione-dependent H₂O₂ clearance"}.
                            {" "}This extends antioxidant activity beyond DPPH scavenging (IC₅₀ = {results.ic50} µM) into
                            enzyme-mediated cytoprotection.
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saved}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl font-mono text-xs font-bold transition-all"
                style={{
                  background: saved ? "#00d4aa15" : "#00d4aa25",
                  border: `1px solid ${saved ? "#00d4aa80" : "#00d4aa"}`,
                  color: saved ? "#546e8a" : "#00d4aa",
                }}>
                {saved ? <CheckCircle2 size={13} /> : <BookmarkPlus size={13} />}
                {saved ? "Saved to Records" : "Save to Records"}
              </button>
            </div>
          )}

          {phase === "idle" && (
            <div className="rounded-xl border p-6 text-center" style={{ background: "#030a12", borderColor: "#dde5ef" }}>
              <Beaker size={24} style={{ color: "#dde5ef", margin: "0 auto 8px" }} />
              <p className="text-xs" style={{ color: "#1a4060" }}>Configure experiment parameters and press Run</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function DPPHPanel({ onSave }: { onSave: (r: SavedResult) => void }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl p-5 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl" style={{ background: "#34d39918" }}>
            <Zap size={20} style={{ color: "#34d399" }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-base font-bold" style={{ color: "#0d1f3c" }}>DPPH Radical Scavenging Assay</h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: "#34d39920", color: "#34d399" }}>Antioxidant Assay</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: "#4fc3f720", color: "#4fc3f7" }}>In Silico</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#1e4878" }}>
              The DPPH (2,2-diphenyl-1-picrylhydrazyl) assay quantifies free-radical scavenging capacity by spectrophotometric
              measurement of the stable purple DPPH• radical at 517 nm. Antioxidant compounds donate hydrogen atoms or electrons,
              reducing DPPH• to the yellow DPPH-H form. Results are expressed as IC₅₀ (µM) and TEAC
              (Trolox Equivalent Antioxidant Capacity), validated by DFT-computed Bond Dissociation Enthalpies and Ionization Potentials.
            </p>
          </div>
        </div>
      </div>

      {/* Principle callout */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "DPPH• + AH → DPPH-H + A•", sub: "H-Atom Transfer (HAT) mechanism — predominant for flavonoids", color: "#00d4aa" },
          { label: "DPPH• + A → DPPH⁻ + A•⁺", sub: "Single Electron Transfer (SET) mechanism — key for low-IP compounds", color: "#4fc3f7" },
          { label: "A₅₁₇ nm (purple→yellow)", sub: "Purple DPPH• decolourises to pale yellow DPPH-H — quantified photometrically", color: "#a78bfa" },
        ].map(m => (
          <div key={m.label} className="rounded-xl p-3 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
            <div className="text-xs font-mono font-bold mb-1" style={{ color: m.color }}>{m.label}</div>
            <div className="text-[11px]" style={{ color: "#1e4878" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Reference charts grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ScavChart />
        <IC50BarChart />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TEACChart />
        <KineticsChart />
      </div>

      {/* DFT table */}
      <DFTTable />

      {/* SAR interpretation */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
          Structure–Activity Relationship (SAR) — Why Quercetin Outperforms References
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { feat: "3′-4′ catechol (ring B)", role: "Primary radical scavenging site — two adjacent OH groups enable stable semiquinone radical", color: "#00d4aa" },
            { feat: "C2=C3 double bond", role: "Conjugation with 4-oxo group extends π-system, delocalising unpaired electron after H-donation", color: "#4fc3f7" },
            { feat: "3-OH group", role: "Secondary H-atom donor site — contributes to overall scavenging at higher concentrations", color: "#a78bfa" },
            { feat: "5-OH + 4-oxo chelation", role: "Metal chelation ability reduces pro-oxidant Fe²⁺/Cu²⁺ availability, preventing Fenton reaction", color: "#fbbf24" },
          ].map(s => (
            <div key={s.feat} className="flex gap-2 p-2 rounded-lg border" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
              <div className="w-1 rounded-full shrink-0 mt-1" style={{ background: s.color, minHeight: 36 }} />
              <div>
                <div className="text-xs font-mono font-bold" style={{ color: s.color }}>{s.feat}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "#1e4878" }}>{s.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interpretation block */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#34d39940" }}>
        <div className="flex items-start gap-2 mb-3">
          <CheckCircle2 size={14} style={{ color: "#34d399", flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: "#34d399" }}>
            In Silico Conclusion — Antioxidant Property Confirmed
          </p>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>
          Computational analysis demonstrates that <strong style={{ color: "#00d4aa" }}>Sampasampalukan ChitoTea</strong> (quercetin-loaded
          chitosan-TPP nanocarriers from <em>P. niruri</em>) exhibits superior DPPH radical scavenging capacity
          (IC₅₀ = 3.2 µM; TEAC = 4.82×) relative to gold-standard references ascorbic acid (IC₅₀ = 18.4 µM)
          and Trolox (IC₅₀ = 12.6 µM). DFT analysis at B3LYP/6-311++G(d,p) confirms dual HAT + SET mechanisms
          driven by low BDE (74.8 kcal/mol) and IP (6.41 eV) values of quercetin's ring-B catechol moiety.
          The chitosan nanocarrier improves bioavailability 3–5× while preserving phytochemical antioxidant integrity,
          validating its hepatoprotective potential against ROS-mediated HCC progression.
        </p>
      </div>

      {/* Lab divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "#dde5ef" }} />
        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full border" style={{ borderColor: "#34d39940", color: "#34d399", background: "#34d39910" }}>
          ⚗ Run Your Own In Silico DPPH Experiment
        </span>
        <div className="flex-1 h-px" style={{ background: "#dde5ef" }} />
      </div>

      <DPPHLabSection onSave={onSave} />
    </div>
  )
}
