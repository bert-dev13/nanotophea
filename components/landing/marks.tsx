export function MoleculeMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 140" fill="none" aria-hidden="true">
      <circle cx="70" cy="28" r="8" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="32" cy="96" r="8" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="108" cy="96" r="8" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="70" cy="68" r="5.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M70 36v26M65 73 38 90M75 73l27 17" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

export function ProteinMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 120" fill="none" aria-hidden="true">
      <path d="M18 78c18-28 34-28 48-8s28 22 46 4 28-20 34-6" stroke="currentColor" strokeWidth="1.25" />
      <path d="M24 92c16-8 28-2 40 8s22 10 36 0 20-12 34-4" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="78" cy="46" r="5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="96" cy="58" r="3.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M82 49l10 7" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

export function LeafMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 40V18" stroke="currentColor" strokeWidth="1.25" />
      <path d="M24 32c-10-1-16-8-16-16 8 0 14 5 16 12 2-7 8-12 16-12 0 8-6 15-16 16Z" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

export function StructureMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 8 36 15v14L24 36 12 29V15L24 8Z" stroke="currentColor" strokeWidth="1.25" />
      <path d="M24 16 32 20.5v9L24 34l-8-4.5v-9L24 16Z" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

export function DockMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M8 30c6-10 10-10 14-2s8 8 12 2 6-6 8-2" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="30" cy="16" r="3" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="38" cy="22" r="2.2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M32.4 18.2 36.4 20.6" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

export function PlotMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M8 40V8M8 40h32" stroke="currentColor" strokeWidth="1.25" />
      <path d="M14 32c4-2 6-8 10-10s6 2 8-4 6-6 10-8" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

export function PlateMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="12" width="32" height="24" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="16" cy="20" r="2" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="24" cy="20" r="2" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="32" cy="20" r="2" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="16" cy="28" r="2" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="24" cy="28" r="2" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="32" cy="28" r="2" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}

export function ReportMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M14 8h14l8 8v24H14V8Z" stroke="currentColor" strokeWidth="1.25" />
      <path d="M28 8v8h8M18 24h12M18 30h8" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

export function ChartMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 92" fill="none" aria-hidden="true">
      <path d="M8 80V8M8 80h204" stroke="currentColor" strokeWidth="1" />
      <path d="M8 62h204M8 40h204M8 18h204" stroke="currentColor" strokeWidth="0.6" opacity="0.45" />
      <path d="M24 66l28-16 24 8 32-28 28 6 36-22" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="52" cy="50" r="2.2" fill="currentColor" />
      <circle cx="76" cy="58" r="2.2" fill="currentColor" />
      <circle cx="108" cy="30" r="2.2" fill="currentColor" />
      <circle cx="136" cy="36" r="2.2" fill="currentColor" />
      <circle cx="172" cy="14" r="2.2" fill="currentColor" />
    </svg>
  )
}
