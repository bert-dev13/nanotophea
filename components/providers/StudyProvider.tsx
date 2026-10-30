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
import type { Study, StudyMember } from "@/lib/domain/models"
import { useAuth } from "@/components/providers/AuthProvider"
import {
  createStudy,
  ensureOwnerMembership,
  getStudyMember,
  listStudiesForUser,
  updateStudy,
} from "@/lib/repositories/studyRepository"
import type { CreateStudyInput, UpdateStudyInput } from "@/lib/domain/models"
import { toUserFacingError } from "@/lib/errors/userFacing"

const ACTIVE_STUDY_KEY = "nanotophea.activeStudyId"

interface StudyContextValue {
  studies: Study[]
  activeStudy: Study | null
  membership: StudyMember | null
  loading: boolean
  error: string | null
  refreshStudies: () => Promise<void>
  selectStudy: (studyId: string) => Promise<void>
  createNewStudy: (input: CreateStudyInput) => Promise<Study>
  updateActiveStudy: (input: UpdateStudyInput) => Promise<void>
  deleteStudyById: (studyId: string) => Promise<void>
}

const StudyContext = createContext<StudyContextValue | null>(null)

function clearActiveStudyStorage() {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(ACTIVE_STUDY_KEY)
  } catch {
    /* ignore */
  }
}

async function resolveMembership(
  study: Study,
  profileId: string,
  profile: { id: string; email: string; displayName: string }
): Promise<StudyMember | null> {
  try {
    const existing = await getStudyMember(study.id, profileId)
    if (existing) return existing
  } catch {
    /* proceed to owner fallback */
  }

  if (study.ownerId === profileId) {
    try {
      return await ensureOwnerMembership(study, {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        photoURL: null,
        createdAt: "",
        updatedAt: "",
        defaultRole: "OWNER",
        role: "OWNER",
        isActive: true,
      })
    } catch {
      return null
    }
  }

  return null
}

export function StudyProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth()
  const [studies, setStudies] = useState<Study[]>([])
  const [activeStudy, setActiveStudy] = useState<Study | null>(null)
  const [membership, setMembership] = useState<StudyMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialLoadedRef = useRef(false)
  const activeStudyIdRef = useRef<string | null>(null)
  activeStudyIdRef.current = activeStudy?.id ?? null

  const refreshStudies = useCallback(async () => {
    if (authLoading) return
    if (!user || !profile) {
      setStudies([])
      setActiveStudy(null)
      setMembership(null)
      clearActiveStudyStorage()
      setLoading(false)
      return
    }
    if (!initialLoadedRef.current) {
      setLoading(true)
    }
    setError(null)
    try {
      const refreshed = await listStudiesForUser(user.uid)
      setStudies(refreshed)
      initialLoadedRef.current = true

      const currentId = activeStudyIdRef.current
      const savedId =
        typeof window !== "undefined" ? localStorage.getItem(ACTIVE_STUDY_KEY) : null
      const targetId = currentId ?? savedId
      const preferred = targetId
        ? refreshed.find((s) => s.id === targetId) || null
        : !initialLoadedRef.current
        ? refreshed[0] || null
        : null
      setActiveStudy(preferred)
      if (preferred) {
        localStorage.setItem(ACTIVE_STUDY_KEY, preferred.id)
        setMembership(await resolveMembership(preferred, profile.id, profile))
        setError(null)
      } else {
        clearActiveStudyStorage()
        setMembership(null)
      }
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load studies"))
    } finally {
      setLoading(false)
    }
  }, [user, profile, authLoading])

  useEffect(() => {
    void refreshStudies()
  }, [refreshStudies])

  const selectStudy = useCallback(
    async (studyId: string) => {
      if (!user || !profile) return
      setError(null)
      try {
        const found = studies.find((s) => s.id === studyId) || null
        setActiveStudy(found)
        if (found) {
          localStorage.setItem(ACTIVE_STUDY_KEY, found.id)
          setMembership(await resolveMembership(found, profile.id, profile))
        } else {
          setMembership(null)
        }
      } catch (e) {
        setError(toUserFacingError(e, "Failed to select study"))
      }
    },
    [studies, user, profile]
  )

  const createNewStudy = useCallback(
    async (input: CreateStudyInput) => {
      if (!profile) throw new Error("Not signed in")
      setError(null)
      try {
        const study = await createStudy(profile, input)
        await refreshStudies()
        localStorage.setItem(ACTIVE_STUDY_KEY, study.id)
        setActiveStudy(study)
        setMembership(await getStudyMember(study.id, profile.id))
        return study
      } catch (e) {
        const msg = toUserFacingError(e, "Failed to create study")
        setError(msg)
        throw new Error(msg)
      }
    },
    [profile, refreshStudies]
  )

  const updateActiveStudy = useCallback(
    async (input: UpdateStudyInput) => {
      if (!user || !activeStudy) throw new Error("No active study")
      setError(null)
      try {
        const updated = await updateStudy(activeStudy.id, user.uid, input)
        setActiveStudy(updated)
        setStudies((current) => current.map((s) => (s.id === updated.id ? updated : s)))
      } catch (e) {
        const msg = toUserFacingError(e, "Failed to update study")
        setError(msg)
        throw new Error(msg)
      }
    },
    [user, activeStudy]
  )

  const deleteStudyById = useCallback(
    async (studyId: string) => {
      if (!profile) throw new Error("Not signed in")
      setError(null)
      try {
        const res = await fetch(`/api/studies/${encodeURIComponent(studyId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || "Unable to delete this investigation. Please try again.")
        }

        // If the deleted study was active, clear active state immediately
        if (activeStudyIdRef.current === studyId || activeStudy?.id === studyId) {
          activeStudyIdRef.current = null
          setActiveStudy(null)
          setMembership(null)
          clearActiveStudyStorage()
        }

        setStudies((current) => current.filter((s) => s.id !== studyId))
      } catch (e) {
        const msg = toUserFacingError(e, "Unable to delete this investigation. Please try again.")
        setError(msg)
        throw new Error(msg)
      }
    },
    [profile, activeStudy]
  )

  const value = useMemo(
    () => ({
      studies,
      activeStudy,
      membership,
      loading: loading || authLoading,
      error,
      refreshStudies,
      selectStudy,
      createNewStudy,
      updateActiveStudy,
      deleteStudyById,
    }),
    [
      studies,
      activeStudy,
      membership,
      loading,
      authLoading,
      error,
      refreshStudies,
      selectStudy,
      createNewStudy,
      updateActiveStudy,
      deleteStudyById,
    ]
  )

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudy() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error("useStudy must be used within StudyProvider")
  return ctx
}
