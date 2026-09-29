/**
 * Study Design Contract presets for researcher interpretation (manual selection only).
 * Wording preserved from docs/STUDY_DESIGN_CONTRACT.md §12.1 — not rewritten.
 */

export interface ResearchQuestionPreset {
  id: string
  researchQuestion: string
  researchObjective: string
  hypothesisText: string
  source: string
}

export const CONTRACT_INTERPRETATION_PRESETS: ResearchQuestionPreset[] = [
  {
    id: "contract-dpph-treatments",
    researchQuestion:
      "Is there a statistically significant difference across experimental DPPH treatments T1–T6 for % radical scavenging / IC₅₀?",
    researchObjective:
      "Evaluate experimental DPPH radical-scavenging outcomes for NanoHepatoTea treatments under the Study Design Contract.",
    hypothesisText:
      "Null: no significant difference across T1–T6 for DPPH % scavenging / IC₅₀. Alternative: significant difference across T1–T6.",
    source: "STUDY_DESIGN_CONTRACT.md §12.1 (experimental DPPH)",
  },
  {
    id: "contract-ldh-treatments",
    researchQuestion:
      "Is there a statistically significant difference across experimental LDH treatments T1–T6 for A₄₉₀ / LDH release / % cytotoxicity / curves / IC₅₀?",
    researchObjective:
      "Evaluate experimental LDH cytotoxicity outcomes on HepG2 for NanoHepatoTea treatments under the Study Design Contract.",
    hypothesisText:
      "Null: no significant difference across T1–T6 for LDH A₄₉₀ / release / % cytotoxicity / curves / IC₅₀. Alternative: significant difference across T1–T6.",
    source: "STUDY_DESIGN_CONTRACT.md §12.1 (experimental LDH)",
  },
]

export function getInterpretationPreset(id: string): ResearchQuestionPreset | undefined {
  return CONTRACT_INTERPRETATION_PRESETS.find((p) => p.id === id)
}
