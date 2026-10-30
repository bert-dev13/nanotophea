import Together from "together-ai"
import { TOGETHER_MODEL } from "@/lib/ai/types"
import { RESEARCH_ASSISTANT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt"
import { INTERPRETATION_SYSTEM_PROMPT } from "@/lib/ai/interpretation-prompt"
import type { AiChatMessage, AiInterpretationDraft } from "@/lib/ai/types"

function client(): Together {
  const apiKey = process.env.TOGETHER_API_KEY
  if (!apiKey) throw new Error("Together API key is not configured.")
  return new Together({ apiKey })
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content.trim()
  if (!Array.isArray(content)) return ""
  return content.map((part) => {
    if (typeof part === "string") return part
    if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
      return (part as { text: string }).text
    }
    return ""
  }).join("").trim()
}

function completionText(completion: { choices?: Array<{ message?: { content?: unknown; reasoning?: string | null; reasoning_content?: string | null } }> }): string {
  const message = completion.choices?.[0]?.message
  return messageText(message?.content) || messageText(message?.reasoning) || messageText(message?.reasoning_content)
}

export async function completeResearchChat(input: {
  context: string
  messages: AiChatMessage[]
  intent: "chat" | "draft"
  guidance?: string
}): Promise<string> {
  const draftInstruction = "Draft four interpretation fields from the study context only. Return JSON with keys overall, relationship, limitations, and conclusion. Do not include numbers that are absent from the study context. Identify computational results as simulation and missing laboratory work as unavailable. Do not claim validation or efficacy."
  const completion = await client().chat.completions.create({
    model: TOGETHER_MODEL,
    temperature: input.intent === "draft" ? 0.2 : 0.3,
    max_tokens: input.intent === "draft" ? 900 : 1200,
    messages: [
      { role: "system", content: RESEARCH_ASSISTANT_SYSTEM_PROMPT },
      ...(input.context
        ? [{ role: "system" as const, content: `STUDY_CONTEXT:\n${input.context}\nUse STUDY_CONTEXT only when the question concerns this study. Do not recite evidence the question does not need.` }]
        : []),
      { role: "system", content: input.intent === "draft" ? draftInstruction : (input.guidance || "Answer the researcher's latest question naturally.") },
      ...input.messages.map((message) => ({ role: message.role, content: message.content })),
    ],
  })
  return completionText(completion)
}

export async function completeStructuredInterpretation(context: string): Promise<string> {
  const messages = [
    { role: "system" as const, content: INTERPRETATION_SYSTEM_PROMPT },
    { role: "system" as const, content: `STUDY_CONTEXT:\n${context}` },
    { role: "user" as const, content: "Return the Research AI Interpretation JSON for this study. Use null only for an endpoint finding that has no usable evidence. Do not invent missing results or citations." },
  ]
  const first = await requestInterpretation(messages, true).then(completionText).catch(() => "")
  if (first) return first
  return completionText(await requestInterpretation(messages, false))
}

async function requestInterpretation(
  messages: Array<{ role: "system" | "user"; content: string }>,
  jsonObject: boolean,
) {
  return client().chat.completions.create({
    model: TOGETHER_MODEL,
    temperature: 0.2,
    max_tokens: 4000,
    reasoning_effort: "low",
    ...(jsonObject ? { response_format: { type: "json_object" as const } } : {}),
    messages,
  })
}

export function parseInterpretationDraft(text: string): AiInterpretationDraft | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const value = JSON.parse(match[0]) as Partial<AiInterpretationDraft>
    const draft = {
      overall: typeof value.overall === "string" ? value.overall.trim() : "",
      relationship: typeof value.relationship === "string" ? value.relationship.trim() : "",
      limitations: typeof value.limitations === "string" ? value.limitations.trim() : "",
      conclusion: typeof value.conclusion === "string" ? value.conclusion.trim() : "",
    }
    return Object.values(draft).some(Boolean) ? draft : null
  } catch {
    return null
  }
}
