# CURRENT SYSTEM AUDIT — NANOTOPHEA / NanoHepatoTea

**Audit type:** Read-only inspection (no application code modified)  
**Date:** 2026-09-29  
**Sources compared:**

1. Current Next.js codebase under `c:\github` (active `app/`, `components/`, `data/`, `lib/`, `types/`)
2. Research manuscript: `RESEARCH PAPER.pdf`
3. Redevelopment plan: `NANOTOPHEA_Final_Redevelopment_Plan.md`

**Scope note:** `_vite_legacy/` and `.next/` are treated as non-active / build artifacts. `VirtualLabPanel.tsx` is present in the active tree but **not imported by any route**.

---

## Evidence Classification Legend

| Code | Meaning (per Final Redevelopment Plan) |
|------|----------------------------------------|
| `REFERENCE` | Scientific metadata (CID, SMILES, PDB ID, formula, etc.) |
| `LITERATURE` | Value attributed to a cited publication / trusted external source |
| `PREDICTED` | Output of a documented predictive model (method identifiable) |
| `SIMULATION` | Exploratory math (e.g. Hill curve) without validated prediction methodology |
| `EXPERIMENTAL` | Actual wet-lab measurement entered or imported |
| `UNKNOWN` | Origin not stated; cannot verify |
| `UNSUPPORTED` | Not supported by manuscript methodology / scientifically inappropriate for this SIP platform |

---

## 0. System Snapshot

| Aspect | Current state |
|--------|---------------|
| Stack | Next.js 15, React 19, TypeScript, Tailwind 4, Recharts, lucide-react |
| Backend / DB / Auth | **None** (no `app/api`, no Firebase, no persistence beyond React memory) |
| Navigation | Flat 15-tab bar (`data/tabs.ts`) |
| Scientific data | Almost entirely hardcoded TS modules + client-side simulators |
| Real external fetches | PubChem SDF / RCSB PDB text for **3D visualization only** (`lib/mol3d.tsx`) |
| Real AutoDock Vina | **Not integrated** |
| Real ADMET / SwissADME | **Not integrated** (labels claim it) |
| Experimental result entry | **Not implemented** |
| Evidence badges | **Not implemented** |

---

## 1. Master Audit Table

