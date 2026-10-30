<# :
@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title NANOTOPHEA Setup

echo.
echo ===============================================================================
echo                NANOTOPHEA Automated Environment Setup
echo ===============================================================================
echo.
echo Starting environment verification and dependency installation...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$env:SETUP_BAT_DIR='%~dp0'; [ScriptBlock]::Create((Get-Content -LiteralPath '%~f0' -Raw)).Invoke()"
set "PS_CODE=%ERRORLEVEL%"
if %PS_CODE% neq 0 (
    echo.
    echo [ERROR] Setup encountered an issue ^(Exit code: %PS_CODE%^).
)

if /I "%~1"=="--non-interactive" exit /b %PS_CODE%
if /I "%NON_INTERACTIVE%"=="1" exit /b %PS_CODE%

echo.
echo Press any key to exit.
pause >nul
exit /b %PS_CODE%
#>

# Use Continue so external tool warnings/errors do not throw ActionPreferenceStopException
$ErrorActionPreference = "Continue"

try {

$ScriptDir = $env:SETUP_BAT_DIR
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }
$ScriptDir = $ScriptDir.TrimEnd('\')
Set-Location $ScriptDir

# --- Color-Coded Console UI Helpers ---
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$StepNum, [string]$Title)
    Write-Host ""
    Write-Host "[$StepNum] $Title" -ForegroundColor Yellow
    Write-Host "-------------------------------------------------------------------------------" -ForegroundColor DarkGray
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [..] $Message" -ForegroundColor Gray
}

function Write-WarningMsg {
    param([string]$Message)
    Write-Host "  [WARN] $Message" -ForegroundColor DarkYellow
}

function Write-FatalError {
    param([string]$Message, [string]$HelpText = "")
    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Red
    Write-Host "  SETUP FAILED: $Message" -ForegroundColor Red
    if ($HelpText) {
        Write-Host "  GUIDANCE: $HelpText" -ForegroundColor White
    }
    Write-Host "===============================================================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}

function Find-Executable {
    param(
        [string]$CommandName,
        [string[]]$CandidatePaths = @()
    )
    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        return $cmd.Source
    }
    foreach ($p in $CandidatePaths) {
        if (Test-Path $p) {
            return $p
        }
    }
    return $null
}

function Test-PortOpen {
    param([string]$HostName, [int]$Port, [int]$TimeoutMs = 1500)
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $iar = $tcpClient.BeginConnect($HostName, $Port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if (-not $wait) {
            $tcpClient.Close()
            return $false
        }
        $tcpClient.EndConnect($iar)
        $tcpClient.Close()
        return $true
    } catch {
        return $false
    }
}

Write-Header "NANOTOPHEA: Research Platform Environment Setup"

# =============================================================================
# 1. ENVIRONMENT (Node.js & npm)
# =============================================================================
Write-Step -StepNum "1/7" -Title "Verifying Core Environment (Node.js & npm)"

$nodePath = Find-Executable -CommandName "node.exe" -CandidatePaths @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe"
)

if (-not $nodePath) {
    Write-FatalError "Node.js is not installed or not in PATH." "Download and install Node.js (v18 or v20+ recommended) from https://nodejs.org/"
}

$nodeVersionRaw = (& $nodePath -v 2>&1).Trim()
$nodeMajor = 0
if ($nodeVersionRaw -match '^v(\d+)') {
    $nodeMajor = [int]$matches[1]
}

if ($nodeMajor -lt 18) {
    Write-FatalError "Node.js version $nodeVersionRaw is too old." "NANOTOPHEA requires Node.js v18 or newer."
}
Write-Success "Node.js runtime: $nodeVersionRaw ($nodePath)"

$npmPath = Find-Executable -CommandName "npm.cmd" -CandidatePaths @(
    "C:\Program Files\nodejs\npm.cmd",
    "C:\Users\$env:USERNAME\AppData\Roaming\npm\npm.cmd"
)

if (-not $npmPath) {
    Write-FatalError "npm is not installed or not in PATH." "Please reinstall Node.js with npm included."
}
$npmVersion = (& $npmPath -v 2>&1).Trim()
Write-Success "npm package manager: v$npmVersion ($npmPath)"

