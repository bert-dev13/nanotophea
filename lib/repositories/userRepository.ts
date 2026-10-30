"use server"

import { UserProfileSchema, type UserProfile, type StudyRole } from "@/lib/domain/models"
import { execute, queryOne } from "@/lib/db/mysql"
import { mapUser } from "@/lib/repositories/mysqlMappers"

export interface UserAuthRecord {
  id: string
  email: string
  passwordHash: string | null
  displayName: string
  role: StudyRole
  defaultRole: StudyRole
  isActive: boolean
  photoURL?: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const row = await queryOne<any>(`SELECT * FROM users WHERE id = ?`, [userId])
  if (!row) return null
  return mapUser(row)
}

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  const row = await queryOne<any>(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()])
  if (!row) return null
  return mapUser(row)
}

/**
 * Server-only internal retrieval including passwordHash.
 * NEVER expose this result directly through APIs or client components.
 */
export async function getUserAuthByEmail(email: string): Promise<UserAuthRecord | null> {
  const row = await queryOne<any>(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()])
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash ?? null,
    displayName: row.display_name,
    role: row.role || row.default_role || "VIEWER",
    defaultRole: row.default_role || row.role || "VIEWER",
    isActive: row.is_active === 1 || row.is_active === true,
    photoURL: row.photo_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? null,
  }
}

/**
 * Server-only internal retrieval including passwordHash.
 * NEVER expose this result directly through APIs or client components.
 */
export async function getUserAuthById(userId: string): Promise<UserAuthRecord | null> {
  const row = await queryOne<any>(`SELECT * FROM users WHERE id = ?`, [userId])
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash ?? null,
    displayName: row.display_name,
    role: row.role || row.default_role || "VIEWER",
    defaultRole: row.default_role || row.role || "VIEWER",
    isActive: row.is_active === 1 || row.is_active === true,
    photoURL: row.photo_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? null,
  }
}

export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  const now = new Date().toISOString()
  await execute(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [
    passwordHash,
    now,
    userId,
  ])
}

export async function updateUserLastLogin(userId: string): Promise<void> {
  const now = new Date().toISOString()
  await execute(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`, [
    now,
    now,
    userId,
  ])
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const now = new Date().toISOString()
  await execute(`UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?`, [
    isActive ? 1 : 0,
    now,
    userId,
  ])
}

export async function upsertUserProfile(input: {
  id: string
  email: string
  displayName?: string | null
  photoURL?: string | null
  defaultRole?: StudyRole
  role?: StudyRole
  passwordHash?: string | null
  isActive?: boolean
}): Promise<UserProfile> {
  const existing = await getUserProfile(input.id)
  const now = new Date().toISOString()
  const role = input.role || input.defaultRole || "VIEWER"

  if (existing) {
    const updated: UserProfile = UserProfileSchema.parse({
      ...existing,
      email: input.email.trim(),
      displayName: input.displayName?.trim() || existing.displayName,
      photoURL: input.photoURL ?? existing.photoURL ?? null,
      role: input.role ?? existing.role ?? role,
      defaultRole: input.defaultRole ?? existing.defaultRole ?? role,
      isActive: input.isActive ?? existing.isActive ?? true,
      updatedAt: now,
    })

    const updates: string[] = ["email = ?", "display_name = ?", "photo_url = ?", "updated_at = ?"]
    const params: unknown[] = [updated.email, updated.displayName, updated.photoURL ?? null, updated.updatedAt]

    if (input.passwordHash !== undefined) {
      updates.push("password_hash = ?")
      params.push(input.passwordHash)
    }
    if (input.role !== undefined) {
      updates.push("role = ?")
      params.push(input.role)
    }
    if (input.defaultRole !== undefined) {
      updates.push("default_role = ?")
      params.push(input.defaultRole)
    }
    if (input.isActive !== undefined) {
      updates.push("is_active = ?")
      params.push(input.isActive ? 1 : 0)
    }

    params.push(input.id)
    await execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params)
    return updated
  }

  const created: UserProfile = UserProfileSchema.parse({
    id: input.id,
    email: input.email.trim(),
    displayName: input.displayName?.trim() || input.email.split("@")[0] || "Researcher",
    photoURL: input.photoURL ?? null,
    createdAt: now,
    updatedAt: now,
    role,
    defaultRole: role,
    isActive: input.isActive ?? true,
  })

  await execute(
    `INSERT INTO users (id, email, password_hash, display_name, photo_url, role, default_role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       email = VALUES(email), 
       display_name = VALUES(display_name), 
       photo_url = VALUES(photo_url), 
       role = VALUES(role),
       default_role = VALUES(default_role),
       is_active = VALUES(is_active),
       updated_at = VALUES(updated_at)`,
    [
      created.id,
      created.email,
      input.passwordHash ?? null,
      created.displayName,
      created.photoURL ?? null,
      created.role,
      created.defaultRole,
      created.isActive ? 1 : 0,
      created.createdAt,
      created.updatedAt,
    ]
  )
  return created
}

export async function updateUserProfile(
  userId: string,
  patch: Partial<Pick<UserProfile, "displayName" | "defaultRole" | "role" | "photoURL" | "isActive">>
): Promise<void> {
  const now = new Date().toISOString()
  const updates: string[] = ["updated_at = ?"]
  const params: unknown[] = [now]

  if (patch.displayName !== undefined) {
    updates.push("display_name = ?")
    params.push(patch.displayName)
  }
  if (patch.photoURL !== undefined) {
    updates.push("photo_url = ?")
    params.push(patch.photoURL)
  }
  if (patch.role !== undefined) {
    updates.push("role = ?")
    params.push(patch.role)
  }
  if (patch.defaultRole !== undefined) {
    updates.push("default_role = ?")
    params.push(patch.defaultRole)
  }
  if (patch.isActive !== undefined) {
    updates.push("is_active = ?")
    params.push(patch.isActive ? 1 : 0)
  }

  params.push(userId)
  await execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params)
}
