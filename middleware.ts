import { NextResponse, type NextRequest } from "next/server"

const PROTECTED_PREFIXES = ["/study", "/analysis", "/insilico", "/lab", "/research"]
const SESSION_COOKIE_NAME = "nanotophea_session"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if requested path is protected
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (isProtected) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!sessionCookie) {
      // Redirect unauthenticated user to home sign-in gate
      const loginUrl = new URL("/", request.url)
      loginUrl.searchParams.set("signin", "1")
      loginUrl.searchParams.set("from", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (handled individually for granular 401/403 status responses)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, public assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)",
  ],
}
