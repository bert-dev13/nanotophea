import type { PredictionEndpoint } from "@/lib/domain/models"
import type { PubMedPaper } from "@/lib/scientific/pubmed"

export const LITERATURE_YEAR_MIN = 2021
export const LITERATURE_YEAR_MAX = 2026
export const NO_SUPPORTING_PAPER = "No sufficiently relevant recent research found."

export interface LiteratureSearch {
  term: string
  tags: string[]
  themes: string[]
}

const LIVER_TERMS = ["HepG2", "hepatocellular carcinoma", "liver cancer", "HCC"]

const ENDPOINT_TERMS: Record<PredictionEndpoint, { primary: string[]; secondary: string[]; context?: string[]; focus: string[] }> = {
  dpph: {
    primary: ["DPPH", "radical scavenging"],
    secondary: ["antioxidant", "free radical", "scavenging activity"],
    focus: ["DPPH"],
  },
  mtt: {
    primary: ["MTT", "cell viability"],
    secondary: ["cytotoxicity", "proliferation"],
    focus: ["MTT"],
  },
  ldh: {
    primary: ["LDH", "lactate dehydrogenase"],
    secondary: ["cytotoxicity", "cell viability", "cell damage"],
    context: ["cytotoxicity", "cell viability", "cell damage", "membrane damage"],
    focus: ["LDH", "lactate dehydrogenase"],
  },
  ros: {
    primary: ["ROS", "reactive oxygen species", "oxidative stress"],
    secondary: ["antioxidant"],
    focus: ["ROS", "oxidative stress"],
  },
  bax: {
    primary: ["BAX", "BCL-2", "BCL2"],
    secondary: ["apoptosis", "caspase"],
    context: ["apoptosis", "apoptotic", "caspase"],
    focus: ["BAX"],
  },
  hippo_yap: {
    primary: ["YAP1", "YAP", "Hippo", "TEAD"],
    secondary: ["Hippo signaling"],
    focus: ["YAP1", "YAP", "Hippo"],
  },
}

