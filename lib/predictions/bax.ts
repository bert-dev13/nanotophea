import type { EndpointSpec } from "@/lib/predictions/types"

export const baxSpec: EndpointSpec = {
  endpoint: "bax",
  label: "BAX-target context (exploratory)",
  outputLabels: [
    "Exploratory BAX-target context response (index at 250 µg/mL)",
    "Exploratory Hill midpoint (µg/mL, demonstration only)",
  ],
  context:
    "Exploratory SIMULATION of a BAX-target context index for phytochemical × BAX-named target. Does not produce BCL-2, caspase-3, Annexin V/PI, or viable/early/late/necrotic population percentages. Docking affinities are excluded as apoptosis drivers. No validated apoptosis model is registered.",
}

export const baxModel = null
