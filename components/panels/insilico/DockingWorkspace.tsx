"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Cpu, Pencil, Plus, Trash2, X } from "lucide-react"
import { ModuleShell } from "@/components/ui/ModuleShell"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useStudy } from "@/components/providers/StudyProvider"
import { useAuth } from "@/components/providers/AuthProvider"
import {
  canEditScientificRuns,
  scientificRunRoleLabel,
} from "@/lib/permissions/researchAccess"
import { ResearchToolbar } from "@/components/research/ResearchToolbar"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import { ProvenanceCard } from "@/components/research/ProvenanceCard"
import {
  FieldGrid,
  FormField,
  MetaField,
  inputClass,
  inputStyle,
  textareaClass,
} from "@/components/research/FormFields"
import { ProteinViewer3D } from "@/lib/mol3d"
import type {
  Compound,
  DockingInteraction,
  DockingInteractionType,
  DockingMode,
  DockingRun,
  DockingRunInput,
  Protein,
} from "@/lib/domain/models"
import { listCompounds, listProteins } from "@/lib/repositories/researchDataRepository"
import {
  createDockingRun,
  deleteDockingRun,
  listDockingRuns,
  updateDockingRun,
} from "@/lib/repositories/scientificRunRepository"
import { toUserFacingError } from "@/lib/errors/userFacing"

type Mode = "view" | "create" | "edit"

const INTERACTION_TYPES: DockingInteractionType[] = [
  "Hydrogen Bond",
  "Hydrophobic",
  "Pi-Pi",
  "Pi-Cation",
  "Electrostatic",
  "Van der Waals",
  "Other",
]

interface FormState {
  runName: string
  compoundId: string
  proteinId: string
  vinaVersion: string
  receptorPdbId: string
  exhaustiveness: string
  numModes: string
  energyRange: string
  centerX: string
  centerY: string
  centerZ: string
  sizeX: string
  sizeY: string
  sizeZ: string
  modes: { mode: string; affinityKcalMol: string; rmsdLowerBound: string; rmsdUpperBound: string }[]
  selectedMode: string
  interactions: {
    residue: string
    interactionType: DockingInteractionType
    distanceAngstrom: string
    notes: string
  }[]
  notes: string
  dateGenerated: string
  assumptions: string
  limitations: string
  sourceDescription: string
}

function blankForm(compoundId = "", proteinId = "", pdb = ""): FormState {
  return {
    runName: "",
    compoundId,
    proteinId,
    vinaVersion: "",
    receptorPdbId: pdb,
    exhaustiveness: "",
    numModes: "",
    energyRange: "",
    centerX: "",
    centerY: "",
    centerZ: "",
    sizeX: "",
    sizeY: "",
    sizeZ: "",
    modes: [{ mode: "1", affinityKcalMol: "", rmsdLowerBound: "", rmsdUpperBound: "" }],
    selectedMode: "1",
    interactions: [],
    notes: "",
    dateGenerated: new Date().toISOString().slice(0, 10),
    assumptions: "",
    limitations:
      "Docking affinity is a computational prediction and does not constitute experimental evidence. Pose/complex files were not uploaded in this phase.",
    sourceDescription: "External AutoDock Vina run — results entered manually from Vina output.",
  }
}

