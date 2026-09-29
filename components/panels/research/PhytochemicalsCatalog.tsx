"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Atom,
  ExternalLink,
  FlaskConical,
  Hash,
  Pencil,
  Plus,
  Search,
  Sparkles,
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
import { CompoundViewer3D } from "@/lib/mol3d"
import type { Compound } from "@/lib/domain/models"
import {
  createCompound,
  deleteCompound,
  listCompounds,
  updateCompound,
} from "@/lib/repositories/researchDataRepository"
import { seedDefaultResearchData } from "@/lib/seed/defaultResearchData"
import { toUserFacingError } from "@/lib/errors/userFacing"

type Mode = "view" | "create" | "edit"

interface FormState {
  name: string
  pubchemCid: string
  smiles: string
  isomericSmiles: string
  formula: string
  molecularWeight: string
  chemicalClass: string
  plantPart: string
  source: string
  isPrimaryMarker: boolean
  notes: string
  referenceIds: string[]
  provenance: ProvenanceFormState
}

function blankForm(): FormState {
  return {
    name: "",
    pubchemCid: "",
    smiles: "",
    isomericSmiles: "",
    formula: "",
    molecularWeight: "",
    chemicalClass: "",
    plantPart: "",
    source: "PubChem",
    isPrimaryMarker: false,
    notes: "",
    referenceIds: [],
    provenance: emptyProvenanceForm("REFERENCE"),
  }
}

