import { Sparkles } from "lucide-react"
import { ResearchAnswer } from "@/components/ai/research-answer"
import type { AiChatMessage } from "@/lib/ai/types"

export function AIMessage({ message }: { message: AiChatMessage }) {
  if (message.role === "user") {
    return (
      <li className="ai-turn" data-role="user">
        <div>{message.content}</div>
      </li>
    )
  }

  return (
    <li className="ai-turn" data-role="assistant">
      <div className="ai-ident">
        <span aria-hidden><Sparkles size={13} strokeWidth={1.85} /></span>
        <strong>NANO-HEPATOTEA AI</strong>
      </div>
      <ResearchAnswer text={message.content} />
    </li>
  )
}
