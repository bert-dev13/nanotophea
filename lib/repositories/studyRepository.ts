"use server"

import {
  CreateStudyInputSchema,
  StudyMemberSchema,
  StudySchema,
  UpdateStudyInputSchema,
  type CreateStudyInput,
  type Study,
  type StudyMember,
  type UpdateStudyInput,
  type UserProfile,
} from "@/lib/domain/models"
import { execute, query, queryOne, transaction } from "@/lib/db/mysql"
import { mapStudy, mapStudyMember } from "@/lib/repositories/mysqlMappers"
import { writeAuditLog } from "@/lib/repositories/auditRepository"
import { randomUUID } from "crypto"
import { existsSync, rmSync } from "node:fs"
import { resolve } from "node:path"

function ownerMembership(owner: UserProfile, now: string, studyId?: string): StudyMember {
  return StudyMemberSchema.parse({
    id: studyId ? `${studyId}_${owner.id}` : owner.id,
    userId: owner.id,
    email: owner.email,
    displayName: owner.displayName,
    role: "OWNER",
    addedAt: now,
    addedBy: owner.id,
  })
}

function generateStudyId(): string {
  // Generate a clean 20-character alphanumeric ID for consistency
  return randomUUID().replace(/-/g, "").slice(0, 20)
}

export async function createStudy(owner: UserProfile, input: CreateStudyInput): Promise<Study> {
  const parsed = CreateStudyInputSchema.parse(input)
  const studyId = generateStudyId()
  const now = new Date().toISOString()

  const study: Study = StudySchema.parse({
    id: studyId,
    title: parsed.title,
    shortTitle: parsed.shortTitle,
    description: parsed.description,
    status: "draft",
    primaryCellLine: "",
    formulationSummary: "",
    fairYear: parsed.fairYear,
    researcherNames: parsed.researcherNames,
    adviserNames: parsed.adviserNames,
    ownerId: owner.id,
    memberIds: [owner.id],
    createdAt: now,
    updatedAt: now,
    contractVersion: "2026-09-29",
  })

  const member = ownerMembership(owner, now, study.id)

  await transaction(async (conn) => {
    // Ensure owner exists in users table
    await conn.execute(
      `INSERT INTO users (id, email, display_name, photo_url, default_role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
      [owner.id, owner.email, owner.displayName, owner.photoURL ?? null, owner.defaultRole, now, now]
    )

    // Insert study
    await conn.execute(
      `INSERT INTO studies (
        id, title, short_title, description, status, primary_cell_line,
        formulation_summary, fair_year, researcher_names, adviser_names,
        owner_id, contract_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        study.id,
        study.title,
        study.shortTitle ?? null,
        study.description ?? null,
        study.status,
        study.primaryCellLine,
        study.formulationSummary,
        study.fairYear ?? null,
        study.researcherNames ? JSON.stringify(study.researcherNames) : null,
        study.adviserNames ? JSON.stringify(study.adviserNames) : null,
        study.ownerId,
        study.contractVersion,
        study.createdAt,
        study.updatedAt,
      ]
    )

    // Insert owner member
    await conn.execute(
      `INSERT INTO study_members (id, study_id, user_id, email, display_name, role, added_at, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [member.id, study.id, member.userId, member.email, member.displayName, member.role, member.addedAt, member.addedBy]
    )
  })

  try {
    await writeAuditLog({
      studyId: study.id,
      actorId: owner.id,
      action: "study.create",
      entityType: "study",
      entityId: study.id,
    })
  } catch {
    /* Opening the study does not depend on the audit row. */
  }

  return study
}

export async function ensureOwnerMembership(
  study: Study,
  owner: UserProfile
): Promise<StudyMember | null> {
  if (study.ownerId !== owner.id) return null

  const existing = await getStudyMember(study.id, owner.id)
  if (existing?.role === "OWNER") return existing

  const now = new Date().toISOString()
  const member = ownerMembership(owner, now, study.id)

  await execute(
    `INSERT INTO study_members (id, study_id, user_id, email, display_name, role, added_at, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role = 'OWNER'`,
    [member.id, study.id, member.userId, member.email, member.displayName, member.role, member.addedAt, member.addedBy]
  )

  return member
}

export async function getStudy(studyId: string): Promise<Study | null> {
  const row = await queryOne(`SELECT * FROM studies WHERE id = ?`, [studyId])
  if (!row) return null

  // Fetch all memberIds for this study
  const memberRows = await query(`SELECT user_id FROM study_members WHERE study_id = ?`, [studyId])
  const memberIds = memberRows.map((r: any) => r.user_id)
  row.member_ids = memberIds

  return mapStudy(row)
}

export async function listStudiesForUser(userId: string): Promise<Study[]> {
  const rows = await query(
    `SELECT s.*
     FROM studies s
     INNER JOIN study_members m ON s.id = m.study_id
     WHERE m.user_id = ?
     ORDER BY s.updated_at DESC`,
    [userId]
  )
  if (rows.length === 0) return []

  const studyIds = rows.map((r: any) => r.id)
  const memberRows = await query(
    `SELECT study_id, user_id FROM study_members WHERE study_id IN (${studyIds.map(() => "?").join(",")})`,
    studyIds
  )
  const membersByStudy = new Map<string, string[]>()
  for (const m of memberRows) {
    let arr = membersByStudy.get(m.study_id)
    if (!arr) {
      arr = []
      membersByStudy.set(m.study_id, arr)
    }
    arr.push(m.user_id)
  }

  return rows.map((r: any) => {
    r.member_ids = membersByStudy.get(r.id) || [r.owner_id]
    return mapStudy(r)
  })
}

export async function updateStudy(
  studyId: string,
  actorId: string,
  input: UpdateStudyInput
): Promise<Study> {
  const parsed = UpdateStudyInputSchema.parse(input)
  const existing = await getStudy(studyId)
  if (!existing) throw new Error("Study not found")

  const now = new Date().toISOString()
  const fields: string[] = ["updated_at = ?"]
  const params: unknown[] = [now]

  if (parsed.title !== undefined) {
    fields.push("title = ?")
    params.push(parsed.title)
  }
  if (parsed.shortTitle !== undefined) {
    fields.push("short_title = ?")
    params.push(parsed.shortTitle ?? null)
  }
  if (parsed.description !== undefined) {
    fields.push("description = ?")
    params.push(parsed.description ?? null)
  }
  if (parsed.status !== undefined) {
    fields.push("status = ?")
    params.push(parsed.status)
  }
  if (parsed.primaryCellLine !== undefined) {
    fields.push("primary_cell_line = ?")
    params.push(parsed.primaryCellLine)
  }
  if (parsed.formulationSummary !== undefined) {
    fields.push("formulation_summary = ?")
    params.push(parsed.formulationSummary)
  }
  if (parsed.fairYear !== undefined) {
    fields.push("fair_year = ?")
    params.push(parsed.fairYear ?? null)
  }
  if (parsed.researcherNames !== undefined) {
    fields.push("researcher_names = ?")
    params.push(parsed.researcherNames ? JSON.stringify(parsed.researcherNames) : null)
  }
  if (parsed.adviserNames !== undefined) {
    fields.push("adviser_names = ?")
    params.push(parsed.adviserNames ? JSON.stringify(parsed.adviserNames) : null)
  }
  if (parsed.predictionModules !== undefined) {
    fields.push("prediction_modules = ?")
    params.push(parsed.predictionModules ? JSON.stringify(parsed.predictionModules) : null)
  }
  if (parsed.laboratorySections !== undefined) {
    fields.push("laboratory_sections = ?")
    params.push(parsed.laboratorySections ? JSON.stringify(parsed.laboratorySections) : null)
  }
  if (parsed.laboratoryOmissions !== undefined) {
    fields.push("laboratory_omissions = ?")
    params.push(parsed.laboratoryOmissions ? JSON.stringify(parsed.laboratoryOmissions) : null)
  }
  if (parsed.laboratoryEvidenceAt !== undefined) {
    fields.push("laboratory_evidence_at = ?")
    params.push(parsed.laboratoryEvidenceAt ?? null)
  }
  if (parsed.dockingConfigurations !== undefined) {
    fields.push("docking_configurations = ?")
    params.push(parsed.dockingConfigurations ? JSON.stringify(parsed.dockingConfigurations) : null)
  }
  if (parsed.dockingReadinessAcknowledgement !== undefined) {
    fields.push("docking_readiness_acknowledgement = ?")
    params.push(
      parsed.dockingReadinessAcknowledgement
        ? JSON.stringify(parsed.dockingReadinessAcknowledgement)
        : null
    )
  }
  if (parsed.analysisFinalizedAt !== undefined) {
    fields.push("analysis_finalized_at = ?")
    params.push(parsed.analysisFinalizedAt ?? null)
  }

  params.push(studyId)
  await execute(`UPDATE studies SET ${fields.join(", ")} WHERE id = ?`, params)

  await writeAuditLog({
    studyId,
    actorId,
    action: "study.update",
    entityType: "study",
    entityId: studyId,
  })

  const updated = await getStudy(studyId)
  if (!updated) throw new Error("Study update failed")
  return updated
}

export async function deleteStudy(studyId: string, actorId: string): Promise<void> {
  const study = await getStudy(studyId)
  if (!study) {
    throw new Error("Study not found")
  }

  // Permission verification
  if (actorId) {
    const isOwner = study.ownerId === actorId
    let isOwnerMember = false
    try {
      const membership = await getStudyMember(studyId, actorId)
      if (membership?.role === "OWNER") isOwnerMember = true
    } catch {
      /* ignore */
    }

    let isSystemOwner = false
    try {
      const u = await queryOne<any>(
        "SELECT role, default_role FROM users WHERE id = ?",
        [actorId]
      )
      if (u?.role === "OWNER" || u?.default_role === "OWNER") isSystemOwner = true
    } catch {
      /* ignore */
    }

    if (!isOwner && !isOwnerMember && !isSystemOwner) {
      throw new Error("Unauthorized: only an owner can delete this investigation")
    }
  }

  // Dependent tables in reverse foreign key dependency order
  const childTables = [
    "comparisons",
    "statistics_analyses",
    "laboratory_replicates",
    "laboratory_datasets",
    "biological_predictions",
    "docking_jobs",
    "docking_runs",
    "docking_pairs",
    "admet_runs",
    "cell_lines",
    "target_proteins",
    "phytochemicals",
    "formulations",
    "interpretations",
    "references",
    "audit_logs",
    "study_members",
    "studies",
  ] as const

  await transaction(async (conn) => {
    for (const table of childTables) {
      if (table === "studies") {
        await conn.execute("DELETE FROM studies WHERE id = ?", [studyId])
      } else {
        await conn.execute(`DELETE FROM \`${table}\` WHERE study_id = ?`, [studyId])
      }
    }
  })

  // Cleanup study-specific disk files if configured
  const root = process.env.DOCKING_ARTIFACT_DIR?.trim()
  if (root) {
    try {
      const studyDir = resolve(root, studyId)
      if (existsSync(studyDir)) {
        rmSync(studyDir, { recursive: true, force: true })
      }
    } catch {
      /* Non-fatal cleanup */
    }
  }
}

export async function getStudyMember(studyId: string, userId: string): Promise<StudyMember | null> {
  const row = await queryOne(
    `SELECT * FROM study_members WHERE study_id = ? AND user_id = ?`,
    [studyId, userId]
  )
  if (!row) return null
  return mapStudyMember(row)
}

export async function listStudyMembers(studyId: string): Promise<StudyMember[]> {
  const rows = await query(`SELECT * FROM study_members WHERE study_id = ?`, [studyId])
  return rows.map(mapStudyMember)
}
