"use server"

import { canonicalDockingTarget, dockingPairKey } from "@/lib/ai/docking-groups"
import type { AnalysisChoice, AssistantCatalog, DockingChoice, EndpointChoice, ExploreStage } from "@/lib/ai/explore"
import { query, queryOne } from "@/lib/db/mysql"

const ENDPOINT_LABEL: Record<string, string> = {
  dpph: "DPPH",
  mtt: "MTT",
  ldh: "LDH",
  ros: "ROS",
  bax: "BAX",
  hippo_yap: "Hippo–YAP",
}

export async function loadAssistantCatalog(studyId: string): Promise<AssistantCatalog> {
  const [
    compounds,
    proteins,
    cellLines,
    formulations,
    admet,
    dockingRows,
    predictionRows,
    labRows,
    statRows,
    comparisonRows,
    interpretation,
  ] = await Promise.all([
    queryOne<any>("SELECT COUNT(*) AS n FROM phytochemicals WHERE study_id = ?", [studyId]),
    queryOne<any>("SELECT COUNT(*) AS n FROM target_proteins WHERE study_id = ?", [studyId]),
    queryOne<any>("SELECT COUNT(*) AS n FROM cell_lines WHERE study_id = ?", [studyId]),
    queryOne<any>("SELECT COUNT(*) AS n FROM formulations WHERE study_id = ?", [studyId]),
    queryOne<any>("SELECT COUNT(*) AS n FROM admet_runs WHERE study_id = ?", [studyId]),
    query<any>(
      `SELECT r.ligand_name, r.research_target, r.run_name, r.best_binding_affinity_kcal_mol, r.modes, r.status, r.updated_at,
        p.gene, p.gene_symbol, p.name AS protein_name, c.name AS compound_name
      FROM docking_runs r
      LEFT JOIN target_proteins p ON p.id = r.protein_id
      LEFT JOIN phytochemicals c ON c.id = r.compound_id
      WHERE r.study_id = ?
      ORDER BY r.updated_at DESC
      LIMIT 80`,
      [studyId],
    ),
    query<any>("SELECT endpoint FROM biological_predictions WHERE study_id = ? LIMIT 40", [studyId]),
    query<any>("SELECT assay_type, provenance FROM laboratory_datasets WHERE study_id = ? LIMIT 40", [studyId]),
    query<any>("SELECT id FROM statistics_analyses WHERE study_id = ? LIMIT 1", [studyId]),
    query<any>("SELECT id FROM comparisons WHERE study_id = ? LIMIT 1", [studyId]),
    queryOne<any>(
      "SELECT interpretation_text, body, comparison_summary, limitations, conclusion FROM interpretations WHERE study_id = ? ORDER BY updated_at DESC LIMIT 1",
      [studyId],
    ),
  ])

  const docking = dockingChoices(dockingRows)
  const predictions = endpointChoices(predictionRows, (row) => text(row.endpoint || row.module))
  const laboratory = laboratoryChoices(labRows)
  const analysis = analysisChoices(interpretation, statRows.length > 0, comparisonRows.length > 0)
  const setup = count(compounds) + count(proteins) + count(cellLines) + count(formulations) > 0
  const stages: ExploreStage[] = ["entire"]
  if (setup) stages.push("setup")
  if (count(admet) > 0) stages.push("insilico")
  if (docking.length > 0) stages.push("docking")
  if (predictions.length > 0) stages.push("predictions")
  if (laboratory.length > 0) stages.push("laboratory")
  if (analysis.length > 0) stages.push("analysis")

  return {
    stages,
    docking,
    predictions,
    laboratory,
    analysis,
    hasFormulation: count(formulations) > 0,
  }
}

