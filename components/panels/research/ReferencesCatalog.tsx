"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Library, Pencil, Trash2, X, ExternalLink } from "lucide-react"
import { ModuleShell } from "@/components/ui/ModuleShell"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useStudy } from "@/components/providers/StudyProvider"
import { useAuth } from "@/components/providers/AuthProvider"
import { canEditResearchData } from "@/lib/permissions/researchAccess"
import { ResearchToolbar } from "@/components/research/ResearchToolbar"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import { ProvenanceCard } from "@/components/research/ProvenanceCard"
import {
  FieldGrid,
  FormField,
  MetaField,
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
import type { ReferenceRecord } from "@/lib/domain/models"
import {
  createReference,
  deleteReference,
  listReferences,
  updateReference,
} from "@/lib/repositories/researchDataRepository"
import { toUserFacingError } from "@/lib/errors/userFacing"

type Mode = "view" | "create" | "edit"

interface FormState {
  title: string
  authors: string
  year: string
  journal: string
  doi: string
  pmid: string
  url: string
  retrievedAt: string
  notes: string
  citationText: string
  provenance: ProvenanceFormState
}

function blankForm(): FormState {
  const today = new Date().toISOString().slice(0, 10)
  return {
    title: "",
    authors: "",
    year: "",
    journal: "",
    doi: "",
    pmid: "",
    url: "",
    retrievedAt: today,
    notes: "",
    citationText: "",
    provenance: {
      ...emptyProvenanceForm("LITERATURE"),
      retrievedAt: today,
    },
  }
}

function fromRecord(r: ReferenceRecord): FormState {
  return {
    title: r.title,
    authors: r.authors ?? "",
    year: r.year ?? "",
    journal: r.journal ?? "",
    doi: r.doi ?? "",
    pmid: r.pmid ?? "",
    url: r.url ?? "",
    retrievedAt: (r.retrievedAt ?? "").slice(0, 10),
    notes: r.notes ?? "",
    citationText: r.citationText ?? "",
    provenance: {
      evidenceClass: r.provenance.evidenceClass,
      source: r.provenance.source ?? "",
      citation: r.provenance.citation ?? "",
      retrievedAt: (r.provenance.retrievedAt ?? r.retrievedAt ?? "").slice(0, 10),
      notesLimitation: r.provenance.limitations ?? "",
    },
  }
}

export default function ReferencesCatalog() {
  const { user, profile } = useAuth()
  const { activeStudy, membership } = useStudy()
  const canEdit = canEditResearchData(membership?.role)

  const [rows, setRows] = useState<ReferenceRecord[]>([])
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
      const list = await listReferences(activeStudy.id)
      setRows(list)
      setSelectedId((prev) => prev ?? list[0]?.id ?? null)
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load references"))
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
        r.title.toLowerCase().includes(q) ||
        (r.authors ?? "").toLowerCase().includes(q) ||
        (r.doi ?? "").toLowerCase().includes(q) ||
        (r.pmid ?? "").includes(q) ||
        (r.journal ?? "").toLowerCase().includes(q) ||
        (r.year ?? "").includes(q)
    )
  }, [rows, search])

  const selected = rows.find((r) => r.id === selectedId) ?? null

  const save = async () => {
    if (!activeStudy || !user) return
    const citationBits = [form.doi && `DOI:${form.doi}`, form.pmid && `PMID:${form.pmid}`, form.url]
      .filter(Boolean)
      .join(" · ")
    const prov = {
      ...form.provenance,
      citation: form.provenance.citation.trim() || citationBits,
      source: form.provenance.source.trim() || form.journal || "Literature",
      retrievedAt: form.retrievedAt || form.provenance.retrievedAt,
    }
    const provErr = validateResearchProvenance(prov)
    if (provErr) {
      setError(provErr)
      return
    }
    if (!form.title.trim()) {
      setError("Title is required.")
      return
    }
    if (!form.doi.trim() && !form.pmid.trim() && !form.url.trim() && !form.provenance.citation.trim()) {
      setError("Provide at least one of DOI, PMID, URL, or citation for LITERATURE.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const actor = { id: user.uid }
      const payload = {
        title: form.title.trim(),
        authors: form.authors.trim() || undefined,
        year: form.year.trim() || undefined,
        journal: form.journal.trim() || undefined,
        doi: form.doi.trim() || undefined,
        pmid: form.pmid.trim() || undefined,
        url: form.url.trim() || undefined,
        retrievedAt: form.retrievedAt.trim() || undefined,
        notes: form.notes.trim() || undefined,
        citationText: form.citationText.trim() || undefined,
        provenance: provenanceFromForm(prov),
      }
      if (mode === "create") {
        const created = await createReference(activeStudy.id, actor, payload)
        setSelectedId(created.id)
      } else if (mode === "edit" && selected) {
        await updateReference(activeStudy.id, selected.id, actor, payload)
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
      await deleteReference(activeStudy.id, deleteId, { id: user.uid })
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
      <ModuleShell icon={Library} title="References" subtitle="Select a study to manage citations." evidence="LITERATURE" phase="research">
        <ResearchEmptyState title="No active study" body="Create or select a study first." canEdit={false} />
      </ModuleShell>
    )
  }

  return (
    <ModuleShell
      icon={Library}
      title="References"
      subtitle="Reusable study citations. Link these IDs from Formulation, Compounds, Proteins, and Cell Lines."
      evidence="LITERATURE"
      phase="research"
      contractNote="Manually typed unsupported scientific claims must not be labeled LITERATURE. Prefer DOI / PMID / URL with retrieval date."
    >
      <ResearchToolbar
        search={search}
        onSearchChange={setSearch}
        canEdit={canEdit}
        role={membership?.role}
        onAdd={() => {
          setForm(blankForm())
          setMode("create")
        }}
        addLabel="Add reference"
        count={filtered.length}
      />

      {error && (
        <p className="text-xs rounded-lg px-3 py-2 border" style={{ color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}>
          {error}
        </p>
      )}
      {loading && <p className="text-sm" style={{ color: "#94a3b8" }}>Loading…</p>}

      {!loading && filtered.length === 0 && mode === "view" ? (
        <ResearchEmptyState
          title="No references"
          body="Add literature citations so Research Data records can link DOI/PMID provenance."
          canEdit={canEdit}
          actionLabel="Add reference"
          onAction={() => {
            setForm(blankForm())
            setMode("create")
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border p-3 space-y-1 max-h-[520px] overflow-y-auto" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedId(r.id)
                  setMode("view")
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold"
                style={{
                  background: r.id === selectedId ? "#00a88212" : "transparent",
                  color: r.id === selectedId ? "#00a882" : "#1a3558",
                }}
              >
                <span className="line-clamp-2">{r.title}</span>
                <div className="text-[10px] font-mono font-normal" style={{ color: "#94a3b8" }}>
                  {[r.year, r.journal].filter(Boolean).join(" · ") || "citation"}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {(mode === "create" || mode === "edit") && (
              <div className="rounded-xl border p-4 space-y-3" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
                    {mode === "create" ? "New reference" : "Edit reference"}
                  </h2>
                  <button type="button" onClick={() => setMode("view")}>
                    <X size={16} style={{ color: "#94a3b8" }} />
                  </button>
                </div>
                <FormField label="Title" required>
                  <input className={inputClass} style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </FormField>
                <FieldGrid>
                  <FormField label="Authors">
                    <input className={inputClass} style={inputStyle} value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
                  </FormField>
                  <FormField label="Year">
                    <input className={inputClass} style={inputStyle} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                  </FormField>
                  <FormField label="Journal / source">
                    <input className={inputClass} style={inputStyle} value={form.journal} onChange={(e) => setForm({ ...form, journal: e.target.value })} />
                  </FormField>
                  <FormField label="Retrieved date">
                    <input type="date" className={inputClass} style={inputStyle} value={form.retrievedAt} onChange={(e) => setForm({ ...form, retrievedAt: e.target.value })} />
                  </FormField>
                  <FormField label="DOI">
                    <input className={inputClass} style={inputStyle} value={form.doi} onChange={(e) => setForm({ ...form, doi: e.target.value })} />
                  </FormField>
                  <FormField label="PMID">
                    <input className={inputClass} style={inputStyle} value={form.pmid} onChange={(e) => setForm({ ...form, pmid: e.target.value })} />
                  </FormField>
                </FieldGrid>
                <FormField label="URL">
                  <input className={inputClass} style={inputStyle} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                </FormField>
                <FormField label="Formatted citation (optional)">
                  <textarea className={textareaClass} style={inputStyle} value={form.citationText} onChange={(e) => setForm({ ...form, citationText: e.target.value })} />
                </FormField>
                <FormField label="Notes">
                  <textarea className={textareaClass} style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </FormField>
                <ProvenanceFormFields value={form.provenance} onChange={(provenance) => setForm({ ...form, provenance })} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setMode("view")} className="rounded-lg px-3 py-1.5 text-xs font-semibold border" style={{ borderColor: "#dde5ef", color: "#546e8a" }}>Cancel</button>
                  <button type="button" disabled={busy} onClick={() => void save()} className="nano-setup-save">{busy ? "Saving…" : "Save"}</button>
                </div>
              </div>
            )}

            {mode === "view" && selected && (
              <div className="rounded-xl border p-4 space-y-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <EvidenceBadge type={selected.provenance.evidenceClass} />
                    </div>
                    <h2 className="text-lg font-bold" style={{ color: "#0d1f3c" }}>{selected.title}</h2>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setForm(fromRecord(selected)); setMode("edit") }} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: "#dde5ef", color: "#1a3558" }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button type="button" onClick={() => setDeleteId(selected.id)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: "#fecaca", color: "#b91c1c" }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
                <FieldGrid>
                  <MetaField label="Authors" value={selected.authors} />
                  <MetaField label="Year" value={selected.year} />
                  <MetaField label="Journal / source" value={selected.journal} />
                  <MetaField label="DOI" value={selected.doi} />
                  <MetaField label="PMID" value={selected.pmid} />
                  <MetaField label="Retrieved" value={selected.retrievedAt} />
                </FieldGrid>
                {selected.citationText && <MetaField label="Citation" value={selected.citationText} />}
                {selected.notes && <MetaField label="Notes" value={selected.notes} />}
                <div className="flex flex-wrap gap-3 text-xs font-semibold" style={{ color: "#0369a1" }}>
                  {selected.doi && (
                    <a href={`https://doi.org/${selected.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                      DOI <ExternalLink size={12} />
                    </a>
                  )}
                  {selected.pmid && (
                    <a href={`https://pubmed.ncbi.nlm.nih.gov/${selected.pmid}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                      PubMed <ExternalLink size={12} />
                    </a>
                  )}
                  {selected.url && (
                    <a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                      URL <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <ProvenanceCard provenance={selected.provenance} />
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete reference?"
        message="Removes this citation. Linked records will show a missing reference until updated."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
      />
    </ModuleShell>
  )
}
