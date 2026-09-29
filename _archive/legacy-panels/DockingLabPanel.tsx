"use client"

import React, { useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ReferenceLine,
} from "recharts"
import {
  Cpu, Atom, Activity, ChevronRight, Database, BrainCircuit,
  CheckCircle2, Info, Zap, TrendingDown, ArrowUpRight, ArrowDownRight,
  ExternalLink, FlaskConical, Dna, Beaker,
} from "lucide-react"
import { PHYTOCHEMICALS, DOCKING_MATRIX } from "@/data/compounds"
import { DockingViewer3D } from "@/lib/mol3d"

// ── Protein target definitions ────────────────────────────────────────────────

interface ProteinInfo {
  id: string
  name: string
  gene: string
  pdb: string
  pathway: string
  role: string
  roleColor: string
  function: string
  clinicalNote: string
  color: string
}

const PROTEINS: ProteinInfo[] = [
  { id: "YAP1",  name: "YAP1",       gene: "YAP1",    pdb: "5YLH", pathway: "Hippo–YAP",          role: "Oncogene",          roleColor: "#fb923c", function: "Transcriptional co-activator driving HCC proliferation via TEAD4", clinicalNote: "Not targeted by sorafenib — novel therapeutic angle", color: "#4fc3f7" },
  { id: "BAX",   name: "BAX",        gene: "BAX",     pdb: "4S0O", pathway: "Intrinsic Apoptosis", role: "Pro-apoptotic",     roleColor: "#00d4aa", function: "Pore-forming protein that triggers cytochrome c release from mitochondria", clinicalNote: "BAX upregulation is the primary apoptosis driver in HCC", color: "#fb923c" },
  { id: "BCL2",  name: "BCL-2",      gene: "BCL2",    pdb: "2YIU", pathway: "Intrinsic Apoptosis", role: "Anti-apoptotic",    roleColor: "#fb923c", function: "Anti-apoptotic guardian; inhibition allows BAX to activate", clinicalNote: "BCL-2 overexpression is a common HCC drug resistance mechanism", color: "#f472b6" },
  { id: "CASP3", name: "Caspase-3",  gene: "CASP3",   pdb: "2XYG", pathway: "Apoptosis Execution", role: "Pro-apoptotic",     roleColor: "#00d4aa", function: "Executioner caspase; cleaves PARP, lamins, and cytoskeletal proteins", clinicalNote: "Definitive marker of apoptosis — CASP3 activation = cell death confirmed", color: "#00d4aa" },
  { id: "NRF2",  name: "Nrf2",       gene: "NFE2L2",  pdb: "4IS9", pathway: "Oxidative Stress",    role: "Tumor Suppressor",  roleColor: "#34d399", function: "Master antioxidant TF; activates HO-1, SOD, GPx, catalase", clinicalNote: "Protects normal hepatocytes — Nrf2 activation = hepatoprotection", color: "#a78bfa" },
  { id: "LATS1", name: "LATS1",      gene: "LATS1",   pdb: "5YLH", pathway: "Hippo–YAP",          role: "Tumor Suppressor",  roleColor: "#34d399", function: "Kinase that phosphorylates and inactivates YAP1 at Ser127", clinicalNote: "LATS1 upregulation = Hippo pathway reactivation", color: "#34d399" },
  { id: "TP53",  name: "p53",        gene: "TP53",    pdb: "1TUP", pathway: "Cell Cycle",          role: "Tumor Suppressor",  roleColor: "#34d399", function: "Guardian of genome; transactivates BAX, PUMA, p21", clinicalNote: "Mutated in ~25-30% of HCCs — compounds must work p53-independently", color: "#fbbf24" },
  { id: "EGFR",  name: "EGFR",       gene: "EGFR",    pdb: "1IVO", pathway: "PI3K/Akt/mTOR",      role: "Oncogene",          roleColor: "#fb923c", function: "RTK activating PI3K/Akt and RAS/MAPK pro-survival cascades", clinicalNote: "EGFR overexpressed in ~40-70% of HCCs", color: "#e879f9" },
  { id: "CASP9", name: "Caspase-9",  gene: "CASP9",   pdb: "2AR9", pathway: "Intrinsic Apoptosis", role: "Pro-apoptotic",     roleColor: "#00d4aa", function: "Initiator caspase; activated by apoptosome; cleaves and activates CASP3", clinicalNote: "CASP9 activation proves mitochondrial pathway is engaged", color: "#06b6d4" },
  { id: "MMP9",  name: "MMP-9",      gene: "MMP9",    pdb: "1GKC", pathway: "Invasion/Metastasis", role: "Pro-invasive",      roleColor: "#fb923c", function: "Zinc metalloprotease; degrades ECM to enable HCC invasion", clinicalNote: "MMP-9 inhibition prevents metastatic spread of HCC", color: "#f97316" },
  { id: "MTOR",  name: "mTOR",       gene: "MTOR",    pdb: "4JSV", pathway: "PI3K/Akt/mTOR",      role: "Oncogene",          roleColor: "#fb923c", function: "Serine/threonine kinase; promotes cell growth and autophagy resistance", clinicalNote: "mTOR hyperactivated in HCC — targeting synergizes with sorafenib", color: "#84cc16" },
  { id: "CCND1", name: "Cyclin D1",  gene: "CCND1",   pdb: "2W9Z", pathway: "Cell Cycle",          role: "Oncogene",          roleColor: "#fb923c", function: "Drives G1→S transition; frequently amplified in HCC", clinicalNote: "Cyclin D1 amplification found in ~10-15% of HCCs", color: "#ec4899" },
]

