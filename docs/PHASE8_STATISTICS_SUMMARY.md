# Phase 8 — Statistical Analysis Summary

**Date:** 2026-09-29  
**Binding source of truth:** `docs/STUDY_DESIGN_CONTRACT.md` §11  
**Scope:** One-way ANOVA + Scheffé post-hoc on **Experimental DPPH** and **Experimental LDH** only  
**Route:** `/analysis/statistics`  
**Collection:** `studies/{studyId}/statistics/{analysisId}`  

**Build:** `npm run build` succeeds  
**Tests:** `npm test` — 17/17 pass  

---

## 1. Scope (what is included)

| Included | Excluded |
|----------|----------|
| Experimental DPPH lab datasets + raw replicates | `predictionRuns` / SIMULATION |
| Experimental LDH lab datasets + raw replicates | ADMET, docking |
| Descriptive stats from raw R1–R3 | MTT, ROS, BAX, Hippo–YAP |
| One-way ANOVA (α = 0.05) | Characterization datasets |
| Scheffé post-hoc (not Tukey/Bonferroni) | Prediction vs Experimental (Phase 9) |
| Stale-analysis detection | Automatic hypothesis / efficacy conclusions |
| OWNER/COLLABORATOR write; ADVISER/VIEWER read | Reports / export / Storage |

---

## 2. Statistical methods (manual, deterministic)

**No external statistics package.** All math is in `lib/statistics/`.

| Method | Implementation | Version tag |
|--------|----------------|-------------|
| Mean | Arithmetic mean of finite values only | `ONE_WAY_ANOVA_SCHEFFE` · `1.0.0` |
| Sample variance / SD | Bessel-corrected (n − 1) | same |
| One-way ANOVA | SS/df/MS/F as textbook unbalanced ANOVA | same |
| F distribution | Regularized incomplete beta (Lentz CF) + Lanczos log-Γ | same |
| Scheffé | \(F_S = (\bar y_i-\bar y_j)^2 / [(k-1)\,MSW\,(1/n_i+1/n_j)]\) vs \(F_{\alpha;k-1,N-k}\) | same |

### Formulas

**ANOVA**

- \(\mathrm{SS}_B = \sum_i n_i(\bar y_i - \bar y_{\cdot\cdot})^2\)
- \(\mathrm{SS}_W = \sum_i\sum_j (y_{ij}-\bar y_i)^2\)
- \(\mathrm{SS}_T = \mathrm{SS}_B + \mathrm{SS}_W\)
- \(\mathrm{df}_B = k-1\), \(\mathrm{df}_W = N-k\)
- \(F = MS_B / MS_W\), \(p = P(F_{\mathrm{df}_B,\mathrm{df}_W} \ge F)\)

**Scheffé** (only when omnibus ANOVA is significant at α = 0.05)

- Critical difference \(\mathrm{CD} = \sqrt{(k-1)\,F_{\mathrm{crit}}\,MSW\,(1/n_i+1/n_j)}\)
- Significant if \(|\bar y_i-\bar y_j| > \mathrm{CD}\) (equivalently \(F_S > F_{\mathrm{crit}}\))

**Allowed wording:** “Statistically significant difference detected at α = 0.05.”  
**Not allowed:** automatic efficacy / hypothesis acceptance statements.

---

## 3. Input data & validation

- Reads **only** `labDatasets` + `replicates` for assays `dpph` | `ldh`
- Evidence class must be `EXPERIMENTAL`
- Measurement keys validated against assay config:
  - DPPH: `absorbance`, `radicalScavengingPercent`
  - LDH: `absorbanceA490`, `ldhRelease`, `percentCytotoxicity`
- Missing replicates are **omitted**, never replaced with zero
- Incomplete T1–T6 × R1–R3 grids produce explicit warnings
- Zod: `StatisticsCreateInputSchema`, `StatisticsRecordSchema`

---

## 4. Firestore schema (`statistics/{analysisId}`)

