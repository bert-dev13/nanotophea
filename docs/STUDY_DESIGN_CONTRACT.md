# STUDY DESIGN CONTRACT

**Project:** NANOTOPHEA / NanoHepatoTea Bioinformatics Research Platform  
**Document type:** Binding scientific source of truth for redevelopment  
**Status:** Confirmed by researchers (Step 2 — Scientific Alignment)  
**Date locked:** 2026-09-29  
**Supersedes conflicting wording** in the manuscript Phase 1 text that stated “no experimental LDH,” where that wording contradicts RQs 14–17, Phase 2 methods, and this contract.  
**Companion documents:**

- `NANOTOPHEA_Final_Redevelopment_Plan.md` — architecture & delivery plan  
- `docs/CURRENT_SYSTEM_AUDIT.md` — audit of the current prototype  

**Rule:** If implementation conflicts with this contract, **this contract wins** until researchers amend it in writing.

---

## 1. Purpose

This contract defines:

1. Which modules are computational vs laboratory  
2. Evidence classification for every scientific value  
3. Units, concentrations, controls, and replicates  
4. Provenance requirements  
5. Claims the system must never make  

It does **not** authorize inventing missing scientific numbers, fabricating docking/ADMET results, or presenting simulations as experimental findings.

---

## 2. Core Scientific Principle

```text
Computational predictions support hypotheses.
Laboratory results test them.
Researcher interpretation explains both.
```

The platform must keep these layers visually and structurally separate at all times.

Persistent UI statement (required on Study Home / Dashboard):

> Computational outputs do not constitute experimental proof.

---

## 3. Evidence Classification (mandatory)

Every stored or displayed scientific value **must** carry exactly one primary evidence class:

| Class | Meaning | May appear in UI as “result”? | Notes |
|-------|---------|-------------------------------|-------|
| `REFERENCE` | Identifiers / catalog metadata (PubChem CID, SMILES, PDB ID, gene symbol, molecular formula, etc.) | Yes, as metadata | Must include source when known |
| `LITERATURE` | Value taken from a cited publication or trusted database record | Yes, clearly labeled Literature | Requires citation (DOI/PMID/URL + retrieved date when applicable) |
| `PREDICTED` | Output of a **documented** computational method (Vina, SwissADME/RDKit, named QSAR/ML, documented mechanistic model) | Yes, labeled Predicted | Requires method name, version, inputs, date, assumptions |
| `EXPERIMENTAL` | Value from actual laboratory testing or uploaded lab reports | Yes, labeled Experimental | Requires lab name, date, protocol ref, raw replicates when applicable |
| `INTERPRETATION` | Human-authored analysis / conclusion | Yes, labeled Interpretation | Must link to evidence IDs; never auto-promoted to Experimental |

### Restricted transitional class

| Class | Meaning | Allowed? |
|-------|---------|----------|
| `SIMULATION` | Exploratory math (e.g. undocumented Hill curves) with **no** validated predictive model identity | Allowed **only** if labeled `SIMULATION` / “Exploratory simulation,” never as Predicted, Experimental, or “assay result.” Prefer retiring undisclosed sims in favor of documented `PREDICTED` methods or removing them. |

### Forbidden as evidence

- Fake “AI confidence %”  
- Random or decorative docking energy components  
- Hardcoded demo affinities presented as AutoDock Vina  
- Fabricated SwissADME / ADMET numbers  
- Canned Interpreter conclusions presented as study findings  

---

## 4. Study Scope (locked)

| Item | Confirmed decision |
|------|--------------------|
| Formulation | **NanoHepatoTea** tea bag: **2 g** dried *Phyllanthus niruri* leaf + **1 g** Chitosan–TPP nanocarrier powder |
| Primary experimental cell line | **HepG2** |
| Experimental antioxidant assay | **DPPH** |
| Experimental cytotoxicity assay | **LDH** |
| In-silico + experimental | **DPPH**, **LDH** |
| In-silico only (no experimental counterpart in this study) | **MTT**, **ROS**, **BAX**, **Hippo–YAP** |
| Docking | **AutoDock Vina** — real runs and/or imported Vina outputs only |
| ADMET | Real/imported SwissADME (or equivalent documented tool) with provenance |
| Characterization (Laboratory Results) | HPLC, proximate, nutritive, Pb, sensory, microbial, and applicable stability |
| Clinical Dosage Planner | **Out of scope — remove** |

