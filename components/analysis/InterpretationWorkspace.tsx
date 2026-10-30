"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  Link2,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { AnalysisEvidenceSummary } from "@/components/analysis/AnalysisEvidenceSummary"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import {
  canEditInterpretations,
} from "@/lib/permissions/researchAccess"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import {
  FormField,
  inputStyle,
  textareaClass,
} from "@/components/research/FormFields"
import {
  buildEvidenceLibrary,
  createInterpretation,
  deleteInterpretation,
  listInterpretations,
  resolveLinkedEvidence,
  updateInterpretation,
} from "@/lib/repositories/interpretationRepository"
import type {
  EvidenceCatalogItem,
  EvidenceGroup,
} from "@/lib/interpretation/evidenceCatalog"
import type {
  HypothesisAssessment,
  Interpretation,
  InterpretationLinkedEvidence,
  InterpretationStatus,
} from "@/lib/domain/models"
import type { EvidenceType } from "@/types/evidence"

interface FormState {
  title: string
  researchQuestion: string
  researchObjective: string
  hypothesisText: string
  researchQuestionPresetId: string
  linkedEvidence: InterpretationLinkedEvidence[]
  computationalSummary: string
  experimentalSummary: string
  statisticalSummary: string
  comparisonSummary: string
  interpretationText: string
  limitations: string
  conclusion: string
  hypothesisAssessment: HypothesisAssessment
  assessmentRationale: string
  status: InterpretationStatus
}

function blankForm(): FormState {
  return {
    title: "",
    researchQuestion: "",
    researchObjective: "",
    hypothesisText: "",
    researchQuestionPresetId: "",
    linkedEvidence: [],
    computationalSummary: "",
    experimentalSummary: "",
    statisticalSummary: "",
    comparisonSummary: "",
    interpretationText: "",
    limitations: "",
    conclusion: "",
    hypothesisAssessment: "not_assessed",
    assessmentRationale: "",
    status: "draft",
  }
}

function formFromRecord(r: Interpretation): FormState {
  return {
    title: r.title,
    researchQuestion: r.researchQuestion || "",
    researchObjective: r.researchObjective || "",
    hypothesisText: r.hypothesisText || "",
    researchQuestionPresetId: r.researchQuestionPresetId || "",
    linkedEvidence: r.linkedEvidence || [],
    computationalSummary: r.computationalSummary || "",
    experimentalSummary: r.experimentalSummary || "",
    statisticalSummary: r.statisticalSummary || "",
    comparisonSummary: r.comparisonSummary || "",
    interpretationText: r.interpretationText || r.body || "",
    limitations: r.limitations || "",
    conclusion: r.conclusion || "",
    hypothesisAssessment: r.hypothesisAssessment || "not_assessed",
    assessmentRationale: r.assessmentRationale || "",
    status: r.status,
  }
}

