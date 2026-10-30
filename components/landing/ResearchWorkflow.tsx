import {
  Activity,
  Atom,
  BarChart3,
  ClipboardList,
  FlaskConical,
  GitBranch,
  ScanSearch,
} from "lucide-react"
import { WORKFLOW } from "@/components/landing/content"
import { Reveal } from "@/components/landing/Reveal"

const STEP_ICONS = [
  ClipboardList,
  ScanSearch,
  Atom,
  Activity,
  FlaskConical,
  BarChart3,
]

export function ResearchWorkflow() {
  return (
    <section className="lp-section lp-band relative py-16 sm:py-24" id="workflow" aria-labelledby="workflow-title">
      <div className="lp-wrap space-y-8">
        <header className="lp-section-head space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-badge-border)] bg-[var(--lp-badge-bg)] px-3.5 py-1 text-xs font-semibold text-[var(--lp-badge-text)]">
            <GitBranch size={14} className="text-emerald-500" />
            <span>02 / Research workflow</span>
          </div>
          <h2 id="workflow-title" className="text-3xl sm:text-4xl font-extrabold text-[var(--lp-heading)] tracking-tight">
            One study, followed from selection to interpretation.
          </h2>
          <p className="text-[var(--lp-muted)] text-sm sm:text-base max-w-2xl">
            A continuous, evidence-backed pipeline maintaining end-to-end scientific provenance across
            computational simulations and wet-lab observations.
          </p>
        </header>

        <Reveal>
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
            {WORKFLOW.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? ClipboardList
              return (
                <li
                  key={step.n}
                  className="group relative rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-surface-card)] p-6 backdrop-blur-xl shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--lp-border-hover)] hover:bg-[var(--lp-surface-card-hover)] hover:shadow-2xl flex flex-col justify-between"
                >
                  {/* Top Edge Specular Glow */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden
                  />

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 transition-all duration-200 group-hover:bg-emerald-500 group-hover:text-white group-hover:scale-105">
                        <Icon size={20} strokeWidth={1.8} aria-hidden />
                      </span>
                      <span className="font-mono text-xs font-bold tracking-widest text-emerald-500">
                        STEP {step.n}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[var(--lp-heading)] transition-colors duration-200 group-hover:text-[var(--lp-green)]">
                      {step.title}
                    </h3>

                    <p className="mt-2 text-xs sm:text-sm text-[var(--lp-muted)] leading-relaxed">
                      {step.text}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--lp-line)] flex items-center justify-between text-[11px] text-[var(--lp-subtle)]">
                    <span>Stage {index + 1} of 6</span>
                    <span className="text-[var(--lp-green)] font-medium">Traceable Provenance</span>
                  </div>
                </li>
              )
            })}
          </ol>
        </Reveal>

      </div>
    </section>
  )
}
