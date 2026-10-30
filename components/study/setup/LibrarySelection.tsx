"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import {
  CATALOG_CELL_LINES,
  CATALOG_COMPOUNDS,
  CATALOG_PROTEINS,
  catalogProteinInput,
  type CatalogCellLine,
  type CatalogCompound,
  type CatalogProtein,
} from "@/lib/catalog/reusableResearchCatalog"
import type { CellLineRecord, Compound, Protein } from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"
import {
  createCellLine,
  createCompound,
  createProtein,
  deleteCellLine,
  deleteCompound,
  deleteProtein,
  listCellLines,
  listCompounds,
  listProteins,
} from "@/lib/repositories/researchDataRepository"

export type LibraryCategory = "phytochemicals" | "proteins" | "cell-line"

type LibraryItem = CatalogCompound | CatalogProtein | CatalogCellLine
type StudyRow = Compound | Protein | CellLineRecord

const COPY: Record<LibraryCategory, { noun: string; empty: string }> = {
  phytochemicals: {
    noun: "phytochemicals",
    empty: "No phytochemicals are selected. Check the compounds this study will investigate.",
  },
  proteins: {
    noun: "target proteins",
    empty: "No target proteins are selected. Check the docking targets for this study.",
  },
  "cell-line": {
    noun: "cell lines",
    empty: "No cell lines are selected. Check the experimental models for this study.",
  },
}

