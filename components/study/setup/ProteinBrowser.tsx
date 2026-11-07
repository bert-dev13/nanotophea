"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Atom, Check, ExternalLink, Plus, Search, X } from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { CATALOG_PROTEINS, catalogProteinInput, type CatalogProtein, type ProteinGroup } from "@/lib/catalog/reusableResearchCatalog"
import { dockingProfileReport, dockingSystemLabels, isCompleteDockingProfile, profileSpecForProtein } from "@/lib/docking/profiles"
import { dockingSetupReason, unsupportedTargetsNeedWarning } from "@/lib/docking/targetSetup"
import type { Protein } from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"
import dynamic from "next/dynamic"

const ProteinViewer3D = dynamic(
  () => import("@/lib/mol3d").then((m) => m.ProteinViewer3D),
  { ssr: false, loading: () => <div className="h-[280px] flex items-center justify-center text-xs text-slate-400">Loading 3D structure…</div> }
)
import { createProtein, deleteProtein, listProteins } from "@/lib/repositories/researchDataRepository"
import { useRcsbStructure } from "@/lib/scientific/client"

const FILTERS: Array<{ id: "all" | ProteinGroup; label: string }> = [
  { id: "all", label: "All" },
  { id: "oncogene", label: "Oncogene" },
  { id: "tumor-suppressor", label: "Tumor suppressor" },
  { id: "apoptosis", label: "Apoptosis" },
  { id: "antioxidant", label: "Antioxidant" },
  { id: "invasion", label: "Invasion" },
  { id: "cell-cycle", label: "Cell cycle" },
  { id: "signaling", label: "Signaling" },
]

const GROUP_LABEL: Record<ProteinGroup, string> = {
  oncogene: "Oncogene",
  "tumor-suppressor": "Tumor suppressor",
  apoptosis: "Apoptosis",
  antioxidant: "Antioxidant",
  invasion: "Invasion",
  "cell-cycle": "Cell cycle",
  signaling: "Signaling",
}

export interface ProteinBrowserProps {
  onChangedAction?: () => void
  onBackAction?: () => void
  onContinueAction?: () => void
}