---

## 5. End-to-End Research Workflow (locked)

```text
REFERENCE / LITERATURE data
        ↓
Compound & target selection
        ↓
ADMET (imported/computed with provenance)
        ↓
Molecular Docking (AutoDock Vina import or run)
        ↓
In-silico predictions (DPPH, MTT, LDH, ROS, BAX, Hippo–YAP)
        ↓
Laboratory results entry (Experimental DPPH, Experimental LDH, Characterization)
        ↓
Statistics (experimental datasets)
        ↓
Prediction vs Experimental comparison (DPPH, LDH)
        ↓
Researcher Interpretation
        ↓
Reports / Exports
```

---

## 6. Module Contract Matrix

### 6.1 Knowledge Base / Research Data

| Module | Evidence role | What it stores | Units / grid | Controls / replicates | Provenance required | Must never claim |
|--------|---------------|----------------|--------------|----------------------|---------------------|------------------|
| **Formulation** | `REFERENCE` (+ `LITERATURE` for method citations) | Composition 2 g leaf + 1 g Chitosan–TPP; prep notes; storage | Mass in **g** | N/A | Method refs (e.g. ionic gelation protocol citations) | Clinical dosing, therapeutic schedule, disease-stage intake |
| **Phytochemicals** | Identity: `REFERENCE`; descriptors: `LITERATURE` or `PREDICTED` (tool-derived); activity narratives: not scientific results unless cited | Name, CID, SMILES, formula, MW, etc. | Standard chem units | N/A | CID/source; for ADMET-linked fields → tool + date | That catalog text “proves” anticancer efficacy |
| **Target Proteins** | Identity: `REFERENCE`; pathway notes: `LITERATURE` if cited | Gene, PDB ID, pathway, role | N/A | N/A | PDB ID + retrieval date when stored | Embedding quercetin ΔG / fold-change as protein identity “facts” |
| **Cell Lines** | Identity: `REFERENCE`; any IC₅₀ from papers: `LITERATURE` only | HepG2 primary; other lines optional context only | If IC₅₀ shown: cite units from source | N/A | ATCC/source + citation for literature values | Presenting multi-line IC₅₀ tables as this study’s experimental results |

### 6.2 In-Silico Analysis

| Module | Evidence class | Scope | Default concentration context | Controls (computational) | Replicates | Provenance required | Must never claim |
|--------|----------------|-------|-------------------------------|--------------------------|------------|---------------------|------------------|
| **ADMET / Drug-likeness** | **By value origin — not by module.** `PREDICTED` (SwissADME/RDKit/documented tool), `LITERATURE` (cited publication), and/or `REFERENCE` (authoritative database metadata). Never reclassify a value as `PREDICTED` merely because it is shown in the ADMET UI. | Selected phytochemicals | N/A (molecular descriptors) | N/A | N/A | Preserve each value’s source + provenance (tool/version/date **or** citation **or** database accession) | Fabricated descriptors; “drug approved”; forcing all ADMET fields to `PREDICTED` |
| **Molecular Docking (Vina)** | `PREDICTED` | Ligand–receptor binding | Search box in Å; affinities in **kcal/mol** | Optional reference ligands only if actually docked | Exhaustiveness / run params recorded | Vina version, receptor PDB, ligand file, box, log, pose files, date, researcher | Fake confidence/CNN; random ΔG; UI-only “Vina” without files/logs |
| **DPPH Prediction** | `PREDICTED` (documented model) or `SIMULATION` (if exploratory only) | Compound-level radical scavenging prediction | **µM** grid consistent with manuscript in-silico DPPH (**0** blank; **3.13–100 µM** working range) | Computational refs (e.g. Trolox, ascorbic acid) only as model benchmarks, labeled Predicted/Simulation | If model supports n>1, record; else n/a | Model name/version or simulation assumptions + seed | That prediction = experimental DPPH; use of µg/mL T1–T6 as if wet-lab |
| **MTT Prediction** | `PREDICTED` or `SIMULATION` | Cytotoxicity / viability prediction | Formulation-oriented **µg/mL**, manuscript in-silico range **50–500 µg/mL** (HepG2 focus) | Optional computational positive references, labeled accordingly | As model defines | Model/assumptions | Experimental MTT; “flow/WB” language; wet-lab IC₅₀ |
| **LDH Prediction** | `PREDICTED` or `SIMULATION` | Membrane damage / % cytotoxicity prediction | **µg/mL**, **50–500 µg/mL** (HepG2) | Computational max-lysis / spontaneous analogs only if modeled, labeled Predicted | As model defines | Model/assumptions | Equating to Experimental LDH without comparison module |
| **ROS Prediction** | `PREDICTED` or `SIMULATION` | Oxidative stress pathway prediction | **µg/mL**, **50–500 µg/mL** (HepG2) | N/A unless model defines | As model defines | Model/assumptions | Experimental ROS / DCFH assay claims |
| **BAX Prediction** | `PREDICTED` or `SIMULATION` | Apoptosis pathway prediction | **µg/mL**, **50–500 µg/mL** (HepG2) | N/A unless model defines | As model defines | Model/assumptions | Experimental Western blot / Annexin V as measured |
| **Hippo–YAP Prediction** | `PREDICTED` or `SIMULATION` | Hippo–YAP signaling prediction | **µg/mL**, **50–500 µg/mL** (HepG2) | N/A unless model defines | As model defines | Model/assumptions | Experimental WB/qPCR as measured |

