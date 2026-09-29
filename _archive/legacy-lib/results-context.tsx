"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { SavedResult } from "@/components/panels/AssayLabSection"

interface ResultsContextValue {
  results: SavedResult[]
  saveResult: (r: SavedResult) => void
  deleteResult: (id: string) => void
  clearResults: () => void
}

const ResultsContext = createContext<ResultsContextValue | null>(null)

export function ResultsProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<SavedResult[]>([])

  const saveResult = useCallback((r: SavedResult) => {
    setResults((prev) => [r, ...prev])
  }, [])

  const deleteResult = useCallback((id: string) => {
    setResults((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const clearResults = useCallback(() => setResults([]), [])

  return (
    <ResultsContext.Provider value={{ results, saveResult, deleteResult, clearResults }}>
      {children}
    </ResultsContext.Provider>
  )
}

export function useResults() {
  const ctx = useContext(ResultsContext)
  if (!ctx) throw new Error("useResults must be used within ResultsProvider")
  return ctx
}
