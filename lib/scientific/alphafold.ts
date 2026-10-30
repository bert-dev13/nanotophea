import { cached } from "@/lib/scientific/cache"

export async function getAlphaFoldCoordinates(modelId = "AF-O95835-F1"): Promise<string> {
  return cached(`alphafold:pdb:${modelId}`, async () => {
    const url = `https://alphafold.ebi.ac.uk/files/${modelId}-model_v6.pdb`
    const response = await fetch(url, {
      headers: { "User-Agent": "NANOTOPHEA" },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      const fallbackUrl = `https://alphafold.ebi.ac.uk/files/${modelId}-model_v4.pdb`
      const fallback = await fetch(fallbackUrl, {
        headers: { "User-Agent": "NANOTOPHEA" },
        signal: AbortSignal.timeout(30_000),
      })
      if (!fallback.ok) throw new Error("AlphaFold DB structure file request failed")
      const pdb = await fallback.text()
      if (!pdb.includes("ATOM")) throw new Error("AlphaFold DB did not return coordinates")
      return pdb
    }
    const pdb = await response.text()
    if (!pdb.includes("ATOM")) throw new Error("AlphaFold DB did not return coordinates")
    return pdb
  })
}