**In-silico only modules (locked — no Laboratory Results counterpart):** MTT, ROS, BAX, Hippo–YAP.

### 6.3 Laboratory Results

| Module | Evidence class | Cell / material | Treatments / concentrations | Controls | Replicates | Key outputs | Provenance required | Must never claim |
|--------|----------------|-----------------|----------------------------|----------|------------|-------------|---------------------|------------------|
| **Experimental DPPH** | `EXPERIMENTAL` | NanoHepatoTea preparation as tested | **T3–T6:** 50, 100, 250, 500 **µg/mL** | **T1** Negative (solvent control); **T2** Positive (**ascorbic acid**) | **R1, R2, R3** (n = 3) | % DPPH radical-scavenging; IC₅₀; means ± SD | Lab name, date, protocol, instrument/wavelength (517 nm per methods), raw replicates | That in-silico DPPH replaces this dataset |
| **Experimental LDH** | `EXPERIMENTAL` | **HepG2** | **T3–T6:** 50, 100, 250, 500 **µg/mL** | **T1** Negative (spontaneous / vehicle as protocol); **T2** Positive (**max lysis**, e.g. Triton X-100 per lab protocol) | **R1, R2, R3** (n = 3) | A₄₉₀; LDH release; % cytotoxicity; dose–response; IC₅₀ | Lab (e.g. DMBEL), date, kit/protocol, raw replicates | Presenting Prediction LDH as experimental; non-HepG2 experimental LDH without new contract amendment |
| **HPLC** | `EXPERIMENTAL` | NanoHepatoTea / extract | Per lab method | Quercetin standards / calibration | Per lab | Retention time, peak area, R², LOD, LOQ, quercetin concentration | Lab (e.g. PIPAC), method, date, report file | Invented marker concentrations |
| **Proximate analysis** | `EXPERIMENTAL` | Formulation sample | N/A | Per DA/lab | Per lab | Moisture, ash, protein, fat, fiber | Lab, date, report | — |
| **Nutritive analysis** | `EXPERIMENTAL` | Formulation sample | N/A | Per lab | Per lab | Carbs, energy, fat, protein, serving, net weight | Lab, date, report | — |
| **Heavy metal (Pb)** | `EXPERIMENTAL` | Formulation sample | N/A | Per lab | Per lab | Pb in mg/kg or ppm vs limit | Lab (e..g. DOST-ITDI), date, report | Safety claims beyond measured vs stated limit |
| **Sensory / organoleptic** | `EXPERIMENTAL` | Formulation | t0 and applicable stability timepoint(s) | Panel protocol | Per protocol | Appearance, odor, taste, overall acceptability (e.g. 9-point hedonic) | Site, date, panel notes | Clinical efficacy |
| **Microbial (APC, yeast & mold)** | `EXPERIMENTAL` | Formulation | t0 and after storage (e.g. 1 month RT) | Per DOST/lab | Per lab | CFU counts vs acceptance criteria | Lab, date, report | — |
| **Stability (applicable)** | `EXPERIMENTAL` | Formulation | As protocol (e.g. immediate + 1 month) | Links sensory + microbial (± chemical if added later) | Per protocol | Change over time | Dates, storage conditions | Shelf-life claims beyond measured window |

