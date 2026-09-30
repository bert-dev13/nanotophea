"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
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
    hour: "numeric",
    minute: "2-digit",
  }).format(d)
}

function studyMeta(study: Study) {
  return [study.primaryCellLine, study.shortTitle, study.fairYear ? `FAIR ${study.fairYear}` : null]
    .filter(Boolean)
    .join(" · ")
}

export function StudiesHome() {
  const router = useRouter()
  const { studies, loading, error, selectStudy, createNewStudy } = useStudy()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState("")
  const [shortTitle, setShortTitle] = useState("")
  const [description, setDescription] = useState("")
  const [fairYear, setFairYear] = useState("")
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const openStudy = async (studyId: string) => {
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[1.65rem] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            Studies
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--muted-foreground)]">
            Open a study and follow the workspace from Research Setup through Analysis.
          </p>
        </div>
        <button
          type="button"
          className="nano-flow-next"
          onClick={() => {
            setCreating((v) => !v)
            setFormError(null)
          }}
        >
          <Plus size={15} strokeWidth={2.25} aria-hidden />
          New Study
        </button>
      </div>

      <p className="mt-4 text-[12px] leading-snug text-[var(--muted-foreground)]">
        Computational outputs do not constitute experimental proof.
      </p>

      {creating ? (
        <form
          className="nano-step-in mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            void onCreate()
          }}
        >
          <label className="block sm:col-span-2">
            <span className="text-[12px] font-semibold">Study title</span>
            <input
              className="nano-control mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px]"
              style={{ borderColor: "var(--border)" }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="NanoHepatoTea SIP 2026"
              autoFocus
              required
              minLength={3}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold">Short title</span>
            <input
              className="nano-control mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px]"
              style={{ borderColor: "var(--border)" }}
              value={shortTitle}
              onChange={(e) => setShortTitle(e.target.value)}
              placeholder="NanoHepatoTea"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold">FAIR year</span>
            <input
              className="nano-control mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px]"
              style={{ borderColor: "var(--border)" }}
              value={fairYear}
              onChange={(e) => setFairYear(e.target.value)}
              placeholder="2026"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[12px] font-semibold">Description</span>
            <textarea
              className="nano-control mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px]"
              style={{ borderColor: "var(--border)" }}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="In silico and experimental assessment against HepG2."
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="nano-flow-next" disabled={busy}>
              {busy ? "Creating…" : "Create and open Step 1"}
            </button>
            <button
              type="button"
              className="nano-flow-prev"
              disabled={busy}
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="mt-4 text-[13px]" style={{ color: "#b91c1c" }} role="alert">
          {error}
        </p>
      ) : null}
      {formError ? (
        <p className="mt-4 text-[13px]" style={{ color: "#b91c1c" }} role="alert">
          {formError}
        </p>
      ) : null}

      <div className="mt-4 border-t" style={{ borderColor: "var(--border)" }}>
        {loading ? (
          <p className="py-8 text-[13px] text-[var(--muted-foreground)]">Loading studies…</p>
        ) : studies.length === 0 ? (
          <p className="py-8 text-[13px] text-[var(--muted-foreground)]">
            No studies yet. Create one to start at Research Setup.
          </p>
        ) : (
          <ul>
            {studies.map((study) => (
              <li
                key={study.id}
                className="flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-center"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                      {study.title}
                    </h2>
                    <span className="nano-study-status" data-status={study.status}>
                      {STATUS_LABEL[study.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                    Updated {formatUpdated(study.updatedAt)}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--muted-foreground)]">
                    {studyMeta(study)}
                  </p>
                  {study.formulationSummary ? (
                    <p className="mt-0.5 truncate text-[12px] text-[var(--muted-foreground)]">
                      {study.formulationSummary}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="nano-flow-next shrink-0"
                  disabled={openingId === study.id}
                  onClick={() => void openStudy(study.id)}
                >
                  {openingId === study.id ? "Opening…" : "Open Study"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
