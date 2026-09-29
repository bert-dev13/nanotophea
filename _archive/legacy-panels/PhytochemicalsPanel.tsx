"use client"

import { useState } from "react"
import { Database, ExternalLink, Leaf, Activity, Shield, Zap, FlaskConical, Info, ChevronRight, Atom } from "lucide-react"
import { PHYTOCHEMICALS, type Phytochemical } from "@/data/compounds"
import { CompoundViewer3D } from "@/lib/mol3d"

const TOOLTIP_STYLE = {
  backgroundColor: "#1a2744", border: "1px solid #2d4470",
  borderRadius: 8, color: "#e8f4ff", fontSize: 12, fontFamily: "monospace",
}

function ActivityBadge({ a }: { a: string }) {
  const map: Record<string, { color: string; label: string }> = {
    antioxidant: { color: "#00d4aa", label: "Antioxidant" },
    "pro-apoptotic": { color: "#fb923c", label: "Pro-apoptotic" },
    "anti-proliferative": { color: "#4fc3f7", label: "Anti-proliferative" },
    hepatoprotective: { color: "#34d399", label: "Hepatoprotective" },
    "anti-invasive": { color: "#f472b6", label: "Anti-invasive" },
    immunomodulatory: { color: "#a78bfa", label: "Immunomodulatory" },
  }
  const m = map[a] ?? { color: "#546e8a", label: a }
  return (
    <span className="inline-block text-[11px] font-mono px-1.5 py-0.5 rounded mr-1 mb-1"
      style={{ background: m.color + "20", color: m.color }}>
      {m.label}
    </span>
  )
}

function PotencyDot({ p }: { p: string }) {
  const color = p === "high" ? "#fb923c" : p === "moderate" ? "#fbbf24" : "#546e8a"
  return (
    <span className="flex items-center gap-1 text-xs font-mono capitalize" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {p} potency
    </span>
  )
}


