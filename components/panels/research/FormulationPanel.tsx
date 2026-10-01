"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Beaker,
  Check,
  Leaf,
  Pencil,
  Plus,
  Scale,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useStudy } from "@/components/providers/StudyProvider"
import { useAuth } from "@/components/providers/AuthProvider"
import { canEditResearchData, researchRoleLabel } from "@/lib/permissions/researchAccess"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import { ProvenanceCard } from "@/components/research/ProvenanceCard"
import {
  FieldGrid,
  FormField,
  inputClass,
  inputStyle,
  textareaClass,
} from "@/components/research/FormFields"
import {
  ProvenanceFormFields,
  emptyProvenanceForm,
  provenanceFromForm,
  validateResearchProvenance,
  type ProvenanceFormState,
} from "@/components/research/ProvenanceForm"
import {
  ReferenceIdPicker,
  ReferenceLinkList,
  useStudyReferences,
} from "@/components/research/ReferenceLinks"
import type { Formulation } from "@/lib/domain/models"
import {
  createFormulation,
  deleteFormulation,
  listFormulations,
  updateFormulation,
} from "@/lib/repositories/researchDataRepository"
import { toUserFacingError } from "@/lib/errors/userFacing"

type Mode = "view" | "create" | "edit"

interface FormState {
  name: string
  plantMaterial: string
  scientificName: string
  leafMassG: string
  nanocarrierMassG: string
  methodNotes: string
  storageNotes: string
  markerCompound: string
  notes: string
  isCanonical: boolean
  referenceIds: string[]
  provenance: ProvenanceFormState
}

function blankForm(): FormState {
  return {
    name: "NanoHepatoTea",
    plantMaterial: "Dried Phyllanthus niruri leaf",
    scientificName: "Phyllanthus niruri L.",
    leafMassG: "2",
    nanocarrierMassG: "1",
    methodNotes: "",
    storageNotes: "",
    markerCompound: "Quercetin",
    notes: "",
    isCanonical: false,
    referenceIds: [],
    provenance: emptyProvenanceForm("REFERENCE"),
  }
}

function fromRecord(r: Formulation): FormState {
  return {
    name: r.name,
    plantMaterial: r.plantMaterial ?? "",
    scientificName: r.scientificName ?? "",
    leafMassG: String(r.leafMassG),
    nanocarrierMassG: String(r.nanocarrierMassG),
    methodNotes: r.methodNotes ?? "",
    storageNotes: r.storageNotes ?? "",
    markerCompound: r.markerCompound ?? "",
    notes: r.notes ?? "",
    isCanonical: r.isCanonical,
    referenceIds: r.referenceIds ?? [],
    provenance: {
      evidenceClass: r.provenance.evidenceClass,
      source: r.provenance.source ?? "",
      citation: r.provenance.citation ?? "",
      retrievedAt: (r.provenance.retrievedAt ?? r.provenance.recordedAt ?? "").slice(0, 10),
      notesLimitation: r.provenance.limitations ?? "",
    },
  }
}

