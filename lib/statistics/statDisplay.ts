/**
 * Sentinels for statistical quantities that cannot be stored as Infinity in Firestore.
 * UI must display these as mathematical infinity, not as ordinary measured values.
 */

/** Stored in Firestore when ANOVA/Scheffé F is mathematically infinite (zero within-MS). */
export const INFINITE_STAT_SENTINEL = Number.MAX_VALUE

export function isInfiniteStatDisplay(n: number | null | undefined): boolean {
  if (n == null || Number.isNaN(n)) return false
  if (!Number.isFinite(n)) return true
  // Treat MAX_VALUE (and near-max) as the infinity sentinel used for persistence
  return n >= Number.MAX_VALUE / 2
}

export function formatStatNumber(n: number | null | undefined, digits = 4): string {
  if (n == null || Number.isNaN(n)) return "—"
  if (isInfiniteStatDisplay(n)) return "∞"
  if (Math.abs(n) >= 1e6) return n.toExponential(3)
  return Number(n.toFixed(digits)).toString()
}

export function toFirestoreStatNumber(n: number | null): number | null {
  if (n == null) return null
  if (!Number.isFinite(n)) return n === Infinity ? INFINITE_STAT_SENTINEL : null
  return n
}
