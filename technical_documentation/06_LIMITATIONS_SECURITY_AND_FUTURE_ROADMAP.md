# Limitations, Security & Future Roadmap
## SmartPrice Explainable AI Retail Optimization Suite

---

## 1. Known Technical & Analytical Limitations

### 1.1 Zero Price Variance in Historical Sales (Econometric Slope Undefined)
- **Root Cause**: In the current historical transaction dataset (`sales` table), individual products were sold at a constant historical shelf price across all recorded transactions.
- **Consequence**: The empirical ordinary least squares (OLS) log-log price elasticity slope:
  $$\hat{\beta}_1 = \frac{\sum_{t=1}^{N} (\ln P_t - \overline{\ln P})(\ln Q_t - \overline{\ln Q})}{\sum_{t=1}^{N} (\ln P_t - \overline{\ln P})^2}$$
  has a denominator equal to zero ($\text{Var}(\ln P) = 0$). Econometrically, empirical price elasticity is mathematically undefined without price variation.
- **Handling**: The system honestly detects this condition (`elasticity_status: "UNRELIABLE_CONSTANT_PRICE"`), bypasses undefined econometric regression, and falls back to domain-calibrated catalog elasticity scores stored in `Product.elasticity`.

### 1.2 Deterministic Attribution vs. Complex Machine Learning SHAP
- As detailed in [`03_EXPLAINABLE_AI_AND_ATTRIBUTION.md`](file:///C:/New%20folder/smartprice/technical_documentation/03_EXPLAINABLE_AI_AND_ATTRIBUTION.md), the system does not execute TreeSHAP or KernelSHAP algorithms.
- Instead, it applies a deterministic attribution rule engine. While transparent, stable, and mathematically additive, it does not learn non-linear feature interactions from historical training data.

### 1.3 Database Concurrency & Single-Writer Constraints
- The backend relies on SQLite 3 in WAL mode.
- While WAL mode supports concurrent readers without blocking, write operations (restocks, price approvals, scenario saves) require exclusive database locks.
- Under heavy distributed concurrent write loads, transactions may queue or encounter `sqlite3.OperationalError: database is locked`.

### 1.4 Fixed Demonstration Catalog Size
- The operational database is currently calibrated for an 11-product catalog across 5 retail categories.
- Scaling to tens of thousands of SKUs will require database indexing on composite query patterns, pagination in optimization batch endpoints, and distributed background workers (e.g., Celery/Redis).

---

## 2. Core Operational Assumptions

1. **Stationary Baseline Demand**: The `predicted_demand` value stored in `products` is assumed to represent an unpromoted, 30-day monthly run rate under standard market conditions.
2. **Synchronous Competitor Intelligence**: Competitor benchmark prices (`Product.competitor_price`) are assumed to remain static within an optimization evaluation cycle unless explicitly refreshed via competitor feed updates.
3. **Inventory Acquisition Costing**: Unit cost prices (`Product.cost_price`) are assumed to represent weighted average landed costs and remain constant between restock ledger batches.
4. **Calendar Alignment**: Horizon velocity scaling factors ($7/30$, $30/30$, $90/30$) assume standard 30-day retail planning months.

---

## 3. Security Considerations & Protections

### 3.1 Authentication & Session Integrity
- **JWT Authorization**: Requests to protected management and optimization endpoints require a valid `Authorization: Bearer <token>` header signed with the application secret key using the HS256 algorithm.
- **Token Expiration**: Access tokens are configured with explicit expiration timestamps. Expired tokens are rejected with HTTP 401 Unauthorized, prompting client re-authentication.

### 3.2 In-Memory Rate Limiting
- To protect against credential stuffing and brute-force attacks, [`backend/app/services/auth_service.py`](file:///C:/New%20folder/smartprice/backend/app/services/auth_service.py) enforces an in-memory sliding-window rate limiter on `POST /api/auth/login`.
- Repeated failed login attempts trigger HTTP 429 Too Many Requests with a dynamic `Retry-After` header.

### 3.3 Role-Based Access Control (RBAC)
- Pricing actions are strictly gated by user role:
  - `Retail Pricing Manager`: Permitted to review recommendations, run what-if simulations, adjust normal guardrails ($\ge \text{cost}$), and approve compliant prices.
  - `Store Operations Director`: Granted executive override authority. Only this role (or Admin) can authorize below-cost clearances (`allow_below_cost=True`).
- Unauthorized attempts to submit below-cost approvals without the Director role are rejected with HTTP 403 Forbidden.

### 3.4 Data & Environment Isolation
- Secrets, JWT signing keys, and environment variables are maintained in local `.env` files.
- `.env` and `backend/.env` are strictly excluded from version control via `.gitignore` and omitted from release backup archives.
- Automated tests run against dedicated test fixtures or isolated scratch instances to prevent corruption of the production database.

---

## 4. Future Enhancements & Engineering Roadmap

### Phase 1: High-Concurrency Persistence Migration
- Replace embedded SQLite with **PostgreSQL** or **CockroachDB**.
- Leverage connection pooling (e.g., SQLAlchemy `QueuePool`, PgBouncer) to handle concurrent multi-store write operations without lock contention.

### Phase 2: Empirical Price Variance & Active Learning
- Implement randomized micro-testing (A/B testing with $\pm 2\%$ to $\pm 5\%$ price variances over 14-day intervals) on non-critical SKUs.
- This will generate the necessary historical price variance to compute true econometric log-log elasticity slopes without relying on static catalog defaults.

### Phase 3: True Gradient-Boosted TreeSHAP Integration
- Once historical price-variant transaction volume exceeds 50,000 records, train **LightGBM** / **XGBoost** regression models predicting demand volume as a function of shelf price, competitor spread, inventory depth, and seasonal factors.
- Integrate the official `shap` library (`TreeExplainer`) to compute genuine Shapley values, while maintaining margin guardrail filters as post-prediction constraints.

### Phase 4: Distributed Batch Processing & Asynchronous Tasks
- Offload 90-day catalog-wide optimization simulations to an asynchronous task queue (e.g., Celery, RQ) backed by Redis.
- Provide WebSocket or Server-Sent Events (SSE) notification streams to the frontend for real-time optimization batch progress bars.

