import { NextResponse } from "next/server"
import { candidateQueries, selectSupportingPaper } from "@/lib/predictions/literature"
import type { PredictionEndpoint } from "@/lib/domain/models"
import { cached } from "@/lib/scientific/cache"
import { getCachedLiterature, rememberLiterature } from "@/lib/scientific/literatureCache"
import { addPubMedAbstracts, searchPubMed, type PubMedPaper } from "@/lib/scientific/pubmed"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestedTerm = url.searchParams.get("term")?.trim() ?? ""
  const compound = url.searchParams.get("compound")?.trim() ?? ""
  const rawEndpoint = url.searchParams.get("endpoint")?.trim() ?? ""
  const endpoint = rawEndpoint === "hippo-yap" ? "hippo_yap" : rawEndpoint
  const cellLine = url.searchParams.get("cellLine")?.trim() ?? undefined

  if (!isEndpoint(endpoint) || !compound) {
    return NextResponse.json({ error: "A compound and endpoint are required." }, { status: 400 })
  }

  // 1. Check persistent MySQL database literature cache first (Requirement 13)
  try {
    const cachedPaper = await getCachedLiterature(endpoint, compound)
    if (cachedPaper) {
      return NextResponse.json({
        term: requestedTerm || `cached:${endpoint}:${compound}`,
        retrievedAt: new Date().toISOString(),
        source: "PubMed",
        sourceName: "National Library of Medicine",
        paper: cachedPaper,
        papers: [cachedPaper],
        cached: true,
      })
    }
  } catch {
    // If cache lookup encounters an error, proceed to live query
  }

  // 2. Candidate queries for compound + endpoint/context with fallbacks (Requirement 5 & 7)
  const queries = candidateQueries(endpoint, compound, cellLine)
  if (requestedTerm && !queries.includes(requestedTerm)) {
    queries.unshift(requestedTerm)
  }

  try {
    let winningPaper: PubMedPaper | null = null
    let successfulQuery = queries[0] ?? requestedTerm

    for (const query of queries) {
      if (!query || query.length < 3) continue
      try {
        const summaries = await cached(
          `pubmed:supporting:v4:${query.toLowerCase()}`,
          () => searchPubMed(query, "relevance"),
          6 * 60 * 60 * 1000,
        )
        if (!summaries || summaries.length === 0) continue
        const withAbstracts = await addPubMedAbstracts(summaries).catch(() => summaries)
        const paper = selectSupportingPaper(withAbstracts, { compound, endpoint })
        if (paper) {
          winningPaper = paper
          successfulQuery = query
          break
        }
      } catch {
        // Fall back to next candidate query if one encounters a network issue
      }
    }

    const selected: PubMedPaper[] = winningPaper ? [winningPaper] : []
    const retrievedAt = new Date().toISOString()

    if (winningPaper) {
      void rememberLiterature({
        query: successfulQuery,
        endpoint,
        compound,
        retrievedAt,
        source: "PubMed",
        pmids: [winningPaper.pmid],
        dois: winningPaper.doi ? [winningPaper.doi] : [],
        papers: [winningPaper],
      }).catch(() => undefined)
    }

    return NextResponse.json({
      term: successfulQuery,
      retrievedAt,
      source: "PubMed",
      sourceName: "National Library of Medicine",
      paper: winningPaper,
      papers: selected,
    })
  } catch {
    // Requirement 10: "PubMed failure must NOT change a completed prediction to failed. Show: Supporting literature temporarily unavailable — Retry"
    return NextResponse.json({ error: "Supporting literature temporarily unavailable — Retry" }, { status: 503 })
  }
}

function isEndpoint(value: string): value is PredictionEndpoint {
  return value === "dpph" || value === "mtt" || value === "ldh" || value === "ros" || value === "bax" || value === "hippo_yap"
}
