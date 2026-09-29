"use client"

import { useState } from "react"
import { Cpu, Atom, Activity, CheckCircle2, BrainCircuit, Database } from "lucide-react"
import { DOCKING_TARGETS } from "@/data/assay-tables"
import { DockingViewer3D } from "@/lib/mol3d"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { ConfidenceBar } from "@/components/ui/ConfidenceBar"
import { Interpretation } from "@/components/ui/Interpretation"

export default function DockingPanel() {
  const [selectedTarget, setSelectedTarget] = useState(DOCKING_TARGETS[0])
  return (
    <div className="space-y-5">
      <SectionHeader icon={Cpu} title="AutoDock Vina — Molecular Docking" color="#34d399" badge="6 Receptors · RCSB PDB · PubChem 3D" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Best ΔG" value="−8.4" unit="kcal/mol" sub="YAP1 · 5YLH" color="#34d399" icon={Atom} />
        <MetricCard label="Best Kᵢ" value="0.68" unit="µM" sub="YAP1 receptor" color="#00d4aa" icon={Activity} />
        <MetricCard label="Top AI Confidence" value="94%" unit="" sub="YAP1" color="#4fc3f7" icon={BrainCircuit} />
        <MetricCard label="Targets Docked" value="6" unit="" sub="PDB receptors" color="#a78bfa" icon={Database} />
      </div>

      {/* Target selector */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "#dde5ef" }}>
          <p className="text-xs font-mono uppercase tracking-wider mb-2.5" style={{ color: "#546e8a" }}>
            Select receptor · animated 3D structure viewer
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DOCKING_TARGETS.map(t => (
              <button key={t.receptor} onClick={() => setSelectedTarget(t)}
                className="text-xs font-mono px-2.5 py-1 rounded-full border transition-colors"
                style={{
                  borderColor: selectedTarget.receptor === t.receptor ? t.color : "#dde5ef",
                  color: selectedTarget.receptor === t.receptor ? t.color : "#546e8a",
                  background: selectedTarget.receptor === t.receptor ? t.color + "15" : "transparent",
                }}>
                {t.receptor} · {t.score} kcal/mol
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          <DockingViewer3D
            pdbId={selectedTarget.pdbId}
            cid={5280343}
            proteinName={selectedTarget.receptor}
            compoundName="Quercetin"
            proteinColor={selectedTarget.color}
            compoundColor="#00d4aa"
            height={400}
            deltaG={selectedTarget.score}
            hBonds={selectedTarget.hBonds}
          />
        </div>
      </div>

      {/* Docking table */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Docking Results — All Targets</p>
        <div className="space-y-2">
          {DOCKING_TARGETS.map((t) => (
            <button key={t.receptor} onClick={() => setSelectedTarget(t)} className="w-full text-left">
              <div className="rounded-lg p-3 border transition-all" style={{
                background: selectedTarget.receptor === t.receptor ? t.color + "08" : "#f0f5ff",
                borderColor: selectedTarget.receptor === t.receptor ? t.color + "60" : "#dde5ef",
              }}>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <div>
                    <span className="text-sm font-semibold" style={{ color: "#0d1f3c" }}>{t.receptor}</span>
                    <span className="ml-1.5 text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ background: t.color + "20", color: t.color }}>PDB {t.pdbId}</span>
                    <span className="ml-2 text-xs font-mono" style={{ color: "#546e8a" }}>RMSD {t.rmsd}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold font-mono" style={{ color: "#34d399" }}>{t.score} kcal/mol</span>
                    <span className="text-xs font-mono" style={{ color: "#546e8a" }}>Kᵢ={t.ki}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "#546e8a" }}>AI Confidence</span>
                  <ConfidenceBar value={t.confidence} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <Interpretation color="#34d399" title="AutoDock Vina Interpretation"
        text="All 6 primary targets show binding energies ≤ −6.8 kcal/mol, confirming multi-target pharmacology. YAP1 (−8.4 kcal/mol, Kᵢ 0.68 µM, 94% confidence) is the primary target, consistent with strongest anti-proliferative mechanistic evidence. Nrf2 (−8.1 kcal/mol) confirms antioxidant pathway engagement. BAX and BCL-2 binding (−7.9 / −7.6 kcal/mol) corroborates the apoptosis data. All RMSD values <2.0 Å — docking poses within valid structural range."
        refs={["PDB 5YLH · 4IS9 · 4S0O · 2YIU · 2XYG", "AutoDock Vina 1.2 protocol"]} />
    </div>
  )
}
