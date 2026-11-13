"use client"

import { AlertCircle } from "lucide-react"
import { NanoparticleSchematic } from "@/components/study/setup/NanoparticleSchematic"
import type { NanoparticleFormulation } from "@/lib/domain/models"

interface ChitosanTppInteractionSectionProps {
  record?: NanoparticleFormulation | null
}

/** 2D ionic-gelation schematic — not a molecular dynamics simulation. */
export function ChitosanTppInteractionSection(_props: ChitosanTppInteractionSectionProps) {
  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Chitosan–TPP Interaction</h3>
          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            2D schematic
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-center text-xs">
          <div className="min-w-[6.5rem] rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">Chitosan</p>
            <p className="mt-0.5 font-mono text-slate-200">–NH₃⁺</p>
          </div>
          <span className="text-slate-500 font-semibold" aria-hidden>
            +
          </span>
          <div className="min-w-[6.5rem] rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">TPP</p>
            <p className="mt-0.5 font-mono text-slate-200">P₃O₁₀⁵⁻</p>
          </div>
          <span className="text-slate-500 font-semibold" aria-hidden>
            →
          </span>
          <div className="min-w-[7.5rem] rounded-lg border border-sky-500/30 bg-sky-950/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">Ionic crosslinking</p>
            <p className="mt-0.5 text-slate-200">Electrostatic gelation</p>
          </div>
          <span className="text-slate-500 font-semibold" aria-hidden>
            →
          </span>
          <div className="min-w-[8rem] rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Product</p>
            <p className="mt-0.5 font-medium text-emerald-100">Chitosan–TPP nanoparticle</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
          <p>
            This is a schematic representation of ionic gelation, not a molecular dynamics simulation.
          </p>
        </div>
      </div>

      <NanoparticleSchematic />
    </section>
  )
}
