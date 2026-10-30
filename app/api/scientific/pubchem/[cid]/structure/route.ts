import { NextResponse } from "next/server"
import { assertCid, getPubChemStructure } from "@/lib/scientific/pubchem"

export async function GET(_request: Request, context: { params: Promise<{ cid: string }> }) {
  const { cid } = await context.params
  const id = Number(cid)
  try {
    assertCid(id)
    const data = await getPubChemStructure(id)
    return NextResponse.json(
      { cid: data.cid, conformer: data.conformer, sdf: data.sdf },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    )
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
