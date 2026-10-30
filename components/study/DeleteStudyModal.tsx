"use client"

import { useEffect, useId, useRef, useState } from "react"
import { AlertTriangle, Loader2, X } from "lucide-react"
import type { Study } from "@/lib/domain/models"

interface DeleteStudyModalProps {
  study: Study | null
  open: boolean
  onClose: () => void
  onConfirmDelete: (studyId: string) => Promise<void>
}

export function DeleteStudyModal({
  study,
  open,
  onClose,
  onConfirmDelete,
}: DeleteStudyModalProps) {
  const [confirmText, setConfirmText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setConfirmText("")
      setError(null)
      setBusy(false)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open, study])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, busy, onClose])

  if (!open || !study) return null

  const isMatch = confirmText.trim() === study.title.trim()

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isMatch || busy) return

    setBusy(true)
    setError(null)

    try {
      await onConfirmDelete(study.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this investigation. Please try again.")
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "var(--modal-backdrop)",
        backdropFilter: "blur(8px)",
      }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--modal-border)] bg-[var(--modal-bg)] p-6 shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={20} strokeWidth={2.2} />
            </span>
            <div>
              <h2 id={titleId} className="text-base sm:text-lg font-bold text-[var(--foreground)] font-display">
                Delete Investigation?
              </h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Permanent deletion of study and associated research records
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Warning Body */}
        <div className="mt-4 space-y-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
          <p>
            You are about to permanently delete:
          </p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
            <p className="text-sm font-bold text-[var(--foreground)] truncate font-display">
              "{study.title}"
            </p>
            {study.shortTitle ? (
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                Short title: {study.shortTitle}
              </p>
            ) : null}
          </div>
          <p>
            This will remove the investigation and its associated research records, including computational results,
            docking records, predictions, laboratory data, and analysis records.
          </p>
          <p className="font-semibold text-rose-600 dark:text-rose-400">
            This action cannot be undone.
          </p>
        </div>

        {/* Explicit Confirmation Input Form */}
        <form onSubmit={handleDelete} className="mt-4 pt-3 border-t border-[var(--border)]">
          <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
            Type <span className="font-bold select-all text-emerald-600 dark:text-emerald-400 font-mono">{study.title}</span> to confirm:
          </label>
          <input
            ref={inputRef}
            type="text"
            className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3.5 py-2.5 text-xs text-[var(--foreground)] outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all font-mono"
            placeholder={study.title}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
          />

          {error ? (
            <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          ) : null}

          {/* Action Buttons */}
          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-colors"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isMatch || busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-600/40 bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-500 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-600 transition-all"
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Investigation</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
