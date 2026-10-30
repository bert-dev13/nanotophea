import { NextResponse } from "next/server"
import { getSessionUserFromRequest } from "@/lib/auth/session"
import { deleteStudy, getStudy, getStudyMember } from "@/lib/repositories/studyRepository"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  try {
    const user = await getSessionUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { studyId } = await params
    if (!studyId || typeof studyId !== "string") {
      return NextResponse.json({ error: "Invalid study ID" }, { status: 400 })
    }

    const study = await getStudy(studyId)
    if (!study) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 })
    }

    // Permission check
    const isOwner = study.ownerId === user.id || user.role === "OWNER" || user.defaultRole === "OWNER"
    let isMemberOwner = false
    if (!isOwner) {
      const membership = await getStudyMember(studyId, user.id)
      if (membership?.role === "OWNER") isMemberOwner = true
    }

    if (!isOwner && !isMemberOwner) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to delete this investigation" },
        { status: 403 }
      )
    }

    await deleteStudy(studyId, user.id)

    return NextResponse.json({
      success: true,
      message: "Investigation deleted successfully.",
    })
  } catch (err) {
    console.error("[DELETE /api/studies/[studyId]] error:", err)
    return NextResponse.json(
      { error: "Unable to delete this investigation. Please try again." },
      { status: 500 }
    )
  }
}
