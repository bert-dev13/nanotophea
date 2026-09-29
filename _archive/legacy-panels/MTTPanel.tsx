"use client"

import { FlaskConical, TrendingDown, Activity, Shield, CheckCircle2 } from "lucide-react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { MTT_TABLE } from "@/data/assay-tables"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"

export default function MTTPanel() {
  return (
    <div className="space-y-5">
      <SectionHeader icon={FlaskConical} title="MTT Cell Viability Assay" color="#4fc3f7" badge="HepG2 · 72h" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="IC₅₀" value="19.84" unit="µM" sub="HepG2 · 72h" color="#00d4aa" icon={TrendingDown} />
        <MetricCard label="Viability @ IC₅₀" value="50.0" unit="%" color="#4fc3f7" icon={Activity} />
        <MetricCard label="Max Inhibition" value="87.9" unit="%" sub="at 200 µM" color="#a78bfa" icon={Shield} />
        <MetricCard label="Selectivity Index" value="4.2" unit="×" sub="vs normal hepatocytes" color="#fb923c" icon={CheckCircle2} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
          <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Dose–Response Curve</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={MTT_TABLE} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="mtt-g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
              <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 10 }} />
              <YAxis stroke="#546e8a" tick={{ fontSize: 10 }} domain={[0, 110]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <ReferenceLine y={50} stroke="#fb923c" strokeDasharray="4 4" label={{ value: "IC₅₀", fill: "#fb923c", fontSize: 10 }} />
              <Area type="monotone" dataKey="viability" stroke="#00d4aa" fill="url(#mtt-g)" strokeWidth={2} dot={{ r: 2.5, fill: "#00d4aa" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
          <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Absorbance (A₅₇₀)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MTT_TABLE} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
              <XAxis dataKey="conc" stroke="#546e8a" tick={{ fontSize: 10 }} />
              <YAxis stroke="#546e8a" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toFixed(3), "A₅₇₀"]} />
              <Bar dataKey="absorbance" fill="#4fc3f7" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>Data Table</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead><tr style={{ borderBottom: "1px solid #1a3050" }}>
              {["Conc. (µM)", "A₅₇₀", "Viability (%)", "Inhibition (%)", "Cytotoxicity"].map((h) => (
                <th key={h} className="text-left py-1.5 pr-3" style={{ color: "#546e8a" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {MTT_TABLE.map((r) => {
                const g = r.inhibition > 70 ? "High" : r.inhibition > 40 ? "Moderate" : r.inhibition > 15 ? "Low" : "Minimal"
                const gc = r.inhibition > 70 ? "#fb923c" : r.inhibition > 40 ? "#f472b6" : r.inhibition > 15 ? "#4fc3f7" : "#34d399"
                return (
                  <tr key={r.conc} style={{ borderBottom: "1px solid #0f2240" }}>
                    <td className="py-1 pr-3" style={{ color: "#0d1f3c" }}>{r.conc === 0 ? "0 (Control)" : r.conc}</td>
                    <td className="py-1 pr-3" style={{ color: "#4fc3f7" }}>{r.absorbance.toFixed(3)}</td>
                    <td className="py-1 pr-3" style={{ color: "#00d4aa" }}>{r.viability.toFixed(1)}</td>
                    <td className="py-1 pr-3" style={{ color: r.inhibition > 50 ? "#fb923c" : "#0d1f3c" }}>{r.inhibition.toFixed(1)}</td>
                    <td style={{ color: gc }}>{g}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Interpretation color="#4fc3f7" title="MTT Interpretation"
        text="Quercetin-Chitosan/TPP nanocarriers achieve IC₅₀ = 19.84 µM against HepG2 — 3.8× more potent than free quercetin (75.2 µM). The selectivity index of 4.2 confirms cancer-selective killing. Absorbance values at 570 nm directly reflect viable mitochondria (formazan reduction assay). The sigmoidal dose–response is consistent with receptor-mediated, saturable pharmacological action."
        refs={["PMID: 34521087", "PubChem CID 5280343", "ChEMBL31676"]} />
    </div>
  )
}
