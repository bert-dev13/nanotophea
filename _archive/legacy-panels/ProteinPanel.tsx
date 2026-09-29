"use client"

import { useState } from "react"
import {
  Atom, Activity, CheckCircle2, BrainCircuit, ArrowUpRight, ArrowDownRight, ExternalLink,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts"
import { PROTEINS, type ProteinTarget } from "@/data/proteins"
import { DockingViewer3D } from "@/lib/mol3d"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { ConfidenceBar } from "@/components/ui/ConfidenceBar"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"

export default function ProteinPanel() {
  const [selected, setSelected] = useState<string>("YAP1")
  const [filter, setFilter] = useState<string>("all")
  const protein = PROTEINS.find((p) => p.id === selected)!

  const roles = ["all", "oncogene", "tumor-suppressor", "apoptosis", "antioxidant", "invasion"]

  const filtered = filter === "all" ? PROTEINS : PROTEINS.filter((p) => p.role === filter)

  const effectColor = (p: ProteinTarget) =>
    p.effect === "upregulated" ? "#00d4aa" : p.effect === "downregulated" ? "#fb923c" : "#4fc3f7"

  return (
    <div className="space-y-5">
      <SectionHeader icon={Atom} title="Protein Target Browser" color="#a78bfa"
        badge="12 Targets · AutoDock Vina · PDB" />

      {/* Filter */}
      <div className="flex flex-wrap gap-1.5">
        {roles.map((r) => (
          <button key={r} onClick={() => setFilter(r)}
            className="text-xs font-mono px-2.5 py-1 rounded-full border transition-colors capitalize"
            style={{
              borderColor: filter === r ? "#a78bfa" : "#dde5ef",
              color: filter === r ? "#a78bfa" : "#546e8a",
              background: filter === r ? "#a78bfa15" : "transparent",
            }}>
            {r}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Protein list */}
        <div className="w-44 shrink-0 space-y-0.5">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className="w-full text-left rounded-lg px-3 py-2 transition-all"
              style={{
                background: selected === p.id ? p.color + "20" : "transparent",
                borderLeft: `2px solid ${selected === p.id ? p.color : "transparent"}`,
              }}>
              <div className="text-xs font-semibold" style={{ color: selected === p.id ? p.color : "#1a3558" }}>
                {p.name}
              </div>
              <div className="text-xs" style={{ color: "#546e8a" }}>{p.pathway}</div>
              <div className="text-xs font-mono" style={{ color: p.bindingScore <= -8 ? "#00d4aa" : "#546e8a" }}>
                {p.bindingScore} kcal/mol
              </div>
            </button>
          ))}
        </div>

        {/* Protein detail */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: protein.color + "50" }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold" style={{ color: protein.color }}>{protein.name}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded capitalize"
                    style={{ background: protein.color + "20", color: protein.color }}>
                    {protein.role}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "#1a3558" }}>Gene: {protein.gene} · PDB: {protein.pdb}</p>
                <p className="text-xs mt-0.5" style={{ color: "#546e8a" }}>Pathway: {protein.pathway}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono" style={{ color: "#34d399" }}>{protein.bindingScore}</div>
                <div className="text-xs" style={{ color: "#546e8a" }}>kcal/mol (AutoDock Vina)</div>
              </div>
            </div>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "#1e4878" }}>{protein.function}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard label="Binding Score" value={protein.bindingScore} unit="kcal/mol" color="#34d399" icon={Atom} />
            <MetricCard label="Kᵢ (Inhibition)" value={protein.ki} color="#4fc3f7" icon={Activity} />
            <MetricCard label="RMSD" value={protein.rmsd} color="#a78bfa" icon={CheckCircle2} />
            <MetricCard label="AI Confidence" value={`${protein.confidence}%`} color={protein.confidence >= 90 ? "#00d4aa" : "#fb923c"} icon={BrainCircuit} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Binding interactions */}
            <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
                Key Binding Interactions
              </p>
              <div className="space-y-2">
                {protein.interactions.map((b) => {
                  const c = b.type === "H-bond" ? "#4fc3f7" : b.type.includes("π") ? "#a78bfa" : b.type === "Hydrophobic" ? "#fb923c" : "#546e8a"
                  return (
                    <div key={b.residue} className="flex items-center justify-between text-xs font-mono">
                      <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: c + "20", color: c }}>{b.type}</span>
                      <span style={{ color: "#1a3558" }}>{b.residue}</span>
                      <span style={{ color: "#546e8a" }}>{b.dist}</span>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 pt-3" style={{ borderTop: "1px solid #1a3050" }}>
                <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>
                  AI Confidence
                </p>
                <ConfidenceBar value={protein.confidence} />
              </div>
            </div>

            {/* Expression effect */}
            <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
                Expression Effect in HCC (vs. Control)
              </p>
              <div className="flex items-center gap-3 mb-3">
                {protein.effect === "upregulated" ? (
                  <ArrowUpRight size={32} style={{ color: "#00d4aa" }} />
                ) : protein.effect === "downregulated" ? (
                  <ArrowDownRight size={32} style={{ color: "#fb923c" }} />
                ) : (
                  <Activity size={32} style={{ color: "#4fc3f7" }} />
                )}
                <div>
                  <div className="text-2xl font-bold font-mono" style={{ color: effectColor(protein) }}>
                    {protein.foldChange}×
                  </div>
                  <div className="text-xs capitalize" style={{ color: effectColor(protein) }}>{protein.effect}</div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={100}>
                <BarChart
                  data={[{ name: "Control", val: 1 }, { name: "Treated", val: protein.foldChange }]}
                  margin={{ top: 0, right: 5, left: -20, bottom: 0 }}
                >
                  <XAxis dataKey="name" stroke="#546e8a" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#546e8a" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <ReferenceLine y={1} stroke="#546e8a" strokeDasharray="4 4" />
                  <Bar dataKey="val" fill={effectColor(protein)} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 3D structure viewer for selected protein */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
          3D Structure · {protein.name} (PDB: {protein.pdb}) vs. Quercetin (CID: 5280343) — AutoDock Vina Docking
        </p>
        <DockingViewer3D
          pdbId={protein.pdb}
          cid={5280343}
          proteinName={protein.name}
          compoundName="Quercetin"
          proteinColor={protein.color}
          compoundColor="#00d4aa"
          height={380}
        />
      </div>

      {/* All targets binding comparison */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
          Binding Affinity Overview — All Targets (kcal/mol · more negative = stronger binding)
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={[...PROTEINS].sort((a, b) => a.bindingScore - b.bindingScore)
              .map((p) => ({ name: p.name, score: Math.abs(p.bindingScore), color: p.color }))}
            margin={{ top: 5, right: 10, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
            <XAxis dataKey="name" stroke="#546e8a" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
            <YAxis stroke="#546e8a" tick={{ fontSize: 10 }} domain={[5, 10]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`−${v.toFixed(1)} kcal/mol`, "Binding Energy"]} />
            <Bar dataKey="score" fill="#a78bfa" radius={[3, 3, 0, 0]} opacity={0.9} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
