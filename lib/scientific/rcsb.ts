import { cached } from "@/lib/scientific/cache"
import type { RcsbStructure } from "@/lib/scientific/types"

export function normalizeRcsb(pdbId: string, entry: unknown, polymer: unknown, polymers?: unknown[]): RcsbStructure {
  const record = asRecord(entry)
  const chain = asRecord(polymer)
  const info = asRecord(record.rcsb_entry_info)
  const struct = asRecord(record.struct)
  const accession = asRecord(record.rcsb_accession_info)
  const citation = asRecord(record.rcsb_primary_citation)
  const molecule = asRecord(chain.rcsb_polymer_entity)
  const organisms = Array.isArray(chain.rcsb_entity_source_organism) ? chain.rcsb_entity_source_organism : []
  const organism = asRecord(organisms[0])
  const resolution = Array.isArray(info.resolution_combined) ? info.resolution_combined[0] : undefined
  const released = text(accession.initial_release_date)

  return {
    pdbId: pdbId.toUpperCase(),
    title: text(struct.title),
    method: text(info.experimental_method),
    resolution: typeof resolution === "number" && Number.isFinite(resolution) ? `${resolution} Å` : undefined,
    organism: text(organism.scientific_name) ?? text(organism.ncbi_scientific_name),
    molecule: text(molecule.pdbx_description),
    molecules: (polymers ?? [polymer]).map((item) => text(asRecord(asRecord(item).rcsb_polymer_entity).pdbx_description)).filter((item): item is string => Boolean(item)),
    polymers: (polymers ?? [polymer]).map(polymerView).filter((item): item is NonNullable<typeof item> => item != null),
    released: released ? released.slice(0, 10) : undefined,
    doi: text(citation.pdbx_database_id_DOI),
    source: "RCSB PDB",
  }
}

export function getRcsbStructure(pdbId: string): Promise<RcsbStructure> {
  const id = assertPdbId(pdbId)
  return cached(`rcsb:entry:v3:${id}`, async () => {
    const entry = await rcsbJson(`https://data.rcsb.org/rest/v1/core/entry/${id}`)
    const info = asRecord(asRecord(entry).rcsb_entry_info)
    const count = typeof info.polymer_entity_count === "number" && info.polymer_entity_count > 0
      ? Math.min(Math.floor(info.polymer_entity_count), 12)
      : 1
    const polymers = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        rcsbJson(`https://data.rcsb.org/rest/v1/core/polymer_entity/${id}/${index + 1}`).catch(() => null),
      ),
    )
    return normalizeRcsb(id, entry, polymers[0], polymers)
  })
}

export function getRcsbCoordinates(pdbId: string): Promise<string> {
  const id = assertPdbId(pdbId)
  return cached(`rcsb:pdb:${id}`, async () => {
    const response = await fetch(`https://files.rcsb.org/download/${id}.pdb`, {
      headers: { "User-Agent": "NANOTOPHEA" },
      signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) throw new Error("RCSB structure file request failed")
    const pdb = await response.text()
    if (!pdb.includes("ATOM") && !pdb.includes("HETATM")) throw new Error("RCSB did not return coordinates")
    return pdb
  })
}

export function assertPdbId(pdbId: string): string {
  const id = pdbId.trim().toUpperCase()
  if (!/^[0-9][A-Z0-9]{3}$/.test(id)) throw new Error("Invalid PDB ID")
  return id
}

async function rcsbJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "NANOTOPHEA" },
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) throw new Error("RCSB request failed")
  return response.json()
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function polymerView(raw: unknown) {
  const chain = asRecord(raw)
  const entity = asRecord(chain.rcsb_polymer_entity)
  const identifiers = asRecord(chain.rcsb_polymer_entity_container_identifiers)
  const organisms = Array.isArray(chain.rcsb_entity_source_organism) ? chain.rcsb_entity_source_organism : []
  const organism = asRecord(organisms[0])
  const poly = asRecord(chain.entity_poly)
  const sequence = text(poly.pdbx_seq_one_letter_code_can) ?? text(poly.pdbx_seq_one_letter_code)
  const description = text(entity.pdbx_description)
  const uniprotIds = stringList(identifiers.uniprot_ids)
  if (!description && uniprotIds.length === 0) return null
  return {
    description,
    organism: text(organism.scientific_name) ?? text(organism.ncbi_scientific_name),
    uniprotIds,
    chains: stringList(identifiers.auth_asym_ids),
    fragment: text(entity.pdbx_fragment),
    mutation: text(entity.pdbx_mutation),
    ...(sequence ? { length: sequence.replace(/\s/g, "").length } : {}),
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
