# HEPATOTEA Scientific Validation Audit  
## All Six Biological Prediction Modules

**Project:** HEPATOTEA (`nanotophea`)  
**Scope:** DPPH, MTT, LDH, ROS, BAX, Hippo–YAP  
**Audit date:** 2026-11-11  
**Mode:** Read-only codebase audit — **no application code, schema, or calculation changes**  
**Binding contract:** [`STUDY_DESIGN_CONTRACT.md`](./STUDY_DESIGN_CONTRACT.md)  
**Prior revision:** [`HEPATOTEA_REVISION_01_DPPH_HIPPO_YAP_FIX.md`](./HEPATOTEA_REVISION_01_DPPH_HIPPO_YAP_FIX.md)

**Citation policy:** Findings below are based on **code inspection** unless marked otherwise. No published validation studies for HEPATOTEA’s exploratory engines were found in-repo. Standard assay formulas cited for laboratory modules (DPPH %, LDH %) match the project’s own documented methods in `lib/lab/derivedAssays.ts` and the study design contract — not invented external DOIs.

---

## Section 1 – Executive Summary

HEPATOTEA’s six “biological prediction” modules are **not validated predictive models**. Every registered model in `lib/predictions/{dpph,mtt,ldh,ros,bax,hippo-yap}.ts` is `null`. At runtime, the UI always calls `/api/scientific/predictions` with `mode: "prototype"`, which runs Hill-style exploratory simulations and persists them as **`SIMULATION` / `exploratory_math`**.

| Ready for what? | Endpoints |
|-----------------|-----------|
| Exploratory simulation only (post–Revision 01 improvements) | **DPPH**, **Hippo–YAP** |
| Exploratory simulation only, but weaker scientific independence / higher overclaim risk | **MTT**, **LDH**, **ROS** |
| Highest overclaim risk — invents multi-marker / population phenotypes from one Hill signal | **BAX** |
| Ready for experimental data processing | **None** of the six prediction engines (lab DPPH/LDH derivation is separate and stronger) |
| Validated computational prediction | **None** |

**Revision 01** correctly separated DPPH (antioxidant physchem heuristic, no docking) from Hippo–YAP (pathway proxies from Hippo-target docking). That does **not** make either scientifically validated.

**Most important integrity risks (confirmed in source):**

1. **BAX** fabricates BAX/BCL-2/caspase fold-changes **and** viable/early/late/necrotic population percentages from a single docking-blended Hill curve — language that reads like Annexin/flow cytometry without those data (**P0**).
2. **MTT / LDH / ROS / BAX** still share `prototypeFactor`, which mixes compound identity with **docking affinity**, implying ligand–receptor ΔG drives viability, membrane damage, ROS, and apoptosis (**P0–P1**).
3. **LDH** invents a “Predicted OD” absorbance from the same simulated cytotoxicity percentage — not from measured A₄₉₀ (**P1**).
4. **MTT “Selectivity index”** is `250 / midpoint`, not a true SI (e.g. IC50_normal / IC50_cancer) (**P1**).
5. Method string **“Computational prediction”** and model names **“HEPATOTEA {Endpoint}”** soften exploratory status even when evidence class is correctly `SIMULATION` (**P2**).
6. Automated tests largely prove **determinism, isolation of DPPH vs Hippo, and plumbing** — not formula scientific validity.

**Laboratory contrast (important):** Experimental DPPH/LDH in `lib/lab/derivedAssays.ts` use defensible blank/max-normalized absorbance formulas. Those must not be confused with the in-silico prediction engines audited here.

---

## Section 2 – Individual Endpoint Assessment

