"use client"

import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useStudy } from "@/components/providers/StudyProvider"
import type { Study } from "@/lib/domain/models"

export interface NewStudyModalProps {
  open: boolean
  onClose?: () => void
  onCloseAction?: () => void
  onCreated?: (study: Study) => void
  onCreatedAction?: (study: Study) => void
}

export function NewStudyModal({
  open,
  onClose,
  onCloseAction,
  onCreated,
  onCreatedAction,
}: NewStudyModalProps) {
  const handleClose = onCloseAction ?? onClose ?? (() => {})
  const handleCreated = onCreatedAction ?? onCreated
  const { createNewStudy } = useStudy()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(handleClose)
  const busyRef = useRef(false)
  const [title, setTitle] = useState("")
  const [shortTitle, setShortTitle] = useState("")
  const [description, setDescription] = useState("")
  const [fairYear, setFairYear] = useState("")
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  onCloseRef.current = handleClose
  busyRef.current = busy

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setTitle("")
    setShortTitle("")
    setDescription("")
    setFairYear("")
    setFormError(null)
    setBusy(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const node = dialogRef.current
    const previous = document.activeElement as HTMLElement | null
    node?.querySelector("input")?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab" || !node) return
      const items = [...node.querySelectorAll<HTMLElement>("button, input, textarea, select")].filter(
        (item) => !item.hasAttribute("disabled"),
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [open])

  if (!open || !mounted) return null

  const onCreate = async () => {
    const trimmed = title.trim()
    if (trimmed.length < 3) {
      setFormError("Enter a study title of at least 3 characters.")
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      const study = await createNewStudy({
        title: trimmed,
        ...(shortTitle.trim() ? { shortTitle: shortTitle.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(fairYear.trim() ? { fairYear: fairYear.trim() } : {}),
      })
      handleCreated?.(study)
      onCloseRef.current()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create the study")
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="nano-modal-back"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) handleClose()
      }}
    >
      <div
        ref={dialogRef}
        className="nano-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="nano-modal-head">
          <div>
            <h2 id={titleId} className="nano-studies-form-title">
              New study
            </h2>
            <p className="nano-studies-form-copy">It opens on Research Setup after it is created.</p>
          </div>
          <button type="button" className="nano-modal-close" aria-label="Close" disabled={busy} onClick={handleClose}>
            <X size={16} aria-hidden />
          </button>
        </div>
        <form
          className="nano-modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            void onCreate()
          }}
        >
          <label className="nano-studies-field nano-studies-field--wide">
            <span>Study title</span>
            <input
              className="nano-control"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="HepatoTea SIP 2026"
              required
              minLength={3}
            />
          </label>
          <label className="nano-studies-field">
            <span>Short title</span>
            <input
              className="nano-control"
              value={shortTitle}
              onChange={(event) => setShortTitle(event.target.value)}
              placeholder="HepatoTea"
            />
          </label>
          <label className="nano-studies-field">
            <span>FAIR year</span>
            <input
              className="nano-control"
              value={fairYear}
              onChange={(event) => setFairYear(event.target.value)}
              placeholder="2026"
            />
          </label>
          <label className="nano-studies-field nano-studies-field--wide">
            <span>Description</span>
            <textarea
              className="nano-control"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="In silico and experimental assessment against HepG2."
            />
          </label>
          {formError ? (
            <p className="nano-studies-alert nano-studies-field--wide" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="nano-studies-form-actions">
            <button type="submit" className="nano-studies-new" disabled={busy}>
              {busy ? "Creating…" : "Create and open"}
            </button>
            <button type="button" className="nano-studies-cancel" disabled={busy} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
