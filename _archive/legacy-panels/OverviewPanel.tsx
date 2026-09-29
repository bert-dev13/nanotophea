"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  FlaskConical, Atom, Shield, Database,
} from "lucide-react"
import { NAV_ITEMS } from "@/data/tabs"
import { NAV_ICONS } from "@/components/layout/nav-icons"

function NanoMascot() {
  return (
    <svg width="80" height="88" viewBox="0 0 80 88" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 4px 12px #00a88240)" }}>
      <ellipse cx="28" cy="20" rx="8" ry="13" fill="#4ade80" transform="rotate(-28 28 20)" opacity="0.92" />
      <ellipse cx="40" cy="13" rx="7" ry="12" fill="#22c55e" opacity="0.95" />
      <ellipse cx="52" cy="20" rx="8" ry="13" fill="#4ade80" transform="rotate(28 52 20)" opacity="0.92" />
      <line x1="28" y1="10" x2="28" y2="27" stroke="#16a34a" strokeWidth="0.9" opacity="0.6" transform="rotate(-28 28 20)" />
      <line x1="40" y1="3" x2="40" y2="23" stroke="#16a34a" strokeWidth="0.9" opacity="0.6" />
      <line x1="52" y1="10" x2="52" y2="27" stroke="#16a34a" strokeWidth="0.9" opacity="0.6" transform="rotate(28 52 20)" />
      <ellipse cx="40" cy="56" rx="34" ry="12" stroke="#00a882" strokeWidth="1.5" fill="none" opacity="0.25" />
      <ellipse cx="40" cy="56" rx="34" ry="12" stroke="#00a882" strokeWidth="1.5" fill="none" opacity="0.25" transform="rotate(60 40 56)" />
      <ellipse cx="40" cy="56" rx="34" ry="12" stroke="#2196d3" strokeWidth="1.5" fill="none" opacity="0.2" transform="rotate(120 40 56)" />
      <circle cx="40" cy="56" r="24" fill="url(#nanoBodyGrad)" />
      <circle cx="40" cy="56" r="24" fill="none" stroke="#00a88240" strokeWidth="1.5" />
      <circle cx="33" cy="51" r="4.5" fill="white" />
      <circle cx="47" cy="51" r="4.5" fill="white" />
      <circle cx="34" cy="51" r="2.8" fill="#0d1f3c" />
      <circle cx="48" cy="51" r="2.8" fill="#0d1f3c" />
      <circle cx="35" cy="50" r="1" fill="white" />
      <circle cx="49" cy="50" r="1" fill="white" />
      <path d="M31 61 Q40 70 49 61" stroke="#0d1f3c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="26" cy="60" r="4.5" fill="#fb7185" opacity="0.35" />
      <circle cx="54" cy="60" r="4.5" fill="#fb7185" opacity="0.35" />
      <path d="M36 40 L36 44 L32 52" stroke="#00a88260" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <defs>
        <radialGradient id="nanoBodyGrad" cx="42%" cy="35%" r="62%">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="60%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </radialGradient>
      </defs>
    </svg>
  )
}

function MascotGuide({ onNavigate }: { onNavigate: (href: string) => void }) {
  const tips = [
    { msg: "Hi! I'm Nano — your NANO-HEPATOTEA research guide! Click me for tips!", href: null as string | null },
    { msg: "Start with Cell Lines to see how I fight liver cancer across 11 cell lines!", href: "/cell-lines" },
    { msg: "Visit Proteins to view animated 3D structures of my 12 molecular targets!", href: "/proteins" },
    { msg: "The DPPH tab shows my antioxidant power against free radicals!", href: "/dpph" },
    { msg: "Try AutoDock Vina for interactive 3D docking simulation!", href: "/docking" },
    { msg: "I'm from Sampasampalukan, wrapped in chitosan-TPP nanocarriers!", href: null },
    { msg: "Visit the Interpreter for plain-English explanations of all results!", href: "/interpreter" },
    { msg: "Check the Hippo–YAP tab to see how I suppress tumor growth signals!", href: "/yap" },
  ]
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIdx(i => (i + 1) % tips.length); setVisible(true) }, 300)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleClick = () => {
    const tip = tips[idx]
    if (tip.href) { onNavigate(tip.href); return }
    setVisible(false)
    setTimeout(() => { setIdx(i => (i + 1) % tips.length); setVisible(true) }, 200)
  }

  const tip = tips[idx]
  return (
    <div className="flex items-end justify-end gap-3 mt-6">
      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
        transition: "all 0.3s ease",
        maxWidth: 260,
      }}>
        <div
          className="relative rounded-2xl rounded-br-sm px-4 py-3 shadow-lg text-sm font-medium leading-relaxed"
          style={{ background: "#ffffff", border: "2px solid #00a88230", color: "#0d1f3c", boxShadow: "0 4px 20px #00a88218" }}
        >
          {tip.msg}
          {tip.href && (
            <div className="mt-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#00a88215", color: "#00a882" }}>
                → Click Nano to go there
              </span>
            </div>
          )}
          <div
            className="absolute -bottom-2.5 right-8 w-0 h-0"
            style={{ borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid #ffffff" }}
          />
        </div>
      </div>
      <button
        onClick={handleClick}
        className="shrink-0 transition-transform hover:scale-110 active:scale-95"
        style={{ animation: "mascot-pulse 3s ease-in-out infinite" }}
        type="button"
        aria-label="Nano guide"
      >
        <NanoMascot />
      </button>
    </div>
  )
}

