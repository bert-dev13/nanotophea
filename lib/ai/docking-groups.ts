import type { DockingContextRow } from "@/lib/ai/types"

/** Drop a trailing rerun marker so "YAP1 repeat" stays the YAP1 target. */
export function canonicalDockingTarget(value: string): string {
  return value
    .replace(/\s*[([{\u2013-]?\s*(?:repeat|rerun|re-run|run\s*\d+)\s*[\])}]*\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function canonicalDockingPair(pair: string): string {
  const parts = pair.split("×")
  if (parts.length < 2) return pair.trim()
  const compound = parts[0]?.trim() ?? ""
  const target = canonicalDockingTarget(parts.slice(1).join("×"))
  return compound && target ? `${compound} × ${target}` : pair.trim()
}

export function dockingPairKey(pair: string): string {
  const canonical = canonicalDockingPair(pair)
  const [compound, target] = canonical.split("×")
  return `${(compound ?? canonical).trim().toLowerCase()}|${(target ?? "").trim().toLowerCase()}`
}

export function dockingFocusMatches(pair: string, focus: string): boolean {
  const canonical = canonicalDockingPair(pair)
  const wanted = canonicalDockingPair(focus.includes("×") ? focus : `× ${focus}`).split("×").at(-1)?.trim().toLowerCase() ?? ""
  const target = canonical.split("×").at(-1)?.trim().toLowerCase() ?? ""
  if (!wanted) return false
  if (canonical.toLowerCase() === focus.trim().toLowerCase()) return true
  return target === wanted
}

export function wantsRunHistory(question: string): boolean {
  return /\b(run history|reruns?|re-runs?|repeated runs?|which run|all runs|every run)\b/i.test(question)
}

/**
 * One row per compound + target. The latest valid run is the representative result.
 * Earlier runs stay on `history` when the caller asks to keep them.
 */
export function representativeDocking(rows: DockingContextRow[], includeHistory = false): DockingContextRow[] {
  const groups = new Map<string, DockingContextRow[]>()
  for (const row of rows) {
    const key = dockingPairKey(row.pair)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }
  return [...groups.values()].map((runs) => {
    const sorted = [...runs].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    const latest = sorted[0]
    const history = sorted.flatMap((run) => (
      run.history?.length
        ? run.history
        : [{ pair: canonicalDockingPair(run.pair), affinityKcalMol: run.affinityKcalMol, updatedAt: run.updatedAt }]
    ))
    const uniqueHistory = dedupeHistory(history)
    const runCount = runs.reduce((sum, run) => sum + (run.runCount && run.runCount > 0 ? run.runCount : 1), 0)
    return {
      ...latest,
      pair: canonicalDockingPair(latest.pair),
      updatedAt: uniqueHistory.find((item) => item.updatedAt)?.updatedAt ?? latest.updatedAt,
      runCount,
      history: includeHistory && uniqueHistory.length > 1 ? uniqueHistory : undefined,
    }
  })
}

function dedupeHistory(rows: Array<{ pair: string; affinityKcalMol: number; updatedAt?: string }>) {
  const seen = new Set<string>()
  const unique = []
  for (const row of rows) {
    const key = `${row.updatedAt ?? ""}|${row.affinityKcalMol}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({ ...row, pair: canonicalDockingPair(row.pair) })
  }
  return unique.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
}