| Module/Feature | Current Implementation | Data Source | Evidence Type | Paper Support | Problems | Recommended Action | Source Files |
|----------------|------------------------|-------------|---------------|---------------|----------|--------------------|--------------|
| Overview / Home | Branding, module grid, Nano mascot tips; claims “AI confidence,” SwissADME, CNN | Hardcoded copy | `UNSUPPORTED` (claims) / UI shell reusable | Partial — paper wants web app overview of Phase 1 | Presents platform as multi-assay analyzer with CNN/AI scoring; no phase workflow; no prediction vs lab split | `REFACTOR` | `app/page.tsx`, `components/panels/OverviewPanel.tsx` |
| Cell Lines | 11 lines (8 HCC + 3 normal) with IC₅₀, SI, dose–response charts | Hardcoded `CELL_LINES` + client `makeDose` Hill curves | IC₅₀ etc.: `UNKNOWN` / `SIMULATION`; identity fields: `REFERENCE`-like (unverified) | Partial — HepG2 is primary experimental focus; multi-line panel exceeds wet-lab scope | IC₅₀/apoptosis/ROS/BAX/YAP shown as facts; generated viability curves; units µM not paper µg/mL for formulation | `REFACTOR` | `app/cell-lines/page.tsx`, `components/panels/CellLinePanel.tsx`, `data/celllines.ts` |
| Proteins | 12 targets with ΔG, Ki, RMSD, confidence, fold-change, interactions | Hardcoded `PROTEINS` | Docking metrics: `UNKNOWN`; fold-change: `UNKNOWN`/`SIMULATION`; PDB/gene: `REFERENCE`-like | Yes for target catalog / docking context | Quercetin docking baked into protein identity; fold-changes look experimental; AI confidence unexplained | `REFACTOR` | `app/proteins/page.tsx`, `components/panels/ProteinPanel.tsx`, `data/proteins.ts` |
| Phytochemicals | 14 compounds; descriptors; 3D via PubChem CID; “SwissADME” section | Hardcoded `PHYTOCHEMICALS`; 3D from PubChem | Descriptors: `UNKNOWN` (claimed SwissADME); CID/SMILES: `REFERENCE`-like; activity/potency narrative: `UNSUPPORTED`/`UNKNOWN` | Yes — catalog phytochemicals | Claims SwissADME without live/imported SwissADME; descriptions assert nano bioavailability / IC₅₀ as fact | `REFACTOR` | `app/phytochemicals/page.tsx`, `components/panels/PhytochemicalsPanel.tsx`, `data/compounds.ts` |
| ADMET module | **Absent** as dedicated feature; only marketing claims | N/A | N/A | **Required** by paper (SwissADME) and Final Plan §8 | Missing workspace; false UI claims of SwissADME computation | `REPLACE` (add real/import ADMET) | Claims in `OverviewPanel.tsx`, `LoadingScreen.tsx`, `PhytochemicalsPanel.tsx`, `AppFooter.tsx` |
| Docking Lab | Select compound × protein; matrix ΔG/Ki/interactions; 3D viewer | `DOCKING_MATRIX` in `compounds.ts`; energy parts use `Math.random()` | `UNKNOWN` base ΔG; energy decomposition: `SIMULATION`/`UNSUPPORTED`; confidence: `UNSUPPORTED` | Yes — docking is core Phase 1 | Not real Vina; random vdw/elec/hbond/solv; duplicates AutoDock page | `REPLACE` | `app/docking-lab/page.tsx`, `components/panels/DockingLabPanel.tsx`, `data/compounds.ts` |
| AutoDock Vina page | Quercetin vs 6 receptors; ConfidenceBar; 3D | `DOCKING_TARGETS` in `assay-tables.ts` | Same as above | Yes for Vina concept | UI implies Vina ran; no vina binary/logs; AI confidence fake; overlaps Docking Lab | `REPLACE` (merge + real Vina import/run) | `app/docking/page.tsx`, `components/panels/DockingPanel.tsx`, `data/assay-tables.ts` |
| 3D molecular viewer | Loads SDF/PDB into 3Dmol iframe; overlays hardcoded ΔG labels | PubChem / RCSB fetch + hardcoded score overlay | Structure display: `REFERENCE` (live fetch); ΔG overlay: `UNKNOWN` | Yes as visualization aid | Does not prove docking occurred | `RETAIN` (viewer) / `REFACTOR` (decouple fake scores) | `lib/mol3d.tsx` |
| DPPH (static + interactive) | Dashboard metrics + OS protein binding + “Run Your Own” Hill simulator | Hardcoded `DPPH_IC50`/`TEAC`/OS binding; Hill + `seededRand` | Hardcoded IC₅₀: `UNKNOWN`; runs: `SIMULATION`; OS ΔG: `UNKNOWN` | Yes — in-silico DPPH (µM) **and** experimental DPPH (µg/mL T1–T6) | No experimental T1–T6 entry; UI reads like completed assay; OS ΔG hardcoded; DFT/BDE numbers claimed without computation | `REFACTOR` (prediction) + `REPLACE` (add experimental module) | `app/dpph/page.tsx`, `components/panels/DPPHPanel.tsx` |
| MTT panel + AssayLab | Static HepG2 table + interactive Hill simulator | `MTT_TABLE`; `AssayLabSection` Hill + noise | Static: `UNKNOWN`/`SIMULATION`; runs: `SIMULATION` | In-silico MTT yes; **paper: no experimental MTT** | Presented as assay without PREDICTED label; µM grid vs paper in-silico µg/mL (50–500) | `REFACTOR` | `app/mtt/page.tsx`, `components/panels/MTTPanel.tsx`, `components/panels/AssayLabSection.tsx`, `data/assay-tables.ts` |
| LDH panel + AssayLab | Static µM reference charts + AssayLab LDH mode | Hardcoded `LDH_REF` / cell-line IC₅₀s; Hill sim | `UNKNOWN`/`SIMULATION` | In-silico LDH yes; **experimental LDH = REQUIRES CONFIRMATION** (paper inconsistent) | Wrong experimental units/conc; no T1–T6 replicate entry; looks experimental | `REFACTOR` (prediction) + `VERIFY` then experimental module | `app/ldh/page.tsx`, `components/panels/LDHPanel.tsx`, `AssayLabSection.tsx` |
| ROS panel + AssayLab | Static fold/enzyme cards + simulator | `ROS_TABLE`/`ROS_ENZYME`; AssayLab formulas | `UNKNOWN`/`SIMULATION` | In-silico ROS yes; paper: no experimental ROS | Badge/language experimental; µM doses | `REFACTOR` | `app/ros/page.tsx`, `components/panels/ROSPanel.tsx`, `AssayLabSection.tsx`, `data/assay-tables.ts` |
| BAX panel + AssayLab | Static fold-change + Annexin/PI quadrants + simulator | `BAX_TABLE` + hardcoded quadrants; AssayLab | `UNKNOWN`/`SIMULATION` | In-silico BAX yes; paper: no experimental BAX | Badge “Flow Cytometry”; presents quadrants as measured | `REFACTOR` | `app/bax/page.tsx`, `components/panels/BAXPanel.tsx`, `AssayLabSection.tsx` |
| Hippo–YAP panel + AssayLab | Static biomarkers + cascade + simulator | `YAP_TABLE` + hardcoded %; AssayLab | `UNKNOWN`/`SIMULATION` | In-silico Hippo–YAP yes; paper: no experimental Hippo–YAP | Badge “Western Blot · qRT-PCR”; claims Vina “confirms” | `REFACTOR` | `app/yap/page.tsx`, `components/panels/YAPPanel.tsx`, `AssayLabSection.tsx` |
| AssayLab engine | Shared “virtual experiment” for mtt/ros/yap/bax/ldh/dpph | Client Hill equation + LCG noise + hardcoded factors | `SIMULATION` (not validated `PREDICTED`) | Partial — paper wants predictive models, not theatrical virtual lab | Saved as if assay results; no model version/provenance; wrong default doses | `REPLACE` (honest Prediction Engine) | `components/panels/AssayLabSection.tsx` |
| VirtualLabPanel | Older duplicate virtual lab (~1534 lines) | Same pattern as AssayLab | `SIMULATION` | N/A (dead code) | Unused duplicate; confusion risk | `REMOVE` | `components/panels/VirtualLabPanel.tsx` |
| Results Record | Lists in-memory saved AssayLab/DPPH runs | React `ResultsProvider` state | Saved sims: `SIMULATION` | Paper needs registry of computational **and** experimental results | No persistence; no evidence class; no lab datasets | `REPLACE` | `app/results/page.tsx`, `components/panels/ResultsPanel.tsx`, `lib/results-context.tsx` |
| Interpreter | Expandable canned sections concluding efficacy | Hardcoded `INTERPRETER_SECTIONS` | `UNSUPPORTED` as “results”; educational text mixed with claims | Paper needs researcher interpretation after analysis | Treats sims as confirmed; AI confidence explained as if real; static conclusions | `REPLACE` | `app/interpreter/page.tsx`, `components/panels/ResearchInterpreterPanel.tsx`, `data/interpreter.ts` |
| Dosage Planner | Clinical stage 1–4 tea dosing → calendar export | Hardcoded `LEVELS` clinical protocols | `UNSUPPORTED` | **Not** a SIP hypothesis/methods deliverable; Final Plan §21 remove | Clinical decision-support without clinical trial evidence | `REMOVE` | `app/dosage/page.tsx`, `components/panels/DosagePanel.tsx` |
| Formulation module | **Absent** (tea composition only mentioned in copy/Dosage) | N/A | N/A | Required (2 g leaf + 1 g Chitosan–TPP) | Missing Knowledge Base formulation page | `REPLACE` (add) | — |
| Experimental DPPH entry | **Absent** | N/A | N/A | Required (T1–T6, 50–500 µg/mL, ascorbic acid, ANOVA) | Cannot store/compare real lab DPPH | `REPLACE` (add) | — |
| Experimental LDH entry | **Absent** | N/A | N/A | **REQUIRES CONFIRMATION** | Cannot implement until LDH experimental status resolved | `VERIFY` then add/omit | — |
| HPLC / proximate / nutritive / Pb / stability | **Absent** | N/A | N/A | Required Phase 2 characterization | Missing lab characterization modules | `REPLACE` (add) | — |
| Statistics (ANOVA / Scheffé) | **Absent** | N/A | N/A | Required for experimental DPPH (± LDH if confirmed) | No stats service | `REPLACE` (add) | — |
| Prediction vs Experimental | **Absent** | N/A | N/A | Core Final Plan + SIP sequential design | No comparison workflow | `REPLACE` (add) | — |
| Reports / Exports | Limited client CSV-ish patterns only in places; no research PDF pack | N/A | N/A | Needed for SIP tables | Missing structured exports | `REPLACE` (add) | — |
| AI / CNN confidence | Displayed 78–94% bars and copy | Hardcoded integers | `UNSUPPORTED` | Paper mentions CNN docking engines, but **no model is implemented** | Fabricated confidence; Overview claims CNN | `REMOVE` until real model exists | `data/proteins.ts`, `assay-tables.ts`, `compounds.ts`, `DockingPanel.tsx`, `ConfidenceBar.tsx`, `OverviewPanel.tsx`, `interpreter.ts` |
| `Math.random` scientific values | Docking energy decomposition; UI seed/id; animation delay | Runtime random | `UNSUPPORTED` / non-scientific | None | Non-reproducible “physics” components | `REMOVE` | `data/compounds.ts` (`entry()`), minor UI uses elsewhere |
| `_vite_legacy` | Full old Vite app duplicate | Legacy copy | N/A | N/A | Drift / confusion | `REMOVE` from active project | `_vite_legacy/` |

