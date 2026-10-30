import { createHash } from "node:crypto"
import type { RowDataPacket } from "mysql2"
import { execute, query } from "@/lib/db/mysql"
import type { PubMedPaper } from "@/lib/scientific/pubmed"

export interface LiteratureCacheRecord {
  query: string
  endpoint?: string
  compound?: string
  retrievedAt: string
  source: "PubMed"
  pmids: string[]
  dois: string[]
  papers: PubMedPaper[]
}

/** Best-effort literature cache. Failures must not block a PubMed response. */
export async function rememberLiterature(record: LiteratureCacheRecord): Promise<void> {
  if (!record.papers || record.papers.length === 0) return
  try {
    const id = createHash("sha256").update(record.query).digest("hex").slice(0, 32)
    await execute(
      `INSERT INTO literature_cache (id, \`query\`, endpoint, compound, retrieved_at, source, pmids, dois, papers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         retrieved_at = VALUES(retrieved_at),
         papers = VALUES(papers),
         pmids = VALUES(pmids),
         dois = VALUES(dois)`,
      [
        id,
        record.query,
        record.endpoint ?? null,
        record.compound ?? null,
        record.retrievedAt,
        record.source,
        JSON.stringify(record.pmids ?? []),
        JSON.stringify(record.dois ?? []),
        JSON.stringify(record.papers ?? []),
      ]
    )
  } catch (error) {
    console.warn("[literatureCache] cache write skipped", error instanceof Error ? error.message : error)
  }
}

/** Looks up valid cached literature for an endpoint + compound pair. */
export async function getCachedLiterature(endpoint: string, compound: string): Promise<PubMedPaper | null> {
  try {
    const normalized = endpoint === "hippo-yap" ? "hippo_yap" : endpoint
    const rows = await query<RowDataPacket>(
      `SELECT papers, retrieved_at FROM literature_cache
       WHERE (endpoint = ? OR endpoint = ?) AND LOWER(compound) = LOWER(?)
       ORDER BY retrieved_at DESC LIMIT 1`,
      [endpoint, normalized, compound]
    )
    if (!rows.length) return null
    const row = rows[0] as { papers?: string | PubMedPaper[] }
    let papers: PubMedPaper[] = []
    if (typeof row.papers === "string") {
      try {
        papers = JSON.parse(row.papers)
      } catch {
        papers = []
      }
    } else if (Array.isArray(row.papers)) {
      papers = row.papers
    }
    if (papers.length > 0 && papers[0]?.pmid && papers[0]?.title) {
      return papers[0]
    }
    return null
  } catch (error) {
    console.warn("[literatureCache] cache lookup failed", error)
    return null
  }
}

