"use client"

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

function CellLineSidebar({ selected, onSelect }: { selected: CellLineKey; onSelect: (k: CellLineKey) => void }) {
  const groups = [
    { label: "HCC Cancer Lines", keys: ["HepG2", "Huh7", "Hep3B", "PLCPRF5", "SNU449", "SNU182", "SNU387", "SKHEP1"] as CellLineKey[] },
    { label: "Normal / Control", keys: ["L02", "WRL68", "LX2"] as CellLineKey[] },
  ]
  return (
    <div className="w-48 shrink-0 space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="text-xs font-mono uppercase tracking-wider mb-2 px-1" style={{ color: "#546e8a" }}>{g.label}</p>
          <div className="space-y-0.5">
            {g.keys.map((k) => {
              const cl = CELL_LINES[k]
              const isActive = selected === k
              return (
                <button key={k} onClick={() => onSelect(k)}
                  className="w-full text-left rounded-lg px-3 py-2 transition-all"
                  style={{
                    background: isActive ? cl.color + "20" : "transparent",
                    borderLeft: `2px solid ${isActive ? cl.color : "transparent"}`,
                  }}>
                  <div className="text-xs font-semibold" style={{ color: isActive ? cl.color : "#1a3558" }}>{cl.name}</div>
                  <div className="text-xs" style={{ color: "#546e8a" }}>{cl.type === "cancer" ? "HCC" : "Normal"} · p53: {cl.p53.split(" ")[0]}</div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CellLinePanel() {
  const [selected, setSelected] = useState<CellLineKey>("HepG2")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const cl = CELL_LINES[selected]

  const doseData = cl.dose.map((d, i) => ({
    conc: d,
    viability: cl.viability[i],
    inhibition: +(100 - cl.viability[i]).toFixed(1),
    absorbance: cl.absorbance[i],
  }))

  const compareData = Object.values(CELL_LINES).map((c) => ({
    name: c.name,
    ic50: c.ic50,
    apoptosis: c.apoptosis,
    type: c.type,
    color: c.color,
  }))

  return (
    <div className="space-y-5">
      <SectionHeader icon={Microscope} title="Cell Line Analysis" color="#00d4aa" badge="11 Lines · HCC + Normal Controls" />

      <div className="flex flex-col md:flex-row gap-4">
        {sidebarOpen && (
          <div className="md:w-48 shrink-0 overflow-x-auto md:overflow-visible">
            <CellLineSidebar selected={selected} onSelect={setSelected} />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-4">
          {/* Cell line header */}
          <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: cl.color + "50" }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold" style={{ color: cl.color }}>{cl.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-mono" style={{
                    background: cl.type === "cancer" ? "#fb923c20" : "#34d39920",
                    color: cl.type === "cancer" ? "#fb923c" : "#34d399"
                  }}>
                    {cl.type === "cancer" ? "CANCER LINE" : "NORMAL CONTROL"}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "#1a3558" }}>{cl.fullName}</p>
                <p className="text-xs mt-0.5" style={{ color: "#546e8a" }}>
                  Source: {cl.source} · p53: {cl.p53} · HBV: {cl.hbv}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#546e8a" }}>
                  Doubling: {cl.doubling} · {cl.morphology}
                </p>
              </div>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-xs px-2 py-1 rounded border"
                style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
                <SlidersHorizontal size={12} />
              </button>
            </div>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "#1e4878" }}>
              <span className="font-semibold" style={{ color: cl.color }}>Clinical Relevance: </span>
              {cl.clinicalRelevance}
            </p>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard label="IC₅₀ (Nano)" value={cl.ic50} unit="µM" sub={`vs free: ${cl.ic50Free} µM`} color={cl.color} icon={TrendingDown} />
            {cl.type === "cancer" ? (
              <>
                <MetricCard label="Max Inhibition" value={cl.maxInhibition} unit="%" sub="at 200 µM" color="#a78bfa" icon={Shield} />
                <MetricCard label="Apoptosis %" value={cl.apoptosis} unit="%" sub="Annexin V/PI" color="#fb923c" icon={Activity} />
                <MetricCard label="SI Index" value={cl.selectivityIndex} unit="×" sub="vs. normal" color="#34d399" icon={CheckCircle2} />
              </>
            ) : (
              <>
                <MetricCard label="Max Inhibition" value={cl.maxInhibition} unit="%" sub="minimal" color="#64748b" icon={Shield} />
                <MetricCard label="Apoptosis %" value={cl.apoptosis} unit="%" sub="minimal effect" color="#64748b" icon={Activity} />
                <MetricCard label="Safety Margin" value={`${(cl.ic50 / CELL_LINES.HepG2.ic50).toFixed(1)}×`} unit="" sub="vs HepG2 IC50" color="#34d399" icon={CheckCircle2} />
              </>
            )}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
                Dose–Response Curve — {cl.name}
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={doseData} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
                  <defs>
                    <linearGradient id={`grad-${cl.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={cl.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={cl.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
                  <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#546e8a" tick={{ fontSize: 10 }} domain={[0, 110]} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(1)}%`, "Viability"]} />
                  <ReferenceLine y={50} stroke="#fb923c" strokeDasharray="4 4"
                    label={{ value: `IC₅₀=${cl.ic50}µM`, fill: "#fb923c", fontSize: 10 }} />
                  <Area type="monotone" dataKey="viability" stroke={cl.color}
                    fill={`url(#grad-${cl.id})`} strokeWidth={2} dot={{ r: 2, fill: cl.color }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
                Absorbance (A₅₇₀) vs. Concentration
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={doseData} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
                  <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#546e8a" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toFixed(3), "A₅₇₀"]} />
                  <Bar dataKey="absorbance" fill={cl.color} radius={[2, 2, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Inhibition table */}
          <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
            <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
              Full Data Table — {cl.name}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a3050" }}>
                    {["Conc. (µM)", "A₅₇₀", "Viability (%)", "Inhibition (%)", "Cytotoxicity Grade"].map((h) => (
                      <th key={h} className="text-left py-1.5 pr-3" style={{ color: "#546e8a" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doseData.map((row) => {
                    const inh = row.inhibition
                    const grade = inh > 70 ? "High" : inh > 40 ? "Moderate" : inh > 15 ? "Low" : "Minimal"
                    const gradeColor = inh > 70 ? "#fb923c" : inh > 40 ? "#f472b6" : inh > 15 ? "#4fc3f7" : "#34d399"
                    return (
                      <tr key={row.conc} style={{ borderBottom: "1px solid #0f2240" }}>
                        <td className="py-1 pr-3" style={{ color: "#0d1f3c" }}>{row.conc === 0 ? "0 (Control)" : row.conc}</td>
                        <td className="py-1 pr-3" style={{ color: "#4fc3f7" }}>{row.absorbance.toFixed(3)}</td>
                        <td className="py-1 pr-3" style={{ color: cl.color }}>{row.viability.toFixed(1)}</td>
                        <td className="py-1 pr-3" style={{ color: inh > 50 ? "#fb923c" : "#0d1f3c" }}>{inh.toFixed(1)}</td>
                        <td className="py-1" style={{ color: gradeColor }}>{grade}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-cell-line comparison */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
          IC₅₀ Comparison — All Cell Lines (µM · lower = more sensitive)
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={compareData.sort((a, b) => a.ic50 - b.ic50)}
            margin={{ top: 5, right: 10, left: -10, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
            <XAxis dataKey="name" stroke="#546e8a" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
            <YAxis stroke="#546e8a" tick={{ fontSize: 10 }} label={{ value: "µM", angle: -90, position: "insideLeft", fill: "#546e8a", fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(2)} µM`, "IC₅₀"]} />
            <ReferenceLine y={50} stroke="#fb923c" strokeDasharray="4 4"
              label={{ value: "Selectivity Threshold", fill: "#fb923c", fontSize: 10 }} />
            {compareData.sort((a, b) => a.ic50 - b.ic50).map((d) => null)}
            <Bar dataKey="ic50" radius={[3, 3, 0, 0]}>
              {compareData.sort((a, b) => a.ic50 - b.ic50).map((entry, idx) => (
                <Cell key={idx} fill={entry.type === "cancer" ? entry.color : "#c0ccd8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1 text-xs" style={{ color: "#546e8a" }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#00d4aa" }} /> Cancer lines (HCC)
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: "#546e8a" }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#c0ccd8" }} /> Normal controls
          </span>
        </div>
      </div>
    </div>
  )
}
