# =========================================================================
# TALIHO V3 - LOCAL INTEGRATION TEST RUNNER (PowerShell)
# =========================================================================
#
# This script mirrors the GitHub Actions integration-tests.yml workflow
# for local debugging and development.
#
# Prerequisites:
#   - Docker Desktop running (for MongoDB)
#   - Node.js 20+ installed
#   - Backend repo at: ..\backend (override with -BackendDir)
#
# Usage:
#   .\scripts\run-integration-local.ps1                    # Full test run
#   .\scripts\run-integration-local.ps1 -TestMode smoke    # Smoke tests only
#   .\scripts\run-integration-local.ps1 -SkipBuild         # Skip backend build
#   .\scripts\run-integration-local.ps1 -KeepRunning       # Keep servers running after tests
#   .\scripts\run-integration-local.ps1 -Debug             # Enable debug logging
#
# =========================================================================

param(
    [ValidateSet("smoke", "full", "desktop-only", "mobile-only")]
    [string]$TestMode = "full",

    [switch]$SkipBuild,
    [switch]$KeepRunning,
    [switch]$Debug,
    [switch]$SkipDocker,
    [int]$Retries = 0,
    [int]$BackendPort = 8200,
    [int]$FrontendPort = 8273,
    [string]$BackendDir = ""
)

$ErrorActionPreference = "Stop"

# ─────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FRONTEND_DIR = Split-Path -Parent $SCRIPT_DIR
$DEFAULT_BACKEND_DIR = Join-Path (Split-Path -Parent $FRONTEND_DIR) "backend"
$BACKEND_DIR = if ([string]::IsNullOrWhiteSpace($BackendDir)) { $DEFAULT_BACKEND_DIR } else { $BackendDir }
$ROOT_DIR = Split-Path -Parent $FRONTEND_DIR
$LOCAL_DB_SCRIPT = Join-Path $SCRIPT_DIR "local-integration-db.cjs"

# Environment Variables (matching CI workflow)
$env:NODE_ENV = "test"
$env:PORT = "$BackendPort"
$env:DB_STRING = "mongodb://localhost:27017/taliho-integration"
$env:JWT_SECRET = "integration-test-jwt-secret-key-32chars"
$env:PASSWORD_ENCRYPTION_KEY = "integration-test-encrypt-key-32ch"
$env:TALIHO_CLIENT_URL = "http://localhost:$FrontendPort"
$env:APP_BASE_URL = "http://localhost:$BackendPort"
$env:APP_GUARD_BYPASS_WHEN_NO_KEYS = "true"
$env:TEST_API_KEY = "integration-test-api-key"

# E2E Test Credentials
$env:E2E_TEST_ADMIN_EMAIL = "e2e-admin@testcompany.com"
$env:E2E_TEST_ADMIN_PASSWORD = "E2ETestPassword123!"
$env:E2E_TEST_ADMIN_FIRST_NAME = "E2E"
$env:E2E_TEST_ADMIN_LAST_NAME = "Admin"
$env:E2E_TEST_COMPANY_NAME = "E2E Test Company"

# AWS S3 (stub values)
$env:AWS_REGION = "ap-east-1"
$env:AWS_ACCESS_KEY_ID = "test-access-key-id"
$env:AWS_SECRET_ACCESS_KEY = "test-secret-access-key"
$env:AWS_BUCKET_NAME = "test-integration-bucket"
$env:DISABLE_S3_UPLOADS = "true"

# External APIs (stub values)
$env:ZOHO_API_ACCOUNTS_URL = "https://accounts.zoho.com"
$env:SENDGRID_API_KEY = "SG.integration-test-key-placeholder"

# Frontend Configuration
$env:FRONTEND_PORT = "$FrontendPort"
$env:PLAYWRIGHT_PORT = "$FrontendPort"
$env:BASE_URL = "http://localhost:$FrontendPort"
$env:PLAYWRIGHT_TEST_BASE_URL = "http://localhost:$FrontendPort"
$env:VITE_BACKEND_URL = "http://localhost:$BackendPort"
$env:PLAYWRIGHT_BACKEND_URL = "http://localhost:$BackendPort"
$env:VITE_ENVIRONMENT = "test"
$env:VITE_TALIHO_API_KEY = "integration-test-api-key"
$env:VITE_PROCORE_BASE_URL = "https://sandbox.procore.com"

