import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { execute, queryOne } from "@/lib/db/mysql"
import { mapUser } from "@/lib/repositories/mysqlMappers"
import type { UserProfile } from "@/lib/domain/models"

export const SESSION_COOKIE_NAME = "nanotophea_session"
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // 7 days

export interface SessionRecord {
  id: string
  userId: string
  expiresAt: number
  createdAt: string
  lastActiveAt: string
  userAgent: string | null
  ipAddress: string | null
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export async function createSession(
  userId: string,
  metadata?: { userAgent?: string | null; ipAddress?: string | null }
): Promise<{ token: string; expiresAt: number }> {
  const token = generateSessionToken()
  const nowMs = Date.now()
  const expiresAt = nowMs + SESSION_MAX_AGE_SECONDS * 1000
  const nowIso = new Date(nowMs).toISOString()

  await execute(
    `INSERT INTO sessions (id, user_id, expires_at, created_at, last_active_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      token,
      userId,
      expiresAt,
      nowIso,
      nowIso,
      metadata?.userAgent?.slice(0, 500) ?? null,
      metadata?.ipAddress?.slice(0, 45) ?? null,
    ]
  )

  return { token, expiresAt }
}

export async function validateSession(token: string): Promise<{ session: SessionRecord; user: UserProfile } | null> {
  if (!token || typeof token !== "string" || token.length < 32) return null

  const row = await queryOne<any>(
    `SELECT 
       s.id as s_id, s.user_id as s_user_id, s.expires_at as s_expires_at,
       s.created_at as s_created_at, s.last_active_at as s_last_active_at,
       s.user_agent as s_user_agent, s.ip_address as s_ip_address,
       u.id, u.email, u.display_name, u.photo_url, u.role, u.default_role,
       u.is_active, u.created_at, u.updated_at, u.last_login_at
     FROM sessions s
     INNER JOIN users u ON s.user_id = u.id
     WHERE s.id = ?`,
    [token]
  )

  if (!row) return null

  const nowMs = Date.now()
  if (Number(row.s_expires_at) < nowMs) {
    // Session expired — purge
    await execute(`DELETE FROM sessions WHERE id = ?`, [token]).catch(() => {})
    return null
  }

  // Check if account is active
  if (row.is_active === 0 || row.is_active === false) {
    // Inactive account — revoke session
    await execute(`DELETE FROM sessions WHERE id = ?`, [token]).catch(() => {})
    return null
  }

  const session: SessionRecord = {
    id: row.s_id,
    userId: row.s_user_id,
    expiresAt: Number(row.s_expires_at),
    createdAt: row.s_created_at,
    lastActiveAt: row.s_last_active_at,
    userAgent: row.s_user_agent ?? null,
    ipAddress: row.s_ip_address ?? null,
  }

  const user = mapUser(row)

  // Touch last_active_at asynchronously if older than 5 minutes
  const lastActiveMs = new Date(row.s_last_active_at).getTime()
  if (nowMs - lastActiveMs > 5 * 60 * 1000) {
    execute(`UPDATE sessions SET last_active_at = ? WHERE id = ?`, [
      new Date(nowMs).toISOString(),
      token,
    ]).catch(() => {})
  }

  return { session, user }
}

export async function invalidateSession(token: string): Promise<void> {
  if (!token) return
  await execute(`DELETE FROM sessions WHERE id = ?`, [token]).catch(() => {})
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  if (!userId) return
  await execute(`DELETE FROM sessions WHERE user_id = ?`, [userId]).catch(() => {})
}

/**
 * Server-side session verification for API routes.
 * Supports both Cookie (nanotophea_session) and Authorization: Bearer <token>.
 */
export async function getSessionUserFromRequest(request: Request): Promise<UserProfile | null> {
  let token: string | null = null

  // 1. Check Authorization header
  const authHeader = request.headers.get("authorization") || ""
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim()
  }

  // 2. If no Bearer header, check Cookie header
  if (!token) {
    const cookieHeader = request.headers.get("cookie") || ""
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`))
    if (match && match[1]) {
      token = decodeURIComponent(match[1].trim())
    }
  }

  if (!token) return null

  const result = await validateSession(token)
  return result?.user ?? null
}

/**
 * Server Component / Server Action helper to retrieve current user from Next.js cookies.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!token) return null
    const result = await validateSession(token)
    return result?.user ?? null
  } catch {
    return null
  }
}
