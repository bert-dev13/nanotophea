import { mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

export interface StoredArtifact {
  kind: "local_path"
  pathOrUrl: string
  fileName: string
  contentType: string
  sizeBytes: number
}

export interface DockingFileStore {
  readonly configured: boolean
  write(fileName: string, body: string): Promise<StoredArtifact | null>
}

/** Local artifact directory when DOCKING_ARTIFACT_DIR is set. Otherwise nothing is stored. */
export function dockingFileStore(studyId: string, pairKey: string): DockingFileStore {
  const root = process.env.DOCKING_ARTIFACT_DIR?.trim()
  if (!root) {
    return { configured: false, async write() { return null } }
  }
  const dir = resolve(root, studyId, pairKey)
  return {
    configured: true,
    async write(fileName, body) {
      mkdirSync(dir, { recursive: true })
      const path = join(dir, fileName)
      writeFileSync(path, body, "utf8")
      return {
        kind: "local_path",
        pathOrUrl: path,
        fileName,
        contentType: "chemical/x-pdbqt",
        sizeBytes: Buffer.byteLength(body),
      }
    },
  }
}
