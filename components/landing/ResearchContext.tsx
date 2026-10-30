import Image from "next/image"
import { Activity, Dna, FlaskConical, Leaf } from "lucide-react"
import { Reveal } from "@/components/landing/Reveal"

const META = [
  {
    label: "Research focus",
    value: "Natural Products",
    desc: "Bioactive phytochemical screening",
    icon: Leaf,
    color: "text-emerald-400 bg-emerald-500/15",
  },
  {
    label: "Study context",
    value: "NanoHepatoTea",
    desc: "Targeted green nanomedicine formulation",
    icon: FlaskConical,
    color: "text-teal-400 bg-teal-500/15",
  },
  {
    label: "Experimental model",
    value: "HepG2 Cell Line",
    desc: "In vitro hepatocellular carcinoma validation",
    icon: Activity,
    color: "text-cyan-400 bg-cyan-500/15",
  },
]

export function ResearchContext() {
  return (
    <section className="lp-section lp-platform relative py-16 sm:py-24" id="platform" aria-labelledby="platform-title">
      <div className="lp-wrap lp-context">
        <Reveal>
          <div className="relative rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface-card)] p-2 shadow-xl backdrop-blur-xl">
            {/* Top Specular Edge Glow */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent"
              aria-hidden
            />
            <figure className="lp-context-figure rounded-xl overflow-hidden min-h-[22rem] sm:min-h-[28rem] relative">
              <Image
                src="/figure.png"
                alt="Phyllanthus niruri beside laboratory glassware, a molecular structure, and a HepG2 cell model"
                fill
                sizes="(min-width: 900px) 42vw, 100vw"
                className="object-cover object-[72%_center] transition-transform duration-500 hover:scale-105"
              />
            </figure>
          </div>
        </Reveal>

        <Reveal>
          <div className="lp-context-copy space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-badge-border)] bg-[var(--lp-badge-bg)] px-3.5 py-1 text-xs font-semibold text-[var(--lp-badge-text)]">
              <Dna size={14} className="text-emerald-500" />
              <span>01 / Research context</span>
            </div>

            <h2 id="platform-title" className="text-3xl sm:text-4xl font-extrabold text-[var(--lp-heading)] tracking-tight">
              <em>Phyllanthus niruri</em>
              <span className="lp-common text-[var(--lp-green)] font-medium text-lg block mt-1">
                Sampasampalukan
              </span>
            </h2>

            <p className="lp-lead text-[var(--lp-copy)] leading-relaxed">
              NANOTOPHEA supports the computational and experimental assessment of selected phytochemicals and
              their potential interactions with liver-cancer-related biological targets.
            </p>

            <p className="lp-note text-[var(--lp-muted)] leading-relaxed text-sm">
              The current research focus is NanoHepatoTea and the HepG2 cell line. Findings stay inside the study
              record, with each layer of evidence labeled across the full pipeline.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {META.map((row) => {
                const Icon = row.icon
                return (
                  <div
                    key={row.label}
                    className="rounded-xl border border-[var(--lp-chip-border)] bg-[var(--lp-chip-bg)] p-3.5 backdrop-blur-md shadow-sm transition-all duration-200 hover:border-[var(--lp-border-hover)] hover:bg-[var(--lp-surface-card-hover)]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${row.color}`}>
                        <Icon size={15} strokeWidth={2} />
                      </span>
                      <span className="text-[11px] text-[var(--lp-muted)]">{row.label}</span>
                    </div>
                    <p className="text-xs font-bold text-[var(--lp-chip-title)]">{row.value}</p>
                    <p className="text-[10.5px] text-[var(--lp-muted)] mt-1 leading-snug">{row.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </Reveal>

      </div>
    </section>
  )
}
