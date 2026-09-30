"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import { useStudy } from "@/components/providers/StudyProvider"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { loadStudyReadiness } from "@/lib/workflow/loadStudyReadiness"
import type { StudyReadiness } from "@/lib/workflow/studyFlow"

interface WorkflowStatusValue {
  readiness: StudyReadiness | null
  error: string | null
  refresh: () => Promise<StudyReadiness | null>
}

const WorkflowStatusContext = createContext<WorkflowStatusValue | null>(null)

export function WorkflowStatusProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { activeStudy } = useStudy()
  const studyId = activeStudy?.id ?? null
  const studyIdRef = useRef(studyId)
  studyIdRef.current = studyId
  const [readiness, setReadiness] = useState<StudyReadiness | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const requested = studyIdRef.current
    if (!requested) {
      setReadiness(null)
      setError(null)
      return null
    }
    try {
      const next = await loadStudyReadiness(requested)
      if (studyIdRef.current !== requested) return null
      setReadiness(next)
      setError(null)
      return next
    } catch (e) {
      if (studyIdRef.current !== requested) return null
      setError(toUserFacingError(e, "Could not check required records."))
      return null
    }
  }, [])

  useEffect(() => {
    setReadiness(null)
    setError(null)
  }, [studyId])

  useEffect(() => {
    void refresh()
  }, [refresh, pathname])

  const value = useMemo(
    () => ({ readiness, error, refresh }),
    [readiness, error, refresh]
  )

  return (
    <WorkflowStatusContext.Provider value={value}>{children}</WorkflowStatusContext.Provider>
  )
}

export function useWorkflowStatus(): WorkflowStatusValue {
  const ctx = useContext(WorkflowStatusContext)
  if (!ctx) throw new Error("useWorkflowStatus must be used within WorkflowStatusProvider")
  return ctx
}
