"use client"

export interface ConfirmDeleteDialogProps {
  open: boolean
  title: string
  message: string
  onConfirmAction?: () => void
  onCancelAction?: () => void
  onConfirm?: () => void
  onCancel?: () => void
  busy?: boolean
}

export function ConfirmDeleteDialog({
  open,
  title,
  message,
  onConfirmAction,
  onCancelAction,
  onConfirm,
  onCancel,
  busy,
}: ConfirmDeleteDialogProps) {
  const handleConfirm = onConfirmAction ?? onConfirm ?? (() => {})
  const handleCancel = onCancelAction ?? onCancel ?? (() => {})
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(5, 11, 20, 0.75)", backdropFilter: "blur(8px)" }}>
      <div
        className="w-full max-w-sm rounded-xl border p-5 shadow-2xl backdrop-blur-md"
        style={{
          background: "linear-gradient(180deg, rgba(15, 25, 42, 0.95) 0%, rgba(10, 18, 30, 0.98) 100%)",
          borderColor: "rgba(255, 255, 255, 0.12)",
        }}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-sm font-bold" style={{ color: "#f8fafc" }}>
          {title}
        </h3>
        <p className="text-sm mt-2" style={{ color: "#cbd5e1" }}>
          {message}
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-colors"
            style={{
              borderColor: "rgba(255, 255, 255, 0.15)",
              background: "rgba(255, 255, 255, 0.06)",
              color: "#cbd5e1",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity"
            style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)" }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  )
}