const TOOLTIP_STYLE = {
  backgroundColor: "#1a2744", border: "1px solid #2d4470",
  borderRadius: 8, color: "#e8f4ff", fontSize: 12, fontFamily: "monospace",
}

function ConfidenceBar({ value, color = "#00d4aa" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "#dde5ef" }}>
        <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-10 text-right" style={{ color }}>{value}%</span>
    </div>
  )
}

function MetricCard({ label, value, unit, sub, color = "#00d4aa", icon: Icon }: {
  label: string; value: string | number; unit?: string; sub?: string;
  color?: string; icon?: React.ElementType
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <div className="flex items-center gap-1.5 mb-0.5">
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

// ── (BindingPocketViz removed — replaced by DockingViewer3D) ─────────────────

function _unused_BindingPocketViz({
  protein, compound, docking,
}: {
  protein: ProteinInfo
  compound: any
  docking: any
}) {
  const isStrong = Math.abs(docking.dg) >= 8
  const isModerate = Math.abs(docking.dg) >= 7

  const interactions: { type: string; residue: string; x1: number; y1: number; x2: number; y2: number; color: string }[] = [
    ...Array.from({ length: Math.min(docking.hbonds, 3) }, (_, i) => ({
      type: "H-bond",
      residue: `Res${i + 1}`,
      x1: 200, y1: 150,
      x2: [120, 260, 160][i] ?? 180,
      y2: [90, 100, 200][i] ?? 120,
      color: "#4fc3f7",
    })),
    ...Array.from({ length: Math.min(docking.hydrophobic, 3) }, (_, i) => ({
      type: "Hydrophobic",
      residue: `Hph${i + 1}`,
      x1: 200, y1: 150,
      x2: [240, 160, 280][i] ?? 200,
      y2: [180, 200, 140][i] ?? 170,
      color: "#fb923c",
    })),
  ]

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#f4f7fc", borderColor: "#dde5ef" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
          Binding Pocket Visualization — {protein.name} · {compound.name}
        </p>
        <span className="text-[11px] font-mono" style={{ color: "#546e8a" }}>AutoDock Vina 1.2</span>
      </div>

      <svg viewBox="0 0 400 300" className="w-full" style={{ maxHeight: 260 }}>
        {/* Background */}
        <rect width="400" height="300" fill="#f4f7fc" />

        {/* Protein pocket outline */}
        <ellipse cx="200" cy="150" rx="160" ry="120" fill="#ffffff" stroke="#dde5ef" strokeWidth="1.5" strokeDasharray="4 3" />
        <ellipse cx="200" cy="150" rx="120" ry="88" fill="#0d1e35" stroke="#dde5ef" strokeWidth="1" />

        {/* Protein residue labels around pocket */}
        {[
          { label: docking.topResidue, x: 90, y: 90, color: "#4fc3f7" },
          { label: "Trp-π", x: 310, y: 95, color: "#a78bfa" },
          { label: "Leu-hph", x: 320, y: 185, color: "#fb923c" },
          { label: "Arg+", x: 115, y: 195, color: "#4fc3f7" },
          { label: "Val-hph", x: 180, y: 55, color: "#fb923c" },
          { label: "Gly-bb", x: 235, y: 245, color: "#546e8a" },
        ].map((r, i) => (
          <g key={i}>
            <circle cx={r.x} cy={r.y} r="16" fill={r.color + "20"} stroke={r.color + "60"} strokeWidth="1" />
            <text x={r.x} y={r.y + 1} textAnchor="middle" dominantBaseline="middle"
              fill={r.color} fontSize="7.5" fontFamily="monospace">{r.label}</text>
          </g>
        ))}

        {/* Interaction lines */}
        {docking.hbonds > 0 && (
          <>
            <line x1="200" y1="150" x2="90" y2="90" stroke="#4fc3f7" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.8" />
            <line x1="200" y1="150" x2="115" y2="195" stroke="#4fc3f7" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.8" />
          </>
        )}
        {docking.hbonds > 2 && (
          <line x1="200" y1="150" x2="180" y2="55" stroke="#4fc3f7" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.7" />
        )}
        <line x1="200" y1="150" x2="310" y2="95" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.8" />
        {docking.hydrophobic > 0 && (
          <line x1="200" y1="150" x2="320" y2="185" stroke="#fb923c" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />
        )}
        {docking.hydrophobic > 1 && (
          <line x1="200" y1="150" x2="235" y2="245" stroke="#546e8a" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
        )}

        {/* Ligand at center */}
        <g transform="translate(200,150)">
          {/* Core ring */}
          <polygon points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15"
            fill={compound.color + "30"} stroke={compound.color} strokeWidth="1.5" />
          {/* Substituents */}
          <circle cx="0" cy="-30" r="8" fill={compound.color + "40"} stroke={compound.color} strokeWidth="1" />
          <circle cx="26" cy="-15" r="6" fill={compound.color + "30"} stroke={compound.color + "80"} strokeWidth="1" />
          <circle cx="-26" cy="15" r="6" fill="#4fc3f7" opacity="0.5" stroke="#4fc3f7" strokeWidth="1" />
          <circle cx="0" cy="30" r="5" fill="#4fc3f7" opacity="0.5" stroke="#4fc3f7" strokeWidth="1" />
          {/* Center label */}
          <text x="0" y="1" textAnchor="middle" dominantBaseline="middle"
            fill={compound.color} fontSize="7" fontFamily="monospace" fontWeight="bold">
            {compound.name.slice(0, 4)}
          </text>
        </g>

        {/* ΔG label */}
        <rect x="8" y="8" width="110" height="34" rx="4" fill="#0a162880" stroke="#dde5ef" strokeWidth="1" />
        <text x="16" y="22" fill="#546e8a" fontSize="8" fontFamily="monospace">ΔG binding</text>
        <text x="16" y="36" fill={isStrong ? "#00d4aa" : isModerate ? "#4fc3f7" : "#fb923c"}
          fontSize="13" fontFamily="monospace" fontWeight="bold">{docking.dg} kcal/mol</text>

        {/* Confidence label */}
        <rect x="282" y="8" width="110" height="34" rx="4" fill="#0a162880" stroke="#dde5ef" strokeWidth="1" />
        <text x="290" y="22" fill="#546e8a" fontSize="8" fontFamily="monospace">AI Confidence</text>
        <text x="290" y="36" fill={docking.confidence >= 90 ? "#00d4aa" : docking.confidence >= 80 ? "#4fc3f7" : "#fb923c"}
          fontSize="13" fontFamily="monospace" fontWeight="bold">{docking.confidence}%</text>

        {/* Legend */}
        <g transform="translate(10,265)">
          <rect x="0" y="0" width="6" height="6" fill="none" stroke="#4fc3f7" strokeWidth="1.5" strokeDasharray="3 1.5" />
          <text x="10" y="6" fill="#546e8a" fontSize="7" fontFamily="monospace">H-bond</text>
          <rect x="60" y="0" width="6" height="6" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="2 2" />
          <text x="70" y="6" fill="#546e8a" fontSize="7" fontFamily="monospace">π-stack</text>
          <rect x="120" y="0" width="6" height="6" fill="none" stroke="#fb923c" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="130" y="6" fill="#546e8a" fontSize="7" fontFamily="monospace">Hydrophobic</text>
        </g>
      </svg>

      <div className="px-3 py-2 border-t" style={{ borderColor: "#dde5ef" }}>
        <p className="text-xs leading-relaxed" style={{ color: "#1e4878" }}>
          <span style={{ color: compound.color }} className="font-semibold">{compound.name}</span>
          {" "}docks into the {protein.name} ({protein.pdb}) binding pocket at ΔG = {docking.dg} kcal/mol.
          Key anchor: {docking.topResidue}. Pose: {docking.pose}
        </p>
      </div>
    </div>
  )
}

// ── 3D Structure Viewer ───────────────────────────────────────────────────────

function Mol3DViewerInline({ cid, name }: { cid: number; name: string }) {
  const [mode, setMode] = useState<"3d" | "2d">("3d")
  const [imgError, setImgError] = useState(false)

  const url3d = `https://3dmol.csb.pitt.edu/viewer.html?cid=${cid}&select=all&style=stick:colorscheme~Jmol;sphere:colorscheme~Jmol,scale~0.28&backgroundColor=0x050e1a`
  const url2d = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/CID/${cid}/PNG?record_type=2d&image_size=300x300`

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dde5ef", background: "#f4f7fc" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
          {name} — {mode === "3d" ? "3D Conformer" : "2D Structure"} · CID {cid}
        </p>
        <div className="flex gap-1">
          {(["3d", "2d"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className="text-[11px] font-mono px-2 py-0.5 rounded border transition-colors uppercase"
              style={{ borderColor: mode === m ? "#00d4aa" : "#dde5ef", color: mode === m ? "#00d4aa" : "#546e8a" }}>
              {m}
            </button>
          ))}
          <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=3D-Conformer`}
            target="_blank" rel="noopener noreferrer"
            className="text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-0.5"
            style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
            PubChem <ExternalLink size={8} />
          </a>
        </div>
      </div>

      <div style={{ height: 240, background: "#f4f7fc" }}>
        {mode === "3d" ? (
          <iframe src={url3d} style={{ width: "100%", height: "100%", border: "none" }} title={`${name} 3D`} />
        ) : (
          <div className="flex items-center justify-center h-full">
            {!imgError ? (
              <img src={url2d} alt={`${name} 2D`}
                style={{ maxHeight: 220, maxWidth: "90%", filter: "invert(0.85) hue-rotate(180deg) saturate(1.4)" }}
                onError={() => setImgError(true)} />
            ) : (
              <div className="text-center">
                <Atom size={24} style={{ color: "#546e8a", margin: "0 auto 8px" }} />
                <p className="text-xs" style={{ color: "#546e8a" }}>Structure unavailable offline</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Energy Decomposition Chart ────────────────────────────────────────────────

function EnergyChart({ docking }: { docking: any }) {
  const data = [
    { name: "Van der Waals", value: Math.abs(docking.vdw), raw: docking.vdw, color: "#4fc3f7" },
    { name: "H-Bond", value: Math.abs(docking.hbond_e), raw: docking.hbond_e, color: "#00d4aa" },
    { name: "Electrostatic", value: Math.abs(docking.elec), raw: docking.elec, color: "#a78bfa" },
    { name: "Solvation", value: docking.solv, raw: docking.solv, color: "#fb923c" },
  ]
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
        Energy Decomposition (kcal/mol)
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 5, right: 8, left: -15, bottom: 5 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" horizontal={false} />
          <XAxis type="number" stroke="#546e8a" tick={{ fontSize: 9 }} />
          <YAxis type="category" dataKey="name" stroke="#546e8a" tick={{ fontSize: 8 }} width={80} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            formatter={(v: number, name: string, props: any) => [
              `${props.payload.raw > 0 ? "+" : ""}${props.payload.raw.toFixed(2)} kcal/mol`, name
            ]} />
          <Bar dataKey="value" radius={[0, 3, 3, 0]}>
            {data.map((d, i) => (
              <rect key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-between text-xs font-mono">
        <span style={{ color: "#546e8a" }}>Total ΔG (favourable − solvation penalty)</span>
        <span style={{ color: "#00d4aa" }}>{docking.dg.toFixed(1)} kcal/mol</span>
      </div>
    </div>
  )
}

// ── All-compound comparison for a protein ────────────────────────────────────

function CompoundComparison({ proteinId, selectedCompoundId }: { proteinId: string; selectedCompoundId: string }) {
  const data = PHYTOCHEMICALS.map((c) => ({
    name: c.name.length > 10 ? c.name.slice(0, 8) + "…" : c.name,
    fullName: c.name,
    dg: Math.abs(DOCKING_MATRIX[c.id][proteinId]?.dg ?? 0),
    conf: DOCKING_MATRIX[c.id][proteinId]?.confidence ?? 0,
    isSelected: c.id === selectedCompoundId,
    color: c.color,
  })).sort((a, b) => b.dg - a.dg)

  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
        All Phytochemicals vs. {proteinId} — Binding Energy Ranking
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 8, left: -10, bottom: 45 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
          <XAxis dataKey="name" stroke="#546e8a" tick={{ fontSize: 8 }} angle={-35} textAnchor="end" />
          <YAxis stroke="#546e8a" tick={{ fontSize: 8 }} domain={[4, 11]}
            label={{ value: "|ΔG|", angle: -90, position: "insideLeft", fill: "#546e8a", fontSize: 8 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE}
            formatter={(v: number, n: string, p: any) => [`−${v.toFixed(1)} kcal/mol`, p.payload.fullName]} />
          <Bar dataKey="dg" radius={[3, 3, 0, 0]}
            label={{ position: "top", fontSize: 7, fill: "#546e8a", formatter: (v: number) => v.toFixed(1) }}>
            {data.map((d, i) => (
              <rect key={i} fill={d.isSelected ? d.color : d.color + "60"} stroke={d.isSelected ? d.color : "none"} strokeWidth={d.isSelected ? 1.5 : 0} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Docking Lab Panel ───────────────────────────────────────────────────

export default function DockingLabPanel() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [targetType, setTargetType] = useState<"protein">("protein")
  const [selectedProteinId, setSelectedProteinId] = useState<string>("YAP1")
  const [selectedCompoundId, setSelectedCompoundId] = useState<string>("quercetin")

  const protein = PROTEINS.find((p) => p.id === selectedProteinId)!
  const compound = PHYTOCHEMICALS.find((c) => c.id === selectedCompoundId)!
  const docking = DOCKING_MATRIX[selectedCompoundId]?.[selectedProteinId]

  const kiStr = docking ? (docking.ki < 1 ? `${(docking.ki * 1000).toFixed(1)} nM` : `${docking.ki.toFixed(2)} µM`) : "—"
  const strength = docking ? (Math.abs(docking.dg) >= 8.5 ? "Very Strong" : Math.abs(docking.dg) >= 7.5 ? "Strong" : Math.abs(docking.dg) >= 6.5 ? "Moderate" : "Weak") : "—"
  const strengthColor = docking ? (Math.abs(docking.dg) >= 8.5 ? "#00d4aa" : Math.abs(docking.dg) >= 7.5 ? "#4fc3f7" : Math.abs(docking.dg) >= 6.5 ? "#fbbf24" : "#fb923c") : "#546e8a"

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg" style={{ background: "#34d39920" }}>
          <Cpu size={18} style={{ color: "#34d399" }} />
        </div>
        <div>
          <h2 className="text-base font-bold" style={{ color: "#0d1f3c" }}>Molecular Docking Lab</h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#34d39920", color: "#34d399" }}>
            AutoDock Vina 1.2 · 14 Phytochemicals × 12 Proteins · RCSB PDB
          </span>
        </div>
      </div>

      {/* Step navigator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1 as const, label: "Select Target", icon: Dna },
          { n: 2 as const, label: "Select Phytochemical", icon: FlaskConical },
          { n: 3 as const, label: "View Docking Results", icon: Cpu },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <button onClick={() => setStep(s.n)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                background: step === s.n ? "#34d39920" : step > s.n ? "#00d4aa10" : "transparent",
                borderColor: step === s.n ? "#34d399" : step > s.n ? "#00d4aa60" : "#dde5ef",
                color: step === s.n ? "#34d399" : step > s.n ? "#00d4aa" : "#546e8a",
              }}>
              <s.icon size={11} />
              {s.label}
              {step > s.n && <CheckCircle2 size={10} style={{ color: "#00d4aa" }} />}
            </button>
            {i < 2 && <ChevronRight size={12} style={{ color: "#dde5ef" }} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select target */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "#546e8a" }}>
            Choose a protein target from the liver cancer pathway panel:
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PROTEINS.map((p) => (
              <button key={p.id} onClick={() => { setSelectedProteinId(p.id); setStep(2) }}
                className="text-left rounded-xl p-3 border transition-all"
                style={{
                  background: selectedProteinId === p.id ? p.color + "18" : "#ffffff",
                  borderColor: selectedProteinId === p.id ? p.color : "#dde5ef",
                }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: p.color }}>{p.name}</span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded capitalize"
                      style={{ background: p.roleColor + "20", color: p.roleColor }}>
                      {p.role}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono" style={{ color: "#546e8a" }}>PDB: {p.pdb}</span>
                </div>
                <p className="text-xs" style={{ color: "#546e8a" }}>{p.pathway}</p>
                <p className="text-xs mt-0.5" style={{ color: "#1a3558" }}>{p.function}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select compound */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="rounded-xl p-3 border" style={{ background: "#ffffff", borderColor: protein.color + "40" }}>
            <p className="text-xs" style={{ color: "#546e8a" }}>
              Selected target: <span style={{ color: protein.color }} className="font-semibold">{protein.name}</span>
              {" "}· {protein.pathway} · PDB: {protein.pdb}
            </p>
          </div>
          <p className="text-xs" style={{ color: "#546e8a" }}>
            Choose a phytochemical from Sampasampalukan to dock against {protein.name}:
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PHYTOCHEMICALS.map((c) => {
              const d = DOCKING_MATRIX[c.id][selectedProteinId]
              const strong = Math.abs(d.dg) >= 8
              return (
                <button key={c.id} onClick={() => { setSelectedCompoundId(c.id); setStep(3) }}
                  className="text-left rounded-xl p-3 border transition-all"
                  style={{
                    background: selectedCompoundId === c.id ? c.color + "18" : "#ffffff",
                    borderColor: selectedCompoundId === c.id ? c.color : "#dde5ef",
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color: c.color }}>{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold"
                        style={{ color: strong ? "#00d4aa" : "#fbbf24" }}>
                        {d.dg} kcal/mol
                      </span>
                      <span className="text-[11px] font-mono" style={{ color: "#546e8a" }}>
                        {d.confidence}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "#546e8a" }}>{c.class} · {c.formula}</span>
                    <span className="text-[11px] font-mono"
                      style={{ color: c.potency === "high" ? "#fb923c" : "#fbbf24" }}>
                      {c.potency} potency
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "#dde5ef" }}>
                    <div className="h-full rounded-full" style={{
                      width: `${((Math.abs(d.dg) - 4) / 6) * 100}%`,
                      background: strong ? "#00d4aa" : "#fbbf24"
                    }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && docking && (
        <div className="space-y-4">
          {/* Pair header */}
          <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: protein.color + "20" }}>
                  <Dna size={14} style={{ color: protein.color }} />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: protein.color }}>{protein.name}</div>
                  <div className="text-[11px] font-mono" style={{ color: "#546e8a" }}>PDB: {protein.pdb} · {protein.pathway}</div>
                </div>
              </div>

              <ChevronRight size={20} style={{ color: "#34d399" }} />

              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: compound.color + "20" }}>
                  <FlaskConical size={14} style={{ color: compound.color }} />
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: compound.color }}>{compound.name}</div>
                  <div className="text-[11px] font-mono" style={{ color: "#546e8a" }}>{compound.formula} · CID {compound.cid}</div>
                </div>
              </div>

              <div className="ml-auto text-right">
                <div className="text-2xl font-bold font-mono" style={{ color: strengthColor }}>{docking.dg}</div>
                <div className="text-[11px] font-mono" style={{ color: "#546e8a" }}>kcal/mol · {strength} binding</div>
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <MetricCard label="Binding ΔG" value={docking.dg} unit="kcal/mol" color={strengthColor} icon={Atom} />
            <MetricCard label="Kᵢ" value={kiStr} sub="inhibition constant" color="#4fc3f7" icon={Activity} />
            <MetricCard label="RMSD" value={`${docking.rmsd} Å`} sub={docking.rmsd < 2 ? "✓ valid pose" : "marginal"} color={docking.rmsd < 2 ? "#00d4aa" : "#fb923c"} icon={TrendingDown} />
            <MetricCard label="AI Confidence" value={`${docking.confidence}%`} sub="pose stability" color={docking.confidence >= 90 ? "#00d4aa" : "#fbbf24"} icon={BrainCircuit} />
            <MetricCard label="H-Bonds" value={docking.hbonds} sub={`${docking.hydrophobic} hydrophobic`} color="#4fc3f7" icon={Zap} />
          </div>

          {/* Main visual area — real 3D from RCSB PDB + PubChem */}
          <DockingViewer3D
            pdbId={protein.pdb}
            cid={compound.cid}
            proteinName={protein.name}
            compoundName={compound.name}
            proteinColor={protein.color}
            compoundColor={compound.color}
            height={420}
          />

          {/* Energy decomposition + AI confidence */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EnergyChart docking={docking} />

            <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
                Interaction Profile
              </p>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1" style={{ color: "#546e8a" }}>
                    <span>H-Bonds ({docking.hbonds})</span>
                    <span style={{ color: "#4fc3f7" }}>{(docking.hbonds / 8 * 100).toFixed(0)}%</span>
                  </div>
                  <ConfidenceBar value={Math.round(docking.hbonds / 8 * 100)} color="#4fc3f7" />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1" style={{ color: "#546e8a" }}>
                    <span>Hydrophobic ({docking.hydrophobic})</span>
                    <span style={{ color: "#fb923c" }}>{(docking.hydrophobic / 6 * 100).toFixed(0)}%</span>
                  </div>
                  <ConfidenceBar value={Math.round(docking.hydrophobic / 6 * 100)} color="#fb923c" />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1" style={{ color: "#546e8a" }}>
                    <span>AI Confidence</span>
                  </div>
                  <ConfidenceBar value={docking.confidence}
                    color={docking.confidence >= 90 ? "#00d4aa" : docking.confidence >= 80 ? "#4fc3f7" : "#fb923c"} />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1" style={{ color: "#546e8a" }}>
                    <span>Binding Strength</span>
                  </div>
                  <ConfidenceBar value={Math.round(((Math.abs(docking.dg) - 4) / 6) * 100)} color={strengthColor} />
                </div>
              </div>

              <div className="mt-4 p-2 rounded-lg" style={{ background: "#f0f6ff" }}>
                <p className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: "#546e8a" }}>
                  Binding Mode
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>{docking.pose}</p>
                <p className="text-xs mt-1.5" style={{ color: "#546e8a" }}>
                  Key anchor residue: <span style={{ color: "#4fc3f7" }}>{docking.topResidue}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Comparison across all compounds */}
          <CompoundComparison proteinId={selectedProteinId} selectedCompoundId={selectedCompoundId} />

          {/* Protein clinical context */}
          <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: protein.color + "40" }}>
            <div className="flex items-start gap-2">
              <Info size={13} style={{ color: protein.color, flexShrink: 0, marginTop: 2 }} />
              <div>
                <h4 className="text-xs font-semibold mb-1" style={{ color: protein.color }}>
                  Clinical Context — {protein.name} in HCC
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>{protein.function}</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "#1e4878" }}>{protein.clinicalNote}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono">
                  <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
                    <Database size={8} className="inline mr-0.5" /> PDB: {protein.pdb}
                  </span>
                  <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
                    Gene: {protein.gene}
                  </span>
                  <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
                    {protein.pathway}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Nav back */}
          <div className="flex gap-2">
            <button onClick={() => setStep(2)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
              ← Change Phytochemical
            </button>
            <button onClick={() => setStep(1)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
              ← Change Target
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