function dockingChoices(rows: any[]): DockingChoice[] {
  const grouped = new Map<string, { compound: string; target: string; affinity: number }>()
  for (const row of rows) {
    if (text(row.status) === "SKIPPED") continue
    const affinity = finite(row.best_binding_affinity_kcal_mol)
    const modes = parseModes(row.modes)
    if (affinity == null || modes.length === 0) continue
    const compound = text(row.ligand_name) || text(row.compound_name)
    const target = canonicalDockingTarget(
      text(row.gene) || text(row.gene_symbol) || text(row.protein_name) || text(row.research_target) || text(row.run_name),
    )
    if (!compound || !target) continue
    const key = dockingPairKey(`${compound} × ${target}`)
    if (grouped.has(key)) continue
    grouped.set(key, { compound, target, affinity })
  }
  const items = [...grouped.values()]
  const targetCounts = new Map<string, number>()
  for (const item of items) targetCounts.set(item.target, (targetCounts.get(item.target) ?? 0) + 1)
  return items.map((item) => ({
    id: dockingPairKey(`${item.compound} × ${item.target}`),
    label: (targetCounts.get(item.target) ?? 0) > 1 ? `${item.compound} × ${item.target}` : item.target,
    affinityKcalMol: item.affinity,
    compound: item.compound,
  }))
}

function endpointChoices(rows: any[], endpointOf: (row: any) => string): EndpointChoice[] {
  const seen = new Set<string>()
  const choices: EndpointChoice[] = []
  for (const row of rows) {
    const key = endpointOf(row)
    const label = ENDPOINT_LABEL[key]
    if (!label || seen.has(key)) continue
    seen.add(key)
    choices.push({ id: key, label })
  }
  return choices.sort((a, b) => endpointOrder(a.id) - endpointOrder(b.id))
}

function laboratoryChoices(rows: any[]): EndpointChoice[] {
  const grouped = new Map<string, Set<string>>()
  for (const row of rows) {
    const key = text(row.assay_type)
    if (!ENDPOINT_LABEL[key]) continue
    const classes = grouped.get(key) ?? new Set<string>()
    const evidence = evidenceClass(row.provenance)
    if (evidence) classes.add(evidence)
    grouped.set(key, classes)
  }
  return [...grouped.entries()]
    .sort((a, b) => endpointOrder(a[0]) - endpointOrder(b[0]))
    .map(([id, classes]) => ({
      id,
      label: ENDPOINT_LABEL[id],
      evidence: classes.has("EXPERIMENTAL") && classes.has("SYNTHETIC")
        ? "MIXED"
        : classes.has("SYNTHETIC")
          ? "SYNTHETIC"
          : classes.has("EXPERIMENTAL")
            ? "EXPERIMENTAL"
            : undefined,
    }))
}

function analysisChoices(row: any, hasStatistics: boolean, hasComparison: boolean): AnalysisChoice[] {
  const choices: AnalysisChoice[] = []
  const overall = text(row?.interpretation_text) || text(row?.body) || text(row?.comparison_summary)
  const limitations = text(row?.limitations)
  const conclusion = text(row?.conclusion)
  if (overall || limitations || conclusion || hasComparison || hasStatistics) {
    choices.push({ id: "overall", label: "Overall Analysis" })
  }
  if (hasComparison || text(row?.comparison_summary)) choices.push({ id: "comparison", label: "Prediction vs Laboratory" })
  if (hasStatistics) choices.push({ id: "statistics", label: "Statistics" })
  if (limitations) choices.push({ id: "limitations", label: "Limitations" })
  if (conclusion) choices.push({ id: "conclusion", label: "Conclusion" })
  return choices
}

function endpointOrder(id: string): number {
  return Object.keys(ENDPOINT_LABEL).indexOf(id)
}

function evidenceClass(value: unknown): string {
  const parsed = typeof value === "string" ? safeJson(value) : value
  if (!parsed || typeof parsed !== "object") return ""
  const evidence = (parsed as { evidenceClass?: unknown }).evidenceClass
  return evidence === "EXPERIMENTAL" || evidence === "SYNTHETIC" ? evidence : ""
}

function parseModes(value: unknown): unknown[] {
  const parsed = typeof value === "string" ? safeJson(value) : value
  return Array.isArray(parsed) ? parsed : []
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function count(row: { n?: unknown } | null): number {
  const value = Number(row?.n ?? 0)
  return Number.isFinite(value) ? value : 0
}

function finite(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
