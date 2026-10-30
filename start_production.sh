#!/usr/bin/env bash
# ==============================================================================
# SmartPrice Production Startup Script (Linux / POSIX)
# ==============================================================================
# Usage:
#   ./start_production.sh [PORT] [HOST]
# Example:
#   ./start_production.sh 8000 0.0.0.0
# ==============================================================================

set -euo pipefail

PORT="${1:-8000}"
HOST="${2:-0.0.0.0}"

echo "=========================================================="
echo "  SmartPrice AI Retail Engine - Production Startup"
echo "=========================================================="

export ENVIRONMENT="production"
export SMARTPRICE_ENV="production"

# Resolve script directory and python executable
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${SCRIPT_DIR}/backend/venv/bin/python"

if [ ! -f "$PYTHON" ]; then
    echo "[ERROR] Python virtual environment not found at: $PYTHON"
    echo "Please create it and install production dependencies:"
    echo "  cd backend && python3 -m venv venv && venv/bin/pip install -r requirements-prod.txt"
    exit 1
fi

# Pre-flight environment validation
echo "[Pre-Flight] Validating production configuration..."

$PYTHON - << 'EOF'
import os, sys
from backend.config import settings

try:
    settings.validate_production_secrets()
    print('[PASS] Production secrets validation passed.')
except Exception as e:
    print(f'[FAIL] Security Validation Error: {e}', file=sys.stderr)
    sys.exit(1)

print(f'[INFO] Environment: {settings.ENVIRONMENT}')
print(f'[INFO] Database URL: {settings.DATABASE_URL}')
print(f'[INFO] Frontend Allowed Origin: {settings.FRONTEND_URL}')
EOF

if [ $? -ne 0 ]; then
    echo "[FATAL] Production startup aborted due to configuration errors."
    echo "Please supply a strong JWT_SECRET_KEY (min 32 characters) in .env or environment variables."
    exit 1
fi

echo ""
echo "[Architecture Note] SQLite Database Concurrency:"
echo "  Using single Uvicorn worker process (workers=1). When using SQLite, multiple"
echo "  worker processes can trigger 'database is locked' errors during concurrent"
echo "  write operations despite WAL mode. For multi-worker scale, migrate to PostgreSQL."
echo ""
echo "[Startup] Launching Uvicorn ASGI server on http://${HOST}:${PORT} ..."
echo "  Worker count: 1 (SQLite-safe)"
echo "  Reload mode:  DISABLED"
echo "  Swagger docs: DISABLED (/docs hidden in production)"
echo "=========================================================="

# Start Uvicorn without --reload, single worker for SQLite safety
exec "$PYTHON" -m uvicorn backend.main:app --host "$HOST" --port "$PORT" --workers 1 --no-access-log

