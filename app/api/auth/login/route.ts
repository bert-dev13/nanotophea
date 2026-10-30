import { NextResponse } from "next/server"
import { getUserAuthByEmail, updateUserLastLogin } from "@/lib/repositories/userRepository"
import { verifyPassword } from "@/lib/auth/password"
import { createSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Fixed dummy hash for constant-time comparison when email is not found
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uG0u5p51m.e5K1s72aR5Y9mJ4fKxVwqu"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 })
    }

    const user = await getUserAuthByEmail(email)

    if (!user) {
      // Constant-time check to prevent timing attacks / account enumeration
      await verifyPassword(password, DUMMY_HASH)
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "This account has been deactivated. Please contact an administrator." },
        { status: 403 }
      )
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 })
    }

    // Update last login timestamp
    await updateUserLastLogin(user.id).catch(() => {})

    // Extract metadata
    const userAgent = request.headers.get("user-agent") || null
    const forwardedFor = request.headers.get("x-forwarded-for")
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() || null : null

    // Create session in database
    const { token, expiresAt } = await createSession(user.id, { userAgent, ipAddress })

    const userProfile = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      defaultRole: user.defaultRole,
      photoURL: user.photoURL ?? null,
      isActive: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: new Date().toISOString(),
    }

    const response = NextResponse.json({
      ok: true,
      user: userProfile,
      token,
    })

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      expires: new Date(expiresAt),
    })

    return response
  } catch (error) {
    console.error("[auth/login]", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Authentication service error. Please try again." }, { status: 500 })
  }
}
