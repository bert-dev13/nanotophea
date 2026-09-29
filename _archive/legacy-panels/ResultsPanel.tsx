"use client"

import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  BookOpen, Trash2, Download, Filter, FlaskConical, Zap, Dna, Activity,
  Droplets, TrendingDown, CheckCircle2, Clock, Microscope, Atom, X,
  ChevronDown, ChevronRight, BarChart3, Beaker,
} from "lucide-react"
import type { SavedResult } from "@/components/panels/AssayLabSection"

const TT = {
  backgroundColor: "#1a2744", border: "1px solid #2d4470",
  borderRadius: 8, color: "#e8f4ff", fontSize: 11, fontFamily: "monospace",
}

const ASSAY_ICONS = {
  mtt: FlaskConical, ros: Zap, yap: Dna, bax: Activity, ldh: Droplets, dpph: Beaker,
}

const ASSAY_COLORS = {
  mtt: "#4fc3f7", ros: "#a78bfa", yap: "#4fc3f7", bax: "#fb923c", ldh: "#f472b6", dpph: "#34d399",
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    + " " + d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
}

function ResultCard({ result, onDelete }: { result: SavedResult; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = ASSAY_ICONS[result.assay] ?? FlaskConical
  const assayColor = result.color

  const siColor = result.selectivityIndex >= 3 ? "#00d4aa" : result.selectivityIndex >= 2 ? "#fbbf24" : "#fb923c"

  return (
    <div className="rounded-xl border overflow-hidden transition-all" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Assay icon */}
            <div className="p-2 rounded-lg shrink-0 mt-0.5" style={{ background: assayColor + "18" }}>
              <Icon size={14} style={{ color: assayColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-xs font-bold" style={{ color: "#0d1f3c" }}>{result.compoundName}</span>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: assayColor + "20", color: assayColor }}>
                  {result.assayLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs font-mono" style={{ color: "#546e8a" }}>
                <span className="flex items-center gap-0.5"><Microscope size={9} /> {result.cellLineName}</span>
                <span className="flex items-center gap-0.5"><Clock size={9} /> {result.timePoint}h</span>
                <span className="flex items-center gap-0.5"><BarChart3 size={9} /> n={result.replicates}</span>
                <span>{formatDate(result.savedAt)}</span>
              </div>
            </div>
          </div>
          {/* Quick metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[11px] font-mono" style={{ color: "#546e8a" }}>IC₅₀</div>
              <div className="text-base font-bold font-mono" style={{ color: assayColor }}>{result.ic50}</div>
              <div className="text-[11px] font-mono" style={{ color: "#546e8a" }}>µM</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-mono" style={{ color: "#546e8a" }}>SI</div>
              <div className="text-sm font-bold font-mono" style={{ color: siColor }}>{result.selectivityIndex}×</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-1.5 rounded-lg border transition-colors"
                style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg border transition-colors"
                style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Inline metrics row */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: "IC₅₀", value: `${result.ic50} µM`, color: assayColor },
            { label: result.assay === "ldh" ? "Max Cytotox" : result.assay === "dpph" ? "Max RSA" : "Max Inhibition", value: `${result.maxInhibition}%`, color: "#a78bfa" },
            { label: `${result.posControlName.slice(0,10)} IC₅₀`, value: `${result.posControlIC50} µM`, color: result.posControl === "sorafenib" ? "#e879f9" : result.posControl === "doxorubicin" ? "#f97316" : result.posControl === "5fu" ? "#34d399" : "#546e8a" },
            { label: result.assay === "dpph" ? "Rel. Potency" : "Selectivity", value: `${result.selectivityIndex}×`, color: siColor },
          ].map(m => (
            <div key={m.label} className="rounded-lg p-2 border" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
              <div className="text-[11px] font-mono" style={{ color: "#546e8a" }}>{m.label}</div>
              <div className="text-sm font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "#dde5ef", background: "#f0f6ff" }}>
          {/* Config summary */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>Experiment Configuration</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs font-mono">
              {[
                ["Assay", result.assayLabel],
                ["Cell Line", result.cellLineName],
                ["Compound", result.compoundName],
                ["Positive Control", result.posControlName],
                ["Incubation", `${result.timePoint}h`],
                ["Replicates", `n=${result.replicates}`],
                ["Concentrations", result.concentrations.map(c => c === 0 ? "0 (ctrl)" : `${c} µM`).join(", ")],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="w-28 shrink-0" style={{ color: "#546e8a" }}>{k}</span>
                  <span style={{ color: "#1a3558" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Mini comparison bar */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>IC₅₀ Comparison</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart
                data={[
                  { name: result.compoundName.slice(0,12), ic50: result.ic50 },
                  { name: result.posControlName.slice(0,12), ic50: result.posControlIC50 },
                ]}
                margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
                <XAxis dataKey="name" stroke="#546e8a" tick={{ fontSize: 9 }} />
                <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(2)} µM`, "IC₅₀"]} />
                <Bar dataKey="ic50" radius={[3, 3, 0, 0]}>
                  {[assayColor, "#546e8a"].map((c, i) => <rect key={i} fill={c} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResultsPanel({
  results, onDelete, onClear,
}: {
  results: SavedResult[]
  onDelete: (id: string) => void
  onClear: () => void
}) {
  const [filter, setFilter] = useState<"all" | "mtt" | "ros" | "yap" | "bax" | "ldh" | "dpph">("all")
  const [sortBy, setSortBy] = useState<"date" | "ic50" | "si">("date")

  const filtered = results
    .filter(r => filter === "all" || r.assay === filter)
    .sort((a, b) => {
      if (sortBy === "ic50") return a.ic50 - b.ic50
      if (sortBy === "si") return b.selectivityIndex - a.selectivityIndex
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    })

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `HCC_experiment_results_${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  // Summary stats
  const byCellLine = results.reduce<Record<string, number[]>>((acc, r) => {
    if (!acc[r.cellLineName]) acc[r.cellLineName] = []
    acc[r.cellLineName].push(r.ic50)
    return acc
  }, {})
  const summaryData = Object.entries(byCellLine).map(([name, ic50s]) => ({
    name, avgIC50: +(ic50s.reduce((a, b) => a + b, 0) / ic50s.length).toFixed(2), count: ic50s.length,
  })).sort((a, b) => a.avgIC50 - b.avgIC50)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: "#fbbf2415" }}>
            <BookOpen size={18} style={{ color: "#fbbf24" }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#0d1f3c" }}>Experiment Records</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "#fbbf2415", color: "#fbbf24" }}>
              {results.length} saved result{results.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && (
            <>
              <button onClick={handleExport}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                style={{ borderColor: "#00d4aa", color: "#00d4aa", background: "#00d4aa10" }}>
                <Download size={12} /> Export JSON
              </button>
              <button onClick={onClear}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
                <Trash2 size={12} /> Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
          <BookOpen size={32} style={{ color: "#dde5ef", margin: "0 auto 12px" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "#546e8a" }}>No results saved yet</p>
          <p className="text-xs" style={{ color: "#8098b4" }}>
            Run an experiment in any assay tab and click "Save to Records" to see your results here.
          </p>
        </div>
      ) : (
        <>
          {/* Summary chart */}
          {summaryData.length > 0 && (
            <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
                Average IC₅₀ by Cell Line · All Saved Experiments
              </p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={summaryData} margin={{ top: 5, right: 8, left: -10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dde5ef" />
                  <XAxis dataKey="name" stroke="#546e8a" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                  <YAxis stroke="#546e8a" tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={TT} formatter={(v: number) => [`${v.toFixed(2)} µM`, "Avg IC₅₀"]} />
                  <Bar dataKey="avgIC50" fill="#00d4aa" radius={[2, 2, 0, 0]}
                    label={{ position: "top", fill: "#546e8a", fontSize: 8, formatter: (v: number) => v.toFixed(1) }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Assay counts */}
          <div className="flex flex-wrap gap-2">
            {(["all", "mtt", "ros", "yap", "bax", "ldh", "dpph"] as const).map(a => {
              const count = a === "all" ? results.length : results.filter(r => r.assay === a).length
              if (a !== "all" && count === 0) return null
              const color = a === "all" ? "#546e8a" : (ASSAY_COLORS[a] ?? "#546e8a")
              const label = a === "all" ? `All (${count})` : `${a.toUpperCase()} (${count})`
              return (
                <button key={a} onClick={() => setFilter(a)}
                  className="text-xs font-mono font-bold px-3 py-1 rounded-full border transition-all"
                  style={{
                    borderColor: filter === a ? color : "#dde5ef",
                    color: filter === a ? color : "#546e8a",
                    background: filter === a ? color + "18" : "transparent",
                  }}>
                  {label}
                </button>
              )
            })}
            <div className="ml-auto flex gap-1">
              {(["date", "ic50", "si"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className="text-[11px] font-mono px-2 py-1 rounded-lg border transition-all capitalize"
                  style={{ borderColor: sortBy === s ? "#4fc3f7" : "#dde5ef", color: sortBy === s ? "#4fc3f7" : "#546e8a" }}>
                  {s === "ic50" ? "IC₅₀ ↑" : s === "si" ? "SI ↓" : "Date"}
                </button>
              ))}
            </div>
          </div>

          {/* Result cards */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: "#546e8a" }}>No {filter.toUpperCase()} results saved.</div>
            ) : (
              filtered.map(r => (
                <ResultCard key={r.id} result={r} onDelete={() => onDelete(r.id)} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