export function InterpretationWorkspace() {
  const { user } = useAuth()
  const { activeStudy, membership, loading: studyLoading } = useStudy()
  const canEdit = canEditInterpretations(membership?.role)

  const [library, setLibrary] = useState<EvidenceGroup[]>([])
  const [saved, setSaved] = useState<Interpretation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(blankForm)
  const [resolvedLinks, setResolvedLinks] = useState<EvidenceCatalogItem[]>([])
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    computational: true,
    experimental: true,
    statistics: true,
    comparison: true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [freshness, setFreshness] = useState<"CURRENT" | "STALE" | undefined>()

  const refresh = useCallback(async () => {
    if (!activeStudy) return
    const [lib, rows] = await Promise.all([
      buildEvidenceLibrary(activeStudy.id),
      listInterpretations(activeStudy.id),
    ])
    setLibrary(lib)
    setSaved(rows)
  }, [activeStudy])

  useEffect(() => {
    if (!activeStudy) return
    void refresh().catch((e) => setError(toUserFacingError(e, "Load failed")))
  }, [activeStudy, refresh])

  useEffect(() => {
    if (!activeStudy || form.linkedEvidence.length === 0) {
      setResolvedLinks([])
      return
    }
    let cancelled = false
    void resolveLinkedEvidence(activeStudy.id, form.linkedEvidence).then((items) => {
      if (!cancelled) setResolvedLinks(items)
    })
    return () => {
      cancelled = true
    }
  }, [activeStudy, form.linkedEvidence])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const linkEvidence = (item: EvidenceCatalogItem) => {
    if (!canEdit) return
    setForm((prev) => {
      if (prev.linkedEvidence.some((l) => l.sourceType === item.sourceType && l.sourceId === item.sourceId)) {
        return prev
      }
      const link: InterpretationLinkedEvidence = {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        evidenceClass: item.evidenceClass,
        label: item.label,
        sourceUpdatedAt: item.updatedAt,
        moduleLabel: item.moduleLabel,
      }
      return { ...prev, linkedEvidence: [...prev.linkedEvidence, link] }
    })
  }

  const onNew = () => {
    setSelectedId(null)
    setForm(blankForm())
    setFreshness(undefined)
    setError(null)
  }

  const onSelect = (row: Interpretation) => {
    setSelectedId(row.id)
    setForm(formFromRecord(row))
    setFreshness(row.freshness)
    setError(null)
  }

  const onSave = async () => {
    if (!activeStudy || !user || !canEdit) return
    const title = form.title.trim() || "Research interpretation"
    setBusy(true)
    setError(null)
    try {
      const payload = {
        title,
        researchQuestion: form.researchQuestion,
        researchObjective: form.researchObjective,
        hypothesisText: form.hypothesisText,
        researchQuestionPresetId: form.researchQuestionPresetId || undefined,
        linkedEvidence: form.linkedEvidence,
        computationalSummary: form.computationalSummary,
        experimentalSummary: form.experimentalSummary,
        statisticalSummary: form.statisticalSummary,
        comparisonSummary: form.comparisonSummary,
        interpretationText: form.interpretationText,
        limitations: form.limitations,
        conclusion: form.conclusion,
        hypothesisAssessment: form.hypothesisAssessment,
        assessmentRationale: form.assessmentRationale || undefined,
        status: form.status,
      }
      if (selectedId) {
        const updated = await updateInterpretation(activeStudy.id, selectedId, { id: user.uid }, payload)
        setFreshness(updated.freshness)
      } else {
        const created = await createInterpretation(activeStudy.id, { id: user.uid }, payload)
        setSelectedId(created.id)
        setFreshness(created.freshness ?? "CURRENT")
      }
      await refresh()
    } catch (e) {
      setError(toUserFacingError(e, "Save failed"))
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!activeStudy || !user || !canEdit || !deleteId) return
    setBusy(true)
    try {
      await deleteInterpretation(activeStudy.id, deleteId, { id: user.uid })
      if (selectedId === deleteId) onNew()
      setDeleteId(null)
      await refresh()
    } catch (e) {
      setError(toUserFacingError(e, "Delete failed"))
    } finally {
      setBusy(false)
    }
  }

  if (studyLoading) {
    return <p className="text-sm" style={{ color: "#64748b" }}>Loading study…</p>
  }
  if (!activeStudy) {
    return (
      <ResearchEmptyState
        title="Select a study"
        body="Researcher Interpretation requires an active study with linked evidence."
        canEdit={false}
      />
    )
  }

  return (
    <>
      <header className="phyto-hero">
        <div>
          <p className="phyto-kicker">03 · Research Interpretation</p>
          <h2>Evidence synthesis</h2>
          <p className="phyto-subtitle">
            The platform lists what was recorded. The interpretation, relationship, limitations,
            and conclusion are written by the researcher.
          </p>
        </div>
        <EvidenceBadge type="INTERPRETATION" />
      </header>
      <AnalysisEvidenceSummary />

      {error ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}
        >
          {error}
        </div>
      ) : null}

      {freshness === "STALE" ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm flex gap-2"
          style={{ borderColor: "#fcd34d", background: "#fffbeb", color: "#92400e" }}
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">STALE / REQUIRES REVIEW</p>
            <p className="text-xs mt-1">
              Linked evidence changed after this interpretation was saved. The narrative was not
              rewritten automatically — review and update manually.
            </p>
          </div>
        </div>
      ) : null}

      {/* Saved list */}
      <section className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#dde5ef" }}>
        <div className="px-3 py-2 flex items-center justify-between" style={{ background: "#f8fafc" }}>
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
            Interpretations ({saved.length})
          </span>
          {canEdit ? (
            <button
              type="button"
              onClick={onNew}
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: "#00a882" }}
            >
              <Plus size={13} /> New
            </button>
          ) : null}
        </div>
        {saved.length === 0 ? (
          <p className="px-3 py-3 text-sm" style={{ color: "#94a3b8" }}>No interpretations yet.</p>
        ) : (
          <ul>
            {saved.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2 border-t text-xs"
                style={{ borderColor: "#eef2f7" }}
              >
                <button
                  type="button"
                  className="flex-1 text-left font-semibold min-w-[10rem]"
                  style={{ color: selectedId === row.id ? "#00a882" : "#0d1f3c" }}
                  onClick={() => onSelect(row)}
                >
                  {row.title}
                  <span className="block font-normal" style={{ color: "#64748b" }}>
                    {row.status} · {row.hypothesisAssessment.replace(/_/g, " ")} ·{" "}
                    {new Date(row.updatedAt).toLocaleString()}
                  </span>
                </button>
                {row.freshness === "STALE" ? (
                  <span
                    className="rounded border px-1.5 py-0.5 font-bold uppercase"
                    style={{ borderColor: "#fcd34d", background: "#fffbeb", color: "#b45309" }}
                  >
                    Stale
                  </span>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className="rounded border px-2 py-1"
                    style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                    onClick={() => setDeleteId(row.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,20rem)_1fr] gap-4 items-start">
        {/* Evidence library */}
        <aside className="rounded-xl border overflow-hidden lg:sticky lg:top-16" style={{ background: "#fff", borderColor: "#dde5ef" }}>
          <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor: "#eef2f7", background: "#f8fafc" }}>
            <Link2 size={14} style={{ color: "#00a882" }} />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
              Evidence library
            </span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {library.map((group) => {
              const open = openGroups[group.id] ?? false
              return (
                <div key={group.id} className="border-b" style={{ borderColor: "#eef2f7" }}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide"
                    style={{ color: "#475569" }}
                    onClick={() =>
                      setOpenGroups((prev) => ({ ...prev, [group.id]: !open }))
                    }
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-150 ${open ? "" : "-rotate-90"}`}
                    />
                    {group.title}
                    <span className="ml-auto font-mono font-normal" style={{ color: "#94a3b8" }}>
                      {group.items.length}
                    </span>
                  </button>
                  {open ? (
                    <ul className="pb-2 px-2 space-y-1">
                      {group.items.length === 0 ? (
                        <li className="px-2 py-1 text-[11px]" style={{ color: "#94a3b8" }}>
                          No records
                        </li>
                      ) : (
                        group.items.map((item) => {
                          const linked = form.linkedEvidence.some(
                            (l) => l.sourceType === item.sourceType && l.sourceId === item.sourceId
                          )
                          return (
                            <li key={`${item.sourceType}-${item.sourceId}`}>
                              <button
                                type="button"
                                disabled={!canEdit || linked}
                                onClick={() => linkEvidence(item)}
                                className="w-full rounded-md border px-2 py-1.5 text-left transition-colors duration-150 hover:bg-slate-50 disabled:opacity-60"
                                style={{ borderColor: "#e8eef5" }}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span className="text-[11px] font-semibold leading-snug" style={{ color: "#0d1f3c" }}>
                                    {item.label}
                                  </span>
                                  <EvidenceBadge type={item.evidenceClass as EvidenceType} />
                                </div>
                                <div className="mt-0.5 text-[10px]" style={{ color: "#64748b" }}>
                                  {item.moduleLabel}
                                  {item.freshness === "STALE" ? " · STALE" : ""}
                                  {item.factualSnippet ? ` · ${item.factualSnippet}` : ""}
                                </div>
                                {linked ? (
                                  <span className="text-[10px] font-mono" style={{ color: "#00a882" }}>
                                    Linked
                                  </span>
                                ) : canEdit ? (
                                  <span className="text-[10px]" style={{ color: "#94a3b8" }}>
                                    + Link evidence
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          )
                        })
                      )}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        </aside>

        {/* Workspace */}
        <div className="space-y-4 min-w-0">
          {resolvedLinks.length > 0 ? (
            <ul className="space-y-2">
              {resolvedLinks.map((item) => (
                <li key={`${item.sourceType}-${item.sourceId}`} className="analysis-evidence">
                  <span>{item.label}</span>
                  <EvidenceBadge type={item.evidenceClass as EvidenceType} />
                </li>
              ))}
            </ul>
          ) : null}

          <section className="rounded-xl border p-4 space-y-3" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "#0d1f3c" }}>
              Researcher interpretation
              <EvidenceBadge type="INTERPRETATION" />
            </h3>
            <FormField label="Overall Interpretation">
              <textarea
                className={`${textareaClass} min-h-[120px]`}
                style={inputStyle}
                value={form.interpretationText}
                disabled={!canEdit}
                onChange={(e) => setField("interpretationText", e.target.value)}
              />
            </FormField>
            <FormField label="Relationship Between Computational and Experimental Results">
              <textarea
                className={textareaClass}
                style={inputStyle}
                value={form.comparisonSummary}
                disabled={!canEdit}
                onChange={(e) => setField("comparisonSummary", e.target.value)}
              />
            </FormField>
            <FormField label="Limitations">
              <textarea
                className={textareaClass}
                style={inputStyle}
                value={form.limitations}
                disabled={!canEdit}
                onChange={(e) => setField("limitations", e.target.value)}
              />
            </FormField>
            <FormField label="Conclusion">
              <textarea
                className={textareaClass}
                style={inputStyle}
                value={form.conclusion}
                disabled={!canEdit}
                onChange={(e) => setField("conclusion", e.target.value)}
              />
            </FormField>
          </section>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSave()}
                className="nano-setup-save"
              >
                <Save size={13} />
                {selectedId ? "Save changes" : "Save interpretation"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        title="Delete interpretation?"
        message="Removes this researcher-authored interpretation. Linked source evidence is not deleted."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void onDelete()}
        busy={busy}
      />
    </>
  )
}
