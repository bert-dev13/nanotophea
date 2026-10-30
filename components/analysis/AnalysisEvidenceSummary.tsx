"use client"

import { useEffect, useState } from "react"
import { useStudy } from "@/components/providers/StudyProvider"
import { listLabDatasets } from "@/lib/repositories/labRepository"
import { listPredictionRuns } from "@/lib/repositories/scientificRunRepository"

const COMPUTATIONAL = [
  { id: "dpph", label: "DPPH" },
  { id: "mtt", label: "MTT" },
  { id: "ldh", label: "LDH" },
  { id: "ros", label: "ROS" },
  { id: "bax", label: "BAX" },
  { id: "hippo_yap", label: "Hippo–YAP" },
] as const

interface EvidenceRow {
  label: string
  value: string
}

export function AnalysisEvidenceSummary() {
  const { activeStudy } = useStudy()
  const [experimental, setExperimental] = useState<EvidenceRow[]>([])
  const [computational, setComputational] = useState<EvidenceRow[]>([])

  useEffect(() => {
    if (!activeStudy) return
    let cancelled = false
    void Promise.all([
      listLabDatasets(activeStudy.id),
      listPredictionRuns(activeStudy.id),
    ]).then(([labs, predictions]) => {
      if (cancelled) return
      const assay = (row: { assay?: string; assayType?: string }) => row.assayType || row.assay || ""
      const experimentalRows: EvidenceRow[] = []
      if (labs.some((row) => assay(row) === "dpph")) experimentalRows.push({ label: "DPPH", value: "Available" })
      if (labs.some((row) => assay(row) === "ldh")) experimentalRows.push({ label: "LDH", value: "Available" })
      const biological = new Set(["dpph", "mtt", "ldh", "ros", "bax", "hippo_yap"])
      if (labs.some((row) => assay(row) !== "" && !biological.has(assay(row)))) {
        experimentalRows.push({ label: "Characterization", value: "Available" })
      }
      const computationalRows: EvidenceRow[] = []
      for (const item of COMPUTATIONAL) {
        const matches = predictions.filter((run) => (run.endpoint || run.module) === item.id)
        if (matches.length === 0) continue
        const classes = new Set(matches.map((run) => run.provenance.evidenceClass))
        const value = classes.has("SIMULATION")
          ? "Simulation"
          : classes.has("PREDICTED")
            ? "Predicted"
            : "Recorded"
        computationalRows.push({ label: item.label, value })
      }
      setExperimental(experimentalRows)
      setComputational(computationalRows)
    })
    return () => {
      cancelled = true
    }
  }, [activeStudy])

  if (experimental.length === 0 && computational.length === 0) return null

  return (
    <div className="phyto-overview" aria-label="Evidence summary">
      {experimental.length > 0 ? (
        <section className="phyto-block">
          <h3>Experimental</h3>
          <dl className="phyto-facts">
            {experimental.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {computational.length > 0 ? (
        <section className="phyto-block">
          <h3>Computational</h3>
          <dl className="phyto-facts">
            {computational.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  )
}
