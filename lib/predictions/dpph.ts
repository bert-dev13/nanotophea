import type { EndpointSpec } from "@/lib/predictions/types"

/** Output names from the study design. No numeric results are defined here. */
export const dpphSpec: EndpointSpec = {
  endpoint: "dpph",
  label: "DPPH",
  outputLabels: [
    "Predicted scavenging activity",
    "IC50",
    "Maximum scavenging",
    "TEAC",
    "Relative potency",
  ],
  context: "Compound-level radical-scavenging prediction. Study-design grid: 0 µM blank and 3.13–100 µM.",
}

/** No validated DPPH model is registered. */
export const dpphModel = null