| Endpoint | Scientific Purpose | Current Calculation | Input Quality | Evidence Level | Main Concerns | Assessment |
|----------|--------------------|---------------------|---------------|----------------|---------------|------------|
| **DPPH** | In-silico radical scavenging (compound, µM) | `antioxidantPotencyFactor` → Hill % scavenging; IC50 = Hill midpoint | CID/MW/formula/optional HBD–TPSA; **docking excluded** | `SIMULATION` | Heuristic ≠ QSAR; IC50 not fitted; TEAC = max/100 not Trolox-calibrated | **Exploratory simulation only** (improved post-Rev01) |
| **MTT** | Cell viability / metabolic activity (µg/mL, cell line) | Shared `prototypeFactor` + Hill inhibition → viability = 100 − inhibition | Compound + cell line + **docking affinity** | `SIMULATION` | Docking drives viability; no absorbance; fake SI; IC50 = midpoint | **Requires scientific correction** before research use beyond sandbox |
| **LDH** | Membrane damage / % cytotoxicity | Shared `prototypeFactor` + Hill % cytotoxicity; OD invented from % | Compound + cell line + **docking** | `SIMULATION` | No spontaneous/max controls; OD fabricated; LDH% ≡ cytotoxicity% | **Requires scientific correction** |
| **ROS** | Cellular oxidative stress | Shared `prototypeFactor` + Hill → fold = 1 + hill/100; arbitrary “stress” scores | Compound + cell line + **docking** | `SIMULATION` | No fluorescence assay; scores dimensionless; docking as ROS driver | **Exploratory simulation only** / correction recommended |
| **BAX** | Apoptosis-related pathway | Shared `prototypeFactor` + Hill → BAX/BCL-2/caspase folds + population % | Compound × BAX protein + **docking** | `SIMULATION` | Invents multi-endpoint apoptosis phenotype; reads as flow/WB | **Requires scientific correction** (integrity) |
| **Hippo–YAP** | Hippo / YAP–TEAD signaling | `hippoPathwayEngagement` from Hippo docking → residual activity + proxies | Compound × Hippo protein + docking | `SIMULATION` | Docking ≠ pathway proof; p-YAP/nuclear are heuristics (now labeled) | **Exploratory simulation only** (improved post-Rev01) |

---

## Section 3 – Formula and Unit Review

Only formulas **implemented in source** are listed. Laboratory assay formulas are included for contrast because researchers may confuse them with prediction modules.

### 3.1 Shared generic math (`lib/predictions/prototype/math.ts`)

| Symbol | Implementation | Scientific note |
|--------|----------------|-----------------|
| `demonstrationFactor(parts)` | FNV-1a–style hash → [0,1) | Deterministic identity noise, **not** biology |
| `mix(f, min, max)` | `min + clamp(f)×(max−min)` | Linear remap |
| `hill(c, mid, slope, max)` | \( \frac{\max \cdot (c/\mathrm{mid})^{\mathrm{slope}}}{1+(c/\mathrm{mid})^{\mathrm{slope}}} \) for \(c>0\) | Generic Hill; parameters are **not** fitted to assay data |
| `prototypeFactor(endpoint, features)` | Average of identity hash and scaled docking affinity \((-ΔG-4)/8\) | Used by **MTT, LDH, ROS, BAX** — scientifically unjustified for those assays |

### 3.2 DPPH prediction (`lib/predictions/prototype/dpph.ts`)

**Grid / units:** 0, 3.13, 6.25, 12.5, 25, 50, 100 **µM** — matches contract in-silico DPPH (not experimental µg/mL T3–T6).

**Potency (heuristic):**  
Weighted mix of identity hash, MW band score, formula oxygen-atom count, optional HBD/TPSA, phenolic name regex.  
**Does not use docking** (confirmed).

**Series:** `predicted_scavenging` = `hill(c, midpoint, slope, maximum)` in **%**.  
**IC50 output:** equals Hill **midpoint** (µM), not a fit to scavenging = 50%.  
**TEAC:** `maximum / 100` (ratio) — **not** Trolox-equivalent calibration.  
**Relative potency:** `20 / midpoint`.

| Appropriate? | Limitation |
|--------------|------------|
| Units/grid align with contract | Heuristic does not establish antioxidant activity |
| Docking correctly excluded | IC50/TEAC labels can overstate rigor if not read with SIMULATION badge |
| Evidence class SIMULATION | Oxygen count / name boost are weak proxies |

