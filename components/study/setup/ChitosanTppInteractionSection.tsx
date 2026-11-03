"use client"

import { useState } from "react"
import {
  AlertCircle,
  Atom,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Eye,
  Layers,
  Sparkles,
} from "lucide-react"
import type { NanoparticleFormulation } from "@/lib/domain/models"

interface ChitosanTppInteractionSectionProps {
  record: NanoparticleFormulation | null
}

type InteractionStage = "components" | "crosslinking" | "nanoparticle"

export function ChitosanTppInteractionSection({
  record,
}: ChitosanTppInteractionSectionProps) {
  const [stage, setStage] = useState<InteractionStage>("crosslinking")

  const notRecorded = "Not recorded"

  return (
    <div className="space-y-6">
      {/* 1. Header & Scientific Identity */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Chitosan–TPP Interaction Workspace
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-400">
                <Eye className="h-3 w-3" />
                SCHEMATIC MODEL
              </span>
            </div>
            <h2 className="font-display text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              Chitosan–TPP Interaction
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed mt-0.5">
              Ionic crosslinking and nanoparticle formation between polycationic chitosan chains and polyanionic tripolyphosphate (TPP).
            </p>
          </div>

          {/* Interactive stage toggles */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/80 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStage("components")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                stage === "components"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Components
            </button>
            <button
              type="button"
              onClick={() => setStage("crosslinking")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                stage === "crosslinking"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Ionic Crosslinking
            </button>
            <button
              type="button"
              onClick={() => setStage("nanoparticle")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                stage === "nanoparticle"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Nanoparticle
            </button>
          </div>
        </div>

        {/* Scientific Label (Requirement 6) */}
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3.5 py-2.5 text-xs text-slate-400">
          <AlertCircle className="h-4 w-4 shrink-0 text-sky-400 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-300 font-semibold">Visual Representation:</strong> Visual representation of the recorded Chitosan–TPP formulation. Not a molecular dynamics simulation.
          </p>
        </div>
      </div>

      {/* 2. Scientific Interaction Visualization Canvas (Requirements 2 & 5) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-sm space-y-4">
        {/* Interaction Equation Banner */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 py-2 px-3 rounded-lg border border-slate-800/80 bg-slate-950/60 text-xs">
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">CHITOSAN</span>
            <span className="text-slate-200 font-medium font-mono">–NH₃⁺ –NH₃⁺ –NH₃⁺</span>
            <span className="text-[10px] text-emerald-400 block">Polycationic Polymer</span>
          </div>
          <span className="text-slate-500 font-bold text-sm">+</span>
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">TPP</span>
            <span className="text-amber-300 font-medium font-mono">P₃O₁₀⁵⁻</span>
            <span className="text-[10px] text-amber-400 block">Tripolyphosphate</span>
          </div>
          <span className="text-slate-500 font-bold text-sm">→</span>
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">INTERACTION</span>
            <span className="text-emerald-300 font-semibold">Ionic Crosslinking</span>
            <span className="text-[10px] text-slate-400 block">Electrostatic Self-Assembly</span>
          </div>
          <span className="text-slate-500 font-bold text-sm">→</span>
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase block">PRODUCT</span>
            <span className="text-slate-100 font-bold">Chitosan–TPP Nanoparticle</span>
            <span className="text-[10px] text-sky-400 block">Colloidal Carrier System</span>
          </div>
        </div>

        {/* Dynamic SVG Interaction Stage Canvas */}
        <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-slate-950/95 p-3 sm:p-6 border border-slate-800/80">
          <svg
            viewBox="0 0 760 320"
            className="w-full h-auto max-h-[320px] select-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <style>{`
              @media (prefers-reduced-motion: no-preference) {
                @keyframes crosslinkFlow {
                  0% { stroke-dashoffset: 20; }
                  100% { stroke-dashoffset: 0; }
                }
                .animated-link {
                  stroke-dasharray: 4 3;
                  animation: crosslinkFlow 1.8s linear infinite;
                }
                @keyframes tppHover {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-3px); }
                }
                .tpp-anim {
                  animation: tppHover 3s ease-in-out infinite;
                }
              }
            `}</style>

            <defs>
              <linearGradient id="chitosanGradientUpper" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.4" />
                <stop offset="30%" stopColor="#10b981" stopOpacity="0.85" />
                <stop offset="70%" stopColor="#10b981" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
              </linearGradient>

              <linearGradient id="chitosanGradientLower" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#047857" stopOpacity="0.4" />
                <stop offset="30%" stopColor="#059669" stopOpacity="0.85" />
                <stop offset="70%" stopColor="#059669" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#047857" stopOpacity="0.4" />
              </linearGradient>

              <radialGradient id="nanoparticleSphere" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                <stop offset="70%" stopColor="#059669" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#047857" stopOpacity="0.0" />
              </radialGradient>
            </defs>

            {/* Nanoparticle boundary in Nanoparticle mode */}
            {stage === "nanoparticle" && (
              <g transform="translate(380, 160)">
                <circle cx="0" cy="0" r="148" fill="url(#nanoparticleSphere)" stroke="#10b981" strokeWidth="1.2" strokeDasharray="6 4" />
                <text x="100" y="-125" fill="#34d399" fontSize="10.5" fontWeight="600" opacity="0.9">
                  Assembled Nanoparticle Matrix
                </text>
              </g>
            )}

            {/* Upper Chitosan Chain */}
            <g id="upper-chain">
              <path
                d={
                  stage === "nanoparticle"
                    ? "M 100 80 Q 240 60, 380 75 T 660 80"
                    : "M 50 65 Q 160 45, 270 65 T 490 65 T 710 65"
                }
                fill="none"
                stroke="url(#chitosanGradientUpper)"
                strokeWidth={stage === "nanoparticle" ? "8" : "7"}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              <text x="60" y="45" fill="#a7f3d0" fontSize="11" fontWeight="bold">
                Chitosan polymer chain (Polycation)
              </text>

              {/* Upper NH3+ Sites */}
              <g transform="translate(200, 60)">
                <line x1="0" y1="5" x2="0" y2="30" stroke="#10b981" strokeWidth="2" />
                <circle cx="0" cy="36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="40" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>

              <g transform="translate(380, 60)">
                <line x1="0" y1="5" x2="0" y2="30" stroke="#10b981" strokeWidth="2" />
                <circle cx="0" cy="36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="40" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>

              <g transform="translate(560, 60)">
                <line x1="0" y1="5" x2="0" y2="30" stroke="#10b981" strokeWidth="2" />
                <circle cx="0" cy="36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="40" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>
            </g>

            {/* Central TPP Molecules */}
            <g id="tpp-molecules">
              {/* TPP Node Left */}
              <g
                transform={
                  stage === "components"
                    ? "translate(150, 160)"
                    : stage === "crosslinking"
                      ? "translate(270, 160)"
                      : "translate(290, 160)"
                }
                className="tpp-anim transition-all duration-300"
              >
                <rect x="-40" y="-18" width="80" height="36" rx="9" fill="#78350f" stroke="#f59e0b" strokeWidth="1.8" />
                <text x="0" y="-2" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="bold">
                  TPP⁵⁻
                </text>
                <text x="0" y="11" textAnchor="middle" fill="#fde68a" fontSize="8.5" fontFamily="monospace">
                  P₃O₁₀⁵⁻
                </text>
              </g>

              {/* TPP Node Right */}
              <g
                transform={
                  stage === "components"
                    ? "translate(610, 160)"
                    : stage === "crosslinking"
                      ? "translate(490, 160)"
                      : "translate(470, 160)"
                }
                className="tpp-anim transition-all duration-300"
              >
                <rect x="-40" y="-18" width="80" height="36" rx="9" fill="#78350f" stroke="#f59e0b" strokeWidth="1.8" />
                <text x="0" y="-2" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="bold">
                  TPP⁵⁻
                </text>
                <text x="0" y="11" textAnchor="middle" fill="#fde68a" fontSize="8.5" fontFamily="monospace">
                  P₃O₁₀⁵⁻
                </text>
              </g>

              <text x="380" y="150" textAnchor="middle" fill="#fcd34d" fontSize="11" fontWeight="600">
                TPP phosphate groups
              </text>
              <text x="380" y="170" textAnchor="middle" fill="#fbbf24" fontSize="9" opacity="0.9">
                Multivalent Counterion Crosslinker
              </text>
            </g>

            {/* Lower Chitosan Chain */}
            <g id="lower-chain">
              <path
                d={
                  stage === "nanoparticle"
                    ? "M 100 240 Q 240 260, 380 245 T 660 240"
                    : "M 50 255 Q 160 275, 270 255 T 490 255 T 710 255"
                }
                fill="none"
                stroke="url(#chitosanGradientLower)"
                strokeWidth={stage === "nanoparticle" ? "8" : "7"}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              <text x="60" y="285" fill="#a7f3d0" fontSize="11" fontWeight="bold">
                Chitosan polymer chain (Polycation)
              </text>

              {/* Lower NH3+ Sites */}
              <g transform="translate(200, 255)">
                <line x1="0" y1="-5" x2="0" y2="-30" stroke="#059669" strokeWidth="2" />
                <circle cx="0" cy="-36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="-32" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>

              <g transform="translate(380, 255)">
                <line x1="0" y1="-5" x2="0" y2="-30" stroke="#059669" strokeWidth="2" />
                <circle cx="0" cy="-36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="-32" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>

              <g transform="translate(560, 255)">
                <line x1="0" y1="-5" x2="0" y2="-30" stroke="#059669" strokeWidth="2" />
                <circle cx="0" cy="-36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="-32" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>
            </g>

            {/* Electrostatic Ionic Crosslink Vectors */}
            {(stage === "crosslinking" || stage === "nanoparticle") && (
              <g id="crosslinks">
                {/* Upper Left NH3+ to Left TPP */}
                <line x1="205" y1="106" x2="245" y2="148" stroke="#f59e0b" strokeWidth="2" className="animated-link" />
                {/* Upper Center NH3+ to Left TPP */}
                <line x1="370" y1="106" x2="295" y2="148" stroke="#f59e0b" strokeWidth="2" className="animated-link" />
                {/* Upper Center NH3+ to Right TPP */}
                <line x1="390" y1="106" x2="465" y2="148" stroke="#f59e0b" strokeWidth="2" className="animated-link" />
                {/* Upper Right NH3+ to Right TPP */}
                <line x1="555" y1="106" x2="515" y2="148" stroke="#f59e0b" strokeWidth="2" className="animated-link" />

                {/* Lower Left NH3+ to Left TPP */}
                <line x1="205" y1="210" x2="245" y2="172" stroke="#f59e0b" strokeWidth="2" className="animated-link" />
                {/* Lower Center NH3+ to Left TPP */}
                <line x1="370" y1="210" x2="295" y2="172" stroke="#f59e0b" strokeWidth="2" className="animated-link" />
                {/* Lower Center NH3+ to Right TPP */}
                <line x1="390" y1="210" x2="465" y2="172" stroke="#f59e0b" strokeWidth="2" className="animated-link" />
                {/* Lower Right NH3+ to Right TPP */}
                <line x1="555" y1="210" x2="515" y2="172" stroke="#f59e0b" strokeWidth="2" className="animated-link" />
              </g>
            )}

            {/* Stage Indicator Overlay */}
            <g transform="translate(60, 310)">
              <circle cx="0" cy="-3" r="5" fill="#064e3b" stroke="#34d399" strokeWidth="1" />
              <text x="10" y="1" fill="#94a3b8" fontSize="10">Protonated Site (–NH₃⁺)</text>

              <rect x="200" y="-8" width="12" height="10" rx="3" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
              <text x="219" y="1" fill="#94a3b8" fontSize="10">Tripolyphosphate (TPP⁵⁻)</text>

              <line x1="375" y1="-3" x2="400" y2="-3" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />
              <text x="408" y="1" fill="#94a3b8" fontSize="10">
                {stage === "components" ? "Separated State" : "Ionic Connection: –NH₃⁺ ··· TPP ··· –NH₃⁺"}
              </text>

              <text x="630" y="1" fill="#34d399" fontSize="10" fontWeight="600">
                {stage === "nanoparticle" ? "✓ Crosslinked Matrix" : "→ Phase Gelation"}
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* 3. 4 Interaction Stages (Requirement 3) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Interaction Stages & Formation Sequence
          </span>
          <span className="text-[10.5px] text-slate-500">
            Electrostatic Self-Assembly Mechanism
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Stage 01 */}
          <div
            onClick={() => setStage("components")}
            className={`cursor-pointer rounded-lg border p-3 transition-colors ${
              stage === "components"
                ? "border-emerald-500/50 bg-emerald-950/30"
                : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-400 font-mono">01</span>
              <span className="text-[10px] uppercase font-semibold text-slate-500">Preparation</span>
            </div>
            <h4 className="text-xs font-semibold text-slate-200">Chitosan Protonation</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              Chitosan amino groups become positively charged (<code className="text-emerald-400 font-mono">–NH₃⁺</code>) under the recorded acidic formulation conditions.
            </p>
          </div>

          {/* Stage 02 */}
          <div
            onClick={() => setStage("components")}
            className={`cursor-pointer rounded-lg border p-3 transition-colors ${
              stage === "components"
                ? "border-amber-500/50 bg-amber-950/30"
                : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-400 font-mono">02</span>
              <span className="text-[10px] uppercase font-semibold text-slate-500">Addition</span>
            </div>
            <h4 className="text-xs font-semibold text-slate-200">TPP Introduction</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              Negatively charged TPP (<code className="text-amber-400 font-mono">P₃O₁₀⁵⁻</code>) is introduced dropwise into the Chitosan solution under stirring.
            </p>
          </div>

          {/* Stage 03 */}
          <div
            onClick={() => setStage("crosslinking")}
            className={`cursor-pointer rounded-lg border p-3 transition-colors ${
              stage === "crosslinking"
                ? "border-emerald-500/50 bg-emerald-950/30"
                : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-400 font-mono">03</span>
              <span className="text-[10px] uppercase font-semibold text-emerald-400">Interaction</span>
            </div>
            <h4 className="text-xs font-semibold text-slate-200">Ionic Crosslinking</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              Electrostatic interactions form between protonated Chitosan sites and TPP phosphate groups: <code className="text-emerald-300 font-mono">–NH₃⁺ ··· TPP ··· –NH₃⁺</code>.
            </p>
          </div>

          {/* Stage 04 */}
          <div
            onClick={() => setStage("nanoparticle")}
            className={`cursor-pointer rounded-lg border p-3 transition-colors ${
              stage === "nanoparticle"
                ? "border-sky-500/50 bg-sky-950/30"
                : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-sky-400 font-mono">04</span>
              <span className="text-[10px] uppercase font-semibold text-sky-400">Colloid</span>
            </div>
            <h4 className="text-xs font-semibold text-slate-200">Nanoparticle Formation</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              The crosslinked polymer network collapses into the stabilized Chitosan–TPP colloidal nanoparticle system.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Current Study Formulation Connection (Requirement 4) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Current Study Formulation Record
          </span>
          <span className="text-[10.5px] text-slate-500">
            Values loaded from active database record
          </span>
        </div>

        {/* Process Flow linked with actual recorded values */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs pt-1">
          {/* Chitosan */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 flex-1 w-full sm:w-auto">
            <span className="text-[10.5px] text-emerald-400 font-semibold uppercase block">Chitosan Carrier</span>
            <p className="text-sm font-semibold text-slate-200 font-mono mt-0.5">
              {record?.chitosanConcentration ? `${record.chitosanConcentration} ${record.chitosanConcentrationUnit || "mg/mL"}` : notRecorded}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              pH: {record?.chitosanPh || notRecorded}
            </p>
          </div>

          <span className="text-slate-500 font-bold hidden sm:inline">+</span>

          {/* TPP */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 flex-1 w-full sm:w-auto">
            <span className="text-[10.5px] text-amber-400 font-semibold uppercase block">TPP Crosslinker</span>
            <p className="text-sm font-semibold text-slate-200 font-mono mt-0.5">
              {record?.tppConcentration ? `${record.tppConcentration} ${record.tppConcentrationUnit || "mg/mL"}` : notRecorded}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              pH: {record?.tppPh || notRecorded}
            </p>
          </div>

          <span className="text-slate-500 font-bold hidden sm:inline">→</span>

          {/* Ratio & Condition */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3.5 flex-1 w-full sm:w-auto">
            <span className="text-[10.5px] text-sky-400 font-semibold uppercase block">Formulation Ratio</span>
            <p className="text-sm font-semibold text-slate-200 font-mono mt-0.5">
              {record?.chitosanTppRatio ? `Ratio ${record.chitosanTppRatio}` : notRecorded}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {[record?.stirringRate, record?.stirringDuration].filter(Boolean).join(" · ") || notRecorded}
            </p>
          </div>

          <span className="text-slate-500 font-bold hidden sm:inline">→</span>

          {/* Result System */}
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 p-3.5 flex-1 w-full sm:w-auto">
            <span className="text-[10.5px] text-emerald-400 font-semibold uppercase block">Formed System</span>
            <p className="text-sm font-semibold text-emerald-200 mt-0.5">
              Chitosan–TPP Nanoparticle
            </p>
            <p className="text-xs text-emerald-400/80 mt-0.5">
              Ionic Gelation Matrix
            </p>
          </div>
        </div>
      </div>

      {/* 5. Computational Interaction Model (Requirements 8 & 10) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-400" />
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Computational Interaction Model
            </h3>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
            NOT YET CONFIGURED
          </span>
        </div>

        {/* Professional Research Language (Requirement 8) */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300 leading-relaxed space-y-2">
          <p className="font-medium text-slate-200">
            A validated computational polymer-modeling engine has not yet been connected to NANO-HEPATOTEA.
          </p>
          <p className="text-slate-400">
            Chitosan–TPP formation involves polymer self-assembly and ionic crosslinking rather than conventional ligand–protein docking. The interaction visualization above is an explanatory schematic model of the recorded formulation protocol.
          </p>
          <p className="text-slate-500 font-mono text-[11.5px] pt-1">
            No computational interaction result is currently available.
          </p>
        </div>

        {/* Future Pipeline (Requirement 10) */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
              Future Modeling Pipeline
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
              PLANNED COMPUTATIONAL CAPABILITY
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="w-full sm:w-auto rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-center flex-1">
              <span className="text-slate-300 font-medium">Chitosan + TPP Structure</span>
            </div>
            <span className="text-slate-500 hidden sm:inline">→</span>
            <div className="w-full sm:w-auto rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-center flex-1">
              <span className="text-slate-300 font-medium">Protonation Preparation</span>
            </div>
            <span className="text-slate-500 hidden sm:inline">→</span>
            <div className="w-full sm:w-auto rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-center flex-1">
              <span className="text-slate-300 font-medium">Polymer Dynamics / MD</span>
            </div>
            <span className="text-slate-500 hidden sm:inline">→</span>
            <div className="w-full sm:w-auto rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-center flex-1">
              <span className="text-slate-300 font-medium">Assembly Analysis</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

