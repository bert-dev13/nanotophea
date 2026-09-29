import type { StudyRole } from "@/lib/domain/models"

/**
 * Single-admin prototype: the authenticated administrator is study OWNER.
 * OWNER (and legacy COLLABORATOR) may write; ADVISER/VIEWER remain read-only
 * if those memberships ever appear in data.
 */
export function canEditResearchData(role: StudyRole | null | undefined): boolean {
  return role === "OWNER" || role === "COLLABORATOR"
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

export function researchRoleLabel(role: StudyRole | null | undefined): string {
  if (!role) return "Study ownership not verified"
  if (canEditResearchData(role)) return "Administrator · full access"
  return "Read-only"
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
