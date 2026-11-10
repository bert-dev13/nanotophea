# HEPATOTEA Revision 03 – Researcher Acceptance Checklist

**Purpose:** Practical checks a researcher can perform without developer tools.  
**Date prepared:** 2026-11-11  
**Scientific position:** The six computational modules (DPPH, MTT, LDH, ROS, BAX, Hippo–YAP) are exploratory simulations unless a registered validated model exists. None are currently registered.

**Status column:** mark **Pass**, **Fail**, or **Not Tested**. Do not mark Pass unless the step was actually executed.

---

## A. Biological Predictions

| Test ID | Researcher action | Expected behavior | Pass / Fail / Not Tested | Remarks |
|---------|-------------------|-------------------|--------------------------|---------|
| BP-01 | Open a study → Biological Predictions | Workspace loads endpoints and subjects | Not Tested | |
| BP-02 | Select DPPH (or MTT/LDH/ROS) subject with Ready status | Detail shows “Run exploratory simulation” (not “validated prediction”) | Not Tested | |
| BP-03 | Confirm SIMULATION badge after a completed exploratory run | Evidence badge shows SIMULATION | Not Tested | |
| BP-04 | Read endpoint banner / assumptions | Text denies experimental assay claims for that endpoint | Not Tested | |

## B. Exploratory acknowledgement

| Test ID | Researcher action | Expected behavior | Pass / Fail / Not Tested | Remarks |
|---------|-------------------|-------------------|--------------------------|---------|
| ACK-01 | Click Run without confirming the acknowledgement dialog | Run does not proceed / dialog required | Not Tested | |
| ACK-02 | Cancel acknowledgement | No new simulation is stored | Not Tested | |
| ACK-03 | Accept acknowledgement and run | Simulation completes; method shows Exploratory simulation | Not Tested | |
| ACK-04 | Open “Prediction method & specifications” | Acknowledgement audit shows authenticated acknowledgement (or historical missing-consent note for old runs) | Not Tested | |
| ACK-05 | While signed out, attempt a run (if reachable) | Sign-in required; no silent success | Not Tested | |

## C. Historical results

| Test ID | Researcher action | Expected behavior | Pass / Fail / Not Tested | Remarks |
|---------|-------------------|-------------------|--------------------------|---------|
| HIST-01 | Open an older simulation that still stores TEAC / IC50 / SI / populations (if any exist) | Those fields are not shown as primary assay measurements | Not Tested | |
| HIST-02 | Check Historical / Legacy section (if present) | Warning states values are for traceability, not experimental truth | Not Tested | |
| HIST-03 | Confirm current exploratory metrics still visible on remediated runs | Primary table shows exploratory outputs only | Not Tested | |
| HIST-04 | Confirm raw record was not deleted | Historical study data still listed after viewing sanitized UI | Not Tested | |

## D. Validated prediction unavailable

| Test ID | Researcher action | Expected behavior | Pass / Fail / Not Tested | Remarks |
|---------|-------------------|-------------------|--------------------------|---------|
| VAL-01 | Confirm UI only offers exploratory simulation for the six modules | No “validated model” success path is presented | Not Tested | |
| VAL-02 | (Optional, with developer) POST validated mode to `/api/scientific/predictions` | Response indicates not configured; no prototype numbers returned | Not Tested | Developer-assisted |

## E. Experimental DPPH

| Test ID | Researcher action | Expected behavior | Pass / Fail / Not Tested | Remarks |
|---------|-------------------|-------------------|--------------------------|---------|
| DPPH-E-01 | Open Laboratory → Experimental DPPH | Dataset entry uses µg/mL treatments T1–T6 | Not Tested | |
| DPPH-E-02 | Enter absorbances with T1 solvent control | % scavenging derives from control/sample formula | Not Tested | |
| DPPH-E-03 | Remove / omit T1 control | Derived scavenging is not invented | Not Tested | |
| DPPH-E-04 | Compare with exploratory DPPH | Units/evidence remain separate (µM sim vs µg/mL experimental) | Not Tested | |

## F. Experimental LDH

| Test ID | Researcher action | Expected behavior | Pass / Fail / Not Tested | Remarks |
|---------|-------------------|-------------------|--------------------------|---------|
| LDH-E-01 | Open Laboratory → Experimental LDH | Spontaneous (T1) and maximum-release (T2) controls are required | Not Tested | |
| LDH-E-02 | Enter sample + T1 + T2 | % cytotoxicity uses spont/max normalization | Not Tested | |
| LDH-E-03 | Omit T1 or T2, or set max = spont | Derivation skips safely; no fabricated % | Not Tested | |
| LDH-E-04 | Confirm exploratory LDH did not overwrite experimental dataset | Lab evidence class remains EXPERIMENTAL | Not Tested | |

## G. Stage 6 reporting

| Test ID | Researcher action | Expected behavior | Pass / Fail / Not Tested | Remarks |
|---------|-------------------|-------------------|--------------------------|---------|
| S6-01 | Open Analysis Stage 6 / review summary | Prediction summaries do not present legacy TEAC/IC50 as assay truth for simulations | Not Tested | |
| S6-02 | Check DPPH/LDH experimental findings | Experimental means/statistics remain labeled Experimental | Not Tested | |

## H. AI interpretation

| Test ID | Researcher action | Expected behavior | Pass / Fail / Not Tested | Remarks |
|---------|-------------------|-------------------|--------------------------|---------|
| AI-01 | Ask the assistant about a simulation result | Response treats it as SIMULATION / exploratory, not experimental | Not Tested | Requires AI key |
| AI-02 | Ask about missing experimental MTT | Assistant does not invent experimental MTT values | Not Tested | |

## I. Data provenance and warnings

| Test ID | Researcher action | Expected behavior | Pass / Fail / Not Tested | Remarks |
|---------|-------------------|-------------------|--------------------------|---------|
| PROV-01 | Review method/provenance block on a new exploratory run | Shows exploratory method + acknowledgement audit | Not Tested | |
| PROV-02 | Review an old simulation without acknowledgement metadata | Clear note that historical consent metadata is missing | Not Tested | |
| PROV-03 | Confirm no module is described as “validated predictive model” in UI copy | Language remains exploratory / not configured | Not Tested | |

---

## Sign-off

| Role | Name | Date | Overall verdict |
|------|------|------|-----------------|
| Researcher | | | |
| Adviser (optional) | | | |

**Overall verdict options:** Ready for exploratory + lab RAT / Not ready / Ready with listed caveats
