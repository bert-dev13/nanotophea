import type { EndpointSpec } from "@/lib/predictions/types"

export const hippoYapSpec: EndpointSpec = {
  endpoint: "hippo_yap",
  label: "Hippo–YAP Signaling",
  outputLabels: [
    "YAP1 suppression",
    "p-YAP Ser127",
    "LATS1 activation",
    "TEAD4 effects",
    "Nuclear YAP1",
    "Pathway interpretation",
  ],
  context: "Hippo–YAP pathway prediction for a selected phytochemical and YAP/Hippo target.",
}

export const hippoYapModel = null