**Contrast — experimental DPPH** (`lib/lab/derivedAssays.ts`):  
`(A_control − A_sample) / A_control × 100` with T1 solvent control — scientifically standard for this project; **not used** by the prediction engine.

### 3.3 MTT prediction (`lib/predictions/prototype/mtt.ts`)

**Grid / units:** 50, 100, 250, 500 **µg/mL**.  
**Factor:** `prototypeFactor("mtt", …)` including docking.  
**Inhibition:** `hill(c, midpoint, slope, ceiling)`.  
**Viability series:** `100 − inhibition` (%), metric `predicted_viability`.  
**IC50:** Hill midpoint (µg/mL).  
**Selectivity index:** `250 / midpoint` — **not** a literature SI definition.

| Appropriate? | Limitation |
|--------------|------------|
| Concentration unit matches contract MTT in-silico | No MTT absorbance, no control wells, no incubation time |
| Direction viability ↓ with dose is plausible *as a curve shape* | Docking affinity as viability driver is unjustified |
| | SI label is scientifically misleading |
| | MTT measures **metabolic activity**, not definitive cell death — UI hero says “Cytotoxicity Prediction” |

**Contrast — lab helper** (`MTT_VIABILITY_FORMULA` in `derivedAssays.ts`): `(A_sample / A_control) × 100` exists for experimental-style derivation but is **not** wired into the prediction prototype.

### 3.4 LDH prediction (`lib/predictions/prototype/ldh.ts`)

**Grid / units:** 50–500 **µg/mL**.  
**Cytotoxicity series:** `hill(...)` → `%`, metric `predicted_cytotoxicity`.  
**LDH release** and **Cytotoxicity %** at 250 µg/mL: **identical** to the series value.  
**Predicted OD:** `0.12 + 0.9 × (at250/100)` AU — **fabricated absorbance**.  
**Membrane disruption estimate:** `at250 / 100` (score).

| Appropriate? | Limitation |
|--------------|------------|
| µg/mL grid matches contract | No spontaneous (T1) or max-lysis (T2) terms |
| | Invented OD can be mistaken for spectrophotometer data |
| | Docking-driven factor inappropriate for LDH release |

**Contrast — experimental LDH:**  
`(OD_sample − OD_spontaneous) / (OD_max − OD_spontaneous) × 100` — correct project method; **not** used in prediction prototype.

### 3.5 ROS prediction (`lib/predictions/prototype/ros.ts`)

**Grid / units:** 50–500 **µg/mL**.  
**Series:** `ros_response` = `1 + hill(...)/100` (**fold**).  
**Oxidative stress estimate:** raw `hill(250, …)` (**score**, not fold).  
**Mitochondrial response:** second Hill with slope+0.2 and 0.8×maximum (**score**).

| Appropriate? | Limitation |
|--------------|------------|
| Fold-change framing is common for DCFH-style reporting *in assays* | No probe fluorescence, no untreated control ratio from data |
| Distinct metric name from DPPH scavenging | Docking as ROS driver unjustified |
| | “Mitochondrial response” is a renamed Hill, not ΔΨm |

### 3.6 BAX prediction (`lib/predictions/prototype/bax.ts`)

**Grid / units:** 50–500 **µg/mL**.  
**Series:** `bax_response` = `1 + hill(...)/50` (fold).  
From `signal = hill(250, …)`:

| Output | Formula in code |
|--------|-----------------|
| BAX response | `1 + signal/50` fold |
| BCL-2 response | `max(0.2, 1 − signal/150)` fold |
| BAX/BCL-2 ratio | `bax / bcl2` |
| Caspase-3 response | `1 + signal/80` fold |
| Early apoptotic % | `signal × 0.25` |
| Late apoptotic % | `signal × 0.35` |
| Necrotic % | `signal × 0.1` |
| Viable % | `100 − early − late − necrotic` |

| Appropriate? | Limitation |
|--------------|------------|
| Subject gating to BAX-named proteins is sensible | **No** expression, blot, or flow inputs exist |
| Population shares sum to ~100 by construction | Presents **Annexin-like populations** without cytometry |
| | BCL-2/caspase invented as transforms of the same signal |

