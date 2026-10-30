# Core Business Logic & Service Specifications
## SmartPrice Explainable AI Retail Optimization Suite

---

## 1. Dynamic Pricing & Recommendation Engine

The core optimization logic is implemented in [`backend/app/services/pricing_service.py`](file:///C:/New%20folder/smartprice/backend/app/services/pricing_service.py) via `PricingService.calculate_product_recommendation()`.

### 1.1 Objective Function & Search Space
For any given product $i$, the engine maximizes expected gross profit over a discrete candidate pricing grid:
$$\max_{P_j \in \mathcal{G}_i} \Pi(P_j) = Q(P_j) \times (P_j - C_i)$$

Where:
- $C_i$ is the unit acquisition cost (`Product.cost_price`).
- $P_0$ is the current shelf price (`Product.current_price`).
- $\mathcal{G}_i$ is the candidate price grid defined between $P_0 \times (1 - \Delta_{\max})$ and $P_0 \times (1 + \Delta_{\max})$ (default change limit $\Delta_{\max} = 0.20$ to $0.30$).
- $Q(P_j)$ is the expected demand at candidate price $P_j$:
  $$Q(P_j) = \max\left(1, \; \text{round}\left(Q_0 \times \left[1 + \epsilon_i \times \frac{P_j - P_0}{P_0}\right]\right)\right)$$
- $\epsilon_i$ is the price elasticity coefficient (`Product.elasticity`).

### 1.2 Competitor Matching Buffer
The engine integrates competitor intelligence through the `competitor_buffer_pct` parameter ($B_{\text{comp}}$):
$$P_{\text{comp\_target}} = P_{\text{comp}} \times \left(1 - \frac{B_{\text{comp}}}{100}\right)$$
- If the candidate price $P_j$ sits within the competitor buffer zone, the model scores price competitiveness against consumer brand perception and inventory velocity.
- The parameter is bounded between $0.0\%$ and $50.0\%$, safely rejecting out-of-range inputs with HTTP 400.

---

## 2. Margin Guardrails & Safety Floors

### 2.1 The Mathematical Floor Formula
To prevent margin dilution and below-cost sales, the suite enforces a strict mathematical gross-margin floor:
$$\text{Floor}_{\text{margin}} = \frac{C_i}{1 - \frac{M_{\min}}{100}}$$

Where $M_{\min}$ is the configured minimum gross margin percentage (e.g., $25.0\%$).

#### Mathematical Proof of Margin Compliance:
Given $\text{Price} = \frac{C_i}{1 - m}$ where $m = M_{\min} / 100$:
$$\text{Gross Margin} = \frac{\text{Price} - C_i}{\text{Price}} = \frac{\frac{C_i}{1 - m} - C_i}{\frac{C_i}{1 - m}} = \frac{C_i \left(\frac{1 - (1 - m)}{1 - m}\right)}{\frac{C_i}{1 - m}} = m$$
Thus, setting price equal to $\text{Floor}_{\text{margin}}$ achieves exactly the target gross margin percentage.

#### Benchmark Calculations:
- For `ELC-8812` ($C_i = ₹540.00$):
  - At $M_{\min} = 0\%$: $\text{Floor} = ₹540.00$ (cost price protection).
  - At $M_{\min} = 5\%$: $\text{Floor} = \frac{540}{0.95} = ₹568.42$.
  - At $M_{\min} = 25\%$: $\text{Floor} = \frac{540}{0.75} = ₹720.00$.
  - At $M_{\min} = 30\%$: $\text{Floor} = \frac{540}{0.70} = ₹771.43$.

### 2.2 Uncoupling Optimal Price from Margin Floor (SKU `9909`)
In previous iterations, products without active pending recommendations in `pricing_recommendations` defaulted to presenting the margin floor as the AI recommendation.
Under Consistency Fix #10, the engine separates these concepts in [`backend/app/schemas/product.py`](file:///C:/New%20folder/smartprice/backend/app/schemas/product.py):
- `current_price`: Shelf price (₹1,099.00 for SKU `9909`).
- `cost_price`: Wholesale cost (₹999.00 for SKU `9909`).
- `margin_floor`: Minimum 25% margin floor ($₹999 / 0.75 = ₹1,332.00$).
- `ai_optimal_price`: True grid-search profit-maximizing price target (**₹1,428.70**).
- `recommended_price`: The AI optimal price, respecting the floor (**₹1,428.70**).
- `is_margin_floor_fallback`: `False` (the optimal price exceeds the floor).
- `recommendation_type`: `"AI_OPTIMAL"`.

### 2.3 Executive Override Governance & Clamping (SKU `ELC-8812`)
- **Historical Override**: `ELC-8812` contains a stored below-cost override price of **₹500.00** authorized by Marcus Vance (`OVERRIDDEN_BELOW_COST`) for clearance.
- **Ordinary Protection**: When standard guardrails (`allow_below_cost=False`, $M_{\min} = 25\%$) are applied:
  - The recommendation is clamped to the minimum guardrail (**₹720.00**).
  - The engine suppresses the historical Marcus Vance liquidation note and dynamically generates a fresh rationale explaining that the price was clamped to protect corporate margin.
  - The historical override remains safely preserved in audit logs and is never exposed as an ordinary recommendation.

---

## 3. Inventory Intelligence & Ledger Reconciliation

Implemented in [`backend/app/services/inventory_service.py`](file:///C:/New%20folder/smartprice/backend/app/services/inventory_service.py).

### 3.1 Authoritative Stock Level
- The single source of truth for physical stock on hand is defined exclusively as `Product.stock_quantity`.
- Catalog total on hand across all 11 SKUs: **747 units**.
- Valuation formulas:
  - Wholesale Cost Valuation: $\sum_{i} \text{stock}_i \times \text{cost}_i = ₹126,431.50$
  - Retail Shelf Valuation: $\sum_{i} \text{stock}_i \times \text{price}_i = ₹240,212.69$

### 3.2 Ledger Mutation Accounting
- Total database transactions: exactly **54 rows** in `inventory_transactions`.
- Every transaction enforces the accounting equation:
  $$\text{new\_stock} = \text{previous\_stock} + \text{quantity}$$

### 3.3 Isolation of Historical Test Audit Transactions (`HOM-7193`)
- SKU `HOM-7193` (Robot Vacuum) records 49 total transactions.
- Historical automated test executions wrote repeated mutation tests against the development database, creating post-transaction snapshots reaching 748–828 units.
- `InventoryService.get_reconciliation()` partitions transactions into:
  - `operational_transaction_count`: **1** (opening restock of 240 units to snapshot 8).
  - `test_transaction_count`: **48** (automated test runner entries).
  - `latest_operational_snapshot`: **8 units**.
- Live catalog stock remains authoritative at **248 units**, with test mutations fully isolated from operational inventory balances.

---

## 4. Multi-Horizon Demand Forecasting

Implemented in [`backend/app/services/forecast_service.py`](file:///C:/New%20folder/smartprice/backend/app/services/forecast_service.py).

### 4.1 Velocity Scaling Multipliers
The baseline demand in the database represents a **30-day monthly run rate** ($D_{\text{base}} = 3,196$ units across the catalog). Projections across different planning horizons scale proportionally:
- **7-Day Horizon**: $\text{Multiplier} = \frac{7.0}{30.0} \approx 0.2333 \rightarrow 745$ units.
- **30-Day Horizon**: $\text{Multiplier} = 1.0 \rightarrow 3,196$ units.
- **90-Day Horizon**: $\text{Multiplier} = 3.0 \rightarrow 9,588$ units.

### 4.2 Exact 3-Way Additivity
To prevent inconsistencies where charts differ from tables or headline summaries, the system guarantees 3-way mathematical equivalence across all horizons:
$$\text{Headline Total} \equiv \sum_{t=1}^{T} \text{Timeline Point}_t \equiv \sum_{k=1}^{K} \text{Product Summary}_k$$

Verified across catalog horizons:
- 7-Day: Headline (745) == Timeline Points (745) == Product Rows (745)
- 30-Day: Headline (3,196) == Timeline Points (3,196) == Product Rows (3,196)
- 90-Day: Headline (9,588) == Timeline Points (9,588) == Product Rows (9,588)

### 4.3 Days of Supply & Stockout Risk
Daily velocity rate and days of supply are derived using horizon-scaled units:
$$\text{Daily Velocity} = \frac{\text{Predicted Demand Units}}{\text{Horizon Days}}$$
$$\text{Days of Supply} = \frac{\text{Current Stock Quantity}}{\text{Daily Velocity}}$$

Risk classification thresholds:
- $\text{Critical}$: $\text{Stock} \le \text{Safety Stock}$
- $\text{High}$: $\text{Days of Supply} < 7 \text{ days}$
- $\text{Medium}$: $7 \le \text{Days of Supply} < 14 \text{ days}$
- $\text{Low}$: $\text{Days of Supply} \ge 14 \text{ days}$

For `ELC-8812` over 7 days ($Stock = 50$, $Demand = 86$ units):
$$\text{Daily Velocity} = \frac{86}{7} \approx 12.29 \text{ units/day}$$
$$\text{Days of Supply} = \frac{50}{12.29} \approx 4.07 \rightarrow 4.1 \text{ days} \implies \text{Risk: "High"}$$

---

## 5. What-If Scenario Simulation

Implemented in [`backend/app/services/what_if_service.py`](file:///C:/New%20folder/smartprice/backend/app/services/what_if_service.py).

### 5.1 Product State Isolation
When switching between products, the simulation state strictly isolates baseline metrics to the active product:
- `BEA-9144`: Resolves baseline price **₹67.60** and elasticity $-0.85$.
- `ELC-8812`: Resolves baseline price **₹947.58** and elasticity $-1.85$.
- Stale responses from prior selections are discarded via request sequencing and SKU validation.

### 5.2 Scenario Formulas
- $\text{Price Delta}: \Delta P = P_{\text{sim}} - P_{\text{base}}$
- $\text{Demand Projection}: Q_{\text{sim}} = \max\left(1, \text{round}\left(Q_{\text{base}} \times \left(1 + \left[\epsilon \times \frac{\Delta P}{P_{\text{base}}}\right]\right)\right)\right)$
- $\text{Revenue}: R_{\text{sim}} = Q_{\text{sim}} \times P_{\text{sim}}$
- $\text{Profit}: \Pi_{\text{sim}} = Q_{\text{sim}} \times (P_{\text{sim}} - C)$
- $\text{Gross Margin}: M_{\text{sim}} = \frac{\Pi_{\text{sim}}}{R_{\text{sim}}} \times 100\%$

---

## 6. Business Reports & Financial Reconciliation

Implemented in [`backend/app/services/report_service.py`](file:///C:/New%20folder/smartprice/backend/app/services/report_service.py).

### 6.1 Database Reconciliation
Headline financial performance metrics reconcile directly against the **160 historical sales records** in `sales`:
- **Gross Revenue**: $\sum \text{Sale.revenue} = ₹194,831.12$
- **Cost of Goods Sold (COGS)**: $\sum \text{Sale.cost} = ₹99,396.00$
- **Net Profit**: $\sum \text{Sale.profit} = ₹95,435.12$
- **Average Gross Margin**: $\frac{95,435.12}{194,831.12} \times 100\% = 49.0\%$
- **Total Units Sold**: $\sum \text{Sale.quantity} = 880 \text{ units}$
- **Reconciliation Check**: $₹194,831.12 - ₹99,396.00 \equiv ₹95,435.12$ (Zero variance).

### 6.2 Category Taxonomy & Aliasing
Departments in the database map cleanly to canonical reporting categories:
1. `Electronics`: ₹79,112.00 Revenue, 42.2% Margin
2. `Apparel`: ₹40,111.12 Revenue, 59.6% Margin
3. `Home Goods` (alias `Home & Kitchen`): ₹35,840.00 Revenue, 51.4% Margin
4. `Sports & Outdoors`: ₹23,400.00 Revenue, 59.6% Margin
5. `Beauty & Care` (alias `Health & Beauty`): ₹16,368.00 Revenue, 69.6% Margin

The sum of category revenues and profits equals the headline totals with zero unallocated variance.