---

## 2. Hardcoded Scientific Data

Values embedded as constants (not entered by user, not loaded from lab files, not produced by Vina/ADMET APIs):

### 2.1 Compound / docking catalog — `data/compounds.ts`

| Data | Notes | Class |
|------|-------|-------|
| 14 phytochemicals: CID, SMILES, MW, LogP, HBD/HBA, TPSA, rotatable bonds | Claimed physicochemical; no provenance/citation fields | `UNKNOWN` (claimed REFERENCE/SwissADME) |
| Activity tags, potency, narrative descriptions | Includes nano bioavailability / HCC claims | `UNKNOWN` / `UNSUPPORTED` |
| `DOCKING_MATRIX` ΔG, RMSD, confidence, H-bonds, poses for 14×12 pairs | Comment: “AutoDock Vina simulation + literature extrapolation” — **no logs** | `UNKNOWN` |
| `vdw`, `elec`, `hbond_e`, `solv` | Computed with `Math.random()` each module load | `UNSUPPORTED` |
| Ki from ΔG via `exp(dg/RT)*1e6` | Deterministic transform of hardcoded ΔG | Derived `UNKNOWN` |

### 2.2 Proteins — `data/proteins.ts`

| Data | Class |
|------|-------|
| PDB IDs, gene, pathway, role text | `REFERENCE`-like (unverified) |
| bindingScore, ki, rmsd, confidence, interaction distances | `UNKNOWN` |
| effect, foldChange (e.g. YAP 0.31, BAX 3.24) | `UNKNOWN` / looks experimental |