function fromRecord(r: Compound): FormState {
  return {
    name: r.name,
    pubchemCid: r.pubchemCid != null ? String(r.pubchemCid) : "",
    smiles: r.smiles ?? "",
    isomericSmiles: r.isomericSmiles ?? "",
    formula: r.formula ?? "",
    molecularWeight: r.molecularWeight != null ? String(r.molecularWeight) : "",
    chemicalClass: r.chemicalClass ?? "",
    plantPart: r.plantPart ?? "",
    source: r.source ?? "",
    isPrimaryMarker: r.isPrimaryMarker,
    notes: r.notes ?? "",
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

export default function PhytochemicalsCatalog() {
  const { user, profile } = useAuth()
  const { activeStudy, membership } = useStudy()
  const canEdit = canEditResearchData(membership?.role)
  const refs = useStudyReferences(activeStudy?.id)

  const [rows, setRows] = useState<Compound[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [markerOnly, setMarkerOnly] = useState(false)
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
      await seedDefaultResearchData(activeStudy.id, profile)
      const list = await listCompounds(activeStudy.id)
      setRows(list)
      setSelectedId((prev) => prev ?? list.find((c) => c.isPrimaryMarker)?.id ?? list[0]?.id ?? null)
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load compounds"))
    } finally {
      setLoading(false)
    }
  }, [activeStudy, profile])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (markerOnly && !r.isPrimaryMarker) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.formula ?? "").toLowerCase().includes(q) ||
        String(r.pubchemCid ?? "").includes(q) ||
        (r.chemicalClass ?? "").toLowerCase().includes(q)
      )
    })
  }, [rows, search, markerOnly])

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
    if (!form.name.trim()) {
      setError("Compound name is required.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const actor = { id: user.uid }
      const cid = form.pubchemCid.trim() ? Number(form.pubchemCid) : undefined
      const mw = form.molecularWeight.trim() ? Number(form.molecularWeight) : undefined
      const payload = {
        name: form.name.trim(),
        pubchemCid: cid != null && !Number.isNaN(cid) ? cid : undefined,
        smiles: form.smiles.trim() || undefined,
        isomericSmiles: form.isomericSmiles.trim() || undefined,
        formula: form.formula.trim() || undefined,
        molecularWeight: mw != null && !Number.isNaN(mw) ? mw : undefined,
        chemicalClass: form.chemicalClass.trim() || undefined,
        plantPart: form.plantPart.trim() || undefined,
        source: form.source.trim() || undefined,
        isPrimaryMarker: form.isPrimaryMarker,
        notes: form.notes.trim() || undefined,
        referenceIds: form.referenceIds,
        provenance: provenanceFromForm(form.provenance),
        evidenceClass: form.provenance.evidenceClass,
      }
      if (mode === "create") {
        const created = await createCompound(activeStudy.id, actor, payload)
        setSelectedId(created.id)
      } else if (mode === "edit" && selected) {
        const { evidenceClass: _e, ...patch } = payload
        await updateCompound(activeStudy.id, selected.id, actor, patch)
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
      await deleteCompound(activeStudy.id, deleteId, { id: user.uid })
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
        <PhytochemicalHero />
        <ResearchEmptyState
          title="No active study"
          body="Create or select a study first."
          canEdit={false}
        />
      </div>
    )
  }

  return (
    <div className="nano-formu space-y-5">
      <PhytochemicalHero
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
            placeholder="Search by name, CID, formula, class…"
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            aria-label="Search compounds"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs font-medium text-violet-900">
          <input
            type="checkbox"
            checked={markerOnly}
            onChange={(e) => setMarkerOnly(e.target.checked)}
            className="accent-violet-700"
          />
          Primary marker only
        </label>
        <span className="text-[11px] font-medium text-slate-400">
          {filtered.length} record{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-slate-400">Loading compounds…</p> : null}

      {!loading && filtered.length === 0 && mode === "view" ? (
        <ResearchEmptyState
          title="No compounds"
          body="Quercetin is seeded as the primary marker for new studies. Add identity records with PubChem provenance."
          canEdit={canEdit}
          actionLabel="Add compound"
          onAction={startCreate}
        />
      ) : !loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <aside className="nano-formu-list lg:col-span-4 xl:col-span-3">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Compounds
            </p>
            <div className="max-h-[560px] space-y-1 overflow-y-auto pr-0.5">
              {filtered.map((r) => {
                const active = r.id === selectedId && mode === "view"
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(r.id)
                      setMode("view")
                    }}
                    className={`nano-formu-list-item nano-phyt-list-item w-full text-left ${
                      active ? "nano-formu-list-item--active nano-phyt-list-item--active" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] font-semibold text-slate-900">
                        {r.name}
                      </span>
                      {r.isPrimaryMarker ? (
                        <span className="shrink-0 rounded-md bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-800">
                          Marker
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {r.pubchemCid != null ? `CID ${r.pubchemCid}` : "No CID"}
                      {r.formula ? ` · ${r.formula}` : ""}
                    </p>
                    {r.chemicalClass ? (
                      <p className="mt-0.5 truncate text-[10px] font-medium text-violet-700/80">
                        {r.chemicalClass}
                      </p>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="min-w-0 space-y-4 lg:col-span-8 xl:col-span-9">
            {(mode === "create" || mode === "edit") && (
              <div className="nano-formu-panel nano-phyt-panel space-y-4 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-violet-700/70">
                      {mode === "create" ? "Create" : "Edit"}
                    </p>
                    <h2 className="text-[15px] font-semibold text-slate-900">
                      {mode === "create" ? "New compound" : "Edit compound"}
                    </h2>
                  </div>
                  <button type="button" onClick={cancelForm} className="nano-icon-btn" aria-label="Cancel">
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
                  <FormField label="PubChem CID">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.pubchemCid}
                      onChange={(e) => setForm({ ...form, pubchemCid: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Molecular formula">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.formula}
                      onChange={(e) => setForm({ ...form, formula: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Molecular weight">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.molecularWeight}
                      onChange={(e) => setForm({ ...form, molecularWeight: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Chemical class">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.chemicalClass}
                      onChange={(e) => setForm({ ...form, chemicalClass: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Plant part">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={form.plantPart}
                      onChange={(e) => setForm({ ...form, plantPart: e.target.value })}
                    />
                  </FormField>
                </FieldGrid>

                <FormField label="Canonical SMILES">
                  <textarea
                    className={textareaClass}
                    style={inputStyle}
                    value={form.smiles}
                    onChange={(e) => setForm({ ...form, smiles: e.target.value })}
                  />
                </FormField>
                <FormField label="Isomeric SMILES">
                  <textarea
                    className={textareaClass}
                    style={inputStyle}
                    value={form.isomericSmiles}
                    onChange={(e) => setForm({ ...form, isomericSmiles: e.target.value })}
                  />
                </FormField>
                <FormField label="Source">
                  <input
                    className={inputClass}
                    style={inputStyle}
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
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

                <label className="flex items-center gap-2.5 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2.5 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isPrimaryMarker}
                    onChange={(e) => setForm({ ...form, isPrimaryMarker: e.target.checked })}
                    className="accent-violet-700"
                  />
                  Primary marker compound (e.g. Quercetin for this study)
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

                <div className="flex justify-end gap-2 border-t border-violet-50 pt-3">
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
                    className="rounded-xl bg-violet-700 px-3.5 py-2 text-xs font-semibold text-white transition-[filter] hover:brightness-105 disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}

            {mode === "view" && selected ? (
              <>
                <div className="nano-formu-panel nano-phyt-panel overflow-hidden">
                  <div className="border-b border-violet-100/80 bg-gradient-to-r from-violet-50/90 via-white to-cyan-50/40 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <EvidenceBadge type={selected.provenance.evidenceClass} />
                          {selected.isPrimaryMarker ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                              <Sparkles size={10} strokeWidth={2.5} aria-hidden />
                              Primary marker
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.02em] text-slate-900">
                          {selected.name}
                        </h2>
                        {selected.chemicalClass ? (
                          <p className="mt-1 text-[13px] text-slate-500">{selected.chemicalClass}</p>
                        ) : null}
                      </div>
                      {canEdit ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={startEdit}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50"
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
                      <IdentityStat
                        icon={Hash}
                        label="PubChem CID"
                        value={selected.pubchemCid != null ? String(selected.pubchemCid) : "—"}
                        tone="violet"
                      />
                      <IdentityStat
                        icon={Atom}
                        label="Formula"
                        value={selected.formula ?? "—"}
                        tone="cyan"
                      />
                      <IdentityStat
                        icon={FlaskConical}
                        label="Molecular weight"
                        value={
                          selected.molecularWeight != null ? `${selected.molecularWeight}` : "—"
                        }
                        tone="teal"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InfoBlock label="Plant part" value={selected.plantPart} />
                      <InfoBlock label="Source" value={selected.source} />
                    </div>

                    {selected.smiles ? (
                      <SmilesBlock label="Canonical SMILES" value={selected.smiles} />
                    ) : null}
                    {selected.isomericSmiles ? (
                      <SmilesBlock label="Isomeric SMILES" value={selected.isomericSmiles} />
                    ) : null}
                    {selected.notes ? <InfoBlock label="Notes" value={selected.notes} wide /> : null}

                    {selected.pubchemCid != null ? (
                      <a
                        href={`https://pubchem.ncbi.nlm.nih.gov/compound/${selected.pubchemCid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50/80 px-3 py-2 text-xs font-semibold text-cyan-900 transition-colors hover:bg-cyan-100"
                      >
                        Open PubChem
                        <ExternalLink size={12} aria-hidden />
                      </a>
                    ) : null}

                    <ProvenanceCard provenance={selected.provenance} />

                    {selected.referenceIds?.length > 0 ? (
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">
                          References
                        </p>
                        <ReferenceLinkList referenceIds={selected.referenceIds} references={refs} />
                      </div>
                    ) : null}
                  </div>
                </div>

                {selected.pubchemCid != null ? (
                  <div className="nano-formu-panel nano-phyt-panel overflow-hidden p-3 sm:p-4">
                    <p className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-700/70">
                      3D structure preview
                    </p>
                    <CompoundViewer3D cid={selected.pubchemCid} name={selected.name} />
                  </div>
                ) : null}
              </>
            ) : null}

            {mode === "view" && !selected && !loading ? (
              <ResearchEmptyState
                title="Select a compound"
                body="Choose a record from the list."
                canEdit={false}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete compound?"
        message="Removes this phytochemical identity record from the study."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
      />
    </div>
  )
}

function PhytochemicalHero({
  role,
  canEdit,
  onAdd,
}: {
  role?: string
  canEdit?: boolean
  onAdd?: () => void
}) {
  return (
    <section className="nano-phyt-hero relative overflow-hidden rounded-2xl border border-violet-200/80">
      <div className="nano-phyt-hero-wash" aria-hidden />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-800 ring-1 ring-violet-200/80">
              <FlaskConical size={11} strokeWidth={2.25} aria-hidden />
              Research data
            </span>
            <EvidenceBadge type="REFERENCE" />
            <EvidenceBadge type="LITERATURE" />
          </div>
          <h1 className="mt-2.5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.03em] text-slate-900">
            Phytochemicals
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-600">
            Compound identity catalog for this study. ADMET descriptors belong in the ADMET module when
            imported with provenance.
          </p>
          {role ? (
            <p className="mt-2 text-[11px] font-medium text-slate-400">{role} access</p>
          ) : null}
        </div>
        {canEdit && onAdd ? (
          <button type="button" onClick={onAdd} className="nano-phyt-add group shrink-0">
            <Plus size={15} strokeWidth={2.25} aria-hidden />
            Add compound
          </button>
        ) : null}
      </div>
    </section>
  )
}

function IdentityStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Hash
  label: string
  value: string
  tone: "violet" | "cyan" | "teal"
}) {
  const tones = {
    violet: { soft: "#f5f3ff", accent: "#6d28d9", border: "#ddd6fe" },
    cyan: { soft: "#ecfeff", accent: "#0e7490", border: "#a5f3fc" },
    teal: { soft: "#f0fdfa", accent: "#0f766e", border: "#99f6e4" },
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
      <p className="mt-1.5 truncate text-lg font-semibold tracking-tight text-slate-900">{value}</p>
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
    <div
      className={
        wide
          ? "rounded-xl border border-slate-200 bg-white px-3.5 py-3"
          : "rounded-xl border border-slate-200 bg-white px-3.5 py-3"
      }
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-800 break-words">{value}</p>
    </div>
  )
}

function SmilesBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400">{label}</p>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-slate-700 break-all">{value}</p>
    </div>
  )
}
