# SmartPrice Explainable AI Retail Optimization Suite
# Technical Documentation Index & Master Guide

> **Project Directory:** `C:\New folder\smartprice`  
> **Release Version:** 3.0.0 (Post-Consistency Fixes #1–#10)  
> **Documentation Version:** 1.0 (Audited Release)  
> **Currency Format:** Indian Rupee (INR ₹)  

---

## 1. Documentation Suite Structure

This technical documentation repository provides comprehensive technical, architectural, operational, and mathematical specifications for the SmartPrice suite.

| Document | Primary Audience | Core Coverage |
|---|---|---|
| [**01. System Overview & Architecture**](./01_SYSTEM_OVERVIEW_AND_ARCHITECTURE.md) | Architects, Leads, Executives | Problem statement, system objectives, scope, multi-tier architecture, component interaction flow, technology stack choices, and entity-relationship data model. |
| [**02. Core Business Logic & Services**](./02_CORE_BUSINESS_LOGIC_AND_SERVICES.md) | Backend Engineers, Pricing Analysts | Mathematical formulas for dynamic pricing grid search, gross-margin guardrail floors, separation of AI optimal prices from margin floors, inventory ledger reconciliation, multi-horizon demand forecasting, What-If simulation, and business reporting reconciliation. |
| [**03. Explainable AI & Attribution**](./03_EXPLAINABLE_AI_AND_ATTRIBUTION.md) | ML Engineers, Data Scientists, Auditors | Honest technical disclosure of deterministic rule attribution vs. genuine TreeSHAP, mathematical waterfall decomposition, additive closure proofs, and global feature importance weights. |
| [**04. Audit Verification & Financial Reconciliation**](./04_AUDIT_VERIFICATION_AND_FINANCIAL_RECONCILIATION.md) | QA Engineers, Compliance, Executives | Recorded audit results: 300/300 passing automated tests across 8 suites, verified financial reconciliation figures (₹194,831.12 revenue, 49.0% margin, 160 sales rows), and database table counts. |
| [**05. Operations & Local Development**](./05_OPERATIONS_AND_LOCAL_DEVELOPMENT_GUIDE.md) | Developers, DevOps, Operators | Prerequisites, repository layout, running FastAPI backend, running Vite/React frontend, local test user accounts and credentials, and test execution commands. |
| [**06. Limitations, Security & Roadmap**](./06_LIMITATIONS_SECURITY_AND_FUTURE_ROADMAP.md) | Product Managers, Security, Leads | Undefined econometric price variance limitation, deterministic explainability boundary, SQLite single-writer lock, operational assumptions, JWT/RBAC security, and 4-phase future roadmap. |

---

## 2. Navigating by Role

### For Developers & Integrators
1. Start with [**01. System Overview & Architecture**](./01_SYSTEM_OVERVIEW_AND_ARCHITECTURE.md) to understand the layered architecture and data model.
2. Read [**05. Operations & Local Development**](./05_OPERATIONS_AND_LOCAL_DEVELOPMENT_GUIDE.md) to launch the backend, frontend, and execute test suites.
3. Review [**02. Core Business Logic & Services**](./02_CORE_BUSINESS_LOGIC_AND_SERVICES.md) to inspect pricing algorithms, guardrail formulas, and inventory reconciliation logic.

### For Pricing Analysts & Merchandisers
1. Review [**02. Core Business Logic & Services**](./02_CORE_BUSINESS_LOGIC_AND_SERVICES.md) for margin guardrails, competitor match buffers, and What-If simulation calculations.
2. Review [**03. Explainable AI & Attribution**](./03_EXPLAINABLE_AI_AND_ATTRIBUTION.md) to interpret waterfall price decompositions and understand how economic drivers shape recommended prices.

### For Compliance, Auditors & Executives
1. Review [**04. Audit Verification & Financial Reconciliation**](./04_AUDIT_VERIFICATION_AND_FINANCIAL_RECONCILIATION.md) for recorded test outcomes (100% pass rate) and financial ledger reconciliation.
2. Review [**03. Explainable AI & Attribution**](./03_EXPLAINABLE_AI_AND_ATTRIBUTION.md) for transparent explainability disclosure.
3. Review [**06. Limitations, Security & Roadmap**](./06_LIMITATIONS_SECURITY_AND_FUTURE_ROADMAP.md) for security controls, operational boundaries, and planned upgrades.

