"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  // Prefer safe repair path for the study document owner (handles missing
  // membership and older rules that denied reads of absent member docs).
  if (study.ownerId === profileId) {
    return ensureOwnerMembership(study, {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      photoURL: null,
      createdAt: "",
      updatedAt: "",
      defaultRole: "OWNER",
    })
  }

  try {
    return await getStudyMember(study.id, profileId)
  } catch {
    return null
  }
}

export function StudyProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [studies, setStudies] = useState<Study[]>([])
  const [activeStudy, setActiveStudy] = useState<Study | null>(null)
  const [membership, setMembership] = useState<StudyMember | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshStudies = useCallback(async () => {
    if (!user || !profile) {
      setStudies([])
      setActiveStudy(null)
      setMembership(null)
      clearActiveStudyStorage()
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await listStudiesForUser(user.uid)

      // Repair OWNER membership for studies this admin owns before selecting
      for (const s of list) {
        if (s.ownerId === profile.id) {
          await ensureOwnerMembership(s, profile)
        }
      }

      const refreshed = await listStudiesForUser(user.uid)
      setStudies(refreshed)

      const savedId =
        typeof window !== "undefined" ? localStorage.getItem(ACTIVE_STUDY_KEY) : null
      const preferred =
        (savedId && refreshed.find((s) => s.id === savedId)) || refreshed[0] || null
      setActiveStudy(preferred)
      if (preferred) {
        localStorage.setItem(ACTIVE_STUDY_KEY, preferred.id)
        setMembership(await resolveMembership(preferred, profile.id, profile))
      } else {
        clearActiveStudyStorage()
        setMembership(null)
      }
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load studies"))
    } finally {
      setLoading(false)
    }
  }, [user, profile])

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
        await refreshStudies()
      } catch (e) {
        const msg = toUserFacingError(e, "Failed to update study")
        setError(msg)
        throw new Error(msg)
      }
    },
    [user, activeStudy, refreshStudies]
  )

  const value = useMemo(
    () => ({
      studies,
      activeStudy,
      membership,
      loading,
      error,
      refreshStudies,
      selectStudy,
      createNewStudy,
      updateActiveStudy,
    }),
    [
      studies,
      activeStudy,
      membership,
      loading,
      error,
      refreshStudies,
      selectStudy,
      createNewStudy,
      updateActiveStudy,
    ]
  )

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudy() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error("useStudy must be used within StudyProvider")
  return ctx
}
