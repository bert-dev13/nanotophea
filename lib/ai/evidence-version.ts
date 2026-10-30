import { createHash } from "node:crypto"

/** Stable identity for the sanitized study context. Same evidence produces the same version. */
export function evidenceVersion(context: string): string {
  return createHash("sha256").update(context).digest("hex")
}
