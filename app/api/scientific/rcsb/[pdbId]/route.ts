import { NextResponse } from "next/server"
import { assertPdbId, getRcsbStructure } from "@/lib/scientific/rcsb"

export async function GET(_request: Request, context: { params: Promise<{ pdbId: string }> }) {
  const { pdbId } = await context.params
  try {
    assertPdbId(pdbId)
    const data = await getRcsbStructure(pdbId)
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=3600" } })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