| Field | Role |
|-------|------|
| `id`, `studyId` | Identity |
| `assayType`, `labDatasetId`, `labDatasetName` | Traceability to experimental dataset |
| `measurementKey`, `measurementLabel` | Analyzed metric |
| `alpha` | Default 0.05 |
| `sourceDatasetUpdatedAt`, `sourceFingerprint` | Stale detection (not a raw-data duplicate) |
| `treatmentSummaries[]` | n, mean, SD, variance per treatment |
| `completeness` | expected/observed/missing + warnings |
| `anova` | k, N, SS, df, MS, F, p, significant, message |
| `scheffeComparisons[]` | pairwise A/B, difference, F_S, critical F, CD, p, significant |
| `calculationMethod`, `calculationVersion` | `ONE_WAY_ANOVA_SCHEFFE` / `1.0.0` |
| `calculatedAt`, `calculatedBy` | Audit of computation |
| `provenance` | evidenceClass EXPERIMENTAL + method metadata |
| `notes`, `status`, timestamps | Standard scientific envelope |

Raw laboratory measurements are **not** copied into the statistics document.

---

## 5. Traceability

```
Statistics analysis
   → Source Laboratory Dataset (labDatasetId + name + updatedAt)
      → Treatment (T1–T6)
         → Raw Replicates (R1–R3)  [live read for preview / fingerprint]
```

### Stale / requires recalculation

On list/get, fingerprint is recomputed from current dataset `updatedAt` + replicate ids/timestamps/measurement values.

If mismatch → `freshness: "STALE"` and UI banner **STALE / REQUIRES RECALCULATION**.  
Old results are never silently presented as current.

---

## 6. UI (`/analysis/statistics`)

`StatisticsWorkspace`:

1. Select assay (DPPH / LDH)  
2. Select experimental dataset  
3. Select measurement  
4. Raw T1–T6 × R1–R3 grid (live from replicates)  
5. Descriptive table (n, mean, SD, variance)  
6. One-way ANOVA table  
7. Scheffé post-hoc table  
8. Means ± SD bar chart labeled **EXPERIMENTAL DATA**  
9. Statistical summary (no hypothesis conclusions)  
10. Save / recalculate / delete (role-gated)

---

## 7. Permissions & audit

| Role | Access |
|------|--------|
| OWNER / COLLABORATOR | create, recalculate, delete |
| ADVISER / VIEWER | read-only |

Audit actions:

- `statistics.create`
- `statistics.recalculate`
- `statistics.delete`

Helper: `canEditStatistics` / `statisticsRoleLabel` in `lib/permissions/researchAccess.ts`

---

## 8. Tests (`npm test`)

Coverage in `lib/statistics/statistics.test.ts`:

- mean, sample SD / variance  
- F critical ≈ 5.143 for F(0.05; 2, 6)  
- ANOVA reference example (SS_B=54, SS_W=6, F=27)  
- Scheffé significance / skip when omnibus NS  
- Edge cases: insufficient groups, insufficient N, identical groups, zero variance  
- Incomplete datasets (no zero-fill)  
- Non-eligible assay rejection  
- Fingerprint change for stale detection  

---

## 9. Hypothesis boundary

Statistics may report p-values and significance at α = 0.05.

Statistics **must not** automatically:

- accept/reject research hypotheses  
- claim efficacy or clinical significance  
- assert biological mechanism  
- validate formulation  

Those remain Researcher Interpretation (later phase).

---

## 10. Limitations

- Scheffé runs only after a significant omnibus ANOVA (standard workflow)  
- Infinite F (zero within-MS with unequal means) stored as `Number.MAX_VALUE` for Firestore  
- No multiple-comparison alternatives (Tukey etc.) by design  
- No Prediction vs Experimental module yet  
- No export / reports  

---

## 11. Files created / modified

### Created
- `lib/statistics/descriptive.ts`
- `lib/statistics/fDistribution.ts`
- `lib/statistics/anova.ts`
- `lib/statistics/scheffe.ts`
- `lib/statistics/runAnalysis.ts`
- `lib/statistics/statistics.test.ts`
- `lib/repositories/statisticsRepository.ts`
- `components/analysis/StatisticsWorkspace.tsx`
- `docs/PHASE8_STATISTICS_SUMMARY.md`

### Modified
- `lib/domain/models.ts` — full `StatisticsRecordSchema` / create input  
- `lib/permissions/researchAccess.ts` — statistics write helpers  
- `lib/repositories/interpretationRepository.ts` — removed obsolete stats stub  
- `app/analysis/statistics/page.tsx` — wired workspace  
- `package.json` — `npm test` script  

---

## 12. Stop point

Phase 8 complete for review.  
**Do not begin Prediction vs Experimental** until accepted.
