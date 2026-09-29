/** Evidence classification — STUDY_DESIGN_CONTRACT.md §3 */
export type EvidenceType =
  | "REFERENCE"
  | "LITERATURE"
  | "PREDICTED"
  | "EXPERIMENTAL"
  | "INTERPRETATION"
  | "SIMULATION"

export const EVIDENCE_META: Record<
  EvidenceType,
  { label: string; short: string; color: string; bg: string; border: string }
> = {
  REFERENCE: {
    label: "Reference",
    short: "REFERENCE",
    color: "#475569",
    bg: "#f1f5f9",
    border: "#cbd5e1",
  },
  LITERATURE: {
    label: "Literature",
    short: "LITERATURE",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  PREDICTED: {
    label: "Predicted",
    short: "PREDICTED",
    color: "#0369a1",
    bg: "#e0f2fe",
    border: "#7dd3fc",
  },
  EXPERIMENTAL: {
    label: "Experimental",
    short: "EXPERIMENTAL",
    color: "#047857",
    bg: "#ecfdf5",
    border: "#6ee7b7",
  },
  INTERPRETATION: {
    label: "Interpretation",
    short: "INTERPRETATION",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fcd34d",
  },
  SIMULATION: {
    label: "Simulation",
    short: "SIMULATION",
    color: "#9a3412",
    bg: "#fff7ed",
    border: "#fdba74",
  },
}