export function LibrarySelection({
  category,
  onChangedAction,
}: {
  category: LibraryCategory
  onChangedAction?: () => void
}) {
  const handleChanged = onChangedAction ?? (() => {})
  const { user } = useAuth()
  const { activeStudy, updateActiveStudy } = useStudy()
  const [rows, setRows] = useState<StudyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [openKey, setOpenKey] = useState<string | null>(null)

  const library = libraryFor(category)

  const load = useCallback(async () => {
    if (!activeStudy) return
    setLoading(true)
    setError(null)
    try {
      setRows(await listFor(category, activeStudy.id))
    } catch (e) {
      setError(toUserFacingError(e, "Could not load the research library"))
    } finally {
      setLoading(false)
    }
  }, [activeStudy, category])

  useEffect(() => {
    void load()
  }, [load])

  const selectedNames = useMemo(() => new Set(rows.map((row) => row.name)), [rows])
  const visible = library.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${item.name} ${detailLine(item)}`.toLowerCase().includes(q)
  })
  const open = library.find((item) => item.key === openKey) ?? null
  const selectedCount = library.filter((item) => selectedNames.has(item.name)).length

  const toggle = async (item: LibraryItem) => {
    if (!activeStudy || !user || busyKey) return
    const existing = rows.find((row) => row.name === item.name)
    setBusyKey(item.key)
    setError(null)
    try {
      const actor = { id: user.uid }
      if (existing) {
        if (category === "phytochemicals") await deleteCompound(activeStudy.id, existing.id, actor)
        else if (category === "proteins") await deleteProtein(activeStudy.id, existing.id, actor)
        else await deleteCellLine(activeStudy.id, existing.id, actor)
      } else if (category === "phytochemicals") {
        const source = item as CatalogCompound
        await createCompound(activeStudy.id, actor, {
          name: source.name,
          pubchemCid: source.pubchemCid,
          smiles: source.smiles,
          formula: source.formula,
          molecularWeight: source.molecularWeight,
          chemicalClass: source.chemicalClass,
          plantPart: source.plantPart,
          source: source.source,
          notes: source.notes,
          referenceIds: [],
          isPrimaryMarker: false,
          provenance: source.source ? { source: source.source } : undefined,
        })
      } else if (category === "proteins") {
        const source = item as CatalogProtein
        await createProtein(activeStudy.id, actor, catalogProteinInput(source))
      } else {
        const source = item as CatalogCellLine
        await createCellLine(activeStudy.id, actor, {
          name: source.name,
          fullName: source.fullName,
          organism: source.organism,
          tissueOrigin: source.tissueOrigin,
          diseaseContext: source.diseaseContext,
          lineType: source.lineType,
          p53Status: source.p53Status,
          hbvStatus: source.hbvStatus,
          sourceDatabase: source.source,
          notes: source.notes,
          referenceIds: [],
          isPrimaryExperimental: false,
          provenance: source.source ? { source: source.source } : undefined,
        })
      }
      const next = await listFor(category, activeStudy.id)
      setRows(next)
      if (category === "cell-line") {
        const lines = next as CellLineRecord[]
        await updateActiveStudy({ primaryCellLine: lines[0]?.name ?? "" })
      }
      handleChanged()
    } catch (e) {
      setError(toUserFacingError(e, "Could not update this selection"))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="nano-setup-records">
      <div className="nano-setup-records-bar">
        <p>
          {loading
            ? "Loading library…"
            : `${selectedCount} selected · ${library.length} in the Sampasampalukan library`}
        </p>
        <label className="nano-setup-records-actions">
          <span className="sr-only">Search {COPY[category].noun}</span>
          <input
            className="nano-control"
            value={query}
            placeholder={`Search ${COPY[category].noun}`}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="nano-setup-alert" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && selectedCount === 0 ? <p className="nano-setup-empty">{COPY[category].empty}</p> : null}

      <ul className="nano-setup-catalog">
        {visible.map((item) => {
          const checked = selectedNames.has(item.name)
          return (
            <li key={item.key}>
              <label className="flex min-w-0 flex-1 items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={loading || busyKey != null}
                  onChange={() => void toggle(item)}
                />
                <span>
                  <p>{item.name}</p>
                  <p>{detailLine(item)}</p>
                </span>
              </label>
              <button type="button" onClick={() => setOpenKey(openKey === item.key ? null : item.key)}>
                {openKey === item.key ? "Hide details" : "View details"}
              </button>
            </li>
          )
        })}
      </ul>

      {visible.length === 0 ? <p className="nano-setup-empty">No library records match that search.</p> : null}

      {open ? (
        <dl className="nano-setup-review">
          {detailFields(open).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

function libraryFor(category: LibraryCategory): LibraryItem[] {
  if (category === "phytochemicals") return CATALOG_COMPOUNDS
  if (category === "proteins") return CATALOG_PROTEINS
  return CATALOG_CELL_LINES
}

async function listFor(category: LibraryCategory, studyId: string): Promise<StudyRow[]> {
  if (category === "phytochemicals") return listCompounds(studyId)
  if (category === "proteins") return listProteins(studyId)
  return listCellLines(studyId)
}

function isCellLine(item: LibraryItem): item is CatalogCellLine {
  return "lineType" in item
}

function isProtein(item: LibraryItem): item is CatalogProtein {
  return "pdbId" in item || "gene" in item || "pathway" in item || "uniprotIds" in item
}

function detailLine(item: LibraryItem): string {
  if (isCellLine(item)) return [item.fullName, item.lineType, item.diseaseContext].filter(Boolean).join(" · ")
  if (isProtein(item)) return [item.gene, item.pdbId ? `PDB ${item.pdbId}` : "", item.pathway].filter(Boolean).join(" · ")
  return [item.chemicalClass, item.formula, item.source].filter(Boolean).join(" · ")
}

function detailFields(item: LibraryItem): Array<[string, string]> {
  const fields: Array<[string, string | undefined]> = [["Name", item.name]]
  if (isCellLine(item)) {
    fields.push(
      ["Full name", item.fullName],
      ["Type", item.lineType],
      ["Organism", item.organism],
      ["Tissue", item.tissueOrigin],
      ["Context", item.diseaseContext],
      ["p53", item.p53Status],
      ["HBV", item.hbvStatus],
      ["Source", item.source],
      ["Notes", item.notes]
    )
  } else if (isProtein(item)) {
    fields.push(
      ["Gene", item.gene],
      ["PDB", item.pdbId],
      ["Pathway", item.pathway],
      ["Role", item.role],
      ["Function", item.functionNotes],
      ["Source", item.source]
    )
  } else {
    fields.push(
      ["Class", item.chemicalClass],
      ["Formula", item.formula],
      ["Molecular weight", item.molecularWeight != null ? String(item.molecularWeight) : undefined],
      ["PubChem CID", item.pubchemCid != null ? String(item.pubchemCid) : undefined],
      ["Plant part", item.plantPart],
      ["SMILES", item.smiles],
      ["Source", item.source],
      ["Notes", item.notes]
    )
  }
  return fields.filter((entry): entry is [string, string] => Boolean(entry[1]))
}
