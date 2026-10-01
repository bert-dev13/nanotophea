"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Atom, Pencil, Trash2, X, ExternalLink } from "lucide-react"
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
import {
  ReferenceIdPicker,
  ReferenceLinkList,
  useStudyReferences,
} from "@/components/research/ReferenceLinks"
import { ProteinViewer3D } from "@/lib/mol3d"
import type { Protein } from "@/lib/domain/models"
import {
  createProtein,
  deleteProtein,
  listProteins,
  updateProtein,
} from "@/lib/repositories/researchDataRepository"
import { toUserFacingError } from "@/lib/errors/userFacing"

type Mode = "view" | "create" | "edit"

interface FormState {
  name: string
  gene: string
  pdbId: string
  pathway: string
  role: string
  functionNotes: string
  source: string
  notes: string
  referenceIds: string[]
  provenance: ProvenanceFormState
}

function blankForm(): FormState {
  return {
    name: "",
    gene: "",
    pdbId: "",
    pathway: "",
    role: "",
    functionNotes: "",
    source: "RCSB PDB",
    notes: "",
    referenceIds: [],
    provenance: emptyProvenanceForm("REFERENCE"),
  }
}

function fromRecord(r: Protein): FormState {
  return {
    name: r.name,
    gene: r.gene ?? "",
    pdbId: r.pdbId ?? "",
    pathway: r.pathway ?? "",
    role: r.role ?? "",
    functionNotes: r.functionNotes ?? "",
    source: r.source ?? "",
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

export default function ProteinsCatalog() {
  const { user, profile } = useAuth()
  const { activeStudy, membership } = useStudy()
  const canEdit = canEditResearchData(membership?.role)
  const refs = useStudyReferences(activeStudy?.id)

  const [rows, setRows] = useState<Protein[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [pathwayFilter, setPathwayFilter] = useState("all")
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
      const list = await listProteins(activeStudy.id)
      setRows(list)
      setSelectedId((prev) => prev ?? list[0]?.id ?? null)
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load proteins"))
    } finally {
      setLoading(false)
    }
  }, [activeStudy, profile])

  useEffect(() => {
    void load()
  }, [load])

  const pathways = useMemo(() => {
    const set = new Set(rows.map((r) => r.pathway).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (pathwayFilter !== "all" && r.pathway !== pathwayFilter) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.gene ?? "").toLowerCase().includes(q) ||
        (r.pdbId ?? "").toLowerCase().includes(q) ||
        (r.pathway ?? "").toLowerCase().includes(q)
      )
    })
  }, [rows, search, pathwayFilter])

  const selected = rows.find((r) => r.id === selectedId) ?? null

  const save = async () => {
    if (!activeStudy || !user) return
    const provErr = validateResearchProvenance(form.provenance)
    if (provErr) {
      setError(provErr)
      return
    }
    if (!form.name.trim()) {
      setError("Protein name is required.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const actor = { id: user.uid }
      const payload = {
        name: form.name.trim(),
        gene: form.gene.trim() || undefined,
        pdbId: form.pdbId.trim() || undefined,
        pathway: form.pathway.trim() || undefined,
        role: form.role.trim() || undefined,
        functionNotes: form.functionNotes.trim() || undefined,
        source: form.source.trim() || undefined,
        notes: form.notes.trim() || undefined,
        referenceIds: form.referenceIds,
        provenance: provenanceFromForm(form.provenance),
      }
      if (mode === "create") {
        const created = await createProtein(activeStudy.id, actor, payload)
        setSelectedId(created.id)
      } else if (mode === "edit" && selected) {
        await updateProtein(activeStudy.id, selected.id, actor, payload)
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
      await deleteProtein(activeStudy.id, deleteId, { id: user.uid })
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
      <ModuleShell icon={Atom} title="Target Proteins" subtitle="Select a study to manage protein targets." evidence="REFERENCE" phase="research">
        <ResearchEmptyState title="No active study" body="Create or select a study first." canEdit={false} />
      </ModuleShell>
    )
  }

  return (
    <ModuleShell
      icon={Atom}
      title="Target Proteins"
      subtitle="Identity catalog for HCC / oxidative-stress related targets. Docking metrics belong under Molecular Docking."
      evidence={["REFERENCE", "LITERATURE"]}
      phase="research"
      contractNote="ΔG, Ki, RMSD, confidence %, and fold-change values are not stored on Protein records. Import docking results into dockingRuns later."
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
        addLabel="Add protein"
        count={filtered.length}
        filterSlot={
          <select
            className="rounded-lg border px-2 py-1.5 text-xs"
            style={{ borderColor: "#dde5ef", color: "#1a3558" }}
            value={pathwayFilter}
            onChange={(e) => setPathwayFilter(e.target.value)}
          >
            <option value="all">All pathways</option>
            {pathways.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        }
      />

      {error && (
        <p className="text-xs rounded-lg px-3 py-2 border" style={{ color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}>
          {error}
        </p>
      )}
      {loading && <p className="text-sm" style={{ color: "#94a3b8" }}>Loading…</p>}

      {!loading && filtered.length === 0 && mode === "view" ? (
        <ResearchEmptyState
          title="No proteins"
          body="Key Hippo–YAP and apoptosis targets are seeded for new studies."
          canEdit={canEdit}
          actionLabel="Add protein"
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
                {r.name}
                <div className="text-[10px] font-mono font-normal" style={{ color: "#94a3b8" }}>
                  {r.gene ?? "—"} · PDB {r.pdbId ?? "—"}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {(mode === "create" || mode === "edit") && (
              <div className="rounded-xl border p-4 space-y-3" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
                    {mode === "create" ? "New protein" : "Edit protein"}
                  </h2>
                  <button type="button" onClick={() => setMode("view")}>
                    <X size={16} style={{ color: "#94a3b8" }} />
                  </button>
                </div>
                <FieldGrid>
                  <FormField label="Name" required>
                    <input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </FormField>
                  <FormField label="Gene symbol">
                    <input className={inputClass} style={inputStyle} value={form.gene} onChange={(e) => setForm({ ...form, gene: e.target.value })} />
                  </FormField>
                  <FormField label="PDB ID">
                    <input className={inputClass} style={inputStyle} value={form.pdbId} onChange={(e) => setForm({ ...form, pdbId: e.target.value })} />
                  </FormField>
                  <FormField label="Pathway">
                    <input className={inputClass} style={inputStyle} value={form.pathway} onChange={(e) => setForm({ ...form, pathway: e.target.value })} />
                  </FormField>
                  <FormField label="Biological role">
                    <input className={inputClass} style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
                  </FormField>
                  <FormField label="Source">
                    <input className={inputClass} style={inputStyle} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
                  </FormField>
                </FieldGrid>
                <FormField label="Function / biological notes">
                  <textarea className={textareaClass} style={inputStyle} value={form.functionNotes} onChange={(e) => setForm({ ...form, functionNotes: e.target.value })} />
                </FormField>
                <FormField label="Notes">
                  <textarea className={textareaClass} style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </FormField>
                <FormField label="Linked references">
                  <ReferenceIdPicker references={refs} value={form.referenceIds} onChange={(referenceIds) => setForm({ ...form, referenceIds })} />
                </FormField>
                <ProvenanceFormFields value={form.provenance} onChange={(provenance) => setForm({ ...form, provenance })} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setMode("view")} className="rounded-lg px-3 py-1.5 text-xs font-semibold border" style={{ borderColor: "#dde5ef", color: "#546e8a" }}>Cancel</button>
                  <button type="button" disabled={busy} onClick={() => void save()} className="nano-setup-save">{busy ? "Saving…" : "Save"}</button>
                </div>
              </div>
            )}

            {mode === "view" && selected && (
              <>
                <div className="rounded-xl border p-4 space-y-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <EvidenceBadge type={selected.provenance.evidenceClass} />
                      </div>
                      <h2 className="text-lg font-bold" style={{ color: "#0d1f3c" }}>{selected.name}</h2>
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
                    <MetaField label="Gene" value={selected.gene} />
                    <MetaField label="PDB ID" value={selected.pdbId} />
                    <MetaField label="Pathway" value={selected.pathway} />
                    <MetaField label="Role" value={selected.role} />
                    <MetaField label="Source" value={selected.source} />
                  </FieldGrid>
                  {selected.functionNotes && <MetaField label="Biological role / function" value={selected.functionNotes} />}
                  {selected.notes && <MetaField label="Notes" value={selected.notes} />}
                  {selected.pdbId && (
                    <a
                      href={`https://www.rcsb.org/structure/${selected.pdbId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: "#0369a1" }}
                    >
                      Open RCSB PDB <ExternalLink size={12} />
                    </a>
                  )}
                  <ProvenanceCard provenance={selected.provenance} />
                  {selected.referenceIds?.length > 0 && (
                    <div>
                      <div className="text-[10px] font-mono uppercase mb-1" style={{ color: "#94a3b8" }}>References</div>
                      <ReferenceLinkList referenceIds={selected.referenceIds} references={refs} />
                    </div>
                  )}
                </div>
                {selected.pdbId && (
                  <div className="rounded-xl border p-3" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                    <ProteinViewer3D pdbId={selected.pdbId} name={selected.name} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete protein?"
        message="Removes this target identity record from the study."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
      />
    </ModuleShell>
  )
}
