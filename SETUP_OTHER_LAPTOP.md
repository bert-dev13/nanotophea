# HEPATOTEA Multi-Laptop Setup & Database Migration Guide

This guide describes how to synchronize and run **HEPATOTEA** across multiple workstations (e.g. Laptop A and Laptop B) using the automated setup script and centralized database migration system.

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
   *The setup script automatically verifies Node.js, installs any new npm dependencies, connects to MySQL, detects and executes pending migrations, verifies the Python 3.11 scientific environment (`.adme-venv`), downloads/verifies AutoDock Vina v1.2.7 with SHA-256 validation, and executes real end-to-end scientific docking and ADME tests.*
3. Start the application with local ADME & Docking:
   ```bash
   npm run dev:share
   ```

---

## 2. What `setup.bat` Does

The Windows setup script executes 7 sequential phases:

```
[1/7] Node.js & npm Runtime   -> Node.js (>= 18) and npm verification
[2/7] Environment Config      -> Creates safe .env.local template and .docking-artifacts/ (preserves existing secrets)
[3/7] Node Dependencies       -> Checks node_modules (runs npm install if needed)
[4/7] Database & Migrations   -> Checks MySQL port 3306 (starts XAMPP if stopped), ensures nanotophea_db, runs db:migrate
[5/7] Python Scientific Stack -> Python 3.11 detection, creates/verifies .adme-venv with RDKit, Meeko, Gemmi, OpenBabel, SciPy, ADMET-AI, PyTorch, Chemprop
[6/7] AutoDock Vina           -> Verifies tools/vina/vina.exe (v1.2.7). If missing, automatically downloads from official GitHub release with SHA-256 verification
[7/7] Scientific Verification -> Runs real Vina molecular docking test and real ADMET-AI prediction test
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
- `001_initial_core_schema.ts` — Creates the core relational tables (`users`, `sessions`, `studies`, `study_members`, `formulations`, `phytochemicals`, `target_proteins`, `cell_lines`, `admet_runs`, `docking_pairs`, `docking_runs`, `docking_jobs`, `biological_predictions`, `laboratory_datasets`, `laboratory_replicates`, `statistics_analyses`, `comparisons`, `interpretations`, `references`, `audit_logs`, `literature_cache`).
- `002_performance_indexes.ts` — Applies high-frequency query indexes for fast study loading and docking outcome retrieval.
- `003_global_phytochemicals.ts` — Initializes the `global_phytochemicals` library and seeds standard catalog phytochemicals if empty.

---

## 4. Scientific Engine & Toolchain Resolution

NANOTOPHEA resolves all scientific tools relative to the project root:

- **Python Runtime:** `<project>\.adme-venv\Scripts\python.exe`
- **AutoDock Vina:** `<project>\tools\vina\vina.exe` (v1.2.7)
- **Open Babel:** `<project>\.adme-venv\Scripts\obabel.exe`
- **Docking Artifacts:** `<project>\.docking-artifacts`

All tools are detected automatically without requiring manual Python environment activation (`Activate.ps1`) or VS Code interpreter selection.

### Starting Development (`npm run dev:share`)
NANOTOPHEA runs completely locally without external ngrok tunnels:
```bash
npm run dev:share
```
This single command displays a health check diagnostic banner and starts both:
- Next.js Web Application on `http://localhost:3000`
- Local ADME Microservice on `http://127.0.0.1:8000`

---

## 5. Security and Environment Variables

- `.env.local` is strictly ignored by Git and will never be committed.
- Sensitive credentials (`TOGETHER_API_KEY`, database passwords, session secrets) remain strictly local.
- `setup.bat` creates a safe default `.env.local` if missing and never overwrites existing secrets.

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
5. Run the automated setup script:
   ```cmd
   .\setup.bat
   ```
6. Start development:
   ```bash
   npm run dev:share
   ```
