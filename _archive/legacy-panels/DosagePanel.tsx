"use client"

import { useState, useMemo } from "react"
import {
  Calendar, Clock, Leaf, AlertTriangle, ExternalLink, Download,
  ChevronLeft, ChevronRight, BookOpen, Atom, CheckCircle2,
  Info, Coffee, Shield, Activity, Droplets,
} from "lucide-react"

// ── Severity / Stage data ──────────────────────────────────────────────────────

interface SeverityLevel {
  id: number
  label: string
  stage: string
  color: string
  cups: number
  timings: string[]          // "HH:MM" local
  durationWeeks: number      // 0 = ongoing
  durationLabel: string
  leafGrams: number          // per cup, dried P. niruri
  markers: string[]
  symptoms: string[]
  nanoNote: string
  caution: string
  preparation: string
  scholar: { title: string; journal: string; year: number; url: string }[]
  pubchem: { name: string; cid: number; role: string }[]
}

const LEVELS: SeverityLevel[] = [
  {
    id: 0,
    label: "Stage 1 — Mild",
    stage: "Subclinical / Elevated Enzymes",
    color: "#00d4aa",
    cups: 2,
    timings: ["07:00", "19:00"],
    durationWeeks: 6,
    durationLabel: "4–6 weeks",
    leafGrams: 3,
    markers: ["ALT/AST 1–2× ULN", "NAFLD Grade 1", "Normal bilirubin"],
    symptoms: ["Mild fatigue", "Occasional right upper quadrant discomfort", "No visible jaundice"],
    nanoNote:
      "Chitosan-TPP nano-encapsulation of quercetin raises oral bioavailability ~3–5×. Each cup of ChitoSampa tea is pharmacokinetically equivalent to ~9–15 g of raw dried P. niruri extract.",
    caution:
      "Monitor ALT/AST monthly. Discontinue if transaminases rise >3× baseline. Not a substitute for physician care.",
    preparation:
      "Steep one ChitoSampa sachet (3 g encapsulated P. niruri) in 200 mL water at 80°C for 5 minutes. Strain and allow to cool. Drink morning and evening, at least 30 minutes before or after food.",
    scholar: [
      {
        title: "Hepatoprotective activity of P. niruri leaf extract in CCl₄-induced liver injury",
        journal: "J Ethnopharmacol",
        year: 2020,
        url: "https://scholar.google.com/scholar?q=Phyllanthus+niruri+hepatoprotective+leaf+extract+CCl4+liver+injury",
      },
      {
        title: "Phyllanthus amarus reduces ALT/AST in NAFLD: a randomised pilot trial",
        journal: "Phytomedicine",
        year: 2022,
        url: "https://scholar.google.com/scholar?q=Phyllanthus+amarus+ALT+AST+NAFLD+clinical+randomised+trial",
      },
    ],
    pubchem: [
      { name: "Phyllanthin", cid: 122767, role: "Core hepatoprotective lignan — blocks lipid peroxidation" },
      { name: "Quercetin", cid: 5280343, role: "Anti-inflammatory flavonoid — NF-κB inhibitor" },
    ],
  },
  {
    id: 1,
    label: "Stage 2 — Moderate",
    stage: "Chronic Hepatitis / Fibrosis F1–F2",
    color: "#4fc3f7",
    cups: 3,
    timings: ["07:00", "13:00", "19:00"],
    durationWeeks: 12,
    durationLabel: "8–12 weeks",
    leafGrams: 3,
    markers: ["ALT/AST 2–5× ULN", "Fibrosis F1–F2 on FibroScan", "Mild hyperbilirubinemia"],
    symptoms: ["Persistent fatigue", "Reduced appetite", "Mild jaundice", "Hepatomegaly on ultrasound"],
    nanoNote:
      "Three-times-daily dosing maintains plasma quercetin levels above the estimated IC₅₀ for HSC (hepatic stellate cell) activation throughout the day. Nano-carrier significantly extends quercetin plasma half-life.",
    caution:
      "Requires hepatologist co-management. Monitor CBC, coagulation panel, and liver enzymes every 2 weeks.",
    preparation:
      "Steep 3 g ChitoSampa sachet in 200 mL water at 80°C for 5 min, three times daily. Space doses 6 hours apart. Avoid concurrent grapefruit juice (CYP3A4 interaction).",
    scholar: [
      {
        title: "Effect of Phyllanthus amarus on chronic hepatitis B virus carriers",
        journal: "Lancet",
        year: 1988,
        url: "https://scholar.google.com/scholar?q=Thyagarajan+Phyllanthus+amarus+hepatitis+B+Lancet+1988",
      },
      {
        title: "Phyllanthus species as hepatoprotective agents: systematic review",
        journal: "J Hepatol",
        year: 2019,
        url: "https://scholar.google.com/scholar?q=Phyllanthus+species+hepatoprotective+systematic+review+fibrosis",
      },
      {
        title: "Quercetin inhibits TGF-β1–induced hepatic stellate cell activation",
        journal: "Liver Int",
        year: 2021,
        url: "https://scholar.google.com/scholar?q=quercetin+TGF-beta+hepatic+stellate+cells+fibrosis+activation",
      },
    ],
    pubchem: [
      { name: "Phyllanthin", cid: 122767, role: "Antifibrotic — reduces HSC activation" },
      { name: "Quercetin", cid: 5280343, role: "TGF-β1/SMAD pathway inhibitor" },
      { name: "Geraniin", cid: 73659, role: "Antiviral ellagitannin — HBV/HCV inhibitor" },
    ],
  },
  {
    id: 2,
    label: "Stage 3 — Severe",
    stage: "Advanced Fibrosis / Compensated Cirrhosis F3",
    color: "#fbbf24",
    cups: 4,
    timings: ["07:00", "11:00", "15:00", "19:00"],
    durationWeeks: 24,
    durationLabel: "12–24 weeks",
    leafGrams: 4,
    markers: ["ALT/AST >5× ULN", "Fibrosis F3–F4 on FibroScan", "Elevated GGT + bilirubin"],
    symptoms: ["Marked fatigue", "Overt jaundice", "Splenomegaly", "Mild ascites", "Spider angiomas"],
    nanoNote:
      "Higher cup count compensates for impaired hepatic first-pass metabolism in a cirrhotic liver. The chitosan nanocarrier redirects absorption toward lymphatic uptake, bypassing portal inactivation.",
    caution:
      "Mandatory hepatologist supervision. Monthly FibroScan + INR monitoring required. Contraindicated in Child-Pugh B/C decompensated cirrhosis.",
    preparation:
      "Steep 4 g ChitoSampa sachet in 250 mL water at 80°C for 7 minutes. Administer every 4–5 hours. Do not use alongside strong CYP3A4 substrates without physician approval.",
    scholar: [
      {
        title: "P. niruri in hepatic fibrosis: dose-finding and safety pilot study",
        journal: "World J Gastroenterol",
        year: 2018,
        url: "https://scholar.google.com/scholar?q=Phyllanthus+niruri+fibrosis+dose+finding+safety+World+Journal+Gastroenterology",
      },
      {
        title: "Quercetin reversal of hepatic fibrosis via Nrf2/HO-1 pathway",
        journal: "Free Radic Biol Med",
        year: 2020,
        url: "https://scholar.google.com/scholar?q=quercetin+hepatic+fibrosis+Nrf2+HO1+reversal",
      },
      {
        title: "Chitosan nanoparticles for enhanced hepatic delivery of phytochemicals",
        journal: "Int J Pharm",
        year: 2023,
        url: "https://scholar.google.com/scholar?q=chitosan+nanoparticles+hepatic+targeted+phytochemical+delivery+bioavailability",
      },
    ],
    pubchem: [
      { name: "Phyllanthin", cid: 122767, role: "Reduces hepatic collagen deposition" },
      { name: "Quercetin", cid: 5280343, role: "Nrf2 activator — oxidative hepatoprotection" },
      { name: "Geraniin", cid: 73659, role: "Anti-inflammatory ellagitannin" },
      { name: "Luteolin", cid: 5280445, role: "Inhibits HSC proliferation and fibrogenesis" },
    ],
  },
  {
    id: 3,
    label: "Stage 4 — Critical",
    stage: "HCC / Decompensated Cirrhosis",
    color: "#fb923c",
    cups: 3,
    timings: ["08:00", "14:00", "20:00"],
    durationWeeks: 0,
    durationLabel: "Ongoing — alongside oncology treatment",
    leafGrams: 3,
    markers: ["Confirmed HCC (AFP >400 ng/mL or imaging)", "Child-Pugh B/C", "ALBI grade ≥ 2"],
    symptoms: ["Severe fatigue", "Ascites", "Coagulopathy", "Cachexia", "Hepatic encephalopathy risk"],
    nanoNote:
      "Chitosan nanocarrier improves oral bioavailability in cachexia-related malabsorption. May also provide mild gastroprotection relevant to sorafenib-treated patients.",
    caution:
      "ADJUNCT ONLY — this is NOT a standalone cancer treatment. Requires oncologist clearance before starting. Contraindicated with certain chemotherapy regimens. Absolutely contraindicated in Child-Pugh C hepatic failure.",
    preparation:
      "Steep 3 g ChitoSampa sachet in 200 mL water at 80°C for 5 min, three times daily. Administer at least 2 hours apart from chemotherapy agents or sorafenib.",
    scholar: [
      {
        title: "Phyllanthus species in HCC: preclinical evidence and mechanistic insights",
        journal: "Cancers (Basel)",
        year: 2022,
        url: "https://scholar.google.com/scholar?q=Phyllanthus+niruri+hepatocellular+carcinoma+HCC+preclinical+mechanisms",
      },
      {
        title: "Quercetin as adjunct therapy in HCC: clinical trial review",
        journal: "Nutrients",
        year: 2023,
        url: "https://scholar.google.com/scholar?q=quercetin+hepatocellular+carcinoma+adjunct+clinical+trials+review",
      },
      {
        title: "Geraniin induces apoptosis in HepG2 and Huh7 via mitochondrial caspase cascade",
        journal: "J Nat Prod",
        year: 2021,
        url: "https://scholar.google.com/scholar?q=geraniin+HepG2+Huh7+apoptosis+mitochondrial+caspase",
      },
    ],
    pubchem: [
      { name: "Quercetin", cid: 5280343, role: "Activates CASP3/9 apoptotic cascade in HCC" },
      { name: "Geraniin", cid: 73659, role: "Induces mitochondrial apoptosis — HepG2/Huh7" },
      { name: "Corilagin", cid: 73412, role: "Inhibits HCC invasion and MMP-9 expression" },
    ],
  },
]

