/**
 * ADME provider contract.
 *
 * Research protocol: SwissADME.
 * SwissADME (swissadme.ch) is a web application. Its authors document SMILES
 * submission through the website and CSV export. They do not publish a
 * supported API. This application does not submit to that form, scrape the
 * site, or label another engine's output as SwissADME.
 *
 * System implementation: ADMET-AI (Swanson et al., Bioinformatics 2024).
 * Chemprop models trained on Therapeutics Data Commons ADMET datasets.
 * https://github.com/swansonk14/admet_ai
 */

export const ADME_PROVIDER_NAME = "ADMET-AI"
export const ADME_METHOD_LABEL = "Computational ADME prediction"
export const ADME_MODEL_NAME = "Chemprop models trained on Therapeutics Data Commons ADMET datasets"
export const ADME_NORMALIZER_VERSION = "1"
export const ADME_CLASSIFICATION_THRESHOLD = 0.5
export const ADME_PROTOCOL_NOTE =
  "The research protocol names SwissADME for physicochemical, drug-likeness, and ADME properties. SwissADME does not provide a supported API, so this application does not automate SwissADME and these values are not SwissADME results. This assessment is a computational prediction from ADMET-AI."

export const ADME_ENGINE_UNAVAILABLE = "ADME service is currently unavailable."
export const ADME_ASSESSMENT_FAILED = "ADME assessment could not be completed."
export const ADME_NO_STRUCTURE = "PubChem did not return a structure for this compound."
export const ADME_NO_CID = "This compound has no PubChem CID, so ADME assessment cannot start."
export const ADME_PUBCHEM_UNAVAILABLE = "Scientific data temporarily unavailable."

export interface AdmePredictInput {
  compoundId: string
  smiles: string
  pubchemCid?: number
}

/** Normalized output of one provider call. Study metadata is added when the result is saved. */
export interface AdmeResult {
  compoundId: string
  smiles: string
  pubchemCid?: number
  provider: string
  providerVersion: string
  method: string
  model: string
  evidenceClass: "PREDICTED"
  descriptors: Record<string, string>
  raw: Record<string, number>
}

export interface AdmeProvider {
  name: string
  version: string
  method: string
  model: string
  predict(input: AdmePredictInput): Promise<AdmeResult>
  predictBatch?(inputs: AdmePredictInput[]): Promise<AdmeBatchItem[]>
}

export interface AdmeBatchItem {
  compoundId: string
  result?: AdmeResult
  failed?: boolean
}

export interface AdmeEngineIdentity {
  name: string
  version: string
  method: string
  model: string
}
