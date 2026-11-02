"use client"

import { useState } from "react"
import { Eye, ChevronDown, ChevronUp, Layers, Sparkles } from "lucide-react"

type ViewMode = "overview" | "chains" | "crosslinks" | "network"

export function NanoparticleSchematic() {
  const [mode, setMode] = useState<ViewMode>("overview")
  const [showLearnMore, setShowLearnMore] = useState(false)

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/85 p-5 shadow-sm">
      {/* Header & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-400">
              <Eye className="h-3 w-3" />
              SCHEMATIC · NOT A MOLECULAR SIMULATION
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Ionic Gelation Model
            </span>
          </div>
          <h3 className="mt-1.5 font-display text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            Chitosan–TPP Polymeric Crosslinking Network
          </h3>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/70 p-1">
          <button
            type="button"
            onClick={() => setMode("overview")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === "overview"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Full System
          </button>
          <button
            type="button"
            onClick={() => setMode("chains")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === "chains"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Chitosan Chains
          </button>
          <button
            type="button"
            onClick={() => setMode("crosslinks")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === "crosslinks"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            TPP Crosslinks
          </button>
          <button
            type="button"
            onClick={() => setMode("network")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === "network"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Assembled Network
          </button>
        </div>
      </div>

      {/* SVG Scientific Canvas - Visual Centerpiece */}
      <div className="relative mt-4 flex items-center justify-center overflow-hidden rounded-lg bg-slate-950/90 p-3 sm:p-5 border border-slate-800/80">
        <svg
          viewBox="0 0 760 320"
          className="w-full h-auto max-h-[320px] select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <style>{`
            @keyframes crosslinkFlow {
              0% { stroke-dashoffset: 24; }
              100% { stroke-dashoffset: 0; }
            }
            .animated-crosslink {
              stroke-dasharray: 4 3;
              animation: crosslinkFlow 2s linear infinite;
            }
            @keyframes tppPulse {
              0%, 100% { transform: scale(1); opacity: 0.95; }
              50% { transform: scale(1.05); opacity: 1; }
            }
            .tpp-center {
              transform-origin: center;
              animation: tppPulse 3s ease-in-out infinite;
            }
          `}</style>

          <defs>
            <linearGradient id="chitosanUpper" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.4" />
              <stop offset="30%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="70%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
            </linearGradient>

            <linearGradient id="chitosanLower" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#047857" stopOpacity="0.4" />
              <stop offset="30%" stopColor="#059669" stopOpacity="0.85" />
              <stop offset="70%" stopColor="#059669" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.4" />
            </linearGradient>

            <radialGradient id="nanosphereColloid" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
              <stop offset="65%" stopColor="#059669" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.0" />
            </radialGradient>
          </defs>

          {/* Nanoparticle Assembled Colloid Boundary (visible in overview and network mode) */}
          {(mode === "overview" || mode === "network") && (
            <g transform="translate(380, 155)">
              <circle cx="0" cy="0" r="145" fill="url(#nanosphereColloid)" stroke="#10b981" strokeWidth="1" strokeDasharray="5 4" opacity="0.65" />
              <text x="110" y="-120" fill="#34d399" fontSize="10.5" fontWeight="600" opacity="0.85">
                Nanoparticle Matrix
              </text>
            </g>
          )}

          {/* ========================================================= */}
          {/* 1. UPPER CHITOSAN POLYMER CHAIN                          */}
          {/* ========================================================= */}
          {(mode === "overview" || mode === "chains" || mode === "network") && (
            <g id="upper-chitosan-chain">
              {/* Polymer backbone */}
              <path
                d="M 50 65 Q 160 45, 270 65 T 490 65 T 710 65"
                fill="none"
                stroke="url(#chitosanUpper)"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <text x="60" y="45" fill="#a7f3d0" fontSize="11" fontWeight="bold">
                Chitosan polymer chain (Polycation)
              </text>

              {/* Upper NH3+ functional sites */}
              {/* Site 1 */}
              <g transform="translate(190, 60)">
                <line x1="0" y1="5" x2="0" y2="30" stroke="#10b981" strokeWidth="2" />
                <circle cx="0" cy="36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="40" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>

              {/* Site 2 */}
              <g transform="translate(380, 60)">
                <line x1="0" y1="5" x2="0" y2="30" stroke="#10b981" strokeWidth="2" />
                <circle cx="0" cy="36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="40" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>

              {/* Site 3 */}
              <g transform="translate(570, 60)">
                <line x1="0" y1="5" x2="0" y2="30" stroke="#10b981" strokeWidth="2" />
                <circle cx="0" cy="36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="40" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>
            </g>
          )}

          {/* ========================================================= */}
          {/* 2. CENTRAL TPP CROSS-LINKING PHOSPHATE CORE               */}
          {/* ========================================================= */}
          {(mode === "overview" || mode === "crosslinks" || mode === "network") && (
            <g id="tpp-polyphosphate-core">
              {/* TPP Node Left */}
              <g transform="translate(260, 155)">
                <rect x="-42" y="-18" width="84" height="36" rx="10" fill="#78350f" stroke="#f59e0b" strokeWidth="2" className="tpp-center" />
                <text x="0" y="-2" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="bold">
                  TPP⁵⁻
                </text>
                <text x="0" y="11" textAnchor="middle" fill="#fde68a" fontSize="8.5" fontFamily="monospace">
                  P₃O₁₀⁵⁻
                </text>
              </g>

              {/* TPP Node Center-Right */}
              <g transform="translate(500, 155)">
                <rect x="-42" y="-18" width="84" height="36" rx="10" fill="#78350f" stroke="#f59e0b" strokeWidth="2" className="tpp-center" />
                <text x="0" y="-2" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="bold">
                  TPP⁵⁻
                </text>
                <text x="0" y="11" textAnchor="middle" fill="#fde68a" fontSize="8.5" fontFamily="monospace">
                  P₃O₁₀⁵⁻
                </text>
              </g>

              {/* TPP Label */}
              <text x="380" y="145" textAnchor="middle" fill="#fcd34d" fontSize="11" fontWeight="600">
                TPP phosphate groups
              </text>
              <text x="380" y="165" textAnchor="middle" fill="#fbbf24" fontSize="9" opacity="0.9">
                Multivalent Crosslinker
              </text>
            </g>
          )}

          {/* ========================================================= */}
          {/* 3. LOWER CHITOSAN POLYMER CHAIN                           */}
          {/* ========================================================= */}
          {(mode === "overview" || mode === "chains" || mode === "network") && (
            <g id="lower-chitosan-chain">
              {/* Lower polymer backbone */}
              <path
                d="M 50 245 Q 160 265, 270 245 T 490 245 T 710 245"
                fill="none"
                stroke="url(#chitosanLower)"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <text x="60" y="275" fill="#a7f3d0" fontSize="11" fontWeight="bold">
                Chitosan polymer chain (Polycation)
              </text>

              {/* Lower NH3+ functional sites */}
              {/* Site 1 */}
              <g transform="translate(190, 245)">
                <line x1="0" y1="-5" x2="0" y2="-30" stroke="#059669" strokeWidth="2" />
                <circle cx="0" cy="-36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="-32" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>

              {/* Site 2 */}
              <g transform="translate(380, 245)">
                <line x1="0" y1="-5" x2="0" y2="-30" stroke="#059669" strokeWidth="2" />
                <circle cx="0" cy="-36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="-32" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>

              {/* Site 3 */}
              <g transform="translate(570, 245)">
                <line x1="0" y1="-5" x2="0" y2="-30" stroke="#059669" strokeWidth="2" />
                <circle cx="0" cy="-36" r="14" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
                <text x="0" y="-32" textAnchor="middle" fill="#d1fae5" fontSize="10" fontWeight="bold">
                  NH₃⁺
                </text>
              </g>
            </g>
          )}

          {/* ========================================================= */}
          {/* 4. DYNAMIC IONIC CROSSLINK VECTORS (ELECTROSTATIC BONDS)   */}
          {/* ========================================================= */}
          {(mode === "overview" || mode === "crosslinks" || mode === "network") && (
            <g id="ionic-crosslink-vectors">
              {/* Upper NH3+(190,96) <--> TPP Left(260,155) */}
              <line x1="198" y1="106" x2="240" y2="142" stroke="#f59e0b" strokeWidth="2" className="animated-crosslink" />

              {/* Upper NH3+(380,96) <--> TPP Left(260,155) */}
              <line x1="368" y1="106" x2="280" y2="142" stroke="#f59e0b" strokeWidth="2" className="animated-crosslink" />

              {/* Upper NH3+(380,96) <--> TPP Right(500,155) */}
              <line x1="392" y1="106" x2="480" y2="142" stroke="#f59e0b" strokeWidth="2" className="animated-crosslink" />

              {/* Upper NH3+(570,96) <--> TPP Right(500,155) */}
              <line x1="560" y1="106" x2="520" y2="142" stroke="#f59e0b" strokeWidth="2" className="animated-crosslink" />

              {/* Lower NH3+(190,209) <--> TPP Left(260,155) */}
              <line x1="198" y1="199" x2="240" y2="168" stroke="#f59e0b" strokeWidth="2" className="animated-crosslink" />

              {/* Lower NH3+(380,209) <--> TPP Left(260,155) */}
              <line x1="368" y1="199" x2="280" y2="168" stroke="#f59e0b" strokeWidth="2" className="animated-crosslink" />

              {/* Lower NH3+(380,209) <--> TPP Right(500,155) */}
              <line x1="392" y1="199" x2="480" y2="168" stroke="#f59e0b" strokeWidth="2" className="animated-crosslink" />

              {/* Lower NH3+(570,209) <--> TPP Right(500,155) */}
              <line x1="560" y1="199" x2="520" y2="168" stroke="#f59e0b" strokeWidth="2" className="animated-crosslink" />
            </g>
          )}

          {/* ========================================================= */}
          {/* 5. LEGEND & ANNOTATIONS                                   */}
          {/* ========================================================= */}
          <g transform="translate(60, 305)">
            <circle cx="0" cy="-3" r="5" fill="#064e3b" stroke="#34d399" strokeWidth="1" />
            <text x="10" y="1" fill="#94a3b8" fontSize="10">Chitosan Protonated Amine (–NH₃⁺)</text>

            <rect x="235" y="-8" width="12" height="10" rx="3" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
            <text x="254" y="1" fill="#94a3b8" fontSize="10">Tripolyphosphate (TPP⁵⁻)</text>

            <line x1="410" y1="-3" x2="435" y2="-3" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />
            <text x="444" y="1" fill="#94a3b8" fontSize="10">Ionic Crosslink (Electrostatic attraction)</text>

            <text x="630" y="1" fill="#34d399" fontSize="10" fontWeight="600">→ Crosslinked network</text>
          </g>
        </svg>
      </div>

      {/* Mechanism Text (Concise Requirement 7) */}
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3.5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
              How it forms
            </h4>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-3xl">
              Under acidic conditions, chitosan amino groups become positively charged. Negatively charged TPP interacts with these sites, producing ionic crosslinks that promote nanoparticle formation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLearnMore(!showLearnMore)}
            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {showLearnMore ? (
              <>
                Less <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Learn More <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Collapsible Scientific Details */}
        {showLearnMore && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-2 leading-relaxed animate-in fade-in duration-200">
            <p>
              <strong className="text-slate-300">Protonation & Charge Density:</strong> The primary amino groups (<code className="text-emerald-400 font-mono">–NH₂</code>) along the glucosamine units of chitosan exhibit an intrinsic <span className="font-mono">pKa ≈ 6.5</span>. In slightly acidic aqueous solutions (pH 4.5–5.5, typically solubilized with 1% acetic acid), protonation yields polycationic ammonium chains (<code className="text-emerald-400 font-mono">–NH₃⁺</code>).
            </p>
            <p>
              <strong className="text-slate-300">Ionic Gelation & Phase Separation:</strong> Sodium tripolyphosphate (TPP, <span className="font-mono">Na₅P₃O₁₀</span>) completely dissociates into penta-anions (<code className="text-amber-400 font-mono">P₃O₁₀⁵⁻</code>). Dropwise addition under controlled stirring introduces multivalent counter-ions that bridge inter- and intra-molecular chitosan chains simultaneously. This electrostatic neutralization induces local hydrophobic collapse and spontaneous self-assembly into colloidal nanospheres with a hydrophilic chitosan shell.
            </p>
            <p>
              <strong className="text-slate-300">Bioactive Entrapment Mechanism:</strong> When plant tea extract containing polyphenolic flavonoids (such as quercetin) is present during crosslinking, the bioactives are passively entrapped within the hydrophobic polymer interstitial spaces and stabilized against premature hydrolytic or oxidative degradation.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