export default function FormulationPanel() {
  const { user, profile } = useAuth()
  const { activeStudy, membership } = useStudy()
  const canEdit = canEditResearchData(membership?.role)
  const refs = useStudyReferences(activeStudy?.id)

  const [rows, setRows] = useState<Formulation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("view")
  const [form, setForm] = useState<FormState>(blankForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!activeStudy || !profile) return
    setLoading(true)
    setError(null)
    try {
      const list = await listFormulations(activeStudy.id)
      setRows(list)
      setSelectedId((prev) => prev ?? list.find((f) => f.isCanonical)?.id ?? list[0]?.id ?? null)
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load formulations"))
    } finally {
      setLoading(false)
    }
  }, [activeStudy, profile])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.scientificName ?? "").toLowerCase().includes(q) ||
        (r.markerCompound ?? "").toLowerCase().includes(q)
    )
  }, [rows, search])

  const selected = rows.find((r) => r.id === selectedId) ?? null

  const startCreate = () => {
    setForm(blankForm())
    setMode("create")
  }

  const startEdit = () => {
    if (!selected) return
    setForm(fromRecord(selected))
    setMode("edit")
  }

  const cancelForm = () => setMode("view")

  const save = async () => {
    if (!activeStudy || !user) return
    const provErr = validateResearchProvenance(form.provenance)
    if (provErr) {
      setError(provErr)
      return
    }
    const leaf = Number(form.leafMassG)
    const nano = Number(form.nanocarrierMassG)
    if (!form.name.trim() || !(leaf > 0) || !(nano > 0)) {
      setError("Name, dried leaf mass, and Chitosan–TPP mass are required.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const actor = { id: user.uid }
      const payload = {
        name: form.name.trim(),
        plantMaterial: form.plantMaterial.trim() || undefined,
        scientificName: form.scientificName.trim() || undefined,
        leafMassG: leaf,
        nanocarrierMassG: nano,
        totalMassG: leaf + nano,
        components: [],
        methodNotes: form.methodNotes.trim() || undefined,
        storageNotes: form.storageNotes.trim() || undefined,
        markerCompound: form.markerCompound.trim() || undefined,
        notes: form.notes.trim() || undefined,
        isCanonical: form.isCanonical,
        referenceIds: form.referenceIds,
        provenance: provenanceFromForm(form.provenance),
      }
      if (mode === "create") {
        const created = await createFormulation(activeStudy.id, actor, payload)
        setSelectedId(created.id)
      } else if (mode === "edit" && selected) {
        await updateFormulation(activeStudy.id, selected.id, actor, payload)
      }
      setMode("view")
      await load()
    } catch (e) {
      setError(toUserFacingError(e, "Save failed"))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!activeStudy || !user || !deleteId) return
    setBusy(true)
    try {
      await deleteFormulation(activeStudy.id, deleteId, { id: user.uid })
      setDeleteId(null)
      setSelectedId(null)
      setMode("view")
      await load()
    } catch (e) {
      setError(toUserFacingError(e, "Delete failed"))
    } finally {
      setBusy(false)
    }
  }

  if (!activeStudy) {
    return (
      <div className="nano-formu space-y-5">
        <FormulationHero />
        <ResearchEmptyState
          title="No active study"
          body="Create a study from the toolbar to load the locked NanoHepatoTea formulation."
          canEdit={false}
        />
      </div>
    )
  }

  return (
    <div className="nano-formu space-y-5">
      <FormulationHero
        role={researchRoleLabel(membership?.role)}
        canEdit={canEdit}
        onAdd={canEdit ? startCreate : undefined}
      />

      <div className="nano-formu-toolbar">
        <div className="nano-formu-search">
          <Search size={14} className="shrink-0 text-slate-400" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search formulations…"
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Search formulations"
          />
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          {filtered.length} record{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Loading formulations…</p>
      ) : null}

      {!loading && filtered.length === 0 && mode === "view" ? (
        <ResearchEmptyState
          title="No formulations"
          body="Seeded NanoHepatoTea appears for new studies. Add a formulation with provenance, or re-open after study create."
          canEdit={canEdit}
          actionLabel="Add formulation"
          onAction={startCreate}
        />
      ) : !loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* List */}
          <aside className="nano-formu-list lg:col-span-4 xl:col-span-3">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Records
            </p>
            <div className="max-h-[560px] space-y-1 overflow-y-auto pr-0.5">
              {filtered.map((r) => {
                const active = r.id === selectedId && mode === "view"
                const totalMass = r.totalMassG ?? 0
                const leafMass = r.leafMassG ?? 0
                const leafPct = totalMass > 0 ? (leafMass / totalMass) * 100 : 0
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(r.id)
                      setMode("view")
                    }}
                    className={`nano-formu-list-item group w-full text-left ${
                      active ? "nano-formu-list-item--active" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] font-semibold text-slate-900">
                        {r.name}
                      </span>
                      {r.isCanonical ? (
                        <span className="shrink-0 rounded-md bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-800">
                          Canonical
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {r.leafMassG} g leaf · {r.nanocarrierMassG} g carrier
                    </p>
                    <div className="nano-formu-ratio mt-2" aria-hidden>
                      <span style={{ width: `${leafPct}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Detail / form */}
          <div className="min-w-0 space-y-4 lg:col-span-8 xl:col-span-9">
            {(mode === "create" || mode === "edit") && (
              <div className="nano-formu-panel space-y-4 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-teal-700/70">
                      {mode === "create" ? "Create" : "Edit"}
                    </p>
                    <h2 className="text-[15px] font-semibold text-slate-900">
                      {mode === "create" ? "New formulation" : "Edit formulation"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="nano-icon-btn"
                    aria-label="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>

                <FieldGrid>
                  <FormField label="Name" required>
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Marker compound">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.markerCompound}
                      onChange={(e) => setForm({ ...form, markerCompound: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Plant / material">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.plantMaterial}
                      onChange={(e) => setForm({ ...form, plantMaterial: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Scientific name">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.scientificName}
                      onChange={(e) => setForm({ ...form, scientificName: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Dried leaf mass (g)" required>
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.leafMassG}
                      onChange={(e) => setForm({ ...form, leafMassG: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Chitosan–TPP mass (g)" required>
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.nanocarrierMassG}
                      onChange={(e) => setForm({ ...form, nanocarrierMassG: e.target.value })}
                    />
                  </FormField>
                </FieldGrid>

                <FormField label="Preparation / method notes">
                  <textarea
                    className={textareaClass}
                    style={inputStyle}
                    value={form.methodNotes}
                    onChange={(e) => setForm({ ...form, methodNotes: e.target.value })}
                  />
                </FormField>
                <FormField label="Storage notes">
                  <textarea
                    className={textareaClass}
                    style={inputStyle}
                    value={form.storageNotes}
                    onChange={(e) => setForm({ ...form, storageNotes: e.target.value })}
                  />
                </FormField>
                <FormField label="Notes">
                  <textarea
                    className={textareaClass}
                    style={inputStyle}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </FormField>

                <label className="flex items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2.5 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isCanonical}
                    onChange={(e) => setForm({ ...form, isCanonical: e.target.checked })}
                    className="accent-teal-700"
                  />
                  Canonical / locked study formulation
                </label>

                <FormField label="Linked references">
                  <ReferenceIdPicker
                    references={refs}
                    value={form.referenceIds}
                    onChange={(referenceIds) => setForm({ ...form, referenceIds })}
                  />
                </FormField>
                <ProvenanceFormFields
                  value={form.provenance}
                  onChange={(provenance) => setForm({ ...form, provenance })}
                />

                <div className="flex justify-end gap-2 border-t border-teal-50 pt-3">
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save()}
                    className="nano-setup-save"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}

            {mode === "view" && selected ? (
              <div className="nano-formu-panel overflow-hidden">
                <div className="border-b border-teal-100/80 bg-gradient-to-r from-teal-50/80 via-white to-cyan-50/40 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <EvidenceBadge type={selected.provenance.evidenceClass} />
                        {selected.isCanonical ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                            <Check size={10} strokeWidth={2.5} aria-hidden />
                            Canonical
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.02em] text-slate-900">
                        {selected.name}
                      </h2>
                      {selected.scientificName ? (
                        <p className="mt-1 text-[13px] italic text-slate-500">
                          {selected.scientificName}
                        </p>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={startEdit}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-200 hover:bg-teal-50"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(selected.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5 p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <CompositionStat
                      icon={Leaf}
                      label="Dried leaf"
                      value={`${selected.leafMassG ?? 0} g`}
                      tone="green"
                    />
                    <CompositionStat
                      icon={Beaker}
                      label="Chitosan–TPP"
                      value={`${selected.nanocarrierMassG ?? 0} g`}
                      tone="teal"
                    />
                    <CompositionStat
                      icon={Scale}
                      label="Total mass"
                      value={`${selected.totalMassG ?? 0} g`}
                      tone="cyan"
                    />
                  </div>

                  <CompositionBar
                    leaf={selected.leafMassG ?? 0}
                    carrier={selected.nanocarrierMassG ?? 0}
                    total={selected.totalMassG ?? 0}
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoBlock label="Plant / material" value={selected.plantMaterial} />
                    <InfoBlock label="Marker compound" value={selected.markerCompound} />
                  </div>

                  {selected.methodNotes ? (
                    <InfoBlock label="Method notes" value={selected.methodNotes} wide />
                  ) : null}
                  {selected.storageNotes ? (
                    <InfoBlock label="Storage notes" value={selected.storageNotes} wide />
                  ) : null}
                  {selected.notes ? <InfoBlock label="Notes" value={selected.notes} wide /> : null}

                  <ProvenanceCard provenance={selected.provenance} />

                  {selected.referenceIds?.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">
                        References
                      </p>
                      <ReferenceLinkList
                        referenceIds={selected.referenceIds}
                        references={refs}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {mode === "view" && !selected && !loading ? (
              <ResearchEmptyState
                title="Select a formulation"
                body="Choose a record from the list."
                canEdit={false}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete formulation?"
        message="This removes the formulation record from the current study. This cannot be undone."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
      />
    </div>
  )
}

function FormulationHero({
  role,
  canEdit,
  onAdd,
}: {
  role?: string
  canEdit?: boolean
  onAdd?: () => void
}) {
  return (
    <section className="nano-formu-hero relative overflow-hidden rounded-2xl border border-teal-200/80">
      <div className="nano-formu-hero-wash" aria-hidden />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-teal-800 ring-1 ring-teal-200/80">
              <Leaf size={11} strokeWidth={2.25} aria-hidden />
              Research data
            </span>
            <EvidenceBadge type="REFERENCE" />
            <EvidenceBadge type="LITERATURE" />
          </div>
          <h1 className="mt-2.5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.03em] text-slate-900">
            Formulation
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-600">
            Canonical NanoHepatoTea composition and preparation context for this study — research
            metadata only, not clinical dosing.
          </p>
          {role ? (
            <p className="mt-2 text-[11px] font-medium text-slate-400">{role} access</p>
          ) : null}
        </div>
        {canEdit && onAdd ? (
          <button type="button" onClick={onAdd} className="nano-formu-add group shrink-0">
            <Plus size={15} strokeWidth={2.25} aria-hidden />
            Add formulation
          </button>
        ) : null}
      </div>
    </section>
  )
}

function CompositionStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Leaf
  label: string
  value: string
  tone: "green" | "teal" | "cyan"
}) {
  const tones = {
    green: { soft: "#f0fdf4", accent: "#15803d", border: "#bbf7d0" },
    teal: { soft: "#f0fdfa", accent: "#0f766e", border: "#99f6e4" },
    cyan: { soft: "#ecfeff", accent: "#0e7490", border: "#a5f3fc" },
  }[tone]

  return (
    <div
      className="rounded-xl border px-3.5 py-3"
      style={{ background: tones.soft, borderColor: tones.border }}
    >
      <div className="flex items-center gap-2" style={{ color: tones.accent }}>
        <Icon size={14} strokeWidth={2} aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-[0.06em]">{label}</span>
      </div>
      <p className="mt-1.5 text-lg font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  )
}

function CompositionBar({
  leaf,
  carrier,
  total,
}: {
  leaf: number
  carrier: number
  total: number
}) {
  const leafPct = total > 0 ? (leaf / total) * 100 : 0
  const carrierPct = total > 0 ? (carrier / total) * 100 : 0
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold">
        <span className="text-emerald-700">Leaf {leafPct.toFixed(0)}%</span>
        <span className="text-teal-700">Carrier {carrierPct.toFixed(0)}%</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
        <span className="bg-emerald-500 transition-[width] duration-200" style={{ width: `${leafPct}%` }} />
        <span className="bg-teal-500 transition-[width] duration-200" style={{ width: `${carrierPct}%` }} />
      </div>
    </div>
  )
}

function InfoBlock({
  label,
  value,
  wide,
}: {
  label: string
  value?: string | null
  wide?: boolean
}) {
  if (!value) return null
  return (
    <div className={wide ? "rounded-xl border border-slate-200 bg-white px-3.5 py-3" : "rounded-xl border border-slate-200 bg-white px-3.5 py-3"}>
      <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-800 break-words">{value}</p>
    </div>
  )
}
