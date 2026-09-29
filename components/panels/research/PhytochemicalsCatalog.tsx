"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FlaskConical, Pencil, Trash2, X, ExternalLink } from "lucide-react"
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
      <ModuleShell icon={FlaskConical} title="Phytochemicals" subtitle="Select a study to manage compounds." evidence="REFERENCE" phase="research">
        <ResearchEmptyState title="No active study" body="Create or select a study first." canEdit={false} />
      </ModuleShell>
    )
  }

  return (
    <ModuleShell
      icon={FlaskConical}
      title="Phytochemicals"
      subtitle="Firestore-backed compound identity catalog. ADMET descriptors are deferred to the ADMET module."
      evidence={["REFERENCE", "LITERATURE"]}
      phase="research"
      contractNote="LogP, HBD, HBA, TPSA, activity claims, and potency labels are not stored here unless independently provenanced later via ADMET / LITERATURE import."
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
        addLabel="Add compound"
        count={filtered.length}
        filterSlot={
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "#546e8a" }}>
            <input type="checkbox" checked={markerOnly} onChange={(e) => setMarkerOnly(e.target.checked)} />
            Primary marker only
          </label>
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
          title="No compounds"
          body="Quercetin is seeded as the primary marker for new studies. Add identity records with PubChem provenance."
          canEdit={canEdit}
          actionLabel="Add compound"
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
                  {r.pubchemCid != null ? `CID ${r.pubchemCid}` : "no CID"}
                  {r.isPrimaryMarker ? " · marker" : ""}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {(mode === "create" || mode === "edit") && (
              <div className="rounded-xl border p-4 space-y-3" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
                    {mode === "create" ? "New compound" : "Edit compound"}
                  </h2>
                  <button type="button" onClick={() => setMode("view")}>
                    <X size={16} style={{ color: "#94a3b8" }} />
                  </button>
                </div>
                <FieldGrid>
                  <FormField label="Name" required>
                    <input className={inputClass} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </FormField>
                  <FormField label="PubChem CID">
                    <input className={inputClass} style={inputStyle} value={form.pubchemCid} onChange={(e) => setForm({ ...form, pubchemCid: e.target.value })} />
                  </FormField>
                  <FormField label="Molecular formula">
                    <input className={inputClass} style={inputStyle} value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })} />
                  </FormField>
                  <FormField label="Molecular weight">
                    <input className={inputClass} style={inputStyle} value={form.molecularWeight} onChange={(e) => setForm({ ...form, molecularWeight: e.target.value })} />
                  </FormField>
                  <FormField label="Chemical class">
                    <input className={inputClass} style={inputStyle} value={form.chemicalClass} onChange={(e) => setForm({ ...form, chemicalClass: e.target.value })} />
                  </FormField>
                  <FormField label="Plant part">
                    <input className={inputClass} style={inputStyle} value={form.plantPart} onChange={(e) => setForm({ ...form, plantPart: e.target.value })} />
                  </FormField>
                </FieldGrid>
                <FormField label="Canonical SMILES">
                  <textarea className={textareaClass} style={inputStyle} value={form.smiles} onChange={(e) => setForm({ ...form, smiles: e.target.value })} />
                </FormField>
                <FormField label="Isomeric SMILES">
                  <textarea className={textareaClass} style={inputStyle} value={form.isomericSmiles} onChange={(e) => setForm({ ...form, isomericSmiles: e.target.value })} />
                </FormField>
                <FormField label="Source">
                  <input className={inputClass} style={inputStyle} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
                </FormField>
                <FormField label="Notes">
                  <textarea className={textareaClass} style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </FormField>
                <label className="flex items-center gap-2 text-xs" style={{ color: "#1a3558" }}>
                  <input type="checkbox" checked={form.isPrimaryMarker} onChange={(e) => setForm({ ...form, isPrimaryMarker: e.target.checked })} />
                  Primary marker compound (Quercetin for this study)
                </label>
                <FormField label="Linked references">
                  <ReferenceIdPicker references={refs} value={form.referenceIds} onChange={(referenceIds) => setForm({ ...form, referenceIds })} />
                </FormField>
                <ProvenanceFormFields value={form.provenance} onChange={(provenance) => setForm({ ...form, provenance })} />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setMode("view")} className="rounded-lg px-3 py-1.5 text-xs font-semibold border" style={{ borderColor: "#dde5ef", color: "#546e8a" }}>Cancel</button>
                  <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "#00a882" }}>{busy ? "Saving…" : "Save"}</button>
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
                        {selected.isPrimaryMarker && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border" style={{ color: "#00a882", borderColor: "#00a88244" }}>
                            Primary marker
                          </span>
                        )}
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
                    <MetaField label="PubChem CID" value={selected.pubchemCid} />
                    <MetaField label="Formula" value={selected.formula} />
                    <MetaField label="MW" value={selected.molecularWeight} />
                    <MetaField label="Class" value={selected.chemicalClass} />
                    <MetaField label="Plant part" value={selected.plantPart} />
                    <MetaField label="Source" value={selected.source} />
                  </FieldGrid>
                  {selected.smiles && <MetaField label="SMILES" value={<span className="font-mono text-xs break-all">{selected.smiles}</span>} />}
                  {selected.isomericSmiles && <MetaField label="Isomeric SMILES" value={<span className="font-mono text-xs break-all">{selected.isomericSmiles}</span>} />}
                  {selected.notes && <MetaField label="Notes" value={selected.notes} />}
                  {selected.pubchemCid != null && (
                    <a
                      href={`https://pubchem.ncbi.nlm.nih.gov/compound/${selected.pubchemCid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: "#0369a1" }}
                    >
                      Open PubChem <ExternalLink size={12} />
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
                {selected.pubchemCid != null && (
                  <div className="rounded-xl border p-3" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                    <CompoundViewer3D cid={selected.pubchemCid} name={selected.name} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete compound?"
        message="Removes this phytochemical identity record from the study."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
      />
    </ModuleShell>
  )
}
