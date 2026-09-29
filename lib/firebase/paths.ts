export const COLLECTIONS = {
  users: "users",
  studies: "studies",
} as const

export function studyPath(studyId: string) {
  return `${COLLECTIONS.studies}/${studyId}`
}

export function studySub(studyId: string, sub: string) {
  return `${COLLECTIONS.studies}/${studyId}/${sub}`
}

export const STUDY_SUBCOLLECTIONS = {
  members: "members",
  formulations: "formulations",
  compounds: "compounds",
  proteins: "proteins",
  cellLines: "cellLines",
  admetRuns: "admetRuns",
  dockingRuns: "dockingRuns",
  predictionRuns: "predictionRuns",
  labDatasets: "labDatasets",
  statistics: "statistics",
  comparisons: "comparisons",
  interpretations: "interpretations",
  references: "references",
  auditLogs: "auditLogs",
} as const

export function labReplicatesPath(studyId: string, datasetId: string) {
  return `${studySub(studyId, STUDY_SUBCOLLECTIONS.labDatasets)}/${datasetId}/replicates`
}
