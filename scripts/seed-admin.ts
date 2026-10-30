/**
 * One-shot Admin seed for MySQL: User + Password Hash + Study Ownership.
 *
 * Usage: npx tsx scripts/seed-admin.ts
 */
import { execute, query, queryOne, getPool } from "../lib/db/mysql"
import { hashPassword } from "../lib/auth/password"

const EMAIL = process.env.NANOTOPHEA_ADMIN_EMAIL || "admin@demo.com"
const PASSWORD = process.env.NANOTOPHEA_ADMIN_PASSWORD || "admin123"
const DISPLAY_NAME = "NANOTOPHEA Admin"
const KNOWN_ADMIN_UID = "g1dxux39lfeAb8RbvLEWgQ1IH6f2"

function nowIso() {
  return new Date().toISOString()
}

async function ensureAdminUser(): Promise<string> {
  const existing = await queryOne<any>(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [EMAIL])
  const now = nowIso()
  const passwordHash = await hashPassword(PASSWORD)

  if (existing) {
    await execute(
      `UPDATE users SET 
         password_hash = ?, 
         display_name = ?, 
         role = 'OWNER', 
         default_role = 'OWNER', 
         is_active = 1, 
         updated_at = ? 
       WHERE id = ?`,
      [passwordHash, DISPLAY_NAME, now, existing.id]
    )
    console.log(`✔ Admin user updated in MySQL: ${EMAIL} (${existing.id}) [Role: OWNER, Active: 1]`)
    return existing.id
  }

  // Create new user using the known admin UID to preserve study ownership links
  await execute(
    `INSERT INTO users (id, email, password_hash, display_name, photo_url, role, default_role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, 'OWNER', 'OWNER', 1, ?, ?)`,
    [KNOWN_ADMIN_UID, EMAIL, passwordHash, DISPLAY_NAME, now, now]
  )
  console.log(`✔ Admin user created in MySQL: ${EMAIL} (${KNOWN_ADMIN_UID}) [Role: OWNER, Active: 1]`)
  return KNOWN_ADMIN_UID
}

/** Repair OWNER membership for every study owned by this admin UID. */
async function repairOwnedStudyMemberships(uid: string) {
  const now = nowIso()
  const studies = await query<any>(`SELECT id, owner_id FROM studies WHERE owner_id = ?`, [uid])

  let repaired = 0
  for (const s of studies) {
    const studyId = s.id
    const member = await queryOne<any>(
      `SELECT * FROM study_members WHERE study_id = ? AND user_id = ?`,
      [studyId, uid]
    )

    if (!member) {
      await execute(
        `INSERT INTO study_members (id, study_id, user_id, email, display_name, role, added_at, added_by)
         VALUES (?, ?, ?, ?, ?, 'OWNER', ?, ?)`,
        [`${studyId}_${uid}`, studyId, uid, EMAIL, DISPLAY_NAME, now, uid]
      )
      repaired++
      console.log(`✔ Repaired OWNER membership for study ${studyId}`)
    } else if (member.role !== "OWNER") {
      await execute(`UPDATE study_members SET role = 'OWNER' WHERE id = ?`, [member.id])
      repaired++
      console.log(`✔ Updated membership role to OWNER for study ${studyId}`)
    }
  }

  console.log(`✔ Verified OWNER membership for ${studies.length} study/studies`)
}

async function main() {
  console.log("=== SEEDING NANOTOPHEA ADMIN USER IN MYSQL ===")
  const uid = await ensureAdminUser()
  await repairOwnedStudyMemberships(uid)
  console.log("=== ADMIN SEED COMPLETE ===")
  const pool = getPool()
  await pool.end()
}

main().catch((err) => {
  console.error("Seed error:", err)
  process.exit(1)
})
