"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FlaskConical,
  Plus,
  Search,
  X,
} from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { DeferredCompoundViewer } from "@/components/study/DeferredMolecularViewer"
import {
  CATALOG_COMPOUNDS,
  type CatalogCompound,
  type CompoundFilter,
} from "@/lib/catalog/reusableResearchCatalog"
import { usePubChemCompound } from "@/lib/scientific/client"
import { getCatalogPubChemFallback } from "@/lib/scientific/pubchem"
import type { PubChemCompound } from "@/lib/scientific/types"
import type { Compound } from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { createCompound, deleteCompound, listCompounds, listGlobalPhytochemicals } from "@/lib/repositories/researchDataRepository"
import { getCachedCompounds, invalidateStudyCatalog } from "@/lib/workflow/studyCatalogCache"

const FILTERS: Array<{ id: "all" | CompoundFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "flavonoids", label: "Flavonoids" },
  { id: "phenolics", label: "Phenolics" },
  { id: "tannins", label: "Tannins" },
  { id: "lignans", label: "Lignans" },
  { id: "alkaloids", label: "Alkaloids" },
  { id: "sterols", label: "Sterols" },
]

export function PhytochemicalBrowser({
  onChangedAction,
  onContinueAction,
}: {
  onChangedAction?: () => void
  onContinueAction?: () => void
}) {
  const handleChanged = onChangedAction ?? (() => {})
  const handleContinue = onContinueAction ?? (() => {})
  const { user } = useAuth()
  const { activeStudy } = useStudy()
  const [catalogItems, setCatalogItems] = useState<CatalogCompound[]>(CATALOG_COMPOUNDS)
  const [rows, setRows] = useState<Compound[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [viewKey, setViewKey] = useState(CATALOG_COMPOUNDS[0]?.key ?? "")
  const [mobilePane, setMobilePane] = useState<"library" | "detail">("library")
  const [showSelected, setShowSelected] = useState(false)
  const [copied, setCopied] = useState(false)
  const changeDebounceTimer = useRef<NodeJS.Timeout | null>(null)

  const triggerDebouncedChanged = useCallback(() => {
    if (changeDebounceTimer.current) clearTimeout(changeDebounceTimer.current)
    changeDebounceTimer.current = setTimeout(() => {
      handleChanged()
    }, 300)
  }, [handleChanged])

  useEffect(() => {
    return () => {
      if (changeDebounceTimer.current) clearTimeout(changeDebounceTimer.current)
    }
  }, [])

  const studyId = activeStudy?.id ?? null
  const activeStudyRef = useRef(activeStudy)
  activeStudyRef.current = activeStudy

  const load = useCallback(async () => {
    const study = activeStudyRef.current
    if (!study) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [studyRows, globalRows] = await Promise.all([
        getCachedCompounds(study.id, () => listCompounds(study.id)),
        listGlobalPhytochemicals(),
      ])
      setRows(studyRows)
      if (globalRows && globalRows.length > 0) {
        setCatalogItems(globalRows)
      }
    } catch (e) {
      setError(toUserFacingError(e, "Could not load phytochemicals"))
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    void load()
  }, [load])

  const byName = useMemo(() => {
    const map = new Map<string, Compound>()
    for (const row of rows) map.set(row.name, row)
    return map
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = catalogItems.filter((item) => {
      if (filter !== "all" && item.filter !== filter) return false
      if (!q) return true
      const cidStr = item.pubchemCid != null ? String(item.pubchemCid) : ""
      return `${item.name} ${item.chemicalClass ?? ""} ${cidStr}`.toLowerCase().includes(q)
    })
    return [...filtered].sort((a, b) => {
      const aIsQuercetin = a.key.toLowerCase() === "quercetin" || a.name.toLowerCase() === "quercetin"
      const bIsQuercetin = b.key.toLowerCase() === "quercetin" || b.name.toLowerCase() === "quercetin"
      if (aIsQuercetin && !bIsQuercetin) return -1
      if (!aIsQuercetin && bIsQuercetin) return 1
      return 0
    })
  }, [catalogItems, filter, query])

  const viewing = catalogItems.find((item) => item.key === viewKey) ?? visible[0] ?? catalogItems[0]
  const record = usePubChemCompound(viewing?.pubchemCid)
  const pubchem = record.status === "ready" ? record.data : undefined
  const selectedItems = catalogItems.filter((item) => byName.has(item.name))
  const selectedCount = selectedItems.length
  const collapsed = selectedCount > 4 && !showSelected

  const toggle = useCallback(
    async (item: CatalogCompound) => {
      if (!activeStudy || !user) return
      const existing = byName.get(item.name)
      const prevRows = rows
      setError(null)
      setPendingKeys((prev) => {
        const next = new Set(prev)
        next.add(item.key)
        return next
      })

      // Instant optimistic update: update rows synchronously so checkbox state responds with 0ms latency
      if (existing) {
        setRows((prev) => prev.filter((r) => r.name.toLowerCase() !== item.name.toLowerCase()))
      } else {
        const snapshot = pubchem && pubchem.cid === item.pubchemCid ? pubchem : undefined
        const optimistic: Compound = {
          id: `temp-${item.key}-${Date.now()}`,
          studyId: activeStudy.id,
          name: item.name,
          pubchemCid: item.pubchemCid,
          smiles: snapshot?.isomericSmiles ?? snapshot?.canonicalSmiles ?? item.smiles,
          isomericSmiles: snapshot?.isomericSmiles ?? item.smiles,
          formula: snapshot?.formula ?? item.formula,
          molecularWeight: snapshot?.molecularWeight ?? item.molecularWeight,
          chemicalClass: item.chemicalClass,
          plantPart: item.plantPart,
          source: item.pubchemCid ? `PubChem CID ${item.pubchemCid}` : item.source,
          notes: item.notes,
          referenceIds: [],
          isPrimaryMarker: item.key === "quercetin",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: user.uid,
          updatedBy: user.uid,
          provenance: {
            evidenceClass: "REFERENCE",
            source: item.pubchemCid ? "PubChem" : item.source || "Catalog",
          },
        }
        setRows((prev) => [...prev, optimistic])
      }

      try {
        if (existing) {
          await deleteCompound(activeStudy.id, existing.id, { id: user.uid })
          invalidateStudyCatalog(activeStudy.id)
        } else {
          const snapshot = pubchem && pubchem.cid === item.pubchemCid ? pubchem : undefined
          const created = await createCompound(activeStudy.id, { id: user.uid }, {
            name: item.name,
            pubchemCid: item.pubchemCid,
            smiles: snapshot?.isomericSmiles ?? snapshot?.canonicalSmiles ?? item.smiles,
            isomericSmiles: snapshot?.isomericSmiles ?? item.smiles,
            formula: snapshot?.formula ?? item.formula,
            molecularWeight: snapshot?.molecularWeight ?? item.molecularWeight,
            chemicalClass: item.chemicalClass,
            plantPart: item.plantPart,
            source: item.pubchemCid ? `PubChem CID ${item.pubchemCid}` : item.source,
            notes: item.notes,
            referenceIds: [],
            isPrimaryMarker: item.key === "quercetin",
            provenance: item.pubchemCid ? { source: "PubChem" } : undefined,
          })
          setRows((prev) =>
            prev.map((r) => (r.name.toLowerCase() === item.name.toLowerCase() ? created : r))
          )
          invalidateStudyCatalog(activeStudy.id)
        }
        triggerDebouncedChanged()
      } catch (e) {
        setRows(prevRows)
        setError(toUserFacingError(e, "Could not update this selection"))
      } finally {
        setPendingKeys((prev) => {
          const next = new Set(prev)
          next.delete(item.key)
          return next
        })
      }
    },
    [activeStudy, user, byName, rows, pubchem, triggerDebouncedChanged]
  )

  const [batchBusy, setBatchBusy] = useState(false)

  const selectAllVisible = useCallback(async () => {
    if (!activeStudy || !user || visible.length === 0) return
    const unselected = visible.filter((item) => !byName.has(item.name))
    if (unselected.length === 0) return

    setBatchBusy(true)
    setError(null)
    const prevRows = rows

    const optimisticRows: Compound[] = unselected.map((item) => {
      const fallback = getCatalogPubChemFallback(item.pubchemCid ?? 0)
      return {
        id: `temp-${item.key}-${Date.now()}-${Math.random()}`,
        studyId: activeStudy.id,
        name: item.name,
        pubchemCid: item.pubchemCid,
        smiles: fallback?.isomericSmiles ?? fallback?.canonicalSmiles ?? item.smiles,
        isomericSmiles: fallback?.isomericSmiles ?? item.smiles,
        formula: fallback?.formula ?? item.formula,
        molecularWeight: fallback?.molecularWeight ?? item.molecularWeight,
        chemicalClass: item.chemicalClass,
        plantPart: item.plantPart,
        source: item.pubchemCid ? `PubChem CID ${item.pubchemCid}` : item.source,
        notes: item.notes,
        referenceIds: [],
        isPrimaryMarker: item.key === "quercetin",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.uid,
        updatedBy: user.uid,
        provenance: {
          evidenceClass: "REFERENCE",
          source: item.pubchemCid ? "PubChem" : item.source || "Catalog",
        },
      }
    })
    setRows((prev) => [...prev, ...optimisticRows])

    try {
      await Promise.allSettled(
        unselected.map((item) => {
          const fallback = getCatalogPubChemFallback(item.pubchemCid ?? 0)
          return createCompound(activeStudy.id, { id: user.uid }, {
            name: item.name,
            pubchemCid: item.pubchemCid,
            smiles: fallback?.isomericSmiles ?? fallback?.canonicalSmiles ?? item.smiles,
            isomericSmiles: fallback?.isomericSmiles ?? item.smiles,
            formula: fallback?.formula ?? item.formula,
            molecularWeight: fallback?.molecularWeight ?? item.molecularWeight,
            chemicalClass: item.chemicalClass,
            plantPart: item.plantPart,
            source: item.pubchemCid ? `PubChem CID ${item.pubchemCid}` : item.source,
            notes: item.notes,
            referenceIds: [],
            isPrimaryMarker: item.key === "quercetin",
            provenance: item.pubchemCid ? { source: "PubChem" } : undefined,
          })
        })
      )
      invalidateStudyCatalog(activeStudy.id)
      const freshRows = await getCachedCompounds(activeStudy.id, () => listCompounds(activeStudy.id), { force: true })
      setRows(freshRows)
      triggerDebouncedChanged()
    } catch (e) {
      setRows(prevRows)
      setError(toUserFacingError(e, "Could not complete batch selection"))
    } finally {
      setBatchBusy(false)
    }
  }, [activeStudy, user, visible, byName, rows, triggerDebouncedChanged])

  const clearAllSelected = useCallback(async () => {
    if (!activeStudy || !user || rows.length === 0) return
    setBatchBusy(true)
    setError(null)
    const prevRows = rows

    setRows([])

    try {
      await Promise.allSettled(
        prevRows.map((r) => deleteCompound(activeStudy.id, r.id, { id: user.uid }))
      )
      invalidateStudyCatalog(activeStudy.id)
      const freshRows = await getCachedCompounds(activeStudy.id, () => listCompounds(activeStudy.id), { force: true })
      setRows(freshRows)
      triggerDebouncedChanged()
    } catch (e) {
      setRows(prevRows)
      setError(toUserFacingError(e, "Could not clear selections"))
    } finally {
      setBatchBusy(false)
    }
  }, [activeStudy, user, rows, triggerDebouncedChanged])

  const open = useCallback((item: CatalogCompound) => {
    setViewKey(item.key)
    setCopied(false)
    setMobilePane("detail")
  }, [])

  const smiles = pubchem?.isomericSmiles ?? pubchem?.canonicalSmiles ?? viewing?.smiles
  const copySmiles = async () => {
    if (!smiles) return
    try {
      await navigator.clipboard.writeText(smiles)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="phyto">
      {error ? (
        <p className="phyto-alert" role="alert">
          {error}
        </p>
      ) : null}

      <div className="phyto-workspace" data-pane={mobilePane}>
        <aside className="phyto-library">
          <header className="phyto-library-head">
            <div>
              <p className="phyto-library-kicker">Library</p>
              <h2>Phytochemicals</h2>
            </div>
            <p className="phyto-count" aria-live="polite">
              <span key={selectedCount}>{selectedCount}</span>
              <small>selected · {catalogItems.length} available</small>
            </p>
          </header>

          <label className="phyto-search">
            <Search size={14} aria-hidden />
            <input
              value={query}
              placeholder="Search compounds..."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {selectedCount === catalogItems.length && catalogItems.length > 0
                ? `All ${selectedCount} selected`
                : `${selectedCount} of ${catalogItems.length} selected`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer disabled:opacity-40"
                disabled={loading || batchBusy || visible.every((item) => byName.has(item.name))}
                onClick={() => void selectAllVisible()}
              >
                {batchBusy ? "Processing..." : `Select All ${filter !== "all" || query ? `(${visible.length})` : ""}`}
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 font-medium cursor-pointer disabled:opacity-40"
                disabled={loading || batchBusy || selectedCount === 0}
                onClick={() => void clearAllSelected()}
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="phyto-filters" role="tablist" aria-label="Compound class">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                data-on={filter === item.id ? "true" : "false"}
                data-tone={item.id === "all" ? undefined : item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <ul className="phyto-rows">
            {visible.map((item) => {
              const checked = byName.has(item.name)
              const current = viewing?.key === item.key
              const isBusy = pendingKeys.has(item.key)
              return (
                <PhytochemicalRow
                  key={item.key}
                  item={item}
                  checked={checked}
                  viewing={current}
                  busy={isBusy}
                  disabled={loading}
                  onOpen={open}
                  onToggle={toggle}
                />
              )
            })}
          </ul>
          {visible.length === 0 ? <p className="phyto-empty">No compounds match that search.</p> : null}

          <div className="phyto-picked">
            <div className="phyto-picked-bar">
              <p>Selected · {selectedCount}</p>
              {selectedCount > 4 ? (
                <button type="button" onClick={() => setShowSelected((open) => !open)}>
                  {collapsed ? "View selected" : "Hide"}
                </button>
              ) : null}
            </div>
            {selectedCount === 0 ? <p className="phyto-picked-empty">None yet</p> : null}
            {!collapsed && selectedCount > 0 ? (
              <ul>
                {selectedItems.map((item) => (
                  <li key={item.key}>
                    <span>{item.name}</span>
                    <button type="button" aria-label={`Remove ${item.name}`} onClick={() => void toggle(item)}>
                      <X size={12} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {collapsed ? <p className="phyto-picked-empty">{selectedCount} compounds selected</p> : null}
          </div>
        </aside>

        {viewing ? (
          <article className="phyto-detail" key={viewing.key}>
            <button type="button" className="phyto-mobile-back" onClick={() => setMobilePane("library")}>
              <ArrowLeft size={14} aria-hidden />
              Library
            </button>

            <header className="phyto-hero">
              <div>
                <p className="phyto-kicker" data-tone={viewing.filter}>
                  <FlaskConical size={13} aria-hidden />
                  {viewing.chemicalClass}
                </p>
                <h2>{viewing.name}</h2>
              </div>
              <button
                type="button"
                className="phyto-select"
                data-on={byName.has(viewing.name) ? "true" : "false"}
                disabled={loading || pendingKeys.has(viewing.key)}
                onClick={() => void toggle(viewing)}
              >
                {byName.has(viewing.name) ? (
                  <>
                    <Check size={14} aria-hidden />
                    Selected
                  </>
                ) : (
                  <>
                    <Plus size={14} aria-hidden />
                    Select for Study
                  </>
                )}
              </button>
            </header>

            <ul className="phyto-identity">
              <Identity label="Formula" value={pubchem?.formula} loading={record.status === "loading"} />
              <Identity
                label="Molecular weight"
                value={pubchem?.molecularWeight != null ? `${pubchem.molecularWeight} g/mol` : undefined}
                loading={record.status === "loading"}
              />
              <li>
                <span>PubChem CID</span>
                <strong>{viewing.pubchemCid ?? "—"}</strong>
              </li>
            </ul>

            {record.status === "error" ? <Unavailable onRetry={record.retry} /> : null}

            <div className="phyto-overview">
              <section className="phyto-stage">
                <h3>Molecular structure</h3>
                {viewing.pubchemCid != null ? (
                  <DeferredCompoundViewer key={viewing.pubchemCid} cid={viewing.pubchemCid} name={viewing.name} height={300} quiet />
                ) : (
                  <p className="phyto-missing">This library record has no PubChem CID.</p>
                )}
              </section>
              <section>
                <h3>Overview</h3>
                <dl className="phyto-facts">
                  <Fact label="Class" value={viewing.chemicalClass} />
                  <Fact label="Plant source" value={viewing.plantPart} />
                  <Fact label="Formula" value={pubchem?.formula} />
                  <Fact label="Molecular weight" value={pubchem?.molecularWeight != null ? `${pubchem.molecularWeight} g/mol` : undefined} />
                  <Fact label="PubChem CID" value={viewing.pubchemCid != null ? String(viewing.pubchemCid) : undefined} />
                </dl>
                {record.status === "loading" ? <Skeleton lines={3} /> : null}
              </section>
            </div>

            <section className="phyto-block">
              <h3>Physicochemical properties</h3>
              <p className="phyto-caption">PubChem computed descriptors. Not laboratory measurements.</p>
              {record.status === "loading" ? (
                <Skeleton lines={4} />
              ) : record.status === "ready" && pubchem ? (
                <>
                  <dl className="phyto-props">
                    <Prop label="Molecular weight" value={pubchem.molecularWeight != null ? `${pubchem.molecularWeight} g/mol` : undefined} />
                    <Prop label="XLogP" value={pubchem.xLogP != null ? String(pubchem.xLogP) : undefined} />
                    <Prop label="H-bond donors" value={pubchem.hBondDonors != null ? String(pubchem.hBondDonors) : undefined} />
                    <Prop label="H-bond acceptors" value={pubchem.hBondAcceptors != null ? String(pubchem.hBondAcceptors) : undefined} />
                    <Prop label="TPSA" value={pubchem.tpsa != null ? `${pubchem.tpsa} Å²` : undefined} />
                    <Prop label="Rotatable bonds" value={pubchem.rotatableBonds != null ? String(pubchem.rotatableBonds) : undefined} />
                  </dl>
                  <div className="phyto-adme">
                    <span>Lipinski RO5</span>
                    <strong data-mark={lipinski(pubchem) === "Fail" ? "fail" : lipinski(pubchem) === "Pass" ? "pass" : undefined}>
                      {lipinski(pubchem) ?? "Not available"}
                    </strong>
                  </div>
                  <p className="phyto-caption">A rule check on the PubChem descriptors above.</p>
                </>
              ) : null}
            </section>

            <section className="phyto-block">
              <h3>Chemical identifiers</h3>
              {record.status === "loading" ? <Skeleton lines={2} /> : null}
              {smiles ? (
                <div className="phyto-code">
                  <span>{pubchem?.isomericSmiles ? "SMILES" : "Connectivity SMILES"}</span>
                  <code>{smiles}</code>
                  <button type="button" aria-label="Copy SMILES" onClick={() => void copySmiles()}>
                    <Copy size={13} aria-hidden />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : record.status === "ready" ? (
                <p className="phyto-missing">PubChem did not return a SMILES string for this record.</p>
              ) : null}
              {pubchem?.iupac ? (
                <p className="phyto-iupac">
                  <span>IUPAC name</span>
                  {pubchem.iupac}
                </p>
              ) : null}
            </section>

            {record.status === "ready" && viewing.pubchemCid != null ? (
              <section className="phyto-block">
                <h3>Scientific source</h3>
                <div className="phyto-source-card">
                  <p>PubChem</p>
                  <p>Compound record · CID {viewing.pubchemCid}</p>
                  <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${viewing.pubchemCid}`} target="_blank" rel="noreferrer">
                    View source
                    <ExternalLink size={12} aria-hidden />
                  </a>
                </div>
              </section>
            ) : null}
          </article>
        ) : null}
      </div>

      <footer className="phyto-nav">
        <Link href="/" className="phyto-back">
          <ArrowLeft size={15} aria-hidden />
          Back
        </Link>
        <button type="button" className="phyto-continue" disabled={selectedCount < 1 || loading} onClick={handleContinue}>
          Continue to Target Proteins
          <ArrowRight size={15} aria-hidden />
        </button>
      </footer>
    </div>
  )
}

function Fact({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function Prop({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  )
}

function lipinski(item: PubChemCompound): string | undefined {
  if (
    item.molecularWeight == null ||
    item.xLogP == null ||
    item.hBondDonors == null ||
    item.hBondAcceptors == null
  ) {
    return undefined
  }
  const fail =
    item.molecularWeight > 500 ||
    item.xLogP > 5 ||
    item.hBondDonors > 5 ||
    item.hBondAcceptors > 10
  return fail ? "Fail" : "Pass"
}

function Identity({ label, value, loading }: { label: string; value?: string; loading: boolean }) {
  return (
    <li>
      <span>{label}</span>
      {loading ? <i className="phyto-skel-line" /> : <strong>{value ?? "—"}</strong>}
    </li>
  )
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="phyto-skel" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <i key={index} />
      ))}
    </div>
  )
}

function Unavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="phyto-unavailable" role="status">
      <p>Scientific data temporarily unavailable.</p>
      <button type="button" onClick={onRetry}>Retry</button>
    </div>
  )
}

interface PhytochemicalRowProps {
  item: CatalogCompound
  checked: boolean
  viewing: boolean
  busy: boolean
  disabled: boolean
  onOpen: (item: CatalogCompound) => void
  onToggle: (item: CatalogCompound) => void
}

const PhytochemicalRow = React.memo(function PhytochemicalRow({
  item,
  checked,
  viewing,
  busy,
  disabled,
  onOpen,
  onToggle,
}: PhytochemicalRowProps) {
  return (
    <li
      data-viewing={viewing ? "true" : "false"}
      data-selected={checked ? "true" : "false"}
      data-tone={item.filter}
    >
      <button type="button" className="phyto-row" onClick={() => onOpen(item)}>
        <span className="phyto-row-mark" aria-hidden />
        <span className="phyto-row-copy">
          <span className="phyto-row-name">{item.name}</span>
          <span className="phyto-row-sub">
            <span className="phyto-row-class">{item.chemicalClass}</span>
            <span className="phyto-row-meta">
              {item.pubchemCid != null ? `CID ${item.pubchemCid}` : "No CID"}
            </span>
          </span>
        </span>
      </button>
      <label className="phyto-check">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled || busy}
          aria-label={checked ? `Remove ${item.name} from this study` : `Select ${item.name} for this study`}
          onChange={() => onToggle(item)}
        />
        <span aria-hidden />
      </label>
    </li>
  )
})
