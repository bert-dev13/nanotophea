import { AuditLogSchema, type AuditLog } from "@/lib/domain/models"
import { STUDY_SUBCOLLECTIONS, studySub } from "@/lib/firebase/paths"
import { docRef, setDocData } from "@/lib/firebase/firestore"

export async function writeAuditLog(input: {
  studyId: string
  actorId: string
  action: string
  entityType: string
  entityId?: string
  meta?: Record<string, string | number | boolean | null>
}): Promise<AuditLog> {
  const ref = docRef(studySub(input.studyId, STUDY_SUBCOLLECTIONS.auditLogs))
  const log: AuditLog = AuditLogSchema.parse({
    id: ref.id,
    studyId: input.studyId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    at: new Date().toISOString(),
    meta: input.meta,
  })
  await setDocData(studySub(input.studyId, STUDY_SUBCOLLECTIONS.auditLogs), log.id, log)
  return log
}
