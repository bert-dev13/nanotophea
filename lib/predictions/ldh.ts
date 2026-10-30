import type { EndpointSpec } from "@/lib/predictions/types"

export const ldhSpec: EndpointSpec = {
  endpoint: "ldh",
  label: "LDH",
  outputLabels: [
    "Predicted OD/absorbance",
    "LDH release",
    "% cytotoxicity",
    "Membrane disruption probability",
    "Effective concentration",
  ],
  context: "Cytotoxicity prediction for a selected cell line. Study-design concentrations: 50–500 µg/mL.",
}

export const ldhModel = null
