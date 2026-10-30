import { ArrowRight, Sparkles } from "lucide-react"
import { EnterLink } from "@/components/landing/EnterLink"

export function FinalCTA() {
  return (
    <section className="relative py-20 sm:py-28" aria-labelledby="close-title">
      <div className="lp-wrap">
        <div className="login-glass-card relative overflow-hidden rounded-3xl p-8 sm:p-14 text-center flex flex-col items-center">
          {/* Ambient Glow Center */}
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[24rem] w-[24rem] rounded-full bg-emerald-500/20 blur-[100px]"
            aria-hidden
          />

          {/* Top Edge Highlight */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
            aria-hidden
          />

          <div className="relative z-10 space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-badge-border)] bg-[var(--lp-badge-bg)] px-3.5 py-1 text-xs font-semibold text-[var(--lp-badge-text)]">
              <Sparkles size={14} className="text-emerald-500" />
              <span>Begin a study session</span>
            </div>

            <h2 id="close-title" className="text-3xl sm:text-5xl font-black text-[var(--lp-heading)] tracking-tight leading-tight font-display">
              Research with evidence{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                at every step.
              </span>
            </h2>

            <p className="text-sm sm:text-base text-[var(--lp-copy)] leading-relaxed">
              Move seamlessly from raw phytochemical screening to AutoDock Vina simulations, multi-organ
              ADMET evaluations, and empirical laboratory validation.
            </p>


            <div className="pt-4 flex flex-wrap items-center justify-center gap-3.5">
              <EnterLink>
                <span>Open NANOTOPHEA</span>
                <ArrowRight size={16} aria-hidden />
              </EnterLink>
              <EnterLink variant="secondary">
                <span>Researcher Sign In</span>
              </EnterLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
