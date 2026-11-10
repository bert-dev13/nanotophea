# HEPATOTEA

**HepatoTea Bioinformatics Research Platform**

Study-scoped research workspace for computational docking, exploratory biological simulations, laboratory recording, statistics, comparison, and researcher-authored interpretation — with strict evidence-class separation.

Binding scientific source of truth: [`docs/STUDY_DESIGN_CONTRACT.md`](docs/STUDY_DESIGN_CONTRACT.md)

> Computational outputs do not constitute experimental proof. The six biological prediction modules are **exploratory simulations** (`SIMULATION`) unless a documented validated model is explicitly registered. None are currently registered.

---

## What this platform is

- Cookie-session authentication against MySQL (`nanotophea_session`)
- Multi-user study workspace with OWNER / COLLABORATOR / ADVISER / VIEWER membership
- Research Data catalogs (formulation, phytochemicals, proteins, cell lines, references)
- In-silico **AutoDock Vina** docking jobs (local worker) with affinity logs and pair status
- Hosted ADMET assessment via server-side `/api/scientific/adme` (when `ADMET_API_URL` is configured)
- Six biological endpoints (DPPH, MTT, LDH, ROS, BAX, Hippo–YAP) as **consent-gated exploratory simulations**
- Laboratory datasets with raw replicates (Experimental DPPH, Experimental LDH, characterization)
- Statistics (one-way ANOVA + Scheffé) on experimental DPPH/LDH only
- Prediction vs Experimental comparison with unit/compatibility rules
- Researcher Interpretation (manual narrative + evidence linking; optional AI assist)

## What this platform is not

- Not a scientifically validated QSAR/AI prediction product for the six bioactivity modules
- Not a clinical decision or dosage tool
- Not Firebase Auth / Firestore (legacy; removed from the active stack)
- Not a substitute for wet-lab DPPH/LDH measurements

---

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, lucide-react, Recharts |
| Validation | Zod |
| Database | MySQL / MariaDB (`mysql2`) |
| Auth | Server sessions in MySQL + `nanotophea_session` cookie (Bearer also accepted on APIs) |
| Docking | Local AutoDock Vina worker (`VINA_BIN`, optional `DOCKING_PYTHON`) |
| ADMET | Optional hosted service (`ADMET_API_URL`, optional `ADMET_API_KEY`) |
| AI assist | Optional Together AI (`TOGETHER_API_KEY`) |

---

## Quick start

```bash
cp .env.example .env.local
# fill MYSQL_* (and optional VINA / ADMET / TOGETHER keys)

npm install
npm run db:migrate
npm run seed:admin
npm test
npm run dev
```

Production check:

```bash
npm run build
npm start
```

See [`.env.example`](.env.example) for the environment variables this repository actually reads.

---

## Evidence classes

Every scientific value carries one of:

`REFERENCE` · `LITERATURE` · `PREDICTED` · `SIMULATION` · `EXPERIMENTAL` · `INTERPRETATION`

| Path | Class | Notes |
|------|-------|-------|
| AutoDock Vina docking affinities | `PREDICTED` | Requires real Vina run artifacts / logs |
| Six biological modules (current) | `SIMULATION` | Exploratory math; requires explicit acknowledgement |
| Validated bioactivity models | `PREDICTED` | None registered (`*Model = null`) |
| Experimental DPPH / LDH | `EXPERIMENTAL` | Laboratory module formulas + controls |

Units of note:

- In-silico / exploratory DPPH: **µM** · Experimental DPPH: **µg/mL** (never auto-converted)
- LDH / MTT / ROS / BAX / Hippo–YAP grids: **µg/mL**
- Experimental treatments T3–T6: **50 / 100 / 250 / 500 µg/mL**

---

## Biological predictions (important)

1. **Validated mode** (`mode: validated` or default) calls registered models only. With no models registered, the API returns `404 not_configured` and **never** falls back to prototype math.
2. **Exploratory simulation** requires `mode: exploratory_simulation` **and** `acknowledgeExploratory: true`, plus an authenticated user with study access.
3. New exploratory runs store acknowledgement metadata in `input_parameters` (`meta:acknowledgedExploratory`, actor, timestamp, version, run id). Historical rows without these fields remain readable and are treated as missing-consent archives.
4. Legacy SIMULATION fields such as TEAC, fabricated IC50 summaries, selectivity index, Predicted OD, or BAX population percentages are **not** shown as current assay measurements; they may appear only in a labeled historical/legacy section.

---

## Laboratory experimental workflows

Experimental DPPH and LDH calculations live in `lib/lab/derivedAssays.ts` and are separate from prediction prototypes:

- **DPPH:** `(A_control − A_sample) / A_control × 100` with required control absorbance
- **LDH:** `(OD_sample − OD_spontaneous) / (OD_max − OD_spontaneous) × 100` with spontaneous + maximum-release controls

Missing controls, invalid values, and zero denominators are skipped safely. Prototype simulations cannot overwrite experimental evidence class.

---

## Roles

| Role | Access |
|------|--------|
| OWNER | Full study access + membership management |
| COLLABORATOR | Scientific authoring |
| ADVISER | Read-only |
| VIEWER | Read-only |

Server-side study membership checks enforce API access; UI read-only states are complementary.

---

## Documentation

| Doc | Topic |
|-----|-------|
| `docs/STUDY_DESIGN_CONTRACT.md` | Binding scientific contract |
| `docs/HEPATOTEA_SCIENTIFIC_VALIDATION_AUDIT.md` | Six-module validation audit |
| `docs/HEPATOTEA_SCIENTIFIC_INTEGRITY_REMEDIATION.md` | P0/P1 remediation notes |
| `docs/HEPATOTEA_FINAL_SCIENTIFIC_INTEGRITY_VERIFICATION.md` | Independent verification |
| `docs/HEPATOTEA_REVISION_02_IMPLEMENTATION_REPORT.md` | Legacy display, consent audit, docs alignment |

---

## Tests

```bash
npm test
```

Prediction / integrity suites include prototype engines, engine `not_configured`, lab derived assays, display sanitization, and predictions API mode/consent contracts.

---

## Current limitations

- No validated predictive models are registered for DPPH, MTT, LDH, ROS, BAX, or Hippo–YAP
- Treatment duration is not captured on prediction feature models
- Historical simulation rows may still contain obsolete metric keys in MySQL; display is sanitized, records are preserved
- ADMET and Vina require local/hosted tooling configured via environment variables

---

## License / project

Private research platform codebase (`package.json` name: `nano-hepatotea`).
