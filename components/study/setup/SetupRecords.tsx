"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import {
  CATALOG_CELL_LINES,
  CATALOG_COMPOUNDS,
  CATALOG_FORMULATIONS,
  CATALOG_PROTEINS,
  type CatalogCellLine,
  type CatalogCompound,
  type CatalogFormulation,
  type CatalogProtein,
} from "@/lib/catalog/reusableResearchCatalog"
import type { CellLineRecord, Compound, Formulation, FormulationComponent, Protein } from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { canEditResearchData } from "@/lib/permissions/researchAccess"
import {
  createCellLine,
  createCompound,
  createFormulation,
  createProtein,
  deleteCellLine,
  deleteCompound,
  deleteFormulation,
  deleteProtein,
  listCellLines,
  listCompounds,
  listFormulations,
  listProteins,
  updateCellLine,
  updateCompound,
  updateFormulation,
  updateProtein,
} from "@/lib/repositories/researchDataRepository"

export type SetupCategory = "formulation" | "phytochemicals" | "proteins" | "cell-line"

const COPY: Record<SetupCategory, { empty: string; add: string; catalog: string }> = {
  formulation: {
    empty: "No formulations yet. Define at least one before this step can continue.",
    add: "Add formulation",
    catalog: "Add a known formulation",
  },
  phytochemicals: {
    empty: "No phytochemicals yet. Add each compound this study will investigate.",
    add: "Add phytochemical",
    catalog: "Add a known compound",
  },
  proteins: {
    empty: "No target proteins yet. Add each protein planned for molecular docking.",
    add: "Add target protein",
    catalog: "Add a known protein",
  },
  "cell-line": {
    empty: "No cell lines yet. Define the experimental models for this study.",
    add: "Add cell line",
    catalog: "Add a known cell line",
  },
}

