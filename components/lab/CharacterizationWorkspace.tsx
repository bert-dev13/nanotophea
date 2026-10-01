"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Database, Pencil, Plus, Trash2, X } from "lucide-react"
import { ModuleShell } from "@/components/ui/ModuleShell"
import { EvidenceBadge } from "@/components/ui/EvidenceBadge"
import { useStudy } from "@/components/providers/StudyProvider"
import { useAuth } from "@/components/providers/AuthProvider"
import { canEditLabData } from "@/lib/permissions/researchAccess"
import { ResearchToolbar } from "@/components/research/ResearchToolbar"
import { ResearchEmptyState } from "@/components/research/ResearchEmptyState"
import { ConfirmDeleteDialog } from "@/components/research/ConfirmDeleteDialog"
import {
  FieldGrid,
  FormField,
  MetaField,
  inputClass,
  inputStyle,
  textareaClass,
} from "@/components/research/FormFields"
import { LabBanner, LabProvenanceCard } from "@/components/lab/AssayParts"
import {
  CHARACTERIZATION_ASSAYS,
  CHARACTERIZATION_LABELS,
  type CharacterizationAssay,
} from "@/lib/lab/labAssayConfig"
import type {
  CharacterizationPayload,
  Formulation,
  LabDataset,
  LabDatasetInput,
} from "@/lib/domain/models"
import {
  createLabDataset,
  deleteLabDataset,
  listLabDatasets,
  updateLabDataset,
} from "@/lib/repositories/labRepository"
import { listFormulations } from "@/lib/repositories/researchDataRepository"
import { toUserFacingError } from "@/lib/errors/userFacing"

type Mode = "view" | "create" | "edit"
type CharAssay = CharacterizationAssay

interface FormState {
  assayType: CharAssay
  datasetName: string
  formulationId: string
  laboratoryName: string
  datePerformed: string
  protocolReference: string
  kitName: string
  kitManufacturer: string
  instrument: string
  operatorName: string
  outsourcedLab: boolean
  notes: string
  limitations: string
  status: "draft" | "locked" | "final"
  // HPLC
  markerCompound: string
  retentionTimeMin: string
  peakArea: string
  calibrationInfo: string
  rSquared: string
  lod: string
  loq: string
  measuredQuercetinConcentration: string
  hplcConcUnit: string
  // Proximate
  moisture: string
  ash: string
  protein: string
  fat: string
  fiber: string
  proximateUnit: string
  // Nutritive
  carbohydrates: string
  energy: string
  energyUnit: string
  nutritiveFat: string
  nutritiveProtein: string
  servingInfo: string
  netWeight: string
  // Pb
  pbValue: string
  pbUnit: "mg_per_kg" | "ppm" | "other" | ""
  acceptanceLimit: string
  acceptanceLimitSource: string
  // Sensory
  sensoryTimepoint: string
  appearance: string
  odor: string
  taste: string
  overallAcceptability: string
  scaleProtocol: string
  // Microbial
  microbialTimepoint: string
  apc: string
  yeastMold: string
  microbialUnits: string
  acceptanceCriteria: string
  // Stability
  stabilityTimepoint: string
  storageConditions: string
  observations: string
  linkedSensoryNotes: string
  linkedMicrobialNotes: string
}

function blankForm(assay: CharAssay = "hplc"): FormState {
  return {
    assayType: assay,
    datasetName: "",
    formulationId: "",
    laboratoryName: "",
    datePerformed: new Date().toISOString().slice(0, 10),
    protocolReference: "",
    kitName: "",
    kitManufacturer: "",
    instrument: "",
    operatorName: "",
    outsourcedLab: false,
    notes: "",
    limitations: "",
    status: "draft",
    markerCompound: "",
    retentionTimeMin: "",
    peakArea: "",
    calibrationInfo: "",
    rSquared: "",
    lod: "",
    loq: "",
    measuredQuercetinConcentration: "",
    hplcConcUnit: "",
    moisture: "",
    ash: "",
    protein: "",
    fat: "",
    fiber: "",
    proximateUnit: "%",
    carbohydrates: "",
    energy: "",
    energyUnit: "",
    nutritiveFat: "",
    nutritiveProtein: "",
    servingInfo: "",
    netWeight: "",
    pbValue: "",
    pbUnit: "",
    acceptanceLimit: "",
    acceptanceLimitSource: "",
    sensoryTimepoint: "",
    appearance: "",
    odor: "",
    taste: "",
    overallAcceptability: "",
    scaleProtocol: "",
    microbialTimepoint: "",
    apc: "",
    yeastMold: "",
    microbialUnits: "",
    acceptanceCriteria: "",
    stabilityTimepoint: "",
    storageConditions: "",
    observations: "",
    linkedSensoryNotes: "",
    linkedMicrobialNotes: "",
  }
}

