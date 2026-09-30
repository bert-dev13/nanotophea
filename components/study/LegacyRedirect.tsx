"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStudy } from "@/components/providers/StudyProvider"
import { studyPath, type StepId } from "@/lib/workflow/studyFlow"

/** Sends a bookmarked module URL into the open study workspace. */
export function LegacyRedirect({ step, tab }: { step: StepId; tab?: string }) {
  const router = useRouter()
  const { activeStudy, loading } = useStudy()

  useEffect(() => {
    if (loading) return
    if (!activeStudy) {
      router.replace("/")
      return
    }
    router.replace(studyPath(activeStudy.id, step, tab))
  }, [activeStudy, loading, router, step, tab])

  return (
    <p className="py-10 text-sm text-[var(--muted-foreground)]">
      {loading ? "Opening your study…" : activeStudy ? "Opening the study workspace…" : "Returning to Studies…"}
    </p>
  )
}
