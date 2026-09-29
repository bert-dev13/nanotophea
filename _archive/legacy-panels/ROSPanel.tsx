"use client"

import { Zap, Activity, Shield, TrendingDown, CheckCircle2, ChevronRight } from "lucide-react"
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from "recharts"
import { ROS_TABLE, ROS_DUAL, ROS_ENZYME } from "@/data/assay-tables"
import { MetricCard } from "@/components/ui/MetricCard"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { Interpretation } from "@/components/ui/Interpretation"
import { TOOLTIP_STYLE } from "@/components/ui/tooltip-style"

export default function ROSPanel() {
  return (
    <div className="space-y-5">
      <SectionHeader icon={Zap} title="ROS / Oxidative Stress Assay" color="#a78bfa" badge="DCFH-DA · 488 nm" />

      {/* ── Dual mechanism banner ── */}
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
        <div className="grid grid-cols-2 divide-x" style={{ borderTop: "1px solid #dde5ef" }}>
          <div className="p-3" style={{ background: "#fdf4ff" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "#a78bfa" }}>☠ HCC Cancer Cells — Pro-oxidant Killing</p>
            <p className="text-[10px] leading-relaxed" style={{ color: "#1a3558" }}>
              QCN pushes intracellular ROS to 3.41× in HepG2 cells — beyond the 2× apoptotic threshold. Cancer cells, already near their oxidative ceiling, cannot neutralise the surge. ΔΨm collapses → cytochrome c → caspase cascade → apoptosis.
            </p>
          </div>
          <div className="p-3" style={{ background: "#f0f9f6" }}>
            <p className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: "#00a882" }}>🛡 Normal Hepatocytes — Nrf2 Hepatoprotection</p>
            <p className="text-[10px] leading-relaxed" style={{ color: "#1a3558" }}>
              In healthy L02/WRL-68 hepatocytes, sub-toxic QCN doses activate Nrf2/ARE (+84%), upregulating SOD (+118%), catalase (+94%), GPx (+76%) and HO-1 (+109%) — reducing lipid peroxidation and protecting liver tissue.
            </p>
          </div>
        </div>
      </div>

      {/* ── Biomarker cards: cancer vs normal ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#a78bfa40" }}>
          <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "#fdf4ff", borderBottom: "1px solid #a78bfa20" }}>
            <Zap size={11} style={{ color: "#a78bfa" }} />
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#a78bfa" }}>Cancer Cell Response · HepG2</span>
          </div>
          <div className="grid grid-cols-2 gap-px" style={{ background: "#dde5ef" }}>
            {[
              { label: "MAX ROS FOLD",       value: "3.41×",     sub: "at 100 µM",              color: "#a78bfa" },
              { label: "THRESHOLD CROSSED",  value: "25 µM",     sub: "apoptotic trigger ≥2×",  color: "#fb923c" },
              { label: "MITO. COLLAPSE",     value: "Severe",    sub: "ΔΨm disruption",          color: "#f472b6" },
              { label: "DOSES ABOVE 2×",     value: "57%",       sub: "of tested concentrations",color: "#e879f9" },
            ].map(c => (
              <div key={c.label} className="p-3" style={{ background: "#ffffff" }}>
                <div className="text-[8px] font-mono uppercase tracking-widest mb-1" style={{ color: "#546e8a" }}>{c.label}</div>
                <div className="text-xl font-bold leading-none mb-0.5" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[9px]" style={{ color: "#94a3b8" }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#00d4aa40" }}>
          <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "#f0f9f6", borderBottom: "1px solid #00d4aa20" }}>
            <Shield size={11} style={{ color: "#00a882" }} />
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "#00a882" }}>Normal Hepatocyte Response · Nrf2/ARE</span>
          </div>
          <div className="grid grid-cols-2 gap-px" style={{ background: "#dde5ef" }}>
            {[
              { label: "Nrf2 ACTIVATION",  value: "+84%",     sub: "nuclear translocation",        color: "#00d4aa" },
              { label: "SOD INDUCTION",    value: "+118%",    sub: "superoxide dismutase ↑",        color: "#34d399" },
              { label: "MDA REDUCTION",    value: "−67%",     sub: "lipid peroxidation suppressed", color: "#4fc3f7" },
              { label: "HEPATOPROTECTION", value: "Confirmed", sub: "ORAC 68.4 µmol TE/g",         color: "#00a882" },
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

      {/* ── Dual charts ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#a78bfa30" }}>
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ background: "#a78bfa" }} />
            <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>ROS Accumulation — HepG2 vs Normal (Fold-Change)</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ROS_DUAL} margin={{ top: 8, right: 10, left: -15, bottom: 5 }}>
              <defs>
                <linearGradient id="crg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="nrg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4aa" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eef8" />
              <XAxis dataKey="conc" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v.toFixed(2)}×`, n === "cancer_ros" ? "HepG2 ROS" : "Normal Hepatocyte ROS"]} />
              <ReferenceLine y={2} stroke="#fb923c" strokeDasharray="5 3"
                label={{ value: "Apoptotic threshold (2×)", fill: "#fb923c", fontSize: 9, position: "insideTopRight" }} />
              <Area type="monotone" dataKey="cancer_ros" stroke="#a78bfa" fill="url(#crg)" strokeWidth={2.5} dot={{ r: 2.5, fill: "#a78bfa" }} name="cancer_ros" />
              <Area type="monotone" dataKey="normal_ros" stroke="#00d4aa" fill="url(#nrg)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="normal_ros" />
              <Legend wrapperStyle={{ fontSize: 10, color: "#546e8a" }} formatter={(v) => v === "cancer_ros" ? "HepG2 (pro-oxidant)" : "Normal hepatocyte (protected)"} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#ffffff", borderColor: "#00d4aa30" }}>
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ background: "#00d4aa" }} />
            <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>Nrf2-Driven Enzyme Response — Normal Hepatocytes</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ROS_ENZYME} margin={{ top: 8, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eef8" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}%`]} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="change" radius={[3, 3, 0, 0]}
                label={{ position: "top", fill: "#546e8a", fontSize: 9, formatter: (v: number) => `${v > 0 ? "+" : ""}${v}%` }}>
                {ROS_ENZYME.map(e => <Cell key={e.label} fill={e.type === "up" ? "#00d4aa" : "#fb923c"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Dual cascade ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#a78bfa30" }}>
          <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "#fdf4ff", borderBottom: "1px solid #a78bfa20" }}>
            <Zap size={11} style={{ color: "#a78bfa" }} />
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "#a78bfa" }}>Cancer Cell — Apoptosis Cascade</span>
          </div>
          <div className="p-3 space-y-2" style={{ background: "#ffffff" }}>
            {[
              { text: "QCN enters HepG2 cell via nanocarrier endocytosis",          color: "#a78bfa" },
              { text: "Intracellular ROS ↑ 3.41× — oxidative burst",                color: "#a78bfa" },
              { text: "2× apoptotic threshold crossed at 25 µM",                    color: "#fb923c" },
              { text: "Mitochondrial membrane potential (ΔΨm) collapses",           color: "#fb923c" },
              { text: "Cytochrome c released → caspase-9 activation",               color: "#f472b6" },
              { text: "Caspase-3 (executioner) cleaves PARP → DNA fragmentation",  color: "#f472b6" },
              { text: "Apoptosis — independent of p53 status",                      color: "#e879f9" },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight size={11} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
                <span className="text-sm" style={{ color: "#1a3558" }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#00d4aa30" }}>
          <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "#f0f9f6", borderBottom: "1px solid #00d4aa20" }}>
            <Shield size={11} style={{ color: "#00a882" }} />
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "#00a882" }}>Normal Hepatocyte — Nrf2 Protection</span>
          </div>
          <div className="p-3 space-y-2" style={{ background: "#ffffff" }}>
            {[
              { text: "QCN at sub-toxic dose activates Keap1/Nrf2 axis",           color: "#00d4aa" },
              { text: "Nrf2 translocates to nucleus (+84%)",                        color: "#00d4aa" },
              { text: "ARE promoter binding → HO-1 +109%, NQO1 upregulated",       color: "#34d399" },
              { text: "SOD +118% · Catalase +94% · GPx +76%",                     color: "#34d399" },
              { text: "H₂O₂ and superoxide detoxified — ROS stays near baseline",  color: "#4fc3f7" },
              { text: "Lipid peroxidation ↓: MDA −67% · 4-HNE −58%",             color: "#4fc3f7" },
              { text: "Normal hepatocyte survives → selective hepatoprotection",    color: "#00a882" },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight size={11} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
                <span className="text-sm" style={{ color: "#1a3558" }}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Interpretation color="#a78bfa" title="Anticancer Mechanism — ROS / Oxidative Stress"
        text="QCN selectively kills HCC cells by acting as a pro-oxidant (ROS 3.41× → mitochondrial collapse → apoptosis) while simultaneously protecting normal hepatocytes via Nrf2/ARE activation (SOD +118%, catalase +94%, GPx +76%). This bidirectional mechanism — not simply antioxidant activity — explains both the selective cytotoxicity (SI 4.2×) and the hepatoprotective properties of Sampasampalukan quercetin nanocarriers."
        refs={["PMID: 33018345", "PubChem CID 5280343", "PDB: 4IS9 — Nrf2"]} />
    </div>
  )
}
