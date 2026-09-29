# NANOTOPHEA

**NanoHepatoTea Bioinformatics Research Platform**

Study-scoped research workspace for computational prediction, laboratory recording, statistics, comparison, and researcher-authored interpretation — with strict evidence-class separation.

Binding scientific source of truth: [`docs/STUDY_DESIGN_CONTRACT.md`](docs/STUDY_DESIGN_CONTRACT.md)

> Computational outputs do not constitute experimental proof.

---

## What this platform is

- Firebase Auth + Firestore-backed multi-user study workspace
- Research Data catalogs (formulation, phytochemicals, proteins, cell lines, references)
- In-silico **import/recording** for docking and endpoint predictions (not internal Vina/SwissADME execution)
- Laboratory datasets with raw replicates (Experimental DPPH, Experimental LDH, characterization)
- Statistics (one-way ANOVA + Scheffé) on experimental DPPH/LDH only
- Prediction vs Experimental comparison with unit/compatibility rules
- Researcher Interpretation (manual narrative + evidence linking; no auto-conclusions)

## What this platform is not

- Not an AutoDock Vina or SwissADME runner
- Not a validated internal QSAR/AI prediction engine (unless a documented method is explicitly imported)
- Not a clinical decision or dosage tool
- Not a Reports/PDF/Excel export product (Reports remain removed)
- Not Firebase Storage–based file upload (schemas reserve artifact refs for later)

---

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, lucide-react, Recharts |
| Validation | Zod |
| Backend | Firebase Auth + Firestore (client SDK) |
| Admin scripts | Firebase Admin (seed only; not in browser path) |

---

## Quick start

```bash
cp .env.example .env.local
# fill NEXT_PUBLIC_FIREBASE_* from your Firebase web app config

npm install
npm test
npm run dev
```

Production check:

```bash
npm run build
npm start
```

Deploy Firestore security rules before shared researcher testing:

```bash
firebase deploy --only firestore:rules
```

Optional bootstrap (server only):

```bash
# service.json at repo root or GOOGLE_APPLICATION_CREDENTIALS
npm run seed:admin
```

---

## Active modules & routes

| Area | Routes |
|------|--------|
| Dashboard | `/` |
| Research Data | `/research/formulation`, `/phytochemicals`, `/proteins`, `/cell-lines`, `/references` |
| In-silico | `/insilico/admet` (placeholder), `/insilico/docking`, `/insilico/predictions/*` |
| Laboratory | `/lab/dpph`, `/lab/ldh`, `/lab/characterization` |
| Analysis | `/analysis/statistics`, `/analysis/compare`, `/analysis/interpretation` |

Full validation notes: [`docs/PHASE11_FINAL_VALIDATION.md`](docs/PHASE11_FINAL_VALIDATION.md)

---

## Evidence classes

Every scientific value carries one of:

`REFERENCE` · `LITERATURE` · `PREDICTED` · `SIMULATION` · `EXPERIMENTAL` · `INTERPRETATION`

Units of note:

- In-silico DPPH: **µM** · Experimental DPPH: **µg/mL** (never auto-converted)
- LDH (in-silico & experimental): **µg/mL**
- Experimental treatments T3–T6: **50 / 100 / 250 / 500 µg/mL**

---

## Roles

| Role | Access |
|------|--------|
| OWNER | Full study access + membership management |
| COLLABORATOR | Scientific authoring |
| ADVISER | Read-only |
| VIEWER | Read-only |

Firestore rules are the security boundary; UI read-only states are complementary.

---

## Phase documentation

| Doc | Topic |
|-----|-------|
| `docs/STUDY_DESIGN_CONTRACT.md` | Binding scientific contract |
| `docs/PHASE1_IA_SUMMARY.md` … `PHASE10_*.md` | Incremental delivery notes |
| `docs/PHASE11_FINAL_VALIDATION.md` | Final audit, security, QA checklist, limitations |

---

## Tests

```bash
npm test
# 48 domain/integration tests (statistics, comparison, interpretation, Phase 11 boundaries)
```

---

## License / project

Private research platform codebase (`package.json` name: `nano-hepatotea`).
