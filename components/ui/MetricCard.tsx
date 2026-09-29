"use client"

import type { ElementType } from "react"

export function MetricCard({
  label,
  value,
  unit,
  sub,
  color = "#00d4aa",
  icon: Icon,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  color?: string
  icon?: ElementType
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1 border shadow-sm" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={14} style={{ color }} />}
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#546e8a" }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-sm font-medium" style={{ color: "#546e8a" }}>{unit}</span>}
      </div>
      {sub && <span className="text-xs" style={{ color: "#546e8a" }}>{sub}</span>}
    </div>
  )
}
