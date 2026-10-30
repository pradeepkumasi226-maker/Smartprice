# Operations & Local Development Guide
## SmartPrice Explainable AI Retail Optimization Suite

---

## 1. Prerequisites & Environment Requirements

- **Operating System**: Windows 10/11, macOS, or Linux.
- **Python**: Version **3.10** or higher (tested on Python 3.12).
- **Node.js**: Version **18.x** or higher (tested with Vite 6).
- **Database**: Embedded SQLite 3 (included with Python, no external DBMS installation required).

---

## 2. Repository Architecture & Layout

```
C:\New folder\smartprice\
├── backend\
│   ├── app\
│   │   ├── core\              # App configuration, security, JWT dependencies
│   │   ├── models\            # SQLAlchemy database models
│   │   ├── routers\           # FastAPI REST API route controllers
│   │   ├── schemas\           # Pydantic v2 data validation schemas
│   │   ├── seed\              # Initial seed scripts (run once)
│   │   └── services\          # Core business logic & calculation services
│   ├── data\
│   │   └── smartprice.db      # Live SQLite database (WAL mode)
│   ├── venv\                  # Python virtual environment
│   ├── config.py              # Application settings
│   ├── database.py            # SQLAlchemy database session & engine
│   ├── main.py                # FastAPI entry point & middleware
│   └── requirements.txt       # Python backend dependencies
├── frontend\
│   ├── src\
│   │   ├── components\        # Modular React UI components & charts
│   │   ├── context\           # React contexts (Auth, Store, Theme)
│   │   ├── data\              # Fallback demonstration datasets
│   │   ├── pages\             # Top-level page views
│   │   ├── services\          # API client (apiService.js)
│   │   └── utils\             # Financial analytics & product normalizers
│   ├── package.json           # Node dependencies & build scripts
│   └── vite.config.js         # Vite bundler configuration & dev proxy
├── ml\
│   ├── config\                # Model parameter configurations
│   ├── explainability\        # Deterministic attribution engine & validator
│   ├── forecasting\           # Baseline time-series forecasting utilities
│   ├── optimization\          # Pricing elasticity search space utilities
│   └── preprocessing\         # Feature transformation pipelines
├── tests\                     # Regression, consistency & functional test suites
├── start_backend.ps1          # PowerShell backend launch helper
└── technical_documentation\   # Technical specifications & architecture guides
```

---

## 3. Running the Backend Locally

### 3.1 Virtual Environment Setup & Dependencies
From the repository root (`C:\New folder\smartprice`):

```powershell
# 1. Activate virtual environment (Windows PowerShell)
.\backend\venv\Scripts\Activate.ps1

# 2. Verify installed dependencies
pip install -r backend\requirements.txt
```

### 3.2 Starting the FastAPI Application
Start the Uvicorn ASGI server with automatic reload:

```powershell
# From project root:
backend\venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
Alternatively, execute the bundled launch script:
```powershell
.\start_backend.ps1
```

- **Backend Base URL**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc API Reference**: `http://localhost:8000/redoc`
- **Health Check**: `http://localhost:8000/health`

---

## 4. Running the Frontend Locally

### 4.1 Dependency Installation & Dev Server
From the repository root:

```powershell
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies (if needed)
npm install

# 3. Start development server
npm run dev
```

- **Frontend Dev URL**: `http://localhost:5173` (or port specified in terminal).
- Vite is configured to proxy `/api` requests to `http://localhost:8000` during development.

### 4.2 Building for Production
To generate minified, production-ready static assets:

```powershell
cd frontend
npm run build
```
Build outputs are generated in `frontend/dist/`.

---

## 5. Local Authentication & Test Accounts

The local database contains pre-configured staff accounts with varied role-based permissions:

| Name | Login Identifier | Password | Role | Permissions |
|---|---|---|---|---|
| **Pradeep K** | `pradeep.retail@smartprice.ai` | `SmartPrice@2026!` | `Retail Pricing Manager` | Standard pricing review, approvals, catalog updates, what-if simulations |
| **Sarah Jenkins** | `analyst.sarah@smartprice.ai` | `SmartPrice@2026!` | `Senior Merchandising Analyst` | Analytics, reporting, simulations, forecast inspections |
| **Marcus Vance** | `marcus.vance@smartprice.ai` | `Marcus@SmartPrice2026!` | `Store Operations Director` | Executive override authority, below-cost clearance authorization |

---

## 6. Executing Test Suites

Run individual or project-wide test suites from the project root using the project virtual environment:

```powershell
# Pricing Margin Guardrails Suite (28 tests)
backend\venv\Scripts\python.exe tests\test_pricing_margin_guardrails.py

# Catalog Recommendation Consistency Suite (73 tests)
backend\venv\Scripts\python.exe tests\test_catalog_margin_consistency.py

# Inventory Reconciliation Suite (51 tests)
backend\venv\Scripts\python.exe tests\test_inventory_consistency.py

# Inventory Regression Suite (33 tests)
backend\venv\Scripts\python.exe tests\test_inventory_regression.py

# Demand Forecast Velocity Scaling Suite (39 tests)
backend\venv\Scripts\python.exe tests\test_forecast_consistency.py

# Financial Reports Reconciliation Suite (48 tests)
backend\venv\Scripts\python.exe tests\test_financial_reports_consistency.py

# Cross-Module Consistency Suite Fix #8 (11 tests)
backend\venv\Scripts\python.exe tests\test_fix8_consistency.py

# Cross-Module Consistency Suite Fix #9 (5 tests)
backend\venv\Scripts\python.exe tests\test_fix9_consistency.py
```

