"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Beaker,
  CalendarRange,
  FlaskConical,
  FolderKanban,
  Microscope,
  MoreHorizontal,
  Plus,
} from "lucide-react"
import { useStudy } from "@/components/providers/StudyProvider"
import type { Study, StudyStatus } from "@/lib/domain/models"
import { readWorkflowProgress, studyPath, WORKFLOW_STEPS } from "@/lib/workflow/studyFlow"

const STATUS_LABEL: Record<StudyStatus, string> = {
  draft: "Draft",
  active: "Active",
  analysis: "Analysis",
  archived: "Archived",
}

function formatUpdated(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d)
}

export function StudiesHome() {
  const router = useRouter()
  const { studies, activeStudy, loading, error, selectStudy, createNewStudy } = useStudy()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState("")
  const [shortTitle, setShortTitle] = useState("")
  const [description, setDescription] = useState("")
  const [fairYear, setFairYear] = useState("")
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [progressReady, setProgressReady] = useState(false)
  const titleId = useId()

  useEffect(() => {
    setProgressReady(true)
  }, [])

  useEffect(() => {
    if (!menuId) return
    const close = () => setMenuId(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuId(null)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", close, true)
    }
  }, [menuId])

  const counts = {
    total: studies.length,
    active: studies.filter((study) => study.status === "active").length,
    draft: studies.filter((study) => study.status === "draft").length,
    analysis: studies.filter((study) => study.status === "analysis").length,
    archived: studies.filter((study) => study.status === "archived").length,
  }

  const openStudy = async (studyId: string) => {
    setMenuId(null)
    setOpeningId(studyId)
    setFormError(null)
    try {
      await selectStudy(studyId)
      const step = WORKFLOW_STEPS[readWorkflowProgress(studyId)] ?? WORKFLOW_STEPS[0]
      router.push(studyPath(studyId, step.id))
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not open the study")
      setOpeningId(null)
    }
  }

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
      router.push(studyPath(study.id, "setup", "formulation"))
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not create the study")
      setBusy(false)
    }
  }

  return (
    <div className="nano-studies">
      <header className="nano-studies-head">
        <div className="nano-studies-head-main">
          <span className="nano-studies-mark" aria-hidden>
            <FolderKanban size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h1 id={titleId} className="nano-studies-title">
              Studies
            </h1>
            <p className="nano-studies-lead">
              Open a study and follow it from Research Setup through Analysis.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="nano-studies-new"
          aria-expanded={creating}
          onClick={() => {
            setCreating((open) => !open)
            setFormError(null)
          }}
        >
          <Plus size={16} strokeWidth={2.25} aria-hidden />
          New Study
        </button>
        <ul className="nano-studies-stats" aria-label="Study counts">
          <li>
            <span>{loading ? "—" : counts.total}</span>
            Total
          </li>
          <li>
            <span>{loading ? "—" : counts.active}</span>
            Active
          </li>
          <li>
            <span>{loading ? "—" : counts.draft}</span>
            Draft
          </li>
          {counts.analysis > 0 ? (
            <li>
              <span>{counts.analysis}</span>
              Analysis
            </li>
          ) : null}
          {counts.archived > 0 ? (
            <li>
              <span>{counts.archived}</span>
              Archived
            </li>
          ) : null}
        </ul>
      </header>

      <p className="nano-studies-disclaimer">Computational outputs do not constitute experimental proof.</p>

      {creating ? (
        <form
          className="nano-studies-form nano-step-in"
          onSubmit={(event) => {
            event.preventDefault()
            void onCreate()
          }}
        >
          <div>
            <h2 className="nano-studies-form-title">New study</h2>
            <p className="nano-studies-form-copy">It opens on Research Setup after it is created.</p>
          </div>
          <label className="nano-studies-field nano-studies-field--wide">
            <span>Study title</span>
            <input
              className="nano-control"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="NanoHepatoTea SIP 2026"
              autoFocus
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
              placeholder="NanoHepatoTea"
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
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="In silico and experimental assessment against HepG2."
            />
          </label>
          <div className="nano-studies-form-actions">
            <button type="submit" className="nano-studies-new" disabled={busy}>
              {busy ? "Creating…" : "Create and open"}
            </button>
            <button type="button" className="nano-studies-cancel" disabled={busy} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="nano-studies-alert" role="alert">
          {error}
        </p>
      ) : null}
      {formError ? (
        <p className="nano-studies-alert" role="alert">
          {formError}
        </p>
      ) : null}

      {loading ? (
        <p className="nano-studies-empty">Loading studies…</p>
      ) : studies.length === 0 ? (
        <div className="nano-studies-empty">
          <p>No studies yet. Create one to start at Research Setup.</p>
        </div>
      ) : (
        <ul className="nano-studies-list" aria-labelledby={titleId}>
          {studies.map((study, index) => (
            <StudyCard
              key={study.id}
              study={study}
              index={index}
              current={activeStudy?.id === study.id}
              progressReady={progressReady}
              opening={openingId === study.id}
              menuOpen={menuId === study.id}
              onToggleMenu={() => setMenuId((id) => (id === study.id ? null : study.id))}
              onCloseMenu={() => setMenuId(null)}
              onOpen={() => void openStudy(study.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function StudyCard({
  study,
  index,
  current,
  progressReady,
  opening,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onOpen,
}: {
  study: Study
  index: number
  current: boolean
  progressReady: boolean
  opening: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onOpen: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const stepIndex = progressReady ? readWorkflowProgress(study.id) : 0
  const step = WORKFLOW_STEPS[stepIndex] ?? WORKFLOW_STEPS[0]

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onCloseMenu()
    }
    window.addEventListener("mousedown", onPointer)
    return () => window.removeEventListener("mousedown", onPointer)
  }, [menuOpen, onCloseMenu])

  return (
    <li
      className="nano-project-card"
      data-current={current ? "true" : undefined}
      data-status={study.status}
      style={{ animationDelay: `${40 + index * 55}ms` }}
    >
      <div className="nano-project-card-top">
        <div className="min-w-0">
          <div className="nano-project-card-title-row">
            <h2 className="nano-project-card-title">{study.title}</h2>
            <span className="nano-study-status" data-status={study.status}>
              {STATUS_LABEL[study.status]}
            </span>
            {current ? <span className="nano-study-current">Current</span> : null}
          </div>
          {study.description ? <p className="nano-project-card-desc">{study.description}</p> : null}
        </div>
        <div className="nano-study-menu" ref={menuRef}>
          <button
            type="button"
            className="nano-study-menu-btn"
            aria-label={`Actions for ${study.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={onToggleMenu}
          >
            <MoreHorizontal size={16} strokeWidth={1.75} />
          </button>
          {menuOpen ? (
            <div className="nano-study-menu-pop" role="menu">
              <button type="button" role="menuitem" onClick={onOpen} disabled={opening}>
                {opening ? "Opening…" : "Open study"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ul className="nano-study-meta">
        <li>
          <CalendarRange size={13} strokeWidth={1.75} aria-hidden />
          <span>Updated {formatUpdated(study.updatedAt)}</span>
        </li>
        {study.primaryCellLine ? (
          <li>
            <Microscope size={13} strokeWidth={1.75} aria-hidden />
            <span>{study.primaryCellLine}</span>
          </li>
        ) : null}
        {study.shortTitle ? (
          <li>
            <FlaskConical size={13} strokeWidth={1.75} aria-hidden />
            <span>{study.shortTitle}</span>
          </li>
        ) : null}
        {study.fairYear ? (
          <li>
            <FolderKanban size={13} strokeWidth={1.75} aria-hidden />
            <span>FAIR {study.fairYear}</span>
          </li>
        ) : null}
        {study.formulationSummary ? (
          <li className="nano-study-meta-wide">
            <Beaker size={13} strokeWidth={1.75} aria-hidden />
            <span>{study.formulationSummary}</span>
          </li>
        ) : null}
      </ul>

      <div className="nano-study-progress">
        <p className="nano-study-stage">
          Current stage <strong>{step.label}</strong>
        </p>
        <ol className="nano-study-rail" aria-label={`${study.title} research progress`}>
          {WORKFLOW_STEPS.map((item, itemIndex) => {
            const mark = itemIndex < stepIndex ? "done" : itemIndex === stepIndex ? "current" : "upcoming"
            return (
              <li key={item.id} data-mark={mark} title={item.label}>
                <span className="nano-study-rail-track" />
                <span className="nano-study-rail-name">{item.shortLabel}</span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="nano-project-card-actions">
        <button type="button" className="nano-studies-open" disabled={opening} onClick={onOpen}>
          {opening ? "Opening…" : "Open Study"}
        </button>
      </div>
    </li>
  )
}
