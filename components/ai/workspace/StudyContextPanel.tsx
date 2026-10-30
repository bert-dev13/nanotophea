"use client"

import { Dna, FlaskConical, Microscope, PanelRightClose } from "lucide-react"
import { ExperimentalCoverage } from "@/components/ai/workspace/ExperimentalCoverage"
import { StudyEvidenceProgress } from "@/components/ai/workspace/StudyEvidenceProgress"
import type { StudyReadiness } from "@/lib/workflow/studyFlow"

export function StudyContextPanel({
  title,
  compounds,
  proteins,
  cellLines,
  tested,
  endpoints,
  readiness,
  onHide,
  open,
}: {
  title: string
  compounds: string[]
  proteins: string[]
  cellLines: string[]
  tested: number | null
  endpoints: Array<{ id: string; label: string; recorded: boolean }>
  readiness: StudyReadiness | null
  onHide: () => void
  open: boolean
}) {
  return (
    <aside className="ai-context" aria-label="Study context" aria-hidden={!open} inert={!open}>
      <div className="ai-context-inner">
        <header>
          <div>
            <p>Study context</p>
            <h2>{title}</h2>
            <span>Active study</span>
          </div>
          <button type="button" aria-label="Hide study context" onClick={onHide}>
            <PanelRightClose size={16} aria-hidden />
          </button>
        </header>
        <section className="ai-entities">
          <h3>Research entities</h3>
          <Entity icon={<FlaskConical size={14} aria-hidden />} label="Phytochemical" values={compounds} />
          <Entity icon={<Dna size={14} aria-hidden />} label="Target proteins" values={proteins} />
          <Entity icon={<Microscope size={14} aria-hidden />} label="Cell line" values={cellLines} />
        </section>
        <StudyEvidenceProgress readiness={readiness} tested={tested} />
        <ExperimentalCoverage tested={tested} endpoints={endpoints} />
      </div>
    </aside>
  )
}

function Entity({
  icon,
  label,
  values,
}: {
  icon: React.ReactNode
  label: string
  values: string[]
}) {
  return (
    <div>
      {icon}
      <div>
        <p>{label}</p>
        {values.length === 0 ? <strong>None recorded</strong> : values.map((value) => <strong key={value}>{value}</strong>)}
      </div>
    </div>
  )
}
