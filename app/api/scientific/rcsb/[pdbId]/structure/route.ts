import { NextResponse } from "next/server"
import { assertPdbId, getRcsbCoordinates } from "@/lib/scientific/rcsb"
import { getAlphaFoldCoordinates } from "@/lib/scientific/alphafold"

export async function GET(_request: Request, context: { params: Promise<{ pdbId: string }> }) {
  const { pdbId } = await context.params
  const cleanId = (pdbId ?? "").trim().toUpperCase()
  if (cleanId === "LATS1_AF" || cleanId.startsWith("AF-")) {
    try {
      const modelId = cleanId === "LATS1_AF" ? "AF-O95835-F1" : cleanId
      const pdb = await getAlphaFoldCoordinates(modelId)
      return new NextResponse(pdb, {
        headers: {
          "Content-Type": "chemical/x-pdb",
          "Cache-Control": "private, max-age=3600",
        },
      })
    } catch {
      return NextResponse.json({ error: "unavailable" }, { status: 503 })
    }
  }
  try {
    const id = assertPdbId(cleanId)
    const pdb = await getRcsbCoordinates(id)
    return new NextResponse(pdb, {
      headers: {
        "Content-Type": "chemical/x-pdb",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