### 3.7 Hippo–YAP prediction (`lib/predictions/prototype/hippo-yap.ts`)

**Grid / units:** 50–500 **µg/mL**.  
**Engagement:** affinity score + identity hash + small role bias (YAP/TEAD vs LATS).  
**Suppression:** `hill(c, ec50, slope, maxSuppression)`.  
**Series:** `yap_tead_transcriptional_residual` = `100 − suppression` (%).  
**Proxies:** p-YAP score, nuclear YAP residual %, TEAD proxy from residual × role factor.

| Appropriate? | Limitation |
|--------------|------------|
| Independent of DPPH engine (Rev01) | Docking ≠ transcriptional reporter assay |
| Labels say “proxy”; assumptions explicit | p-YAP / nuclear localization not measured |
| Units match contract | Still SIMULATION only |

### 3.8 Validated engine path (`lib/predictions/engine.ts`)

`*Model = null` for all six → `runPrediction` returns `not_configured` with **no numeric output**.  
Production UI does **not** use this path; it uses prototype mode exclusively.

---

## Section 4 – Cross-Endpoint Independence

### What is shared (acceptable vs not)

| Shared element | Used by | Acceptable? |
|----------------|---------|-------------|
| `hill`, `mix`, `round`, `demonstrationFactor` | All prototypes | **Yes** as generic math |
| `prototypeFactor` (identity + docking) | MTT, LDH, ROS, BAX | **No** as biological driver for these assays |
| `finishPrototype` / `method: "Computational prediction"` | All | OK plumbing; wording softens SIMULATION |
| Generic `PROTOTYPE_ASSUMPTIONS` | MTT, LDH, ROS, BAX (default) | **Weak** — not endpoint-specific |
| Endpoint-specific assumptions | DPPH, Hippo–YAP | Better |
| Concentration grid 50–500 µg/mL | MTT, LDH, ROS, BAX, Hippo | Contract-aligned for those modules |
| µM grid | DPPH only | Good separation |
| `RUNNERS` map in `prototype/index.ts` | All | Correct dispatch; independence depends on runners |

### Inappropriate dependencies (confirmed)

1. **MTT/LDH/ROS/BAX** inherit docking ΔG via `prototypeFactor` — same class of error Revision 01 fixed for DPPH.  
2. **BAX** populations and **LDH OD** are derived transforms of one Hill output — endpoint-local, but scientifically unjustified.  
3. **Feature assembly** (`featuresForSubject`): docking excluded only for `endpoint === "dpph"`; other cell assays still receive docking.  
4. **No shared mock JSON dataset** across endpoints was found — values are computed, not a single hardcoded table.  
5. Output **metrics** differ by name after Rev01 for DPPH vs Hippo; MTT/LDH still both produce % Hill curves that can look similar if docking/identity factors align.

### Independence matrix (runtime engines)

| | DPPH | MTT | LDH | ROS | BAX | Hippo |
|--|:----:|:---:|:---:|:---:|:---:|:-----:|
| Own factor function | Yes | No (`prototypeFactor`) | No | No | No | Yes |
| Uses docking | No | Yes | Yes | Yes | Yes | Yes (intended, as proxy) |
| Own assumptions text | Yes | No (generic) | No | No | No | Yes |
| Distinct primary metric | scavenging % / IC50 µM | viability % | cytotoxicity % | fold ROS | fold BAX + populations | residual YAP–TEAD % |

---

## Section 5 – Evidence and Scientific Integrity

### What works

- Prototype results persist with `provenance.evidenceClass: "SIMULATION"` and `methodType: "exploratory_math"` (`store.ts`).  
- Comparison module (`lib/comparison`) accepts `PREDICTED` or `SIMULATION` and does **not** promote simulation to experimental; aligned compare blocked for DPPH unit mismatch by design.  
- Validated engine refuses to invent PREDICTED numbers when models are null.  
- Revision 01 UI shows **SIMULATION** badge when provenance is SIMULATION (for completed runs).  
- DPPH/Hippo assumptions explicitly deny overclaiming (docking≠antioxidant; proxies≠WB/qPCR).

