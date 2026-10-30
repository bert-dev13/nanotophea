import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { explainRelevance, literatureSearch, NO_SUPPORTING_PAPER, selectSupportingPaper } from "@/lib/predictions/literature"
import type { PubMedPaper } from "@/lib/scientific/pubmed"
import { doiUrl, formatAuthors, parsePubMedAbstracts, parsePubMedSummary, publicationLabel, pubmedUrl } from "@/lib/scientific/pubmed"

describe("PubMed summary parser", () => {
  it("keeps only records that include a title and PMID", () => {
    const papers = parsePubMedSummary({
      result: {
        uids: ["12345678", "999"],
        "12345678": {
          title: "Luteolin and HepG2 apoptosis.",
          pubdate: "2020 Jan",
          fulljournalname: "Journal of Example",
          source: "J Example",
          authors: [{ name: "Ada Lovelace" }, { name: "Grace Hopper" }, { name: "Mary Jackson" }, { name: "Katherine Johnson" }],
          articleids: [{ idtype: "doi", value: "10.1000/example" }],
          pubtype: ["Journal Article"],
          sortpubdate: "2020/01/01 00:00",
        },
        "999": { pubdate: "2021" },
      },
    })
    assert.equal(papers.length, 1)
    assert.equal(papers[0]?.pmid, "12345678")
    assert.equal(papers[0]?.doi, "10.1000/example")
    assert.equal(papers[0]?.doiUrl, "https://doi.org/10.1000/example")
    assert.equal(papers[0]?.pubmedUrl, "https://pubmed.ncbi.nlm.nih.gov/12345678/")
    assert.equal(papers[0]?.authors, "Ada Lovelace, Grace Hopper, Mary Jackson, et al.")
    assert.equal(papers[0]?.year, "2020")
    assert.equal(papers[0]?.journal, "Journal of Example")
    assert.equal(publicationLabel(papers[0]?.pubTypes ?? []), "Research article")
    assert.equal("relevance" in (papers[0] ?? {}), false)
  })

  it("returns no papers for an unrecognized payload", () => {
    assert.deepEqual(parsePubMedSummary({ unexpected: true }), [])
  })

  it("builds links only from real identifiers", () => {
    assert.equal(pubmedUrl("35227839"), "https://pubmed.ncbi.nlm.nih.gov/35227839/")
    assert.equal(pubmedUrl("abc"), undefined)
    assert.equal(doiUrl("10.1016/j.ejps.2022.106153"), "https://doi.org/10.1016/j.ejps.2022.106153")
    assert.equal(doiUrl(""), undefined)
  })

  it("reads abstracts that PubMed actually returned", () => {
    const abstracts = parsePubMedAbstracts(`
      <PubmedArticle>
        <MedlineCitation>
          <PMID Version="1">35227839</PMID>
          <Article><Abstract><AbstractText>Rutin reduced DPPH radicals.</AbstractText></Abstract></Article>
        </MedlineCitation>
      </PubmedArticle>
      <PubmedArticle><MedlineCitation><PMID>1</PMID></MedlineCitation></PubmedArticle>
    `)
    assert.equal(abstracts["35227839"], "Rutin reduced DPPH radicals.")
    assert.equal(abstracts["1"], undefined)
  })
})

