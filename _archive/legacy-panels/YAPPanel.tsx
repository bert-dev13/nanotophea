"use client"

import { Dna, TrendingDown, Activity, Zap, Shield, ChevronRight } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { YAP_TABLE } from "@/data/assay-tables"
import { DockingViewer3D } from "@/lib/mol3d"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"

export default function YAPPanel() {
  const YAP_BIOMARKERS = [
    { label: "YAP1 SUPPRESSION", value: "69%",    sub: "nuclear exclusion",  color: "#4fc3f7", Icon: TrendingDown },
    { label: "P-YAP SER127",     value: "+114%",  sub: "cytoplasmic trap",   color: "#00d4aa", Icon: Activity     },
    { label: "LATS1 ACTIVATION", value: "+82%",   sub: "tumor suppressor",   color: "#34d399", Icon: Zap          },
    { label: "TEAD4 SILENCING",  value: "−56%",   sub: "target gene",        color: "#f472b6", Icon: Shield       },
  ]
  return (
    <div className="space-y-5">
      <SectionHeader icon={Dna} title="Hippo–YAP Signaling Pathway" color="#4fc3f7" badge="Western Blot · qRT-PCR" />

      {/* Biomarker cards — exact match to reference image */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {YAP_BIOMARKERS.map(c => (
          <div key={c.label} className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <c.Icon size={11} style={{ color: c.color }} />
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#546e8a" }}>{c.label}</span>
            </div>
            <div className="text-[28px] font-bold leading-none mb-1" style={{ color: c.color }}>{c.value}</div>
            <div className="text-[11px]" style={{ color: "#546e8a" }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
          <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Protein Expression Fold-Change</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={YAP_TABLE} layout="vertical" margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" horizontal={false} />
              <XAxis type="number" stroke="#546e8a" tick={{ fontSize: 10 }} domain={[0, 2.5]} />
              <YAxis type="category" dataKey="protein" stroke="#546e8a" tick={{ fontSize: 10 }} width={70} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(2)}×`, "Fold Change"]} />
              <ReferenceLine x={1} stroke="#546e8a" strokeDasharray="4 4" />
              <Bar dataKey="treated" fill="#4fc3f7" radius={[0, 2, 2, 0]}
                label={{ position: "right", fill: "#546e8a", fontSize: 10, formatter: (v: number) => v.toFixed(2) }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
          <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>Pathway Cascade</p>
          <div className="space-y-2">
            {[
              { node: "QCN activates LATS1/2 kinase ↑ (+82%)", color: "#00d4aa" },
              { node: "LATS1 + MOB1 complex ↑ (+67%)", color: "#00d4aa" },
              { node: "YAP1 phosphorylated at Ser127 (+114%)", color: "#4fc3f7" },
              { node: "p-YAP sequestered by 14-3-3 (cytoplasm)", color: "#4fc3f7" },
              { node: "Nuclear YAP1 ↓ (−69%) → proliferation halted", color: "#fb923c" },
              { node: "TEAD4 binding lost → gene transcription ↓", color: "#fb923c" },
              { node: "CYR61 ↓ (−61%) · CTGF ↓ (−58%)", color: "#f472b6" },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight size={12} style={{ color: s.color, flexShrink: 0, marginTop: 2 }} />
                <span className="text-sm" style={{ color: "#1a3558" }}>{s.node}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
          3D Structure · YAP1 (PDB: 5YLH) vs. Quercetin (PubChem CID 5280343)
        </p>
        <DockingViewer3D
          pdbId="5YLH"
          cid={5280343}
          proteinName="YAP1"
          compoundName="Quercetin"
          proteinColor="#4fc3f7"
          compoundColor="#00d4aa"
          height={380}
          deltaG={-8.4}
          hBonds={4}
        />
      </div>
      <Interpretation color="#4fc3f7" title="Hippo–YAP Interpretation"
        text="QCN reactivates the Hippo tumor suppressor pathway. LATS1 upregulation phosphorylates YAP1 at Ser127, trapping it in the cytoplasm (−69% nuclear YAP). This silences TEAD4-driven oncogenes CYR61 and CTGF. AutoDock Vina confirms direct quercetin binding at the YAP1–TEAD4 interface (ΔG = −8.4 kcal/mol; AI confidence 94%). This pathway is independent of p53 status — effective across p53-mutant and p53-null HCC lines."
        refs={["PMID: 36124881", "PDB: 5YLH — YAP1-TEAD4"]} />
    </div>
  )
}
