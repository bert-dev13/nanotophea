import { NextResponse } from "next/server"
import { assertCid, getPubChemImage } from "@/lib/scientific/pubchem"

function isPng(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 8) return false
  const head = new Uint8Array(bytes, 0, 8)
  return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
}

export async function GET(_request: Request, context: { params: Promise<{ cid: string }> }) {
  const { cid } = await context.params
  const id = Number(cid)
  try {
    assertCid(id)
    const bytes = await getPubChemImage(id)
    if (!isPng(bytes)) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 })
    }
    const body = new Uint8Array(bytes)
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
