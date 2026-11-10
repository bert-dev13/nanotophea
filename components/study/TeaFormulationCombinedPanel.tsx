"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Leaf } from "lucide-react"
import {
  TEA_FORMULATION_COMPOSITION_TITLE,
  type FormulationCompoundIdentity,
} from "@/lib/phytochemicals/analysisView"
import { DeferredCompoundViewer } from "@/components/study/DeferredMolecularViewer"

export interface CombinedCompoundResultRow {
  compoundId: string
  context: string
  result: string
  detail?: string
  evidence?: string
}

export function TeaFormulationCombinedPanel({
  compounds,
  resultRows,
  stageLabel,
  onInspectCompound,
}: {
  compounds: FormulationCompoundIdentity[]
  resultRows: CombinedCompoundResultRow[]
  stageLabel: string
  onInspectCompound?: (compoundId: string) => void
}) {
  const sorted = useMemo(
    () => [...compounds].sort((a, b) => a.name.localeCompare(b.name)),
    [compounds],
  )
  const [inspectId, setInspectId] = useState("")

  useEffect(() => {
    if (!sorted.length) {
      setInspectId("")
      return
    }
    if (!sorted.some((row) => row.id === inspectId)) {
      setInspectId(sorted[0].id)
    }
  }, [sorted, inspectId])

  const inspectIndex = sorted.findIndex((row) => row.id === inspectId)
  const inspecting = inspectIndex >= 0 ? sorted[inspectIndex] : null

  function selectCompound(id: string) {
    setInspectId(id)
  }

  function step(delta: number) {
    if (!sorted.length) return
    const current = inspectIndex >= 0 ? inspectIndex : 0
    const next = (current + delta + sorted.length) % sorted.length
    setInspectId(sorted[next].id)
  }

  const resultsTitle =
    stageLabel.toLowerCase().includes("dock")
      ? "Docking results"
      : stageLabel.toLowerCase().includes("prediction")
        ? "Prediction results"
        : `${stageLabel} results`

  return (
    <article className="phyto-detail tea-dash">
      <header className="tea-dash-hero">
        <div>
          <p className="phyto-kicker" data-tone="flavonoids">
            <Leaf size={13} aria-hidden />
            Combined tea formulation
          </p>
          <h2>{TEA_FORMULATION_COMPOSITION_TITLE}</h2>
        </div>
        <div className="tea-dash-hero-meta" aria-live="polite">
          <strong>{sorted.length}</strong>
          <span>{sorted.length === 1 ? "compound" : "compounds"}</span>
        </div>
      </header>

      <p className="tea-dash-disclaimer" role="note">
        Individual phytochemical structures and results only — not a fused molecule or averaged score.
      </p>

      <section className="tea-dash-section">
        <div className="tea-dash-section-head">
          <h3>Composition</h3>
        </div>
        {sorted.length === 0 ? (
          <p className="dock-note">No phytochemicals selected in Research Setup.</p>
        ) : (
          <div className="tea-dash-compound-grid" role="list">
            {sorted.map((compound) => {
              const selected = compound.id === inspectId
              return (
                <button
                  key={compound.id}
                  type="button"
                  role="listitem"
                  className="tea-dash-compound-card"
                  data-selected={selected ? "true" : "false"}
                  onClick={() => selectCompound(compound.id)}
                  aria-pressed={selected}
                >
                  <strong>{compound.name}</strong>
                  <span className="tea-dash-compound-meta">
                    {compound.pubchemCid != null ? `CID ${compound.pubchemCid}` : "No CID"}
                    {compound.formula?.trim() ? ` · ${compound.formula.trim()}` : ""}
                  </span>
                  <span className="tea-dash-compound-class">
                    {compound.chemicalClass?.trim() || "Unclassified"}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="tea-dash-section">
        <div className="tea-dash-section-head tea-dash-section-head--split">
          <h3>Molecular structure</h3>
          {inspecting ? (
            <div className="tea-dash-nav">
              <button type="button" className="tea-dash-nav-btn" disabled={sorted.length < 2} onClick={() => step(-1)}>
                <ChevronLeft size={14} aria-hidden />
              </button>
              <span>
                {inspecting.name}
                <small>
                  {inspectIndex + 1}/{sorted.length}
                  {inspecting.pubchemCid != null ? ` · CID ${inspecting.pubchemCid}` : ""}
                </small>
              </span>
              <button type="button" className="tea-dash-nav-btn" disabled={sorted.length < 2} onClick={() => step(1)}>
                <ChevronRight size={14} aria-hidden />
              </button>
              {onInspectCompound ? (
                <button
                  type="button"
                  className="tea-dash-link-btn"
                  onClick={() => onInspectCompound(inspecting.id)}
                >
                  Open individual
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {!inspecting ? (
          <p className="dock-note">Select a compound to inspect its structure.</p>
        ) : inspecting.pubchemCid == null ? (
          <div className="tea-dash-unavailable">
            Structure unavailable — no PubChem CID for {inspecting.name}.
          </div>
        ) : (
          <>
            <DeferredCompoundViewer
              key={inspecting.pubchemCid}
              cid={inspecting.pubchemCid}
              name={inspecting.name}
              height={300}
              quiet
            />
            <dl className="tea-dash-facts">
              <div>
                <dt>Formula</dt>
                <dd>{inspecting.formula?.trim() || "—"}</dd>
              </div>
              <div>
                <dt>Class</dt>
                <dd>{inspecting.chemicalClass?.trim() || "—"}</dd>
              </div>
              <div>
                <dt>PubChem</dt>
                <dd>
                  <a
                    href={`https://pubchem.ncbi.nlm.nih.gov/compound/${inspecting.pubchemCid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    CID {inspecting.pubchemCid}
                  </a>
                </dd>
              </div>
            </dl>
          </>
        )}
      </section>

      <section className="tea-dash-section">
        <div className="tea-dash-section-head">
          <h3>{resultsTitle}</h3>
        </div>
        {resultRows.length === 0 ? (
          <p className="dock-note">No recorded results yet.</p>
        ) : (
          <div className="dock-table-wrap tea-dash-table-wrap">
            <table className="dock-table tea-dash-table">
              <thead>
                <tr>
                  <th>Compound</th>
                  <th>Target / context</th>
                  <th>Result</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((row, index) => {
                  const compound = compounds.find((item) => item.id === row.compoundId)
                  const active = row.compoundId === inspectId
                  return (
                    <tr
                      key={`${row.compoundId}:${row.context}:${index}`}
                      data-active={active ? "true" : "false"}
                      onClick={() => selectCompound(row.compoundId)}
                    >
                      <td>
                        <strong>{compound?.name ?? row.compoundId}</strong>
                        {compound?.pubchemCid != null ? (
                          <div className="tea-dash-muted">CID {compound.pubchemCid}</div>
                        ) : null}
                      </td>
                      <td>{row.context}</td>
                      <td>{row.result}</td>
                      <td>
                        <span className="tea-dash-muted">{row.evidence ?? row.detail ?? "—"}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  )
}
