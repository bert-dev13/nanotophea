"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AIComposer } from "@/components/ai/workspace/AIComposer"
import { AIConversation } from "@/components/ai/workspace/AIConversation"
import { AIEmptyState } from "@/components/ai/workspace/AIEmptyState"
import { AIWorkspaceHeader } from "@/components/ai/workspace/AIWorkspaceHeader"
import { ExploreScope } from "@/components/ai/workspace/ExploreScope"
import { ScopeSuggestions } from "@/components/ai/workspace/ScopeSuggestions"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { useWorkflowStatus } from "@/components/study/WorkflowStatus"
import { loadAssistantCatalog } from "@/lib/ai/assistant-catalog"
import {
  askingAbout,
  detailAvailable,
  EMPTY_CATALOG,
  exploreSuggestions,
  pageForExplore,
  selectionFromFocus,
  type AssistantCatalog,
  type ExploreStage,
} from "@/lib/ai/explore"
import { assistantFocusId } from "@/lib/ai/focus"
import { AI_UNAVAILABLE, type AiChatMessage } from "@/lib/ai/types"
import { listCellLines, listCompounds } from "@/lib/repositories/researchDataRepository"
import { stepRecordStatus, WORKFLOW_STEPS } from "@/lib/workflow/studyFlow"

export function AssistantStudyPage() {
  const search = useSearchParams()
  const { user } = useAuth()
  const { activeStudy } = useStudy()
  const { readiness } = useWorkflowStatus()
  const contextParam = search.get("context")
  const initial = selectionFromFocus(assistantFocusId(contextParam))
  const [stage, setStage] = useState<ExploreStage>(initial.stage)
  const [detail, setDetail] = useState<string | null>(initial.detail)
  const [catalog, setCatalog] = useState<AssistantCatalog>(EMPTY_CATALOG)
  const [catalogReady, setCatalogReady] = useState(false)
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQuestion, setLastQuestion] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)
  const studyId = activeStudy?.id ?? null
  const previousStudy = useRef(studyId)
  const [names, setNames] = useState<{ compound: string; cellLine: string }>({ compound: "", cellLine: "" })

  useEffect(() => {
    const next = selectionFromFocus(assistantFocusId(contextParam))
    setStage(next.stage)
    setDetail(next.detail)
  }, [contextParam])

  useEffect(() => {
    if (previousStudy.current === studyId) return
    previousStudy.current = studyId
    requestId.current += 1
    setMessages([])
    setDraft("")
    setError(null)
    setLastQuestion(null)
    setPending(false)
    setNames({ compound: "", cellLine: "" })
    setCatalog(EMPTY_CATALOG)
    setCatalogReady(false)
    const next = selectionFromFocus(assistantFocusId(contextParam))
    setStage(next.stage)
    setDetail(next.detail)
  }, [studyId, contextParam])

  useEffect(() => {
    if (!activeStudy) return
    let cancel = false
    void (async () => {
      try {
        const [compounds, cellLines, nextCatalog] = await Promise.all([
          listCompounds(activeStudy.id),
          listCellLines(activeStudy.id),
          loadAssistantCatalog(activeStudy.id),
        ])
        if (cancel) return
        setNames({
          compound: compounds.map((row) => row.name).find(Boolean) || "",
          cellLine: cellLines.map((row) => row.name).find(Boolean) || "",
        })
        setCatalog(nextCatalog)
        setCatalogReady(true)
      } catch {
        if (!cancel) {
          setNames({ compound: "", cellLine: "" })
          setCatalog(EMPTY_CATALOG)
          setCatalogReady(true)
        }
      }
    })()
    return () => {
      cancel = true
    }
  }, [activeStudy])

  useEffect(() => {
    if (!catalogReady) return
    if (stage !== "entire" && !catalog.stages.includes(stage)) {
      setStage("entire")
      setDetail(null)
      return
    }
    if (detail && !detailAvailable(catalog, stage, detail)) setDetail(null)
  }, [catalog, catalogReady, stage, detail])

  useEffect(() => {
    if (messages.length === 0 && !pending && !error) return
    const node = logRef.current
    if (!node) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    node.scrollTo({ top: node.scrollHeight, behavior: reduce ? "auto" : "smooth" })
  }, [messages, pending, error])

  async function ask(question: string, retry = false) {
    const content = question.trim()
    if (!content || pending || !activeStudy) {
      if (!user || !activeStudy) setError("Open a study to ask about its recorded evidence.")
      return
    }
    const requestedStudy = activeStudy.id
    const request = requestId.current + 1
    requestId.current = request
    const alreadyAsked = retry && messages.some((message) => message.role === "user" && message.content === content)
    const history = (alreadyAsked ? messages : [...messages, { role: "user" as const, content }]).slice(-8)
    setMessages(history)
    setDraft("")
    setLastQuestion(content)
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          studyId: requestedStudy,
          intent: "chat",
          page: pageForExplore(stage, detail),
          messages: history,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { message?: string; error?: string }
      if (requestId.current !== request) return
      if (!response.ok) throw new Error(payload.error || AI_UNAVAILABLE)
      setMessages((current) => [...current, { role: "assistant" as const, content: payload.message || AI_UNAVAILABLE }].slice(-8))
    } catch (caught) {
      if (requestId.current !== request) return
      setError(caught instanceof Error ? caught.message : AI_UNAVAILABLE)
    } finally {
      if (requestId.current === request) setPending(false)
    }
  }

  const completed = readiness
    ? WORKFLOW_STEPS.filter((step) => stepRecordStatus(step.id, readiness) === "complete").length
    : null
  const statusLabel = completed == null ? "" : completed === WORKFLOW_STEPS.length ? "Study Complete" : `${completed}/6 stages`
  const contextLine = [activeStudy?.title, names.compound, names.cellLine, statusLabel].filter(Boolean).join("  •  ")
  const chatting = messages.length > 0 || pending || Boolean(error)
  const unavailable = error === AI_UNAVAILABLE
  const scopeLabel = askingAbout(stage, detail)
  const suggestions = exploreSuggestions({ stage, detail, catalog })

  return (
    <div className="ai-desk">
      <AIWorkspaceHeader
        title="HEPATOTEA AI"
        contextLine={contextLine}
        connected={Boolean(activeStudy)}
      />

      <section className="ai-stage" aria-label="Research assistant">
        <div className={`ai-log${chatting ? " ai-log--chat" : ""}`} ref={logRef}>
          <div className="ai-thread">
            {chatting ? (
              <AIConversation messages={messages} pending={pending} />
            ) : (
              <AIEmptyState />
            )}
            {error ? (
              <div className="ai-error" role="alert">
                <p>{unavailable ? "AI Assistant unavailable" : "Request not completed"}</p>
                <p>
                  {unavailable
                    ? "The assistant could not complete this request. Your study data has not been affected."
                    : error}
                </p>
                {lastQuestion ? (
                  <button type="button" onClick={() => void ask(lastQuestion, true)}>Try Again</button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="ai-dock">
          <ExploreScope
            catalog={catalog}
            stage={stage}
            detail={detail}
            disabled={pending}
            onStage={(next) => {
              setStage(next)
              setDetail(null)
            }}
            onDetail={setDetail}
            onClear={() => {
              setStage("entire")
              setDetail(null)
            }}
          />
          {chatting ? null : (
            <ScopeSuggestions prompts={suggestions} disabled={pending || !activeStudy} onAsk={(question) => void ask(question)} />
          )}
          <AIComposer
            draft={draft}
            pending={pending}
            placeholder={`Ask HEPATOTEA about ${scopeLabel}...`}
            onDraft={setDraft}
            onSubmit={() => void ask(draft)}
          />
        </div>
      </section>
    </div>
  )
}