### 2.3 Cell lines — `data/celllines.ts`

| Data | Class |
|------|-------|
| Identity (name, p53, HBV, morphology) | `REFERENCE`-like (unverified) |
| ic50, ic50Free, maxInhibition, SI, apoptosis, rosInduction, baxRatio, yapSuppression | `UNKNOWN` |
| viability/absorbance arrays | Client Hill `SIMULATION` from those IC₅₀s |

### 2.4 Assay tables — `data/assay-tables.ts`

| Table | Example values | Class |
|-------|----------------|-------|
| `MTT_TABLE` | viability at 0–200 µM | `UNKNOWN`/`SIMULATION` |
| `ROS_TABLE` / `ROS_DUAL` / `ROS_ENZYME` | 3.41× ROS, SOD +118% | `UNKNOWN` |
| `YAP_TABLE` / `BAX_TABLE` | fold-changes | `UNKNOWN` |
| `DOCKING_TARGETS` | −8.4 kcal/mol, 94% confidence | `UNKNOWN`/`UNSUPPORTED` (confidence) |
| `RADAR_DATA` | cytotoxicity 88, etc. | `UNKNOWN` |

### 2.5 DPPH constants — `components/panels/DPPHPanel.tsx`

| Data | Class |
|------|-------|
| `DPPH_IC50`, `DPPH_TEAC`, `DPPH_SMAX`, `DPPH_HILL_N` per compound | `UNKNOWN` |
| `DPPH_CONTROLS` (ascorbic, Trolox, etc.) | `UNKNOWN` / possibly literature-like but uncited |
| `OS_PROTEINS[].binding` ΔG pairs | `UNKNOWN` |
| BDE / IP / mechanism narrative numbers in UI copy | `UNKNOWN`/`UNSUPPORTED` as computed DFT |