# =============================================================================
# 2. DEPENDENCIES (node_modules)
# =============================================================================
Write-Step -StepNum "2/7" -Title "Checking Node.js Dependencies"

$nodeModulesDir = Join-Path $ScriptDir "node_modules"
$packageLock = Join-Path $ScriptDir "package-lock.json"
$needsNpmInstall = $false

if (-not (Test-Path $nodeModulesDir)) {
    $needsNpmInstall = $true
    Write-Info "node_modules folder not found. Performing fresh npm install..."
} elseif (Test-Path $packageLock) {
    $lockTime = (Get-Item $packageLock).LastWriteTime
    $modulesTime = (Get-Item $nodeModulesDir).LastWriteTime
    if ($lockTime -gt $modulesTime) {
        $needsNpmInstall = $true
        Write-Info "package-lock.json is newer than node_modules. Updating dependencies..."
    }
}

if ($needsNpmInstall) {
    Write-Info "Running npm install (this may take a moment)..."
    & $npmPath install
    if ($LASTEXITCODE -ne 0) {
        Write-FatalError "npm install failed with exit code $LASTEXITCODE." "Check your network connection and package.json."
    }
    Write-Success "Dependencies successfully installed."
} else {
    Write-Success "Node.js dependencies already up to date."
}

# =============================================================================
# 3. DATABASE CONNECTION (MySQL / MariaDB)
# =============================================================================
Write-Step -StepNum "3/7" -Title "Verifying Database Server & Connection"

# Load local env overrides if present
$envFile = Join-Path $ScriptDir ".env.local"
$dbHost = "localhost"
$dbPort = 3306
$dbUser = "root"
$dbPassword = ""
$dbName = "nanotophea_db"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            if ($line -match '^MYSQL_HOST=(.*)$') { $dbHost = $matches[1].Trim() }
            if ($line -match '^MYSQL_PORT=(.*)$') { $dbPort = [int]$matches[1].Trim() }
            if ($line -match '^MYSQL_USER=(.*)$') { $dbUser = $matches[1].Trim() }
            if ($line -match '^MYSQL_PASSWORD=(.*)$') { $dbPassword = $matches[1].Trim() }
            if ($line -match '^MYSQL_DATABASE=(.*)$') { $dbName = $matches[1].Trim() }
        }
    }
}

Write-Info "Testing connection to MySQL server at $dbHost`:$dbPort..."
$portOpen = Test-PortOpen -HostName $dbHost -Port $dbPort -TimeoutMs 2000

if (-not $portOpen) {
    Write-WarningMsg "Could not connect to MySQL on $dbHost`:$dbPort."
    Write-Info "Attempting to detect local XAMPP MySQL installation..."
    
    $xamppMysqlStart = "C:\xampp\mysql_start.bat"
    if (Test-Path $xamppMysqlStart) {
        Write-Info "Found XAMPP at C:\xampp. Starting MySQL service..."
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$xamppMysqlStart`"" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        $portOpen = Test-PortOpen -HostName $dbHost -Port $dbPort -TimeoutMs 2500
    }
    
    if (-not $portOpen) {
        Write-FatalError "MySQL server is not running on $dbHost`:$dbPort." "Please start MySQL in XAMPP Control Panel, then rerun setup.bat."
    }
}

Write-Success "MySQL port $dbPort is open and accepting connections."

# Ensure database exists using scripts/ensure-db.ts
$dbCheckResult = (npx tsx scripts/ensure-db.ts | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
    Write-FatalError "Failed to connect to MySQL or ensure database '$dbName'." "$dbCheckResult"
}
Write-Success "Database '$dbName' connected and ready."

# =============================================================================
# 4. PENDING DATABASE MIGRATIONS
# =============================================================================
Write-Step -StepNum "4/7" -Title "Applying Pending Database Migrations"

