"use client"

import type { ReactNode } from "react"

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
}

export function MetaField({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === "") return null
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </div>
      <div className="text-sm mt-0.5 break-words" style={{ color: "var(--foreground)" }}>
        {value}
      </div>
    </div>
  )
}

export function FormField({
  label,
  required,
  children,
  hint,
}: {
  label: string
  required?: boolean
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block text-sm">
      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
        {label}
        {required ? " *" : ""}
      </span>
      <div className="mt-1">{children}</div>
      {hint && (
        <span className="block text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
          {hint}
        </span>
      )}
    </label>
  )
}

export const inputClass =
  "w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-1"
export const inputStyle = { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--foreground)" } as const
export const textareaClass = `${inputClass} min-h-[72px] resize-y`
