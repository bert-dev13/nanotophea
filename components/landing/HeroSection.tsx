import { Activity, ArrowRight, Atom, FlaskConical, ShieldCheck } from "lucide-react"
import { BrandLogo } from "@/components/brand/BrandLogo"
import { EnterLink } from "@/components/landing/EnterLink"

const EVIDENCE_TAGS = [
  "REFERENCE",
  "LITERATURE",
  "PREDICTED",
  "EXPERIMENTAL",
  "INTERPRETATION",
]

export function HeroSection() {
  return (
    <section className="lp-hero relative py-12 sm:py-20 lg:py-24" aria-labelledby="hero-title">
      <div className="lp-wrap lp-hero-grid">
        <div className="lp-hero-copy space-y-6">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--lp-badge-border)] bg-[var(--lp-badge-bg)] px-3.5 py-1.5 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--lp-badge-text)]">
              HEPATOTEA Research Platform
            </span>
          </div>

          <h1
            id="hero-title"
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--lp-heading)] leading-[1.08] font-display"
          >
            From Natural Compounds to{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Experimental Evidence
            </span>
          </h1>

          <p className="lp-lead text-sm sm:text-base text-[var(--lp-copy)] leading-relaxed max-w-2xl">
            An integrated research platform for the computational and experimental assessment of{" "}
            <em className="text-[var(--lp-green)] not-italic font-semibold">
              Phyllanthus niruri (Sampasampalukan)
            </em>
            , connecting phytochemical screening, molecular docking, biological predictions,
            laboratory validation, and scientific interpretation.
          </p>

          <div className="lp-actions flex flex-wrap gap-3.5 pt-1">
            <EnterLink>
              <span>Open Research Platform</span>
              <ArrowRight size={16} aria-hidden />
            </EnterLink>
            <a className="lp-btn lp-btn--secondary" href="#workflow">
              Explore Workflow
            </a>
          </div>

          {/* Evidence Lifecycle Strip */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] font-mono tracking-wider text-[var(--lp-muted)] uppercase">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            {EVIDENCE_TAGS.map((tag, idx) => (
              <span key={tag} className="inline-flex items-center gap-2">
                <span
                  className={
                    tag === "PREDICTED"
                      ? "text-emerald-500 font-semibold"
                      : tag === "EXPERIMENTAL"
                      ? "text-teal-500 font-semibold"
                      : "text-[var(--lp-copy)]"
                  }
                >
                  {tag}
                </span>
                {idx < EVIDENCE_TAGS.length - 1 ? <span className="text-[var(--lp-subtle)]">·</span> : null}
              </span>
            ))}
          </div>
        </div>

        {/* Hero Visual Showcase */}
        <div className="lp-hero-logo relative flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Glowing Halo Backplate */}
            <div className="login-pulse-ring absolute -inset-6 rounded-full bg-emerald-500/20 blur-2xl" />

            <div className="relative rounded-3xl border border-[var(--lp-badge-border)] bg-[var(--lp-surface-card)] p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
              <img
                src="/nano-logo.png"
                alt="HEPATOTEA — Natural Products Research Platform"
                width={420}
                height={420}
                decoding="async"
                className="w-48 sm:w-64 h-auto drop-shadow-[0_10px_25px_rgba(0,0,0,0.15)]"
              />
            </div>
          </div>

          {/* Three Floating Telemetry Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-lg mt-6">
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--lp-chip-border)] bg-[var(--lp-chip-bg)] px-3.5 py-2.5 backdrop-blur-md shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 shrink-0">
                <Atom size={16} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[var(--lp-chip-title)] truncate">AutoDock Vina</p>
                <p className="text-[10px] text-emerald-500 font-mono">-9.4 kcal/mol</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--lp-chip-border)] bg-[var(--lp-chip-bg)] px-3.5 py-2.5 backdrop-blur-md shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/15 text-teal-500 shrink-0">
                <Activity size={16} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[var(--lp-chip-title)] truncate">Biological ADMET</p>
                <p className="text-[10px] text-teal-500 font-mono">28 Biomarkers</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--lp-chip-border)] bg-[var(--lp-chip-bg)] px-3.5 py-2.5 backdrop-blur-md shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-500 shrink-0">
                <FlaskConical size={16} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[var(--lp-chip-title)] truncate">Lab Validation</p>
                <p className="text-[10px] text-cyan-500 font-mono">TEM · MTT</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

  )
}