### 2.6 LDH static reference — `LDHPanel.tsx`

| Data | Class |
|------|-------|
| `LDH_REF` µM series; Triton max A₄₉₀ 2.21 | `UNKNOWN` |
| `CELL_LINE_LDH` IC₅₀ map | `UNKNOWN` |

### 2.7 Interpreter — `data/interpreter.ts`

Entire narrative with numeric claims (IC₅₀ 19.84 µM, SI 4.2, AI 94%, etc.) — class: **`UNSUPPORTED` as research results** (static UI prose).

### 2.8 Dosage Planner — `DosagePanel.tsx`

Stage-based cups/day, ALT/AST staging, calendar ICS — class: **`UNSUPPORTED`**.

---

## 3. Simulated / Generated Results

### 3.1 Hill-equation + noise engines

| Location | Mechanism | Output class |
|----------|-----------|--------------|
| `AssayLabSection.tsx` | `hillViability`, `COMPOUND_FACTORS`, `TIME_FACTORS`, `seededRand` ±5.5% noise | `SIMULATION` |
| `DPPHPanel.tsx` | Hill %RSA from hardcoded IC₅₀ + noise | `SIMULATION` |
| `data/celllines.ts` `makeDose` | 4PL-like viability from IC₅₀ | `SIMULATION` |
| `VirtualLabPanel.tsx` | Duplicate of AssayLab pattern (unused) | `SIMULATION` |

**Final Plan rule:** These must **not** be labeled `PREDICTED` unless a documented scientific prediction method (with model identity/version) exists. Today they are theatrical / exploratory simulations.

### 3.2 Pathway/marker synthesis inside AssayLab

When assay = `yap` / `bax` / `ros` / `ldh`, markers are algebraically derived from dose/IC₅₀ ratios + noise (not wet-lab, not trained ML). Class: **`SIMULATION`**.

### 3.3 Random scientific pollution

```text
data/compounds.ts → entry():
  vdw, hbond_e, elec, solv each include Math.random()
```

Class: **`UNSUPPORTED`**. Non-reproducible and not Vina output.

### 3.4 Results Record content

Anything saved via `saveResult` is a snapshot of a simulation run. There is **zero** `EXPERIMENTAL` data path.

---

## 4. Unsupported Scientific Claims

| Claim (as presented in UI) | Why unsupported | Where |
|----------------------------|-----------------|-------|
| “AutoDock Vina” results with affinities | No Vina execution or imported logs | Docking pages, proteins, interpreter |
| “AI confidence” / CNN scoring | No CNN/model; hardcoded % | Overview, Docking, ConfidenceBar, interpreter, YAP text |
| “SwissADME” computed properties | No SwissADME call/import | Phytochemicals, LoadingScreen, Footer |
| MTT/ROS/BAX/YAP panels as assay/flow/WB results | Paper: no experimental MTT/ROS/BAX/Hippo–YAP | Panel badges + Interpretation components |
| Interpreter “Overall Conclusion” of demonstrated multi-assay efficacy | Collapses sims into proven outcomes | `interpreter.ts` conclusion section |
| Dosage Planner clinical staging protocols | Outside SIP design; not clinically validated here | `DosagePanel.tsx` |
| Nano encapsulation improves bioavailability 3.8× / IC₅₀ drops as fact | Asserted without linked experimental study record in-app | compounds descriptions, interpreter |
| Annexin V/PI quadrant percentages as measured | Simulated/hardcoded | `BAXPanel.tsx` |
| “AI-assisted pathway analysis” after virtual runs | Marketing language over Hill sims | VirtualLab / AssayLab copy |

---

## 5. Research Paper vs System Mismatches

