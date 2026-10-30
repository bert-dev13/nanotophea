# NANOTOPHEA MySQL / MariaDB Setup & Local Development Guide

This guide walks you through setting up and running **NANOTOPHEA** locally with **XAMPP MySQL / MariaDB** and **phpMyAdmin**.

---

## 1. Prerequisites

Make sure the following are installed on your machine:
- **Node.js** (v18.17+ or v20+)
- **XAMPP for Windows** (with Apache and MySQL / MariaDB)
- **Python 3.10+** (with AutoDock Vina, Meeko, and required scientific packages if running local docking)

---

## 2. Environment Configuration

1. In the project root, verify your `.env.local` file contains the MySQL configuration:

```env
# MySQL / MariaDB Connection
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=nanotophea

# Firebase Authentication (Keep active for authentication and user sessions)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
...
```

> **Note**: In standard XAMPP installations, the default MySQL user is `root` with **no password** (`MYSQL_PASSWORD=`).

---

## 3. Database Initialization

1. Start **Apache** and **MySQL** in your **XAMPP Control Panel**.
2. Open your web browser and navigate to:
   [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/)
3. To initialize the tables and migrate data from Firestore, run:

```bash
# Initialize relational schema (creates the 20 tables)
npx tsx lib/db/init.ts

# Migrate existing Firestore data into MySQL (safe to re-run)
npx tsx scripts/migrate-firestore-to-mysql.ts
```

4. Refresh phpMyAdmin. You will see the `nanotophea` database with all 20 relational tables populated:
   - `users`
   - `user_profiles`
   - `studies`
   - `study_members`
   - `formulations`
   - `phytochemicals`
   - `target_proteins`
   - `cell_lines`
   - `admet_runs`
   - `docking_pairs`
   - `docking_runs`
   - `docking_jobs`
   - `biological_predictions`
   - `lab_datasets`
   - `lab_replicates`
   - `statistical_analyses`
   - `comparisons`
   - `interpretations`
   - `references`
   - `audit_logs`
   - `literature_cache`

---

## 4. Standard Daily Development Workflow

Follow these simple steps whenever you work on NANOTOPHEA:

### Step 1: Open XAMPP Control Panel
- Launch **XAMPP Control Panel**.
- Click **Start** next to **Apache** (needed for phpMyAdmin).
- Click **Start** next to **MySQL** (port 3306).

### Step 2: (Optional) Open phpMyAdmin
- Open [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/) to view, query, and inspect live database records.

### Step 3: Start the Docking / Python Service (if executing molecular docking)
- If running local docking with AutoDock Vina & Meeko, ensure Python and Vina are available in your system PATH or your configured virtual environment.

### Step 4: Start the Next.js Development Server
- Open a terminal in the `nanotophea` directory:
```bash
npm run dev
```

### Step 5: Open NANOTOPHEA in Browser
- Open [http://localhost:3000](http://localhost:3000) in your web browser.
- Log in using your Firebase Authentication credentials. All research data, studies, docking pairs, runs, and lab records will load from and persist directly to your local MySQL database!

---

## 5. Verifying in phpMyAdmin

1. In phpMyAdmin, click on the **nanotophea** database in the left sidebar.
2. Click on **`docking_pairs`** or **`docking_runs`** to view docking records.
   - Note the `uq_docking_pair` unique constraint `(study_id, compound_id, protein_id)`. Re-running docking on an existing pair increments `runs_count` and updates `latest_run_id` without creating duplicate pairs.
3. Click on **`studies`** to see your active research projects.
4. Click on **`phytochemicals`** and **`target_proteins`** to see your research setup.

---

## 6. Architecture & Security Notes

- **Firebase Authentication**: Remains the identity and login provider. Authenticated user tokens are verified on the server, and the Firebase UID is linked to MySQL `users` and `audit_logs`.
- **Client Components**: All Next.js client components invoke Server Actions (`"use server"` repositories) or API routes. No database credentials or raw MySQL connections are ever exposed to the client browser.
- **AutoDock Vina & Provenance**: Special targets (e.g. LATS1 with AlphaFold DB model `AF-O95835-F1`, YAP1 with PDB `3KYS` TEAD1 domain) retain full scientific provenance in relational columns and structured JSON metadata.
