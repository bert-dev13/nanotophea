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
import { useAuth } from "@/components/providers/AuthProvider"
import { useStudy } from "@/components/providers/StudyProvider"
import { toUserFacingError } from "@/lib/errors/userFacing"
import { loadStudyReadiness } from "@/lib/workflow/loadStudyReadiness"
import type { StudyReadiness } from "@/lib/workflow/studyFlow"

interface WorkflowStatusValue {
  readiness: StudyReadiness | null
  error: string | null
  refresh: (options?: { force?: boolean }) => Promise<StudyReadiness | null>
}

const WorkflowStatusContext = createContext<WorkflowStatusValue | null>(null)

export function WorkflowStatusProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  const { activeStudy, loading: studyLoading } = useStudy()
  const studyId = activeStudy?.id ?? null
  const studyStamp = `${activeStudy?.updatedAt ?? ""}|${activeStudy?.analysisFinalizedAt ?? ""}|${activeStudy?.status ?? ""}`
  const studyIdRef = useRef(studyId)
  studyIdRef.current = studyId
  const [readiness, setReadiness] = useState<StudyReadiness | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inFlightRef = useRef<Promise<StudyReadiness | null> | null>(null)
  const pendingRerunRef = useRef(false)
  const lastFetchedRef = useRef<{ studyId: string; time: number; readiness: StudyReadiness } | null>(null)

  const refresh = useCallback(
    async (options?: { force?: boolean }): Promise<StudyReadiness | null> => {
      if (authLoading || studyLoading) return null
      if (!user) {
        setReadiness(null)
        setError(null)
        return null
      }
      const requested = studyIdRef.current
      if (!requested) {
        setReadiness(null)
        setError(null)
        return null
      }

      const now = Date.now()
      if (
        !options?.force &&
        lastFetchedRef.current?.studyId === requested &&
        now - lastFetchedRef.current.time < 1200
      ) {
        return lastFetchedRef.current.readiness
      }

      if (inFlightRef.current) {
        pendingRerunRef.current = true
        return inFlightRef.current
      }

      const run = async (): Promise<StudyReadiness | null> => {
        try {
          const next = await loadStudyReadiness(requested)
          if (studyIdRef.current === requested) {
            setReadiness(next)
            setError(null)
            lastFetchedRef.current = { studyId: requested, time: Date.now(), readiness: next }
          }
          return next
        } catch (e) {
          if (studyIdRef.current === requested) {
            setError(toUserFacingError(e, "Could not check required records."))
          }
          return null
        } finally {
          inFlightRef.current = null
          if (pendingRerunRef.current && studyIdRef.current === requested) {
            pendingRerunRef.current = false
            void refresh({ force: true })
          } else {
            pendingRerunRef.current = false
          }
        }
      }

      const promise = run()
      inFlightRef.current = promise
      return promise
    },
    [authLoading, studyLoading, user]
  )

  useEffect(() => {
    setReadiness(null)
    setError(null)
  }, [studyId])

  useEffect(() => {
    if (!authLoading && !studyLoading && user && studyId) {
      void refresh()
    }
  }, [refresh, studyId, authLoading, studyLoading, user, studyStamp])

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
