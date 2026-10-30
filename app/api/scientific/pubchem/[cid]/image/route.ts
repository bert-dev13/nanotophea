import { NextResponse } from "next/server"
import { assertCid, getPubChemImage } from "@/lib/scientific/pubchem"

export async function GET(_request: Request, context: { params: Promise<{ cid: string }> }) {
  const { cid } = await context.params
  const id = Number(cid)
  try {
    assertCid(id)
    const bytes = await getPubChemImage(id)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
