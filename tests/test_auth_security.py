import sys
import os
import time
import jwt
from datetime import timedelta

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.app.models import Product, User, InventoryTransaction
from backend.config import settings

from backend.app.services.email_service import EmailService
from backend.app.services.auth_service import otp_resend_rate_limiter

client = TestClient(app)

def run_security_tests():
    print("\n==================================================")
    print("SMARTPRICE AUTHENTICATION & SECURITY VERIFICATION SUITE")
    print("==================================================\n")

    passed = 0
    total = 0

    def complete_login(identifier, password, role=None):
        req_body = {"identifier": identifier, "password": password}
        if role:
            req_body["role"] = role
        return client.post("/api/auth/login", json=req_body)

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

    # 1. Valid credentials authenticate directly with email + password
    valid_res = complete_login("pradeep.retail@smartprice.ai", "SmartPrice@2026!")
    assert_test(valid_res.status_code == 200, "Valid credentials authenticate directly without OTP (HTTP 200)")
    valid_data = valid_res.json()
    valid_token = valid_data.get("session", {}).get("token", "")
    assert_test(bool(valid_token), "Login response contains non-empty access token")
    assert_test(valid_data.get("requires_otp") is False, "Login response confirms requires_otp is False")

    # 2. Token is a cryptographically verifiable JWT with claims
    decoded_payload = jwt.decode(valid_token, settings.get_jwt_secret(), algorithms=[settings.JWT_ALGORITHM])
    assert_test(
        decoded_payload.get("sub") == "pradeep.retail@smartprice.ai" and "exp" in decoded_payload and "user_id" in decoded_payload,
        "Access token is signed JWT containing sub, exp, and user_id claims",
        f"Subject: {decoded_payload.get('sub')}, Expires: {decoded_payload.get('exp')}"
    )

    # 3. Incorrect password is rejected
    wrong_pw_res = client.post("/api/auth/login", json={
        "identifier": "pradeep.retail@smartprice.ai",
        "password": "WrongPassword123!"
    })
    assert_test(wrong_pw_res.status_code == 401, "Incorrect password is rejected with HTTP 401 Unauthorized")

    # 4. Unknown user is rejected (no auto-provisioning)
    unknown_user_res = client.post("/api/auth/login", json={
        "identifier": "attacker.unknown@hacker.io",
        "password": "Password123!"
    })
    assert_test(unknown_user_res.status_code == 401, "Unknown user cannot log in and is not auto-created (HTTP 401)")

    # 5. Client cannot assign themselves privileged roles via login payload
    role_tamper_res = complete_login(
        "pradeep.retail@smartprice.ai",
        "SmartPrice@2026!",
        role="SuperAdmin Executive"
    )
    tampered_data = role_tamper_res.json()
    assert_test(
        tampered_data.get("user", {}).get("role") == "Retail Pricing Manager",
        "Login ignores client-specified role and loads trusted role strictly from database",
        f"Assigned Role: {tampered_data.get('user', {}).get('role')}"
    )

    # 6. Protected route rejects requests missing an Authorization header
    missing_auth_res = client.post("/api/pricing/ELC-4921/approve", json={"approved_price": 219.50})
    assert_test(missing_auth_res.status_code == 401, "Protected pricing approval rejects missing token (HTTP 401)")

    missing_inventory_res = client.post("/api/inventory/HOM-7193/restock", json={"quantity": 10})
    assert_test(missing_inventory_res.status_code == 401, "Protected inventory restock rejects missing token (HTTP 401)")

    missing_scenario_res = client.post("/api/what-if/scenarios", json={"product_id": "prod-001", "name": "Hack Scenario"})
    assert_test(missing_scenario_res.status_code == 401, "Protected scenario creation rejects missing token (HTTP 401)")

    missing_product_put = client.put("/api/products/APP-1029", json={"dynamic_pricing": True})
    assert_test(missing_product_put.status_code == 401, "Protected product update rejects missing token (HTTP 401)")

    # 7. Malformed token is rejected
    malformed_res = client.post(
        "/api/pricing/ELC-4921/approve",
        json={"approved_price": 219.50},
        headers={"Authorization": "Bearer not-a-valid-token-string"}
    )
    assert_test(malformed_res.status_code == 401, "Malformed token is rejected (HTTP 401)")

    # 8. Token signed with wrong secret key is rejected
    tampered_secret_token = jwt.encode(
        {"sub": "pradeep.retail@smartprice.ai", "user_id": "usr-01", "exp": int(time.time() + 3600)},
        "wrong-secret-key-that-does-not-match",
        algorithm="HS256"
    )
    invalid_sig_res = client.post(
        "/api/pricing/ELC-4921/approve",
        json={"approved_price": 219.50},
        headers={"Authorization": f"Bearer {tampered_secret_token}"}
    )
    assert_test(invalid_sig_res.status_code == 401, "Token with invalid cryptographic signature is rejected (HTTP 401)")

    # 9. Expired token is rejected
    expired_token = jwt.encode(
        {"sub": "pradeep.retail@smartprice.ai", "user_id": "usr-01", "exp": int(time.time() - 3600)},
        settings.get_jwt_secret(),
        algorithm=settings.JWT_ALGORITHM
    )
    expired_res = client.post(
        "/api/pricing/ELC-4921/approve",
        json={"approved_price": 219.50},
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert_test(expired_res.status_code == 401, "Expired token is rejected (HTTP 401)")

    # 10. GET /api/auth/me requires valid token and returns real profile
    auth_me_valid = client.get("/api/auth/me", headers={"Authorization": f"Bearer {valid_token}"})
    assert_test(
        auth_me_valid.status_code == 200 and auth_me_valid.json().get("identifier") == "pradeep.retail@smartprice.ai",
        "GET /api/auth/me returns authentic user profile for valid Bearer token",
        f"Profile: {auth_me_valid.json().get('name')} ({auth_me_valid.json().get('role')})"
    )

    auth_me_no_token = client.get("/api/auth/me")
    assert_test(auth_me_no_token.status_code == 401, "GET /api/auth/me rejects unauthenticated requests (HTTP 401)")

    # 10b. POST /api/auth/logout returns HTTP 200
    logout_res = client.post("/api/auth/logout")
    assert_test(logout_res.status_code == 200 and logout_res.json().get("success") is True, "POST /api/auth/logout succeeds (HTTP 200)")

    # 11. Public read-only endpoints remain accessible
    public_products = client.get("/api/products")
    assert_test(public_products.status_code == 200, "GET /api/products remains publicly accessible")

    public_inventory = client.get("/api/inventory")
    assert_test(public_inventory.status_code == 200, "GET /api/inventory remains publicly accessible")

    public_forecast = client.get("/api/forecast")
    assert_test(public_forecast.status_code == 200, "GET /api/forecast remains publicly accessible")

    public_recs = client.get("/api/pricing/recommendations")
    assert_test(public_recs.status_code == 200, "GET /api/pricing/recommendations remains publicly accessible")

    # =========================================================================
    # PHASE 1B: RBAC & ROLE ESCALATION TESTS
    # =========================================================================
    print("\n--- Phase 1B: Role-Based Access Control & Role Escalation ---")

    # Log in as Senior Merchandising Analyst (read/analytics role, not pricing approver or inventory controller)
    analyst_login = complete_login("analyst.sarah@smartprice.ai", "Sarah@SmartPrice2026!")
    assert_test(analyst_login.status_code == 200, "Senior Merchandising Analyst logs in successfully")
    analyst_token = analyst_login.json().get("session", {}).get("token", "")
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}

    # Analyst attempt to approve price -> HTTP 403 Forbidden
    analyst_approve = client.post(
        "/api/pricing/ELC-4921/approve",
        json={"approved_price": 219.50},
        headers=analyst_headers
    )
    assert_test(
        analyst_approve.status_code == 403,
        "Analyst role attempting price approval is blocked with HTTP 403 Forbidden",
        f"Detail: {analyst_approve.json().get('detail')}"
    )

    # Analyst attempt to delete product -> HTTP 403 Forbidden
    analyst_delete_prod = client.delete(
        "/api/products/ELC-4921",
        headers=analyst_headers
    )
    assert_test(
        analyst_delete_prod.status_code == 403,
        "Analyst role attempting product deletion is blocked with HTTP 403 Forbidden"
    )

    # Analyst attempt to restock inventory -> HTTP 403 Forbidden
    analyst_restock = client.post(
        "/api/inventory/HOM-7193/restock",
        json={"quantity": 10},
        headers=analyst_headers
    )
    assert_test(
        analyst_restock.status_code == 403,
        "Analyst role attempting inventory restock is blocked with HTTP 403 Forbidden"
    )

    # Analyst attempt to run catalog-wide pricing engine -> HTTP 403 Forbidden
    analyst_gen = client.post(
        "/api/pricing/generate",
        json={},
        headers=analyst_headers
    )
    assert_test(
        analyst_gen.status_code == 403,
        "Analyst role attempting catalog-wide pricing generation is blocked with HTTP 403 Forbidden"
    )

    # Analyst IS permitted to create What-If scenarios (analytical workflow)
    analyst_scen = client.post(
        "/api/what-if/scenarios",
        json={
            "product_id": "prod-001",
            "name": "Analyst Exploration Run",
            "current_price": 219.50,
            "simulated_price": 225.00,
            "expected_demand": 250,
            "expected_revenue": 56250.0,
            "expected_margin": "57.8%",
            "expected_gross_profit": 32500.0,
            "status": "Staged Draft"
        },
        headers=analyst_headers
    )
    assert_test(
        analyst_scen.status_code == 201,
        "Analyst role is permitted to create What-If exploration scenarios (HTTP 201)"
    )
    created_test_scen_id = analyst_scen.json().get("id") if analyst_scen.status_code == 201 else None
    if created_test_scen_id:
        # Immediately clean up test scenario to preserve genuine user scenarios count
        client.delete(f"/api/what-if/scenarios/{created_test_scen_id}", headers=analyst_headers)

    # =========================================================================
    # PHASE 1B: BELOW-COST PRICING PROTECTION & EXECUTIVE OVERRIDES
    # =========================================================================
    print("\n--- Phase 1B: Below-Cost Pricing Protection & Executive Overrides ---")

    # Retail Pricing Manager attempt to approve below cost without allow_below_cost -> 400 Bad Request
    pricing_mgr_headers = {"Authorization": f"Bearer {valid_token}"}
    below_cost_no_flag = client.post(
        "/api/pricing/ELC-8812/approve",
        json={"approved_price": 400.00},
        headers=pricing_mgr_headers
    )
    assert_test(
        below_cost_no_flag.status_code == 400 and "violates margin guardrail" in below_cost_no_flag.json().get("detail", ""),
        "Standard pricing manager below-cost price rejected with HTTP 400 margin guardrail violation"
    )

    # Retail Pricing Manager attempt to pass allow_below_cost=True -> 403 Forbidden (requires executive role)
    below_cost_with_flag_mgr = client.post(
        "/api/pricing/ELC-8812/approve?allow_below_cost=true",
        json={"approved_price": 400.00, "override_reason": "Clearance liquidation"},
        headers=pricing_mgr_headers
    )
    assert_test(
        below_cost_with_flag_mgr.status_code == 403,
        "Retail Pricing Manager attempting below-cost override is blocked with HTTP 403 Forbidden",
        f"Detail: {below_cost_with_flag_mgr.json().get('detail')}"
    )

    # Log in as Store Operations Director (Executive role)
    exec_login = complete_login("marcus.vance@smartprice.ai", "Marcus@SmartPrice2026!")
    assert_test(exec_login.status_code == 200, "Store Operations Director logs in successfully")
    exec_token = exec_login.json().get("session", {}).get("token", "")
    exec_headers = {"Authorization": f"Bearer {exec_token}"}

    # Store Operations Director CAN approve below-cost override
    # Product ELC-8812: cost is 540.00, current price is 899.99
    db_orig = SessionLocal()
    orig_tv_price = 899.99
    try:
        p_tv = db_orig.query(Product).filter(Product.sku == "ELC-8812").first()
        if p_tv:
            orig_tv_price = p_tv.current_price
    finally:
        db_orig.close()

    created_dec_id = None
    try:
        exec_below_cost = client.post(
            "/api/pricing/ELC-8812/approve?allow_below_cost=true",
            json={"approved_price": 500.00, "override_reason": "Executive clearance end-of-quarter sale"},
            headers=exec_headers
        )
        assert_test(
            exec_below_cost.status_code == 200 and exec_below_cost.json().get("decision") == "OVERRIDDEN_BELOW_COST",
            "Store Operations Director successfully approves below-cost override with OVERRIDDEN_BELOW_COST decision",
            f"Approved Price: ₹{exec_below_cost.json().get('approved_price')}, Decision: {exec_below_cost.json().get('decision')}"
        )

        # Verify audit record records the executive actor and override status
        db_verify = SessionLocal()
        try:
            from backend.app.models.pricing_decision import PricingDecision
            dec = db_verify.query(PricingDecision).filter(PricingDecision.product_id == p_tv.id).order_by(PricingDecision.created_at.desc()).first()
            if dec:
                created_dec_id = dec.id
            assert_test(
                dec is not None and dec.decision == "OVERRIDDEN_BELOW_COST" and ("Marcus" in dec.user or "Director" in dec.user or "marcus" in dec.user),
                "PricingDecision audit record captures authenticated actor and OVERRIDDEN_BELOW_COST status",
                f"Recorded Actor: {dec.user if dec else 'None'}, Decision: {dec.decision if dec else 'None'}"
            )
        finally:
            db_verify.close()
    finally:
        # Restore original product price and clean up test decision record
        db_restore = SessionLocal()
        try:
            p_tv_rest = db_restore.query(Product).filter(Product.sku == "ELC-8812").first()
            if p_tv_rest:
                p_tv_rest.current_price = orig_tv_price
            if created_dec_id:
                from backend.app.models.pricing_decision import PricingDecision
                test_dec = db_restore.query(PricingDecision).filter(PricingDecision.id == created_dec_id).first()
                if test_dec:
                    db_restore.delete(test_dec)
            db_restore.commit()
        except Exception:
            db_restore.rollback()
        finally:
            db_restore.close()

    # =========================================================================
    # PHASE 1B: AUDIT ACTOR IDENTITY & IMPERSONATION REJECTION
    # =========================================================================
    print("\n--- Phase 1B: Audit Actor Identity & Anti-Impersonation ---")

    # Client attempts to spoof another user's identity via request body "user"
    impersonation_dec_id = None
    try:
        impersonation_attempt = client.post(
            "/api/pricing/ELC-4921/approve",
            json={"approved_price": 219.50, "user": "Impersonated CEO Executive"},
            headers=pricing_mgr_headers
        )
        assert_test(impersonation_attempt.status_code == 200, "Pricing approval succeeds under authenticated session")

        # Verify database record: identity must be Pradeep (from token), NOT "Impersonated CEO Executive"
        db_audit = SessionLocal()
        try:
            from backend.app.models.pricing_decision import PricingDecision
            p_audio = db_audit.query(Product).filter(Product.sku == "ELC-4921").first()
            latest_dec = db_audit.query(PricingDecision).filter(PricingDecision.product_id == p_audio.id).order_by(PricingDecision.created_at.desc()).first()
            if latest_dec:
                impersonation_dec_id = latest_dec.id
            assert_test(
                latest_dec is not None and latest_dec.user != "Impersonated CEO Executive" and ("Pradeep" in latest_dec.user or "pradeep" in latest_dec.user),
                "Audit trail strictly binds identity to authenticated server-side session and rejects client impersonation",
                f"Recorded Actor in DB: {latest_dec.user if latest_dec else 'None'}"
            )
        finally:
            db_audit.close()
    finally:
        # Clean up the extra decision record created by this test
        if impersonation_dec_id:
            db_clean_dec = SessionLocal()
            try:
                from backend.app.models.pricing_decision import PricingDecision
                d_row = db_clean_dec.query(PricingDecision).filter(PricingDecision.id == impersonation_dec_id).first()
                if d_row:
                    db_clean_dec.delete(d_row)
                db_clean_dec.commit()
            except Exception:
                db_clean_dec.rollback()
            finally:
                db_clean_dec.close()

    # =========================================================================
    # PHASE 1B: INVENTORY LEDGER INTEGRITY & RECONCILIATION
    # =========================================================================
    print("\n--- Phase 1B: Inventory Ledger Integrity & Audit Protection ---")

    # Unauthorized delete attempts
    unauth_del = client.delete("/api/inventory/transactions/tx-test-fake")
    assert_test(unauth_del.status_code == 401, "Deleting inventory transaction without token rejected (HTTP 401)")

    analyst_del = client.delete("/api/inventory/transactions/tx-test-fake", headers=analyst_headers)
    assert_test(analyst_del.status_code == 403, "Deleting inventory transaction by Analyst role rejected (HTTP 403)")

    # Test inventory transaction creation, stock reconciliation, and auditable cleanup
    db_inv_check = SessionLocal()
    initial_hom_stock = 248
    try:
        p_hom = db_inv_check.query(Product).filter(Product.sku == "HOM-7193").first()
        if p_hom:
            initial_hom_stock = p_hom.stock_quantity
    finally:
        db_inv_check.close()

    test_restock_res = client.post(
        "/api/inventory/HOM-7193/restock",
        json={"quantity": 10, "notes": "Security Audit Test Restock"},
        headers=pricing_mgr_headers
    )
    assert_test(test_restock_res.status_code == 200, "Inventory restock succeeds for authorized manager")
    test_tx_data = test_restock_res.json().get("transaction", {})
    test_tx_id = test_tx_data.get("id")

    # Verify stock increased to 258
    db_stock_check = SessionLocal()
    try:
        p_hom = db_stock_check.query(Product).filter(Product.sku == "HOM-7193").first()
        assert_test(p_hom.stock_quantity == initial_hom_stock + 10, f"HOM-7193 stock increased to {initial_hom_stock + 10}")
    finally:
        db_stock_check.close()

    # Delete transaction with stock reconciliation
    del_res = client.delete(
        f"/api/inventory/transactions/{test_tx_id}",
        headers=pricing_mgr_headers
    )
    assert_test(
        del_res.status_code == 200 and del_res.json().get("success") is True,
        "Authorized delete/void of inventory transaction returns success",
        f"Action: {del_res.json().get('action')}"
    )

    # Verify stock was reconciled back to initial value (no phantom stock)
    db_reconciled = SessionLocal()
    try:
        p_hom = db_reconciled.query(Product).filter(Product.sku == "HOM-7193").first()
        assert_test(
            p_hom.stock_quantity == initial_hom_stock,
            f"Stock reconciliation automatically restored HOM-7193 stock to original {initial_hom_stock} units",
            f"Current Stock: {p_hom.stock_quantity}"
        )
    finally:
        db_reconciled.close()

    # =========================================================================
    # PHASE 1B: PRODUCTION CONFIGURATION & DATABASE INTEGRITY
    # =========================================================================
    # =========================================================================
    # PHASE 1B / FINAL SECURITY CHECKS: RATE LIMITING & PRODUCTION FAIL-SAFE
    # =========================================================================
    print("\n--- Final Checks: Rate Limiting & Production Fail-Safe ---")

    # Reset rate limiter before testing
    from backend.app.services.auth_service import login_rate_limiter
    login_rate_limiter.reset()

    # Trigger 5 failed login attempts for a test identifier
    test_victim = "rate_limit_test_user@smartprice.ai"
    for i in range(5):
        fail_res = client.post("/api/auth/login", json={"identifier": test_victim, "password": "WrongPassword!"})
        assert fail_res.status_code == 401, f"Attempt {i+1} rejected with 401"

    # 6th attempt must be throttled with HTTP 429 Too Many Requests
    throttled_res = client.post("/api/auth/login", json={"identifier": test_victim, "password": "WrongPassword!"})
    assert_test(
        throttled_res.status_code == 429 and "Retry-After" in throttled_res.headers,
        "Repeated failed logins trigger HTTP 429 Too Many Requests with Retry-After header",
        f"Detail: {throttled_res.json().get('detail')}, Retry-After: {throttled_res.headers.get('Retry-After')}"
    )

    # Clean up rate limiter
    login_rate_limiter.reset()

    # Verify fail-safe production startup secret validation
    from backend.config import Settings
    prod_insecure_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="smartprice-retail-xai-session-key-2026"
    )
    failed_safely = False
    try:
        prod_insecure_settings.validate_production_secrets()
    except RuntimeError as e:
        failed_safely = True
        err_msg = str(e)

    assert_test(
        failed_safely and "FATAL SECURITY CONFIGURATION" in err_msg,
        "Production startup fails safely (RuntimeError) if JWT_SECRET_KEY is insecure or default",
        f"Caught: {err_msg[:65]}..."
    )

    # Valid production settings with persistent strong key succeeds
    prod_secure_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="a-very-long-production-grade-secret-key-with-high-entropy-64bytes"
    )
    prod_secure_settings.validate_production_secrets()
    assert_test(
        prod_secure_settings.get_jwt_secret() == "a-very-long-production-grade-secret-key-with-high-entropy-64bytes",
        "Production startup accepts persistent environment-supplied high-entropy secret key without transient generation"
    )

    # Development settings remain usable with default key
    dev_settings = Settings(
        ENVIRONMENT="development",
        JWT_SECRET_KEY="smartprice-retail-xai-session-key-2026"
    )
    dev_settings.validate_production_secrets()
    assert_test(
        dev_settings.get_jwt_secret() == "smartprice-retail-xai-session-key-2026",
        "Development environment seamlessly permits standard default development secret"
    )

    # Database state verification
    db_final = SessionLocal()
    try:
        prod_count = db_final.query(Product).count()
        tx_count = db_final.query(InventoryTransaction).count()
        from backend.app.models.what_if_scenario import WhatIfScenario
        scen_count = db_final.query(WhatIfScenario).count()
        p_vac = db_final.query(Product).filter(Product.sku == "HOM-7193").first()
        p_audio = db_final.query(Product).filter(Product.sku == "ELC-4921").first()

        assert_test(prod_count >= 10, "Catalog retains operational products (>= 10)", f"Count: {prod_count}")
        assert_test(tx_count in [54, 55], f"Ledger retains historical transactions ({tx_count})")
        assert_test(scen_count == 5, "What-If store retains exactly 5 saved scenarios", f"Count: {scen_count}")
        assert_test(p_vac.stock_quantity == 248, "HOM-7193 stock preserved at exactly 248 units")
        assert_test(p_audio.current_price == 219.50, "ELC-4921 price preserved at exactly ₹219.50")
    finally:
        db_final.close()

    print(f"\n==================================================")
    print(f"SECURITY TEST SUMMARY: {passed}/{total} TESTS PASSED ({100 * passed / total:.1f}%)")
    print("==================================================\n")

    if passed == total:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    run_security_tests()
