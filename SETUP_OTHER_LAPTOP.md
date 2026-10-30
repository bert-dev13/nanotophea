# NANOTOPHEA Multi-Laptop Setup & Database Migration Guide

This guide describes how to synchronize and run **NANOTOPHEA** across multiple workstations (e.g. Laptop A and Laptop B) using the automated setup script and centralized database migration system.

---

## 1. Quick Start Workflow

### Everyday Collaborative Workflow

#### On Laptop A (Make Changes & Create Migrations)
1. Modify code or add a database migration in `migrations/`.
2. Commit code and migration files:
   ```bash
   git add .
   git commit -m "feat: add target protein binding annotations"
   git push origin main
   ```

#### On Laptop B (Pull & Sync)
1. Pull latest commits:
   ```bash
   git pull origin main
   ```
2. Run automated setup:
   ```cmd
   .\setup.bat
   ```
   *The setup script automatically verifies Node.js, installs any new npm dependencies, connects to MySQL, detects and executes pending migrations, verifies the Python 3.11 docking worker and AutoDock Vina, and secures `.env.local`.*
3. Start the application:
   ```bash
   npm run dev
   ```

---

## 2. What `setup.bat` Does

The Windows setup script executes 7 sequential phases:

```
[1/7] Environment Check      -> Node.js (>= 18) and npm
[2/7] Dependencies Check     -> node_modules up to date (runs npm install if needed)
[3/7] Database Connection    -> Checks MySQL port 3306 (starts XAMPP if stopped) & ensures nanotophea_db
[4/7] Database Migrations    -> Runs npm run db:migrate (executes ONLY pending migrations in order)
[5/7] Python Docking Stack   -> AutoDock Vina v1.2.7, Python 3.11, RDKit, Meeko, Gemmi, OpenBabel, SciPy
[6/7] Configuration Check    -> Ensures .env.local exists with machine-specific paths (never overwrites secrets)
[7/7] Final Verification     -> Runs npm run docking:verify to test the complete docking worker pipeline
```

The script is safe to rerun at any time. It skips components that are already configured and preserves all existing research records.

---

## 3. Centralized Database Migration System

Database schema updates are managed through tracked migration files in `migrations/` and recorded in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  batch INT NOT NULL,
  execution_time_ms INT NOT NULL,
  executed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
```

### Migration Commands

- **Apply pending migrations:**
  ```bash
  npm run db:migrate
  ```
- **Inspect migration status:**
  ```bash
  npm run db:status
  ```

### Current Core Migrations
- `001_initial_core_schema.ts` — Creates the 20 relational tables (`users`, `sessions`, `studies`, `study_members`, `formulations`, `phytochemicals`, `target_proteins`, `cell_lines`, `admet_runs`, `docking_pairs`, `docking_runs`, `docking_jobs`, `biological_predictions`, `laboratory_datasets`, `laboratory_replicates`, `statistics_analyses`, `comparisons`, `interpretations`, `references`, `audit_logs`, `literature_cache`).
- `002_performance_indexes.ts` — Applies high-frequency query indexes for fast study loading and docking outcome retrieval.
- `003_global_phytochemicals.ts` — Initializes the `global_phytochemicals` library and seeds standard catalog phytochemicals if empty.

### How to Create a New Migration
When you need to alter a table, add a column, or create an index:
1. Create a new file in `migrations/` following the naming format `00X_short_description.ts`.
2. Use helper methods from `lib/db/migration-helpers.ts` for safe, idempotent schema updates:
   ```ts
   import { addColumnIfNotExists, addIndexIfNotExists, type DbExecutor, type Migration } from "../lib/db/migration-helpers"

   export const migration: Migration = {
     id: "004_add_docking_resolution_meta",
     name: "Add resolution metadata to target proteins",
     async up(conn: DbExecutor) {
       await addColumnIfNotExists(
         conn,
         "target_proteins",
         "experimental_method_detail",
         "VARCHAR(255) NULL AFTER expected_method"
       )
     },
   }

   export default migration
   ```
3. Test locally with `npm run db:status` and `npm run db:migrate`.
4. Commit and push the migration file to GitHub. Other laptops will apply it automatically during their next `setup.bat`.

---

## 4. Molecular Docking Toolchain

NANOTOPHEA executes server-side AutoDock Vina jobs using a dedicated local worker environment:

- **AutoDock Vina:** Stored at `tools/vina/vina.exe` (v1.2.7). If missing, `setup.bat` automatically downloads the official release binary.
- **Python Runtime:** Python 3.11 is strongly preferred (detected using `py -0p`).
- **Virtual Environment:** Configured at `.docking-venv` with:
  - `rdkit`
  - `meeko` (includes `mk_prepare_ligand` and `mk_prepare_receptor`)
  - `gemmi`
  - `openbabel-wheel` (`obabel`)
  - `scipy`
  - `numpy`
- **Worker Script:** `services/docking/worker.py`
- **Docking Artifacts:** Stored at `.docking-artifacts`

### Verifying the Docking Worker
To manually test the complete docking worker pipeline at any time:
```bash
npm run docking:verify
```

---

## 5. Security and Environment Variables

- `.env.local` is strictly ignored by Git and will never be committed.
- Sensitive credentials (`TOGETHER_API_KEY`, database passwords, session secrets) must remain on the local machine.
- `setup.bat` only updates machine-specific file paths (`VINA_BIN`, `DOCKING_PYTHON`, `DOCKING_ARTIFACT_DIR`) and will never overwrite existing secrets.

---

## 6. Fresh Laptop Initial Setup Checklist

On a completely new laptop:
1. Install **Git for Windows** and **Node.js (v18 or v20+)**.
2. Install **XAMPP** (or MySQL server) and start the MySQL service on port 3306.
3. Install **Python 3.11** (ensure "Add Python to PATH" and the Python launcher `py.exe` are selected).
4. Clone the repository:
   ```bash
   git clone <repo-url> nanotophea
   cd nanotophea
   ```
5. Run the setup script:
   ```cmd
   .\setup.bat
   ```
6. (Optional) If you have an exported SQL backup of research records from another laptop, import it with:
   ```bash
   mysql -u root nanotophea_db < path_to_backup.sql
   ```
   Or seed the default admin account:
   ```bash
   npm run seed:admin
   ```
7. Start development:
   ```bash
   npm run dev
   ```