# Stripe Test IDs
$env:VITE_STRIPE_PRODUCT_ID_EARLY_ADOPTER = "prod_test_early_adopter"
$env:VITE_STRIPE_PRODUCT_ID_STANDARD = "prod_test_standard"
$env:VITE_STRIPE_PRODUCT_ID_PROFESSIONAL = "prod_test_professional"
$env:VITE_STRIPE_PRODUCT_ID_BUSINESS = "prod_test_business"
$env:VITE_STRIPE_PRICE_STANDARD_MONTHLY = "price_test_standard_monthly"
$env:VITE_STRIPE_PRICE_STANDARD_ANNUAL = "price_test_standard_annual"
$env:VITE_STRIPE_PRICE_PROFESSIONAL_MONTHLY = "price_test_professional_monthly"
$env:VITE_STRIPE_PRICE_PROFESSIONAL_ANNUAL = "price_test_professional_annual"
$env:VITE_STRIPE_PRICE_BUSINESS_MONTHLY = "price_test_business_monthly"
$env:VITE_STRIPE_PRICE_BUSINESS_ANNUAL = "price_test_business_annual"
$env:VITE_STRIPE_STORAGE_ADDON_PRICE = "19"

# Process tracking
$script:BackendProcess = $null
$script:DockerStarted = $false
$script:NpxCommand = $null

# ─────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "=======================================================================" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "=======================================================================" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "--- $Message ---" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Err {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Get-NpxCommand {
    $npxCmd = Get-Command "npx.cmd" -ErrorAction SilentlyContinue
    if ($npxCmd) {
        return $npxCmd.Source
    }

    $npx = Get-Command "npx" -ErrorAction SilentlyContinue
    if ($npx) {
        return $npx.Source
    }

    throw "npx is not installed or not available on PATH"
}

function Invoke-ExternalCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $commandParts = @($FilePath) + $Arguments
    $escapedCommand = ($commandParts | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\"') + '"'
        }
        else {
            $_
        }
    }) -join " "

    cmd.exe /d /c "$escapedCommand 2>&1" | ForEach-Object { Write-Host $_ }
    $exitCode = $LASTEXITCODE

    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "Command failed with exit code ${exitCode}: $FilePath $($Arguments -join ' ')"
    }

    return $exitCode
}

function Test-PortInUse {
    param([int]$Port)

    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        return $connection
    }
    catch {
        return $null
    }
}

function Assert-PortAvailable {
    param(
        [int]$Port,
        [string]$Name
    )

    $connection = Test-PortInUse -Port $Port
    if ($connection) {
        $pid = $connection.OwningProcess
        throw "$Name port $Port is already in use by PID $pid"
    }
}

function Invoke-LocalDbScript {
    param(
        [ValidateSet("seed", "cleanup")]
        [string]$Action
    )

    if (-not (Test-Path $LOCAL_DB_SCRIPT)) {
        throw "Local DB helper not found at: $LOCAL_DB_SCRIPT"
    }

    Push-Location $FRONTEND_DIR
    try {
        & node $LOCAL_DB_SCRIPT $BACKEND_DIR $Action
        if ($LASTEXITCODE -ne 0) {
            throw "Local DB helper failed for action '$Action'"
        }
    }
    finally {
        Pop-Location
    }
}

function Wait-ForEndpoint {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 60,
        [string]$Name = "Service"
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $attempt = 0

    while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $attempt++
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "$Name is ready (attempt $attempt)"
                return $true
            }
        }
        catch {
            # Silently continue
        }
        Write-Host "Waiting for $Name... (attempt $attempt)" -ForegroundColor Gray
        Start-Sleep -Seconds 1
    }

    Write-Err "$Name failed to start within $TimeoutSeconds seconds"
    return $false
}

