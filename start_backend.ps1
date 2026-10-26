# SmartPrice Backend Startup Script
# Run from the project root: c:\New folder\smartprice\
# Usage: .\start_backend.ps1

$python = Join-Path $PSScriptRoot "backend\venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Error "Python venv not found at: $python"
    Write-Host "Run: cd backend && python -m venv venv && venv\Scripts\pip install -r requirements.txt"
    exit 1
}

Write-Host "Starting SmartPrice FastAPI backend on http://0.0.0.0:8000 ..." -ForegroundColor Cyan
& $python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
