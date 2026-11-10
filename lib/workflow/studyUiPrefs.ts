/**
 * Session-scoped UI focus prefs for a study (filters, selected rows, deferred panels).
 * Survives step navigation within the same browser tab; does not rewrite scientific records.
 */

export type StudyUiPrefBag = Record<string, string | number | boolean | null | undefined>

const PREFIX = "hepatotea.studyUi."

function key(studyId: string, namespace: string) {
  return `${PREFIX}${studyId}.${namespace}`
}

export function readStudyUiPrefs<T extends StudyUiPrefBag>(
  studyId: string | null | undefined,
  namespace: string,
  fallback: T,
): T {
  if (!studyId || typeof window === "undefined") return fallback
  try {
    const raw = window.sessionStorage.getItem(key(studyId, namespace))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<T>
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

export function writeStudyUiPrefs(
  studyId: string | null | undefined,
  namespace: string,
  prefs: StudyUiPrefBag,
): void {
  if (!studyId || typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(key(studyId, namespace), JSON.stringify(prefs))
  } catch {
    // Ignore quota / private-mode failures.
  }
}
