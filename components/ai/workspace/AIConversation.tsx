import { AILoadingState } from "@/components/ai/workspace/AILoadingState"
import { AIMessage } from "@/components/ai/workspace/AIMessage"
import type { AiChatMessage } from "@/lib/ai/types"

export function AIConversation({
  messages,
  pending,
}: {
  messages: AiChatMessage[]
  pending: boolean
}) {
  return (
    <ol className="ai-messages">
      {messages.map((message, index) => (
        <AIMessage key={`${message.role}-${index}`} message={message} />
      ))}
      {pending ? (
        <li className="ai-turn" data-role="assistant">
          <AILoadingState />
        </li>
      ) : null}
    </ol>
  )
}
