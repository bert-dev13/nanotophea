"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Atom,
  ChevronDown,
  ChevronUp,
  Cpu,
  Droplets,
  Edit3,
  FlaskConical,
  Layers,
  RotateCw,
  Save,
  Sliders,
  Sparkles,
  Sprout,
  X,
} from "lucide-react"
import { useAuth } from "@/components/providers/AuthProvider"
import { ChitosanTppInteractionSection } from "@/components/study/setup/ChitosanTppInteractionSection"
import { NanoparticleModalPortal } from "@/components/study/setup/NanoparticleModalPortal"
import type { NanoparticleFormulation } from "@/lib/domain/models"

interface NanoparticleFormulationWorkspaceProps {
  studyId: string
  onChangedAction?: () => void
}

type ModalType = "none" | "parameters" | "characterization"
type ViewTab = "interaction" | "formulation" | "characterization" | "all"

export function NanoparticleFormulationWorkspace({
  studyId,
  onChangedAction,
}: NanoparticleFormulationWorkspaceProps) {
  const { user } = useAuth()
  const canEdit = Boolean(user)

  const [activeTab, setActiveTab] = useState<ViewTab>("interaction")
  const [record, setRecord] = useState<NanoparticleFormulation | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<ModalType>("none")
  const [showFullParams, setShowFullParams] = useState(false)
  const [showFullChar, setShowFullChar] = useState(false)
  const [showLearnMore, setShowLearnMore] = useState(false)

  // Form state for Formulation Parameters
  const [formParams, setFormParams] = useState({
    recordType: "research" as "research" | "test_synthetic",
    systemName: "Chitosan–TPP Nanoparticle System",
    chitosanConcentration: "",
    chitosanConcentrationUnit: "mg/mL",
    chitosanMolecularWeight: "",
    chitosanMwUnit: "kDa",
    chitosanDeacetylationDegree: "",
    chitosanSolvent: "",
    chitosanPh: "",
    tppConcentration: "",
    tppConcentrationUnit: "mg/mL",
    tppPh: "",
    chitosanTppRatio: "",
    mixingMethod: "",
    additionMethod: "",
    stirringRate: "",
    stirringDuration: "",
    temperature: "",
    preparationNotes: "",
  })

  // Form state for Characterization
  const [formChar, setFormChar] = useState({
    recordType: "research" as "research" | "test_synthetic",
    particleSizeNm: "",
    pdi: "",
    zetaPotentialMv: "",
    encapsulationEfficiencyPercent: "",
    loadingCapacityPercent: "",
    instrument: "",
    measurementMethod: "",
    experimentDate: "",
    researcher: "",
    sampleBatchId: "",
    characterizationNotes: "",
  })

  const loadRecord = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/studies/${studyId}/nanoparticle`)
      if (!res.ok) throw new Error("Failed to load nanoparticle formulation record")
      const data = await res.json()
      if (data.record) {
        const r: NanoparticleFormulation = data.record
        setRecord(r)
        setFormParams({
          recordType: r.recordType || "research",
          systemName: r.systemName || "Chitosan–TPP Nanoparticle System",
          chitosanConcentration: r.chitosanConcentration || "",
          chitosanConcentrationUnit: r.chitosanConcentrationUnit || "mg/mL",
          chitosanMolecularWeight: r.chitosanMolecularWeight || "",
          chitosanMwUnit: r.chitosanMwUnit || "kDa",
          chitosanDeacetylationDegree: r.chitosanDeacetylationDegree || "",
          chitosanSolvent: r.chitosanSolvent || "",
          chitosanPh: r.chitosanPh || "",
          tppConcentration: r.tppConcentration || "",
          tppConcentrationUnit: r.tppConcentrationUnit || "mg/mL",
          tppPh: r.tppPh || "",
          chitosanTppRatio: r.chitosanTppRatio || "",
          mixingMethod: r.mixingMethod || "",
          additionMethod: r.additionMethod || "",
          stirringRate: r.stirringRate || "",
          stirringDuration: r.stirringDuration || "",
          temperature: r.temperature || "",
          preparationNotes: r.preparationNotes || "",
        })
        setFormChar({
          recordType: r.recordType || "research",
          particleSizeNm: r.particleSizeNm != null ? String(r.particleSizeNm) : "",
          pdi: r.pdi != null ? String(r.pdi) : "",
          zetaPotentialMv: r.zetaPotentialMv != null ? String(r.zetaPotentialMv) : "",
          encapsulationEfficiencyPercent: r.encapsulationEfficiencyPercent != null ? String(r.encapsulationEfficiencyPercent) : "",
          loadingCapacityPercent: r.loadingCapacityPercent != null ? String(r.loadingCapacityPercent) : "",
          instrument: r.instrument || "",
          measurementMethod: r.measurementMethod || "",
          experimentDate: r.experimentDate || "",
          researcher: r.researcher || "",
          sampleBatchId: r.sampleBatchId || "",
          characterizationNotes: r.characterizationNotes || "",
        })
      } else {
        setRecord(null)
      }
    } catch (err: any) {
      setError(err.message || "Error loading nanoparticle formulation")
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    void loadRecord()
  }, [loadRecord])

  const openParametersModal = () => {
    if (record) {
      setFormParams({
        recordType: record.recordType || "research",
        systemName: record.systemName || "Chitosan–TPP Nanoparticle System",
        chitosanConcentration: record.chitosanConcentration || "",
        chitosanConcentrationUnit: record.chitosanConcentrationUnit || "mg/mL",
        chitosanMolecularWeight: record.chitosanMolecularWeight || "",
        chitosanMwUnit: record.chitosanMwUnit || "kDa",
        chitosanDeacetylationDegree: record.chitosanDeacetylationDegree || "",
        chitosanSolvent: record.chitosanSolvent || "",
        chitosanPh: record.chitosanPh || "",
        tppConcentration: record.tppConcentration || "",
        tppConcentrationUnit: record.tppConcentrationUnit || "mg/mL",
        tppPh: record.tppPh || "",
        chitosanTppRatio: record.chitosanTppRatio || "",
        mixingMethod: record.mixingMethod || "",
        additionMethod: record.additionMethod || "",
        stirringRate: record.stirringRate || "",
        stirringDuration: record.stirringDuration || "",
        temperature: record.temperature || "",
        preparationNotes: record.preparationNotes || "",
      })
    }
    setActiveModal("parameters")
  }

  const openCharacterizationModal = () => {
    if (record) {
      setFormChar({
        recordType: record.recordType || "research",
        particleSizeNm: record.particleSizeNm != null ? String(record.particleSizeNm) : "",
        pdi: record.pdi != null ? String(record.pdi) : "",
        zetaPotentialMv: record.zetaPotentialMv != null ? String(record.zetaPotentialMv) : "",
        encapsulationEfficiencyPercent: record.encapsulationEfficiencyPercent != null ? String(record.encapsulationEfficiencyPercent) : "",
        loadingCapacityPercent: record.loadingCapacityPercent != null ? String(record.loadingCapacityPercent) : "",
        instrument: record.instrument || "",
        measurementMethod: record.measurementMethod || "",
        experimentDate: record.experimentDate || "",
        researcher: record.researcher || "",
        sampleBatchId: record.sampleBatchId || "",
        characterizationNotes: record.characterizationNotes || "",
      })
    }
    setActiveModal("characterization")
  }

  const handleSaveParameters = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      const payload = {
        systemName: formParams.systemName.trim() || "Chitosan–TPP Nanoparticle System",
        carrierType: "chitosan_tpp",
        recordType: formParams.recordType,
        chitosanConcentration: formParams.chitosanConcentration.trim() || null,
        chitosanConcentrationUnit: formParams.chitosanConcentrationUnit.trim() || "mg/mL",
        chitosanMolecularWeight: formParams.chitosanMolecularWeight.trim() || null,
        chitosanMwUnit: formParams.chitosanMwUnit.trim() || "kDa",
        chitosanDeacetylationDegree: formParams.chitosanDeacetylationDegree.trim() || null,
        chitosanSolvent: formParams.chitosanSolvent.trim() || null,
        chitosanPh: formParams.chitosanPh.trim() || null,
        tppConcentration: formParams.tppConcentration.trim() || null,
        tppConcentrationUnit: formParams.tppConcentrationUnit.trim() || "mg/mL",
        tppPh: formParams.tppPh.trim() || null,
        chitosanTppRatio: formParams.chitosanTppRatio.trim() || null,
        mixingMethod: formParams.mixingMethod.trim() || null,
        additionMethod: formParams.additionMethod.trim() || null,
        stirringRate: formParams.stirringRate.trim() || null,
        stirringDuration: formParams.stirringDuration.trim() || null,
        temperature: formParams.temperature.trim() || null,
        preparationNotes: formParams.preparationNotes.trim() || null,

        particleSizeNm: record?.particleSizeNm ?? null,
        pdi: record?.pdi ?? null,
        zetaPotentialMv: record?.zetaPotentialMv ?? null,
        encapsulationEfficiencyPercent: record?.encapsulationEfficiencyPercent ?? null,
        loadingCapacityPercent: record?.loadingCapacityPercent ?? null,
        instrument: record?.instrument ?? null,
        measurementMethod: record?.measurementMethod ?? null,
        experimentDate: record?.experimentDate ?? null,
        researcher: record?.researcher ?? null,
        sampleBatchId: record?.sampleBatchId ?? null,
        characterizationNotes: record?.characterizationNotes ?? null,

        computationalStatus: record?.computationalStatus || "not_configured",
        provenance: {
          evidenceClass: formParams.recordType === "test_synthetic" ? "TEST" : "REFERENCE",
          source: formParams.recordType === "test_synthetic" ? "Synthetic software validation" : "Study formulation protocol",
          recordedAt: new Date().toISOString(),
        },
      }

      const res = await fetch(`/api/studies/${studyId}/nanoparticle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to save formulation parameters")
      const result = await res.json()
      setRecord(result.record)
      setActiveModal("none")
      onChangedAction?.()
    } catch (err: any) {
      setError(err.message || "Failed to save parameters")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCharacterization = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)

      const payload = {
        systemName: record?.systemName || "Chitosan–TPP Nanoparticle System",
        carrierType: "chitosan_tpp",
        recordType: formChar.recordType,

        chitosanConcentration: record?.chitosanConcentration ?? null,
        chitosanConcentrationUnit: record?.chitosanConcentrationUnit ?? "mg/mL",
        chitosanMolecularWeight: record?.chitosanMolecularWeight ?? null,
        chitosanMwUnit: record?.chitosanMwUnit ?? "kDa",
        chitosanDeacetylationDegree: record?.chitosanDeacetylationDegree ?? null,
        chitosanSolvent: record?.chitosanSolvent ?? null,
        chitosanPh: record?.chitosanPh ?? null,
        tppConcentration: record?.tppConcentration ?? null,
        tppConcentrationUnit: record?.tppConcentrationUnit ?? "mg/mL",
        tppPh: record?.tppPh ?? null,
        chitosanTppRatio: record?.chitosanTppRatio ?? null,
        mixingMethod: record?.mixingMethod ?? null,
        additionMethod: record?.additionMethod ?? null,
        stirringRate: record?.stirringRate ?? null,
        stirringDuration: record?.stirringDuration ?? null,
        temperature: record?.temperature ?? null,
        preparationNotes: record?.preparationNotes ?? null,

        particleSizeNm: formChar.particleSizeNm.trim() !== "" ? parseFloat(formChar.particleSizeNm) : null,
        pdi: formChar.pdi.trim() !== "" ? parseFloat(formChar.pdi) : null,
        zetaPotentialMv: formChar.zetaPotentialMv.trim() !== "" ? parseFloat(formChar.zetaPotentialMv) : null,
        encapsulationEfficiencyPercent: formChar.encapsulationEfficiencyPercent.trim() !== "" ? parseFloat(formChar.encapsulationEfficiencyPercent) : null,
        loadingCapacityPercent: formChar.loadingCapacityPercent.trim() !== "" ? parseFloat(formChar.loadingCapacityPercent) : null,
        instrument: formChar.instrument.trim() || null,
        measurementMethod: formChar.measurementMethod.trim() || null,
        experimentDate: formChar.experimentDate.trim() || null,
        researcher: formChar.researcher.trim() || null,
        sampleBatchId: formChar.sampleBatchId.trim() || null,
        characterizationNotes: formChar.characterizationNotes.trim() || null,

        computationalStatus: record?.computationalStatus || "not_configured",
        provenance: {
          evidenceClass: formChar.recordType === "test_synthetic" ? "TEST" : "EXPERIMENTAL",
          source: formChar.recordType === "test_synthetic" ? "Synthetic software validation" : "Experimental characterization",
          recordedAt: new Date().toISOString(),
        },
      }

      const res = await fetch(`/api/studies/${studyId}/nanoparticle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to save characterization measurements")
      const result = await res.json()
      setRecord(result.record)
      setActiveModal("none")
      onChangedAction?.()
    } catch (err: any) {
      setError(err.message || "Failed to save characterization")
    } finally {
      setSaving(false)
    }
  }

  const hasFormulationParams = Boolean(
    record && (
      record.chitosanConcentration ||
      record.chitosanMolecularWeight ||
      record.chitosanPh ||
      record.tppConcentration ||
      record.chitosanTppRatio ||
      record.stirringRate ||
      record.preparationNotes
    )
  )

  const hasCharacterization = Boolean(
    record && (
      record.particleSizeNm != null ||
      record.pdi != null ||
      record.zetaPotentialMv != null ||
      record.encapsulationEfficiencyPercent != null ||
      record.loadingCapacityPercent != null ||
      record.instrument ||
      record.measurementMethod
    )
  )

  const isTestData = record?.recordType === "test_synthetic"
  const notRecorded = "Not recorded"

  return (
    <div className="space-y-6">
      {/* 1. Header & Segmented Tab Navigation */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                04 · Nanoparticle Formulation
              </span>
              {isTestData ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  TEST DATA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                  {hasCharacterization ? "EVIDENCE: EXPERIMENTAL" : "EVIDENCE: REFERENCE / PROTOCOL"}
                </span>
              )}
            </div>
            <h2 className="font-display text-xl font-bold tracking-tight text-slate-100">
              Chitosan–TPP Nanoparticle
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed mt-0.5">
              Nanoparticle carrier system used for the HepatoTea formulation. Documents the ionic crosslinking interaction between polycationic chitosan and polyanionic tripolyphosphate (TPP).
            </p>
          </div>

          {/* Quick action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={openParametersModal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  {hasFormulationParams ? "Edit Parameters" : "Record Parameters"}
                </button>
                <button
                  type="button"
                  onClick={openCharacterizationModal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3.5 py-1.5 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
                >
                  <Activity className="h-3.5 w-3.5" />
                  {hasCharacterization ? "Edit Characterization" : "Record Characterization"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Test Data Banner Notice */}
        {isTestData && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-300 uppercase tracking-wide text-[11px] block">
                TEST DATA
              </strong>
              <p className="mt-0.5 text-amber-200/90 leading-relaxed">
                Software validation record. Not included in scientific evidence synthesis.
              </p>
            </div>
          </div>
        )}

        {/* Compact Segmented Sub-views (Requirement 1 & 15) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("interaction")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "interaction"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Chitosan–TPP Interaction
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("formulation")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "formulation"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Formulation Protocol
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("characterization")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "characterization"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Experimental Characterization
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "all"
                ? "bg-slate-800 text-slate-200 border border-slate-700 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Full Overview
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* TAB A: CHITOSAN–TPP INTERACTION WORKSPACE (Client Feature) */}
      {/* ========================================================= */}
      {(activeTab === "interaction" || activeTab === "all") && (
        <ChitosanTppInteractionSection record={record} />
      )}

      {/* ========================================================= */}
      {/* TAB B: FORMULATION PROTOCOL & PATHWAY                     */}
      {/* ========================================================= */}
      {(activeTab === "formulation" || activeTab === "all") && (
        <div className="space-y-6">
          {/* Formulation Pathway */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                HepatoTea Formulation Pathway
              </span>
              <span className="text-[10.5px] text-slate-500">
                Botanical Extract & Colloidal Nanocarrier Matrix
              </span>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 flex-1 w-full md:w-auto">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                  <Sprout className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Plant Material</p>
                  <p className="font-medium text-slate-200 text-xs">Phyllanthus niruri</p>
                </div>
              </div>

              <span className="text-slate-600 font-bold hidden md:inline">→</span>

              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 flex-1 w-full md:w-auto">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                  <Droplets className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Bioactive Extract</p>
                  <p className="font-medium text-slate-200 text-xs">Tea Extract (Quercetin)</p>
                </div>
              </div>

              <span className="text-slate-600 font-bold hidden md:inline">→</span>

              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3.5 py-2.5 flex-1 w-full md:w-auto">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-900/60 border border-emerald-400/40 text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Nanocarrier Matrix</p>
                  <p className="font-medium text-emerald-200 text-xs">Chitosan–TPP Matrix</p>
                </div>
              </div>

              <span className="text-slate-600 font-bold hidden md:inline">→</span>

              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 flex-1 w-full md:w-auto">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 border border-slate-700 text-slate-200">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Final Product</p>
                  <p className="font-medium text-slate-200 text-xs">HepatoTea</p>
                </div>
              </div>
            </div>

            <p className="mt-2.5 text-[10.5px] text-slate-400 italic">
              * Encapsulation efficiency and loading capacity are displayed only when experimentally measured.
            </p>
          </div>

          {/* Recorded Formulation Parameters */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-400" />
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Recorded Formulation Parameters
                </h3>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10.5px] text-slate-400">
                  {record?.systemName || "Chitosan–TPP Nanoparticle System"}
                </span>
              </div>

              {hasFormulationParams && canEdit && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFullParams(!showFullParams)}
                    className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-medium"
                  >
                    {showFullParams ? (
                      <>
                        Hide Details <ChevronUp className="h-3 w-3" />
                      </>
                    ) : (
                      <>
                        View Details <ChevronDown className="h-3 w-3" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={openParametersModal}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 rounded border border-emerald-500/20 bg-emerald-500/10"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {!hasFormulationParams ? (
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-6 text-center space-y-2">
                <p className="text-xs text-slate-400">No formulation parameters recorded.</p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={openParametersModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Record Parameters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                    <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide block mb-1">
                      Chitosan
                    </span>
                    <p className="text-sm font-semibold text-slate-200 font-mono">
                      {record?.chitosanConcentration ? `${record.chitosanConcentration} ${record.chitosanConcentrationUnit || "mg/mL"}` : notRecorded}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      pH {record?.chitosanPh || notRecorded}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                    <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide block mb-1">
                      TPP
                    </span>
                    <p className="text-sm font-semibold text-slate-200 font-mono">
                      {record?.tppConcentration ? `${record.tppConcentration} ${record.tppConcentrationUnit || "mg/mL"}` : notRecorded}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      pH {record?.tppPh || notRecorded}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                    <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wide block mb-1">
                      Ratio
                    </span>
                    <p className="text-sm font-semibold text-slate-200 font-mono">
                      {record?.chitosanTppRatio ? `Ratio ${record.chitosanTppRatio}` : notRecorded}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chitosan:TPP mass
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide block mb-1">
                      Formation
                    </span>
                    <p className="text-sm font-medium text-slate-200 font-mono truncate">
                      {[record?.stirringRate, record?.stirringDuration, record?.temperature].filter(Boolean).join(" · ") || notRecorded}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {record?.mixingMethod || "Ionic gelation"}
                    </p>
                  </div>
                </div>

                {showFullParams && (
                  <div className="pt-3 border-t border-slate-800/80 text-xs space-y-2.5 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-2.5 space-y-1">
                        <span className="text-[11px] text-slate-400 block font-medium">Molecular Weight:</span>
                        <span className="text-slate-200 font-medium">
                          {record?.chitosanMolecularWeight ? `${record.chitosanMolecularWeight} ${record.chitosanMwUnit || "kDa"}` : notRecorded}
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-2.5 space-y-1">
                        <span className="text-[11px] text-slate-400 block font-medium">Degree of Deacetylation:</span>
                        <span className="text-slate-200 font-medium">{record?.chitosanDeacetylationDegree || notRecorded}</span>
                      </div>
                      <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-2.5 space-y-1">
                        <span className="text-[11px] text-slate-400 block font-medium">Solvent System:</span>
                        <span className="text-slate-200 font-medium">{record?.chitosanSolvent || notRecorded}</span>
                      </div>
                    </div>

                    {record?.preparationNotes && (
                      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs text-slate-300">
                        <span className="font-semibold text-slate-200">Preparation Notes: </span>
                        {record.preparationNotes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB C: EXPERIMENTAL CHARACTERIZATION                      */}
      {/* ========================================================= */}
      {(activeTab === "characterization" || activeTab === "all") && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Experimental Characterization
              </h3>
              {isTestData ? (
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-300 border border-amber-500/20">
                  TEST DATA
                </span>
              ) : hasCharacterization ? (
                <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-purple-300 border border-purple-500/20">
                  EVIDENCE: EXPERIMENTAL
                </span>
              ) : null}
            </div>

            {hasCharacterization && canEdit && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullChar(!showFullChar)}
                  className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 font-medium"
                >
                  {showFullChar ? (
                    <>
                      Hide Record <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      View Full Record <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={openCharacterizationModal}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium px-2 py-1 rounded border border-purple-500/20 bg-purple-500/10"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {!hasCharacterization ? (
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-6 text-center space-y-2">
              <p className="text-xs text-slate-400">No experimental characterization recorded.</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={openCharacterizationModal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3.5 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/20"
                >
                  <Activity className="h-3.5 w-3.5" /> Record Characterization
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Particle Size</span>
                  <span className="text-base font-bold text-slate-100 font-mono">
                    {record?.particleSizeNm != null ? `${record.particleSizeNm} nm` : notRecorded}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">PDI</span>
                  <span className="text-base font-bold text-slate-100 font-mono">
                    {record?.pdi != null ? record.pdi : notRecorded}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Zeta Potential</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {record?.zetaPotentialMv != null ? `${record.zetaPotentialMv > 0 ? "+" : ""}${record.zetaPotentialMv} mV` : notRecorded}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Encapsulation Efficiency</span>
                  <span className="text-base font-bold text-slate-100 font-mono">
                    {record?.encapsulationEfficiencyPercent != null ? `${record.encapsulationEfficiencyPercent}%` : notRecorded}
                  </span>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-center">
                  <span className="text-[11px] text-slate-400 block mb-1">Loading Capacity</span>
                  <span className="text-base font-bold text-slate-100 font-mono">
                    {record?.loadingCapacityPercent != null ? `${record.loadingCapacityPercent}%` : notRecorded}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-slate-400 px-1 pt-1">
                <div>
                  <span className="text-slate-500 font-medium">Method: </span>
                  <span className="text-slate-300 font-medium">{record?.measurementMethod || "DLS"}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Instrument: </span>
                  <span className="text-slate-300 font-medium">{record?.instrument || "Malvern Zetasizer Nano ZS"}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Sample ID: </span>
                  <span className="text-slate-300 font-mono">{record?.sampleBatchId || "NP-HT-01"}</span>
                </div>
              </div>

              {showFullChar && (
                <div className="pt-3 border-t border-slate-800/80 text-xs space-y-2 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-2.5">
                      <span className="text-[11px] text-slate-400 block font-medium">Experiment Date:</span>
                      <span className="text-slate-200">{record?.experimentDate || notRecorded}</span>
                    </div>
                    <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-2.5">
                      <span className="text-[11px] text-slate-400 block font-medium">Researcher:</span>
                      <span className="text-slate-200">{record?.researcher || notRecorded}</span>
                    </div>
                  </div>
                  {record?.characterizationNotes && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs text-slate-300">
                      <span className="font-semibold text-slate-200">Notes: </span>
                      {record.characterizationNotes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: RECORD FORMULATION PARAMETERS                    */}
      {/* ========================================================= */}
      {activeModal === "parameters" && (
        <NanoparticleModalPortal
          isOpen={activeModal === "parameters"}
          onClose={() => setActiveModal("none")}
          ariaLabel="Record Formulation Parameters"
          cardClassName="border-emerald-500/40"
        >
          <div className="flex items-center justify-between border-b border-slate-800 p-5 shrink-0">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-400" />
                Record Formulation Parameters
              </h3>
              <p className="text-xs text-slate-400">
                Document the chitosan and TPP preparation protocol. Empty fields display as &quot;Not recorded&quot;.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal("none")}
              className="text-slate-400 hover:text-slate-200 p-1 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSaveParameters} className="flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Record Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormParams({ ...formParams, recordType: "research" })}
                    className={`rounded-lg p-2.5 text-xs text-left transition-colors border ${
                      formParams.recordType === "research"
                        ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-200 font-semibold"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="block font-medium">[ Research Data ]</span>
                    <span className="text-[10.5px] opacity-80 block mt-0.5">
                      Genuine experimental and protocol evidence
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormParams({ ...formParams, recordType: "test_synthetic" })}
                    className={`rounded-lg p-2.5 text-xs text-left transition-colors border ${
                      formParams.recordType === "test_synthetic"
                        ? "border-amber-500/60 bg-amber-950/40 text-amber-200 font-semibold"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="block font-medium">[ Test / Synthetic Data ]</span>
                    <span className="text-[10.5px] opacity-80 block mt-0.5">
                      Software validation only; excluded from evidence
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Chitosan Carrier
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Concentration
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. 0.5"
                        value={formParams.chitosanConcentration}
                        onChange={(e) => setFormParams({ ...formParams, chitosanConcentration: e.target.value })}
                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Unit (mg/mL)"
                        value={formParams.chitosanConcentrationUnit}
                        onChange={(e) => setFormParams({ ...formParams, chitosanConcentrationUnit: e.target.value })}
                        className="w-24 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Molecular Weight
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Low MW (50-190)"
                        value={formParams.chitosanMolecularWeight}
                        onChange={(e) => setFormParams({ ...formParams, chitosanMolecularWeight: e.target.value })}
                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Unit (kDa)"
                        value={formParams.chitosanMwUnit}
                        onChange={(e) => setFormParams({ ...formParams, chitosanMwUnit: e.target.value })}
                        className="w-24 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Degree of Deacetylation (%)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 85%"
                      value={formParams.chitosanDeacetylationDegree}
                      onChange={(e) => setFormParams({ ...formParams, chitosanDeacetylationDegree: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Solvent
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1% Acetic acid"
                      value={formParams.chitosanSolvent}
                      onChange={(e) => setFormParams({ ...formParams, chitosanSolvent: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Solution pH
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 4.8"
                      value={formParams.chitosanPh}
                      onChange={(e) => setFormParams({ ...formParams, chitosanPh: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-800 pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Tripolyphosphate (TPP)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Concentration
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. 0.25"
                        value={formParams.tppConcentration}
                        onChange={(e) => setFormParams({ ...formParams, tppConcentration: e.target.value })}
                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Unit (mg/mL)"
                        value={formParams.tppConcentrationUnit}
                        onChange={(e) => setFormParams({ ...formParams, tppConcentrationUnit: e.target.value })}
                        className="w-24 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Solution pH
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 7.4"
                      value={formParams.tppPh}
                      onChange={(e) => setFormParams({ ...formParams, tppPh: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-800 pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  Formation Conditions
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Chitosan:TPP Ratio
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2:1"
                      value={formParams.chitosanTppRatio}
                      onChange={(e) => setFormParams({ ...formParams, chitosanTppRatio: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Mixing Method
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dropwise ionic gelation"
                      value={formParams.mixingMethod}
                      onChange={(e) => setFormParams({ ...formParams, mixingMethod: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Addition Method
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Continuous titration"
                      value={formParams.additionMethod}
                      onChange={(e) => setFormParams({ ...formParams, additionMethod: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Stirring Rate (rpm)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 700"
                      value={formParams.stirringRate}
                      onChange={(e) => setFormParams({ ...formParams, stirringRate: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Stirring Duration (min)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 30"
                      value={formParams.stirringDuration}
                      onChange={(e) => setFormParams({ ...formParams, stirringDuration: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Temperature (°C)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 25"
                      value={formParams.temperature}
                      onChange={(e) => setFormParams({ ...formParams, temperature: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Preparation Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details regarding addition speed, needle gauge, equilibration, etc..."
                    value={formParams.preparationNotes}
                    onChange={(e) => setFormParams({ ...formParams, preparationNotes: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 p-4 bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> Save Parameters
                  </>
                )}
              </button>
            </div>
          </form>
        </NanoparticleModalPortal>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: RECORD EXPERIMENTAL CHARACTERIZATION             */}
      {/* ========================================================= */}
      {activeModal === "characterization" && (
        <NanoparticleModalPortal
          isOpen={activeModal === "characterization"}
          onClose={() => setActiveModal("none")}
          ariaLabel="Record Experimental Characterization"
          cardClassName="border-purple-500/40"
        >
          <div className="flex items-center justify-between border-b border-slate-800 p-5 shrink-0">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-400" />
                Record Experimental Characterization
              </h3>
              <p className="text-xs text-slate-400">
                Enter physical measurements from wet-lab instruments (DLS, zeta potential).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal("none")}
              className="text-slate-400 hover:text-slate-200 p-1 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSaveCharacterization} className="flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Record Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormChar({ ...formChar, recordType: "research" })}
                    className={`rounded-lg p-2.5 text-xs text-left transition-colors border ${
                      formChar.recordType === "research"
                        ? "border-purple-500/60 bg-purple-950/40 text-purple-200 font-semibold"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="block font-medium">[ Research Data ]</span>
                    <span className="text-[10.5px] opacity-80 block mt-0.5">
                      Genuine experimental laboratory evidence
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormChar({ ...formChar, recordType: "test_synthetic" })}
                    className={`rounded-lg p-2.5 text-xs text-left transition-colors border ${
                      formChar.recordType === "test_synthetic"
                        ? "border-amber-500/60 bg-amber-950/40 text-amber-200 font-semibold"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="block font-medium">[ Test / Synthetic Data ]</span>
                    <span className="text-[10.5px] opacity-80 block mt-0.5">
                      Software validation only; excluded from evidence
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                  Colloidal Measurements
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Mean Particle Size (nm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 185.4"
                      value={formChar.particleSizeNm}
                      onChange={(e) => setFormChar({ ...formChar, particleSizeNm: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      PDI
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 0.22"
                      value={formChar.pdi}
                      onChange={(e) => setFormChar({ ...formChar, pdi: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Zeta Potential (mV)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 32.8"
                      value={formChar.zetaPotentialMv}
                      onChange={(e) => setFormChar({ ...formChar, zetaPotentialMv: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Encapsulation Efficiency (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 74.2"
                      value={formChar.encapsulationEfficiencyPercent}
                      onChange={(e) => setFormChar({ ...formChar, encapsulationEfficiencyPercent: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Loading Capacity (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 18.5"
                      value={formChar.loadingCapacityPercent}
                      onChange={(e) => setFormChar({ ...formChar, loadingCapacityPercent: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-800 pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Instrumentation & Experiment Metadata
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Instrument
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Malvern Zetasizer Nano ZS"
                      value={formChar.instrument}
                      onChange={(e) => setFormChar({ ...formChar, instrument: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Measurement Method
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DLS (Dynamic Light Scattering)"
                      value={formChar.measurementMethod}
                      onChange={(e) => setFormChar({ ...formChar, measurementMethod: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Experiment Date
                    </label>
                    <input
                      type="date"
                      value={formChar.experimentDate}
                      onChange={(e) => setFormChar({ ...formChar, experimentDate: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Researcher
                    </label>
                    <input
                      type="text"
                      placeholder="Researcher or Analyst name"
                      value={formChar.researcher}
                      onChange={(e) => setFormChar({ ...formChar, researcher: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Sample / Batch ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BATCH-NP-001"
                      value={formChar.sampleBatchId}
                      onChange={(e) => setFormChar({ ...formChar, sampleBatchId: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Refractive index, viscosity, temperature or sample dispersion notes..."
                    value={formChar.characterizationNotes}
                    onChange={(e) => setFormChar({ ...formChar, characterizationNotes: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 p-4 bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModal("none")}
                className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> Save Characterization
                  </>
                )}
              </button>
            </div>
          </form>
        </NanoparticleModalPortal>
      )}
    </div>
  )
}
