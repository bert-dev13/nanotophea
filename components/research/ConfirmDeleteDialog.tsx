"use client"

export function ConfirmDeleteDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#0d1f3c66" }}>
      <div
        className="w-full max-w-sm rounded-xl border p-5 shadow-lg"
        style={{ background: "#ffffff", borderColor: "#dde5ef" }}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
          {title}
        </h3>
        <p className="text-sm mt-2" style={{ color: "#546e8a" }}>
          {message}
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold border"
            style={{ borderColor: "#dde5ef", color: "#546e8a" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: "#dc2626" }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}
