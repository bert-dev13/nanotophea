import type { EndpointSpec } from "@/lib/predictions/types"

export const ldhSpec: EndpointSpec = {
  endpoint: "ldh",
  label: "LDH (exploratory)",
  outputLabels: [
    "Exploratory membrane-damage index (% at 250 µg/mL)",
    "Exploratory Hill midpoint (µg/mL, not fitted IC50)",
  ],
  context:
    "Exploratory SIMULATION of a membrane-damage index for compound × cell line (50–500 µg/mL). No predicted OD/absorbance is generated. Experimental LDH % cytotoxicity (spontaneous + maximum-release controls) is computed only in Laboratory. No validated model is registered.",
}

export const ldhModel = null
