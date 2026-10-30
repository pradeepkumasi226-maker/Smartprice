# ==============================================================================
# SmartPrice Production Startup Script (Windows PowerShell)
# ==============================================================================
# Usage:
#   .\start_production.ps1 [-Port 8000] [-HostAddress "0.0.0.0"]
# ==============================================================================

param (
    [int]$Port = 8000,
    [string]$HostAddress = "0.0.0.0"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SmartPrice AI Retail Engine - Production Startup" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Set and validate production environment flag
$env:ENVIRONMENT = "production"
$env:SMARTPRICE_ENV = "production"

# Resolve Python executable
$python = Join-Path $PSScriptRoot "backend\venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Host "[ERROR] Python virtual environment not found at: $python" -ForegroundColor Red
    Write-Host "Please create it and install production dependencies:"
    Write-Host "  cd backend && python -m venv venv && venv\Scripts\pip install -r requirements-prod.txt"
    exit 1
}

# Pre-flight environment validation
Write-Host "[Pre-Flight] Validating production configuration..." -ForegroundColor Yellow

$preflightScript = @"
import os, sys
from backend.config import settings

# Enforce production secrets check
try:
    settings.validate_production_secrets()
    print('[PASS] Production secrets validation passed.')
except Exception as e:
    print(f'[FAIL] Security Validation Error: {e}', file=sys.stderr)
    sys.exit(1)

print(f'[INFO] Environment: {settings.ENVIRONMENT}')
print(f'[INFO] Database URL: {settings.DATABASE_URL}')
print(f'[INFO] Frontend Allowed Origin: {settings.FRONTEND_URL}')
"@

& $python -c "$preflightScript"
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[FATAL] Production startup aborted due to configuration errors." -ForegroundColor Red
    Write-Host "Please supply a strong JWT_SECRET_KEY (min 32 characters) in .env or environment variables." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[Architecture Note] SQLite Database Concurrency:" -ForegroundColor Cyan
Write-Host "  Using single Uvicorn worker process (workers=1). When using SQLite, multiple"
Write-Host "  worker processes can trigger 'database is locked' errors during concurrent"
Write-Host "  write operations despite WAL mode. For multi-worker scale, migrate to PostgreSQL." -ForegroundColor DarkGray

Write-Host "`n[Startup] Launching Uvicorn ASGI server on http://${HostAddress}:${Port} ..." -ForegroundColor Green
Write-Host "  Worker count: 1 (SQLite-safe)" -ForegroundColor Green
Write-Host "  Reload mode:  DISABLED" -ForegroundColor Green
Write-Host "  Swagger docs: DISABLED (/docs hidden in production)" -ForegroundColor Green
Write-Host "==========================================================`n" -ForegroundColor Cyan

# Start Uvicorn without --reload, single worker for SQLite safety
& $python -m uvicorn backend.main:app --host $HostAddress --port $Port --workers 1 --no-access-log

