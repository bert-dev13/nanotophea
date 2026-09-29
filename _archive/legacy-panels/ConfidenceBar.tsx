"use client"

export function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 90 ? "#00d4aa" : value >= 80 ? "#4fc3f7" : "#fb923c"
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "#dde5ef" }}>
        <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-10 text-right" style={{ color }}>{value}%</span>
    </div>
  )
}
