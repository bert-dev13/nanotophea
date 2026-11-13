"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Microscope, Plus, Search, X } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { CATALOG_CELL_LINES, type CatalogCellLine } from "@/lib/catalog/reusableResearchCatalog"
import type { CellLineRecord, LabDataset } from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { listLabDatasets } from "@/lib/repositories/labRepository"
import { createCellLine, deleteCellLine, listCellLines } from "@/lib/repositories/researchDataRepository"
import { getCachedCellLines, invalidateStudyCatalog } from "@/lib/workflow/studyCatalogCache"

const FILTERS: Array<{ id: "all" | "cancer" | "normal"; label: string }> = [
  { id: "all", label: "All" },
  { id: "cancer", label: "Cancer" },
  { id: "normal", label: "Normal" },
]

const TYPE_LABEL = {
  cancer: "Cancer model",
  normal: "Normal reference",
  other: "Experimental model",
} as const

export function CellLineBrowser({
  onChangedAction,
  onBackAction,
  onContinueAction,
  onContinueToInSilicoAction,
  onContinueToNanoparticleAction,
  continueDisabled,
}: {
  onChangedAction?: () => void
  onBackAction?: () => void
  /** @deprecated Prefer dual nanoparticle / In-Silico actions. */
  onContinueAction?: () => void
  onContinueToInSilicoAction?: () => void
  onContinueToNanoparticleAction?: () => void
  continueDisabled?: boolean
}) {
  const handleChanged = onChangedAction ?? (() => {})
  const handleBack = onBackAction ?? (() => {})
  const handleContinueInSilico = onContinueToInSilicoAction ?? onContinueAction ?? (() => {})
  const handleContinueNanoparticle = onContinueToNanoparticleAction
  const { user } = useAuth()
  const { activeStudy, updateActiveStudy } = useStudy()
  const [rows, setRows] = useState<CellLineRecord[]>([])
  const [datasets, setDatasets] = useState<LabDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [viewKey, setViewKey] = useState(CATALOG_CELL_LINES[0]?.key ?? "")
  const [mobilePane, setMobilePane] = useState<"library" | "detail">("library")
  const [showSelected, setShowSelected] = useState(false)
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
  const [batchBusy, setBatchBusy] = useState(false)

  const load = useCallback(async () => {
    const study = activeStudyRef.current
    if (!study) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [lines, labs] = await Promise.all([
        getCachedCellLines(study.id, () => listCellLines(study.id)),
        listLabDatasets(study.id).catch(() => [] as LabDataset[]),
      ])
      setRows(lines)
      setDatasets(labs)
    } catch (e) {
      setError(toUserFacingError(e, "Could not load cell lines"))
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    void load()
  }, [load])

  const byName = useMemo(() => {
    const map = new Map<string, CellLineRecord>()
    for (const row of rows) map.set(row.name, row)
    return map
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CATALOG_CELL_LINES.filter((item) => {
      if (filter !== "all" && item.lineType !== filter) return false
      if (!q) return true
      return `${item.name} ${item.fullName ?? ""} ${item.diseaseContext ?? ""} ${item.hbvStatus ?? ""} ${item.p53Status ?? ""}`
        .toLowerCase()
        .includes(q)
    })
  }, [filter, query])

  const viewing = CATALOG_CELL_LINES.find((item) => item.key === viewKey) ?? visible[0] ?? CATALOG_CELL_LINES[0]
  const selectedItems = CATALOG_CELL_LINES.filter((item) => byName.has(item.name))
  const selectedCount = selectedItems.length
  const collapsed = selectedCount > 4 && !showSelected

  const toggle = useCallback(
    async (item: CatalogCellLine) => {
      if (!activeStudy || !user) return
      const existing = byName.get(item.name)
      const prevRows = rows
      setError(null)
      setPendingKeys((prev) => {
        const next = new Set(prev)
        next.add(item.key)
        return next
      })

      // Instant optimistic update
      if (existing) {
        setRows((prev) => prev.filter((r) => r.name.toLowerCase() !== item.name.toLowerCase()))
      } else {
        const optimistic: CellLineRecord = {
          id: `temp-${item.key}-${Date.now()}`,
          studyId: activeStudy.id,
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
          referenceIds: [],
          isPrimaryExperimental: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: user.uid,
          updatedBy: user.uid,
          provenance: {
            evidenceClass: "REFERENCE",
            source: item.source || "Catalog",
          },
        }
        setRows((prev) => [...prev, optimistic])
      }

      try {
        if (existing) {
          await deleteCellLine(activeStudy.id, existing.id, { id: user.uid })
        } else {
          const created = await createCellLine(activeStudy.id, { id: user.uid }, {
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
            referenceIds: [],
            isPrimaryExperimental: false,
            provenance: item.source ? { source: item.source } : undefined,
          })
          setRows((prev) =>
            prev.map((r) => (r.name.toLowerCase() === item.name.toLowerCase() ? created : r))
          )
        }
        invalidateStudyCatalog(activeStudy.id)
        await updateActiveStudy({ primaryCellLine: item.name })
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
    [activeStudy, user, byName, rows, updateActiveStudy, triggerDebouncedChanged]
  )

  const selectAllVisible = useCallback(async () => {
    if (!activeStudy || !user) return
    const unselected = visible.filter((item) => !byName.has(item.name))
    if (!unselected.length) return
    setBatchBusy(true)
    setError(null)
    const prevRows = rows
    const optimistic = unselected.map((item) => ({
      id: `temp-${item.key}-${Date.now()}-${Math.random()}`,
      studyId: activeStudy.id,
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
      referenceIds: [] as string[],
      isPrimaryExperimental: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.uid,
      updatedBy: user.uid,
      provenance: { evidenceClass: "REFERENCE" as const, source: item.source || "Catalog" },
    }))
    setRows((current) => [...current, ...optimistic])
    try {
      await Promise.allSettled(
        unselected.map((item) =>
          createCellLine(activeStudy.id, { id: user.uid }, {
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
            referenceIds: [],
            isPrimaryExperimental: false,
            provenance: item.source ? { source: item.source } : undefined,
          }),
        ),
      )
      invalidateStudyCatalog(activeStudy.id)
      const fresh = await getCachedCellLines(activeStudy.id, () => listCellLines(activeStudy.id), { force: true })
      setRows(fresh)
      if (fresh[0]) await updateActiveStudy({ primaryCellLine: fresh[0].name })
      triggerDebouncedChanged()
    } catch (e) {
      setRows(prevRows)
      setError(toUserFacingError(e, "Could not complete batch selection"))
    } finally {
      setBatchBusy(false)
    }
  }, [activeStudy, user, visible, byName, rows, updateActiveStudy, triggerDebouncedChanged])

  const clearAllSelected = useCallback(async () => {
    if (!activeStudy || !user || rows.length === 0) return
    setBatchBusy(true)
    setError(null)
    const prevRows = rows
    setRows([])
    try {
      await Promise.allSettled(prevRows.map((row) => deleteCellLine(activeStudy.id, row.id, { id: user.uid })))
      invalidateStudyCatalog(activeStudy.id)
      setRows(await getCachedCellLines(activeStudy.id, () => listCellLines(activeStudy.id), { force: true }))
      triggerDebouncedChanged()
    } catch (e) {
      setRows(prevRows)
      setError(toUserFacingError(e, "Could not clear selections"))
    } finally {
      setBatchBusy(false)
    }
  }, [activeStudy, user, rows, triggerDebouncedChanged])

  const open = useCallback((item: CatalogCellLine) => {
    setViewKey(item.key)
    setMobilePane("detail")
  }, [])

  return (
    <div className="phyto">
      {error ? <p className="phyto-alert" role="alert">{error}</p> : null}
      <div className="phyto-workspace" data-pane={mobilePane}>
        <aside className="phyto-library">
          <header className="phyto-library-head">
            <div>
              <p className="phyto-library-kicker">Library</p>
              <h2>Cell lines</h2>
            </div>
            <p className="phyto-count" aria-live="polite">
              <span key={selectedCount}>{selectedCount}</span>
              <small>selected</small>
            </p>
          </header>
          <label className="phyto-search">
            <Search size={14} aria-hidden />
            <input value={query} placeholder="Search cell lines..." onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {selectedCount === CATALOG_CELL_LINES.length && CATALOG_CELL_LINES.length > 0
                ? `All ${selectedCount} selected`
                : `${selectedCount} of ${CATALOG_CELL_LINES.length} selected`}
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
          <div className="phyto-filters" role="tablist" aria-label="Cell line type">
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
                <CellLineRow
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
          {visible.length === 0 ? <p className="phyto-empty">No cell lines match that search.</p> : null}
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
            {collapsed ? <p className="phyto-picked-empty">{selectedCount} cell lines selected</p> : null}
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
                <p className="phyto-kicker" data-tone={viewing.lineType}>
                  <Microscope size={13} aria-hidden />
                  {TYPE_LABEL[viewing.lineType]}
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
            {viewing.fullName ? <p className="phyto-subtitle">{viewing.fullName}</p> : null}
            <p className="phyto-profile">
              {[
                viewing.donor ? `Source: ${viewing.donor}` : viewing.source ? `Source: ${viewing.source}` : "",
                viewing.p53Status ? `p53: ${viewing.p53Status}` : "",
                viewing.hbvStatus ? `HBV: ${viewing.hbvStatus}` : "",
              ].filter(Boolean).join(" · ")}
            </p>
            {viewing.doublingTime || viewing.morphology ? (
              <p className="phyto-profile">
                {[viewing.doublingTime ? `Doubling: ${viewing.doublingTime}` : "", viewing.morphology ?? ""].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <ul className="phyto-identity">
              <li><span>Organism</span><strong>{viewing.organism ?? "—"}</strong></li>
              <li><span>Tissue</span><strong>{viewing.tissueOrigin ?? "—"}</strong></li>
              <li><span>Disease</span><strong>{viewing.diseaseContext ?? "—"}</strong></li>
            </ul>
            <Measurements viewing={viewing} datasets={datasets} catalog={CATALOG_CELL_LINES} />
            <section className="phyto-block">
              <h3>Cell line overview</h3>
              <dl className="phyto-facts">
                <Fact label="Full name" value={viewing.fullName} />
                <Fact label="Type" value={TYPE_LABEL[viewing.lineType]} />
                <Fact label="p53 status" value={viewing.p53Status} />
                <Fact label="HBV status" value={viewing.hbvStatus} />
                <Fact label="Doubling" value={viewing.doublingTime} />
                <Fact label="Morphology" value={viewing.morphology} />
                <Fact label="Notes" value={viewing.notes} />
              </dl>
            </section>
          </article>
        ) : null}
      </div>
      <footer className="phyto-nav" style={{ flexWrap: "wrap", gap: "0.55rem" }}>
        <button type="button" className="phyto-back" onClick={handleBack}>
          <ArrowLeft size={15} aria-hidden />
          Back
        </button>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginLeft: "auto", justifyContent: "flex-end" }}>
          {handleContinueNanoparticle ? (
            <button
              type="button"
              className="phyto-select"
              data-on="false"
              disabled={continueDisabled || loading || rows.length === 0}
              onClick={handleContinueNanoparticle}
              title="Optional: configure Chitosan–TPP nanoparticle formulation before In-Silico"
            >
              Continue to Nanoparticle Formulation
              <ArrowRight size={14} aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="phyto-continue"
            disabled={continueDisabled || loading || rows.length === 0}
            onClick={handleContinueInSilico}
            title="Skip nanoparticle formulation and proceed to In-Silico Screening"
          >
            Continue to In-Silico
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      </footer>
      {handleContinueNanoparticle ? (
        <p className="phyto-caption" style={{ marginTop: "0.55rem", textAlign: "right" }}>
          Nanoparticle formulation is optional. Continue to In-Silico skips it and records that choice. Phytochemicals,
          proteins, and cell lines stay selected either way.
        </p>
      ) : null}
    </div>
  )
}

function Measurements({
  viewing,
  datasets,
  catalog,
}: {
  viewing: CatalogCellLine
  datasets: LabDataset[]
  catalog: CatalogCellLine[]
}) {
  const mine = datasets.filter((row) => (row.cellLineName ?? "").toLowerCase() === viewing.name.toLowerCase())
  const ic50 = mine.find((row) => row.ic50)?.ic50
  const rows = mine.flatMap((row) =>
    row.treatmentSummaries.map((summary) => ({
      key: `${row.id}-${summary.treatmentCode}-${summary.metric}`,
      assay: row.assayType,
      ...summary,
    })),
  )
  const comparison = catalog.flatMap((line) => {
    const hit = datasets.find((row) => (row.cellLineName ?? "").toLowerCase() === line.name.toLowerCase() && row.ic50)
    return hit?.ic50 ? [{ name: line.name, type: line.lineType, value: hit.ic50.value, unit: hit.ic50.unit }] : []
  })
  const max = Math.max(...comparison.map((item) => item.value), 0)

  return (
    <section className="phyto-block">
      <h3>Experimental measurements</h3>
      {mine.length === 0 ? (
        <p className="phyto-missing">No experimental measurements are recorded for {viewing.name}.</p>
      ) : (
        <>
          {ic50 ? (
            <div className="phyto-metrics">
              <div>
                <span>IC50</span>
                <strong>{ic50.value}</strong>
                <small>{ic50.unit}</small>
                <small>{ic50.method}</small>
              </div>
            </div>
          ) : null}
          {rows.length > 0 ? (
            <table className="phyto-table">
              <thead>
                <tr>
                  <th>Assay</th>
                  <th>Treatment</th>
                  <th>Metric</th>
                  <th>Mean</th>
                  <th>SD</th>
                  <th>n</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.assay}</td>
                    <td>{row.treatmentCode}</td>
                    <td>{row.metric}</td>
                    <td>{row.mean ?? "—"}</td>
                    <td>{row.sd ?? "—"}</td>
                    <td>{row.n ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      )}
      {comparison.length > 0 ? (
        <div className="phyto-compare">
          <h3>IC50 recorded in this study</h3>
          <ul>
            {comparison.map((item) => (
              <li key={item.name} data-tone={item.type} data-current={item.name === viewing.name ? "true" : "false"}>
                <span>{item.name}</span>
                <span>
                  <i style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }} />
                </span>
                <strong>{item.value} {item.unit}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
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

interface CellLineRowProps {
  item: CatalogCellLine
  checked: boolean
  viewing: boolean
  busy: boolean
  disabled: boolean
  onOpen: (item: CatalogCellLine) => void
  onToggle: (item: CatalogCellLine) => void
}

const CellLineRow = React.memo(function CellLineRow({
  item,
  checked,
  viewing,
  busy,
  disabled,
  onOpen,
  onToggle,
}: CellLineRowProps) {
  const meta = [item.tissueOrigin, item.hbvStatus].filter(Boolean).join(" · ")
  return (
    <li
      data-viewing={viewing ? "true" : "false"}
      data-selected={checked ? "true" : "false"}
      data-tone={item.lineType}
    >
      <button type="button" className="phyto-row" onClick={() => onOpen(item)}>
        <span className="phyto-row-mark" aria-hidden />
        <span className="phyto-row-copy">
          <span className="phyto-row-name">{item.name}</span>
          <span className="phyto-row-sub">
            <span className="phyto-row-class">{item.diseaseContext}</span>
            {meta ? <span className="phyto-row-meta">{meta}</span> : null}
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
