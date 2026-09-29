"use client"

import { Activity, TrendingDown, Shield, CheckCircle2, Zap } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts"
import { BAX_TABLE } from "@/data/assay-tables"
import { DockingViewer3D } from "@/lib/mol3d"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"

export default function BAXPanel() {
  return (
    <div className="space-y-5">
      <SectionHeader icon={Activity} title="BAX Apoptosis Pathway" color="#fb923c" badge="Flow Cytometry · Annexin V/PI" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="BAX Upregulation" value="+224%" unit="" sub="pro-apoptotic" color="#fb923c" icon={Activity} />
        <MetricCard label="BCL-2 Suppression" value="−72%" unit="" sub="anti-apoptotic" color="#f472b6" icon={TrendingDown} />
        <MetricCard label="BAX/BCL-2 Ratio" value="11.57×" unit="" sub="apoptotic index" color="#00d4aa" icon={CheckCircle2} />
        <MetricCard label="Caspase-3" value="+208%" unit="" sub="executioner caspase" color="#4fc3f7" icon={Zap} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
          <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Apoptosis Marker Fold-Change</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={BAX_TABLE} margin={{ top: 5, right: 8, left: -15, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
              <XAxis dataKey="marker" stroke="#546e8a" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis stroke="#546e8a" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toFixed(2), "Fold vs Control"]} />
              <ReferenceLine y={1} stroke="#546e8a" strokeDasharray="4 4" />
              <Bar dataKey="treated" fill="#fb923c" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
          <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Flow Cytometry Quadrants (Annexin V/PI)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Viable", pct: "12.4%", sub: "Q3 Ann−/PI−", color: "#00d4aa" },
              { label: "Early Apoptosis", pct: "34.8%", sub: "Q4 Ann+/PI−", color: "#4fc3f7" },
              { label: "Late Apoptosis", pct: "38.2%", sub: "Q2 Ann+/PI+", color: "#fb923c" },
              { label: "Necrosis", pct: "14.6%", sub: "Q1 Ann−/PI+", color: "#f472b6" },
            ].map((q) => (
              <div key={q.label} className="rounded-lg p-2 text-center border" style={{ background: "#f0f5ff", borderColor: "#dde5ef" }}>
                <div className="text-lg font-bold font-mono" style={{ color: q.color }}>{q.pct}</div>
                <div className="text-xs font-semibold" style={{ color: "#1a3558" }}>{q.label}</div>
                <div className="text-xs" style={{ color: "#546e8a" }}>{q.sub}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs font-mono" style={{ color: "#546e8a" }}>
            Total apoptosis: <span style={{ color: "#00d4aa" }}>73.0%</span> · Δψm loss: <span style={{ color: "#fb923c" }}>+188%</span>
          </div>
        </div>
      </div>

      {/* 3D Structure viewer */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
          3D Molecular Structure · BAX (PDB: 4S0O) vs. Quercetin (CID: 5280343)
        </p>
        <DockingViewer3D
          pdbId="4S0O"
          cid={5280343}
          proteinName="BAX"
          compoundName="Quercetin"
          proteinColor="#fb923c"
          compoundColor="#00d4aa"
          height={380}
        />
      </div>

      <Interpretation color="#fb923c" title="BAX Pathway Interpretation"
        text="QCN drives BAX/BCL-2 ratio to 11.57 — far above the apoptotic threshold of 1.0. Cytochrome c release (+187%) assembles the apoptosome, triggering Caspase-9 → Caspase-3 cascade. PARP cleavage (0.19×) confirms apoptosis execution. 73% total apoptosis vs. 14.6% necrosis indicates clean, inflammation-free cancer cell death — critical for safety in a diseased liver environment."
        refs={["PMID: 33018345", "PDB: 4S0O — BAX", "PDB: 2XYG — CASP3"]} />
    </div>
  )
}
