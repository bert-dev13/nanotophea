export interface PubMedPaper {
  title: string
  authors?: string
  year?: string
  journal?: string
  pmid: string
  doi?: string
  source: "PubMed"
  pubmedUrl: string
  doiUrl?: string
  pubTypes: string[]
  abstract?: string
  relevanceNote?: string
  sortDate?: string
}

interface SummaryAuthor {
  name?: string
}

interface SummaryArticleId {
  idtype?: string
  value?: string
}

interface SummaryRecord {
  uid?: string
  title?: string
  pubdate?: string
  sortpubdate?: string
  source?: string
  fulljournalname?: string
  authors?: SummaryAuthor[]
  articleids?: SummaryArticleId[]
  pubtype?: string | string[]
}

export function pubmedUrl(pmid: string): string | undefined {
  return /^\d+$/.test(pmid) ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined
}

export function doiUrl(doi: string): string | undefined {
  const value = doi.trim()
  if (!/^10\.\S+$/.test(value)) return undefined
  return `https://doi.org/${value}`
}

export function formatAuthors(names: string[]): string | undefined {
  const clean = names.map((name) => name.trim()).filter(Boolean)
  if (!clean.length) return undefined
  if (clean.length <= 3) return clean.join(", ")
  return `${clean.slice(0, 3).join(", ")}, et al.`
}

export function publicationLabel(pubTypes: string[]): string | undefined {
  if (pubTypes.some((type) => /review/i.test(type))) return "Review"
  if (pubTypes.some((type) => /journal article/i.test(type))) return "Research article"
  return undefined
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number.parseInt(num, 10)))
    .replace(/\s+/g, " ")
    .trim()
}

function asStrings(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
}

/** Reads an NCBI esummary JSON payload. Records without a title or PMID are skipped. */
export function parsePubMedSummary(payload: unknown): PubMedPaper[] {
  if (!payload || typeof payload !== "object") return []
  const result = (payload as { result?: unknown }).result
  if (!result || typeof result !== "object") return []
  const uids = (result as { uids?: unknown }).uids
  if (!Array.isArray(uids)) return []
  const papers: PubMedPaper[] = []
  for (const uid of uids) {
    if (typeof uid !== "string" || !pubmedUrl(uid)) continue
    const record = (result as Record<string, unknown>)[uid] as SummaryRecord | undefined
    if (!record) continue
    const title = record.title ? decodeXml(record.title) : ""
    if (!title) continue
    const authors = formatAuthors((record.authors ?? []).map((author) => author.name ?? ""))
    const doi = record.articleids?.find((item) => item.idtype === "doi" && item.value?.trim())?.value?.trim()
    const linkedDoi = doi ? doiUrl(doi) : undefined
    const year = record.pubdate?.match(/\d{4}/)?.[0]
    const journal = record.fulljournalname?.trim() || record.source?.trim()
    const sortDate = record.sortpubdate?.match(/\d{4}\/\d{2}\/\d{2}/)?.[0]
    papers.push({
      title,
      ...(authors ? { authors } : {}),
      ...(year ? { year } : {}),
      ...(journal ? { journal } : {}),
      pmid: uid,
      ...(linkedDoi && doi ? { doi, doiUrl: linkedDoi } : {}),
      source: "PubMed",
      pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
      pubTypes: asStrings(record.pubtype),
      ...(sortDate ? { sortDate } : {}),
    })
  }
  return papers
}

/** Pulls abstracts from an efetch XML payload. PMIDs without an abstract are omitted. */
export function parsePubMedAbstracts(xml: string): Record<string, string> {
  const abstracts: Record<string, string> = {}
  for (const chunk of xml.split(/<PubmedArticle\b/)) {
    const pmid = chunk.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1]
    if (!pmid) continue
    const parts = [...chunk.matchAll(/<AbstractText\b[^>]*>([\s\S]*?)<\/AbstractText>/g)]
      .map((match) => decodeXml(match[1] ?? ""))
      .filter(Boolean)
    if (parts.length) abstracts[pmid] = parts.join(" ")
  }
  return abstracts
}

async function fetchAbstracts(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {}
  const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi")
  url.searchParams.set("db", "pubmed")
  url.searchParams.set("id", ids.join(","))
  url.searchParams.set("retmode", "xml")
  url.searchParams.set("tool", "nanotophea")
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error("PubMed abstracts failed")
  return parsePubMedAbstracts(await response.text())
}

export async function addPubMedAbstracts(papers: PubMedPaper[]): Promise<PubMedPaper[]> {
  if (!papers.length) return papers
  const abstracts = await fetchAbstracts(papers.map((paper) => paper.pmid))
  return papers.map((paper) => {
    const abstract = abstracts[paper.pmid]
    return abstract ? { ...paper, abstract } : paper
  })
}

export async function searchPubMed(term: string, sort: "relevance" | "pub_date" = "relevance"): Promise<PubMedPaper[]> {
  const query = term.trim()
  if (!query) return []
  const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi")
  searchUrl.searchParams.set("db", "pubmed")
  searchUrl.searchParams.set("term", query)
  searchUrl.searchParams.set("retmode", "json")
  searchUrl.searchParams.set("retmax", "25")
  searchUrl.searchParams.set("sort", sort)
  searchUrl.searchParams.set("tool", "nanotophea")
  const searchResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(12000) })
  if (!searchResponse.ok) throw new Error("PubMed search failed")
  const search = (await searchResponse.json()) as { esearchresult?: { idlist?: string[] } }
  const ids = (search.esearchresult?.idlist ?? []).filter((id) => /^\d+$/.test(id))
  if (!ids.length) return []
  const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi")
  summaryUrl.searchParams.set("db", "pubmed")
  summaryUrl.searchParams.set("id", ids.join(","))
  summaryUrl.searchParams.set("retmode", "json")
  summaryUrl.searchParams.set("tool", "nanotophea")
  const summaryResponse = await fetch(summaryUrl, { signal: AbortSignal.timeout(12000) })
  if (!summaryResponse.ok) throw new Error("PubMed summaries failed")
  return parsePubMedSummary(await summaryResponse.json())
}