export function ProteinBrowser({
  onChangedAction,
  onBackAction,
  onContinueAction,
}: ProteinBrowserProps) {
  const handleChanged = onChangedAction ?? (() => {})
  const handleBack = onBackAction ?? (() => {})
  const handleContinue = onContinueAction ?? (() => {})
  const { user } = useAuth()
  const { activeStudy, updateActiveStudy } = useStudy()
  const [rows, setRows] = useState<Protein[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
  const [viewKey, setViewKey] = useState(CATALOG_PROTEINS[0]?.key ?? "")
  const [mobilePane, setMobilePane] = useState<"library" | "detail">("library")
  const [showSelected, setShowSelected] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [savingAck, setSavingAck] = useState(false)
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

  const load = useCallback(async () => {
    if (!activeStudy) return
    setLoading(true)
    setError(null)
    try {
      setRows(await listProteins(activeStudy.id))
    } catch (e) {
      setError(toUserFacingError(e, "Could not load target proteins"))
    } finally {
      setLoading(false)
    }
  }, [activeStudy])

  useEffect(() => {
    void load()
  }, [load])

  const byName = useMemo(() => {
    const map = new Map<string, Protein>()
    for (const row of rows) map.set(row.name, row)
    return map
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CATALOG_PROTEINS.filter((item) => {
      if (filter !== "all" && item.group !== filter) return false
      if (!q) return true
      return `${item.name} ${item.gene ?? ""} ${item.pdbId ?? ""} ${item.pathway ?? ""} ${item.role ?? ""}`.toLowerCase().includes(q)
    })
  }, [filter, query])

  const viewing = CATALOG_PROTEINS.find((item) => item.key === viewKey) ?? visible[0] ?? CATALOG_PROTEINS[0]
  const record = useRcsbStructure(viewing?.pdbId)
  const selectedItems = CATALOG_PROTEINS.filter((item) => byName.has(item.name))
  const selectedCount = selectedItems.length
  const selectedReports = selectedItems.map((item) => ({
    item,
    report: dockingProfileReport({ pdbId: item.pdbId, uniprotIds: item.uniprotIds, name: item.name, targetId: item.key }),
  }))
  const readySelected = selectedReports.filter((row) => row.report.ready)
  const setupSelected = selectedReports.filter((row) => !row.report.ready)
  const collapsed = selectedCount > 4 && !showSelected

  const requestContinue = () => {
    const acknowledged = activeStudy?.dockingReadinessAcknowledgement?.proteinNames
    if (!unsupportedTargetsNeedWarning(setupSelected.map((row) => row.item.name), acknowledged)) {
      handleContinue()
      return
    }
    setConfirmLeave(true)
  }

  const continueAnyway = async () => {
    if (!activeStudy || savingAck) return
    setSavingAck(true)
    setError(null)
    try {
      const previous = activeStudy.dockingReadinessAcknowledgement?.proteinNames ?? []
      const proteinNames = [...new Set([...previous, ...setupSelected.map((row) => row.item.name)])]
      await updateActiveStudy({
        dockingReadinessAcknowledgement: {
          proteinNames,
          acknowledgedAt: new Date().toISOString(),
        },
      })
      setConfirmLeave(false)
      handleContinue()
    } catch (reason) {
      setError(toUserFacingError(reason, "Could not save this acknowledgement"))
    } finally {
      setSavingAck(false)
    }
  }

  const toggle = useCallback(
    async (item: CatalogProtein) => {
      if (!activeStudy || !user) return
      const matches = rows.filter(
        (r) =>
          r.name.toLowerCase() === item.name.toLowerCase() ||
          (item.pdbId && r.pdbId?.toUpperCase() === item.pdbId.toUpperCase())
      )
      const prevRows = rows
      setError(null)
      setPendingKeys((prev) => {
        const next = new Set(prev)
        next.add(item.key)
        return next
      })

      // Instant optimistic update
      if (matches.length > 0) {
        setRows((prev) =>
          prev.filter(
            (r) =>
              r.name.toLowerCase() !== item.name.toLowerCase() &&
              (!item.pdbId || r.pdbId?.toUpperCase() !== item.pdbId.toUpperCase())
          )
        )
      } else {
        const input = catalogProteinInput(item)
        const optimistic: Protein = {
          ...input,
          id: `temp-${item.key}-${Date.now()}`,
          studyId: activeStudy.id,
          referenceIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: user.uid,
          updatedBy: user.uid,
          provenance: {
            evidenceClass: "REFERENCE",
            source: item.pdbId ? "RCSB PDB" : "Catalog",
          },
        }
        setRows((prev) => [...prev, optimistic])
      }

      try {
        if (matches.length > 0) {
          for (const existing of matches) {
            await deleteProtein(activeStudy.id, existing.id, { id: user.uid })
          }
        } else {
          const created = await createProtein(activeStudy.id, { id: user.uid }, catalogProteinInput(item))
          setRows((prev) =>
            prev.map((r) =>
              r.name.toLowerCase() === item.name.toLowerCase() ||
              (item.pdbId && r.pdbId?.toUpperCase() === item.pdbId.toUpperCase())
                ? created
                : r
            )
          )
        }
        triggerDebouncedChanged()
      } catch (e) {
        console.error("[ProteinBrowser] error toggling protein:", e)
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
    [activeStudy, user, rows, triggerDebouncedChanged]
  )

  const [batchBusy, setBatchBusy] = useState(false)

  const selectAllVisible = useCallback(async () => {
    if (!activeStudy || !user || visible.length === 0) return
    const unselected = visible.filter((item) => !byName.has(item.name))
    if (unselected.length === 0) return

    setBatchBusy(true)
    setError(null)
    const prevRows = rows

    const optimisticRows: Protein[] = unselected.map((item) => {
      const input = catalogProteinInput(item)
      return {
        ...input,
        id: `temp-${item.key}-${Date.now()}-${Math.random()}`,
        studyId: activeStudy.id,
        referenceIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.uid,
        updatedBy: user.uid,
        provenance: {
          evidenceClass: "REFERENCE",
          source: item.pdbId ? "RCSB PDB" : "Catalog",
        },
      }
    })
    setRows((prev) => [...prev, ...optimisticRows])

    try {
      await Promise.allSettled(
        unselected.map((item) => createProtein(activeStudy.id, { id: user.uid }, catalogProteinInput(item)))
      )
      const freshRows = await listProteins(activeStudy.id)
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
        prevRows.map((r) => deleteProtein(activeStudy.id, r.id, { id: user.uid }))
      )
      const freshRows = await listProteins(activeStudy.id)
      setRows(freshRows)
      triggerDebouncedChanged()
    } catch (e) {
      setRows(prevRows)
      setError(toUserFacingError(e, "Could not clear selections"))
    } finally {
      setBatchBusy(false)
    }
  }, [activeStudy, user, rows, triggerDebouncedChanged])

  const open = useCallback((item: CatalogProtein) => {
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
              <h2>Target proteins</h2>
            </div>
            <div className="phyto-selection-summary" aria-live="polite">
              <p className="phyto-count">
                <span key={selectedCount}>{selectedCount}</span>
                <small>selected</small>
              </p>
              {selectedCount > 0 ? (
                <>
                  <span data-ready="true">✓ {readySelected.length} docking ready</span>
                  <span data-ready="false">⚠ {setupSelected.length} requires setup</span>
                </>
              ) : null}
            </div>
          </header>
          <label className="phyto-search">
            <Search size={14} aria-hidden />
            <input value={query} placeholder="Search proteins..." onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {selectedCount === CATALOG_PROTEINS.length && CATALOG_PROTEINS.length > 0
                ? `All ${selectedCount} selected`
                : `${selectedCount} of ${CATALOG_PROTEINS.length} selected`}
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
          <div className="phyto-filters" role="tablist" aria-label="Protein class">
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
                <ProteinRow
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
          {visible.length === 0 ? <p className="phyto-empty">No proteins match that search.</p> : null}
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
            {collapsed ? <p className="phyto-picked-empty">{selectedCount} proteins selected</p> : null}
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
                <p className="phyto-kicker" data-tone={viewing.group}>
                  <Atom size={13} aria-hidden />
                  {viewing.group ? GROUP_LABEL[viewing.group] : viewing.role ?? "Target protein"}
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
                {byName.has(viewing.name) ? <><Check size={14} aria-hidden />Selected</> : <><Plus size={14} aria-hidden />Select for Study</>}
              </button>
            </header>
            <DockingSetupStatus protein={viewing} />
            <DockingSystemFacts protein={viewing} />
            <ul className="phyto-identity">
              <li><span>Gene</span><strong>{viewing.gene ?? "—"}</strong></li>
              <li><span>PDB</span><strong>{viewing.pdbId ?? "—"}</strong></li>
              <li><span>Pathway</span><strong>{viewing.pathway ?? "—"}</strong></li>
            </ul>
            {record.status === "error" ? (
              <div className="phyto-unavailable" role="status">
                <p>Scientific data temporarily unavailable.</p>
                <button type="button" onClick={record.retry}>Retry</button>
              </div>
            ) : null}
            <div className="phyto-overview">
              <section className="phyto-stage">
                <h3>3D protein structure</h3>
                {viewing.key === "lats1" ? (
                  <ProteinViewer3D key="LATS1_AF" pdbId="LATS1_AF" name={viewing.name} height={320} quiet />
                ) : viewing.pdbId ? (
                  <ProteinViewer3D key={viewing.pdbId} pdbId={viewing.pdbId} name={viewing.name} height={320} quiet />
                ) : (
                  <p className="phyto-missing">This library record has no PDB ID.</p>
                )}
              </section>
              <section>
                <h3>Protein overview</h3>
                <dl className="phyto-facts">
                  <Fact label="Biological target" value={viewing.biologicalTarget ?? viewing.name} />
                  <Fact label="Gene" value={viewing.geneSymbol ?? viewing.gene} />
                  <Fact label="Pathway" value={viewing.pathway} />
                  <Fact label="Docking receptor" value={viewing.structureProtein} />
                  <Fact label="Structure" value={viewing.structureContext} />
                  <Fact label="Role" value={viewing.role} />
                  <Fact label="PDB" value={viewing.pdbId} />
                  <Fact label="Notes" value={viewing.functionNotes} />
                </dl>
              </section>
            </div>
            {viewing.key === "lats1" ? (
              <section className="phyto-block">
                <h3>Predicted structure record</h3>
                <p className="phyto-caption">From AlphaFold DB (DeepMind / EMBL-EBI).</p>
                <dl className="phyto-props">
                  <Prop label="Research target" value="LATS1" />
                  <Prop label="Actual receptor" value="LATS1 kinase domain (residues 705–1010)" />
                  <Prop label="Structure source" value="Predicted" />
                  <Prop label="Model source" value="AlphaFold DB (AF-O95835-F1)" />
                  <Prop label="UniProt" value="O95835" />
                  <Prop label="Model confidence" value="Average pLDDT 81.8 (catalytic core 98.3)" />
                  <Prop label="Binding site" value="ATP-binding pocket" />
                  <Prop label="Binding-site source" value="Conserved catalytic core (Gly-loop 711-719, Lys734, Asp828, Asp846) aligned with homologous NDR1 kinase domain (PDB 6BXI)" />
                  <Prop label="Organism" value="Homo sapiens" />
                </dl>
                <div className="phyto-source-card" style={{ marginTop: "12px" }}>
                  <p>AlphaFold DB</p>
                  <p>Predicted structure record · AF-O95835-F1</p>
                  <a href="https://alphafold.ebi.ac.uk/entry/AF-O95835-F1" target="_blank" rel="noreferrer">
                    View AlphaFold source
                    <ExternalLink size={12} aria-hidden />
                  </a>
                </div>
              </section>
            ) : (
              <section className="phyto-block">
                <h3>Structure record</h3>
                <p className="phyto-caption">From RCSB PDB.</p>
                {record.status === "loading" ? (
                  <div className="phyto-skel" aria-hidden><i /><i /><i /><i /></div>
                ) : record.status === "ready" && record.data ? (
                  <>
                    {record.data.title ? <p className="phyto-iupac"><span>Structure title</span>{record.data.title}</p> : null}
                    <dl className="phyto-props">
                      <Prop label="Molecule" value={record.data.molecule} />
                      <Prop label="Method" value={record.data.method} />
                      <Prop label="Resolution" value={record.data.resolution} />
                      <Prop label="Released" value={record.data.released} />
                      <Prop label="Organism" value={record.data.organism} />
                    </dl>
                  </>
                ) : null}
              </section>
            )}
            {record.status === "ready" && viewing.pdbId ? (
              <section className="phyto-block">
                <h3>Scientific source</h3>
                <div className="phyto-source-card">
                  <p>RCSB PDB</p>
                  <p>Structure record · PDB {viewing.pdbId}</p>
                  <a href={`https://www.rcsb.org/structure/${viewing.pdbId}`} target="_blank" rel="noreferrer">
                    View source
                    <ExternalLink size={12} aria-hidden />
                  </a>
                  {record.data?.doi ? (
                    <a href={`https://doi.org/${record.data.doi}`} target="_blank" rel="noreferrer">
                      DOI {record.data.doi}
                      <ExternalLink size={12} aria-hidden />
                    </a>
                  ) : null}
                </div>
              </section>
            ) : null}
          </article>
        ) : null}
      </div>
      <footer className="phyto-nav">
        <button type="button" className="phyto-back" onClick={handleBack}>
          <ArrowLeft size={15} aria-hidden />
          Back
        </button>
        <button type="button" className="phyto-continue" disabled={selectedCount < 1 || loading || savingAck} onClick={requestContinue}>
          Continue to Cell Lines
          <ArrowRight size={15} aria-hidden />
        </button>
      </footer>
      {confirmLeave ? (
        <div className="nano-modal-back" role="presentation">
          <div className="nano-modal" role="dialog" aria-modal="true" aria-labelledby="docking-leave-title">
            <h2 id="docking-leave-title">Some targets are not docking-ready</h2>
            <p>
              {setupSelected.length} of your {selectedCount} selected {selectedCount === 1 ? "target" : "targets"} cannot currently be processed by AutoDock Vina.
            </p>
            <ul className="phyto-leave-list">
              {setupSelected.map((row) => (
                <li key={row.item.key}>
                  <strong>{row.item.name}</strong>
                  <span>{dockingSetupReason(row.report.status)}</span>
                </li>
              ))}
            </ul>
            <p>
              {setupSelected.length === 1 ? "This target can remain" : "These targets can remain"} part of the study, but Molecular Docking will not be available until the docking configuration is completed.
            </p>
            <div className="nano-modal-form">
              <button type="button" className="phyto-back" disabled={savingAck} onClick={() => { setConfirmLeave(false); setMobilePane("library") }}>
                Review Targets
              </button>
              <button type="button" className="phyto-continue" disabled={savingAck} onClick={() => void continueAnyway()}>
                {savingAck ? "Saving…" : "Continue Anyway"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DockingSetupStatus({ protein }: { protein: CatalogProtein }) {
  const report = dockingProfileReport({ pdbId: protein.pdbId, uniprotIds: protein.uniprotIds, name: protein.name, targetId: protein.key })
  const system = dockingSystemFor(protein)
  if (report.ready && system) return null
  if (report.ready) {
    return <p className="phyto-profile" data-ready="true" role="status">{report.label}</p>
  }
  return (
    <div className="phyto-setup" role="status" data-status={report.status}>
      <p>{report.label}</p>
      {report.issue ? <p className="phyto-missing">{report.issue}</p> : null}
      <ul>
        {report.missing.filter((item) => item !== report.issue).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="phyto-missing">This target can still be included in the study.</p>
    </div>
  )
}

function DockingSystemFacts({ protein }: { protein: CatalogProtein }) {
  const spec = profileSpecForProtein(protein)
  if (!spec || !isCompleteDockingProfile(spec)) return null
  const system = dockingSystemLabels({
    name: protein.name,
    pathway: protein.pathway,
    biologicalTarget: protein.biologicalTarget,
    spec,
  })
  const isPredicted = spec.structureSource === "PREDICTED_STRUCTURE" || spec.verificationSource === "AlphaFold DB" || protein.key === "lats1"
  const structureValue = isPredicted
    ? `AlphaFold DB (${spec.structureId ?? "AF-O95835-F1"})`
    : `${system.pdbId} · ${spec.structureMethod ?? "X-ray"}`
  const siteSource = spec.bindingSiteSource ?? (spec.referenceLigand ? `Co-crystallized inhibitor ${spec.referenceLigand}` : "Curated site residues")
  return (
    <section className="phyto-system" aria-label="Docking target">
      <header className="phyto-system-head">
        <h3>Docking target</h3>
        <p className="phyto-system-status">
          <Check size={12} aria-hidden />
          AutoDock Vina ready
        </p>
      </header>
      <dl className="phyto-system-pair">
        <div>
          <dt>Research target</dt>
          <dd>{spec.researchTarget ?? system.researchTarget}</dd>
        </div>
        <div>
          <dt>Actual receptor</dt>
          <dd>{spec.actualDockingReceptor ?? system.dockingReceptor}</dd>
        </div>
      </dl>
      <dl className="phyto-system-grid">
        <div>
          <dt>Structure source</dt>
          <dd>{isPredicted ? "Predicted structure" : "Experimental structure"}</dd>
        </div>
        <div>
          <dt>{isPredicted ? "Model source" : "PDB"}</dt>
          <dd>{structureValue}</dd>
        </div>
        <div>
          <dt>UniProt</dt>
          <dd>{spec.receptorUniprotId}</dd>
        </div>
        <div>
          <dt>Binding site</dt>
          <dd>{spec.bindingSiteLabel}</dd>
        </div>
        <div className="phyto-system-wide">
          <dt>Binding-site source</dt>
          <dd>{siteSource}</dd>
        </div>
      </dl>
      {system.affinityNote ? (
        <p className="phyto-system-note">
          <span>Scientific context</span>
          {system.affinityNote}
        </p>
      ) : null}
    </section>
  )
}

function dockingSystemFor(protein: CatalogProtein) {
  const spec = profileSpecForProtein(protein)
  if (!spec || !isCompleteDockingProfile(spec)) return null
  return dockingSystemLabels({
    name: protein.name,
    pathway: protein.pathway,
    biologicalTarget: protein.biologicalTarget,
    spec,
  })
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

interface ProteinRowProps {
  item: CatalogProtein
  checked: boolean
  viewing: boolean
  busy: boolean
  disabled: boolean
  onOpen: (item: CatalogProtein) => void
  onToggle: (item: CatalogProtein) => void
}

const ProteinRow = React.memo(function ProteinRow({
  item,
  checked,
  viewing,
  busy,
  disabled,
  onOpen,
  onToggle,
}: ProteinRowProps) {
  return (
    <li
      data-viewing={viewing ? "true" : "false"}
      data-selected={checked ? "true" : "false"}
      data-tone={item.group}
    >
      <button type="button" className="phyto-row" onClick={() => onOpen(item)}>
        <span className="phyto-row-mark" aria-hidden />
        <span className="phyto-row-copy">
          <span className="phyto-row-name">{item.key === "ccnd1" ? "Cyclin D1 / CDK" : item.name}</span>
          <span className="phyto-row-sub">
            <span className="phyto-row-class">{item.pathway}</span>
            <span className="phyto-row-meta">{item.key === "lats1" ? "AlphaFold DB" : item.pdbId ? `PDB ${item.pdbId}` : "No PDB"}</span>
            <span className="phyto-row-meta" style={{ color: "#059669", fontWeight: 500 }}>
              ✓ AutoDock Vina ready
            </span>
            {item.key === "lats1" ? (
              <span
                className="phyto-row-meta"
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(147, 51, 234, 0.12)",
                  color: "#7e22ce",
                  fontWeight: 600,
                }}
                title="Predicted structure from AlphaFold DB (v4) of human LATS1 kinase domain (residues 705–1010)"
              >
                Predicted structure
              </span>
            ) : item.key === "ccnd1" ? (
              <>
                <span
                  className="phyto-row-meta"
                  style={{
                    fontSize: "11px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(37, 99, 235, 0.1)",
                    color: "#2563eb",
                    fontWeight: 600,
                  }}
                  title="Experimental crystal structure from RCSB PDB"
                >
                  Experimental structure
                </span>
                <span
                  className="phyto-row-meta"
                  style={{
                    fontSize: "11px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(13, 148, 136, 0.12)",
                    color: "#0f766e",
                    fontWeight: 600,
                  }}
                  title="Docking targets the druggable CDK partner (CDK6, PDB 5L2I) in the Cyclin D1–CDK cell-cycle signaling complex"
                >
                  CDK receptor
                </span>
              </>
            ) : (
              <span
                className="phyto-row-meta"
                style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(37, 99, 235, 0.1)",
                  color: "#2563eb",
                  fontWeight: 600,
                }}
                title="Experimental crystal structure from RCSB PDB"
              >
                Experimental structure
              </span>
            )}
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
