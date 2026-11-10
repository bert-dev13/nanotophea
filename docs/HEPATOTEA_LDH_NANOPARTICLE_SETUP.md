# HEPATOTEA — LDH optional nanoparticle setup

## Outcome

After the LDH cell line (HepG2) is established, researchers choose **Include Nanoparticle?** (**Yes, Include Nanoparticle** / **No, Skip**). Included runs require a treatment label (study nanoparticle record and/or free text). The choice is stored with the experimental dataset metadata.

## Persistence

Stored on the LDH `laboratory_datasets` record as:

`characterization.ldhNanoparticleSetup`

```json
{
  "choice": "include" | "skip",
  "treatmentLabel": "optional when include",
  "nanoparticleRecordId": "optional study nanoparticle id",
  "source": "study_record" | "researcher_specified" | "skipped"
}
```

## Display

- Treatment labels for T3–T6 reflect include vs skip (`HepatoTea · {treatment}` or `HepatoTea (no nanoparticle)`).
- Results meta and Analysis LDH section show the recorded setup.
- **Selectivity Index** display states **Not calculated** and explains that SI is not invented from LDH absorbance or from nanoparticle inclusion alone. Paired comparator IC50 data are required for a real SI.

## Boundaries

- LDH % cytotoxicity formula and controls are unchanged.
- No absorbance, IC50, or SI values are fabricated from nanoparticle choice.
- DPPH and other assays are untouched.
