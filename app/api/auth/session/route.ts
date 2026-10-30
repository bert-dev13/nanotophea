import { NextResponse } from "next/server"
import { validateSession, SESSION_COOKIE_NAME } from "@/lib/auth/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    let token: string | null = null

    const authHeader = request.headers.get("authorization") || ""
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim()
    }

    if (!token) {
      const cookieHeader = request.headers.get("cookie") || ""
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`))
      if (match && match[1]) {
        token = decodeURIComponent(match[1].trim())
      }
    }

    if (!token) {
      return NextResponse.json({ user: null, token: null })
    }

    const validated = await validateSession(token)
    if (!validated) {
      const response = NextResponse.json({ user: null, token: null })
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      })
      return response
    }

    return NextResponse.json({
      user: validated.user,
      token,
    })
  } catch (error) {
    console.error("[auth/session]", error instanceof Error ? error.message : error)
    return NextResponse.json({ user: null, token: null })
  }
}