### Integrity failures / risks (confirmed)

| ID | Issue | Why it matters |
|----|-------|----------------|
| E1 | `method: "Computational prediction"` + modelName `HEPATOTEA {X}` | Sounds like a product model, not an unvalidated Hill demo |
| E2 | BAX viable/early/late/necrotic % | Looks like flow cytometry without flow data |
| E3 | LDH “Predicted OD” AU | Looks like spectrophotometer readout |
| E4 | MTT “Selectivity index” | Looks like pharmacology SI |
| E5 | DPPH “TEAC” / “IC50” | Standard assay vocabulary for heuristic midpoint / max/100 |
| E6 | MTT/LDH/ROS/BAX generic assumptions | Researchers may not see docking was used as a driver |
| E7 | Frontend progress copy “Querying bioactivity model” | Implies a real model backend |
| E8 | Hero “Prediction” for all modules | Contract allows SIMULATION but UI word “Prediction” dominates |

**Insufficient-data / model-unavailable path:** Exists for validated engine (`not_configured`) but **is not** the path users hit when clicking Run — prototype always returns numbers. There is no researcher-facing “model unavailable; refuse to simulate” gate on the live button.

---

## Section 6 – Frontend and Interpretation

**File:** `components/study/BiologicalPredictionsWorkspace.tsx`

| Topic | Finding |
|-------|---------|
| Endpoint routing | Jobs keyed by `endpoint:subject`; runs matched with `run.endpoint` — **good isolation** |
| Evidence badge | SIMULATION when provenance says so — **fixed in Rev01** |
| Context banners | Explicit for DPPH, BAX, Hippo; **missing** for MTT, LDH, ROS |
| Chart titles/units | Stronger for DPPH/Hippo; MTT/LDH/ROS/BAX still generic “Concentration–response” unless completed chart metric caption |
| Primary metric | Preferential logic for DPPH/Hippo; others still lean on `summaryIc50` / first output — MTT IC50 may dominate |
| `systemCopy` | Rewrites “prototype” → “exploratory”; method still “Computational prediction” |
| Literature panel | PubMed assist after completion — **LITERATURE** badge for papers is separate from simulation (good), but adjacency can blur mental models |
| Over-interpretation risk | BAX banner mentions “mitochondrial outer membrane permeabilization” and “apoptotic threshold” for a Hill simulation |

Primary metrics **supported by implementation** (not by wet-lab truth):

| Endpoint | Defensible UI primary (as simulation) | Misleading if emphasized |
|----------|--------------------------------------|---------------------------|
| DPPH | % scavenging; exploratory IC50 (µM) | TEAC as Trolox assay |
| MTT | % viability at stated dose | Selectivity index; docking-based IC50 as wet IC50 |
| LDH | % cytotoxicity (simulated) | Predicted OD AU |
| ROS | fold at dose | Mitochondrial “score” as ΔΨm |
| BAX | BAX fold (simulated) | Population % / caspase as measured |
| Hippo | YAP–TEAD residual % | p-YAP / nuclear as WB/microscopy |

---

## Section 7 – Automated Testing Gaps

### What tests currently verify (from `prototype.test.ts`, `engine.test.ts`, `modules.test.ts`)

- Determinism of same inputs.  
- `SIMULATION` persistence for LDH sample.  
- BAX population sum ≈ 100.  
- Validated models unconfigured.  
- No `Math.random`.  
- DPPH/Hippo isolation, docking independence for DPPH, Hippo affinity sensitivity.  
- Module subject pairing / filters / evidence visibility gates.

### What they do **not** verify

- Scientific correctness of any Hill parameter choice.  
- That MTT SI is wrong pharmacologically.  
- That LDH OD is non-experimental.  
- That docking must not drive MTT/LDH/ROS.  
- Absence of absorbance/control inputs when claiming assay endpoints.  
- Frontend badge/copy for MTT/LDH/ROS.  
- Refusal to run when scientifically insufficient inputs exist.  
- Unit consistency against experimental comparison rules beyond existing comparison tests.  
- That TEAC/IC50 labels match calibration/fitting definitions.