describe("literature relevance", () => {
  it("builds the study queries without inventing citations", () => {
    assert.equal(literatureSearch("dpph", "Rutin").term, "Rutin[Title/Abstract] AND (DPPH[Title/Abstract] OR \"radical scavenging\"[Title/Abstract])")
    assert.equal(literatureSearch("mtt", "Rutin", "HepG2").term, "Rutin[Title/Abstract] AND (MTT[Title/Abstract] OR \"cell viability\"[Title/Abstract])")
    assert.equal(literatureSearch("ldh", "Rutin", "HepG2").term, "Rutin[Title/Abstract] AND (LDH[Title/Abstract] OR \"lactate dehydrogenase\"[Title/Abstract]) AND (cytotoxicity[Title/Abstract] OR \"cell viability\"[Title/Abstract] OR \"cell damage\"[Title/Abstract])")
    assert.equal(literatureSearch("ros", "Rutin", "HepG2").term, "Rutin[Title/Abstract] AND (ROS[Title/Abstract] OR \"oxidative stress\"[Title/Abstract] OR \"reactive oxygen species\"[Title/Abstract])")
    assert.equal(literatureSearch("bax", "Rutin", "HepG2").term, "Rutin[Title/Abstract] AND (BAX[Title/Abstract] OR \"BCL-2\"[Title/Abstract] OR BCL2[Title/Abstract])")
    assert.equal(literatureSearch("hippo_yap", "Rutin", "HepG2").term, "Rutin[Title/Abstract] AND (YAP[Title/Abstract] OR YAP1[Title/Abstract] OR Hippo[Title/Abstract] OR TEAD[Title/Abstract])")
    assert.equal(literatureSearch("dpph", "Rutin").tags.join(" · "), "Rutin · DPPH · Antioxidant activity")
  })

  it("explains relevance only from text that mentions the compound and theme", () => {
    assert.equal(
      explainRelevance("This study measured DPPH scavenging by rutin.", "Rutin", ["DPPH", "antioxidant"]),
      "The retrieved title and abstract address Rutin together with DPPH.",
    )
    assert.equal(explainRelevance("A review of tea extracts.", "Rutin", ["DPPH"]), undefined)
    assert.equal(formatAuthors(["Ada Lovelace"]), "Ada Lovelace")
  })

  it("keeps one recent paper where the compound and endpoint are central", () => {
    const selected = selectSupportingPaper([
      paper({
        pmid: "1",
        year: "2019",
        sortDate: "2019/01/01 00:00",
        title: "Quercetin DPPH antioxidant activity.",
        abstract: "Direct DPPH measurement of quercetin.",
      }),
      paper({
        pmid: "2",
        year: "2025",
        sortDate: "2025/06/01 00:00",
        title: "Dietary notes on quercetin.",
        abstract: "Quercetin is mentioned among many flavonoids.",
      }),
      paper({
        pmid: "3",
        year: "2024",
        sortDate: "2024/02/01 00:00",
        title: "Antioxidant capacity of plant extracts.",
        abstract: "The extract and quercetin were compared.",
      }),
      paper({
        pmid: "4",
        year: "2022",
        sortDate: "2022/03/01 00:00",
        title: "Quercetin DPPH radical scavenging in HepG2 cells.",
        abstract: "DPPH antioxidant activity of quercetin was measured.",
      }),
      paper({
        pmid: "5",
        year: "2026",
        sortDate: "2026/01/01 00:00",
        title: "Quercetin content of a tea infusion.",
        abstract: "Antioxidant capacity was discussed generally.",
      }),
    ], { compound: "Quercetin", endpoint: "dpph" })
    assert.equal(selected?.pmid, "4")
    assert.match(selected?.relevanceNote ?? "", /Quercetin/)
    assert.match(selected?.relevanceNote ?? "", /DPPH/)
    assert.match(selected?.relevanceNote ?? "", /HepG2/)
    assert.equal(NO_SUPPORTING_PAPER, "No sufficiently relevant recent research found.")
  })

  it("accepts relevant older peer-reviewed studies and rejects unrelated papers", () => {
    const selected = selectSupportingPaper([
      paper({
        pmid: "9",
        year: "2018",
        sortDate: "2018/05/01 00:00",
        title: "Quercetin DPPH assay.",
        abstract: "Direct measurement of DPPH radical scavenging.",
      }),
      paper({
        pmid: "8",
        year: "2023",
        sortDate: "2023/05/01 00:00",
        title: "A survey of dietary flavonoids.",
        abstract: "Quercetin appears once.",
      }),
    ], { compound: "Quercetin", endpoint: "dpph" })
    assert.equal(selected?.pmid, "9")
  })

  it("does not select a paper that only discusses the compound as an antioxidant", () => {
    const selected = selectSupportingPaper([
      paper({
        pmid: "7",
        year: "2024",
        sortDate: "2024/01/01 00:00",
        title: "Therapeutic potential of quercetin as an antioxidant.",
        abstract: "Quercetin antioxidant effects are reviewed.",
      }),
    ], { compound: "Quercetin", endpoint: "dpph" })
    assert.equal(selected, null)
  })

  it("prefers a direct BAX apoptosis study", () => {
    const selected = selectSupportingPaper([
      paper({
        pmid: "11",
        year: "2025",
        sortDate: "2025/08/01 00:00",
        title: "Quercetin and the BCL-2 Beclin complex.",
        abstract: "Quercetin affected BCL-2 in macrophages.",
      }),
      paper({
        pmid: "12",
        year: "2023",
        sortDate: "2023/02/01 00:00",
        title: "Quercetin induces apoptosis through BAX.",
        abstract: "BAX and apoptosis increased after quercetin treatment.",
      }),
    ], { compound: "Quercetin", endpoint: "bax" })
    assert.equal(selected?.pmid, "12")
  })

  it("does not treat a serum LDH mention as the cytotoxicity endpoint", () => {
    const selected = selectSupportingPaper([
      paper({
        pmid: "6",
        year: "2024",
        sortDate: "2024/04/01 00:00",
        title: "Quercetin changes serum enzymes in rats.",
        abstract: "Serum LDH and lactate dehydrogenase were recorded.",
      }),
    ], { compound: "Quercetin", endpoint: "ldh" })
    assert.equal(selected, null)
  })
})

function paper(input: Pick<PubMedPaper, "pmid" | "year" | "title" | "abstract" | "sortDate">): PubMedPaper {
  return {
    pmid: input.pmid,
    title: input.title,
    authors: "Ada Lovelace",
    journal: "Journal of Example",
    year: input.year,
    source: "PubMed",
    pubTypes: ["Journal Article"],
    pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${input.pmid}/`,
    abstract: input.abstract,
    sortDate: input.sortDate,
  }
}
