import { NextResponse } from "next/server"
import { assertCid, getPubChemCompound } from "@/lib/scientific/pubchem"

export async function GET(_request: Request, context: { params: Promise<{ cid: string }> }) {
  const { cid } = await context.params
  const id = Number(cid)
  try {
    assertCid(id)
    const data = await getPubChemCompound(id)
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=3600" } })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