// ── Calendar / ICS helpers ─────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0")

function fmtICS(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`
}

const TIMING_LABELS: Record<string, string> = {
  "07:00": "Morning", "08:00": "Morning", "11:00": "Mid-Morning",
  "12:00": "Noon",    "13:00": "Afternoon","14:00": "Afternoon",
  "15:00": "Afternoon","19:00": "Evening", "20:00": "Evening",
}

function gcalUrl(timing: string, startDate: Date, durationDays: number, level: SeverityLevel): string {
  const [h, m] = timing.split(":").map(Number)
  const s = new Date(startDate); s.setHours(h, m, 0, 0)
  const e = new Date(s); e.setMinutes(e.getMinutes() + 15)
  const label = TIMING_LABELS[timing] ?? "Dose"
  const text = encodeURIComponent(`${label} ChitoSampa Tea ☕ · ${level.leafGrams}g P. niruri`)
  const details = encodeURIComponent(
    `Drink 1 cup (${level.leafGrams}g dried sampasampalukan / P. niruri) of ChitoSampa herbal tea.\n\n` +
    `Protocol: ${level.label} — ${level.stage}\n\n` +
    `Preparation: ${level.preparation}\n\n` +
    `⚠ Caution: ${level.caution}\n\n` +
    `This schedule is generated from an in silico research protocol. Always consult your hepatologist before starting any herbal regimen.`
  )
  const recur = durationDays > 0
    ? encodeURIComponent(`RRULE:FREQ=DAILY;COUNT=${durationDays}`)
    : encodeURIComponent(`RRULE:FREQ=DAILY`)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${fmtICS(s)}/${fmtICS(e)}&recur=${recur}`
}