export default function OverviewPanel() {
  const router = useRouter()
  const onNavigate = (href: string) => router.push(href)

  const MODULE_META: Record<string, string> = {
    celllines: "11 HCC + normal cell lines", proteins: "12 targets · animated 3D PDB",
    phytochemicals: "14 compounds · PubChem 3D animated", dockinglab: "Interactive docking workflow",
    dpph: "Free-radical scavenging · OS proteins", mtt: "Cell viability · IC₅₀ dose–response",
    ldh: "LDH cytotoxicity release assay", ros: "Oxidative stress profiling",
    bax: "Intrinsic apoptosis · 3D BAX structure", yap: "Hippo–YAP · 3D YAP1 structure",
    docking: "AutoDock Vina · animated 3D docking", results: "Saved experiment records",
    interpreter: "Plain-language result guide", dosage: "Tea dosage schedule",
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl overflow-hidden border shadow-md" style={{ borderColor: "#dde5ef" }}>
        <div className="px-5 py-8 sm:px-8 sm:py-10" style={{ background: "linear-gradient(135deg, #e8f8f4 0%, #eef4ff 50%, #f3eeff 100%)" }}>
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl shadow-md" style={{ background: "#ffffff" }}>
                  <FlaskConical size={36} style={{ color: "#00a882" }} />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black leading-none" style={{ color: "#0d1f3c", letterSpacing: "-0.03em" }}>
                    NANO-HEPATOTEA
                  </h1>
                  <p className="text-base font-semibold mt-1" style={{ color: "#00a882" }}>
                    In Silico Bioinformatics Analyzer
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-5 max-w-xl" style={{ color: "#2a5070" }}>
                Comprehensive computational analysis of <strong style={{ color: "#059669" }}>Sampasampalukan (<em>Phyllanthus niruri</em>)</strong> chitosan/TPP
                nanocarriers against Hepatocellular Carcinoma (HCC) — with animated 3D molecular docking, multi-assay profiling, and AI confidence scoring.
              </p>
              <div className="flex gap-4 sm:gap-6 flex-wrap">
                {[
                  { value: "11", label: "Cell Lines", color: "#00a882" },
                  { value: "12", label: "Protein Targets", color: "#7c5cf7" },
                  { value: "14", label: "Phytochemicals", color: "#059669" },
                  { value: "7", label: "Assay Types", color: "#2196d3" },
                  { value: "7", label: "Databases", color: "#e2562a" },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <div className="text-2xl sm:text-3xl font-black" style={{ color: m.color }}>{m.value}</div>
                    <div className="text-xs font-semibold mt-0.5" style={{ color: "#546e8a" }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="shrink-0 self-end sm:self-start">
              <MascotGuide onNavigate={onNavigate} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: FlaskConical, color: "#00a882", title: "What is NANO-HEPATOTEA?",
            body: "A chitosan-TPP nanoencapsulated phytochemical tea derived from Sampasampalukan (P. niruri), formulated for targeted delivery against liver cancer cells while protecting healthy hepatocytes through Nrf2 activation." },
          { icon: Atom, color: "#7c5cf7", title: "Why Nanoencapsulation?",
            body: "Chitosan-TPP nanocarriers improve bioavailability 3–5× over the free compound, reducing IC₅₀ from ~75–108 µM to 18–34 µM in HCC lines via pH-responsive endocytic release inside tumor cells." },
          { icon: Shield, color: "#059669", title: "Dual-Action Profile",
            body: "Selectively kills HCC cancer cells (Selectivity Index = 4.2×) while activating Nrf2 antioxidant pathways in normal hepatocytes — simultaneously anti-cancer and hepatoprotective." },
        ].map((c) => {
          const Icon = c.icon
          return (
            <div key={c.title} className="rounded-xl p-5 border shadow-sm" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <div className="p-2.5 rounded-xl inline-flex mb-3" style={{ background: c.color + "14" }}>
                <Icon size={22} style={{ color: c.color }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: "#0d1f3c" }}>{c.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#2a5070" }}>{c.body}</p>
            </div>
          )
        })}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: "#0d1f3c" }}>Analysis Modules</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {NAV_ITEMS.filter((t) => t.id !== "overview").map((t) => {
            const Icon = NAV_ICONS[t.iconName]
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onNavigate(t.href)}
                className="p-4 rounded-xl border text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-100"
                style={{ background: "#ffffff", borderColor: "#dde5ef" }}
              >
                <div className="p-2 rounded-lg inline-flex mb-2.5" style={{ background: t.color + "18" }}>
                  <Icon size={16} style={{ color: t.color }} />
                </div>
                <div className="text-sm font-bold" style={{ color: "#0d1f3c" }}>{t.label}</div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "#546e8a" }}>{MODULE_META[t.id] ?? ""}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl p-5 border shadow-sm" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <h3 className="text-base font-bold mb-4" style={{ color: "#0d1f3c" }}>Reference Databases & Tools</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { name: "PubMed", detail: "PMID 34521087 · 35672341 · 33018345", color: "#00a882" },
            { name: "PubChem 3D", detail: "CID 5280343 · 3D conformers", color: "#2196d3" },
            { name: "RCSB PDB", detail: "5YLH · 4S0O · 4IS9 · 2YIU", color: "#7c5cf7" },
            { name: "SwissADME", detail: "ADME / Toxicity screening", color: "#e2562a" },
            { name: "ChEMBL", detail: "CHEMBL31676 · bioactivity data", color: "#d9296a" },
            { name: "AutoDock Vina", detail: "v1.2 molecular docking pipeline", color: "#059669" },
            { name: "CNN / Deep Learning", detail: "AI confidence scoring · binding prediction", color: "#f59e0b" },
          ].map((db) => (
            <div
              key={db.name}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
              style={{ background: db.color + "08", borderColor: db.color + "28" }}
            >
              <Database size={13} style={{ color: db.color }} />
              <div>
                <div className="text-sm font-bold" style={{ color: db.color }}>{db.name}</div>
                <div className="text-xs" style={{ color: "#546e8a" }}>{db.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