function fromRecord(r: DockingRun): FormState {
  return {
    runName: r.runName,
    compoundId: r.compoundId,
    proteinId: r.proteinId,
    vinaVersion: r.vinaVersion,
    receptorPdbId: r.receptorPdbId ?? "",
    exhaustiveness: String(r.exhaustiveness),
    numModes: r.numModes != null ? String(r.numModes) : "",
    energyRange: r.energyRange != null ? String(r.energyRange) : "",
    centerX: String(r.searchBox.centerX),
    centerY: String(r.searchBox.centerY),
    centerZ: String(r.searchBox.centerZ),
    sizeX: String(r.searchBox.sizeX),
    sizeY: String(r.searchBox.sizeY),
    sizeZ: String(r.searchBox.sizeZ),
    modes: r.modes.map((m) => ({
      mode: String(m.mode),
      affinityKcalMol: String(m.affinityKcalMol),
      rmsdLowerBound: m.rmsdLowerBound != null ? String(m.rmsdLowerBound) : "",
      rmsdUpperBound: m.rmsdUpperBound != null ? String(m.rmsdUpperBound) : "",
    })),
    selectedMode: r.selectedMode != null ? String(r.selectedMode) : String(r.modes[0]?.mode ?? 1),
    interactions: (r.interactions ?? []).map((i) => ({
      residue: i.residue,
      interactionType: i.interactionType,
      distanceAngstrom: i.distanceAngstrom != null ? String(i.distanceAngstrom) : "",
      notes: i.notes ?? "",
    })),
    notes: r.notes ?? "",
    dateGenerated: (r.provenance.recordedAt ?? r.provenance.retrievedAt ?? "").slice(0, 10),
    assumptions: r.provenance.assumptions ?? "",
    limitations: r.provenance.limitations ?? "",
    sourceDescription: r.provenance.source ?? "",
  }
}

function parseRequiredNumber(label: string, raw: string): number {
  const n = Number(raw)
  if (raw.trim() === "" || Number.isNaN(n)) throw new Error(`${label} must be a number.`)
  return n
}

function buildInput(form: FormState, compounds: Compound[], proteins: Protein[]): DockingRunInput {
  const compound = compounds.find((c) => c.id === form.compoundId)
  const protein = proteins.find((p) => p.id === form.proteinId)
  if (!form.runName.trim()) throw new Error("Run name is required.")
  if (!form.compoundId) throw new Error("Select a ligand compound.")
  if (!form.proteinId) throw new Error("Select a target protein.")
  if (!form.vinaVersion.trim()) throw new Error("AutoDock Vina version is required.")
  if (!form.sourceDescription.trim()) throw new Error("Source description is required for provenance.")
  if (!form.dateGenerated.trim()) throw new Error("Date generated is required.")

  const modes: DockingMode[] = form.modes.map((m, idx) => {
    if (!m.affinityKcalMol.trim()) {
      throw new Error(`Mode ${m.mode || idx + 1}: enter affinity (kcal/mol) from actual Vina output.`)
    }
    const affinity = Number(m.affinityKcalMol)
    if (Number.isNaN(affinity)) throw new Error(`Mode ${m.mode}: affinity must be numeric (kcal/mol).`)
    const mode: DockingMode = {
      mode: parseRequiredNumber(`Mode number (row ${idx + 1})`, m.mode || String(idx + 1)),
      affinityKcalMol: affinity,
    }
    if (m.rmsdLowerBound.trim()) mode.rmsdLowerBound = Number(m.rmsdLowerBound)
    if (m.rmsdUpperBound.trim()) mode.rmsdUpperBound = Number(m.rmsdUpperBound)
    return mode
  })

  const best = modes.reduce((b, m) => (m.affinityKcalMol < b ? m.affinityKcalMol : b), modes[0]!.affinityKcalMol)

  const interactions: DockingInteraction[] = form.interactions
    .filter((i) => i.residue.trim())
    .map((i) => {
      const row: DockingInteraction = {
        residue: i.residue.trim(),
        interactionType: i.interactionType,
      }
      if (i.distanceAngstrom.trim()) {
        const d = Number(i.distanceAngstrom)
        if (Number.isNaN(d) || d <= 0) throw new Error(`Interaction ${i.residue}: distance must be a positive number (Å).`)
        row.distanceAngstrom = d
      }
      if (i.notes.trim()) row.notes = i.notes.trim()
      return row
    })

  const exhaustiveness = parseRequiredNumber("Exhaustiveness", form.exhaustiveness)
  if (exhaustiveness <= 0) throw new Error("Exhaustiveness must be positive.")

  return {
    runName: form.runName.trim(),
    compoundId: form.compoundId,
    proteinId: form.proteinId,
    vinaVersion: form.vinaVersion.trim(),
    receptorPdbId: form.receptorPdbId.trim() || protein?.pdbId,
    ligandName: compound?.name,
    ligandPubchemCid: compound?.pubchemCid,
    exhaustiveness,
    numModes: form.numModes.trim() ? parseRequiredNumber("Number of modes", form.numModes) : modes.length,
    energyRange: form.energyRange.trim() ? Number(form.energyRange) : undefined,
    searchBox: {
      centerX: parseRequiredNumber("Search box center X", form.centerX),
      centerY: parseRequiredNumber("Search box center Y", form.centerY),
      centerZ: parseRequiredNumber("Search box center Z", form.centerZ),
      sizeX: parseRequiredNumber("Search box size X", form.sizeX),
      sizeY: parseRequiredNumber("Search box size Y", form.sizeY),
      sizeZ: parseRequiredNumber("Search box size Z", form.sizeZ),
    },
    modes,
    bestBindingAffinityKcalMol: best,
    selectedMode: form.selectedMode.trim()
      ? parseRequiredNumber("Selected mode", form.selectedMode)
      : modes[0]!.mode,
    interactions,
    notes: form.notes.trim() || undefined,
    status: "imported",
    provenance: {
      evidenceClass: "PREDICTED",
      methodName: "AutoDock Vina",
      methodVersion: form.vinaVersion.trim(),
      source: form.sourceDescription.trim(),
      recordedAt: form.dateGenerated.trim(),
      assumptions: form.assumptions.trim() || undefined,
      limitations: form.limitations.trim() || undefined,
    },
  }
}

