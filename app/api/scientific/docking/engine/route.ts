import { NextResponse } from "next/server"
import { getSessionUserFromRequest } from "@/lib/auth/session"
import { inspectEngine } from "@/services/docking/engine"
import { DOCKING_SERVICE_UNAVAILABLE } from "@/services/docking/types"

export async function GET(request: Request) {
  const user = await getSessionUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Sign in to use docking." }, { status: 401 })
  const status = inspectEngine()
  return NextResponse.json({
    available: status.available,
    message: status.available ? "AutoDock Vina" : DOCKING_SERVICE_UNAVAILABLE,
  })
}
