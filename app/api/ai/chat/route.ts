import { NextResponse } from "next/server"
import { studyAccessAllowed } from "@/lib/ai/access"
import { parseChatRequest } from "@/lib/ai/chat-request"
import { planConversation, renderConversationContext } from "@/lib/ai/conversation"
import { buildStudyAIContext, loadStudyAISlice } from "@/lib/ai/context"
import { ensureResearchInterpretation } from "@/lib/ai/interpretation-store"
import { allowAiRequest } from "@/lib/ai/rate-limit"
import { AI_UNAVAILABLE } from "@/lib/ai/types"
import { completeResearchChat, parseInterpretationDraft } from "@/lib/ai/together"
import { getSessionUserFromRequest } from "@/lib/auth/session"
import { query, queryOne } from "@/lib/db/mysql"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const uid = await actorId(request)
  if (!uid) return NextResponse.json({ error: "Sign in to use the research assistant." }, { status: 401 })

  const parsed = parseChatRequest(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { intent, page, messages } = parsed.data
  const studyId = parsed.data.studyId

  try {
    if (studyId) {
      const study = await queryOne<any>("SELECT * FROM studies WHERE id = ?", [studyId])
      if (!study) {
        return NextResponse.json({ error: "You do not have access to this study." }, { status: 403 })
      }
      const members = await query<any>("SELECT user_id FROM study_members WHERE study_id = ?", [studyId])
      const data = { ownerId: study.owner_id, memberIds: members.map((m) => m.user_id) }
      if (!studyAccessAllowed(data, uid)) {
        return NextResponse.json({ error: "You do not have access to this study." }, { status: 403 })
      }
    }
    if (intent === "interpret") {
      try {
        const stored = await ensureResearchInterpretation(studyId!, uid)
        return NextResponse.json({
          interpretation: stored.interpretation,
          evidenceUsed: stored.evidenceUsed,
          generatedAt: stored.generatedAt,
          evidenceVersion: stored.evidenceVersion,
          interpretationId: stored.id,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown"
        console.error("Research interpretation failed:", message.slice(0, 300))
        return NextResponse.json({ error: AI_UNAVAILABLE }, { status: message === "rate_limited" ? 429 : 503 })
      }
    }
    if (!allowAiRequest(uid)) return NextResponse.json({ error: AI_UNAVAILABLE }, { status: 429 })
    const conversation = planConversation(messages, page)
    const context = intent === "draft"
      ? await buildStudyAIContext(studyId!, page)
      : studyId && conversation.scope !== "none"
        ? renderConversationContext(await loadStudyAISlice(studyId), conversation, page)
        : ""
    const reply = await completeResearchChat({
      context,
      messages: intent === "draft"
        ? [{ role: "user", content: "Draft the four interpretation fields from the recorded study context." }]
        : messages,
      intent: intent === "draft" ? "draft" : "chat",
      guidance: conversation.guidance,
    })
    if (!reply) return NextResponse.json({ error: AI_UNAVAILABLE }, { status: 503 })
    return NextResponse.json({
      message: reply,
      draft: intent === "draft" ? parseInterpretationDraft(reply) : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    console.error("AI assistant request failed:", message.slice(0, 300))
    return NextResponse.json({ error: AI_UNAVAILABLE }, { status: 503 })
  }
}

async function actorId(request: Request): Promise<string | null> {
  const user = await getSessionUserFromRequest(request)
  return user?.id ?? null
}
