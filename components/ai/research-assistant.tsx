"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { AI_UNAVAILABLE, type AiInterpretationDraft, type AiPageContext, type InterpretationEvidenceSummary } from "@/lib/ai/types"
import type { StructuredInterpretation } from "@/lib/ai/interpretation-schema"
import { getStep, stepIdFromPathname } from "@/lib/workflow/studyFlow"

interface AssistantContextValue {
  draftInterpretation: () => Promise<AiInterpretationDraft | null>
  requestInterpretation: () => Promise<{
    interpretation: StructuredInterpretation
    evidenceUsed: InterpretationEvidenceSummary
    generatedAt: string
    evidenceVersion: string
    interpretationId: string
  }>
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

export function useResearchAssistant(): AssistantContextValue {
  return useContext(AssistantContext) ?? {
    draftInterpretation: async () => null,
    requestInterpretation: async () => {
      throw new Error(AI_UNAVAILABLE)
    },
  }
}

function pageContext(pathname: string, studyId: string | undefined): AiPageContext {
  if (!studyId) return { workflowStep: "", currentPage: "Studies", currentEndpoint: null }
  const step = stepIdFromPathname(pathname, studyId)
  const meta = step ? getStep(step) : null
  return {
    workflowStep: step ?? "",
    currentPage: meta ? `${meta.number} · ${meta.label}` : "Study",
    currentEndpoint: null,
  }
}

async function postAssistant(body: unknown, token?: string): Promise<{
  draft?: AiInterpretationDraft | null
  interpretation?: StructuredInterpretation
  evidenceUsed?: InterpretationEvidenceSummary
  generatedAt?: string
  evidenceVersion?: string
  interpretationId?: string
  error?: string
}> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as {
    draft?: AiInterpretationDraft | null
    interpretation?: StructuredInterpretation
    evidenceUsed?: InterpretationEvidenceSummary
    generatedAt?: string
    evidenceVersion?: string
    interpretationId?: string
    error?: string
  }
  if (!response.ok) throw new Error(payload.error || AI_UNAVAILABLE)
  return payload
}

export function ResearchAssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const { activeStudy } = useStudy()
  const page = pageContext(pathname, activeStudy?.id)

  const value = useMemo<AssistantContextValue>(() => ({
    draftInterpretation: async () => {
      if (!user || !activeStudy) return null
      const payload = await postAssistant({
        studyId: activeStudy.id,
        intent: "draft",
        page,
        messages: [],
      })
      if (!payload.draft) throw new Error("The draft could not be prepared from the recorded evidence. Nothing was saved.")
      return payload.draft
    },
    requestInterpretation: async () => {
      if (!user || !activeStudy) throw new Error("Sign in to use the research assistant.")
      const payload = await postAssistant({
        studyId: activeStudy.id,
        intent: "interpret",
        page,
        messages: [],
      })
      if (!payload.interpretation || !payload.evidenceUsed || !payload.generatedAt || !payload.evidenceVersion || !payload.interpretationId) {
        throw new Error(AI_UNAVAILABLE)
      }
      return {
        interpretation: payload.interpretation,
        evidenceUsed: payload.evidenceUsed,
        generatedAt: payload.generatedAt,
        evidenceVersion: payload.evidenceVersion,
        interpretationId: payload.interpretationId,
      }
    },
  }), [user, activeStudy, page])

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}