function CompoundDetail({ c }: { c: Phytochemical }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: c.color + "50" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-bold" style={{ color: c.color }}>{c.name}</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: c.color + "20", color: c.color }}>
                {c.class}
              </span>
              <PotencyDot p={c.potency} />
            </div>
            <p className="text-xs mt-0.5 font-mono" style={{ color: "#546e8a" }}>
              PubChem CID: {c.cid} · {c.formula} · MW: {c.mw} g/mol
            </p>
            <p className="text-xs mt-1" style={{ color: "#1e4878" }}>{c.plantPart}</p>
          </div>
        </div>
        <p className="text-xs mt-2 leading-relaxed" style={{ color: "#1a3558" }}>{c.description}</p>
        <div className="mt-2">
          {c.activity.map((a) => <ActivityBadge key={a} a={a} />)}
        </div>
      </div>

      {/* 3D viewer */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>
          3D Structure · PubChem 3D Conformer · Toggle 2D / 3D
        </p>
        <CompoundViewer3D cid={c.cid} name={c.name} height={310} color={c.color} />
      </div>

      {/* Physicochemical properties */}
      <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
          Physicochemical Properties (SwissADME)
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: "Mol. Weight", value: `${c.mw} g/mol`, ok: c.mw < 500 },
            { label: "LogP (XLogP)", value: c.logP, ok: c.logP < 5 },
            { label: "H-Bond Donors", value: c.hbd, ok: c.hbd <= 5 },
            { label: "H-Bond Acceptors", value: c.hba, ok: c.hba <= 10 },
            { label: "TPSA", value: `${c.tpsa} Å²`, ok: c.tpsa < 140 },
            { label: "Rotatable Bonds", value: c.rotatable, ok: c.rotatable <= 10 },
          ].map((prop) => (
            <div key={prop.label} className="rounded-lg p-2 border" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
              <div className="text-xs mb-0.5" style={{ color: "#546e8a" }}>{prop.label}</div>
              <div className="text-sm font-bold font-mono flex items-center gap-1"
                style={{ color: prop.ok ? "#00d4aa" : "#fb923c" }}>
                {String(prop.value)}
                <span className="text-[11px]">{prop.ok ? "✓" : "⚠"}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          {[
            { rule: "Lipinski RO5", pass: c.mw < 500 && c.logP < 5 && c.hbd <= 5 && c.hba <= 10 },
            { rule: "GI Absorption (predicted)", pass: c.tpsa < 140 && c.mw < 450 },
            { rule: "BBB Penetrant", pass: c.tpsa < 90 && c.logP > 0 && c.mw < 400 },
            { rule: "CYP3A4 Inhibitor", pass: false },
          ].map((r) => (
            <div key={r.rule} className="flex items-center justify-between text-xs font-mono">
              <span style={{ color: "#546e8a" }}>{r.rule}</span>
              <span style={{ color: r.pass ? "#00d4aa" : "#fb923c" }}>{r.pass ? "✓ Yes" : "✗ No"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SMILES */}
      <div className="rounded-xl p-3 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <p className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>SMILES</p>
        <p className="text-xs font-mono break-all" style={{ color: "#4fc3f7" }}>{c.smiles}</p>
        <p className="text-xs mt-1" style={{ color: "#546e8a" }}>
          IUPAC: <span style={{ color: "#1e4878" }}>{c.iupac.slice(0, 80)}{c.iupac.length > 80 ? "…" : ""}</span>
        </p>
      </div>
    </div>
  )
}

const FILTERS = ["all", "flavonol", "flavone", "glycoside", "tannin", "phenolic", "lignan", "alkaloid", "sterol"] as const
type Filter = (typeof FILTERS)[number]

const matchFilter = (c: Phytochemical, f: Filter) => {
  if (f === "all") return true
  const cls = c.class.toLowerCase()
  if (f === "flavonol") return cls.includes("flavonol")
  if (f === "flavone") return cls.includes("flavone") && !cls.includes("flavonol")
  if (f === "glycoside") return cls.includes("glycoside")
  if (f === "tannin") return cls.includes("tannin") || cls.includes("ellagic")
  if (f === "phenolic") return cls.includes("phenolic")
  if (f === "lignan") return cls.includes("lignan")
  if (f === "alkaloid") return cls.includes("alkaloid")
  if (f === "sterol") return cls.includes("sterol")
  return true
}

export default function PhytochemicalsPanel() {
  const [selected, setSelected] = useState<string>("quercetin")
  const [filter, setFilter] = useState<Filter>("all")
  const compound = PHYTOCHEMICALS.find((p) => p.id === selected)!

  const visible = PHYTOCHEMICALS.filter((c) => matchFilter(c, filter))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg" style={{ background: "#00d4aa20" }}>
          <Leaf size={18} style={{ color: "#00d4aa" }} />
        </div>
        <div>
          <h2 className="text-base font-bold" style={{ color: "#0d1f3c" }}>Phytochemical Library</h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#00d4aa20", color: "#00d4aa" }}>
            14 Compounds · Sampasampalukan · PubChem 3D
          </span>
        </div>
      </div>

      {/* Source note */}
      <div className="rounded-xl p-3 border flex items-start gap-2" style={{ background: "#f0f6ff", borderColor: "#00d4aa40" }}>
        <Info size={13} style={{ color: "#00d4aa", flexShrink: 0, marginTop: 1 }} />
        <p className="text-xs leading-relaxed" style={{ color: "#1e4878" }}>
          All compounds are bioactive phytochemicals isolated from <strong style={{ color: "#00d4aa" }}>Phyllanthus niruri (Sampasampalukan)</strong>.
          3D structures loaded via PubChem CID from the NCBI PubChem compound database. Physicochemical properties computed via SwissADME.
          Sources: <span style={{ color: "#546e8a" }}>PMID: 34521087 · 33018345 · 35672341 · PubChem CID database · ChEMBL31676</span>
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="text-xs font-mono px-2.5 py-1 rounded-full border transition-colors capitalize"
            style={{
              borderColor: filter === f ? "#00d4aa" : "#dde5ef",
              color: filter === f ? "#00d4aa" : "#546e8a",
              background: filter === f ? "#00d4aa12" : "transparent",
            }}>
            {f}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Left: compound list */}
        <div className="w-44 shrink-0 space-y-0.5 max-h-[620px] overflow-y-auto pr-1">
          {visible.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className="w-full text-left rounded-lg px-2.5 py-2 transition-all"
              style={{
                background: selected === c.id ? c.color + "18" : "transparent",
                borderLeft: `2px solid ${selected === c.id ? c.color : "transparent"}`,
              }}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="text-xs font-semibold" style={{ color: selected === c.id ? c.color : "#1a3558" }}>
                  {c.name}
                </span>
              </div>
              <div className="text-[11px] mt-0.5 ml-3" style={{ color: "#546e8a" }}>{c.class}</div>
              <div className="text-[11px] ml-3 font-mono" style={{ color: "#546e8a" }}>
                MW {c.mw} · CID {c.cid}
              </div>
            </button>
          ))}
        </div>

        {/* Right: detail */}
        <div className="flex-1 min-w-0">
          <CompoundDetail c={compound} />
        </div>
      </div>
    </div>
  )
}
