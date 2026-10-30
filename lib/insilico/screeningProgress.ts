export type ScreeningCheck = "pending" | "ready" | "missing" | "running" | "failed"

export interface ScreeningLine {
  id: "pubchem" | "likeness" | "adme"
  label: string
  text: string
  state: ScreeningCheck
  detail?: string
}

export function screeningComponentStatus(input: {
  pubchem: "pending" | "ready" | "missing"
  likeness: "pending" | "ready" | "missing"
  likenessLabel?: string
  adme: "pending" | "running" | "ready" | "failed" | "unavailable"
  admeProvider?: string
}): { complete: number; total: 3; lines: ScreeningLine[] } {
  const pubchem: ScreeningLine = {
    id: "pubchem",
    label: "Reference",
    state: input.pubchem === "ready" ? "ready" : input.pubchem === "pending" ? "pending" : "missing",
    text: input.pubchem === "ready"
      ? "PubChem molecular properties retrieved"
      : input.pubchem === "pending"
        ? "Retrieving PubChem molecular properties"
        : "PubChem molecular properties not retrieved",
  }
  const likeness: ScreeningLine = {
    id: "likeness",
    label: "Rule-based",
    state: input.likeness === "ready" ? "ready" : input.likeness === "pending" ? "pending" : "missing",
    text: input.likeness === "ready"
      ? input.likenessLabel || "Drug-likeness screening calculated"
      : input.likeness === "pending"
        ? "Checking drug-likeness"
        : "Drug-likeness screening not calculated",
  }
  const adme: ScreeningLine = input.adme === "pending"
    ? {
      id: "adme",
      label: "ADME",
      state: "pending",
      text: "Run the assessment",
    }
    : input.adme === "unavailable"
      ? {
        id: "adme",
        label: "ADME",
        state: "failed",
        text: "ADME data is not available for this compound.",
      }
      : {
        id: "adme",
        label: "ADME",
        state: input.adme === "ready" ? "ready" : input.adme === "running" ? "running" : "failed",
        text: input.adme === "ready"
          ? "Assessment completed"
          : input.adme === "failed"
            ? "ADME assessment could not be completed."
            : "Assessment running",
      }
  const lines = [pubchem, likeness, adme]
  return {
    complete: lines.filter((line) => line.state === "ready").length,
    total: 3,
    lines,
  }
}
