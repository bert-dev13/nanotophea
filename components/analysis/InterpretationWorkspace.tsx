"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Link2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { ModuleShell } from "@/components/ui/ModuleShell"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import {
  canEditInterpretations,
  interpretationRoleLabel,
} from "@/lib/permissions/researchAccess"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import {
  FormField,
  inputClass,
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
import { CONTRACT_INTERPRETATION_PRESETS } from "@/lib/interpretation/presets"
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

  const selected = useMemo(
    () => saved.find((s) => s.id === selectedId) ?? null,
    [saved, selectedId]
  )

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

  const applyPreset = (presetId: string) => {
    const preset = CONTRACT_INTERPRETATION_PRESETS.find((p) => p.id === presetId)
    setField("researchQuestionPresetId", presetId)
    if (!preset) return
    // Fill only empty fields — never silently overwrite researcher wording
    setForm((prev) => ({
      ...prev,
      researchQuestionPresetId: presetId,
      researchQuestion: prev.researchQuestion.trim()
        ? prev.researchQuestion
        : preset.researchQuestion,
      researchObjective: prev.researchObjective.trim()
        ? prev.researchObjective
        : preset.researchObjective,
      hypothesisText: prev.hypothesisText.trim() ? prev.hypothesisText : preset.hypothesisText,
    }))
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

  const unlinkEvidence = (sourceType: string, sourceId: string) => {
    setForm((prev) => ({
      ...prev,
      linkedEvidence: prev.linkedEvidence.filter(
        (l) => !(l.sourceType === sourceType && l.sourceId === sourceId)
      ),
    }))
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
    if (!form.title.trim()) {
      setError("Title is required.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload = {
        title: form.title.trim(),
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
    <ModuleShell
      icon={BookOpen}
      title="Researcher Interpretation"
      subtitle="Human-authored scientific interpretation linked to evidence IDs — never auto-generated conclusions."
      evidence="INTERPRETATION"
      phase="analysis"
      contractNote="Hypothesis assessment is researcher-controlled. Computational evidence remains computational. Do not auto-claim efficacy, clinical benefit, or experimental validation."
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "#64748b" }}>
        <span>{interpretationRoleLabel(membership?.role)}</span>
        <span className="font-mono uppercase tracking-wide">
          Status: {form.status}
          {freshness ? ` · ${freshness}` : ""}
        </span>
      </div>

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
          <section className="rounded-xl border p-4 space-y-3" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <FormField label="Title" required>
              <input
                className={inputClass}
                style={inputStyle}
                value={form.title}
                disabled={!canEdit}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Interpretation title"
              />
            </FormField>

            {canEdit ? (
              <FormField label="Contract preset (optional — fills empty fields only)">
                <select
                  className={inputClass}
                  style={inputStyle}
                  value={form.researchQuestionPresetId}
                  onChange={(e) => applyPreset(e.target.value)}
                >
                  <option value="">Manual entry</option>
                  {CONTRACT_INTERPRETATION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id.replace("contract-", "").replace(/-/g, " ")} — {p.source}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}

            <FormField label="Research question">
              <textarea
                className={textareaClass}
                style={inputStyle}
                value={form.researchQuestion}
                disabled={!canEdit}
                onChange={(e) => setField("researchQuestion", e.target.value)}
              />
            </FormField>
            <FormField label="Research objective">
              <textarea
                className={textareaClass}
                style={inputStyle}
                value={form.researchObjective}
                disabled={!canEdit}
                onChange={(e) => setField("researchObjective", e.target.value)}
              />
            </FormField>
            <FormField label="Hypothesis">
              <textarea
                className={textareaClass}
                style={inputStyle}
                value={form.hypothesisText}
                disabled={!canEdit}
                onChange={(e) => setField("hypothesisText", e.target.value)}
              />
            </FormField>
          </section>

          <section className="rounded-xl border p-4 space-y-3" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <h3 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
              Evidence overview
            </h3>
            {resolvedLinks.length === 0 ? (
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                Link evidence from the library. Factual snippets may display stored values; narratives
                remain researcher-authored.
              </p>
            ) : (
              <ul className="space-y-2">
                {resolvedLinks.map((item) => (
                  <li
                    key={`${item.sourceType}-${item.sourceId}`}
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{
                      borderColor: item.missing ? "#fecaca" : "#e2e8f0",
                      background: item.missing ? "#fef2f2" : "#f8fafc",
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold" style={{ color: "#0d1f3c" }}>
                        {item.label}
                      </span>
                      <EvidenceBadge type={item.evidenceClass as EvidenceType} />
                      {item.missing ? (
                        <span className="font-mono font-bold" style={{ color: "#b91c1c" }}>
                          SOURCE MISSING
                        </span>
                      ) : null}
                      {item.freshness === "STALE" ? (
                        <span className="font-mono" style={{ color: "#b45309" }}>
                          STALE
                        </span>
                      ) : null}
                      {canEdit ? (
                        <button
                          type="button"
                          className="ml-auto"
                          style={{ color: "#94a3b8" }}
                          onClick={() => unlinkEvidence(item.sourceType, item.sourceId)}
                          aria-label="Unlink evidence"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1" style={{ color: "#64748b" }}>
                      {item.moduleLabel}
                      {item.methodOrSource ? ` · ${item.methodOrSource}` : ""}
                      {item.factualSnippet ? ` · ${item.factualSnippet}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <SummaryField
                label="Computational summary"
                badge="PREDICTED"
                value={form.computationalSummary}
                disabled={!canEdit}
                onChange={(v) => setField("computationalSummary", v)}
              />
              <SummaryField
                label="Experimental summary"
                badge="EXPERIMENTAL"
                value={form.experimentalSummary}
                disabled={!canEdit}
                onChange={(v) => setField("experimentalSummary", v)}
              />
              <SummaryField
                label="Statistical summary"
                badge="EXPERIMENTAL"
                value={form.statisticalSummary}
                disabled={!canEdit}
                onChange={(v) => setField("statisticalSummary", v)}
              />
              <SummaryField
                label="Prediction vs Experimental summary"
                badge="INTERPRETATION"
                value={form.comparisonSummary}
                disabled={!canEdit}
                onChange={(v) => setField("comparisonSummary", v)}
              />
            </div>
          </section>

          <section className="rounded-xl border p-4 space-y-3" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "#0d1f3c" }}>
              Researcher interpretation
              <EvidenceBadge type="INTERPRETATION" />
            </h3>
            <FormField label="Interpretation">
              <textarea
                className={`${textareaClass} min-h-[120px]`}
                style={inputStyle}
                value={form.interpretationText}
                disabled={!canEdit}
                onChange={(e) => setField("interpretationText", e.target.value)}
                placeholder="Author the scientific interpretation manually. Do not paste auto-generated efficacy claims."
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

          <section className="rounded-xl border p-4 space-y-3" style={{ background: "#fff", borderColor: "#dde5ef" }}>
            <h3 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
              Hypothesis assessment
            </h3>
            <p className="text-[11px]" style={{ color: "#64748b" }}>
              Manual researcher decision only. The platform does not calculate or auto-select this
              outcome.
            </p>
            <FormField label="Assessment">
              <select
                className={inputClass}
                style={inputStyle}
                value={form.hypothesisAssessment}
                disabled={!canEdit}
                onChange={(e) =>
                  setField("hypothesisAssessment", e.target.value as HypothesisAssessment)
                }
              >
                <option value="not_assessed">Not assessed</option>
                <option value="supported">Supported</option>
                <option value="partially_supported">Partially supported</option>
                <option value="not_supported">Not supported</option>
              </select>
            </FormField>
            <FormField label="Assessment rationale (optional)">
              <textarea
                className={textareaClass}
                style={inputStyle}
                value={form.assessmentRationale}
                disabled={!canEdit}
                onChange={(e) => setField("assessmentRationale", e.target.value)}
              />
            </FormField>
            <FormField label="Status">
              <select
                className={inputClass}
                style={inputStyle}
                value={form.status}
                disabled={!canEdit}
                onChange={(e) => setField("status", e.target.value as InterpretationStatus)}
              >
                <option value="draft">Draft</option>
                <option value="reviewed">Reviewed</option>
                <option value="final">Final</option>
              </select>
            </FormField>
            {selected?.assessmentSelectedAt ? (
              <p className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
                Assessment set {new Date(selected.assessmentSelectedAt).toLocaleString()}
                {selected.assessmentSelectedBy
                  ? ` · by ${selected.assessmentSelectedBy.slice(0, 8)}…`
                  : ""}
              </p>
            ) : null}
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
                {selectedId ? "Save changes" : "Create interpretation"}
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
    </ModuleShell>
  )
}

function SummaryField({
  label,
  badge,
  value,
  disabled,
  onChange,
}: {
  label: string
  badge: EvidenceType
  value: string
  disabled?: boolean
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
          {label}
        </span>
        <EvidenceBadge type={badge} />
      </div>
      <textarea
        className={textareaClass}
        style={inputStyle}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Researcher-authored summary of linked facts — not an auto-generated conclusion."
      />
    </div>
  )
}
