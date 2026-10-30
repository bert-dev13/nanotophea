import type { StudyRole } from "@/lib/domain/models"

/**
 * One signed-in account authors every study record.
 * Role values may still exist on older membership documents; they do not limit access.
 */
export function canEditResearchData(_role: StudyRole | null | undefined): boolean {
  return true
}

export function canEditScientificRuns(role: StudyRole | null | undefined): boolean {
  return canEditResearchData(role)
}

export function canEditLabData(role: StudyRole | null | undefined): boolean {
  return canEditResearchData(role)
}

export function canEditStatistics(role: StudyRole | null | undefined): boolean {
  return canEditResearchData(role)
}

export function canEditComparisons(role: StudyRole | null | undefined): boolean {
  return canEditResearchData(role)
}

export function canEditInterpretations(role: StudyRole | null | undefined): boolean {
  return canEditResearchData(role)
}

export function researchRoleLabel(_role: StudyRole | null | undefined): string {
  return ""
}

export function scientificRunRoleLabel(role: StudyRole | null | undefined): string {
  return researchRoleLabel(role)
}

export function labRoleLabel(role: StudyRole | null | undefined): string {
  return researchRoleLabel(role)
}

export function statisticsRoleLabel(role: StudyRole | null | undefined): string {
  return researchRoleLabel(role)
}

export function comparisonRoleLabel(role: StudyRole | null | undefined): string {
  return researchRoleLabel(role)
}

export function interpretationRoleLabel(role: StudyRole | null | undefined): string {
  return researchRoleLabel(role)
}