### Recommended tests (do not implement in this audit)

| Endpoint | Recommended cases |
|----------|-------------------|
| All | Assert `evidenceClass === "SIMULATION"` and assumptions non-empty / endpoint-specific |
| All | Assert validated `runPrediction` never returns numbers while models are null |
| DPPH | Docking change does not change outputs; units µM; no proteinId stored |
| MTT | Document or reject docking-driven factor; SI not labeled as pharmacology SI without normal-cell IC50 |
| LDH | No output key implying measured OD unless absorbance inputs exist; no spontaneous/max → insufficient-data path |
| ROS | Metric fold ≠ scavenging %; no DPPH metric reuse |
| BAX | Population outputs gated or forbidden without cytometry inputs; caspase/BCL-2 not inventable from docking alone |
| Hippo | Residual metric ≠ `predicted_scavenging`; no TEAC/IC50 scavenging fields |
| Cross | Same compound features → distinct metric names/units across all six |
| UI | Badge SIMULATION; primary metric map per endpoint |

---

## Section 8 – Prioritized Findings

### P0 – Critical scientific integrity

| ID | Finding |
|----|---------|
| **P0-1** | **BAX** emits Annexin-like population percentages and multi-marker apoptosis panel from one Hill/docking factor (`bax.ts`). |
| **P0-2** | **MTT / LDH / ROS / BAX** use docking affinity inside `prototypeFactor` as if ΔG predicted those phenotypes. |
| **P0-3** | Live Run path **always simulates** instead of offering “validated model unavailable / insufficient data” when no registered model exists. |

### P1 – High (incorrect or unjustified biology)

| ID | Finding |
|----|---------|
| **P1-1** | **LDH** fabricates Predicted OD (AU) from simulated cytotoxicity %. |
| **P1-2** | **MTT Selectivity index** = `250/midpoint` misuses SI terminology. |
| **P1-3** | **DPPH TEAC** = `maximum/100` is not Trolox-equivalent antioxidant capacity. |
| **P1-4** | **IC50** for DPPH/MTT equals Hill midpoint parameter, not a fitted IC50 from points. |
| **P1-5** | **LDH** lacks spontaneous/max-lysis structure required for real % cytotoxicity. |
| **P1-6** | MTT hero/labeling as “Cytotoxicity” overstates metabolic MTT readout. |

### P2 – Medium (transparency / inputs / units)

| ID | Finding |
|----|---------|
| **P2-1** | MTT/LDH/ROS/BAX use generic `PROTOTYPE_ASSUMPTIONS` (no docking disclaimer). |
| **P2-2** | Method string “Computational prediction” understates exploratory math. |
| **P2-3** | No MTT/LDH/ROS endpoint banners analogous to DPPH/Hippo/BAX. |
| **P2-4** | Treatment duration never captured in prediction features. |
| **P2-5** | ADME descriptors for DPPH HBD/TPSA often absent on normalized ADME maps → heuristic falls back to weaker cues. |
| **P2-6** | Progress UI “Querying bioactivity model” implies a real model service. |

### P3 – Low (docs / terminology / presentation)

| ID | Finding |
|----|---------|
| **P3-1** | Spec `outputLabels` in `*.ts` list aspirational metrics not all produced by prototypes. |
| **P3-2** | README / older phase docs may still understate that Vina runs and that predictions are simulations. |
| **P3-3** | Chart axis labeling still denser for DPPH/Hippo than for MTT/LDH/ROS/BAX. |

---

## Section 9 – Recommended Remediation Plan

