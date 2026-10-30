# Docking worker

NANOTOPHEA does not dock in the browser. The study page calls `/api/scientific/docking/jobs`, which queues work for `services/docking/worker.py`.

The worker is idle until the server has all of the following:

- Python 3 (`py -3`, or `DOCKING_PYTHON`)
- AutoDock Vina on `PATH`, or `VINA_BIN` pointing at the executable
- Meeko (`mk_prepare_ligand.py` and `mk_prepare_receptor.py`) or Open Babel (`obabel`)

If any of those are missing, the API reports **Docking engine unavailable** and does not write a binding affinity.

Search-box coordinates come from a curated docking profile. The profile names the receptor and reference entity; the server calculates the box from the downloaded PDB and does not ask the researcher for coordinates.

Set `DOCKING_ARTIFACT_DIR` to keep ligand, receptor, configuration, Vina log, and pose files on disk. Without that directory, those files are not copied into Firestore. A successful run still stores the parsed mode table, and the best-pose coordinates when Vina returned them and they fit the result record.

On this workstation the tools live outside git:

- `tools/vina/vina.exe` (AutoDock Vina 1.2.7), referenced by `VINA_BIN`
- `.docking-venv` (Python 3.11, Meeko, RDKit, and Open Babel), referenced by `DOCKING_PYTHON`

`DOCKING_TIMEOUT_SECONDS` defaults to 900.
