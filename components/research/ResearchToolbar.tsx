"use client"

import type { ReactNode } from "react"
import { Plus, Search } from "lucide-react"
import { researchRoleLabel } from "@/lib/permissions/researchAccess"
import type { StudyRole } from "@/lib/domain/models"

interface ResearchToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  filterSlot?: ReactNode
  canEdit: boolean
  role: StudyRole | null | undefined
  onAdd?: () => void
  addLabel?: string
  count?: number
}

export function ResearchToolbar({
  search,
  onSearchChange,
  filterSlot,
  canEdit,
  role,
  onAdd,
  addLabel = "Add record",
  count,
}: ResearchToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap gap-2 items-center">
        <div
          className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 flex-1 min-w-[180px] max-w-md"
          style={{ background: "#ffffff", borderColor: "#dde5ef" }}
        >
          <Search size={14} style={{ color: "#94a3b8" }} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search records…"
            className="w-full text-sm outline-none bg-transparent"
            style={{ color: "#0d1f3c" }}
          />
        </div>
        {filterSlot}
        {typeof count === "number" && (
          <span className="text-[11px] font-mono" style={{ color: "#94a3b8" }}>
            {count} record{count === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
          {researchRoleLabel(role)}
        </span>
        {canEdit && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: "#00a882" }}
          >
            <Plus size={14} />
            {addLabel}
          </button>
        )}
      </div>
    </div>
  )
}
