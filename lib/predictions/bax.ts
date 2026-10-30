import type { EndpointSpec } from "@/lib/predictions/types"

export const baxSpec: EndpointSpec = {
  endpoint: "bax",
  label: "BAX-mediated Apoptosis",
  outputLabels: [
    "BAX response",
    "BCL-2 response",
    "BAX/BCL-2 ratio",
    "Caspase-3 activation",
    "Mitochondrial membrane potential loss",
    "Apoptosis probability",
    "Predicted viable/early apoptotic/late apoptotic/necrotic populations",
  ],
  context: "Apoptosis-pathway prediction for a selected phytochemical and BAX target.",
}

export const baxModel = null
