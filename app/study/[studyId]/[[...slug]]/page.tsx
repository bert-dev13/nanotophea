"use client"

import { useParams } from "next/navigation"
import { StudyWorkspace } from "@/components/study/StudyWorkspace"

export default function StudyPage() {
  const params = useParams()
  const studyId = String(params.studyId || "")
  const raw = params.slug
  const slug = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : []
  return <StudyWorkspace studyId={studyId} slug={slug} />
}