/** Endpoint-aware PubMed query. HepG2 is a ranking bonus, not a required term. */
export function candidateQueries(
  endpoint: PredictionEndpoint,
  compoundName: string,
  cellLineName?: string,
): string[] {
  const compound = compoundName.replace(/"/g, "").trim()
  const cell = cellLineName?.replace(/"/g, "").trim() || "HepG2"

  if (endpoint === "dpph") {
    return [
      `${fieldTerm(compound)} AND (DPPH[Title/Abstract] OR "radical scavenging"[Title/Abstract])`,
      `${fieldTerm(compound)} AND DPPH[Title/Abstract] AND (antioxidant[Title/Abstract] OR "radical scavenging activity"[Title/Abstract])`,
      `${fieldTerm(compound)} AND (DPPH[Title/Abstract] OR "antioxidant activity"[Title/Abstract])`,
    ]
  }
  if (endpoint === "mtt") {
    return [
      `${fieldTerm(compound)} AND (MTT[Title/Abstract] OR "cell viability"[Title/Abstract])`,
      `${fieldTerm(compound)} AND (${fieldTerm(cell)} OR "liver cancer"[Title/Abstract]) AND (MTT[Title/Abstract] OR cytotoxicity[Title/Abstract] OR "cell viability"[Title/Abstract])`,
      `${fieldTerm(compound)} AND (${fieldTerm(cell)} OR cytotoxicity[Title/Abstract]) AND "cell viability"[Title/Abstract]`,
    ]
  }
  if (endpoint === "ldh") {
    return [
      `${fieldTerm(compound)} AND (LDH[Title/Abstract] OR "lactate dehydrogenase"[Title/Abstract]) AND (cytotoxicity[Title/Abstract] OR "cell viability"[Title/Abstract] OR "cell damage"[Title/Abstract])`,
      `${fieldTerm(compound)} AND (${fieldTerm(cell)} OR "liver cancer"[Title/Abstract] OR liver[Title/Abstract]) AND (LDH[Title/Abstract] OR "lactate dehydrogenase"[Title/Abstract])`,
      `${fieldTerm(compound)} AND (LDH[Title/Abstract] OR "lactate dehydrogenase"[Title/Abstract])`,
    ]
  }
  if (endpoint === "ros") {
    return [
      `${fieldTerm(compound)} AND (ROS[Title/Abstract] OR "oxidative stress"[Title/Abstract] OR "reactive oxygen species"[Title/Abstract])`,
      `${fieldTerm(compound)} AND (${fieldTerm(cell)} OR "liver cancer"[Title/Abstract] OR liver[Title/Abstract]) AND (ROS[Title/Abstract] OR "oxidative stress"[Title/Abstract] OR "reactive oxygen species"[Title/Abstract])`,
      `${fieldTerm(compound)} AND "reactive oxygen species"[Title/Abstract] AND (antioxidant[Title/Abstract] OR "oxidative stress"[Title/Abstract])`,
    ]
  }
  if (endpoint === "bax") {
    return [
      `${fieldTerm(compound)} AND (BAX[Title/Abstract] OR "BCL-2"[Title/Abstract] OR BCL2[Title/Abstract])`,
      `${fieldTerm(compound)} AND (BAX[Title/Abstract] OR "BCL-2"[Title/Abstract] OR BCL2[Title/Abstract]) AND (apoptosis[Title/Abstract] OR caspase[Title/Abstract])`,
      `${fieldTerm(compound)} AND BAX[Title/Abstract]`,
    ]
  }
  return [
    `${fieldTerm(compound)} AND (YAP[Title/Abstract] OR YAP1[Title/Abstract] OR Hippo[Title/Abstract] OR TEAD[Title/Abstract])`,
    `${fieldTerm(compound)} AND (YAP[Title/Abstract] OR YAP1[Title/Abstract] OR "Hippo pathway"[Title/Abstract] OR "YAP-TEAD"[Title/Abstract])`,
    `${fieldTerm(compound)} AND (Hippo[Title/Abstract] OR TEAD[Title/Abstract])`,
  ]
}

export function literatureSearch(
  endpoint: PredictionEndpoint,
  compoundName: string,
  cellLineName?: string,
): LiteratureSearch {
  const compound = compoundName.replace(/"/g, "").trim()
  const queries = candidateQueries(endpoint, compoundName, cellLineName)
  const primaryTerm = queries[0] ?? `${fieldTerm(compound)}`

  if (endpoint === "dpph") {
    return {
      term: primaryTerm,
      tags: [compound, "DPPH", "Antioxidant activity"],
      themes: ENDPOINT_TERMS.dpph.primary,
    }
  }
  if (endpoint === "mtt") {
    return {
      term: primaryTerm,
      tags: [compound, "MTT", "Cell viability"],
      themes: ENDPOINT_TERMS.mtt.primary,
    }
  }
  if (endpoint === "ldh") {
    return {
      term: primaryTerm,
      tags: [compound, "LDH", "Cytotoxicity"],
      themes: ENDPOINT_TERMS.ldh.primary,
    }
  }
  if (endpoint === "ros") {
    return {
      term: primaryTerm,
      tags: [compound, "ROS", "Oxidative stress"],
      themes: ENDPOINT_TERMS.ros.primary,
    }
  }
  if (endpoint === "bax") {
    return {
      term: primaryTerm,
      tags: [compound, "BAX", "Apoptosis"],
      themes: ENDPOINT_TERMS.bax.primary,
    }
  }
  return {
    term: primaryTerm,
    tags: [compound, "Hippo-YAP", "YAP signaling"],
    themes: ENDPOINT_TERMS.hippo_yap.primary,
  }
}

export function publicationYear(paper: Pick<PubMedPaper, "year" | "sortDate">): number | null {
  const fromYear = paper.year?.match(/\d{4}/)?.[0]
  const fromSort = paper.sortDate?.match(/^(\d{4})/)?.[1]
  const value = Number(fromYear ?? fromSort)
  return Number.isInteger(value) && value > 0 ? value : null
}

/**
 * One paper for this compound and endpoint.
 * The compound and a direct endpoint term must both be present in the title or abstract.
 * A mention of the compound alone is not enough. Older peer-reviewed studies are acceptable.
 */
export function selectSupportingPaper(
  papers: PubMedPaper[],
  input: { compound: string; endpoint: PredictionEndpoint },
): PubMedPaper | null {
  const terms = ENDPOINT_TERMS[input.endpoint]
  const compound = input.compound.trim()
  if (!terms || !compound) return null
  const ranked = papers
    .map((paper) => {
      const year = publicationYear(paper)
      if (year == null || year < 1970 || year > 2030) return null
      const title = paper.title
      const abstract = paper.abstract ?? ""
      const score = relevanceScore(title, abstract, compound, terms.primary, terms.secondary, terms.context, terms.focus)
      if (score == null) return null
      // Slight bonus for contemporary research while keeping older peer-reviewed literature eligible
      const recencyBonus = year >= 2021 ? 15 : year >= 2015 ? 8 : 0
      return { paper, score: score + recencyBonus, year }
    })
    .filter((item): item is { paper: PubMedPaper; score: number; year: number } => item != null)
    .sort((a, b) => b.score - a.score || b.year - a.year || a.paper.pmid.localeCompare(b.paper.pmid))
  const best = ranked[0]
  if (!best) return null
  const note = explainRelevance(`${best.paper.title} ${best.paper.abstract ?? ""}`, compound, [
    ...terms.primary,
    ...terms.secondary,
  ], LIVER_TERMS)
  return note ? { ...best.paper, relevanceNote: note } : best.paper
}

/**
 * A short relevance sentence only from terms that appear in the retrieved title or abstract.
 */
export function explainRelevance(
  text: string,
  compound: string,
  themes: string[],
  context: string[] = [],
): string | undefined {
  const name = compound.trim()
  if (!name || !mentions(text, name)) return undefined
  const found = uniqueLabels(themes.filter((item) => mentions(text, item))).slice(0, 3)
  if (!found.length) return undefined
  const liver = uniqueLabels(context.filter((item) => mentions(text, item)))
  const liverText = liver.length ? ` It also refers to ${liver.join(", ")}.` : ""
  return `The retrieved title and abstract address ${name} together with ${found.join(", ")}.${liverText}`
}

function relevanceScore(
  title: string,
  abstract: string,
  compound: string,
  primary: string[],
  secondary: string[],
  context: string[] = [],
  focus: string[] = [],
): number | null {
  const compoundTitle = mentions(title, compound)
  const compoundBody = mentions(abstract, compound)
  const primaryTitle = primary.filter((term) => mentions(title, term))
  const primaryBody = primary.filter((term) => mentions(abstract, term))
  const text = `${title} ${abstract}`
  if (!(compoundTitle || compoundBody) || !(primaryTitle.length || primaryBody.length)) return null
  if (context.length && !context.some((term) => mentions(text, term))) return null
  let score = 0
  if (compoundTitle) score += 40
  if (compoundBody) score += 15
  score += Math.min(primaryTitle.length, 3) * 35
  score += Math.min(primaryBody.length, 3) * 12
  score += Math.min(secondary.filter((term) => mentions(title, term)).length, 2) * 10
  score += Math.min(secondary.filter((term) => mentions(abstract, term)).length, 2) * 4
  if (focus.some((term) => mentions(title, term))) score += 40
  if (LIVER_TERMS.some((term) => mentions(title, term))) score += 12
  if (LIVER_TERMS.some((term) => mentions(abstract, term))) score += 6
  if (!/review/i.test(title)) score += 16
  return score
}

function uniqueLabels(items: string[]): string[] {
  const labels: string[] = []
  for (const item of items) {
    const key = item.toLowerCase()
    const overlap = labels.findIndex((label) => {
      const existing = label.toLowerCase()
      return existing === key || existing.includes(key) || key.includes(existing)
    })
    if (overlap >= 0) {
      if (item.length > labels[overlap].length) labels[overlap] = item
      continue
    }
    labels.push(item)
  }
  return labels
}

function mentions(text: string, phrase: string): boolean {
  const body = phrase.trim()
  if (!body) return false
  const pattern = body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
  return new RegExp(`(?:^|[^A-Za-z0-9])${pattern}(?=$|[^A-Za-z0-9])`, "i").test(text)
}

function quoteTerm(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value
}

function fieldTerm(value: string): string {
  return `${quoteTerm(value)}[Title/Abstract]`
}
