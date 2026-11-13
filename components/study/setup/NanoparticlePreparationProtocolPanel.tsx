"use client"

import type { ReactNode } from "react"

/** Read-only Chitosan–TPP preparation protocol reference (not a checklist or editor). */
export function NanoparticlePreparationProtocolPanel() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Preparation Protocol</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Reference procedure for the Chitosan–TPP nanoparticle preparation. Values shown are protocol defaults.
        </p>
      </div>

      <div className="space-y-3 text-xs leading-relaxed text-slate-300">
        <ProtocolBlock title="Stabilization of nanoparticle suspension">
          After completing TPP addition, reduce stirring speed to 200–300 RPM. Continue stirring for 30 minutes
          at room temperature. Observe the resulting suspension for visible aggregation or precipitation.
        </ProtocolBlock>

        <ProtocolBlock title="Incorporation of maltodextrin">
          Add 7.00 g of maltodextrin powder directly into the nanoparticle suspension. Stir for 5–10 minutes or
          until uniformly dispersed.
        </ProtocolBlock>

        <ProtocolBlock title="Preparation of drying trays">
          Prepare 2–3 clean, flat baking trays or glass drying dishes. Line trays with suitable oven-compatible
          drying sheets. Distribute the suspension evenly across the trays to obtain a thin layer.
        </ProtocolBlock>

        <ProtocolBlock title="Oven drying">
          Preheat the oven to approximately 50°C. Spread the suspension into a thin layer and dry until a
          constant mass is achieved. Avoid temperatures exceeding 60°C unless thermal stability has been
          established.
        </ProtocolBlock>
      </div>
    </section>
  )
}

function ProtocolBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3.5 py-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-teal-400">{title}</h4>
      <p className="mt-1.5 text-slate-300">{children}</p>
    </div>
  )
}