function num(s: string): number | undefined {
  if (!s.trim()) return undefined
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${s}`)
  return n
}

function str(s: string): string | undefined {
  const t = s.trim()
  return t || undefined
}

function fromDataset(d: LabDataset): FormState {
  const c = d.characterization ?? {}
  const base = blankForm((d.assayType as CharAssay) || "hplc")
  return {
    ...base,
    assayType: d.assayType as CharAssay,
    datasetName: d.datasetName,
    formulationId: d.formulationId ?? "",
    laboratoryName: d.laboratoryName,
    datePerformed: d.datePerformed.slice(0, 10),
    protocolReference: d.protocolReference,
    kitName: d.kitName ?? "",
    kitManufacturer: d.kitManufacturer ?? "",
    instrument: d.instrument ?? "",
    operatorName: d.operatorName ?? "",
    outsourcedLab: d.outsourcedLab,
    notes: d.notes ?? "",
    limitations: d.provenance.limitations ?? "",
    status: d.status,
    markerCompound: c.hplc?.markerCompound ?? "",
    retentionTimeMin: c.hplc?.retentionTimeMin != null ? String(c.hplc.retentionTimeMin) : "",
    peakArea: c.hplc?.peakArea != null ? String(c.hplc.peakArea) : "",
    calibrationInfo: c.hplc?.calibrationInfo ?? "",
    rSquared: c.hplc?.rSquared != null ? String(c.hplc.rSquared) : "",
    lod: c.hplc?.lod != null ? String(c.hplc.lod) : "",
    loq: c.hplc?.loq != null ? String(c.hplc.loq) : "",
    measuredQuercetinConcentration:
      c.hplc?.measuredQuercetinConcentration != null
        ? String(c.hplc.measuredQuercetinConcentration)
        : "",
    hplcConcUnit: c.hplc?.concentrationUnit ?? "",
    moisture: c.proximate?.moisture != null ? String(c.proximate.moisture) : "",
    ash: c.proximate?.ash != null ? String(c.proximate.ash) : "",
    protein: c.proximate?.protein != null ? String(c.proximate.protein) : "",
    fat: c.proximate?.fat != null ? String(c.proximate.fat) : "",
    fiber: c.proximate?.fiber != null ? String(c.proximate.fiber) : "",
    proximateUnit: c.proximate?.unit ?? "%",
    carbohydrates: c.nutritive?.carbohydrates != null ? String(c.nutritive.carbohydrates) : "",
    energy: c.nutritive?.energy != null ? String(c.nutritive.energy) : "",
    energyUnit: c.nutritive?.energyUnit ?? "",
    nutritiveFat: c.nutritive?.fat != null ? String(c.nutritive.fat) : "",
    nutritiveProtein: c.nutritive?.protein != null ? String(c.nutritive.protein) : "",
    servingInfo: c.nutritive?.servingInfo ?? "",
    netWeight: c.nutritive?.netWeight ?? "",
    pbValue: c.pb?.measuredValue != null ? String(c.pb.measuredValue) : "",
    pbUnit: c.pb?.unit ?? "",
    acceptanceLimit: c.pb?.acceptanceLimit != null ? String(c.pb.acceptanceLimit) : "",
    acceptanceLimitSource: c.pb?.acceptanceLimitSource ?? "",
    sensoryTimepoint: c.sensory?.timepoint ?? "",
    appearance: c.sensory?.appearance ?? "",
    odor: c.sensory?.odor ?? "",
    taste: c.sensory?.taste ?? "",
    overallAcceptability:
      c.sensory?.overallAcceptability != null ? String(c.sensory.overallAcceptability) : "",
    scaleProtocol: c.sensory?.scaleProtocol ?? "",
    microbialTimepoint: c.microbial?.timepoint ?? "",
    apc: c.microbial?.apc != null ? String(c.microbial.apc) : "",
    yeastMold: c.microbial?.yeastMold != null ? String(c.microbial.yeastMold) : "",
    microbialUnits: c.microbial?.units ?? "",
    acceptanceCriteria: c.microbial?.acceptanceCriteria ?? "",
    stabilityTimepoint: c.stability?.timepoint ?? "",
    storageConditions: c.stability?.storageConditions ?? "",
    observations: c.stability?.observations ?? "",
    linkedSensoryNotes: c.stability?.linkedSensoryNotes ?? "",
    linkedMicrobialNotes: c.stability?.linkedMicrobialNotes ?? "",
  }
}

function buildCharacterization(form: FormState): CharacterizationPayload {
  const payload: CharacterizationPayload = {}
  switch (form.assayType) {
    case "hplc":
      payload.hplc = {
        markerCompound: str(form.markerCompound),
        retentionTimeMin: num(form.retentionTimeMin),
        peakArea: num(form.peakArea),
        calibrationInfo: str(form.calibrationInfo),
        rSquared: num(form.rSquared),
        lod: num(form.lod),
        loq: num(form.loq),
        measuredQuercetinConcentration: num(form.measuredQuercetinConcentration),
        concentrationUnit: str(form.hplcConcUnit),
      }
      break
    case "proximate":
      payload.proximate = {
        moisture: num(form.moisture),
        ash: num(form.ash),
        protein: num(form.protein),
        fat: num(form.fat),
        fiber: num(form.fiber),
        unit: str(form.proximateUnit),
      }
      break
    case "nutritive":
      payload.nutritive = {
        carbohydrates: num(form.carbohydrates),
        energy: num(form.energy),
        energyUnit: str(form.energyUnit),
        fat: num(form.nutritiveFat),
        protein: num(form.nutritiveProtein),
        servingInfo: str(form.servingInfo),
        netWeight: str(form.netWeight),
      }
      break
    case "pb":
      payload.pb = {
        measuredValue: num(form.pbValue),
        unit: form.pbUnit || undefined,
        acceptanceLimit: num(form.acceptanceLimit),
        acceptanceLimitSource: str(form.acceptanceLimitSource),
      }
      break
    case "sensory":
      payload.sensory = {
        timepoint: str(form.sensoryTimepoint),
        appearance: str(form.appearance),
        odor: str(form.odor),
        taste: str(form.taste),
        overallAcceptability: num(form.overallAcceptability),
        scaleProtocol: str(form.scaleProtocol),
      }
      break
    case "microbial":
      payload.microbial = {
        timepoint: str(form.microbialTimepoint),
        apc: num(form.apc),
        yeastMold: num(form.yeastMold),
        units: str(form.microbialUnits),
        acceptanceCriteria: str(form.acceptanceCriteria),
      }
      break
    case "stability":
      payload.stability = {
        timepoint: str(form.stabilityTimepoint),
        storageConditions: str(form.storageConditions),
        observations: str(form.observations),
        linkedSensoryNotes: str(form.linkedSensoryNotes),
        linkedMicrobialNotes: str(form.linkedMicrobialNotes),
      }
      break
  }
  return payload
}

function CharacterizationTypeFields({
  form,
  setForm,
}: {
  form: FormState
  setForm: (f: FormState) => void
}) {
  switch (form.assayType) {
    case "hplc":
      return (
        <FieldGrid>
          <FormField label="Marker compound">
            <input className={inputClass} style={inputStyle} value={form.markerCompound} onChange={(e) => setForm({ ...form, markerCompound: e.target.value })} />
          </FormField>
          <FormField label="Retention time (min)">
            <input className={inputClass} style={inputStyle} value={form.retentionTimeMin} onChange={(e) => setForm({ ...form, retentionTimeMin: e.target.value })} />
          </FormField>
          <FormField label="Peak area">
            <input className={inputClass} style={inputStyle} value={form.peakArea} onChange={(e) => setForm({ ...form, peakArea: e.target.value })} />
          </FormField>
          <FormField label="Calibration information">
            <input className={inputClass} style={inputStyle} value={form.calibrationInfo} onChange={(e) => setForm({ ...form, calibrationInfo: e.target.value })} />
          </FormField>
          <FormField label="R²">
            <input className={inputClass} style={inputStyle} value={form.rSquared} onChange={(e) => setForm({ ...form, rSquared: e.target.value })} />
          </FormField>
          <FormField label="LOD">
            <input className={inputClass} style={inputStyle} value={form.lod} onChange={(e) => setForm({ ...form, lod: e.target.value })} />
          </FormField>
          <FormField label="LOQ">
            <input className={inputClass} style={inputStyle} value={form.loq} onChange={(e) => setForm({ ...form, loq: e.target.value })} />
          </FormField>
          <FormField label="Measured quercetin concentration">
            <input className={inputClass} style={inputStyle} value={form.measuredQuercetinConcentration} onChange={(e) => setForm({ ...form, measuredQuercetinConcentration: e.target.value })} />
          </FormField>
          <FormField label="Concentration unit">
            <input className={inputClass} style={inputStyle} value={form.hplcConcUnit} onChange={(e) => setForm({ ...form, hplcConcUnit: e.target.value })} />
          </FormField>
        </FieldGrid>
      )
    case "proximate":
      return (
        <FieldGrid>
          <FormField label="Moisture"><input className={inputClass} style={inputStyle} value={form.moisture} onChange={(e) => setForm({ ...form, moisture: e.target.value })} /></FormField>
          <FormField label="Ash"><input className={inputClass} style={inputStyle} value={form.ash} onChange={(e) => setForm({ ...form, ash: e.target.value })} /></FormField>
          <FormField label="Protein"><input className={inputClass} style={inputStyle} value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} /></FormField>
          <FormField label="Fat"><input className={inputClass} style={inputStyle} value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} /></FormField>
          <FormField label="Fiber"><input className={inputClass} style={inputStyle} value={form.fiber} onChange={(e) => setForm({ ...form, fiber: e.target.value })} /></FormField>
          <FormField label="Unit"><input className={inputClass} style={inputStyle} value={form.proximateUnit} onChange={(e) => setForm({ ...form, proximateUnit: e.target.value })} /></FormField>
        </FieldGrid>
      )
    case "nutritive":
      return (
        <FieldGrid>
          <FormField label="Carbohydrates"><input className={inputClass} style={inputStyle} value={form.carbohydrates} onChange={(e) => setForm({ ...form, carbohydrates: e.target.value })} /></FormField>
          <FormField label="Energy"><input className={inputClass} style={inputStyle} value={form.energy} onChange={(e) => setForm({ ...form, energy: e.target.value })} /></FormField>
          <FormField label="Energy unit"><input className={inputClass} style={inputStyle} value={form.energyUnit} onChange={(e) => setForm({ ...form, energyUnit: e.target.value })} /></FormField>
          <FormField label="Fat"><input className={inputClass} style={inputStyle} value={form.nutritiveFat} onChange={(e) => setForm({ ...form, nutritiveFat: e.target.value })} /></FormField>
          <FormField label="Protein"><input className={inputClass} style={inputStyle} value={form.nutritiveProtein} onChange={(e) => setForm({ ...form, nutritiveProtein: e.target.value })} /></FormField>
          <FormField label="Serving information"><input className={inputClass} style={inputStyle} value={form.servingInfo} onChange={(e) => setForm({ ...form, servingInfo: e.target.value })} /></FormField>
          <FormField label="Net weight"><input className={inputClass} style={inputStyle} value={form.netWeight} onChange={(e) => setForm({ ...form, netWeight: e.target.value })} /></FormField>
        </FieldGrid>
      )
    case "pb":
      return (
        <FieldGrid>
          <FormField label="Measured value"><input className={inputClass} style={inputStyle} value={form.pbValue} onChange={(e) => setForm({ ...form, pbValue: e.target.value })} /></FormField>
          <FormField label="Unit">
            <select className={inputClass} style={inputStyle} value={form.pbUnit} onChange={(e) => setForm({ ...form, pbUnit: e.target.value as FormState["pbUnit"] })}>
              <option value="">—</option>
              <option value="mg_per_kg">mg/kg</option>
              <option value="ppm">ppm</option>
              <option value="other">other</option>
            </select>
          </FormField>
          <FormField label="Acceptance limit (only if researchers provide)">
            <input className={inputClass} style={inputStyle} value={form.acceptanceLimit} onChange={(e) => setForm({ ...form, acceptanceLimit: e.target.value })} />
          </FormField>
          <FormField label="Acceptance limit source">
            <input className={inputClass} style={inputStyle} placeholder="Required when limit is recorded" value={form.acceptanceLimitSource} onChange={(e) => setForm({ ...form, acceptanceLimitSource: e.target.value })} />
          </FormField>
        </FieldGrid>
      )
    case "sensory":
      return (
        <FieldGrid>
          <FormField label="Timepoint"><input className={inputClass} style={inputStyle} value={form.sensoryTimepoint} onChange={(e) => setForm({ ...form, sensoryTimepoint: e.target.value })} /></FormField>
          <FormField label="Appearance"><input className={inputClass} style={inputStyle} value={form.appearance} onChange={(e) => setForm({ ...form, appearance: e.target.value })} /></FormField>
          <FormField label="Odor"><input className={inputClass} style={inputStyle} value={form.odor} onChange={(e) => setForm({ ...form, odor: e.target.value })} /></FormField>
          <FormField label="Taste"><input className={inputClass} style={inputStyle} value={form.taste} onChange={(e) => setForm({ ...form, taste: e.target.value })} /></FormField>
          <FormField label="Overall acceptability"><input className={inputClass} style={inputStyle} value={form.overallAcceptability} onChange={(e) => setForm({ ...form, overallAcceptability: e.target.value })} /></FormField>
          <FormField label="Scale / protocol"><input className={inputClass} style={inputStyle} value={form.scaleProtocol} onChange={(e) => setForm({ ...form, scaleProtocol: e.target.value })} /></FormField>
        </FieldGrid>
      )
    case "microbial":
      return (
        <FieldGrid>
          <FormField label="Timepoint"><input className={inputClass} style={inputStyle} value={form.microbialTimepoint} onChange={(e) => setForm({ ...form, microbialTimepoint: e.target.value })} /></FormField>
          <FormField label="APC"><input className={inputClass} style={inputStyle} value={form.apc} onChange={(e) => setForm({ ...form, apc: e.target.value })} /></FormField>
          <FormField label="Yeast / mold"><input className={inputClass} style={inputStyle} value={form.yeastMold} onChange={(e) => setForm({ ...form, yeastMold: e.target.value })} /></FormField>
          <FormField label="Units"><input className={inputClass} style={inputStyle} value={form.microbialUnits} onChange={(e) => setForm({ ...form, microbialUnits: e.target.value })} /></FormField>
          <FormField label="Acceptance criteria (when documented)">
            <input className={inputClass} style={inputStyle} value={form.acceptanceCriteria} onChange={(e) => setForm({ ...form, acceptanceCriteria: e.target.value })} />
          </FormField>
        </FieldGrid>
      )
    case "stability":
      return (
        <FieldGrid>
          <FormField label="Timepoint"><input className={inputClass} style={inputStyle} value={form.stabilityTimepoint} onChange={(e) => setForm({ ...form, stabilityTimepoint: e.target.value })} /></FormField>
          <FormField label="Storage conditions"><input className={inputClass} style={inputStyle} value={form.storageConditions} onChange={(e) => setForm({ ...form, storageConditions: e.target.value })} /></FormField>
          <FormField label="Observations"><textarea className={textareaClass} style={inputStyle} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} /></FormField>
          <FormField label="Linked sensory notes"><textarea className={textareaClass} style={inputStyle} value={form.linkedSensoryNotes} onChange={(e) => setForm({ ...form, linkedSensoryNotes: e.target.value })} /></FormField>
          <FormField label="Linked microbial notes"><textarea className={textareaClass} style={inputStyle} value={form.linkedMicrobialNotes} onChange={(e) => setForm({ ...form, linkedMicrobialNotes: e.target.value })} /></FormField>
        </FieldGrid>
      )
    default:
      return null
  }
}

function CharacterizationResultView({ dataset }: { dataset: LabDataset }) {
  const c = dataset.characterization
  if (!c) {
    return <p className="text-sm" style={{ color: "#94a3b8" }}>No characterization measurements recorded.</p>
  }
  const rows: [string, string | undefined][] = []
  if (c.hplc) {
    rows.push(
      ["Marker", c.hplc.markerCompound],
      ["Retention time (min)", c.hplc.retentionTimeMin != null ? String(c.hplc.retentionTimeMin) : undefined],
      ["Peak area", c.hplc.peakArea != null ? String(c.hplc.peakArea) : undefined],
      ["Calibration", c.hplc.calibrationInfo],
      ["R²", c.hplc.rSquared != null ? String(c.hplc.rSquared) : undefined],
      ["LOD", c.hplc.lod != null ? String(c.hplc.lod) : undefined],
      ["LOQ", c.hplc.loq != null ? String(c.hplc.loq) : undefined],
      ["Quercetin conc.", c.hplc.measuredQuercetinConcentration != null ? `${c.hplc.measuredQuercetinConcentration} ${c.hplc.concentrationUnit ?? ""}`.trim() : undefined]
    )
  }
  if (c.proximate) {
    rows.push(
      ["Moisture", c.proximate.moisture != null ? String(c.proximate.moisture) : undefined],
      ["Ash", c.proximate.ash != null ? String(c.proximate.ash) : undefined],
      ["Protein", c.proximate.protein != null ? String(c.proximate.protein) : undefined],
      ["Fat", c.proximate.fat != null ? String(c.proximate.fat) : undefined],
      ["Fiber", c.proximate.fiber != null ? String(c.proximate.fiber) : undefined],
      ["Unit", c.proximate.unit]
    )
  }
  if (c.nutritive) {
    rows.push(
      ["Carbohydrates", c.nutritive.carbohydrates != null ? String(c.nutritive.carbohydrates) : undefined],
      ["Energy", c.nutritive.energy != null ? `${c.nutritive.energy} ${c.nutritive.energyUnit ?? ""}`.trim() : undefined],
      ["Fat", c.nutritive.fat != null ? String(c.nutritive.fat) : undefined],
      ["Protein", c.nutritive.protein != null ? String(c.nutritive.protein) : undefined],
      ["Serving", c.nutritive.servingInfo],
      ["Net weight", c.nutritive.netWeight]
    )
  }
  if (c.pb) {
    rows.push(
      ["Pb value", c.pb.measuredValue != null ? String(c.pb.measuredValue) : undefined],
      ["Unit", c.pb.unit],
      ["Acceptance limit", c.pb.acceptanceLimit != null ? String(c.pb.acceptanceLimit) : undefined],
      ["Limit source", c.pb.acceptanceLimitSource]
    )
  }
  if (c.sensory) {
    rows.push(
      ["Timepoint", c.sensory.timepoint],
      ["Appearance", c.sensory.appearance],
      ["Odor", c.sensory.odor],
      ["Taste", c.sensory.taste],
      ["Overall acceptability", c.sensory.overallAcceptability != null ? String(c.sensory.overallAcceptability) : undefined],
      ["Scale / protocol", c.sensory.scaleProtocol]
    )
  }
  if (c.microbial) {
    rows.push(
      ["Timepoint", c.microbial.timepoint],
      ["APC", c.microbial.apc != null ? String(c.microbial.apc) : undefined],
      ["Yeast/mold", c.microbial.yeastMold != null ? String(c.microbial.yeastMold) : undefined],
      ["Units", c.microbial.units],
      ["Acceptance criteria", c.microbial.acceptanceCriteria]
    )
  }
  if (c.stability) {
    rows.push(
      ["Timepoint", c.stability.timepoint],
      ["Storage", c.stability.storageConditions],
      ["Observations", c.stability.observations],
      ["Linked sensory", c.stability.linkedSensoryNotes],
      ["Linked microbial", c.stability.linkedMicrobialNotes]
    )
  }
  const visible = rows.filter(([, v]) => v)
  if (!visible.length) {
    return <p className="text-sm" style={{ color: "#94a3b8" }}>No characterization measurements recorded.</p>
  }
  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: "#dde5ef" }}>
      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border" style={{ color: "#047857", background: "#ecfdf5", borderColor: "#6ee7b7" }}>
        RAW EXPERIMENTAL DATA
      </span>
      <FieldGrid>
        {visible.map(([k, v]) => (
          <MetaField key={k} label={k} value={v} />
        ))}
      </FieldGrid>
    </div>
  )
}

export function CharacterizationWorkspace() {
  const { user } = useAuth()
  const { activeStudy, membership } = useStudy()
  const canEdit = canEditLabData(membership?.role)
  const studyId = activeStudy?.id

  const [search, setSearch] = useState("")
  const [filterAssay, setFilterAssay] = useState<CharAssay | "">("")
  const [datasets, setDatasets] = useState<LabDataset[]>([])
  const [formulations, setFormulations] = useState<Formulation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("view")
  const [form, setForm] = useState<FormState>(() => blankForm())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const selected = useMemo(
    () => datasets.find((d) => d.id === selectedId) ?? null,
    [datasets, selectedId]
  )

  const filtered = useMemo(() => {
    let rows = datasets.filter((d): d is LabDataset & { assayType: CharAssay } =>
      (CHARACTERIZATION_ASSAYS as readonly string[]).includes(d.assayType)
    )
    if (filterAssay) rows = rows.filter((d) => d.assayType === filterAssay)
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (d) =>
          d.datasetName.toLowerCase().includes(q) ||
          d.laboratoryName.toLowerCase().includes(q) ||
          d.assayType.includes(q)
      )
    }
    return rows
  }, [datasets, filterAssay, search])

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    setError(null)
    try {
      const [all, forms] = await Promise.all([
        listLabDatasets(studyId),
        listFormulations(studyId),
      ])
      setDatasets(
        all.filter((d): d is LabDataset & { assayType: CharAssay } =>
          (CHARACTERIZATION_ASSAYS as readonly string[]).includes(d.assayType)
        )
      )
      setFormulations(forms)
    } catch (e) {
      setError(toUserFacingError(e, "Failed to load characterization datasets"))
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    void load()
  }, [load])

  const buildInput = (): LabDatasetInput => {
    if (form.assayType === "pb" && form.acceptanceLimit.trim() && !form.acceptanceLimitSource.trim()) {
      throw new Error("Pb acceptance limit requires a documented source — do not invent limits.")
    }
    return {
      assay: form.assayType,
      assayType: form.assayType,
      datasetName: form.datasetName.trim(),
      formulationId: form.formulationId || undefined,
      laboratoryName: form.laboratoryName.trim(),
      datePerformed: form.datePerformed,
      protocolReference: form.protocolReference.trim(),
      protocolRef: form.protocolReference.trim(),
      kitName: str(form.kitName),
      kitManufacturer: str(form.kitManufacturer),
      instrument: str(form.instrument),
      operatorName: str(form.operatorName),
      outsourcedLab: form.outsourcedLab,
      notes: str(form.notes),
      status: form.status,
      treatmentSummaries: [],
      characterization: buildCharacterization(form),
      provenance: {
        evidenceClass: "EXPERIMENTAL",
        laboratoryName: form.laboratoryName.trim(),
        protocolRef: form.protocolReference.trim(),
        methodName: form.protocolReference.trim(),
        source: form.laboratoryName.trim(),
        recordedAt: form.datePerformed,
        limitations: str(form.limitations),
      },
    }
  }

  const save = async () => {
    if (!studyId || !user) return
    setSaving(true)
    setError(null)
    try {
      const input = buildInput()
      let id: string
      if (mode === "create") {
        const created = await createLabDataset(studyId, { id: user.uid }, input)
        id = created.id
      } else if (mode === "edit" && selected) {
        await updateLabDataset(studyId, selected.id, { id: user.uid }, input)
        id = selected.id
      } else {
        throw new Error("Invalid save mode")
      }
      setMode("view")
      setSelectedId(id)
      await load()
    } catch (e) {
      setError(toUserFacingError(e, "Save failed"))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!studyId || !user || !deleteId) return
    setSaving(true)
    try {
      await deleteLabDataset(studyId, deleteId, { id: user.uid })
      setDeleteId(null)
      setSelectedId(null)
      await load()
    } catch (e) {
      setError(toUserFacingError(e, "Delete failed"))
    } finally {
      setSaving(false)
    }
  }

  if (!studyId) {
    return (
      <ModuleShell
        icon={Database}
        title="Characterization"
        subtitle="HPLC, proximate, nutritive, Pb, sensory, microbial, and stability laboratory results."
        evidence="EXPERIMENTAL"
        phase="lab"
        contractNote="All values require lab provenance. Do not invent reference limits or acceptance criteria."
      >
        <ResearchEmptyState title="Select or create a study" body="Characterization datasets are study-scoped." canEdit={false} />
      </ModuleShell>
    )
  }

  return (
    <ModuleShell
      icon={Database}
      title="Characterization"
      subtitle="HPLC, proximate, nutritive, Pb, sensory, microbial, and stability laboratory results."
      evidence="EXPERIMENTAL"
      phase="lab"
      contractNote="All values require lab provenance. Do not invent reference limits or acceptance criteria. No report uploads in this phase."
    >
      <LabBanner text="CHARACTERIZATION — Laboratory" />

      <ResearchToolbar
        search={search}
        onSearchChange={setSearch}
        canEdit={canEdit}
        role={membership?.role}
        onAdd={() => {
          setMode("create")
          setForm(blankForm(filterAssay || "hplc"))
          setSelectedId(null)
        }}
        addLabel="New dataset"
        count={filtered.length}
        filterSlot={
          <select
            className={inputClass}
            style={{ ...inputStyle, maxWidth: 180 }}
            value={filterAssay}
            onChange={(e) => setFilterAssay(e.target.value as CharAssay | "")}
          >
            <option value="">All types</option>
            {CHARACTERIZATION_ASSAYS.map((a) => (
              <option key={a} value={a}>
                {CHARACTERIZATION_LABELS[a]}
              </option>
            ))}
          </select>
        }
      />

      {error && (
        <div className="rounded-lg border px-3 py-2 text-sm" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {mode === "view" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            {loading && <p className="text-xs" style={{ color: "#94a3b8" }}>Loading…</p>}
            {!loading && !filtered.length && (
              <ResearchEmptyState
                title="No characterization datasets"
                body="Record actual laboratory characterization results with provenance. Incomplete datasets are allowed."
                canEdit={canEdit}
                actionLabel="New dataset"
                onAction={() => {
                  setMode("create")
                  setForm(blankForm())
                }}
              />
            )}
            {filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className="w-full text-left rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: selectedId === d.id ? "#00a882" : "#dde5ef",
                  background: selectedId === d.id ? "#00a88210" : "#ffffff",
                }}
              >
                <div className="font-semibold" style={{ color: "#0d1f3c" }}>{d.datasetName}</div>
                <div className="text-[10px] font-mono" style={{ color: "#64748b" }}>
                  {CHARACTERIZATION_LABELS[d.assayType as CharAssay]} · {d.datePerformed}
                </div>
                <EvidenceBadge type="EXPERIMENTAL" className="mt-1" />
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {!selected && (
              <p className="text-sm" style={{ color: "#94a3b8" }}>Select a characterization dataset.</p>
            )}
            {selected && (
              <>
                <div className="flex gap-2">
                  {canEdit && (
                    <>
                      <button type="button" onClick={() => { setForm(fromDataset(selected)); setMode("edit") }} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: "#dde5ef" }}>
                        <Pencil size={12} /> Edit
                      </button>
                      <button type="button" onClick={() => setDeleteId(selected.id)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: "#fecaca", color: "#b91c1c" }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </>
                  )}
                </div>
                <LabProvenanceCard dataset={selected} />
                <CharacterizationResultView dataset={selected} />
              </>
            )}
          </div>
        </div>
      )}

      {(mode === "create" || mode === "edit") && (
        <div className="space-y-4 rounded-xl border p-4" style={{ borderColor: "#dde5ef", background: "#ffffff" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: "#0d1f3c" }}>
              {mode === "create" ? "Create characterization dataset" : "Edit characterization dataset"}
            </h2>
            <button type="button" onClick={() => setMode("view")} style={{ color: "#64748b" }}><X size={16} /></button>
          </div>
          <EvidenceBadge type="EXPERIMENTAL" size="md" />

          <FieldGrid>
            <FormField label="Assay type *">
              <select
                className={inputClass}
                style={inputStyle}
                value={form.assayType}
                disabled={mode === "edit"}
                onChange={(e) => setForm({ ...form, assayType: e.target.value as CharAssay })}
              >
                {CHARACTERIZATION_ASSAYS.map((a) => (
                  <option key={a} value={a}>{CHARACTERIZATION_LABELS[a]}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Dataset name *">
              <input className={inputClass} style={inputStyle} value={form.datasetName} onChange={(e) => setForm({ ...form, datasetName: e.target.value })} />
            </FormField>
            <FormField label="Formulation">
              <select className={inputClass} style={inputStyle} value={form.formulationId} onChange={(e) => setForm({ ...form, formulationId: e.target.value })}>
                <option value="">—</option>
                {formulations.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Laboratory / facility *">
              <input className={inputClass} style={inputStyle} value={form.laboratoryName} onChange={(e) => setForm({ ...form, laboratoryName: e.target.value })} />
            </FormField>
            <FormField label="Date performed *">
              <input type="date" className={inputClass} style={inputStyle} value={form.datePerformed} onChange={(e) => setForm({ ...form, datePerformed: e.target.value })} />
            </FormField>
            <FormField label="Protocol / method *">
              <input className={inputClass} style={inputStyle} value={form.protocolReference} onChange={(e) => setForm({ ...form, protocolReference: e.target.value })} />
            </FormField>
            <FormField label="Operator">
              <input className={inputClass} style={inputStyle} value={form.operatorName} onChange={(e) => setForm({ ...form, operatorName: e.target.value })} />
            </FormField>
            <FormField label="Outsourced laboratory">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.outsourcedLab} onChange={(e) => setForm({ ...form, outsourcedLab: e.target.checked })} />
                External laboratory report
              </label>
            </FormField>
            <FormField label="Instrument">
              <input className={inputClass} style={inputStyle} value={form.instrument} onChange={(e) => setForm({ ...form, instrument: e.target.value })} />
            </FormField>
            <FormField label="Kit name">
              <input className={inputClass} style={inputStyle} value={form.kitName} onChange={(e) => setForm({ ...form, kitName: e.target.value })} />
            </FormField>
            <FormField label="Kit manufacturer">
              <input className={inputClass} style={inputStyle} value={form.kitManufacturer} onChange={(e) => setForm({ ...form, kitManufacturer: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <select className={inputClass} style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState["status"] })}>
                <option value="draft">draft</option>
                <option value="locked">locked</option>
                <option value="final">final</option>
              </select>
            </FormField>
          </FieldGrid>

          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
            {CHARACTERIZATION_LABELS[form.assayType]} results
          </h3>
          <CharacterizationTypeFields form={form} setForm={setForm} />

          <FormField label="Notes / limitations">
            <textarea className={textareaClass} style={inputStyle} value={form.limitations || form.notes} onChange={(e) => setForm({ ...form, limitations: e.target.value, notes: e.target.value })} />
          </FormField>

          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={() => void save()} className="nano-setup-save">
              <Plus size={12} /> {saving ? "Saving…" : "Save dataset"}
            </button>
            <button type="button" onClick={() => setMode("view")} className="rounded-md border px-3 py-2 text-xs font-semibold" style={{ borderColor: "#dde5ef" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        title="Delete characterization dataset?"
        message="This permanently removes the experimental characterization record."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        busy={saving}
      />
    </ModuleShell>
  )
}