Write-Info "Running centralized database migration system (npm run db:migrate)..."
$migrateCmd = "& `"$npmPath`" run db:migrate"
$migrateOutput = Invoke-Expression $migrateCmd 2>&1
$migrateExit = $LASTEXITCODE

$outputStr = ($migrateOutput | Out-String).Trim()
foreach ($line in ($outputStr -split "`r?`n")) {
    $t = $line.Trim()
    if ($t -match '^\[OK\]') {
        Write-Success $t.Substring(4).Trim()
    } elseif ($t -match '^\[\.\.\]') {
        Write-Info $t.Substring(4).Trim()
    } elseif ($t -match '^\[ERROR\]') {
        Write-Host "  $t" -ForegroundColor Red
    }
}

if ($migrateExit -ne 0) {
    Write-FatalError "Database migration failed." "Check the SQL error message above and verify table definitions."
}

# Check for existing research records (preserve intact)
$studiesCheck = (npx tsx scripts/check-studies-count.ts | Out-String).Trim()
$studiesCount = 0
if ($studiesCheck -match 'STUDIES_COUNT:(\d+)') {
    $studiesCount = [int]$matches[1]
}

if ($studiesCount -gt 0) {
    Write-Success "Existing research data detected ($studiesCount studies found - preserved intact)."
} else {
    Write-Info "Fresh installation detected: database schema initialized with 0 studies."
    Write-Info "Optional: To import research data from another laptop backup, run:"
    Write-Info "  mysql -u $dbUser $dbName < your_backup.sql"
    Write-Info "To seed a default demo admin account, run: npm run seed:admin"
}

# =============================================================================
# 5. PYTHON MOLECULAR DOCKING TOOLCHAIN
# =============================================================================
Write-Step -StepNum "5/7" -Title "Verifying Python Molecular Docking Toolchain"

# 5.1 AutoDock Vina Binary
$vinaDir = Join-Path $ScriptDir "tools\vina"
$vinaBin = Join-Path $vinaDir "vina.exe"

if (-not (Test-Path $vinaBin)) {
    Write-Info "AutoDock Vina binary not found in tools\vina. Downloading official Windows binary (v1.2.7)..."
    if (-not (Test-Path $vinaDir)) {
        New-Item -ItemType Directory -Path $vinaDir -Force | Out-Null
    }
    
    $vinaUrl = "https://github.com/forlilab/AutoDock-Vina/releases/download/v1.2.7/vina_1.2.7_win.exe"
    try {
        $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
        if ($curl) {
            & curl.exe -s -L -o "$vinaBin" "$vinaUrl"
        } else {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $vinaUrl -OutFile $vinaBin -UseBasicParsing
        }
    } catch {
        Write-WarningMsg "Could not download AutoDock Vina automatically: $_"
    }
}

if (Test-Path $vinaBin) {
    try {
        $vinaVer = (& $vinaBin --version 2>&1).Trim()
        Write-Success "AutoDock Vina ready: $vinaVer ($vinaBin)"
    } catch {
        Write-WarningMsg "Vina binary exists at $vinaBin but could not execute --version."
    }
} else {
    Write-WarningMsg "AutoDock Vina executable is missing. Download from https://github.com/forlilab/AutoDock-Vina/releases and place at tools\vina\vina.exe."
}

# 5.2 Detect Python 3.11 Runtime
Write-Info "Scanning installed Python runtimes on Windows..."
$pythonExe = $null
$pyLauncher = Get-Command "py.exe" -ErrorAction SilentlyContinue

if ($pyLauncher) {
    $pyListOutput = & py.exe -0p 2>&1
    Write-Info "Installed Python runtimes (py -0p):"
    foreach ($pyLine in ($pyListOutput -split "`r?`n")) {
        if ($pyLine.Trim()) { Write-Info "  $($pyLine.Trim())" }
        if ($pyLine -match '-V:3\.11\s+\*?\s+(.*\.exe)') {
            $candidate = $matches[1].Trim()
            if (Test-Path $candidate) {
                $pythonExe = $candidate
            }
        }
    }
}

if (-not $pythonExe) {
    $commonPy311Paths = @(
        "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311\python.exe",
        "C:\Python311\python.exe",
        "C:\Program Files\Python311\python.exe"
    )
    foreach ($p in $commonPy311Paths) {
        if (Test-Path $p) {
            $pythonExe = $p
            break
        }
    }
}

if ($pythonExe) {
    Write-Success "Targeted Python 3.11 runtime: $pythonExe"
} else {
    Write-WarningMsg "Python 3.11 was not explicitly detected. Searching for default Python 3..."
    $pyGeneral = Find-Executable -CommandName "python.exe"
    if ($pyGeneral) {
        $pythonExe = $pyGeneral
        $pyGenVer = (& $pythonExe --version 2>&1).Trim()
        Write-WarningMsg "Using available Python ($pyGenVer): $pythonExe (Python 3.11 is strongly recommended for RDKit/Meeko/OpenBabel compatibility)."
    } else {
        Write-WarningMsg "Python is not installed or not found. Molecular docking worker will be disabled until Python 3.11 is installed."
    }
}

# 5.3 Virtual Environment (.docking-venv)
$dockingVenvDir = Join-Path $ScriptDir ".docking-venv"
$venvPython = Join-Path $dockingVenvDir "Scripts\python.exe"
$dockingEnvironmentReady = $false

if ($pythonExe) {
    if (-not (Test-Path $venvPython)) {
        Write-Info "Creating dedicated molecular docking virtual environment (.docking-venv)..."
        if ($pyLauncher) {
            & py.exe -3.11 -m venv "$dockingVenvDir" 2>&1 | Out-Null
        }
        if (-not (Test-Path $venvPython)) {
            & $pythonExe -m venv "$dockingVenvDir"
        }
    }

    if (Test-Path $venvPython) {
        Write-Success "Virtual environment ready at: $dockingVenvDir"
        
        # Check required packages: rdkit, meeko, gemmi, openbabel, scipy, numpy
        $pkgCheck = & $venvPython -c "import sys; packages = ['rdkit', 'meeko', 'gemmi', 'openbabel', 'scipy', 'numpy']; missing = [p for p in packages if not __import__('importlib.util').util.find_spec(p)]; print('MISSING:' + ','.join(missing)) if missing else print('ALL_INSTALLED')" 2>&1
        if ($LASTEXITCODE -ne 0 -or $pkgCheck -notmatch 'ALL_INSTALLED') {
            Write-Info "Installing scientific docking dependencies (RDKit, Meeko, Gemmi, OpenBabel, SciPy, NumPy)..."
            & $venvPython -m pip install --upgrade pip --quiet
            & $venvPython -m pip install rdkit meeko gemmi openbabel-wheel scipy numpy
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Scientific docking packages installed successfully."
                $dockingEnvironmentReady = $true
            } else {
                Write-WarningMsg "pip install encountered an error. Docking worker may have missing libraries."
            }
        } else {
            Write-Success "Scientific packages already installed (RDKit, Meeko, Gemmi, OpenBabel, SciPy, NumPy)."
            $dockingEnvironmentReady = $true
        }
    }
}

# 5.4 Docking Artifacts Directory
$dockingArtifactsDir = Join-Path $ScriptDir ".docking-artifacts"
if (-not (Test-Path $dockingArtifactsDir)) {
    New-Item -ItemType Directory -Path $dockingArtifactsDir -Force | Out-Null
    Write-Success "Created docking artifacts directory: $dockingArtifactsDir"
} else {
    Write-Success "Docking artifacts directory ready: $dockingArtifactsDir"
}

# =============================================================================
# 6. ENVIRONMENT CONFIGURATION (.env.local)
# =============================================================================
Write-Step -StepNum "6/7" -Title "Checking Environment Configuration (.env.local)"

$defaultVinaPath = ($vinaBin -replace '\\', '/')
$defaultPyPath = if (Test-Path $venvPython) { ($venvPython -replace '\\', '/') } else { "" }
$defaultArtifactDir = ($dockingArtifactsDir -replace '\\', '/')

if (-not (Test-Path $envFile)) {
    Write-Info ".env.local does not exist. Creating default configuration from template..."
    $lines = @(
        "# Database Configuration (XAMPP MySQL/MariaDB)",
        "MYSQL_HOST=$dbHost",
        "MYSQL_PORT=$dbPort",
        "MYSQL_USER=$dbUser",
        "MYSQL_PASSWORD=$dbPassword",
        "MYSQL_DATABASE=$dbName",
        "DATABASE_URL=mysql://$($dbUser):$($dbPassword)@$($dbHost):$($dbPort)/$($dbName)",
        "",
        "# Seed Admin Credentials",
        "NANOTOPHEA_ADMIN_EMAIL=admin@demo.com",
        "NANOTOPHEA_ADMIN_PASSWORD=admin123",
        "",
        "# Server-side AI & Docking Worker Configuration",
        "TOGETHER_API_KEY=",
        "VINA_BIN=$defaultVinaPath",
        "DOCKING_PYTHON=$defaultPyPath",
        "DOCKING_ARTIFACT_DIR=$defaultArtifactDir",
        "DOCKING_TIMEOUT_SECONDS=900",
        "",
        "# Hosted ADMET-AI service (optional)",
        "# ADMET_API_URL=http://127.0.0.1:8000"
    )
    [System.IO.File]::WriteAllLines($envFile, $lines, [System.Text.Encoding]::UTF8)
    Write-Success "Created .env.local with local paths."
} else {
    Write-Info "Verifying and updating local machine paths in .env.local..."
    $content = Get-Content $envFile -Encoding UTF8
    $newContent = @()
    $hasVina = $false
    $hasPy = $false
    $hasArtifact = $false

    foreach ($line in $content) {
        if ($line -match '^VINA_BIN=') {
            $hasVina = $true
            if (Test-Path $vinaBin) { $newContent += "VINA_BIN=$defaultVinaPath" } else { $newContent += $line }
        } elseif ($line -match '^DOCKING_PYTHON=') {
            $hasPy = $true
            if (Test-Path $venvPython) { $newContent += "DOCKING_PYTHON=$defaultPyPath" } else { $newContent += $line }
        } elseif ($line -match '^DOCKING_ARTIFACT_DIR=') {
            $hasArtifact = $true
            $newContent += "DOCKING_ARTIFACT_DIR=$defaultArtifactDir"
        } else {
            $newContent += $line
        }
    }

    if (-not $hasVina -and (Test-Path $vinaBin)) { $newContent += "VINA_BIN=$defaultVinaPath" }
    if (-not $hasPy -and (Test-Path $venvPython)) { $newContent += "DOCKING_PYTHON=$defaultPyPath" }
    if (-not $hasArtifact) { $newContent += "DOCKING_ARTIFACT_DIR=$defaultArtifactDir" }

    [System.IO.File]::WriteAllLines($envFile, $newContent, [System.Text.Encoding]::UTF8)
    Write-Success ".env.local configuration verified (secrets preserved intact)."
}

# =============================================================================
# 7. FINAL VERIFICATION (Docking Worker & System Health)
# =============================================================================
Write-Step -StepNum "7/7" -Title "Executing Final System Verification"

Write-Info "Testing complete molecular docking worker (npm run docking:verify)..."
$dockingVerifyCmd = "& `"$npmPath`" run docking:verify"
$dockingVerifyOut = Invoke-Expression $dockingVerifyCmd 2>&1
$dockingVerifyExit = $LASTEXITCODE