| Finding ID | Endpoint(s) | Root cause | Affected files | Scientific explanation | Recommended correction | Required tests | Priority |
|------------|-------------|------------|----------------|------------------------|------------------------|----------------|----------|
| P0-1 | BAX | Single Hill expanded into flow-like panel | `prototype/bax.ts`, workspace copy | Populations require cytometry/gating | Remove or hard-gate population/% outputs unless experimental inputs exist; keep at most docking-contextual **pathway proxy** with SIMULATION labels | Forbid population keys without cytometry flag; assumptions must deny Annexin | P0 |
| P0-2 | MTT, LDH, ROS, BAX | Shared `prototypeFactor` + docking | `math.ts`, `mtt.ts`, `ldh.ts`, `ros.ts`, `bax.ts`, `BiologicalPredictionsWorkspace.tsx` | Receptor ΔG ≠ viability/LDH/ROS/apoptosis | Endpoint-specific factors; exclude docking where unjustified (like DPPH) or label as weak docking-context proxy only for target-bound modules | Docking change must not move MTT/LDH/ROS (or must be explicitly declared) | P0 |
| P0-3 | All | Prototype always runs | `BiologicalPredictionsWorkspace.tsx`, `api/scientific/predictions`, `engine.ts` | No validated model registered | Offer explicit “Exploratory simulation” consent **or** block with model-unavailable; never silent “prediction” | UI/API path when `hasPredictionModel===false` | P0 |
| P1-1 | LDH | OD derived from % | `ldh.ts` | Absorbance must be measured | Remove Predicted OD or mark insufficient-data | No AU output without absorbance inputs | P1 |
| P1-2 | MTT | Fake SI formula | `mtt.ts` | SI needs paired IC50s | Rename or remove until normal-cell IC50 exists | SI absent or correctly defined | P1 |
| P1-3 | DPPH | TEAC mislabel | `dpph.ts` | TEAC needs Trolox calibration | Rename to “exploratory max-response ratio” or remove | No “TEAC” without calibration inputs | P1 |
| P1-4 | DPPH, MTT | Midpoint labeled IC50 | `dpph.ts`, `mtt.ts`, store | IC50 is a fit | Label “exploratory Hill midpoint (not fitted IC50)” or fit only with documented method | Label/unit assertions | P1 |
| P1-5 | LDH | Missing controls in sim | `ldh.ts` | LDH % needs spont/max | Align with experimental formula only when controls exist; else insufficient-data | Missing T1/T2 → no fake % | P1 |
| P1-6 | MTT | Cytotoxicity wording | workspace HERO/copy | MTT ≠ death | Prefer “metabolic viability (exploratory)” | Copy tests / snapshot | P1 |
| P2-1–P2-6 | MTT/LDH/ROS/BAX/UI | Transparency gaps | assumptions, workspace | Researchers must see limits | Endpoint assumptions; banners; rename method string; fix progress copy | Assumptions contain docking disclaimer where used | P2 |
| P3-* | Docs/UI | Polish | specs, docs, charts | Clarity | Align spec labels with actual outputs; chart captions | Doc/spec consistency checks | P3 |

**Do not** “fix” independence by randomizing numbers. Fix drivers, labels, and refusal paths.

---

## Section 10 – Overall Readiness

| Endpoint | Classification | Reasoning |
|----------|----------------|-----------|
| **DPPH** | **Exploratory simulation only** | Post-Rev01: independent antioxidant heuristic, correct µM grid, SIMULATION persistence, docking excluded. **Not** ready as experimental processor or validated QSAR. IC50/TEAC naming still over-precise. |
| **MTT** | **Requires scientific correction** | Docking-driven Hill viability, fake SI, no absorbance/time, cytotoxicity wording. Sandbox-only until corrected. |
| **LDH** | **Requires scientific correction** | Invented OD; no spont/max normalization; docking-driven %; diverges from project’s own experimental LDH formula. |
| **ROS** | **Exploratory simulation only** (leaning **requires correction**) | Distinct fold metric helps vs DPPH, but docking-driven scores and “mitochondrial” label lack assay basis. |
| **BAX** | **Requires scientific correction** | Highest integrity risk: multi-marker + population phenotype from one signal. |
| **Hippo–YAP** | **Exploratory simulation only** | Post-Rev01: independent pathway proxies, clear assumptions, not DPPH. Still not WB/qPCR/reporter validation. |
| **Experimental DPPH/LDH lab path** (out of prediction engines but relevant) | **Ready for experimental data processing** (for those assays) | `derivedAssays.ts` formulas match contract; replicates/controls required. |
| **Validated computational prediction** | **None of the six** | All `*Model = null`; no in-repo validation evidence. |

