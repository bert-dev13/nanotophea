"use client"

import { useState, useEffect } from "react"
import { FlaskConical } from "lucide-react"

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(0)
  const phases = [
    "Fetching PubChem CID 5280343…",
    "Loading RCSB PDB structures (5YLH · 4S0O · 4IS9)…",
    "Running AutoDock Vina docking pipeline…",
    "Computing ADME/Tox via SwissADME…",
    "Correlating PubMed bioassay data…",
    "Analyzing 11 cell line datasets…",
    "Generating visualizations…",
  ]
  useEffect(() => {
    const i = setInterval(() => setProgress((p) => Math.min(p + 1.4, 100)), 28)
    return () => clearInterval(i)
  }, [])
  useEffect(() => {
    setPhase(Math.min(Math.floor((progress / 100) * phases.length), phases.length - 1))
  }, [progress])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8" style={{ background: "linear-gradient(135deg, #f0f9f6 0%, #eef4ff 50%, #f5f0ff 100%)" }}>
      <div className="text-center space-y-3">
        <div className="flex justify-center mb-4">
          <div className="relative p-4 rounded-2xl shadow-lg" style={{ background: "#ffffff" }}>
            <FlaskConical size={48} style={{ color: "#00a882" }} className="animate-pulse" />
          </div>
        </div>
        <h1 className="text-4xl font-black tracking-tight" style={{ color: "#0d1f3c", letterSpacing: "-0.02em" }}>
          NANO-HEPATOTEA
        </h1>
        <p className="text-base font-semibold" style={{ color: "#00a882" }}>In Silico Bioinformatics Analyzer</p>
        <p className="text-sm" style={{ color: "#546e8a" }}>
          Sampasampalukan Quercetin Nanocarrier · Anti-HCC Analysis
        </p>
      </div>

      <div className="w-80 space-y-3">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#dde5ef" }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #00a882, #2196d3, #7c5cf7)" }} />
        </div>
        <div className="flex justify-between text-xs font-mono" style={{ color: "#546e8a" }}>
          <span>{phases[phase]}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 w-80">
        {["PubMed", "PubChem 3D", "SwissADME", "RCSB PDB", "ChEMBL", "AutoDock Vina"].map((db, i) => (
          <div key={db} className="rounded-xl px-2 py-2 text-center border transition-all shadow-sm"
            style={{
              borderColor: progress > i * 15 ? "#00a88240" : "#dde5ef",
              background: progress > i * 15 ? "#00a88210" : "#ffffff",
            }}>
            <div className="text-xs font-semibold" style={{ color: progress > i * 15 ? "#00a882" : "#546e8a" }}>
              {progress > i * 15 ? "✓" : "…"} {db}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
