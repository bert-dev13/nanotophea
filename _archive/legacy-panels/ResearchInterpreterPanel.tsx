"use client"

import { useState } from "react"
import { BookOpen, BrainCircuit, ChevronUp, ChevronDown, ChevronRight } from "lucide-react"
import { INTERPRETER_SECTIONS } from "@/data/interpreter"
import { SectionHeader } from "@/components/ui/SectionHeader"

export default function ResearchInterpreterPanel() {
  const [open, setOpen] = useState<string>("what")

  return (
    <div className="space-y-4">
      <SectionHeader icon={BookOpen} title="Research Interpreter" color="#fbbf24"
        badge="Plain-Language Results Explanation" />

      <div className="rounded-xl p-3 border" style={{ background: "#f0f5ff", borderColor: "#fbbf2440" }}>
        <div className="flex items-start gap-2">
          <BrainCircuit size={14} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>
            This panel translates all in silico results into clear scientific language for researchers,
            students, and reviewers. Select a section below to read a structured explanation of each assay,
            its metrics, and what the data means for the anti-cancer, antioxidant, and hepatoprotective
            properties of Sampasampalukan Quercetin Nanocarriers against HCC.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {INTERPRETER_SECTIONS.map((sec) => {
          const Icon = sec.icon
          const isOpen = open === sec.id
          return (
            <div key={sec.id} className="rounded-xl border overflow-hidden"
              style={{ borderColor: isOpen ? sec.color + "40" : "#dde5ef" }}>
              <button
                onClick={() => setOpen(isOpen ? "" : sec.id)}
                className="w-full flex items-center gap-3 p-4 text-left transition-colors"
                style={{ background: isOpen ? sec.color + "10" : "#ffffff" }}>
                <div className="p-1.5 rounded-lg" style={{ background: sec.color + "20" }}>
                  <Icon size={14} style={{ color: sec.color }} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: isOpen ? sec.color : "#0d1f3c" }}>
                    {sec.title}
                  </div>
                  <div className="text-xs" style={{ color: "#546e8a" }}>{sec.subtitle}</div>
                </div>
                {isOpen ? <ChevronUp size={14} style={{ color: sec.color }} /> : <ChevronDown size={14} style={{ color: "#546e8a" }} />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-4" style={{ background: "#ffffff" }}>
                  <div style={{ borderTop: "1px solid #1a3050", paddingTop: "12px" }} />
                  {sec.content.map((block) => (
                    <div key={block.heading}>
                      <h4 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: sec.color }}>
                        <ChevronRight size={11} />
                        {block.heading}
                      </h4>
                      <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>
                        {block.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick reference */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
          Quick Metric Reference Guide
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { term: "IC₅₀", def: "Concentration killing 50% of cells. Lower = more potent." },
            { term: "Cell Viability (%)", def: "% of living cells relative to untreated control (= 100%)." },
            { term: "% Inhibition", def: "100 − Viability. % of cells growth-inhibited or killed." },
            { term: "A₅₇₀ (Absorbance)", def: "MTT formazan optical density. Higher absorbance = more living cells." },
            { term: "ΔG (kcal/mol)", def: "AutoDock Vina binding energy. More negative = stronger binding." },
            { term: "Kᵢ", def: "Inhibition constant. Concentration for 50% target inhibition in solution." },
            { term: "AI Confidence", def: "Docking reliability score integrating pose stability + pharmacophore match." },
            { term: "Selectivity Index", def: "IC₅₀(normal) ÷ IC₅₀(cancer). >2 = selective; <1 = toxic to normal cells." },
            { term: "ROS Fold-Change", def: "Increase in reactive oxygen species vs. untreated cells. >2× triggers apoptosis." },
            { term: "BAX/BCL-2 Ratio", def: "Ratio > 1.0 = apoptosis-prone. QCN achieves 11.57× = strong apoptotic signal." },
            { term: "p-YAP Ser127", def: "Phosphorylated YAP — cytoplasmic, inactive form. Higher = Hippo pathway active." },
            { term: "RMSD (Å)", def: "Root Mean Square Deviation of docked pose from crystal structure. <2 Å = valid." },
          ].map((item) => (
            <div key={item.term} className="flex gap-2 p-2 rounded-lg" style={{ background: "#f0f5ff" }}>
              <span className="text-xs font-bold font-mono shrink-0 w-28" style={{ color: "#00d4aa" }}>{item.term}</span>
              <span className="text-xs" style={{ color: "#1e4878" }}>{item.def}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