| Paper / Plan expectation | Current system | Severity |
|--------------------------|----------------|----------|
| Sequential Phase 1 (in silico) → Phase 2 (lab) → analysis | Flat tabs; no phases; sims look like lab | Critical |
| Explicit prediction vs experiment separation | Collapsed | Critical |
| Experimental DPPH at **50, 100, 250, 500 µg/mL** (T1–T6) | DPPH sim at **0–100 µM** compound grid; no lab entry | Critical |
| Experimental LDH at **50–500 µg/mL** **OR** none (paper inconsistent) | LDH shown as µM “assay” with no lab entry | Critical — **REQUIRES CONFIRMATION** |
| In-silico MTT/ROS/BAX/YAP only | UI badges imply wet methods | High |
| SwissADME / ADMET | Claims only | High |
| AutoDock Vina (+ optional CNN if real) | Hardcoded matrix + fake confidence | High |
| HPLC, proximate, nutritive, Pb, sensory, microbial | Missing | High |
| ANOVA + Scheffé on experimental means | Missing | High |
| Web app compiles PubChem/PDB/ADMET with provenance | Partial static catalogs; no provenance model | Medium |
| Formulation as research object (2 g : 1 g tea bag) | Buried in Dosage/copy; no Formulation module | Medium |
| Researcher interpretation of linked evidence | Static Interpreter conclusions | High |
| Final Plan: remove Dosage Planner | Still present as nav item | High |
| Final Plan: Firebase + evidence types | Not started | Expected at audit stage |

### Experimental LDH inconsistency (flagged)

Manuscript contains **both**:

1. Phase 1 wording: *“No experimental LDH assay was/will be conducted.”*
2. Phase 2 procedures, Tables 1–2, RQs 14–17, null/alternative hypotheses, Results ANOVA shells: **experimental LDH on HepG2** at 50–500 µg/mL with Triton X-100 max lysis.

**Audit classification:** `REQUIRES CONFIRMATION` — do **not** invent which is correct. Final Redevelopment Plan §23 Phase 0 item 2 and LDH section require researcher/adviser resolution before building Experimental LDH.

---

## 6. Unit / Concentration Mismatches

| Context | Paper design | Current app | Match? |
|---------|--------------|-------------|--------|
| Experimental DPPH | 50, 100, 250, 500 **µg/mL** (+ controls) | Simulator **µM** (0, 3.13…100); no experimental grid | No |
| Experimental LDH | 50, 100, 250, 500 **µg/mL** | Static/sim **µM** (0…200); AssayLab default `[0,6.25,…,200]` | No |
| In-silico DPPH (paper) | 0, 3.13–100 **µM** | DPPH panel uses same µM grid | **Partial match** (good for in-silico DPPH only) |
| In-silico MTT/LDH/ROS (paper) | 50–500 **µg/mL** formulation | Mostly **µM** compound-style grids | No |
| Absorbance wavelengths | DPPH 517 nm; LDH 490 nm; MTT 570 nm (in silico) | Charts often match labels, but data are synthetic | Labels OK; data not experimental |
| Cell-line IC₅₀ display | Wet-lab focus HepG2 | 11 lines with µM IC₅₀ as if measured | Scope/units mismatch |

---

## 7. Duplicate Features

| Duplicate set | Detail | Action |
|---------------|--------|--------|
| `/docking-lab` vs `/docking` | Two UIs over same class of hardcoded docking numbers | Merge → one Molecular Docking |
| `AssayLabSection` vs `VirtualLabPanel` | Same Hill/noise concept; VirtualLab unused | Remove VirtualLab |
| Protein docking fields vs `DOCKING_MATRIX` vs `DOCKING_TARGETS` | Triple storage of “ΔG/confidence” | Single docking-run source |
| Static assay panels vs AssayLab generated curves | Two presentations of invented numbers | One Prediction Engine + optional demo datasets tagged |
| Next app vs `_vite_legacy` | Full historical duplicate | Archive/remove from active tree |
| SavedResult type in `types/index.ts` and `AssayLabSection.tsx` | Duplicated type definitions | Unify later during refactor |

---

## 8. Missing Research Requirements

Required by manuscript and/or Final Redevelopment Plan but **not present**:

