import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  COMBINED_VIEW_SCIENTIFIC_NOTE,
  buildCombinedDockingResultRows,
  formulationCompositionCaption,
  formulationCompoundLine,
  isPhytochemicalAnalysisViewMode,
  PHYTOCHEMICAL_ANALYSIS_VIEW_LABEL,
} from "@/lib/phytochemicals/analysisView"

describe("phytochemical analysis view modes", () => {
  it("exposes individual and combined tea-formulation labels", () => {
    assert.equal(isPhytochemicalAnalysisViewMode("individual"), true)
    assert.equal(isPhytochemicalAnalysisViewMode("combined"), true)
    assert.equal(isPhytochemicalAnalysisViewMode("average"), false)
    assert.match(PHYTOCHEMICAL_ANALYSIS_VIEW_LABEL.combined, /Tea Formulation/i)
  })

  it("keeps combined-view scientific boundaries against averaging and synergy claims", () => {
    assert.match(COMBINED_VIEW_SCIENTIFIC_NOTE, /not averaged or fused/i)
    assert.match(COMBINED_VIEW_SCIENTIFIC_NOTE, /Synergistic|synergistic/i)
    assert.match(COMBINED_VIEW_SCIENTIFIC_NOTE, /not claimed/i)
  })

  it("formats compound identity lines for formulation composition lists", () => {
    assert.equal(
      formulationCompoundLine({
        id: "1",
        name: "Quercetin",
        pubchemCid: 5280343,
        formula: "C15H10O7",
        chemicalClass: "flavonoid",
      }),
      "Quercetin · CID 5280343 · C15H10O7 · flavonoid",
    )
  })

  it("states when the formulation currently contains only one selected compound", () => {
    assert.match(formulationCompositionCaption(1), /1 selected phytochemical/i)
    assert.match(formulationCompositionCaption(3), /all 3 phytochemicals/i)
  })

  it("keeps every Research Setup phytochemical in combined docking rows without averaging", () => {
    const rows = buildCombinedDockingResultRows({
      studyCompounds: [
        { id: "q", name: "Quercetin" },
        { id: "r", name: "Rutin" },
      ],
      proteins: [{ id: "p1", name: "KEAP1", gene: "KEAP1" }],
      eligibleCompoundIds: new Set(["q"]),
      pairs: [
        {
          compoundId: "q",
          proteinId: "p1",
          proteinName: "KEAP1",
          proteinGene: "KEAP1",
          affinityLabel: "-8.1 kcal/mol",
          statusLabel: "COMPLETED",
          detail: "Pair Quercetin × KEAP1 · status COMPLETED",
        },
      ],
    })
    assert.equal(rows.length, 2)
    assert.equal(rows[0].compoundId, "q")
    assert.equal(rows[0].result, "-8.1 kcal/mol")
    assert.equal(rows[1].compoundId, "r")
    assert.match(rows[1].result, /Not yet eligible/i)
    assert.ok(!rows.some((row) => /average/i.test(row.result)))
  })
})