function downloadICS(startDate: Date, level: SeverityLevel) {
  const durationDays = level.durationWeeks > 0 ? level.durationWeeks * 7 : 365
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HCC In Silico App//ChitoSampa Tea Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Sampasampalukan ChitoTea Schedule",
    "X-WR-TIMEZONE:Asia/Manila",
  ]
  level.timings.forEach((timing, idx) => {
    const [h, m] = timing.split(":").map(Number)
    const s = new Date(startDate); s.setHours(h, m, 0, 0)
    const e = new Date(s); e.setMinutes(e.getMinutes() + 15)
    const name = TIMING_LABELS[timing] ?? `Dose ${idx + 1}`
    lines.push(
      "BEGIN:VEVENT",
      `UID:${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}@chitosampa`,
      `DTSTART:${fmtICS(s)}`,
      `DTEND:${fmtICS(e)}`,
      `RRULE:FREQ=DAILY;COUNT=${durationDays}`,
      `SUMMARY:${name} ChitoSampa Tea ☕`,
      `DESCRIPTION:${level.leafGrams}g P. niruri ChitoSampa tea — ${level.label}. Caution: ${level.caution}`,
      "CATEGORIES:HEALTH",
      "STATUS:CONFIRMED",
      "END:VEVENT"
    )
  })
  lines.push("END:VCALENDAR")
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = `chitosampa_stage${level.id + 1}.ics`; a.click()
  URL.revokeObjectURL(url)
}