### 6.4 Analysis & Reporting

| Module | Evidence class | Purpose | Inputs | Must never claim |
|--------|----------------|---------|--------|------------------|
| **Statistics** | Derived from `EXPERIMENTAL` | Means, SD, ANOVA, Scheffé (p &lt; 0.05 per manuscript data analysis) | Raw experimental replicates | Running ANOVA on Predicted/Simulation values as if wet-lab |
| **Prediction vs Experimental** | Comparison metadata linking `PREDICTED`/`SIMULATION` to `EXPERIMENTAL` | Side-by-side for **DPPH** and **LDH** only | Matching assay pairs | “Validated” / “proven” solely because curves look similar |
| **Interpretation Notebook** | `INTERPRETATION` | Researcher answers RQs / hypotheses | Linked evidence IDs | Auto-generated final conclusions without human authorship |
| **Reports / Exports** | Mixed — each section labeled | SIP tables, figures, methods appendix | All of the above | Mixing unlabeled Predicted and Experimental in one undifferentiated table |

---

## 7. Experimental Treatment Tables (locked)

### 7.1 Experimental DPPH

| Code | Treatment | Concentration |
|------|-----------|---------------|
| T1 | Negative control (solvent control) | — |
| T2 | Positive control (ascorbic acid) | Per lab protocol (record actual conc. used) |
| T3 | NanoHepatoTea | **50 µg/mL** |
| T4 | NanoHepatoTea | **100 µg/mL** |
| T5 | NanoHepatoTea | **250 µg/mL** |
| T6 | NanoHepatoTea | **500 µg/mL** |

Replicates: **R1, R2, R3** for each treatment metric.

### 7.2 Experimental LDH (HepG2)

| Code | Treatment | Concentration |
|------|-----------|---------------|
| T1 | Negative control (spontaneous / vehicle per protocol) | — |
| T2 | Positive control (maximum LDH release / lysis control) | Per kit (e.g. Triton X-100) |
| T3 | NanoHepatoTea | **50 µg/mL** |
| T4 | NanoHepatoTea | **100 µg/mL** |
| T5 | NanoHepatoTea | **250 µg/mL** |
| T6 | NanoHepatoTea | **500 µg/mL** |

Replicates: **R1, R2, R3**.  
Primary cell line: **HepG2** only for experimental LDH under this contract.

---

## 8. Unit Rules (locked)

| Context | Required unit | Forbidden in that context |
|---------|---------------|---------------------------|
| Experimental DPPH & LDH concentrations | **µg/mL** | Treating T3–T6 as µM without conversion documentation |
| In-silico DPPH compound screen | **µM** | Labeling µM grids as experimental tea treatments |
| In-silico MTT / LDH / ROS / BAX / Hippo–YAP (formulation-level) | **µg/mL** | Presenting as measured lab doses |
| Docking affinity | **kcal/mol** | Invented “confidence %” as affinity |
| Pb | **mg/kg** or **ppm** as reported by lab | — |
| Tea bag composition | **g** | Clinical “cups per disease stage” |

Any unit conversion (µg/mL ↔ µM) must store: formula, MW basis, assumptions, and remain labeled as converted — not as a new experimental measurement.

---

## 9. Provenance Requirements (minimum fields)

### 9.1 All `PREDICTED` records