### Bottom line

HEPATOTEA can be **scientifically responsible** only if it continues to treat these six modules as **exploratory simulations** (or disables overclaiming outputs), keeps experimental lab math separate, and corrects MTT/LDH/ROS/BAX so they no longer imply that docking affinity produces viability, membrane lysis, ROS, or apoptosis populations.

The goal is not impressive curves. The goal is that every number a researcher sees is either (a) measured, (b) literature-cited, (c) from a documented validated model, or (d) clearly marked exploratory with assumptions that match the code.

---

## Appendix A – Runtime pipeline (confirmed)

```text
BiologicalPredictionsWorkspace.executePrediction
  → featuresForSubject (docking excluded only for DPPH)
  → POST /api/scientific/predictions { mode: "prototype" }
  → runPrototype(endpoint) → simulate*
  → evidenceClass: SIMULATION
  → storedSimulationFromPrototype → biological_predictions
  → UI: series chart + outputs + EvidenceBadge(SIMULATION)
```

Validated path `runPrediction` is unused by the Run button while models remain null.

## Appendix B – Source index

| Area | Paths |
|------|-------|
| Specs / null models | `lib/predictions/{dpph,mtt,ldh,ros,bax,hippo-yap}.ts` |
| Prototypes | `lib/predictions/prototype/{dpph,mtt,ldh,ros,bax,hippo-yap,math,types,index}.ts` |
| Engine | `lib/predictions/engine.ts` |
| Store | `lib/predictions/store.ts` |
| Subjects | `lib/predictions/modules.ts` |
| API | `app/api/scientific/predictions/route.ts` |
| UI | `components/study/BiologicalPredictionsWorkspace.tsx` |
| Lab formulas | `lib/lab/derivedAssays.ts` |
| Comparison | `lib/comparison/*` |
| Contract | `docs/STUDY_DESIGN_CONTRACT.md` |
| Rev01 | `docs/HEPATOTEA_REVISION_01_DPPH_HIPPO_YAP_FIX.md` |

---

---

## Implementation status (2026-11-11 remediation)

Remediation document: [`HEPATOTEA_SCIENTIFIC_INTEGRITY_REMEDIATION.md`](./HEPATOTEA_SCIENTIFIC_INTEGRITY_REMEDIATION.md)

| Finding ID | Status | Notes |
|------------|--------|-------|
| P0-1 | **Fixed** | BAX populations / BCL-2 / caspase removed; unavailable without target |
| P0-2 | **Fixed** | Docking removed from MTT/LDH/ROS/BAX factors + feature assembly |
| P0-3 | **Fixed** | Validated mode refuses; exploratory requires acknowledgement + UI confirm |
| P1-1 | **Fixed** | Predicted OD removed |
| P1-2 | **Fixed** | Selectivity index removed |
| P1-3 | **Fixed** | TEAC renamed to exploratory maximum response ratio |
| P1-4 | **Fixed** | Hill midpoint labeled exploratory (not fitted IC50) |
| P1-5 | **Addressed (prototype)** | Prototype no longer claims experimental LDH %; lab formula unchanged |
| P1-6 | **Fixed** | MTT labeled metabolic viability |
| P2-1 | **Fixed** | Endpoint-specific assumptions |
| P2-2 | **Fixed** | Method = Exploratory simulation |
| P2-3 | **Fixed** | MTT/LDH/ROS banners |
| P2-4 | **Open** | Treatment duration still absent from prediction features |
| P2-5 | **Open** | DPPH still weak when HBD/TPSA missing from ADME map |
| P2-6 | **Fixed** | Progress copy updated |
| P3-1–P3-3 | **Partial / open** | Chart titles improved; README/spec aspirational labels remain |

*Original audit text above remains the historical findings record. Status column reflects post-remediation code.*
