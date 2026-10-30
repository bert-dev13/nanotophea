import type { AiChatMessage, AiPageContext } from "@/lib/ai/types"

const INTENTS = new Set(["chat", "draft", "interpret"])
const MESSAGE_LIMIT = 6000

export interface ParsedChatRequest {
  studyId?: string
  intent: "chat" | "draft" | "interpret"
  page: AiPageContext
  messages: AiChatMessage[]
}

export function parseChatRequest(input: unknown): { ok: true; data: ParsedChatRequest } | { ok: false; error: string } {
  const body = record(input)
  if (!body) return { ok: false, error: "The assistant request was not valid." }

  const intentValue = body.intent == null || body.intent === "" ? "chat" : body.intent
  if (typeof intentValue !== "string" || !INTENTS.has(intentValue)) {
    return { ok: false, error: "The assistant request was not valid." }
  }
  const intent = intentValue as ParsedChatRequest["intent"]

  let studyId: string | undefined
  if (body.studyId != null && body.studyId !== "") {
    if (typeof body.studyId !== "string" || body.studyId.length > 128) {
      return { ok: false, error: "The assistant request was not valid." }
    }
    studyId = body.studyId
  }

  const messages = readMessages(body)
  if ((intent === "draft" || intent === "interpret") && !studyId) {
    return { ok: false, error: "Open a study to use the research assistant." }
  }
  if (intent === "chat" && !messages.some((message) => message.role === "user")) {
    return { ok: false, error: "Enter a question about this study." }
  }

  return { ok: true, data: { studyId, intent, page: readPage(body.page), messages } }
}

function readMessages(body: Record<string, unknown>): AiChatMessage[] {
  const messages: AiChatMessage[] = []
  if (Array.isArray(body.messages)) {
    for (const item of body.messages) {
      const row = record(item)
      if (!row || (row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") continue
      const content = row.content.trim().slice(0, MESSAGE_LIMIT)
      if (content) messages.push({ role: row.role, content })
    }
  }
  if (typeof body.message === "string" && body.message.trim()) {
    const content = body.message.trim().slice(0, MESSAGE_LIMIT)
    const last = messages.at(-1)
    if (!last || last.role !== "user" || last.content !== content) messages.push({ role: "user", content })
  }
  return messages.slice(-10)
}

function readPage(value: unknown): AiPageContext {
  const page = record(value)
  return {
    workflowStep: clip(page?.workflowStep, 80),
    currentPage: clip(page?.currentPage, 160),
    currentEndpoint: page?.currentEndpoint == null ? null : clip(page.currentEndpoint, 80) || null,
    focusLabel: page?.focusLabel == null ? null : clip(page.focusLabel, 120) || null,
  }
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}
