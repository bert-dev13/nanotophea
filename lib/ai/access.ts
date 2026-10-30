export function studyAccessAllowed(
  study: { ownerId?: string; memberIds?: string[] } | null | undefined,
  uid: string,
): boolean {
  if (!study || !uid) return false
  if (study.ownerId === uid) return true
  return Array.isArray(study.memberIds) && study.memberIds.includes(uid)
}
