"use client"

import { Inbox } from "lucide-react"

export function ResearchEmptyState({
  title,
  body,
  actionLabel,
  onAction,
  canEdit,
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
  canEdit: boolean
}) {
  return (
    <div
      className="rounded-xl border border-dashed px-6 py-12 text-center"
      style={{ background: "#ffffff", borderColor: "#cbd5e1" }}
    >
      <Inbox size={28} className="mx-auto mb-3" style={{ color: "#94a3b8" }} />
      <h3 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
        {title}
      </h3>
      <p className="text-sm mt-1 max-w-md mx-auto" style={{ color: "#546e8a" }}>
        {body}
      </p>
      {canEdit && onAction && actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "#00a882" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
