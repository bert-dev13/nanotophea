"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Leaf, Pencil, Trash2, X } from "lucide-react"
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
import type { Formulation } from "@/lib/domain/models"
import {
  createFormulation,
  deleteFormulation,
  listFormulations,
  updateFormulation,
} from "@/lib/repositories/researchDataRepository"
import { seedDefaultResearchData } from "@/lib/seed/defaultResearchData"
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
      await seedDefaultResearchData(activeStudy.id, profile)
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
      <ModuleShell
        icon={Leaf}
        title="Formulation"
        subtitle="Select or create a study to manage formulations."
        evidence="REFERENCE"
        phase="research"
      >
        <ResearchEmptyState
          title="No active study"
          body="Create a study from the toolbar to load the locked NanoHepatoTea formulation."
          canEdit={false}
        />
      </ModuleShell>
    )
  }

  return (
    <ModuleShell
      icon={Leaf}
      title="Formulation"
      subtitle="Canonical NanoHepatoTea composition and preparation context for this study."
      evidence={["REFERENCE", "LITERATURE"]}
      phase="research"
      contractNote="Clinical Dosage Planner removed. This module stores research formulation metadata only — not patient dosing schedules."
    >
      <ResearchToolbar
        search={search}
        onSearchChange={setSearch}
        canEdit={canEdit}
        role={membership?.role}
        onAdd={startCreate}
        addLabel="Add formulation"
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
          title="No formulations"
          body="Seeded NanoHepatoTea appears for new studies. Add a formulation with provenance, or re-open after study create."
          canEdit={canEdit}
          actionLabel="Add formulation"
          onAction={startCreate}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div
            className="rounded-xl border p-3 space-y-1 max-h-[520px] overflow-y-auto"
            style={{ background: "#ffffff", borderColor: "#dde5ef" }}
          >
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
                  {r.leafMassG} g leaf · {r.nanocarrierMassG} g Chitosan–TPP
                  {r.isCanonical ? " · canonical" : ""}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {(mode === "create" || mode === "edit") && (
              <div className="rounded-xl border p-4 space-y-3" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
                    {mode === "create" ? "New formulation" : "Edit formulation"}
                  </h2>
                  <button type="button" onClick={cancelForm} aria-label="Cancel">
                    <X size={16} style={{ color: "#94a3b8" }} />
                  </button>
                </div>
                <FieldGrid>
                  <FormField label="Name" required>
                    <input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </FormField>
                  <FormField label="Marker compound">
                    <input className={inputClass} style={inputStyle} value={form.markerCompound} onChange={(e) => setForm({ ...form, markerCompound: e.target.value })} />
                  </FormField>
                  <FormField label="Plant / material">
                    <input className={inputClass} style={inputStyle} value={form.plantMaterial} onChange={(e) => setForm({ ...form, plantMaterial: e.target.value })} />
                  </FormField>
                  <FormField label="Scientific name">
                    <input className={inputClass} style={inputStyle} value={form.scientificName} onChange={(e) => setForm({ ...form, scientificName: e.target.value })} />
                  </FormField>
                  <FormField label="Dried leaf mass (g)" required>
                    <input className={inputClass} style={inputStyle} value={form.leafMassG} onChange={(e) => setForm({ ...form, leafMassG: e.target.value })} />
                  </FormField>
                  <FormField label="Chitosan–TPP mass (g)" required>
                    <input className={inputClass} style={inputStyle} value={form.nanocarrierMassG} onChange={(e) => setForm({ ...form, nanocarrierMassG: e.target.value })} />
                  </FormField>
                </FieldGrid>
                <FormField label="Preparation / method notes">
                  <textarea className={textareaClass} style={inputStyle} value={form.methodNotes} onChange={(e) => setForm({ ...form, methodNotes: e.target.value })} />
                </FormField>
                <FormField label="Storage notes">
                  <textarea className={textareaClass} style={inputStyle} value={form.storageNotes} onChange={(e) => setForm({ ...form, storageNotes: e.target.value })} />
                </FormField>
                <FormField label="Notes">
                  <textarea className={textareaClass} style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </FormField>
                <label className="flex items-center gap-2 text-xs" style={{ color: "#1a3558" }}>
                  <input type="checkbox" checked={form.isCanonical} onChange={(e) => setForm({ ...form, isCanonical: e.target.checked })} />
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
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={cancelForm} className="rounded-lg px-3 py-1.5 text-xs font-semibold border" style={{ borderColor: "#dde5ef", color: "#546e8a" }}>
                    Cancel
                  </button>
                  <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "#00a882" }}>
                    {busy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}

            {mode === "view" && selected && (
              <div className="rounded-xl border p-4 space-y-4" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <EvidenceBadge type={selected.provenance.evidenceClass} />
                      {selected.isCanonical && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border" style={{ color: "#00a882", borderColor: "#00a88244" }}>
                          Canonical
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold" style={{ color: "#0d1f3c" }}>{selected.name}</h2>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button type="button" onClick={startEdit} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: "#dde5ef", color: "#1a3558" }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button type="button" onClick={() => setDeleteId(selected.id)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: "#fecaca", color: "#b91c1c" }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
                <FieldGrid>
                  <MetaField label="Plant / material" value={selected.plantMaterial} />
                  <MetaField label="Scientific name" value={selected.scientificName} />
                  <MetaField label="Dried leaf mass" value={`${selected.leafMassG} g`} />
                  <MetaField label="Chitosan–TPP mass" value={`${selected.nanocarrierMassG} g`} />
                  <MetaField label="Total mass" value={`${selected.totalMassG} g`} />
                  <MetaField label="Marker compound" value={selected.markerCompound} />
                </FieldGrid>
                {selected.methodNotes && <MetaField label="Method notes" value={selected.methodNotes} />}
                {selected.storageNotes && <MetaField label="Storage notes" value={selected.storageNotes} />}
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

            {mode === "view" && !selected && !loading && (
              <ResearchEmptyState title="Select a formulation" body="Choose a record from the list." canEdit={false} />
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete formulation?"
        message="This removes the formulation record from the current study. This cannot be undone."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
      />
    </ModuleShell>
  )
}