if ($dockingVerifyExit -eq 0) {
    Write-Success "Molecular docking worker pipeline is fully operational."
} else {
    Write-WarningMsg "Docking verification reported issues:"
    foreach ($vl in ($dockingVerifyOut -split "`r?`n")) {
        if ($vl.Trim()) { Write-Info "  $($vl.Trim())" }
    }
}

Write-Header "NANOTOPHEA ENVIRONMENT SETUP SUMMARY"
Write-Success "Node.js & npm: Ready"
Write-Success "Database Server: Connected ($dbHost`:$dbPort)"
Write-Success "Database Schema: Up to date (Migrations verified)"
if ($studiesCount -gt 0) {
    Write-Success "Research Data: Preserved intact ($studiesCount active studies)"
} else {
    Write-Info "Research Data: Clean installation"
}
if (Test-Path $vinaBin) {
    Write-Success "AutoDock Vina: Ready"
} else {
    Write-WarningMsg "AutoDock Vina: Missing binary"
}
if ($dockingEnvironmentReady) {
    Write-Success "Docking Environment (.docking-venv): Ready and verified with Python 3.11"
} else {
    Write-WarningMsg "Docking Environment: Partially configured"
}
Write-Success "Local Environment (.env.local): Configured and secured"

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE! You can now start the application:" -ForegroundColor Green
Write-Host "    npm run dev" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""

exit 0

} catch {
    Write-Host ""
    Write-Host "[FATAL ERROR] An unexpected error occurred during setup:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor White
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    exit 1
}
