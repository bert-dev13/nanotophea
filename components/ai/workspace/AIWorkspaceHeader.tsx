"use client"

import { Sparkles } from "lucide-react"

export function AIWorkspaceHeader({
  title,
  contextLine,
  connected,
}: {
  title: string
  contextLine: string
  connected: boolean
}) {
  return (
    <header className="ai-head">
      <div className="ai-head-brand">
        <span className="ai-head-mark" aria-hidden>
          <Sparkles size={16} strokeWidth={1.85} />
        </span>
        <div>
          <h1>{title}</h1>
          <p className="ai-role">Research Assistant</p>
          {contextLine ? <p className="ai-context-line">{contextLine}</p> : null}
        </div>
      </div>
      <span className="ai-live" data-on={connected ? "true" : "false"}>
        {connected ? "Study connected" : "No study open"}
      </span>
    </header>
  )
}
