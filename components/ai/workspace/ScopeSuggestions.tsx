"use client"

export function ScopeSuggestions({
  prompts,
  disabled,
  onAsk,
}: {
  prompts: string[]
  disabled: boolean
  onAsk: (question: string) => void
}) {
  if (prompts.length === 0) return null
  return (
    <div className="ai-suggest">
      {prompts.map((prompt) => (
        <button key={prompt} type="button" disabled={disabled} onClick={() => onAsk(prompt)}>
          {prompt}
        </button>
      ))}
    </div>
  )
}
