import type { EndpointSpec } from "@/lib/predictions/types"

export const mttSpec: EndpointSpec = {
  endpoint: "mtt",
  label: "MTT",
  outputLabels: ["Predicted IC50", "Cell viability", "Maximum inhibition", "Selectivity index"],
  context: "Viability prediction for a selected cell line. Study-design concentrations: 50–500 µg/mL.",
}

export const mttModel = null