- Method / model name  
- Method / model version (or “unknown — record why”)  
- Input identifiers (SMILES, CID, PDB, formulation ID, cell line)  
- Parameters (e.g. Vina box, exhaustiveness; ADMET tool options)  
- Date generated  
- Researcher / operator  
- Assumptions / limitations  
- Artifact links (logs, PDBQT, exports) when applicable  

### 9.2 All `EXPERIMENTAL` records

- Assay type  
- Laboratory / facility name  
- Date performed  
- Protocol / kit reference  
- Operator or “outsourced lab report”  
- Raw replicates (for DPPH/LDH)  
- Instrument notes (e.g. wavelength) when relevant  
- Attachment of lab PDF/export when available  

### 9.3 All `LITERATURE` values

- Citation (PMID/DOI/URL)  
- Quoted value + unit  
- Retrieved / recorded date  

### 9.4 All `REFERENCE` entities

- Source database (PubChem, RCSB, etc.) when applicable  
- Accession / CID / PDB ID  
- Retrieved date when fetched or imported  

### 9.5 ADMET module — evidence follows origin (mandatory)

The ADMET workspace may **display** values of different evidence classes side by side. Display location does **not** change evidence class.

| Origin | Evidence class | Examples |
|--------|----------------|----------|
| SwissADME-generated results; RDKit-computed descriptors; other **documented** computational tool/model outputs | `PREDICTED` | SwissADME LogP export; RDKit TPSA |
| Values taken from a **cited** scientific publication | `LITERATURE` | Descriptor quoted from a paper with DOI/PMID |
| Authoritative compound/database metadata where appropriate | `REFERENCE` | PubChem MW/formula/CID identity fields shown for context |

**Forbidden:** Relabeling LITERATURE or REFERENCE values as PREDICTED because they appear under ADMET. Preserve original source and provenance on every value.

### 9.6 All `INTERPRETATION` entries

- Author  
- Timestamp  
- Linked evidence IDs (minimum one)  
- Explicit scope (which RQ / hypothesis)  

---

## 10. Comparison Rules (DPPH & LDH)

Allowed comparison pairs:

| Predicted / Simulation side | Experimental side |
|----------------------------|-------------------|
| DPPH Prediction | Experimental DPPH |
| LDH Prediction | Experimental LDH |

Not allowed:

- Comparing MTT/ROS/BAX/Hippo–YAP predictions to non-existent experimental modules in this study  
- Labeling agreement as “experimental validation complete” without researcher Interpretation  
- Silently converting units to force overlay without documenting conversion  

Comparison outputs may include: overlay curves, ΔIC₅₀, per-dose differences, qualitative concordance flags (`consistent` / `partially consistent` / `divergent`) — never automatic “proven.”

---

## 11. Statistics Contract

Applies to **`EXPERIMENTAL`** DPPH and LDH datasets:

- Report means (and SD) from R1–R3  
- ANOVA among treatments  
- Post-hoc **Scheffé**  
- Significance threshold: **p &lt; 0.05** (per manuscript)  

Predicted/Simulation series may be summarized descriptively but **must not** be fed into the same “experimental ANOVA” tables without a separate, clearly labeled computational-sensitivity section (default: do not).

---

## 12. Interpretation & Hypothesis Contract

### 12.1 Null / alternative hypotheses (experimental)

As in the manuscript, decisions are based on **experimental** DPPH and LDH:

1. No significant difference vs significant difference across T1–T6 for DPPH % scavenging / IC₅₀  
2. No significant difference vs significant difference across T1–T6 for LDH A₄₉₀ / release / % cytotoxicity / curves / IC₅₀  

Hypothesis decisions are `INTERPRETATION` entries informed by Statistics on `EXPERIMENTAL` data.

### 12.2 In-silico modules

MTT, ROS, BAX, Hippo–YAP, docking, ADMET, and DPPH/LDH predictions inform **mechanistic hypotheses only**. They must not be recorded as experimental hypothesis tests.

---

## 13. Explicit Removal / Ban List (locked)

The redeveloped system **must not** include or reintroduce:

1. Clinical **Dosage Planner** (disease-stage tea schedules / calendar therapy)  
2. Fake **AI / CNN confidence** percentages  
3. **Random** or decorative docking energy decomposition (`Math.random` science)  
4. Hardcoded docking matrices presented as AutoDock Vina results  
5. Fabricated ADMET / SwissADME values  
6. Misleading “virtual lab” outputs presented as wet-lab assays  
7. Wet-lab method badges (Flow Cytometry, Western Blot, qPCR) on in-silico-only modules  
8. Static Interpreter pages that conclude efficacy as if experimentally proven  
9. Duplicate Docking Lab + AutoDock Vina pages with conflicting fake scores  
10. Dead duplicate engines kept in the active product path as live features  

---

## 14. Claims the System Must Never Make

The UI, exports, and auto-text must **never** state or imply that:

1. A computational prediction **is** an experimental result  
2. AutoDock Vina ran when only hardcoded numbers exist  
3. CNN / AI confidence scored the pose without a real model  
4. SwissADME was computed when values were typed without tool export  
5. MTT / ROS / BAX / Hippo–YAP were experimentally measured in this study  
6. NanoHepatoTea is clinically indicated, dosed by cirrhosis/HCC stage, or a substitute for medical care  
7. Prediction–experiment similarity alone **validates** the formulation  
8. Demo/prototype numbers from the old UI are study truth without provenance reclassification  

Preferred language examples:

- “Predicted IC₅₀ (model X, version Y)”  
- “Experimental mean % scavenging (n = 3)”  
- “Literature value (PMID …)”  
- “Researcher interpretation”  

---

## 15. Handling Legacy Prototype Data

Per `docs/CURRENT_SYSTEM_AUDIT.md`, existing hardcoded values are mostly `UNKNOWN` / `SIMULATION` / `UNSUPPORTED`.

**Contract rule for migration:**

| Legacy item | Allowed migration path |
|-------------|------------------------|
| PubChem CID, SMILES, PDB IDs | May become `REFERENCE` after verification |
| Values with real citations attached by researchers | May become `LITERATURE` |
| Real Vina logs / SwissADME exports supplied by researchers | May become `PREDICTED` |
| Real lab spreadsheets / PDFs | May become `EXPERIMENTAL` |
| Fake confidence, random energies, clinical dosage content | **Discard — do not migrate** |
| Undocumented Hill demo curves | Do not promote to `PREDICTED`; either delete or quarantine as `SIMULATION` with warning |

No legacy number may be stored as `EXPERIMENTAL` without a lab provenance record.

---

## 16. Navigation Mapping (contract-level)

Logical areas the product must expose (names may vary; roles may not):

```text
Dashboard / Study Home
Research Data → Formulation, Phytochemicals, Proteins, Cell Lines
In-Silico → ADMET, Molecular Docking, Predictions (DPPH, MTT, LDH, ROS, BAX, Hippo–YAP)
Laboratory Results → Experimental DPPH, Experimental LDH, Characterization
Analysis → Statistics, Prediction vs Experimental, Interpretation
Reports
```

---

## 17. Amendment Policy

Changes to this contract require:

1. Written researcher/adviser confirmation  
2. Updated “Date locked” / amendment log entry  
3. Explicit list of modules, units, or evidence rules changed  

### Amendment log

| Date | Change | Confirmed by |
|------|--------|--------------|
| 2026-09-29 | Initial contract: DPPH & LDH in-silico+experimental; MTT/ROS/BAX/Hippo–YAP in-silico only; HepG2 primary; formulation 2 g + 1 g; real Vina/ADMET; remove fake AI/dosage/sims-as-lab | Researchers (Step 2 alignment) |
| 2026-09-29 | ADMET evidence rule: classify by origin (PREDICTED / LITERATURE / REFERENCE); never force PREDICTED merely because a value is shown in the ADMET module; preserve source provenance | Researchers (evidence clarification) |

---

## 18. Phase Gate

**Phase 0 scientific alignment:** Complete for the decisions listed herein.

**Next allowed engineering step:** Phase 1 foundation / IA aligned to this contract (still subject to Final Redevelopment Plan sequencing).  

**Still not authorized by this document alone:** Inventing scientific results, implementing fake Vina/ADMET, or coding Experimental modules with wrong units.

---

*End of STUDY DESIGN CONTRACT.*
