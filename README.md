# SmartPrice — Explainable AI Retail Price Optimization Platform

SmartPrice is an enterprise-grade retail price optimization platform combining autonomous dynamic pricing, probabilistic demand forecasting, inventory intelligence, and transparent Explainable AI (XAI) feature attribution.

---

## 1. System Overview & Problem Statement

Retail pricing demands a delicate balance between profitability, competitor positioning, inventory buffers, and consumer price elasticity. Static or arbitrary markdown strategies leave substantial margin on the table.

SmartPrice addresses this by providing:
- **Autonomous Pricing Engine**: Algorithmic recommendations constrained by strict gross margin floors and velocity limits.
- **Probabilistic Demand Forecasting**: 7-day, 30-day, and 90-day trajectory modeling with P10–P90 confidence bounds.
- **What-If Scenario Simulation**: Risk-free interactive simulation exploring multi-variable elasticity, competitor pricing deltas, and promotional surges.
- **Transparent Explainable AI (XAI)**: Additive feature attribution decomposing *why* a price is suggested without fabricating black-box model claims.
- **Inventory-Aware Pricing & Ledger**: Automated stock tracking, supplier replenishment purchase orders, and auditable transaction logging with reverse reconciliation.
- **Hardened Security & RBAC**: Real bcrypt password hashing, cryptographically signed JWT tokens, role-based access control, sliding-window rate limiting, and fail-safe production configuration.

---

## 2. Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React 18 + Vite SPA                   │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │ 10 Core Pages│ │Recharts Views│ │Context Providers│  │
│  │ (Tailored UI)│ │ (Waterfalls) │ │(Auth & Store)  │  │
│  └──────────────┘ └──────────────┘ └────────────────┘  │
│          ↕ API Client (/api Vite Reverse Proxy)        │
├────────────────────────────────────────────────────────┤
│                    FastAPI Backend                     │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │ API Routers  │ │ Pydantic V2  │ │ Core Security  │  │
│  │ (Auth/Pricing│ │ Data Schemas │ │(JWT / Bcrypt / │  │
│  │  Inventory)  │ │ (Validation) │ │ Rate Limiter)  │  │
│  └──────────────┘ └──────────────┘ └────────────────┘  │
│          ↕ SQLAlchemy 2.0 ORM                          │
├────────────────────────────────────────────────────────┤
│                 SQLite Relational Store                │
│  Products (10), Sales (160), Ledger Transactions (55), │
│  Pricing Decisions, What-If Scenarios (5), Users       │
└────────────────────────────────────────────────────────┘
```

---

## 3. Quick Start & Prerequisites

### Prerequisites
- **Node.js** ≥ 18.x
- **Python** ≥ 3.10
- **npm** (bundled with Node.js)

### Environment Configuration
The backend reads environment settings from `backend/.env`. A template is provided in `backend/.env.example`:
```ini
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=smartprice-local-dev-secret-key-2026
ENVIRONMENT=development
PORT=8000

# Production Security (Required if ENVIRONMENT=production)
# JWT_SECRET_KEY=YOUR_PRODUCTION_HIGH_ENTROPY_JWT_SECRET_KEY_HERE_MIN_32_CHARS
```
> **Security Guardrail**: When `ENVIRONMENT=production`, the application strictly requires a persistent `JWT_SECRET_KEY` (minimum 32 characters). Startup safely halts (`RuntimeError`) if missing or default.

### Starting the Application

#### Option A: PowerShell Scripts (Windows)
1. **Start Backend**:
   ```powershell
   .\start_backend.ps1
   ```
   *Runs FastAPI on `http://localhost:8000` with hot-reload enabled.*

2. **Start Frontend** (in a separate terminal):
   ```bash
   npm run dev
   ```
   *Launches the Vite dev server on `http://localhost:3000`.*

#### Option B: Manual Startup
1. **Backend**:
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate          # Windows
   # source venv/bin/activate     # macOS/Linux
   pip install -r requirements.txt
   cd ..
   backend\venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Frontend**:
   ```bash
   npm install
   npm --prefix frontend run dev
   ```

3. **Open Browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 4. Feature Inventory: Implemented vs. Future Production Scope