1. Study entity / Study Home with phase progress  
2. Evidence classification on all scientific values  
3. Formulation Knowledge Base module  
4. ADMET workspace with real/imported SwissADME (or RDKit) data  
5. Real AutoDock Vina **import** (MVP) and/or worker run  
6. Prediction modules honestly labeled (`SIMULATION` or documented `PREDICTED`)  
7. Experimental DPPH replicate entry (T1–T6 × R1–R3)  
8. Experimental LDH entry — **only if confirmed**  
9. Characterization: HPLC, proximate, nutritive, Pb, sensory, microbial  
10. Statistics: means, ANOVA, Scheffé  
11. Prediction vs experimental comparison views  
12. Interpretation notebook linked to evidence IDs  
13. Research report/export pack  
14. Persistence (Firestore/Firebase per Final Plan)  
15. Auth / study ownership  
16. Audit log / provenance fields  

---

## 9. Features Worth Retaining

| Asset | Why retain | Caveat |
|-------|------------|--------|
| Next.js App Router + TypeScript + Tailwind | Matches Final Plan stack | Rebuild IA |
| Recharts patterns | Useful for dose–response / bar charts | Retag evidence |
| `lib/mol3d.tsx` PubChem/PDB 3D viewer | Real structure fetch | Remove fake ΔG as proof |
| Phytochemical catalog **shape** (CID, SMILES, descriptors fields) | Good Knowledge Base skeleton | Strip unsupported narratives; add provenance |
| Protein catalog **identity fields** (gene, PDB, pathway) | Useful | Remove embedded docking/fold-change “facts” |
| Cell-line identity cards | Useful reference | Demote IC₅₀ to literature/predicted/unknown with tags; HepG2-first |
| Interactive config UX (compound, concentrations, replicates, controls) | Good interaction pattern for prediction/lab entry | Relabel; fix units |
| DPPH µM grid (0–100) | Aligns with paper **in-silico** DPPH range | Keep only under Prediction; separate Experimental µg/mL |
| Nav item metadata structure | Can map to new sidebar | Replace flat bar |

Do **not** retain incorrect numbers merely because UI is polished (Final Plan §22).

---

## 10. Questions Requiring Researcher / Adviser Confirmation

Mark: **`REQUIRES CONFIRMATION`**

1. **Is experimental LDH part of the final SIP protocol?** (Paper Phase 1 vs Phase 2 conflict.)  
2. If yes: confirm treatments T1–T6, Triton X-100 positive control, HepG2-only, units µg/mL, n=3.  
3. Confirm experimental DPPH is mandatory and uses 50/100/250/500 µg/mL with ascorbic acid positive control.  
4. Confirm MTT, ROS, BAX, Hippo–YAP remain **computational-only** (paper text says no experimental for these).  
5. Which docking affinities (if any) are from **actual Vina runs** already performed offline vs invented for the demo UI?  
6. Which phytochemical descriptor values are from SwissADME exports vs manually typed?  
7. Are any cell-line IC₅₀ values from literature citations that can be attached, or purely illustrative?  
8. Will CNN-based docking be pursued with a real model, or should all CNN/AI confidence language be deleted?  
9. Should multi–cell-line predicted profiles remain as optional literature/simulation context, or HepG2-only?  
10. Are HPLC / proximate / nutritive / Pb / sensory / microbial results expected to be entered into the app, or documented only in the paper?  
11. Confirm tea bag formulation 2 g dried leaf + 1 g Chitosan–TPP as the canonical Formulation record.  
12. Confirm Dosage Planner is out of scope for the research platform (Final Plan says remove).

---

## 11. Priority Issues Before Redevelopment

Ordered for Phase 0 (no app coding required yet):

| Priority | Issue | Why blocking |
|----------|-------|--------------|
| P0 | Resolve experimental LDH yes/no | Controls Laboratory Results scope and comparison modules |
| P0 | Freeze treatment lists + units (µg/mL vs µM) per module | Prevents rebuilding wrong grids |
| P0 | Inventory classification of every hardcoded number (this audit starts it; researcher must tag LITERATURE vs invented) | Avoid promoting demo numbers into Firestore as truth |
| P0 | Ban/quarantine AI confidence, random docking energies, Dosage Planner | Scientific integrity |
| P1 | Decide Simulation vs documented Predicted models for MTT/LDH/ROS/BAX/YAP/DPPH engines | Naming and UI badges |
| P1 | Confirm Vina import-first MVP vs live Vina | Docking architecture |
| P1 | Confirm which characterization assays are in-app | Lab module set |
| P2 | Approve Final Plan navigation IA | Implementation sequencing |
| P2 | Approve Firebase as backend (per Final Plan) | Foundation phase |

