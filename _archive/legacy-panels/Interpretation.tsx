"use client"

import { Info, Database } from "lucide-react"

export function Interpretation({
  color,
  title,
  text,
  refs,
}: {
  color: string
  title: string
  text: string
  refs: string[]
}) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: color + "40" }}>
      <div className="flex items-start gap-3">
        <Info size={14} style={{ color, flexShrink: 0, marginTop: 2 }} />
        <div>
          <h4 className="text-sm font-semibold mb-1.5" style={{ color }}>{title}</h4>
          <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>{text}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {refs.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border"
                style={{ borderColor: "#dde5ef", color: "#546e8a" }}
              >
                <Database size={8} />
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