function Stop-BackendServer {
    if ($script:BackendProcess -and !$script:BackendProcess.HasExited) {
        Write-Info "Stopping backend server (PID: $($script:BackendProcess.Id))..."
        Stop-Process -Id $script:BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }

    # Also kill any orphaned node processes running the backend
    $backendFolderName = Split-Path -Leaf $BACKEND_DIR
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            if ($_.MainModule.FileName -like "*$backendFolderName*") {
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
}

function Stop-DockerServices {
    if ($script:DockerStarted) {
        Write-Info "Stopping Docker services..."
        Push-Location $FRONTEND_DIR
        try {
            Invoke-ExternalCommand -FilePath "docker-compose" -Arguments @("-f", "docker-compose.integration.yml", "down", "-v", "--remove-orphans") -AllowFailure | Out-Null
        }
        catch {
            Write-Info "Docker cleanup returned a non-zero exit code; continuing"
        }
        finally {
            Pop-Location
        }
    }
}

function Invoke-Cleanup {
    Write-Header "CLEANUP"

    Stop-BackendServer

    if (-not $KeepRunning) {
        Stop-DockerServices

        # Cleanup the same database target used by the backend
        Write-Info "Cleaning up test database..."
        try {
            Invoke-LocalDbScript -Action "cleanup"
        }
        catch {
            Write-Info "Database cleanup returned a non-zero exit code; continuing"
        }
    }
    else {
        Write-Info "Keeping services running (-KeepRunning specified)"
        Write-Info "  Backend: http://localhost:$BackendPort"
        Write-Info "  MongoDB: mongodb://localhost:27017"
    }

    Write-Success "Cleanup complete"
}

# ─────────────────────────────────────────────────────────────────────────
# MAIN SCRIPT
# ─────────────────────────────────────────────────────────────────────────

Write-Header "TALIHO V3 - LOCAL INTEGRATION TESTS"

Write-Host ""
Write-Host "Configuration:" -ForegroundColor White
Write-Host "  Test Mode:    $TestMode"
Write-Host "  Skip Build:   $SkipBuild"
Write-Host "  Keep Running: $KeepRunning"
Write-Host "  Debug:        $Debug"
Write-Host "  Retries:      $Retries"
Write-Host "  Backend Port: $BackendPort"
Write-Host "  Frontend Port:$FrontendPort"
Write-Host ""
Write-Host "Directories:" -ForegroundColor White
Write-Host "  Frontend:     $FRONTEND_DIR"
Write-Host "  Backend:      $BACKEND_DIR"

# ─────────────────────────────────────────────────────────────────────────
# PREREQUISITES CHECK
# ─────────────────────────────────────────────────────────────────────────

Write-Step "Checking Prerequisites"

# Check Node.js
if (-not (Test-CommandExists "node")) {
    Write-Err "Node.js is not installed"
    exit 1
}
$nodeVersion = node --version
Write-Success "Node.js: $nodeVersion"

try {
    $script:NpxCommand = Get-NpxCommand
    Write-Success "npx is available"
}
catch {
    Write-Err $_.Exception.Message
    exit 1
}

# Check Docker
if (-not $SkipDocker) {
    if (-not (Test-CommandExists "docker")) {
        Write-Err "Docker is not installed. Install Docker Desktop or use -SkipDocker flag"
        exit 1
    }

    $dockerRunning = docker info 2>$null
    if (-not $dockerRunning) {
        Write-Err "Docker is not running. Please start Docker Desktop"
        exit 1
    }
    Write-Success "Docker is running"
}

# Check backend directory
if (-not (Test-Path $BACKEND_DIR)) {
    Write-Err "Backend directory not found at: $BACKEND_DIR"
    exit 1
}
Write-Success "Backend directory found"

if (-not (Test-Path $LOCAL_DB_SCRIPT)) {
    Write-Err "Local DB helper not found at: $LOCAL_DB_SCRIPT"
    exit 1
}
Write-Success "Local DB helper found"

# ─────────────────────────────────────────────────────────────────────────
# START DOCKER SERVICES (MongoDB)
# ─────────────────────────────────────────────────────────────────────────

if (-not $SkipDocker) {
    Write-Step "Starting Docker Services (MongoDB)"

    # Use the existing docker-compose file
    $dockerComposeFile = Join-Path $FRONTEND_DIR "docker-compose.integration.yml"
    if (-not (Test-Path $dockerComposeFile)) {
        Write-Err "docker-compose.integration.yml not found. Please ensure it exists."
        exit 1
    }

    Push-Location $FRONTEND_DIR
    try {
        Invoke-ExternalCommand -FilePath "docker-compose" -Arguments @("-f", "docker-compose.integration.yml", "up", "-d", "--remove-orphans") | Out-Null
        $script:DockerStarted = $true
    }
    finally {
        Pop-Location
    }

    # Wait for MongoDB to be healthy
    Write-Info "Waiting for MongoDB to be ready..."
    $mongoReady = $false
    for ($i = 1; $i -le 30; $i++) {
        $health = docker inspect --format='{{.State.Health.Status}}' taliho-mongodb 2>$null
        if ($health -eq "healthy") {
            $mongoReady = $true
            break
        }
        Write-Host "  MongoDB health check... ($i/30)" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }

    if (-not $mongoReady) {
        Write-Err "MongoDB failed to start"
        exit 1
    }
    Write-Success "MongoDB is ready"
}

# ─────────────────────────────────────────────────────────────────────────
# INSTALL DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────

Write-Step "Installing Dependencies"

# Frontend
Write-Info "Installing frontend dependencies..."
Push-Location $FRONTEND_DIR
if (-not (Test-Path "node_modules")) {
    npm ci
}
else {
    Write-Info "Frontend node_modules exists, skipping install"
}
Pop-Location

# Backend
Write-Info "Installing backend dependencies..."
Push-Location $BACKEND_DIR
if (-not (Test-Path "node_modules")) {
    npm ci --legacy-peer-deps
}
else {
    Write-Info "Backend node_modules exists, skipping install"
}
Pop-Location

Write-Success "Dependencies installed"

# ─────────────────────────────────────────────────────────────────────────
# BUILD BACKEND
# ─────────────────────────────────────────────────────────────────────────

if (-not $SkipBuild) {
    Write-Step "Building Backend"

    Push-Location $BACKEND_DIR
    npm run build
    Pop-Location

    Write-Success "Backend built successfully"
}
else {
    Write-Info "Skipping backend build (-SkipBuild specified)"
}

# ─────────────────────────────────────────────────────────────────────────
# SEED TEST DATABASE
# ─────────────────────────────────────────────────────────────────────────

Write-Step "Seeding Test Database"

Write-Info "Seeding the backend database configured at $($env:DB_STRING)..."
Invoke-LocalDbScript -Action "seed"
Write-Success "Database seeded successfully"

# ─────────────────────────────────────────────────────────────────────────
# START BACKEND SERVER
# ─────────────────────────────────────────────────────────────────────────

Write-Step "Starting Backend Server"

try {
    Assert-PortAvailable -Port $BackendPort -Name "Backend"
    Assert-PortAvailable -Port $FrontendPort -Name "Frontend"
}
catch {
    Write-Err $_.Exception.Message
    exit 1
}

Push-Location $BACKEND_DIR

# Start backend in background
$backendLogFile = Join-Path $ROOT_DIR "backend-local.log"
$script:BackendProcess = Start-Process -FilePath "node" -ArgumentList "dist/main" -PassThru -NoNewWindow -RedirectStandardOutput $backendLogFile -RedirectStandardError "$backendLogFile.err"

Write-Info "Backend PID: $($script:BackendProcess.Id)"
Write-Info "Backend logs: $backendLogFile"

Pop-Location

# Wait for backend health
if (-not (Wait-ForEndpoint -Url "http://localhost:$BackendPort/health" -TimeoutSeconds 60 -Name "Backend")) {
    Write-Err "Backend failed to start. Check logs at: $backendLogFile"
    Get-Content $backendLogFile -Tail 50
    Invoke-Cleanup
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────
# RUN PLAYWRIGHT TESTS
# ─────────────────────────────────────────────────────────────────────────

Write-Step "Running Playwright Integration Tests"

# Determine test projects based on mode
$testProjects = switch ($TestMode) {
    "smoke"        { @("Desktop Chrome") }
    "desktop-only" { @("Desktop Chrome") }
    "mobile-only"  { @("Mobile Safari", "Mobile Chrome") }
    "full"         { @("Desktop Chrome", "Mobile Safari") }
}

Write-Info "Test projects: $($testProjects -join ', ')"

Push-Location $FRONTEND_DIR

# Install Playwright browsers if needed
Write-Info "Ensuring Playwright browsers are installed..."
& $script:NpxCommand "playwright" "install" "chromium" "webkit"
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Err "Failed to install Playwright browsers"
    Invoke-Cleanup
    exit 1
}

# Build project arguments
$projectArgs = @()
foreach ($project in $testProjects) {
    $projectArgs += "--project=$project"
}

# Set test environment variables
$env:CI = "true"
$env:BASE_URL = "http://localhost:$FrontendPort"
$env:PLAYWRIGHT_TEST_BASE_URL = "http://localhost:$FrontendPort"

if ($Debug) {
    $env:DEBUG = "pw:api"
}

# Run tests
$playwrightArgs = @(
    "playwright",
    "test",
    "--config=playwright.real-backend.config.ts",
    "--retries=$Retries"
) + $projectArgs
Write-Info "Running: $($script:NpxCommand) $($playwrightArgs -join ' ')"

try {
    & $script:NpxCommand @playwrightArgs
    $testExitCode = $LASTEXITCODE
}
catch {
    $testExitCode = 1
}

Pop-Location

# ─────────────────────────────────────────────────────────────────────────
# RESULTS
# ─────────────────────────────────────────────────────────────────────────

Write-Header "TEST RESULTS"

if ($testExitCode -eq 0) {
    Write-Success "All integration tests passed!"
}
else {
    Write-Err "Integration tests failed with exit code: $testExitCode"
    Write-Info "Check the Playwright report: $FRONTEND_DIR\playwright-report\real-backend\index.html"
}

# ─────────────────────────────────────────────────────────────────────────
# CLEANUP
# ─────────────────────────────────────────────────────────────────────────

Invoke-Cleanup

exit $testExitCode