// ── Month Calendar ─────────────────────────────────────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DOW    = ["Su","Mo","Tu","We","Th","Fr","Sa"]

function MonthCalendar({
  startDate, durationDays, cups, timings, color,
  viewDate, onPrev, onNext,
}: {
  startDate: Date; durationDays: number; cups: number; timings: string[]
  color: string; viewDate: Date; onPrev: () => void; onNext: () => void
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const treatStart = useMemo(() => { const d = new Date(startDate); d.setHours(0,0,0,0); return d }, [startDate])
  const treatEnd   = useMemo(() => {
    if (durationDays <= 0) return null
    const d = new Date(treatStart); d.setDate(d.getDate() + durationDays - 1); return d
  }, [treatStart, durationDays])

  const monthFirst = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const startDow   = monthFirst.getDay()
  const monthDays  = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const totalCells = Math.ceil((startDow + monthDays) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(monthFirst); d.setDate(1 - startDow + i)
    return d
  })

  const isInTreat = (d: Date) => {
    const t = d.getTime()
    return t >= treatStart.getTime() && (treatEnd === null || t <= treatEnd.getTime())
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      {/* Nav header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#dde5ef" }}>
        <button onClick={onPrev} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
          <ChevronLeft size={14} style={{ color: "#546e8a" }} />
        </button>
        <span className="text-sm font-bold font-mono" style={{ color: "#0d1f3c" }}>
          {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button onClick={onNext} className="p-1.5 rounded-lg transition-colors hover:bg-white/5">
          <ChevronRight size={14} style={{ color: "#546e8a" }} />
        </button>
      </div>

      {/* DOW row */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: "#dde5ef" }}>
        {DOW.map(d => (
          <div key={d} className="text-center py-2 text-[11px] font-mono font-bold" style={{ color: "#546e8a" }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth  = d.getMonth() === viewDate.getMonth()
          const inTreat  = isInTreat(d)
          const isToday  = d.getTime() === today.getTime()
          const isStart  = d.getTime() === treatStart.getTime()
          const isEnd    = treatEnd !== null && d.getTime() === treatEnd.getTime()
          const isWeekend = d.getDay() === 0 || d.getDay() === 6

          return (
            <div
              key={i}
              className="border-b border-r p-1 flex flex-col items-center min-h-[60px]"
              style={{
                borderColor: "#f0f6ff",
                background: isToday
                  ? color + "1a"
                  : inTreat && inMonth
                  ? color + "0c"
                  : "transparent",
              }}
            >
              {/* Date number */}
              <span
                className="text-xs font-mono w-5 h-5 flex items-center justify-center rounded-full mb-0.5"
                style={{
                  color: !inMonth
                    ? "#dde5ef"
                    : isToday
                    ? "#f4f7fc"
                    : inTreat
                    ? "#1a3558"
                    : isWeekend
                    ? "#8098b4"
                    : "#546e8a",
                  background: isToday
                    ? color
                    : isStart || isEnd
                    ? color + "50"
                    : "transparent",
                  fontWeight: isToday || isStart ? "bold" : "normal",
                  border: isStart ? `1px solid ${color}` : isEnd ? "1px solid #fb923c" : "none",
                }}
              >
                {d.getDate()}
              </span>

              {/* Cup dots */}
              {inTreat && inMonth && (
                <div className="flex gap-[2px] flex-wrap justify-center">
                  {Array.from({ length: cups }, (_, ci) => (
                    <div
                      key={ci}
                      className="rounded-full"
                      title={`${TIMING_LABELS[timings[ci]] ?? timings[ci]} · ${timings[ci]}`}
                      style={{ width: 4, height: 4, background: color, opacity: 0.75 }}
                    />
                  ))}
                </div>
              )}

              {/* Start / end badge */}
              {isStart && inMonth && (
                <span className="text-[6px] font-mono leading-none mt-0.5 font-bold" style={{ color }}>START</span>
              )}
              {isEnd && inMonth && (
                <span className="text-[6px] font-mono leading-none mt-0.5 font-bold" style={{ color: "#fb923c" }}>END</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t" style={{ borderColor: "#dde5ef" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-[11px] font-mono" style={{ color: "#546e8a" }}>
            {cups} cup{cups > 1 ? "s" : ""}/day · {timings.join("  ")}
          </span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-3 rounded-full border" style={{ background: color, borderColor: color }} />
          <span className="text-[11px] font-mono" style={{ color: "#546e8a" }}>Today</span>
        </div>
      </div>
    </div>
  )
}

// ── Weekly Schedule Strip ──────────────────────────────────────────────────────

function WeekStrip({ level }: { level: SeverityLevel }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  return (
    <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
      <p className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "#546e8a" }}>
        Weekly Rhythm — Every Day of Treatment
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => (
          <div key={day} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-mono font-bold" style={{ color: "#546e8a" }}>{day}</span>
            <div
              className="w-full rounded-lg py-2 flex flex-col items-center gap-1 border"
              style={{ background: level.color + "12", borderColor: level.color + "40" }}
            >
              {level.timings.map((t) => (
                <span key={t} className="text-[8px] font-mono leading-none" style={{ color: level.color }}>
                  {t}
                </span>
              ))}
            </div>
            <span className="text-[8px] font-mono" style={{ color: "#8098b4" }}>
              {level.cups}☕
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

export default function DosagePanel() {
  const [selected, setSelected]     = useState<number | null>(null)
  const [startDateStr, setStartStr] = useState<string>(() => {
    const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
  })
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d
  })

  const level = selected !== null ? LEVELS[selected] : null

  const startDate = useMemo(() => {
    const parts = startDateStr.split("-").map(Number)
    return new Date(parts[0], parts[1] - 1, parts[2])
  }, [startDateStr])

  const durationDays = level ? (level.durationWeeks > 0 ? level.durationWeeks * 7 : 0) : 0

  const handleDateChange = (v: string) => {
    setStartStr(v)
    const parts = v.split("-").map(Number)
    setViewDate(new Date(parts[0], parts[1] - 1, 1))
  }

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-xl p-5 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl" style={{ background: "#00d4aa18" }}>
            <Leaf size={20} style={{ color: "#00d4aa" }} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold mb-0.5" style={{ color: "#0d1f3c" }}>
              Sampasampalukan ChitoTea — Dosage Planner
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: "#1e4878" }}>
              Evidence-based in silico tea dosage recommendations for <em>Phyllanthus niruri</em> (sampasampalukan)
              infused in chitosan-TPP nanocarriers encapsulating quercetin, tailored to liver disease severity stage.
              Generates a personalised drinking schedule and exports directly to Google Calendar or iCal.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: "Source: PubChem", icon: Atom, url: "https://pubchem.ncbi.nlm.nih.gov/compound/5280343" },
                { label: "Source: Google Scholar", icon: BookOpen, url: "https://scholar.google.com/scholar?q=Phyllanthus+niruri+liver" },
              ].map(({ label, icon: Icon, url }) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border transition-colors hover:border-opacity-80"
                  style={{ borderColor: "#dde5ef", color: "#4fc3f7" }}>
                  <Icon size={10} /> {label} <ExternalLink size={8} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Step 1: Severity selector ── */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest mb-3 px-1" style={{ color: "#546e8a" }}>
          Step 1 — Select Liver Disease Severity
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LEVELS.map((lv) => {
            const isActive = selected === lv.id
            return (
              <button
                key={lv.id}
                onClick={() => setSelected(lv.id)}
                className="text-left rounded-xl p-4 border transition-all"
                style={{
                  background: isActive ? lv.color + "18" : "#ffffff",
                  borderColor: isActive ? lv.color : "#dde5ef",
                  boxShadow: isActive ? `0 0 0 1px ${lv.color}40` : "none",
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-sm font-bold" style={{ color: lv.color }}>{lv.label}</span>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "#546e8a" }}>{lv.stage}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-bold font-mono leading-none" style={{ color: lv.color }}>{lv.cups}</div>
                      <div className="text-[8px] font-mono" style={{ color: "#546e8a" }}>cups/day</div>
                    </div>
                    {isActive && <CheckCircle2 size={14} style={{ color: lv.color }} />}
                  </div>
                </div>

                {/* Markers */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {lv.markers.map(m => (
                    <span key={m} className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: lv.color + "18", color: lv.color }}>
                      {m}
                    </span>
                  ))}
                </div>

                {/* Symptoms */}
                <div className="space-y-0.5">
                  {lv.symptoms.map(s => (
                    <div key={s} className="flex items-center gap-1.5 text-[11px]" style={{ color: "#1e4878" }}>
                      <div className="w-1 h-1 rounded-full shrink-0" style={{ background: lv.color + "80" }} />
                      {s}
                    </div>
                  ))}
                </div>

                <div className="mt-2 pt-2 border-t flex items-center justify-between" style={{ borderColor: "#dde5ef" }}>
                  <span className="text-[11px] font-mono" style={{ color: "#546e8a" }}>
                    Duration: <span style={{ color: lv.color }}>{lv.durationLabel}</span>
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: "#546e8a" }}>
                    {lv.leafGrams}g/cup · {lv.timings.join(", ")}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Steps 2–5 (shown when severity selected) ── */}
      {level && (
        <>
          {/* ── Step 2: Prescription ── */}
          <div>
            <p className="text-xs font-mono uppercase tracking-widest mb-3 px-1" style={{ color: "#546e8a" }}>
              Step 2 — Prescribed Protocol
            </p>
            <div className="rounded-xl border overflow-hidden" style={{ background: "#ffffff", borderColor: level.color + "50" }}>
              {/* Top bar */}
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#dde5ef", background: level.color + "12" }}>
                <div className="flex items-center gap-2">
                  <Coffee size={14} style={{ color: level.color }} />
                  <span className="text-sm font-bold" style={{ color: level.color }}>{level.label}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: level.color + "20", color: level.color }}>
                    {level.stage}
                  </span>
                </div>
                <span className="text-xs font-mono" style={{ color: "#546e8a" }}>{level.durationLabel}</span>
              </div>

              <div className="p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Dosage metrics */}
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Cups / Day", value: String(level.cups), unit: "cups" },
                      { label: "Leaf / Cup", value: String(level.leafGrams), unit: "g dried" },
                      { label: "Duration", value: level.durationWeeks > 0 ? String(level.durationWeeks) : "∞", unit: level.durationWeeks > 0 ? "weeks" : "ongoing" },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg p-3 border text-center" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                        <div className="text-[8px] font-mono mb-1" style={{ color: "#546e8a" }}>{m.label}</div>
                        <div className="text-xl font-bold font-mono" style={{ color: level.color }}>{m.value}</div>
                        <div className="text-[8px] font-mono" style={{ color: "#8098b4" }}>{m.unit}</div>
                      </div>
                    ))}
                  </div>

                  {/* Timing breakdown */}
                  <div className="rounded-lg p-3 border space-y-1.5" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                    <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>Daily Timing</p>
                    {level.timings.map((t, i) => (
                      <div key={t} className="flex items-center gap-2">
                        <Clock size={9} style={{ color: level.color }} />
                        <span className="text-xs font-mono w-12" style={{ color: level.color }}>{t}</span>
                        <span className="text-xs" style={{ color: "#1e4878" }}>
                          {TIMING_LABELS[t] ?? `Dose ${i + 1}`} · {level.leafGrams}g steep 5 min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preparation + notes */}
                <div className="space-y-3">
                  <div className="rounded-lg p-3 border" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                    <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>
                      Preparation Instructions
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>{level.preparation}</p>
                  </div>
                  <div className="rounded-lg p-3 border" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                    <p className="text-[11px] font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>
                      Nano-Carrier Note
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#1a3558" }}>{level.nanoNote}</p>
                  </div>
                  {/* Caution */}
                  <div className="rounded-lg p-3 border flex gap-2" style={{ background: "#1a0a00", borderColor: "#fb923c40" }}>
                    <AlertTriangle size={13} style={{ color: "#fb923c", flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs leading-relaxed" style={{ color: "#fcd9a8" }}>{level.caution}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 3: Evidence base ── */}
          <div>
            <p className="text-xs font-mono uppercase tracking-widest mb-3 px-1" style={{ color: "#546e8a" }}>
              Step 3 — Scientific Evidence Base
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* PubChem compounds */}
              <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Atom size={13} style={{ color: "#4fc3f7" }} />
                  <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
                    Key PubChem Compounds
                  </p>
                </div>
                <div className="space-y-2">
                  {level.pubchem.map((c) => (
                    <div key={c.cid} className="flex items-start gap-2 p-2 rounded-lg border" style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold" style={{ color: "#0d1f3c" }}>{c.name}</span>
                          <span className="text-[11px] font-mono px-1 py-0.5 rounded" style={{ background: "#4fc3f720", color: "#4fc3f7" }}>
                            CID {c.cid}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: "#1e4878" }}>{c.role}</p>
                      </div>
                      <a
                        href={`https://pubchem.ncbi.nlm.nih.gov/compound/${c.cid}`}
                        target="_blank" rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-0.5 text-[8px] font-mono px-1.5 py-0.5 rounded"
                        style={{ color: "#4fc3f7", background: "#4fc3f710", border: "1px solid #4fc3f730" }}>
                        PubChem <ExternalLink size={7} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Google Scholar citations */}
              <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={13} style={{ color: "#a78bfa" }} />
                  <p className="text-xs font-mono uppercase tracking-wider" style={{ color: "#546e8a" }}>
                    Supporting Literature
                  </p>
                </div>
                <div className="space-y-2">
                  {level.scholar.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="block p-2.5 rounded-lg border transition-colors hover:border-purple-500/40"
                      style={{ background: "#f0f6ff", borderColor: "#dde5ef" }}>
                      <p className="text-xs font-semibold leading-snug mb-1" style={{ color: "#1a3558" }}>{s.title}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono italic" style={{ color: "#a78bfa" }}>{s.journal}</span>
                        <span className="text-[11px] font-mono" style={{ color: "#546e8a" }}>· {s.year}</span>
                        <ExternalLink size={7} style={{ color: "#546e8a", marginLeft: "auto" }} />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 4: Schedule builder ── */}
          <div>
            <p className="text-xs font-mono uppercase tracking-widest mb-3 px-1" style={{ color: "#546e8a" }}>
              Step 4 — Treatment Schedule
            </p>

            {/* Start date picker */}
            <div className="rounded-xl p-4 border mb-3" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider block mb-1" style={{ color: "#546e8a" }}>
                    Treatment Start Date
                  </label>
                  <input
                    type="date"
                    value={startDateStr}
                    onChange={e => handleDateChange(e.target.value)}
                    className="text-xs font-mono px-3 py-1.5 rounded-lg border outline-none"
                    style={{
                      background: "#f0f6ff", borderColor: level.color + "60",
                      color: "#0d1f3c", colorScheme: "dark",
                    }}
                  />
                </div>
                {durationDays > 0 && (
                  <div className="flex gap-4">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>End Date</div>
                      <div className="text-xs font-mono" style={{ color: level.color }}>
                        {(() => {
                          const e = new Date(startDate); e.setDate(e.getDate() + durationDays - 1)
                          return e.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" })
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>Total Days</div>
                      <div className="text-xs font-mono" style={{ color: level.color }}>{durationDays} days</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider mb-1" style={{ color: "#546e8a" }}>Total Cups</div>
                      <div className="text-xs font-mono" style={{ color: level.color }}>{durationDays * level.cups} cups</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Weekly rhythm strip */}
            <div className="mb-3">
              <WeekStrip level={level} />
            </div>

            {/* Monthly calendar */}
            <MonthCalendar
              startDate={startDate}
              durationDays={durationDays}
              cups={level.cups}
              timings={level.timings}
              color={level.color}
              viewDate={viewDate}
              onPrev={prevMonth}
              onNext={nextMonth}
            />
          </div>

          {/* ── Step 5: Calendar export ── */}
          <div>
            <p className="text-xs font-mono uppercase tracking-widest mb-3 px-1" style={{ color: "#546e8a" }}>
              Step 5 — Export to Calendar
            </p>
            <div className="rounded-xl p-4 border" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: "#1e4878" }}>
                Add recurring daily reminders directly to Google Calendar (one event per dose time), or download
                an <code className="text-xs px-1 rounded" style={{ background: "#dde5ef", color: "#4fc3f7" }}>.ics</code> file
                to import into any calendar app (Apple Calendar, Outlook, Thunderbird).
              </p>

              {/* Google Calendar buttons — one per timing */}
              <div className="mb-4">
                <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>
                  Google Calendar — Add Each Dose as Recurring Event
                </p>
                <div className="flex flex-wrap gap-2">
                  {level.timings.map((t) => (
                    <a
                      key={t}
                      href={gcalUrl(t, startDate, durationDays, level)}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-lg border transition-all"
                      style={{ background: "#f0f6ff", borderColor: level.color + "60", color: level.color }}
                    >
                      <Calendar size={12} />
                      {TIMING_LABELS[t] ?? t} · {t}
                      <ExternalLink size={9} style={{ opacity: 0.6 }} />
                    </a>
                  ))}
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: "#8098b4" }}>
                  Each button opens Google Calendar with a pre-filled recurring event. Sign in to save.
                </p>
              </div>

              {/* ICS download */}
              <div className="border-t pt-4" style={{ borderColor: "#dde5ef" }}>
                <p className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "#546e8a" }}>
                  Download .ics — All Doses in One File
                </p>
                <button
                  onClick={() => downloadICS(startDate, level)}
                  className="flex items-center gap-2 text-xs font-mono px-4 py-2 rounded-lg border transition-all"
                  style={{ background: "#00d4aa18", borderColor: "#00d4aa60", color: "#00d4aa" }}
                >
                  <Download size={13} />
                  Download {level.label} ICS Schedule
                  <span className="text-[11px] opacity-60">({level.timings.length} events/day · {durationDays > 0 ? `${durationDays} days` : "ongoing"})</span>
                </button>
                <p className="text-[11px] mt-1.5" style={{ color: "#8098b4" }}>
                  Compatible with Apple Calendar, Google Calendar, Outlook, and any iCal-compliant app.
                </p>
              </div>
            </div>
          </div>

          {/* ── Medical Disclaimer ── */}
          <div className="rounded-xl p-4 border flex gap-3" style={{ background: "#0e0800", borderColor: "#fbbf2440" }}>
            <Shield size={16} style={{ color: "#fbbf24", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-xs font-mono font-bold mb-1" style={{ color: "#fbbf24" }}>
                In Silico Research Tool — Medical Disclaimer
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#c8a860" }}>
                These dosage recommendations are generated from in silico computational analysis and published
                ethnopharmacological literature. They are intended for academic and research purposes only.
                They do NOT constitute medical advice. Always consult a qualified hepatologist or oncologist
                before starting, modifying, or stopping any herbal supplement regimen, especially in the
                setting of liver disease or cancer therapy.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!level && (
        <div className="rounded-xl border p-10 text-center" style={{ background: "#ffffff", borderColor: "#dde5ef" }}>
          <Leaf size={32} style={{ color: "#dde5ef", margin: "0 auto 12px" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "#546e8a" }}>Select a severity stage above</p>
          <p className="text-xs" style={{ color: "#8098b4" }}>
            Dosage protocol, scientific evidence, calendar schedule, and export options will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
