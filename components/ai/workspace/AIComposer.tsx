"use client"

import { ArrowUp, Loader2 } from "lucide-react"

export function AIComposer({
  draft,
  pending,
  placeholder,
  onDraft,
  onSubmit,
}: {
  draft: string
  pending: boolean
  placeholder: string
  onDraft: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <form
      className="ai-composer"
      onSubmit={(event) => {
        event.preventDefault()
        if (!pending) onSubmit()
      }}
    >
      <div className="ai-composer-box">
        <div className="ai-composer-field">
          <textarea
            value={draft}
            rows={1}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                if (!pending) onSubmit()
              }
            }}
          />
          <button type="submit" aria-label={pending ? "Generating response" : "Send"} disabled={pending || !draft.trim()} aria-busy={pending || undefined}>
            {pending ? <Loader2 size={16} className="ai-spin" aria-hidden /> : <ArrowUp size={16} aria-hidden />}
          </button>
        </div>
      </div>
    </form>
  )
}
