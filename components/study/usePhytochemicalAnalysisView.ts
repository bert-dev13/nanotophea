"use client"

import { useEffect, useState } from "react"
import {
  readPhytochemicalAnalysisViewMode,
  writePhytochemicalAnalysisViewMode,
  type PhytochemicalAnalysisViewMode,
} from "@/lib/phytochemicals/analysisView"

export function usePhytochemicalAnalysisView(studyId: string | null | undefined) {
  const [mode, setMode] = useState<PhytochemicalAnalysisViewMode>("individual")

  useEffect(() => {
    setMode(readPhytochemicalAnalysisViewMode(studyId))
  }, [studyId])

  function setViewMode(next: PhytochemicalAnalysisViewMode) {
    setMode(next)
    writePhytochemicalAnalysisViewMode(studyId, next)
  }

  return { viewMode: mode, setViewMode }
}
