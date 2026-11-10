import type { EndpointSpec } from "@/lib/predictions/types"

export const mttSpec: EndpointSpec = {
  endpoint: "mtt",
  label: "MTT (exploratory)",
  outputLabels: [
    "Metabolic viability (% at 50 µg/mL, exploratory)",
    "Exploratory Hill midpoint (µg/mL, not fitted IC50)",
    "Maximum metabolic inhibition (exploratory %)",
  ],
  context:
    "Exploratory SIMULATION of metabolic viability context for a selected compound × cell line (50–500 µg/mL). Docking excluded. MTT reflects metabolic activity, not definitive cell death. No selectivity index without paired IC50 inputs. No validated model is registered.",
}

export const mttModel = null