export default function DockingWorkspace() {
  const { user } = useAuth()
  const { activeStudy, membership } = useStudy()
  const canEdit = canEditScientificRuns(membership?.role)

  const [compounds, setCompounds] = useState<Compound[]>([])
  const [proteins, setProteins] = useState<Protein[]>([])
  const [runs, setRuns] = useState<DockingRun[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [ligandFilter, setLigandFilter] = useState("all")
  const [proteinFilter, setProteinFilter] = useState("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("view")
  const [form, setForm] = useState<FormState>(blankForm())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!activeStudy) return
    setLoading(true)
    setError(null)
    try {
      const [c, p, r] = await Promise.all([
        listCompounds(activeStudy.id),
        listProteins(activeStudy.id),
        listDockingRuns(activeStudy.id),
      ])
      setCompounds(c)
      setProteins(p)
      setRuns(r)
      setSelectedId((prev) => prev ?? r[0]?.id ?? null)
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load docking workspace"))
    } finally {
      setLoading(false)
    }
  }, [activeStudy])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return runs.filter((r) => {
      if (ligandFilter !== "all" && r.compoundId !== ligandFilter) return false
      if (proteinFilter !== "all" && r.proteinId !== proteinFilter) return false
      if (!q) return true
      return (
        r.runName.toLowerCase().includes(q) ||
        (r.ligandName ?? "").toLowerCase().includes(q) ||
        (r.receptorPdbId ?? "").toLowerCase().includes(q) ||
        String(r.bestBindingAffinityKcalMol).includes(q)
      )
    })
  }, [runs, search, ligandFilter, proteinFilter])

  const selected = runs.find((r) => r.id === selectedId) ?? null
  const selectedCompound = compounds.find((c) => c.id === (mode === "view" ? selected?.compoundId : form.compoundId))
  const selectedProtein = proteins.find((p) => p.id === (mode === "view" ? selected?.proteinId : form.proteinId))

  const startCreate = () => {
    const primary = compounds.find((c) => c.isPrimaryMarker) ?? compounds[0]
    const prot = proteins[0]
    setForm(blankForm(primary?.id ?? "", prot?.id ?? "", prot?.pdbId ?? ""))
    setMode("create")
    setError(null)
  }

  const save = async () => {
    if (!activeStudy || !user) return
    setBusy(true)
    setError(null)
    try {
      const input = buildInput(form, compounds, proteins)
      if (mode === "create") {
        const created = await createDockingRun(activeStudy.id, { id: user.uid }, input)
        setSelectedId(created.id)
      } else if (mode === "edit" && selected) {
        await updateDockingRun(activeStudy.id, selected.id, { id: user.uid }, input)
      }
      setMode("view")
      await load()
    } catch (e) {
      setError(toUserFacingError(e, "Save failed"))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!activeStudy || !user || !deleteId) return
    setBusy(true)
    try {
      await deleteDockingRun(activeStudy.id, deleteId, { id: user.uid })
      setDeleteId(null)
      setSelectedId(null)
      setMode("view")
      await load()
    } catch (e) {
      setError(toUserFacingError(e, "Delete failed"))
    } finally {
      setBusy(false)
    }
  }

  if (!activeStudy) {
    return (
      <ModuleShell
        icon={Cpu}
        title="Molecular Docking"
        subtitle="Select a study to record AutoDock Vina results."
        evidence="PREDICTED"
        phase="insilico"
      >
        <ResearchEmptyState title="No active study" body="Create or select a study first." canEdit={false} />
      </ModuleShell>
    )
  }

  const viewerPdb =
    mode === "view"
      ? selected?.receptorPdbId
      : form.receptorPdbId || selectedProtein?.pdbId
  const viewerName =
    mode === "view"
      ? selectedProtein?.name ?? selected?.receptorPdbId ?? "Receptor"
      : selectedProtein?.name ?? "Receptor"

  return (
    <ModuleShell
      icon={Cpu}
      title="Molecular Docking"
      subtitle="Import and review actual AutoDock Vina results. NANOTOPHEA does not execute Vina in this phase."
      evidence="PREDICTED"
      phase="insilico"
      contractNote="AutoDock Vina computational prediction. Docking affinity is a computational prediction and does not constitute experimental evidence. No AI confidence, fake ΔG, or simulated modes."
    >
      <div
        className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
        style={{ background: "#f0fdf9", borderColor: "#00a88244", color: "#0f766e" }}
      >
        <strong>AutoDock Vina computational prediction.</strong> Docking affinity is a computational
        prediction and does not constitute experimental evidence. Enter affinities and RMSD values
        only from real Vina output.
      </div>

      <ResearchToolbar
        search={search}
        onSearchChange={setSearch}
        canEdit={canEdit}
        role={membership?.role}
        onAdd={startCreate}
        addLabel="New docking run"
        count={filtered.length}
        filterSlot={
          <>
            <select
              className="rounded-lg border px-2 py-1.5 text-xs"
              style={{ borderColor: "#dde5ef", color: "#1a3558" }}
              value={ligandFilter}
              onChange={(e) => setLigandFilter(e.target.value)}
            >
              <option value="all">All ligands</option>
              {compounds.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border px-2 py-1.5 text-xs"
              style={{ borderColor: "#dde5ef", color: "#1a3558" }}
              value={proteinFilter}
              onChange={(e) => setProteinFilter(e.target.value)}
            >
              <option value="all">All proteins</option>
              {proteins.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="text-[10px] font-mono" style={{ color: "#94a3b8" }}>
              {scientificRunRoleLabel(membership?.role)}
            </span>
          </>
        }
      />

      {error && (
        <p
          className="text-xs rounded-lg px-3 py-2 border"
          style={{ color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
        >
          {error}
        </p>
      )}
      {loading && (
        <p className="text-sm" style={{ color: "#94a3b8" }}>
          Loading…
        </p>
      )}

      {!loading && compounds.length === 0 && (
        <ResearchEmptyState
          title="No ligands in this study"
          body="Add phytochemicals under Research Data before recording docking runs."
          canEdit={false}
        />
      )}
      {!loading && proteins.length === 0 && compounds.length > 0 && (
        <ResearchEmptyState
          title="No target proteins in this study"
          body="Add proteins under Research Data before recording docking runs."
          canEdit={false}
        />
      )}

      {!loading && compounds.length > 0 && proteins.length > 0 && filtered.length === 0 && mode === "view" ? (
        <ResearchEmptyState
          title="No docking runs yet"
          body="Record an external AutoDock Vina result: select ligand and protein, enter Vina parameters and mode affinities from the Vina log."
          canEdit={canEdit}
          actionLabel="New docking run"
          onAction={startCreate}
        />
      ) : compounds.length > 0 && proteins.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div
            className="rounded-xl border p-3 space-y-1 max-h-[640px] overflow-y-auto"
            style={{ background: "#ffffff", borderColor: "#dde5ef" }}
          >
            <p className="text-[10px] font-mono uppercase px-2 mb-1" style={{ color: "#94a3b8" }}>
              Previous runs
            </p>
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedId(r.id)
                  setMode("view")
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold"
                style={{
                  background: r.id === selectedId ? "#00a88212" : "transparent",
                  color: r.id === selectedId ? "#00a882" : "#1a3558",
                }}
              >
                {r.runName}
                <div className="text-[10px] font-mono font-normal" style={{ color: "#94a3b8" }}>
                  {r.ligandName ?? "ligand"} · {r.receptorPdbId ?? "PDB"} ·{" "}
                  {r.bestBindingAffinityKcalMol} kcal/mol
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs px-2 py-4" style={{ color: "#94a3b8" }}>
                No runs match filters.
              </p>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {(mode === "create" || mode === "edit") && (
              <div
                className="rounded-xl border p-4 space-y-4"
                style={{ background: "#ffffff", borderColor: "#dde5ef" }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
                    {mode === "create" ? "New docking run" : "Edit docking run"}
                  </h2>
                  <button type="button" onClick={() => setMode("view")} aria-label="Cancel">
                    <X size={16} style={{ color: "#94a3b8" }} />
                  </button>
                </div>

                <FormField label="Run name" required>
                  <input
                    className={inputClass}
                    style={inputStyle}
                    value={form.runName}
                    onChange={(e) => setForm({ ...form, runName: e.target.value })}
                    placeholder="e.g. Quercetin–YAP1 Vina run 2026-09-29"
                  />
                </FormField>

                <FieldGrid>
                  <FormField label="Ligand (compound)" required>
                    <select
                      className={inputClass}
                      style={inputStyle}
                      value={form.compoundId}
                      onChange={(e) => setForm({ ...form, compoundId: e.target.value })}
                    >
                      <option value="">Select compound…</option>
                      {compounds.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.pubchemCid != null ? ` (CID ${c.pubchemCid})` : ""}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Target protein" required>
                    <select
                      className={inputClass}
                      style={inputStyle}
                      value={form.proteinId}
                      onChange={(e) => {
                        const p = proteins.find((x) => x.id === e.target.value)
                        setForm({
                          ...form,
                          proteinId: e.target.value,
                          receptorPdbId: p?.pdbId ?? form.receptorPdbId,
                        })
                      }}
                    >
                      <option value="">Select protein…</option>
                      {proteins.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.pdbId ? ` (PDB ${p.pdbId})` : ""}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </FieldGrid>

                <div>
                  <p className="text-[10px] font-mono uppercase mb-2" style={{ color: "#546e8a" }}>
                    Vina configuration
                  </p>
                  <FieldGrid>
                    <FormField label="Vina version" required hint="e.g. 1.2.5 — from your Vina installation">
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.vinaVersion}
                        onChange={(e) => setForm({ ...form, vinaVersion: e.target.value })}
                        placeholder="1.2.x"
                      />
                    </FormField>
                    <FormField label="Receptor PDB ID" required>
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.receptorPdbId}
                        onChange={(e) => setForm({ ...form, receptorPdbId: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Exhaustiveness" required>
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.exhaustiveness}
                        onChange={(e) => setForm({ ...form, exhaustiveness: e.target.value })}
                        placeholder="from Vina command / config"
                      />
                    </FormField>
                    <FormField label="num_modes (optional)">
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.numModes}
                        onChange={(e) => setForm({ ...form, numModes: e.target.value })}
                      />
                    </FormField>
                    <FormField label="energy_range (optional)">
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.energyRange}
                        onChange={(e) => setForm({ ...form, energyRange: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Selected mode">
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.selectedMode}
                        onChange={(e) => setForm({ ...form, selectedMode: e.target.value })}
                      />
                    </FormField>
                  </FieldGrid>
                </div>

                <div>
                  <p className="text-[10px] font-mono uppercase mb-2" style={{ color: "#546e8a" }}>
                    Search box (Å)
                  </p>
                  <FieldGrid>
                    {(
                      [
                        ["centerX", "Center X"],
                        ["centerY", "Center Y"],
                        ["centerZ", "Center Z"],
                        ["sizeX", "Size X"],
                        ["sizeY", "Size Y"],
                        ["sizeZ", "Size Z"],
                      ] as const
                    ).map(([key, label]) => (
                      <FormField key={key} label={label} required>
                        <input
                          className={inputClass}
                          style={inputStyle}
                          value={form[key]}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        />
                      </FormField>
                    ))}
                  </FieldGrid>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono uppercase" style={{ color: "#546e8a" }}>
                      Docking modes (from Vina output)
                    </p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: "#00a882" }}
                      onClick={() =>
                        setForm({
                          ...form,
                          modes: [
                            ...form.modes,
                            {
                              mode: String(form.modes.length + 1),
                              affinityKcalMol: "",
                              rmsdLowerBound: "",
                              rmsdUpperBound: "",
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={12} /> Add mode
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#dde5ef" }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: "#f8fafc", color: "#546e8a" }}>
                          <th className="text-left p-2 font-mono">Mode</th>
                          <th className="text-left p-2 font-mono">Affinity (kcal/mol)</th>
                          <th className="text-left p-2 font-mono">RMSD LB</th>
                          <th className="text-left p-2 font-mono">RMSD UB</th>
                          <th className="p-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {form.modes.map((m, idx) => (
                          <tr key={idx} style={{ borderTop: "1px solid #e2e8f0" }}>
                            {(["mode", "affinityKcalMol", "rmsdLowerBound", "rmsdUpperBound"] as const).map(
                              (field) => (
                                <td key={field} className="p-1.5">
                                  <input
                                    className={inputClass}
                                    style={inputStyle}
                                    value={m[field]}
                                    onChange={(e) => {
                                      const next = [...form.modes]
                                      next[idx] = { ...m, [field]: e.target.value }
                                      setForm({ ...form, modes: next })
                                    }}
                                    placeholder={field === "affinityKcalMol" ? "e.g. -7.8" : ""}
                                  />
                                </td>
                              )
                            )}
                            <td className="p-1.5">
                              {form.modes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      modes: form.modes.filter((_, i) => i !== idx),
                                    })
                                  }
                                  aria-label="Remove mode"
                                >
                                  <Trash2 size={12} style={{ color: "#b91c1c" }} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-mono uppercase" style={{ color: "#546e8a" }}>
                      Interactions (optional, manual)
                    </p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-semibold"
                      style={{ color: "#00a882" }}
                      onClick={() =>
                        setForm({
                          ...form,
                          interactions: [
                            ...form.interactions,
                            {
                              residue: "",
                              interactionType: "Hydrogen Bond",
                              distanceAngstrom: "",
                              notes: "",
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={12} /> Add interaction
                    </button>
                  </div>
                  <p className="text-[10px] mb-2" style={{ color: "#94a3b8" }}>
                    Record observed/interpreted contacts only. Do not invent interactions.
                  </p>
                  {form.interactions.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
                      <input
                        className={inputClass}
                        style={inputStyle}
                        placeholder="Residue"
                        value={row.residue}
                        onChange={(e) => {
                          const next = [...form.interactions]
                          next[idx] = { ...row, residue: e.target.value }
                          setForm({ ...form, interactions: next })
                        }}
                      />
                      <select
                        className={inputClass}
                        style={inputStyle}
                        value={row.interactionType}
                        onChange={(e) => {
                          const next = [...form.interactions]
                          next[idx] = {
                            ...row,
                            interactionType: e.target.value as DockingInteractionType,
                          }
                          setForm({ ...form, interactions: next })
                        }}
                      >
                        {INTERACTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        className={inputClass}
                        style={inputStyle}
                        placeholder="Distance Å"
                        value={row.distanceAngstrom}
                        onChange={(e) => {
                          const next = [...form.interactions]
                          next[idx] = { ...row, distanceAngstrom: e.target.value }
                          setForm({ ...form, interactions: next })
                        }}
                      />
                      <div className="flex gap-1">
                        <input
                          className={inputClass}
                          style={inputStyle}
                          placeholder="Notes"
                          value={row.notes}
                          onChange={(e) => {
                            const next = [...form.interactions]
                            next[idx] = { ...row, notes: e.target.value }
                            setForm({ ...form, interactions: next })
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              interactions: form.interactions.filter((_, i) => i !== idx),
                            })
                          }
                        >
                          <Trash2 size={12} style={{ color: "#b91c1c" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}>
                  <div className="flex items-center gap-2">
                    <EvidenceBadge type="PREDICTED" />
                    <span className="text-[10px] font-mono uppercase" style={{ color: "#546e8a" }}>
                      Provenance (required)
                    </span>
                  </div>
                  <FieldGrid>
                    <FormField label="Date generated" required>
                      <input
                        type="date"
                        className={inputClass}
                        style={inputStyle}
                        value={form.dateGenerated}
                        onChange={(e) => setForm({ ...form, dateGenerated: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Source description" required>
                      <input
                        className={inputClass}
                        style={inputStyle}
                        value={form.sourceDescription}
                        onChange={(e) => setForm({ ...form, sourceDescription: e.target.value })}
                      />
                    </FormField>
                  </FieldGrid>
                  <FormField label="Assumptions">
                    <textarea
                      className={textareaClass}
                      style={inputStyle}
                      value={form.assumptions}
                      onChange={(e) => setForm({ ...form, assumptions: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Limitations">
                    <textarea
                      className={textareaClass}
                      style={inputStyle}
                      value={form.limitations}
                      onChange={(e) => setForm({ ...form, limitations: e.target.value })}
                    />
                  </FormField>
                  <FormField label="Notes">
                    <textarea
                      className={textareaClass}
                      style={inputStyle}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </FormField>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("view")}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold border"
                    style={{ borderColor: "#dde5ef", color: "#546e8a" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save()}
                    className="nano-setup-save"
                  >
                    {busy ? "Saving…" : "Save docking run"}
                  </button>
                </div>
              </div>
            )}

            {mode === "view" && selected && (
              <>
                <div
                  className="rounded-xl border p-4 space-y-4"
                  style={{ background: "#ffffff", borderColor: "#dde5ef" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <EvidenceBadge type="PREDICTED" />
                        <span
                          className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border"
                          style={{ color: "#0f766e", borderColor: "#00a88244" }}
                        >
                          AutoDock Vina
                        </span>
                      </div>
                      <h2 className="text-lg font-bold" style={{ color: "#0d1f3c" }}>
                        {selected.runName}
                      </h2>
                      <p className="text-xs mt-1" style={{ color: "#546e8a" }}>
                        Best affinity:{" "}
                        <span className="font-mono font-semibold" style={{ color: "#0d1f3c" }}>
                          {selected.bestBindingAffinityKcalMol} kcal/mol
                        </span>
                        {selected.selectedMode != null ? ` · mode ${selected.selectedMode}` : ""}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForm(fromRecord(selected))
                            setMode("edit")
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                          style={{ borderColor: "#dde5ef", color: "#1a3558" }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(selected.id)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                          style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                  </div>

                  <FieldGrid>
                    <MetaField
                      label="Ligand"
                      value={
                        <>
                          {selected.ligandName ?? selectedCompound?.name}
                          {selected.ligandPubchemCid != null
                            ? ` · CID ${selected.ligandPubchemCid}`
                            : ""}
                        </>
                      }
                    />
                    <MetaField
                      label="Target"
                      value={
                        <>
                          {selectedProtein?.name ?? selected.proteinId}
                          {selected.receptorPdbId ? ` · PDB ${selected.receptorPdbId}` : ""}
                        </>
                      }
                    />
                    <MetaField label="Vina version" value={selected.vinaVersion} />
                    <MetaField label="Exhaustiveness" value={selected.exhaustiveness} />
                    <MetaField label="num_modes" value={selected.numModes} />
                    <MetaField label="energy_range" value={selected.energyRange} />
                  </FieldGrid>

                  <div>
                    <p className="text-[10px] font-mono uppercase mb-1" style={{ color: "#94a3b8" }}>
                      Search box (Å)
                    </p>
                    <p className="text-xs font-mono" style={{ color: "#1a3558" }}>
                      center ({selected.searchBox.centerX}, {selected.searchBox.centerY},{" "}
                      {selected.searchBox.centerZ}) · size ({selected.searchBox.sizeX},{" "}
                      {selected.searchBox.sizeY}, {selected.searchBox.sizeZ})
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-mono uppercase mb-2" style={{ color: "#94a3b8" }}>
                      Docking results
                    </p>
                    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#dde5ef" }}>
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: "#f8fafc", color: "#546e8a" }}>
                            <th className="text-left p-2 font-mono">Mode</th>
                            <th className="text-left p-2 font-mono">Affinity (kcal/mol)</th>
                            <th className="text-left p-2 font-mono">RMSD LB</th>
                            <th className="text-left p-2 font-mono">RMSD UB</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.modes.map((m) => (
                            <tr
                              key={m.mode}
                              style={{
                                borderTop: "1px solid #e2e8f0",
                                background:
                                  selected.selectedMode === m.mode ? "#00a88210" : undefined,
                              }}
                            >
                              <td className="p-2 font-mono">{m.mode}</td>
                              <td className="p-2 font-mono font-semibold">{m.affinityKcalMol}</td>
                              <td className="p-2 font-mono">{m.rmsdLowerBound ?? "—"}</td>
                              <td className="p-2 font-mono">{m.rmsdUpperBound ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {(selected.interactions?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] font-mono uppercase mb-2" style={{ color: "#94a3b8" }}>
                        Interactions (manual)
                      </p>
                      <ul className="space-y-1 text-xs" style={{ color: "#1a3558" }}>
                        {selected.interactions!.map((i, idx) => (
                          <li key={idx}>
                            <span className="font-semibold">{i.residue}</span> · {i.interactionType}
                            {i.distanceAngstrom != null ? ` · ${i.distanceAngstrom} Å` : ""}
                            {i.notes ? ` — ${i.notes}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selected.notes && <MetaField label="Notes" value={selected.notes} />}
                  <ProvenanceCard provenance={selected.provenance} />
                </div>

                {viewerPdb && (
                  <div
                    className="rounded-xl border p-3 space-y-2"
                    style={{ background: "#ffffff", borderColor: "#dde5ef" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] font-mono uppercase" style={{ color: "#94a3b8" }}>
                        3D structure — receptor only
                      </p>
                      <EvidenceBadge type="REFERENCE" />
                    </div>
                    <p className="text-[11px]" style={{ color: "#546e8a" }}>
                      Showing RCSB structure for PDB {viewerPdb}. Ligand–receptor complex pose
                      visualization requires pose files and is not available in this phase — do not
                      treat this view as a docked complex.
                    </p>
                    <ProteinViewer3D pdbId={viewerPdb} name={viewerName} />
                  </div>
                )}
              </>
            )}

            {mode === "view" && !selected && !loading && (
              <ResearchEmptyState
                title="Select a docking run"
                body="Choose a previous run or create a new one."
                canEdit={canEdit}
                actionLabel="New docking run"
                onAction={startCreate}
              />
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDeleteDialog
        open={!!deleteId}
        title="Delete docking run?"
        message="Removes this AutoDock Vina import from the current study. This cannot be undone."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={busy}
      />
    </ModuleShell>
  )
}
