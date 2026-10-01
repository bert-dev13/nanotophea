"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Microscope, Pencil, Trash2, X } from "lucide-react"
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
import type { CellLineRecord } from "@/lib/domain/models"
import {
  createCellLine,
  deleteCellLine,
  listCellLines,
  updateCellLine,
} from "@/lib/repositories/researchDataRepository"
import { toUserFacingError } from "@/lib/errors/userFacing"

type Mode = "view" | "create" | "edit"

interface FormState {
  name: string
  fullName: string
  organism: string
  tissueOrigin: string
  diseaseContext: string
  lineType: "cancer" | "normal" | "other"
  p53Status: string
  hbvStatus: string
  sourceDatabase: string
  isPrimaryExperimental: boolean
  notes: string
  referenceIds: string[]
  provenance: ProvenanceFormState
}

function blankForm(): FormState {
  return {
    name: "",
    fullName: "",
    organism: "Homo sapiens",
    tissueOrigin: "Liver",
    diseaseContext: "",
    lineType: "cancer",
    p53Status: "",
    hbvStatus: "",
    sourceDatabase: "",
    isPrimaryExperimental: false,
    notes: "",
    referenceIds: [],
    provenance: emptyProvenanceForm("REFERENCE"),
  }
}

function fromRecord(r: CellLineRecord): FormState {
  return {
    name: r.name,
    fullName: r.fullName ?? "",
    organism: r.organism ?? "",
    tissueOrigin: r.tissueOrigin ?? "",
    diseaseContext: r.diseaseContext ?? "",
    lineType: r.lineType,
    p53Status: r.p53Status ?? "",
    hbvStatus: r.hbvStatus ?? "",
    sourceDatabase: r.sourceDatabase ?? "",
    isPrimaryExperimental: r.isPrimaryExperimental,
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

export default function CellLinesCatalog() {
  const { user, profile } = useAuth()
  const { activeStudy, membership } = useStudy()
  const canEdit = canEditResearchData(membership?.role)
  const refs = useStudyReferences(activeStudy?.id)

  const [rows, setRows] = useState<CellLineRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "cancer" | "normal" | "other">("all")
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
      const list = await listCellLines(activeStudy.id)
      setRows(list)
      setSelectedId((prev) => prev ?? list.find((c) => c.isPrimaryExperimental)?.id ?? list[0]?.id ?? null)
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load cell lines"))
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
      if (typeFilter !== "all" && r.lineType !== typeFilter) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.fullName ?? "").toLowerCase().includes(q) ||
        (r.diseaseContext ?? "").toLowerCase().includes(q) ||
        (r.tissueOrigin ?? "").toLowerCase().includes(q)
      )
    })
  }, [rows, search, typeFilter])

  const selected = rows.find((r) => r.id === selectedId) ?? null

  const save = async () => {
    if (!activeStudy || !user) return
    const provErr = validateResearchProvenance(form.provenance)
    if (provErr) {
      setError(provErr)
      return
    }
    if (!form.name.trim()) {
      setError("Cell line name is required.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const actor = { id: user.uid }
      const payload = {
        name: form.name.trim(),
        fullName: form.fullName.trim() || undefined,
        organism: form.organism.trim() || undefined,
        tissueOrigin: form.tissueOrigin.trim() || undefined,
        diseaseContext: form.diseaseContext.trim() || undefined,
        lineType: form.lineType,
        p53Status: form.p53Status.trim() || undefined,
        hbvStatus: form.hbvStatus.trim() || undefined,
        sourceDatabase: form.sourceDatabase.trim() || undefined,
        isPrimaryExperimental: form.isPrimaryExperimental,
        notes: form.notes.trim() || undefined,
        referenceIds: form.referenceIds,
        provenance: provenanceFromForm(form.provenance),
      }
      if (mode === "create") {
        const created = await createCellLine(activeStudy.id, actor, payload)
        setSelectedId(created.id)
      } else if (mode === "edit" && selected) {
        await updateCellLine(activeStudy.id, selected.id, actor, payload)
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
      await deleteCellLine(activeStudy.id, deleteId, { id: user.uid })
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
      <ModuleShell icon={Microscope} title="Cell Lines" subtitle="Select a study to manage cell-line records." evidence="REFERENCE" phase="research">
        <ResearchEmptyState title="No active study" body="Create or select a study first." canEdit={false} />
      </ModuleShell>
    )
  }

  return (
    <ModuleShell
      icon={Microscope}
      title="Cell Lines"
      subtitle="HepG2 is the primary experimental line. Other lines may exist as REFERENCE / LITERATURE context only."
      evidence={["REFERENCE", "LITERATURE"]}
      phase="research"
      contractNote="Legacy IC50 values and simulated dose–response curves are not migrated. Experimental numbers belong in Laboratory Results with EXPERIMENTAL provenance."
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
        addLabel="Add cell line"
        count={filtered.length}
        filterSlot={
          <select
            className="rounded-lg border px-2 py-1.5 text-xs"
            style={{ borderColor: "#dde5ef", color: "#1a3558" }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          >
            <option value="all">All types</option>
            <option value="cancer">Cancer</option>
            <option value="normal">Normal</option>
            <option value="other">Other</option>
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
          title="No cell lines"
          body="HepG2 is seeded as the primary experimental line for new studies."
          canEdit={canEdit}
          actionLabel="Add cell line"
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
                  {r.lineType}
                  {r.isPrimaryExperimental ? " · primary experimental" : ""}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {(mode === "create" || mode === "edit") && (
              <div className="rounded-xl border p-4 space-y-3" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
                    {mode === "create" ? "New cell line" : "Edit cell line"}
                  </h2>
                  <button type="button" onClick={() => setMode("view")}>
                    <X size={16} style={{ color: "#94a3b8" }} />
                  </button>
                </div>
                <FieldGrid>
                  <FormField label="Name" required>
                    <input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </FormField>
                  <FormField label="Full name">
                    <input className={inputClass} style={inputStyle} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                  </FormField>
                  <FormField label="Organism">
                    <input className={inputClass} style={inputStyle} value={form.organism} onChange={(e) => setForm({ ...form, organism: e.target.value })} />
                  </FormField>
                  <FormField label="Tissue / origin">
                    <input className={inputClass} style={inputStyle} value={form.tissueOrigin} onChange={(e) => setForm({ ...form, tissueOrigin: e.target.value })} />
                  </FormField>
                  <FormField label="Disease / context">
                    <input className={inputClass} style={inputStyle} value={form.diseaseContext} onChange={(e) => setForm({ ...form, diseaseContext: e.target.value })} />
                  </FormField>
                  <FormField label="Line type">
                    <select className={inputClass} style={inputStyle} value={form.lineType} onChange={(e) => setForm({ ...form, lineType: e.target.value as FormState["lineType"] })}>
                      <option value="cancer">Cancer</option>
                      <option value="normal">Normal</option>
                      <option value="other">Other</option>
                    </select>
                  </FormField>
                  <FormField label="p53 status">
                    <input className={inputClass} style={inputStyle} value={form.p53Status} onChange={(e) => setForm({ ...form, p53Status: e.target.value })} />
                  </FormField>
                  <FormField label="HBV status">
                    <input className={inputClass} style={inputStyle} value={form.hbvStatus} onChange={(e) => setForm({ ...form, hbvStatus: e.target.value })} />
                  </FormField>
                  <FormField label="Source / database">
                    <input className={inputClass} style={inputStyle} value={form.sourceDatabase} onChange={(e) => setForm({ ...form, sourceDatabase: e.target.value })} />
                  </FormField>
                </FieldGrid>
                <FormField label="Notes">
                  <textarea className={textareaClass} style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </FormField>
                <label className="flex items-center gap-2 text-xs" style={{ color: "#1a3558" }}>
                  <input type="checkbox" checked={form.isPrimaryExperimental} onChange={(e) => setForm({ ...form, isPrimaryExperimental: e.target.checked })} />
                  Primary experimental cell line (HepG2 for this study)
                </label>
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
              <div className="rounded-xl border p-4 space-y-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <EvidenceBadge type={selected.provenance.evidenceClass} />
                      {selected.isPrimaryExperimental && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border" style={{ color: "#00a882", borderColor: "#00a88244" }}>
                          Primary experimental
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold" style={{ color: "#0d1f3c" }}>{selected.name}</h2>
                    {selected.fullName && <p className="text-sm" style={{ color: "#546e8a" }}>{selected.fullName}</p>}
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
                  <MetaField label="Organism" value={selected.organism} />
                  <MetaField label="Tissue / origin" value={selected.tissueOrigin} />
                  <MetaField label="Disease / context" value={selected.diseaseContext} />
                  <MetaField label="Type" value={selected.lineType} />
                  <MetaField label="p53" value={selected.p53Status} />
                  <MetaField label="HBV" value={selected.hbvStatus} />
                  <MetaField label="Source / database" value={selected.sourceDatabase} />
                </FieldGrid>
                {selected.notes && <MetaField label="Notes" value={selected.notes} />}
                <ProvenanceCard provenance={selected.provenance} />
                {selected.referenceIds?.length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono uppercase mb-1" style={{ color: "#94a3b8" }}>References</div>
                    <ReferenceLinkList referenceIds={selected.referenceIds} references={refs} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete cell line?"
        message="Removes this cell-line identity record from the study."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
      />
    </ModuleShell>
  )
}