export function SetupRecords({
  category,
  onChanged,
}: {
  category: SetupCategory
  onChanged: () => void
}) {
  const { user } = useAuth()
  const { activeStudy, membership, updateActiveStudy } = useStudy()
  const canEdit = canEditResearchData(membership?.role)
  const [rows, setRows] = useState<Array<Formulation | Compound | Protein | CellLineRecord>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"list" | "create" | "edit">("list")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(blankDraft(category))
  const [busy, setBusy] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeStudy) return
    setLoading(true)
    setError(null)
    try {
      const list = await listFor(category, activeStudy.id)
      setRows(list)
    } catch (e) {
      setError(toUserFacingError(e, "Could not load these records"))
    } finally {
      setLoading(false)
    }
  }, [activeStudy, category])

  useEffect(() => {
    void load()
  }, [load])

  const syncStudy = async (nextRows: Array<Formulation | Compound | Protein | CellLineRecord>) => {
    if (!activeStudy) return
    if (category === "formulation") {
      const first = nextRows[0] as Formulation | undefined
      await updateActiveStudy({ formulationSummary: first ? formulationLine(first) : "" })
    }
    if (category === "cell-line") {
      const lines = nextRows as CellLineRecord[]
      const primary = lines.find((line) => line.isPrimaryExperimental) ?? lines[0]
      await updateActiveStudy({ primaryCellLine: primary?.name ?? "" })
    }
  }

  const save = async () => {
    if (!activeStudy || !user || !canEdit) return
    const name = draft.name.trim()
    if (name.length < 1) {
      setError("Enter a name before saving.")
      return
    }
    const components = cleanComponents(draft.components)
    setBusy(true)
    setError(null)
    try {
      const actor = { id: user.uid }
      const provenance = draft.source.trim() ? { source: draft.source.trim() } : undefined
      if (category === "formulation") {
        const body = {
          name,
          plantMaterial: draft.plant.trim() || undefined,
          scientificName: draft.scientificName.trim() || undefined,
          components,
          methodNotes: draft.method.trim() || undefined,
          storageNotes: draft.storage.trim() || undefined,
          notes: draft.notes.trim() || undefined,
        }
        if (mode === "edit" && editingId) await updateFormulation(activeStudy.id, editingId, actor, body)
        else await createFormulation(activeStudy.id, actor, { ...body, referenceIds: [], isCanonical: false, provenance })
      } else if (category === "phytochemicals") {
        const pubchemCid = draft.pubchemCid.trim() ? Number(draft.pubchemCid) : undefined
        if (pubchemCid != null && !Number.isFinite(pubchemCid)) {
          setError("PubChem CID must be a number.")
          setBusy(false)
          return
        }
        const body = {
          name,
          chemicalClass: draft.chemicalClass.trim() || undefined,
          formula: draft.formula.trim() || undefined,
          smiles: draft.smiles.trim() || undefined,
          pubchemCid,
          plantPart: draft.plantPart.trim() || undefined,
          source: draft.source.trim() || undefined,
          notes: draft.notes.trim() || undefined,
        }
        if (mode === "edit" && editingId) await updateCompound(activeStudy.id, editingId, actor, body)
        else await createCompound(activeStudy.id, actor, { ...body, referenceIds: [], isPrimaryMarker: false, provenance })
      } else if (category === "proteins") {
        const body = {
          name,
          gene: draft.gene.trim() || undefined,
          pdbId: draft.pdbId.trim() || undefined,
          pathway: draft.pathway.trim() || undefined,
          role: draft.role.trim() || undefined,
          functionNotes: draft.notes.trim() || undefined,
          source: draft.source.trim() || undefined,
        }
        if (mode === "edit" && editingId) await updateProtein(activeStudy.id, editingId, actor, body)
        else await createProtein(activeStudy.id, actor, { ...body, referenceIds: [], provenance })
      } else {
        const body = {
          name,
          fullName: draft.fullName.trim() || undefined,
          organism: draft.organism.trim() || undefined,
          tissueOrigin: draft.tissue.trim() || undefined,
          diseaseContext: draft.disease.trim() || undefined,
          lineType: draft.lineType,
          notes: draft.notes.trim() || undefined,
          sourceDatabase: draft.source.trim() || undefined,
          isPrimaryExperimental: rows.length === 0,
        }
        if (mode === "edit" && editingId) await updateCellLine(activeStudy.id, editingId, actor, body)
        else await createCellLine(activeStudy.id, actor, { ...body, referenceIds: [], provenance })
      }
      const list = await listFor(category, activeStudy.id)
      setRows(list)
      await syncStudy(list)
      setMode("list")
      setEditingId(null)
      onChanged()
    } catch (e) {
      setError(toUserFacingError(e, "Could not save this record"))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!activeStudy || !user || !canEdit) return
    setBusy(true)
    setError(null)
    try {
      const actor = { id: user.uid }
      if (category === "formulation") await deleteFormulation(activeStudy.id, id, actor)
      else if (category === "phytochemicals") await deleteCompound(activeStudy.id, id, actor)
      else if (category === "proteins") await deleteProtein(activeStudy.id, id, actor)
      else await deleteCellLine(activeStudy.id, id, actor)
      const list = await listFor(category, activeStudy.id)
      setRows(list)
      await syncStudy(list)
      setPendingDelete(null)
      if (editingId === id) setMode("list")
      onChanged()
    } catch (e) {
      setError(toUserFacingError(e, "Could not delete this record"))
    } finally {
      setBusy(false)
    }
  }

  const addCatalog = async (key: string) => {
    if (!activeStudy || !user || !canEdit) return
    setBusy(true)
    setError(null)
    try {
      const actor = { id: user.uid }
      if (category === "formulation") {
        const item = CATALOG_FORMULATIONS.find((row) => row.key === key)
        if (!item) return
        await createFormulation(activeStudy.id, actor, { ...catalogFormulation(item), referenceIds: [], isCanonical: false })
      } else if (category === "phytochemicals") {
        const item = CATALOG_COMPOUNDS.find((row) => row.key === key)
        if (!item) return
        await createCompound(activeStudy.id, actor, { ...catalogCompound(item), referenceIds: [], isPrimaryMarker: false })
      } else if (category === "proteins") {
        const item = CATALOG_PROTEINS.find((row) => row.key === key)
        if (!item) return
        await createProtein(activeStudy.id, actor, { ...catalogProtein(item), referenceIds: [] })
      } else {
        const item = CATALOG_CELL_LINES.find((row) => row.key === key)
        if (!item) return
        await createCellLine(activeStudy.id, actor, {
          ...catalogCellLine(item),
          referenceIds: [],
          isPrimaryExperimental: rows.length === 0,
        })
      }
      const list = await listFor(category, activeStudy.id)
      setRows(list)
      await syncStudy(list)
      setCatalogOpen(false)
      onChanged()
    } catch (e) {
      setError(toUserFacingError(e, "Could not add that record"))
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (row: Formulation | Compound | Protein | CellLineRecord) => {
    setDraft(draftFrom(category, row))
    setEditingId(row.id)
    setMode("edit")
    setError(null)
  }

  const copy = COPY[category]
  const catalog = catalogItems(category).filter((item) => !rows.some((row) => row.name === item.name))

  return (
    <div className="nano-setup-records">
      <div className="nano-setup-records-bar">
        <p>
          {loading ? "Loading records…" : `${rows.length} in this study`}
        </p>
        {canEdit ? (
          <div className="nano-setup-records-actions">
            <button
              type="button"
              className="nano-setup-save"
              onClick={() => {
                setDraft(blankDraft(category))
                setEditingId(null)
                setMode("create")
                setError(null)
              }}
            >
              <Plus size={14} aria-hidden />
              {copy.add}
            </button>
            {catalog.length > 0 ? (
              <button type="button" className="nano-setup-back" onClick={() => setCatalogOpen((open) => !open)}>
                {copy.catalog}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="nano-setup-records-note">This study is read-only.</p>
        )}
      </div>

      {error ? (
        <p className="nano-setup-alert" role="alert">
          {error}
        </p>
      ) : null}

      {catalogOpen && canEdit ? (
        <ul className="nano-setup-catalog">
          {catalog.map((item) => (
            <li key={item.key}>
              <div>
                <p>{item.name}</p>
                <p>{item.detail}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => void addCatalog(item.key)}>
                Add to study
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {mode !== "list" ? (
        <form
          className="nano-setup-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <h3>{mode === "create" ? copy.add : "Edit record"}</h3>
          <RecordFields category={category} draft={draft} onChange={setDraft} />
          <div className="nano-setup-form-actions">
            <button type="submit" className="nano-setup-save" disabled={busy}>
              {busy ? "Saving…" : "Save record"}
            </button>
            <button type="button" className="nano-setup-back" disabled={busy} onClick={() => setMode("list")}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {!loading && rows.length === 0 && mode === "list" ? (
        <p className="nano-setup-empty">{copy.empty}</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="nano-setup-record-list">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="min-w-0">
                <p className="nano-setup-record-name">{row.name}</p>
                <p className="nano-setup-record-detail">{detailFor(category, row)}</p>
              </div>
              {canEdit ? (
                <div className="nano-setup-record-actions">
                  <button type="button" onClick={() => startEdit(row)} aria-label={`Edit ${row.name}`}>
                    <Pencil size={14} aria-hidden />
                    Edit
                  </button>
                  {pendingDelete === row.id ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => void remove(row.id)}>
                        Confirm delete
                      </button>
                      <button type="button" onClick={() => setPendingDelete(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setPendingDelete(row.id)} aria-label={`Delete ${row.name}`}>
                      <Trash2 size={14} aria-hidden />
                      Delete
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

interface Draft {
  name: string
  plant: string
  scientificName: string
  method: string
  storage: string
  notes: string
  source: string
  components: Array<{ name: string; amount: string; unit: string }>
  chemicalClass: string
  formula: string
  smiles: string
  pubchemCid: string
  plantPart: string
  gene: string
  pdbId: string
  pathway: string
  role: string
  fullName: string
  organism: string
  tissue: string
  disease: string
  lineType: "cancer" | "normal" | "other"
}

function blankDraft(category: SetupCategory): Draft {
  return {
    name: "",
    plant: "",
    scientificName: "",
    method: "",
    storage: "",
    notes: "",
    source: "",
    components: category === "formulation" ? [{ name: "", amount: "", unit: "g" }] : [],
    chemicalClass: "",
    formula: "",
    smiles: "",
    pubchemCid: "",
    plantPart: "",
    gene: "",
    pdbId: "",
    pathway: "",
    role: "",
    fullName: "",
    organism: "",
    tissue: "",
    disease: "",
    lineType: "cancer",
  }
}

function draftFrom(category: SetupCategory, row: Formulation | Compound | Protein | CellLineRecord): Draft {
  const draft = blankDraft(category)
  draft.name = row.name
  draft.notes = "notes" in row ? row.notes ?? "" : ""
  draft.source = row.provenance.source ?? ""
  if (category === "formulation") {
    const item = row as Formulation
    draft.plant = item.plantMaterial ?? ""
    draft.scientificName = item.scientificName ?? ""
    draft.method = item.methodNotes ?? ""
    draft.storage = item.storageNotes ?? ""
    const components = item.components?.length
      ? item.components
      : legacyComponents(item)
    draft.components = components.length
      ? components.map((part) => ({
          name: part.name,
          amount: part.amount != null ? String(part.amount) : "",
          unit: part.unit ?? "",
        }))
      : [{ name: "", amount: "", unit: "g" }]
  } else if (category === "phytochemicals") {
    const item = row as Compound
    draft.chemicalClass = item.chemicalClass ?? ""
    draft.formula = item.formula ?? ""
    draft.smiles = item.smiles ?? ""
    draft.pubchemCid = item.pubchemCid != null ? String(item.pubchemCid) : ""
    draft.plantPart = item.plantPart ?? ""
    draft.source = item.source ?? draft.source
  } else if (category === "proteins") {
    const item = row as Protein
    draft.gene = item.gene ?? ""
    draft.pdbId = item.pdbId ?? ""
    draft.pathway = item.pathway ?? ""
    draft.role = item.role ?? ""
    draft.notes = item.functionNotes ?? ""
    draft.source = item.source ?? draft.source
  } else {
    const item = row as CellLineRecord
    draft.fullName = item.fullName ?? ""
    draft.organism = item.organism ?? ""
    draft.tissue = item.tissueOrigin ?? ""
    draft.disease = item.diseaseContext ?? ""
    draft.lineType = item.lineType
    draft.source = item.sourceDatabase ?? draft.source
  }
  return draft
}

function RecordFields({
  category,
  draft,
  onChange,
}: {
  category: SetupCategory
  draft: Draft
  onChange: (next: Draft) => void
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })
  return (
    <div className="nano-setup-fields">
      <label>
        Name
        <input value={draft.name} onChange={(event) => set({ name: event.target.value })} required />
      </label>
      {category === "formulation" ? (
        <>
          <label>
            Plant / material
            <input value={draft.plant} onChange={(event) => set({ plant: event.target.value })} />
          </label>
          <label>
            Scientific name
            <input value={draft.scientificName} onChange={(event) => set({ scientificName: event.target.value })} />
          </label>
          <fieldset className="nano-setup-components">
            <legend>Components</legend>
            {draft.components.map((part, index) => (
              <div key={index} className="nano-setup-component">
                <input
                  aria-label={`Component ${index + 1} name`}
                  placeholder="Component"
                  value={part.name}
                  onChange={(event) => {
                    const components = draft.components.slice()
                    components[index] = { ...part, name: event.target.value }
                    set({ components })
                  }}
                />
                <input
                  aria-label={`Component ${index + 1} amount`}
                  placeholder="Amount"
                  inputMode="decimal"
                  value={part.amount}
                  onChange={(event) => {
                    const components = draft.components.slice()
                    components[index] = { ...part, amount: event.target.value }
                    set({ components })
                  }}
                />
                <input
                  aria-label={`Component ${index + 1} unit`}
                  placeholder="Unit"
                  value={part.unit}
                  onChange={(event) => {
                    const components = draft.components.slice()
                    components[index] = { ...part, unit: event.target.value }
                    set({ components })
                  }}
                />
                <button
                  type="button"
                  onClick={() => set({ components: draft.components.filter((_, item) => item !== index) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set({ components: [...draft.components, { name: "", amount: "", unit: "" }] })}
            >
              Add component
            </button>
          </fieldset>
          <label>
            Preparation / method
            <textarea rows={2} value={draft.method} onChange={(event) => set({ method: event.target.value })} />
          </label>
          <label>
            Storage
            <textarea rows={2} value={draft.storage} onChange={(event) => set({ storage: event.target.value })} />
          </label>
        </>
      ) : null}
      {category === "phytochemicals" ? (
        <>
          <label>
            Chemical class
            <input value={draft.chemicalClass} onChange={(event) => set({ chemicalClass: event.target.value })} />
          </label>
          <label>
            Formula
            <input value={draft.formula} onChange={(event) => set({ formula: event.target.value })} />
          </label>
          <label>
            PubChem CID
            <input value={draft.pubchemCid} onChange={(event) => set({ pubchemCid: event.target.value })} />
          </label>
          <label className="nano-setup-field-wide">
            SMILES
            <input value={draft.smiles} onChange={(event) => set({ smiles: event.target.value })} />
          </label>
          <label>
            Plant part
            <input value={draft.plantPart} onChange={(event) => set({ plantPart: event.target.value })} />
          </label>
        </>
      ) : null}
      {category === "proteins" ? (
        <>
          <label>
            Gene
            <input value={draft.gene} onChange={(event) => set({ gene: event.target.value })} />
          </label>
          <label>
            PDB ID
            <input value={draft.pdbId} onChange={(event) => set({ pdbId: event.target.value })} />
          </label>
          <label>
            Pathway
            <input value={draft.pathway} onChange={(event) => set({ pathway: event.target.value })} />
          </label>
          <label>
            Role
            <input value={draft.role} onChange={(event) => set({ role: event.target.value })} />
          </label>
        </>
      ) : null}
      {category === "cell-line" ? (
        <>
          <label>
            Full name
            <input value={draft.fullName} onChange={(event) => set({ fullName: event.target.value })} />
          </label>
          <label>
            Organism
            <input value={draft.organism} onChange={(event) => set({ organism: event.target.value })} />
          </label>
          <label>
            Tissue
            <input value={draft.tissue} onChange={(event) => set({ tissue: event.target.value })} />
          </label>
          <label>
            Disease context
            <input value={draft.disease} onChange={(event) => set({ disease: event.target.value })} />
          </label>
          <label>
            Line type
            <select value={draft.lineType} onChange={(event) => set({ lineType: event.target.value as Draft["lineType"] })}>
              <option value="cancer">Cancer</option>
              <option value="normal">Normal</option>
              <option value="other">Other</option>
            </select>
          </label>
        </>
      ) : null}
      <label className="nano-setup-field-wide">
        {category === "proteins" ? "Function notes" : "Notes"}
        <textarea rows={2} value={draft.notes} onChange={(event) => set({ notes: event.target.value })} />
      </label>
      <label className="nano-setup-field-wide">
        Source / citation
        <input
          value={draft.source}
          placeholder="Optional provenance for this record"
          onChange={(event) => set({ source: event.target.value })}
        />
      </label>
    </div>
  )
}

function cleanComponents(rows: Draft["components"]): FormulationComponent[] {
  return rows
    .map((row) => {
      const name = row.name.trim()
      if (!name) return null
      const amount = row.amount.trim() ? Number(row.amount) : undefined
      return {
        name,
        ...(amount != null && Number.isFinite(amount) ? { amount } : {}),
        ...(row.unit.trim() ? { unit: row.unit.trim() } : {}),
      }
    })
    .filter((row): row is FormulationComponent => row !== null)
}

function legacyComponents(item: Formulation): FormulationComponent[] {
  const parts: FormulationComponent[] = []
  if (item.leafMassG != null) {
    parts.push({ name: item.plantMaterial || "Plant material", amount: item.leafMassG, unit: "g" })
  }
  if (item.nanocarrierMassG != null) {
    parts.push({ name: "Nanocarrier", amount: item.nanocarrierMassG, unit: "g" })
  }
  return parts
}

function formulationLine(item: Formulation): string {
  if (item.components?.length) {
    return item.components
      .map((part) => [part.amount, part.unit, part.name].filter((value) => value != null && value !== "").join(" "))
      .join(" + ")
  }
  if (item.leafMassG != null && item.nanocarrierMassG != null) {
    return `${item.leafMassG} g leaf + ${item.nanocarrierMassG} g carrier`
  }
  return item.name
}

function detailFor(category: SetupCategory, row: Formulation | Compound | Protein | CellLineRecord): string {
  if (category === "formulation") return formulationLine(row as Formulation)
  if (category === "phytochemicals") {
    const item = row as Compound
    return [item.chemicalClass, item.formula, item.pubchemCid ? `CID ${item.pubchemCid}` : ""].filter(Boolean).join(" · ") || "Identity only"
  }
  if (category === "proteins") {
    const item = row as Protein
    return [item.gene, item.pdbId ? `PDB ${item.pdbId}` : "", item.pathway].filter(Boolean).join(" · ") || "Identity only"
  }
  const item = row as CellLineRecord
  return [item.fullName, item.tissueOrigin, item.diseaseContext].filter(Boolean).join(" · ") || item.lineType
}

async function listFor(category: SetupCategory, studyId: string) {
  if (category === "formulation") return listFormulations(studyId)
  if (category === "phytochemicals") return listCompounds(studyId)
  if (category === "proteins") return listProteins(studyId)
  return listCellLines(studyId)
}

function catalogItems(category: SetupCategory): Array<{ key: string; name: string; detail: string }> {
  if (category === "formulation") {
    return CATALOG_FORMULATIONS.map((item) => ({ key: item.key, name: item.name, detail: item.plantMaterial }))
  }
  if (category === "phytochemicals") {
    return CATALOG_COMPOUNDS.map((item) => ({ key: item.key, name: item.name, detail: item.chemicalClass ?? item.source ?? "" }))
  }
  if (category === "proteins") {
    return CATALOG_PROTEINS.map((item) => ({
      key: item.key,
      name: item.name,
      detail: [item.gene, item.pdbId ? `PDB ${item.pdbId}` : ""].filter(Boolean).join(" · "),
    }))
  }
  return CATALOG_CELL_LINES.map((item) => ({ key: item.key, name: item.name, detail: item.fullName ?? item.lineType }))
}

function catalogFormulation(item: CatalogFormulation) {
  return {
    name: item.name,
    plantMaterial: item.plantMaterial,
    scientificName: item.scientificName,
    components: item.components,
    methodNotes: item.methodNotes,
    storageNotes: item.storageNotes,
    notes: item.notes,
    provenance: item.source ? { source: item.source } : undefined,
  }
}

function catalogCompound(item: CatalogCompound) {
  return {
    name: item.name,
    pubchemCid: item.pubchemCid,
    smiles: item.smiles,
    formula: item.formula,
    molecularWeight: item.molecularWeight,
    chemicalClass: item.chemicalClass,
    plantPart: item.plantPart,
    source: item.source,
    notes: item.notes,
    provenance: item.source ? { source: item.source } : undefined,
  }
}

function catalogProtein(item: CatalogProtein) {
  return {
    name: item.name,
    gene: item.gene,
    pdbId: item.pdbId,
    pathway: item.pathway,
    role: item.role,
    functionNotes: item.functionNotes,
    source: item.source,
    provenance: item.source ? { source: item.source } : undefined,
  }
}

function catalogCellLine(item: CatalogCellLine) {
  return {
    name: item.name,
    fullName: item.fullName,
    organism: item.organism,
    tissueOrigin: item.tissueOrigin,
    diseaseContext: item.diseaseContext,
    lineType: item.lineType,
    p53Status: item.p53Status,
    hbvStatus: item.hbvStatus,
    sourceDatabase: item.source,
    notes: item.notes,
    provenance: item.source ? { source: item.source } : undefined,
  }
}
