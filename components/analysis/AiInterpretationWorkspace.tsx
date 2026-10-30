"use client"

import { useEffect, useRef, useState } from "react"
import { useResearchAssistant } from "@/components/ai/research-assistant"
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import type { StructuredInterpretation } from "@/lib/ai/interpretation-schema"

const LOADING = [
  "Analyzing study evidence...",
  "Reading computational predictions",
  "Reviewing molecular docking results",
  "Analyzing laboratory evidence",
  "Comparing evidence",
  "Generating interpretation",
]

export function useIntegratedInterpretation(
  evidenceKey: string,
  onReady: (value: { id: string; overall: string; relationship: string; limitations: string; conclusion: string }) => void,
) {
  const { user } = useAuth()
  const { activeStudy } = useStudy()
  const assistant = useResearchAssistant()
  const requestRef = useRef(assistant.requestInterpretation)
  const readyRef = useRef(onReady)
  requestRef.current = assistant.requestInterpretation
  readyRef.current = onReady
  const [phase, setPhase] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
  const [attempt, setAttempt] = useState(0)
  const [interpretation, setInterpretation] = useState<StructuredInterpretation | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    if (status !== "loading") return
    const timer = window.setInterval(() => setPhase((current) => (current + 1) % LOADING.length), 1700)
    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => {
    if (!activeStudy?.id || !user) return
    let cancel = false
    busyRef.current = true
    setStatus("loading")
    setPhase(0)
    void (async () => {
      try {
        const result = await requestRef.current()
        if (cancel) return
        setInterpretation(result.interpretation)
        setStatus("ready")
        readyRef.current({
          id: result.interpretationId,
          overall: result.interpretation.overallInterpretation,
          relationship: result.interpretation.computationalVsExperimental,
          limitations: result.interpretation.limitations,
          conclusion: result.interpretation.conclusion,
        })
      } catch {
        if (!cancel) setStatus("failed")
      } finally {
        if (!cancel) busyRef.current = false
      }
    })()
    return () => {
      cancel = true
    }
  }, [activeStudy?.id, user, evidenceKey, attempt])

  return {
    status,
    phaseLabel: LOADING[phase],
    interpretation,
    regenerate: () => {
      if (busyRef.current) return
      busyRef.current = true
      setAttempt((current) => current + 1)
    },
  }
}
