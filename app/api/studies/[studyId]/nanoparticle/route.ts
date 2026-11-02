import { NextResponse } from "next/server"
import { getSessionUserFromRequest } from "@/lib/auth/session"
import { getStudy, getStudyMember } from "@/lib/repositories/studyRepository"
import {
  getNanoparticleFormulation,
  saveNanoparticleFormulation,
} from "@/lib/repositories/researchDataRepository"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  try {
    const user = await getSessionUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { studyId } = await params
    if (!studyId) return NextResponse.json({ error: "Invalid study ID" }, { status: 400 })

    const study = await getStudy(studyId)
    if (!study) return NextResponse.json({ error: "Study not found" }, { status: 404 })

    const record = await getNanoparticleFormulation(studyId)
    return NextResponse.json({ record })
  } catch (err: any) {
    console.error("[GET /api/studies/[studyId]/nanoparticle] error:", err)
    return NextResponse.json({ error: err.message || "Failed to load nanoparticle formulation" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  try {
    const user = await getSessionUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { studyId } = await params
    if (!studyId) return NextResponse.json({ error: "Invalid study ID" }, { status: 400 })

    const study = await getStudy(studyId)
    if (!study) return NextResponse.json({ error: "Study not found" }, { status: 404 })

    const body = await request.json()
    const saved = await saveNanoparticleFormulation(studyId, { id: user.id }, body)
    return NextResponse.json({ success: true, record: saved })
  } catch (err: any) {
    console.error("[POST /api/studies/[studyId]/nanoparticle] error:", err)
    return NextResponse.json({ error: err.message || "Failed to save nanoparticle formulation" }, { status: 500 })
  }
}