### Implemented & Verified in Source Code
| Module | Implemented Capabilities |
| :--- | :--- |
| **Authentication & RBAC** | Real bcrypt hashing, signed JWT tokens, server-side role resolution (`Retail Pricing Manager`, `Senior Merchandising Analyst`, `Store Operations Director`), in-memory sliding-window brute-force rate limiter (`HTTP 429`), protected route middleware. |
| **Executive Dashboard** | Real-time database aggregations (Gross Revenue, Margin %, Units Sold, Valuation), 8-month trend series, and operational alerts banner. |
| **Products Catalog** | 10 active catalog items, live category and search filters, dynamic pricing toggle persistence, INR (`₹`) formatting. |
| **Demand Forecasting** | 7-day, 30-day, and 90-day horizons, P10–P90 probabilistic confidence bounds, seasonal drivers, fallback for missing SKUs, loading and error states. |
| **Price Optimization** | Algorithmic elasticity calculations, separate revenue vs profit lift indicators, margin guardrail enforcement, executive below-cost clearance override workflow, permanent audit trail. |
| **What-If Analysis** | Multi-variable simulator (price, competitor offset, elasticity multiplier, promo discount), scenario creation/save/delete lifecycle, cross-session persistence. |
| **Inventory Intelligence** | Stock health classification (Optimal, Low Stock, Critical, Overstocked), single & batch restock operations, transaction ledger, automatic reverse stock reconciliation upon transaction deletion. |
| **Explainable AI (XAI)** | Additive waterfall decomposition per SKU, catalog-wide global feature importance rankings, deterministic attribution engine. |
| **Business Reports** | 4-store breakdown, category performance, pricing compliance, inventory health, CSV and formatted audit text export. |
| **System Settings** | Autonomous margin floor (10%–50%), velocity caps (±5%–±40%), undercut tolerance (0%–50%), multi-currency switcher (`₹`, `$`, `€`, `£`), primary store location persistence. |

### Optional Future Integrations (Multi-Node Production Architecture)
- **Distributed Database**: Embedded SQLite is optimized for single-node operation; multi-region deployments should configure PostgreSQL / Cloud SQL via `DATABASE_URL`.
- **Distributed Cache & Rate Limiting**: The in-memory sliding rate limiter should be backed by Redis in multi-worker clustered deployments.
- **Outbound Gateway Dispatch**: Notification preferences trigger real-time in-dashboard alert banners and toasts; external SMS/Email dispatch requires external SendGrid / Twilio API keys in `backend/.env`.

---

## 5. AI Transparency & Attribution Architecture

> **Transparency Declaration**: SmartPrice does **not** make fabricated claims regarding black-box neural networks. All explainability endpoints operate with full scientific transparency:

1. **Attribution Engine**: The active model version is declared as `Deterministic Pricing Rule Attribution v1.0` with `is_genuine_shap: false` when operating on analytical heuristics.
2. **Mathematical Decomposition**: Feature importance scores reflect deterministic contributions across five core retail drivers:
   - **Competitor Price Benchmark** (Index against nearest rival)
   - **Own-Price Demand Elasticity** (Empirical volume response curve)
   - **Inventory Buffer & Safety Depth** (Scarcity protection vs. surplus markdown)
   - **Gross Margin Guardrail** (Cost-plus boundary enforcement)
   - **Seasonality & Calendar Uplift** (Promotional events and cyclical spikes)
3. **Forecasting**: Demand projections utilize the `SmartPrice Baseline Demand Forecaster` with validated empirical WAPE of `48.1%` and MAE of `31.26 units`.

---

## 6. Demonstration Readiness & Safe Walkthrough Guide

To preserve the operational database during live demonstrations, follow this sequence:

| Step | Page / Feature | Demonstration Focus | Safe Demonstration Action |
| :---: | :--- | :--- | :--- |
| **1** | **Login & Roles** | Authenticate as `Retail Pricing Manager` (`pradeep.retail@smartprice.ai`). Switch profiles to `Senior Merchandising Analyst` to observe restricted permissions (approvals blocked with `HTTP 403`). | Read-only login & profile inspection. |
| **2** | **Dashboard** | Review executive KPIs ($194.8k revenue, 49.0% margin, 880 units sold). Inspect the 8-month revenue trend and operational alerts banner. | Read-only. |
| **3** | **Products** | Filter by category `"Beauty & Care"` (2 SKUs), search `"OLED"` (`ELC-8812`), toggle Dynamic Pricing switch on `APP-1029` (reloads seamlessly). | Reversible toggle. |
| **4** | **Demand Forecast** | Inspect 7-day, 30-day, and 90-day probabilistic intervals. Toggle zoom scrubbers and review P10–P90 confidence bounds. | Read-only. |
| **5** | **Price Optimization** | Review recommended target prices. Demonstrate that Revenue Lift and Profit Lift are explicitly separated. Observe approved target alignment on `ELC-4921` (`₹219.50`). | Read-only inspection of live recommendations. |
| **6** | **What-If Analysis** | Adjust price sliders, competitor offsets, and promotional discounts to observe real-time recalculation of projected revenue and demand. Save a temporary scenario, inspect it in "Saved Scenarios", and delete it. | Temporary scenario created and deleted. |
| **7** | **Inventory Intelligence** | View stock health distribution. Inspect the 55-transaction historical ledger. Demonstrate PO restock modal. | Read-only ledger inspection. |
| **8** | **AI Insights (XAI)** | Review the Global Feature Importance chart. Select `ELC-4921` to inspect the additive waterfall explaining how competitor gap and margin floors shaped the price. | Read-only. |
| **9** | **Business Reports** | Inspect 4-store breakdown and retail category margins. Click "Export CSV" to demonstrate report generation. | Client-side export (read-only). |
| **10** | **Settings** | Adjust guardrail sliders (min margin, max velocity), switch currency between INR (`₹`) and USD (`$`), and verify settings persist across page reloads. | Persistent preferences saved locally. |

---

## 7. Automated Test Suite & Recorded Results

Every automated test suite was executed against the operational system. **100% of tests passed**:

```
======================================================================
TEST EXECUTION SUMMARY
======================================================================
1. Comprehensive E2E Functional Audit  : 73/73 PASSED (100.0%)
2. Authentication & Security Suite    : 47/47 PASSED (100.0%)
3. Backend Verification & Persistence  : 32/32 PASSED (100.0%)
4. Inventory Intelligence Regression   : 33/33 PASSED (100.0%)
5. Product Integration & Metrics       : 21/21 PASSED (100.0%)
6. Project-Wide Persistence Audit      : 18/18 PASSED (100.0%)
7. Frontend Production Bundle Build    : 2,257 modules compiled (0 errors)
======================================================================
TOTAL VERIFIED AUTOMATED ASSERTIONS    : 224/224 PASSED (100.0%)
======================================================================
```

### Running the Test Suites
```bash
# E2E Comprehensive Functional Audit (73 tests)
backend\venv\Scripts\python.exe tests\test_e2e_functional_audit.py

# Authentication, RBAC, Rate Limiting & Security (47 tests)
backend\venv\Scripts\python.exe tests\test_auth_security.py

# Backend Core & Persistence (32 tests)
backend\venv\Scripts\python.exe tests\test_backend.py

# Inventory Regression & Stock Reconciliation (33 tests)
backend\venv\Scripts\python.exe tests\test_inventory_regression.py

# Product Metrics & Integration (21 tests)
node tests\test_products_integration.mjs

# Project-Wide Persistence Audit (18 tests)
node tests\test_persistence_audit.mjs

# Frontend Production Build
npm --prefix frontend run build
```

---

## 8. Operational Database Preservation

The operational database was verified before and after all audit executions:
- **Products**: Exactly 10
- **Inventory Ledger**: Exactly 55 transactions
- **Saved What-If Scenarios**: Exactly 5
- **Pricing Recommendations**: Exactly 10
- **`HOM-7193` Stock Quantity**: Exactly 248 units
- **`ELC-4921` Shelf Price**: Exactly ₹219.50
- **`APP-1029` Shelf Price**: Exactly ₹109.47 (Status: Approved)
- **`ELC-8812` Shelf Price**: Exactly ₹947.58

> **Data Safety Directive**: Never run `seed_database(force=True)` on the active database.
