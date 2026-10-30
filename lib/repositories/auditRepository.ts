"use server"

import { AuditLogSchema, type AuditLog } from "@/lib/domain/models"
import { execute, query } from "@/lib/db/mysql"
import { mapAuditLog } from "@/lib/repositories/mysqlMappers"
import { randomUUID } from "crypto"

export async function writeAuditLog(input: {
  studyId: string
  actorId: string
  action: string
  entityType: string
  entityId?: string
  meta?: Record<string, string | number | boolean | null>
}): Promise<AuditLog> {
  const id = randomUUID()
  const now = new Date().toISOString()
  const log: AuditLog = AuditLogSchema.parse({
    id,
    studyId: input.studyId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    at: now,
    meta: input.meta,
  })

  await execute(
    `INSERT INTO audit_logs (id, study_id, actor_id, action, entity_type, entity_id, at, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.studyId,
      log.actorId,
      log.action,
      log.entityType,
      log.entityId ?? null,
      log.at,
      log.meta ? JSON.stringify(log.meta) : null,
    ]
  )
  return log
}

export async function listAuditLogs(studyId: string): Promise<AuditLog[]> {
  const rows = await query(`SELECT * FROM audit_logs WHERE study_id = ? ORDER BY at DESC`, [studyId])
  return rows.map(mapAuditLog)
}
