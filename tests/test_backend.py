import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.app.models import Product, WhatIfScenario, PricingDecision, InventoryTransaction

import sys
import io

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

client = TestClient(app)

def run_tests():
    print("\n==================================================")
    print("SMARTPRICE PHASE 3 BACKEND VERIFICATION & PERSISTENCE TEST")
    print("==================================================\n")

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

    from backend.app.services.email_service import EmailService
    from backend.app.services.auth_service import otp_resend_rate_limiter

    intercepted_emails = []
    def mock_sender(email, otp, purpose, subject):
        intercepted_emails.append({"email": email, "otp": otp, "purpose": purpose})

    EmailService.set_mock_sender(mock_sender)
    otp_resend_rate_limiter.reset()

    # 1. Health & Root
    r = client.get("/")
    assert_test(r.status_code == 200 and r.json().get("status") == "online", "Root endpoint returns online status")

    # 1b. Real Password-Based Authentication without OTP
    login_req = client.post("/api/auth/login", json={"identifier": "pradeep.retail@smartprice.ai", "password": "SmartPrice@2026!"})
    assert_test(login_req.status_code == 200, "POST /api/auth/login succeeds with valid verified credentials")
    login_data = login_req.json()
    assert_test(login_data.get("success") is True and "session" in login_data and "token" in login_data["session"], "Login response returns valid signed session and user profile", f"User: {login_data.get('user', {}).get('name')}")
    auth_token = login_data.get("session", {}).get("token", "")
    auth_headers = {"Authorization": f"Bearer {auth_token}"}

    # 2. Products List
    r = client.get("/api/products")
    products = r.json()
    assert_test(r.status_code == 200 and len(products) >= 10, "GET /api/products returns catalog with >= 10 products", f"Found {len(products)} products")

    # 3. Product Single SKU
    r = client.get("/api/products/ELC-4921")
    p_headphone = r.json()
    assert_test(r.status_code == 200 and p_headphone.get("sku") == "ELC-4921", "GET /api/products/ELC-4921 returns Headphones", f"Name: {p_headphone.get('name')}")

    # 4. Inventory Overview & Summary
    r = client.get("/api/inventory")
    inv = r.json()
    assert_test(r.status_code == 200 and "summary" in inv and "products" in inv, "GET /api/inventory returns full summary and stock levels", f"Total units: {inv['summary']['total_units']}")

    # 5. Dashboard Summary (Real calculated values from DB)
    r = client.get("/api/dashboard/summary")
    dash = r.json()
    assert_test(r.status_code == 200 and dash.get("revenue", 0) > 0 and dash.get("units_sold", 0) > 0, "GET /api/dashboard/summary returns real database aggregations", f"Revenue: ${dash.get('revenue'):,.2f}, Units: {dash.get('units_sold')}, Margin: {dash.get('gross_margin')}%")

    # 6. Pricing Recommendations
    r = client.get("/api/pricing/recommendations")
    recs = r.json()
    assert_test(r.status_code == 200 and len(recs) >= 4, "GET /api/pricing/recommendations returns active recommendations", f"Count: {len(recs)}")

    # 7. What-If Simulation
    r = client.post("/api/what-if/simulate", json={"sku": "ELC-4921", "simulated_price": 219.50})
    sim = r.json()
    assert_test(r.status_code == 200 and sim.get("simulated_price") == 219.50 and sim.get("simulated_revenue", 0) > 0, "POST /api/what-if/simulate computes deterministic demand & profit", f"Sim Revenue: ${sim.get('simulated_revenue')}, Sim Demand: {sim.get('simulated_demand')}")

    # 8. Demand Forecast
    r = client.get("/api/forecast?time_range=7d")
    forecast = r.json()
    assert_test(r.status_code == 200 and len(forecast.get("points", [])) == 7, "GET /api/forecast returns 7-day demand trajectory", f"Model: {forecast.get('model_name')}")

    # 9. SHAP Explainability Decomposition
    r = client.get("/api/shap/ELC-4921")
    shap = r.json()
    assert_test(r.status_code == 200 and len(shap.get("waterfall_points", [])) > 0, "GET /api/shap/ELC-4921 returns TreeSHAP feature contributions", f"Features: {len(shap.get('waterfall_points'))}")

    # 10. Reports Summary
    r = client.get("/api/reports/summary")
    rep = r.json()
    assert_test(r.status_code == 200 and len(rep.get("store_breakdown", [])) > 0, "GET /api/reports/summary returns store & category breakdowns", f"Stores: {len(rep.get('store_breakdown'))}")

    # ----------------------------------------------------
    # PERSISTENCE TESTS
    # ----------------------------------------------------
    print("\n--- Running Required Persistence Tests ---")

    # PERSISTENCE TEST 1: Restock Robot Vacuum (HOM-7193)
    p_vac_before = client.get("/api/products/HOM-7193").json()
    initial_stock = p_vac_before.get("stock_quantity")
    restock_qty = 20
    created_tx_id = None

    try:
        restock_res = client.post("/api/inventory/HOM-7193/restock", json={"quantity": restock_qty, "user": "Test Runner"}, headers=auth_headers)
        assert_test(restock_res.status_code == 200, "POST /api/inventory/HOM-7193/restock succeeds")
        if restock_res.status_code == 200:
            tx_data = restock_res.json().get("transaction") or {}
            created_tx_id = tx_data.get("id")

        # Simulate backend restart / new session
        db_verify = SessionLocal()
        try:
            p_vac_db = db_verify.query(Product).filter(Product.sku == "HOM-7193").first()
            expected_stock = initial_stock + restock_qty
            assert_test(p_vac_db.stock_quantity == expected_stock, f"Robot Vacuum stock persists as {expected_stock} in SQLite database", f"Previous: {initial_stock} ➔ Current: {p_vac_db.stock_quantity}")

            # Check transaction row was created
            if created_tx_id:
                tx_row = db_verify.query(InventoryTransaction).filter(InventoryTransaction.id == created_tx_id).first()
            else:
                tx_row = db_verify.query(InventoryTransaction).filter(InventoryTransaction.product_id == p_vac_db.id).order_by(InventoryTransaction.created_at.desc()).first()
                if tx_row:
                    created_tx_id = tx_row.id
            assert_test(tx_row is not None and tx_row.quantity == restock_qty, "Inventory transaction row recorded and committed to database")
        finally:
            db_verify.close()
    finally:
        # Self-cleaning: restore original stock and remove only the specific test transaction created
        db_clean = SessionLocal()
        try:
            p_clean = db_clean.query(Product).filter(Product.sku == "HOM-7193").first()
            if p_clean and initial_stock is not None:
                p_clean.stock_quantity = initial_stock
            if created_tx_id:
                tx_clean = db_clean.query(InventoryTransaction).filter(InventoryTransaction.id == created_tx_id).first()
                if tx_clean:
                    db_clean.delete(tx_clean)
            db_clean.commit()
        except Exception as e:
            db_clean.rollback()
        finally:
            db_clean.close()

    # PERSISTENCE TEST 2: Save What-If Scenario
    scenario_payload = {
        "product_id": "prod-001",
        "name": "Summer High Margin Audio Run ($219.50)",
        "current_price": 199.99,
        "simulated_price": 219.50,
        "expected_demand": 278,
        "expected_revenue": 61021.0,
        "expected_margin": "49.9%",
        "expected_gross_profit": 30441.0,
        "status": "Staged Draft"
    }
    created_scen_id = None
    try:
        scen_res = client.post("/api/what-if/scenarios", json=scenario_payload, headers=auth_headers)
        scen_data = scen_res.json()
        assert_test(scen_res.status_code == 201, "POST /api/what-if/scenarios creates and saves scenario")
        if isinstance(scen_data, dict) and "id" in scen_data:
            created_scen_id = scen_data["id"]

        # Verify scenario in fresh DB session
        db_verify = SessionLocal()
        try:
            scen_row = db_verify.query(WhatIfScenario).filter(WhatIfScenario.id == created_scen_id).first()
            assert_test(scen_row is not None and scen_row.simulated_price == 219.50, "Saved What-If scenario persists in SQLite database across sessions", f"Scenario ID: {scen_row.id if scen_row else 'N/A'}, Price: ${scen_row.simulated_price if scen_row else 0}")
        finally:
            db_verify.close()
    finally:
        # Self-cleaning: Remove only the specific scenario created by this test run
        if created_scen_id:
            db_clean = SessionLocal()
            try:
                row_to_clean = db_clean.query(WhatIfScenario).filter(WhatIfScenario.id == created_scen_id).first()
                if row_to_clean:
                    db_clean.delete(row_to_clean)
                    db_clean.commit()
            except Exception as e:
                db_clean.rollback()
                print(f"       [WARN] Failed to clean up test scenario {created_scen_id}: {e}")
            finally:
                db_clean.close()

    # PERSISTENCE TEST 3: Approve Pricing Recommendation
    approve_res = client.post("/api/pricing/ELC-4921/approve", json={"approved_price": 219.50, "user": "Retail Pricing Director"}, headers=auth_headers)
    assert_test(approve_res.status_code == 200, "POST /api/pricing/ELC-4921/approve executes price update")

    # Verify in fresh DB session
    db_verify = SessionLocal()
    try:
        p_audio_db = db_verify.query(Product).filter(Product.sku == "ELC-4921").first()
        assert_test(p_audio_db.current_price == 219.50, "Approved price $219.50 persists in Product table", f"Current Shelf Price: ${p_audio_db.current_price}")

        dec_row = db_verify.query(PricingDecision).filter(PricingDecision.product_id == p_audio_db.id).order_by(PricingDecision.created_at.desc()).first()
        assert_test(dec_row is not None and dec_row.approved_price == 219.50 and dec_row.decision == "APPROVED", "Pricing decision audit record persists in database")
    finally:
        db_verify.close()

    # ----------------------------------------------------
    # DYNAMIC PRICING DATA CONSISTENCY & GUARDRAIL TESTS
    # ----------------------------------------------------
    print("\n--- Running Dynamic Pricing Consistency & Guardrail Tests ---")

    # TEST 4: ELC-4921 Recommendation reflects live product current_price = 219.50
    recs_res = client.get("/api/pricing/recommendations").json()
    rec_headphone = next((r for r in recs_res if r.get("sku") == "ELC-4921"), None)
    assert_test(
        rec_headphone is not None and rec_headphone.get("current_price") == 219.50 and rec_headphone.get("recommended_price") == 219.50,
        "ELC-4921 recommendation uses current shelf price ₹219.50 (not outdated ₹199.99)",
        f"current_price: {rec_headphone.get('current_price')}, recommended_price: {rec_headphone.get('recommended_price')}"
    )
    assert_test(
        rec_headphone.get("price_delta") == "₹0.00" and rec_headphone.get("status") == "Approved",
        "ELC-4921 has zero price delta and Approved status reflecting prior persistence",
        f"Delta: {rec_headphone.get('price_delta')}, Status: {rec_headphone.get('status')}"
    )

    # TEST 5: Verify pending recommendations and guardrails
    pending_recs = [r for r in recs_res if r.get("status") == "Pending Approval"]
    guardrails_passed = len(pending_recs) > 0 and all(r.get("recommended_price") >= r.get("cost_price", 0) * 1.05 for r in pending_recs)
    assert_test(
        guardrails_passed,
        "Pending pricing recommendations exist and satisfy pricing guardrail checks",
        f"Found {len(pending_recs)} pending: {[r['sku'] for r in pending_recs]}"
    )

    assert_test(guardrails_passed, "All pending recommendations strictly pass margin floor guardrail (rec_price >= cost * 1.05)")

    # TEST 6: Distinguish Revenue Lift from Profit Lift
    active_rec = next(
        (
            r for r in recs_res
            if r.get("status") == "Pending Approval"
            and r.get("current_price") is not None
            and r.get("recommended_price") is not None
            and abs(r.get("recommended_price") - r.get("current_price")) > 0.01
        ),
        None
    )
    assert_test(
        active_rec is not None
        and "revenue_lift" in active_rec
        and "profit_lift" in active_rec
        and active_rec.get("revenue_lift") != active_rec.get("profit_lift"),
        "Revenue lift and Gross Profit lift are explicitly distinguished with separate calculations",
        f"Selected SKU: {active_rec.get('sku') if active_rec else 'None'}, Revenue Lift: {active_rec.get('revenue_lift') if active_rec else 'N/A'}, Profit Lift: {active_rec.get('profit_lift') if active_rec else 'N/A'}"
    )

    # TEST 7: Guardrail Validation rejects below-cost price approval (HTTP 400)
    below_cost_res = client.post("/api/pricing/ELC-4921/approve", json={"approved_price": 50.00, "user": "Test Manager"}, headers=auth_headers)
    assert_test(
        below_cost_res.status_code == 400 and "violates margin guardrail" in below_cost_res.json().get("detail", ""),
        "POST /api/pricing/ELC-4921/approve rejects below-cost price (₹50.00 < cost ₹95.00) with 400 Bad Request",
        f"Detail: {below_cost_res.json().get('detail')}"
    )

    # TEST 8: Recalculate recommendation endpoint
    recalc_res = client.post("/api/pricing/ELC-4921/recalculate", headers=auth_headers)
    assert_test(
        recalc_res.status_code == 200 and recalc_res.json().get("success") is True,
        "POST /api/pricing/ELC-4921/recalculate dynamically recalculates recommendation using current product state",
        f"Optimal: {recalc_res.json().get('recommended_price')}, Demand: {recalc_res.json().get('expected_demand')}"
    )

    # Restore ELC-4921 to Approved state at 219.50 to preserve idempotency across runs
    client.post("/api/pricing/ELC-4921/approve", json={"approved_price": 219.50, "user": "Retail Pricing Director"}, headers=auth_headers)

    # --- Dynamic Pricing Toggle Persistence Regression Tests (Merino Wool Jacket APP-1029 / prod-003) ---
    print("\n--- Running Dynamic Pricing Persistence Tests (APP-1029 / prod-003) ---")

    # TEST 9: Verify current state contains dynamic_pricing field
    initial_jacket = client.get("/api/products/APP-1029").json()
    assert_test(
        "dynamic_pricing" in initial_jacket,
        "GET /api/products/APP-1029 returns dynamic_pricing field",
        f"dynamic_pricing: {initial_jacket.get('dynamic_pricing')}"
    )

    # TEST 10: Turn Dynamic Pricing ON via PUT /api/products/{sku}
    enable_res = client.put("/api/products/APP-1029", json={"dynamic_pricing": True}, headers=auth_headers)
    assert_test(
        enable_res.status_code == 200 and enable_res.json().get("dynamic_pricing") is True,
        "PUT /api/products/APP-1029 enables Dynamic Pricing (returns dynamic_pricing: True)",
        f"Response dynamic_pricing: {enable_res.json().get('dynamic_pricing')}"
    )

    # TEST 11: Reload product from API and verify SQLite database persistence
    reloaded_jacket = client.get("/api/products/APP-1029").json()
    db_session = SessionLocal()
    db_product = db_session.query(Product).filter(Product.sku == "APP-1029").first()
    db_val = db_product.dynamic_pricing if db_product else None
    db_session.close()

    assert_test(
        reloaded_jacket.get("dynamic_pricing") is True and db_val is True,
        "Dynamic Pricing ON persists after reloading product from API and SQLite database",
        f"API: {reloaded_jacket.get('dynamic_pricing')}, DB: {db_val}"
    )

    # TEST 12: Turn Dynamic Pricing OFF via PUT /api/products/{sku}
    disable_res = client.put("/api/products/APP-1029", json={"dynamic_pricing": False}, headers=auth_headers)
    assert_test(
        disable_res.status_code == 200 and disable_res.json().get("dynamic_pricing") is False,
        "PUT /api/products/APP-1029 disables Dynamic Pricing (returns dynamic_pricing: False)",
        f"Response dynamic_pricing: {disable_res.json().get('dynamic_pricing')}"
    )

    # TEST 13: Reload product and verify disabling persists in API and SQLite database
    reloaded_off = client.get("/api/products/APP-1029").json()
    db_session = SessionLocal()
    db_product = db_session.query(Product).filter(Product.sku == "APP-1029").first()
    db_val_off = db_product.dynamic_pricing if db_product else None
    db_session.close()

    assert_test(
        reloaded_off.get("dynamic_pricing") is False and db_val_off is False,
        "Dynamic Pricing OFF persists after reloading product from API and SQLite database",
        f"API: {reloaded_off.get('dynamic_pricing')}, DB: {db_val_off}"
    )

    print(f"\n==================================================")
    print(f"TEST SUMMARY: {passed}/{total} TESTS PASSED ({100 * passed / total:.1f}%)")
    print("==================================================\n")

    if passed == total:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
