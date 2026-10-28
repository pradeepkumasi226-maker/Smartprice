"""
Phase 1 End-to-End Test Suite: Backend, Database, Guardrails, and Fallback Verification.
Executes against an isolated sandbox database copy to preserve the operational database.
"""

import sys
import os
import shutil
import tempfile
import json
from decimal import Decimal

# Ensure utf-8 output encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.database import get_db, Base
from backend.app.models import Product, PricingRecommendation, PricingDecision, InventoryTransaction, WhatIfScenario
from backend.app.services.pricing_service import PricingService
from ml.forecasting.inference import ForecastInferenceEngine
from ml.optimization.inference import ElasticityInferenceBridge
from ml.explainability.inference import ExplainabilityEngine

def run_phase1_tests():
    print("\n==================================================================")
    print("SMARTPRICE E2E PHASE 1: BACKEND, DATABASE, GUARDRAILS & ARTIFACTS")
    print("==================================================================\n")

    passed = 0
    total = 0

    def assert_test(condition, name, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            print(f"[PASS] [{total:02d}]: {name}")
            if details:
                print(f"       -> {details}")
            passed += 1
        else:
            print(f"[FAIL] [{total:02d}]: {name}")
            if details:
                print(f"       -> {details}")

    # Step 1: Create isolated sandbox database
    orig_db_path = os.path.abspath("backend/data/smartprice.db")
    temp_dir = tempfile.mkdtemp(prefix="smartprice_test_")
    temp_empty_dir = None
    temp_empty_el_dir = None
    sandbox_db_path = os.path.join(temp_dir, "sandbox.db")
    shutil.copy2(orig_db_path, sandbox_db_path)

    sandbox_engine = create_engine(f"sqlite:///{sandbox_db_path}", connect_args={"check_same_thread": False})
    SandboxSession = sessionmaker(autocommit=False, autoflush=False, bind=sandbox_engine)

    def override_get_db():
        db = SandboxSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        # SECTION 1: ENDPOINTS VERIFICATION
        print("--- 1. API Endpoints Verification ---")
        
        # 1.1 Root
        r = client.get("/")
        assert_test(r.status_code == 200 and r.json().get("status") == "online", "GET / returns online health status")

        # 1.2 Auth Login without OTP
        r = client.post("/api/auth/login", json={"identifier": "pradeep.retail@smartprice.ai", "password": "SmartPrice@2026!"})
        assert_test(r.status_code == 200 and r.json().get("success") is True, "POST /api/auth/login authenticates directly and returns user profile")
        auth_token = r.json().get("session", {}).get("token")
        auth_headers = {"Authorization": f"Bearer {auth_token}"}

        # 1.3 Products Catalog
        r = client.get("/api/products")
        prods = r.json()
        assert_test(r.status_code == 200 and len(prods) == 10, "GET /api/products returns exactly 10 seeded products", f"Found {len(prods)} products")

        # 1.4 Single Product SKU
        r = client.get("/api/products/ELC-4921")
        p_audio = r.json()
        assert_test(r.status_code == 200 and p_audio.get("sku") == "ELC-4921", "GET /api/products/ELC-4921 returns audio product details")

        # 1.5 Inventory Overview
        r = client.get("/api/inventory")
        inv = r.json()
        assert_test(r.status_code == 200 and "summary" in inv and len(inv["products"]) == 10, "GET /api/inventory returns inventory breakdown and stock levels")

        # 1.6 Dashboard Summary
        r = client.get("/api/dashboard/summary")
        dash = r.json()
        assert_test(r.status_code == 200 and dash.get("revenue", 0) > 0, "GET /api/dashboard/summary calculates aggregations from database records")

        # 1.7 Reports Summary
        r = client.get("/api/reports/summary")
        rep = r.json()
        assert_test(r.status_code == 200 and len(rep.get("store_breakdown", [])) >= 4, "GET /api/reports/summary aggregates across all 4 retail stores")

        # 1.8 Demand Forecasting
        r = client.get("/api/forecast?time_range=7d")
        f_data = r.json()
        assert_test(r.status_code == 200 and len(f_data.get("points", [])) == 7, "GET /api/forecast returns 7-day projection trajectory", f"Model: {f_data.get('model_name')}")
        assert_test("Baseline" in f_data.get("model_name", ""), "Forecast response honestly declares baseline methodology", f"Model: {f_data.get('model_name')}")

        # 1.9 SHAP / Explainability
        r = client.get("/api/shap/ELC-4921")
        xai = r.json()
        assert_test(r.status_code == 200 and xai.get("is_genuine_shap") is False, "GET /api/shap/ELC-4921 declares is_genuine_shap: false")
        assert_test("waterfall_points" in xai and len(xai["waterfall_points"]) >= 5, "GET /api/shap returns complete waterfall decomposition points")

        # 1.10 AI Insights Global Drivers
        r = client.get("/api/ai-insights")
        insights = r.json()
        assert_test(r.status_code == 200 and isinstance(insights, list) and len(insights) >= 5, "GET /api/ai-insights returns catalog-level feature attributions", f"Features: {len(insights)}")

        # 1.11 What-If Simulate
        r = client.post("/api/what-if/simulate", json={"sku": "ELC-8812", "simulated_price": 949.00})
        sim = r.json()
        assert_test(r.status_code == 200 and sim.get("simulated_price") == 949.00 and sim.get("simulated_demand") > 0, "POST /api/what-if/simulate computes deterministic demand & profit metrics")

        # SECTION 2: RECOMMENDATIONS, RECALCULATION & PERSISTENCE
        print("\n--- 2. Recommendations, Approvals & Persistence ---")

        # 2.1 Pricing Recommendations endpoint
        r = client.get("/api/pricing/recommendations")
        recs = r.json()
        assert_test(r.status_code == 200 and len(recs) >= 4, "GET /api/pricing/recommendations retrieves active recommendations", f"Found {len(recs)} recs")

        # 2.2 Elasticity Curve
        r = client.get("/api/pricing/ELC-8812/elasticity")
        curve = r.json()
        assert_test(r.status_code == 200 and len(curve.get("points", [])) == 15, "GET /api/pricing/ELC-8812/elasticity returns 15-interval simulation curve", f"Points: {len(curve.get('points', []))}")

        # 2.3 Dynamic Recalculation
        recalc_r = client.post("/api/pricing/ELC-8812/recalculate", headers=auth_headers)
        assert_test(recalc_r.status_code == 200 and recalc_r.json().get("success") is True, "POST /api/pricing/ELC-8812/recalculate dynamically recalculates recommendation")

        # 2.4 Database Persistence: What-If Scenario Creation
        scen_payload = {
            "product_id": "prod-002",
            "name": "Phase 1 Isolated OLED Promo Scenario",
            "current_price": 899.00,
            "simulated_price": 929.00,
            "expected_demand": 138,
            "expected_revenue": 128202.0,
            "expected_margin": "41.9%",
            "expected_gross_profit": 53682.0,
            "status": "Staged Draft"
        }
        scen_res = client.post("/api/what-if/scenarios", json=scen_payload, headers=auth_headers)
        assert_test(scen_res.status_code == 201, "POST /api/what-if/scenarios creates scenario row")
        scen_id = scen_res.json()["id"]

        # Verify scenario in isolated DB session
        db_check = SandboxSession()
        try:
            persisted_scen = db_check.query(WhatIfScenario).filter(WhatIfScenario.id == scen_id).first()
            assert_test(persisted_scen is not None and persisted_scen.simulated_price == 929.00, "What-If Scenario persists accurately in SQLite database")
        finally:
            db_check.close()

        # 2.5 Database Persistence: Inventory Restock & Transaction
        restock_sku = "HOM-5520"  # Ergonomic Desk Chair
        p_before = client.get(f"/api/products/{restock_sku}").json()
        stock_before = p_before["stock_quantity"]
        restock_qty = 15

        restock_res = client.post(f"/api/inventory/{restock_sku}/restock", json={"quantity": restock_qty, "user": "E2E Test Runner"}, headers=auth_headers)
        assert_test(restock_res.status_code == 200, f"POST /api/inventory/{restock_sku}/restock succeeds")

        db_check = SandboxSession()
        try:
            p_after = db_check.query(Product).filter(Product.sku == restock_sku).first()
            assert_test(p_after.stock_quantity == stock_before + restock_qty, f"Restocked product stock updated from {stock_before} to {p_after.stock_quantity}")
            
            tx = db_check.query(InventoryTransaction).filter(InventoryTransaction.product_id == p_after.id).order_by(InventoryTransaction.created_at.desc()).first()
            assert_test(tx is not None and tx.quantity == restock_qty and tx.transaction_type == "RESTOCK", "InventoryTransaction audit row recorded in database")
        finally:
            db_check.close()

        # 2.6 Database Persistence: Price Approval & Decision Audit
        approve_sku = "APP-1029"  # Merino Wool Running Jacket (cost: 38.00, current: 89.00)
        target_approved_price = 98.00
        appr_res = client.post(f"/api/pricing/{approve_sku}/approve", json={"approved_price": target_approved_price, "user": "Pricing Director E2E"}, headers=auth_headers)
        assert_test(appr_res.status_code == 200, f"POST /api/pricing/{approve_sku}/approve executes price update")

        db_check = SandboxSession()
        try:
            p_appr = db_check.query(Product).filter(Product.sku == approve_sku).first()
            assert_test(p_appr.current_price == target_approved_price, f"Approved price ₹{target_approved_price} persists in Product table")

            rec_appr = db_check.query(PricingRecommendation).filter(PricingRecommendation.product_id == p_appr.id).first()
            assert_test(rec_appr is not None and rec_appr.status == "Approved", "PricingRecommendation status persists as 'Approved'")

            dec = db_check.query(PricingDecision).filter(PricingDecision.product_id == p_appr.id).order_by(PricingDecision.created_at.desc()).first()
            assert_test(dec is not None and dec.approved_price == target_approved_price and dec.decision == "APPROVED", "PricingDecision audit log committed with user attribution")
        finally:
            db_check.close()

        # SECTION 3: GUARDRAILS, MARGIN & CLEARANCE ENFORCEMENT
        print("\n--- 3. Guardrails, Cost-Floor & Clearance Behavior ---")

        # 3.1 Cost Floor Guardrail: Rejection when price < cost without explicit clearance flag
        # ELC-8812 TV cost is 540.00
        tv_cost = 540.00
        below_cost_attempt = client.post("/api/pricing/ELC-8812/approve", json={"approved_price": 400.00, "user": "E2E Tester"}, headers=auth_headers)
        assert_test(
            below_cost_attempt.status_code == 400 and "violates margin guardrail" in below_cost_attempt.json().get("detail", ""),
            "Rejection of below-cost price (₹400.00 < cost ₹540.00) with HTTP 400 Bad Request",
            f"Detail: {below_cost_attempt.json().get('detail')}"
        )

        # 3.2 Clearance Behavior: Explicit below-cost approval when allow_below_cost=True
        exec_r = client.post("/api/auth/login", json={"identifier": "marcus.vance@smartprice.ai", "password": "Marcus@SmartPrice2026!"})
        exec_headers = {"Authorization": f"Bearer {exec_r.json().get('session', {}).get('token')}"}

        clearance_price = 450.00
        clearance_res = client.post(f"/api/pricing/ELC-8812/approve?allow_below_cost=true", json={"approved_price": clearance_price, "user": "Clearance Manager"}, headers=exec_headers)
        assert_test(
            clearance_res.status_code == 200 and clearance_res.json().get("approved_price") == clearance_price,
            "Explicit clearance approval succeeds when allow_below_cost=True is specified",
            f"Approved clearance price: ₹{clearance_res.json().get('approved_price')}"
        )

        # 3.3 Dynamic Pricing Engine Guardrail Enforcement
        # Verify min_margin_pct and max_price_change_pct boundaries
        db_check = SandboxSession()
        try:
            # Test pricing calculation with strict 20% minimum margin
            strict_guardrails = {
                "min_margin_pct": 20.0,
                "max_price_change_pct": 15.0,
                "allow_below_cost": False
            }
            # For BEA-6601: cost is 12.00, current is 38.50. 20% margin requires price >= 12.00 * 1.20 = 14.40
            p_bea = db_check.query(Product).filter(Product.sku == "BEA-6601").first()
            calc_result = PricingService.calculate_product_recommendation(
                product=p_bea,
                guardrails=strict_guardrails,
                force_recalculate=True
            )
            assert_test(
                calc_result["recommended_price"] >= 14.40,
                "Dynamic pricing engine strictly enforces custom 20% minimum margin floor",
                f"Rec: ₹{calc_result['recommended_price']} >= Min Margin Floor: ₹14.40"
            )
            # Max price shift (+15% of current_price)
            max_cap = round(p_bea.current_price * 1.15, 2)
            assert_test(
                calc_result["recommended_price"] <= max_cap + 0.05,
                "Dynamic pricing engine strictly caps recommended price below max_price_change_pct limit",
                f"Rec: ₹{calc_result['recommended_price']} <= Max Cap: ₹{max_cap}"
            )
        finally:
            db_check.close()

        # SECTION 4: MODEL ARTIFACT VALIDATION & SAFE FALLBACKS
        print("\n--- 4. Model Artifacts Validation & Safe Fallbacks ---")

        # 4.1 Normal Artifact Loading
        fc_inference = ForecastInferenceEngine()
        assert_test(fc_inference.is_available(), "ForecastInferenceEngine successfully detects valid trained model artifact")
        fc_meta = fc_inference.get_metadata()
        distinct_dates = fc_meta.get("dataset_summary", {}).get("distinct_dates")
        assert_test(distinct_dates == 16, f"Forecasting metadata confirms 16 distinct dates in training set (Found {distinct_dates})")

        el_bridge = ElasticityInferenceBridge()
        assert_test(el_bridge.is_available(), "ElasticityInferenceBridge successfully detects model artifact")

        # 4.2 Safe Fallback on Missing Forecasting Artifact
        temp_empty_dir = tempfile.mkdtemp(prefix="fake_model_dir_")
        fc_fallback = ForecastInferenceEngine(artifacts_dir=temp_empty_dir)
        
        # Must not raise an exception, must safely report unavailable
        assert_test(not fc_fallback.is_available(), "Forecasting inference handles missing artifact without unhandled exception")
        fc_out = fc_fallback.generate_forecast(time_range="7d")
        assert_test("model_name" in fc_out and fc_out.get("model_version") == "none", "Missing forecasting artifact safely returns fallback response structure")

        # 4.3 Safe Fallback on Corrupt Forecasting Artifact
        corrupt_model_file = os.path.join(temp_empty_dir, "model.json")
        with open(corrupt_model_file, "w") as f:
            f.write("{invalid_json: true, garbage")
        
        fc_corrupt = ForecastInferenceEngine(artifacts_dir=temp_empty_dir)
        assert_test(fc_corrupt.get_model() is None, "Corrupt artifact JSON safely caught and handled without crash")

        # 4.4 Safe Fallback on Missing Elasticity Artifact
        temp_empty_el_dir = tempfile.mkdtemp(prefix="fake_el_dir_")
        el_fallback = ElasticityInferenceBridge(artifacts_dir=temp_empty_el_dir)
        assert_test(not el_fallback.is_available(), "Elasticity inference detects missing model artifact safely")
        el_val = el_fallback.get_sku_elasticity("ELC-4921", catalog_fallback=-1.25)
        assert_test(el_val["source"] == "fallback_catalog" and el_val["elasticity"] == -1.25, "Missing elasticity artifact routes safely to catalog benchmark (-1.25)")

        # 4.5 Explainability Engine Missing Tree Model Safety
        xai_engine = ExplainabilityEngine()
        assert_test(xai_engine.is_tree_shap_available() is False, "ExplainabilityEngine accurately reports genuine TreeSHAP is unavailable without a tree model")
        test_product = {"sku": "ELC-4921", "name": "Headphones", "current_price": 200.00, "cost_price": 95.00, "recommended_price": 216.00}
        decomp = xai_engine.explain_product_pricing(test_product)
        assert_test(decomp.get("is_genuine_shap") is False and decomp.get("explanation_method") == "deterministic_rule_attribution", "XAI engine safely applies RuleBasedPricingAttribution with verified additivity")
        assert_test(decomp.get("additivity_check", {}).get("is_additive") is True and "₹" in decomp.get("waterfall_points", [{}])[0].get("formatted_value", ""), "XAI engine decomposition specifies INR ₹ currency symbol and satisfies exact additivity")

    finally:
        # Clean up temporary sandbox directory
        app.dependency_overrides.clear()
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)
        if temp_empty_dir:
            shutil.rmtree(temp_empty_dir, ignore_errors=True)
        if temp_empty_el_dir:
            shutil.rmtree(temp_empty_el_dir, ignore_errors=True)

    print("\n==================================================================")
    print(f"PHASE 1 SUMMARY: {passed}/{total} TESTS PASSED ({100 * passed / total:.1f}%)")
    print("==================================================================\n")

    if passed == total:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    run_phase1_tests()
