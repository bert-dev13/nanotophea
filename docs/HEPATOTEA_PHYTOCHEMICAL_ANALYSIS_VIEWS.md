# HEPATOTEA — Phytochemical analysis views

## Options

Researchers can switch between:

1. **Individual Phytochemical View** — inspect one selected compound (and its docking pair / prediction subject) at a time.
2. **Combined Phytochemicals View (Tea Formulation)** — list all selected phytochemicals as the *Phyllanthus niruri* tea composition and show each compound’s own recorded results side by side.

The toggle appears on:

- In-Silico Screening
- Molecular Docking
- Biological Predictions

Preference is remembered per study in `localStorage` (`hepatotea.phytochemicalAnalysisView.{studyId}`).

## Scientific boundaries

- Combined view is **compositional display + per-compound traceability**.
- Composition always loads **all Research Setup phytochemicals** for the study (`listCompounds`), not only the active library row or docking-eligible subset.
- Molecular Docking may still **run** only screened compounds, but unscanned members remain listed in the tea composition with an explicit pending status.
- Docking affinities and prediction outputs are **not averaged or fused**.
- No synergistic or combined biological activity is claimed without appropriate experimental or validated computational methods.
- Existing calculations, pair/job keys, and database records are unchanged.
- “Inspect individually” switches back to Individual view on that compound.
- A single selected phytochemical is shown honestly as a one-compound formulation.

## Implementation

- `lib/phytochemicals/analysisView.ts`
- `components/study/PhytochemicalAnalysisViewToggle.tsx`
- `components/study/TeaFormulationCombinedPanel.tsx`
- `components/study/usePhytochemicalAnalysisView.ts`
