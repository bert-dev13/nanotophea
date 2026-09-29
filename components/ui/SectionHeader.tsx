"use client"

import type { ElementType } from "react"

export function SectionHeader({
  icon: Icon,
  title,
  color,
  badge,
}: {
  icon: ElementType
  title: string
  color: string
  badge?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2.5 rounded-xl" style={{ background: color + "18" }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <h2 className="text-xl font-bold" style={{ color: "#0d1f3c" }}>{title}</h2>
        {badge && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: color + "18", color }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}