---

## 12. Module Deep-Dive Notes (selected)

### DPPH

- **Does:** Antioxidant dashboard + oxidative-stress protein cards + interactive Hill simulator + save to Results.  
- **Paper:** In-silico µM DPPH **and** experimental µg/mL DPPH.  
- **Gap:** Experimental half missing; claims overstate certainty.  
- **Action:** Split Prediction vs Experimental; keep µM simulator only as `SIMULATION` or documented model.

### MTT

- **Does:** Static HepG2 curve + AssayLab.  
- **Paper:** In-silico only; no experimental MTT.  
- **Gap:** Looks like lab assay; concentrations not paper’s 50–500 µg/mL.  
- **Action:** Rename/relabel Prediction; fix units after contract.

### LDH

- **Does:** Static µM cytotoxicity + AssayLab LDH mode.  
- **Paper:** In-silico LDH **and** possibly experimental LDH (`REQUIRES CONFIRMATION`).  
- **Gap:** No experimental entry; units wrong for experimental design.  
- **Action:** `VERIFY` protocol; then refactor prediction; add experimental only if approved.

### ROS / BAX / Hippo–YAP

- **Does:** Static “result” UIs + AssayLab pathway synthesis.  
- **Paper:** Computational-only; explicitly no experimental counterparts.  
- **Gap:** Wet-lab method badges (flow, WB, qPCR).  
- **Action:** `REFACTOR` to Prediction workspace tabs; strip experimental implication.

### Docking Lab / AutoDock Vina

- **Does:** Browse hardcoded affinities; show 3D structures; fake confidence.  
- **Paper:** Real Vina (+ CNN only if real).  
- **Gap:** No Vina; random energy parts; duplicate pages.  
- **Action:** `REPLACE` with import/run pipeline; `REMOVE` confidence until real.

### Results / Interpreter / Dosage

- Results: memory-only sim dumps → `REPLACE` dual registry.  
- Interpreter: canned conclusions → `REPLACE` researcher notebook.  
- Dosage: clinical planner → `REMOVE`; Formulation page replaces research-relevant content.

---

## 13. Phase 0 Readiness Summary

**Ready for `STUDY_DESIGN_CONTRACT.md` drafting?**  
**Not yet — several confirmations are mandatory first.**

Before creating `STUDY_DESIGN_CONTRACT.md`, the researcher/adviser must confirm:

1. **Experimental LDH status** (include or exclude) — manuscript conflict.  
2. **Final module lists:** prediction-only vs experimental vs characterization.  
3. **Units and concentration grids** for every assay/prediction type.  
4. **Provenance of existing numeric demo data** — which values may be cited as LITERATURE vs must be discarded as UNKNOWN/demo.  
5. **Docking strategy:** offline Vina import vs live Vina; CNN in or out.  
6. **Explicit removal list approval:** Dosage Planner, AI confidence, random docking energies, duplicate docking routes, VirtualLabPanel, `_vite_legacy`.  
7. **Backend choice confirmation** (Final Plan specifies Firebase) if contract will bind implementation.

This audit (`docs/CURRENT_SYSTEM_AUDIT.md`) satisfies Phase 0 roadmap item **“Inventory all hardcoded scientific values”** at the system level. It does **not** replace researcher tagging of each individual constant as LITERATURE vs invented.

**Recommended next artifact after confirmations:**  
`docs/STUDY_DESIGN_CONTRACT.md` — binding rules for evidence types, module scopes, units, and LDH decision.

---

## 14. Audit Constraints Honored

- No application code was modified, deleted, refactored, or generated.  
- Missing scientific facts were not invented.  
- Manuscript inconsistencies were marked `REQUIRES CONFIRMATION`.  
- Simulated Hill engines were classified as `SIMULATION`, not `PREDICTED`, per Final Redevelopment Plan §2.

---

*End of audit.*
