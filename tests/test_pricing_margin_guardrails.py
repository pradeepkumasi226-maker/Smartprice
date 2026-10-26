"""
SmartPrice Automated Test Suite: Minimum Gross-Margin Guardrail Floor Verification.

Validates:
1. Exact mathematical formula: floor_price = cost_price / (1 - margin_fraction)
2. Cost ₹540, margin 25% -> floor ₹720.00
3. Cost ₹540, margin 5% -> floor ₹568.42 after rounding to 2 decimal places
4. Gross margin verification: (price - cost) / price >= configured_margin within rounding tolerance
5. Input validation & safety: rejection of >= 100%, negative margin, negative cost, non-finite values
6. PricingService.calculate_product_recommendation integration with gross margin guardrails
7. API error handling: invalid margin parameters safely return HTTP 400 Bad Request
"""

import sys
import os
import math

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from backend.app.services.pricing_service import PricingService
from backend.app.models.product import Product

client = TestClient(app)

def run_margin_guardrail_tests():
    print("\n=======================================================")
    print("SMARTPRICE MINIMUM GROSS-MARGIN FLOOR VERIFICATION TEST")
    print("=======================================================\n")

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

    # ---------------------------------------------------------
    # PART 1: Core Formula & Benchmark Values
    # ---------------------------------------------------------
    print("--- 1. Mathematical Benchmarks for Gross Margin Floor ---")

    # Benchmark 1: Cost 540, Margin 25% -> Exactly 720.00
    floor_25 = PricingService.calculate_margin_floor(cost_price=540.0, min_margin_pct=25.0)
    assert_test(
        floor_25 == 720.00,
        "Cost ₹540.00 with 25% gross margin produces floor ₹720.00",
        f"Calculated: ₹{floor_25:.2f} (Expected: ₹720.00)"
    )

    actual_margin_25 = ((floor_25 - 540.0) / floor_25) * 100
    assert_test(
        abs(actual_margin_25 - 25.0) < 0.001,
        "Floor ₹720.00 satisfies exactly 25.0% gross margin on ₹540.00 cost",
        f"Actual Margin: {actual_margin_25:.4f}%"
    )

    # Benchmark 2: Cost 540, Margin 5% -> Exactly 568.42 (rounded from 568.42105...)
    floor_5 = PricingService.calculate_margin_floor(cost_price=540.0, min_margin_pct=5.0)
    assert_test(
        floor_5 == 568.42,
        "Cost ₹540.00 with 5% gross margin produces floor ₹568.42 after 2-decimal rounding",
        f"Calculated: ₹{floor_5:.2f} (Expected: ₹568.42)"
    )

    actual_margin_5 = ((floor_5 - 540.0) / floor_5) * 100
    assert_test(
        actual_margin_5 >= 4.99 and abs(actual_margin_5 - 5.0) < 0.01,
        "Floor ₹568.42 satisfies 5.0% gross margin within rounding tolerance",
        f"Actual Margin: {actual_margin_5:.4f}% (Delta from 5.0%: {abs(actual_margin_5 - 5.0):.6f}%)"
    )

    # Benchmark 3: Zero margin (0% margin means floor equals cost price)
    floor_0 = PricingService.calculate_margin_floor(cost_price=540.0, min_margin_pct=0.0)
    assert_test(
        floor_0 == 540.00,
        "Cost ₹540.00 with 0% margin produces floor equal to cost price ₹540.00",
        f"Calculated: ₹{floor_0:.2f}"
    )

    # Benchmark 4: Zero cost (0 cost produces 0 floor)
    floor_zero_cost = PricingService.calculate_margin_floor(cost_price=0.0, min_margin_pct=25.0)
    assert_test(
        floor_zero_cost == 0.00,
        "Cost ₹0.00 produces floor ₹0.00 regardless of margin percentage",
        f"Calculated: ₹{floor_zero_cost:.2f}"
    )

    # Benchmark 5: Other representative catalog products
    # Product with cost ₹95 (ELC-4921) at 5% margin -> 95 / 0.95 = 100.00
    floor_headphones = PricingService.calculate_margin_floor(cost_price=95.0, min_margin_pct=5.0)
    assert_test(
        floor_headphones == 100.00,
        "Cost ₹95.00 with 5% margin produces exact integer floor ₹100.00",
        f"Calculated: ₹{floor_headphones:.2f}"
    )

    # ---------------------------------------------------------
    # PART 2: Robust Validation & Unsafe Input Rejection
    # ---------------------------------------------------------
    print("\n--- 2. Validation & Unsafe Input Guardrails ---")

    # Margin >= 100% rejected (division by zero / negative price)
    rejected_100 = False
    try:
        PricingService.calculate_margin_floor(cost_price=540.0, min_margin_pct=100.0)
    except ValueError as e:
        rejected_100 = True
    assert_test(rejected_100, "100% margin is rejected with ValueError (prevents division by zero)")

    rejected_120 = False
    try:
        PricingService.calculate_margin_floor(cost_price=540.0, min_margin_pct=120.0)
    except ValueError as e:
        rejected_120 = True
    assert_test(rejected_120, "Margin > 100% (120%) is rejected with ValueError")

    # Negative margin rejected
    rejected_neg_margin = False
    try:
        PricingService.calculate_margin_floor(cost_price=540.0, min_margin_pct=-5.0)
    except ValueError as e:
        rejected_neg_margin = True
    assert_test(rejected_neg_margin, "Negative margin (-5%) is rejected with ValueError")

    # Negative cost rejected
    rejected_neg_cost = False
    try:
        PricingService.calculate_margin_floor(cost_price=-540.0, min_margin_pct=25.0)
    except ValueError as e:
        rejected_neg_cost = True
    assert_test(rejected_neg_cost, "Negative cost (-₹540.00) is rejected with ValueError")

    # Non-finite values rejected
    rejected_nan = False
    try:
        PricingService.calculate_margin_floor(cost_price=540.0, min_margin_pct=float('nan'))
    except ValueError as e:
        rejected_nan = True
    assert_test(rejected_nan, "NaN margin is rejected with ValueError")

    rejected_inf = False
    try:
        PricingService.calculate_margin_floor(cost_price=540.0, min_margin_pct=float('inf'))
    except ValueError as e:
        rejected_inf = True
    assert_test(rejected_inf, "Infinite margin is rejected with ValueError")

    # None cost rejected
    rejected_none = False
    try:
        PricingService.calculate_margin_floor(cost_price=None, min_margin_pct=25.0)
    except ValueError as e:
        rejected_none = True
    assert_test(rejected_none, "None cost price is rejected with ValueError")

    # ---------------------------------------------------------
    # PART 3: PricingService Recommendation Engine Integration
    # ---------------------------------------------------------
    print("\n--- 3. Recommendation Engine & Product Guardrails Integration ---")

    mock_tv = Product(
        id="mock-prod-002",
        sku="ELC-8812",
        name="4K Quantum-Dot OLED Smart TV (55-Inch)",
        category="Electronics",
        current_price=947.58,
        cost_price=540.00,
        competitor_price=949.00,
        stock_quantity=40,
        reorder_level=20,
        safety_stock=10,
        rating=4.7,
        elasticity=-1.85,
        predicted_demand=140
    )

    # Test 3.1: Recommendation engine with default 5% margin
    rec_default = PricingService.calculate_product_recommendation(
        product=mock_tv,
        guardrails={},
        force_recalculate=True
    )
    assert_test(
        rec_default["min_guardrail"] == 568.42,
        "calculate_product_recommendation applies ₹568.42 min_guardrail for default 5% margin",
        f"min_guardrail: ₹{rec_default['min_guardrail']:.2f}"
    )
    assert_test(
        rec_default["recommended_price"] >= 568.42,
        "Recommended price strictly respects ₹568.42 gross-margin floor",
        f"Recommended price: ₹{rec_default['recommended_price']:.2f}"
    )

    # Test 3.2: Recommendation engine with configured 25% margin
    rec_25 = PricingService.calculate_product_recommendation(
        product=mock_tv,
        guardrails={"min_margin_pct": 25.0},
        force_recalculate=True
    )
    assert_test(
        rec_25["min_guardrail"] == 720.00,
        "calculate_product_recommendation applies ₹720.00 min_guardrail for 25% margin",
        f"min_guardrail: ₹{rec_25['min_guardrail']:.2f}"
    )
    assert_test(
        rec_25["recommended_price"] >= 720.00,
        "Recommended price strictly respects ₹720.00 gross-margin floor",
        f"Recommended price: ₹{rec_25['recommended_price']:.2f}"
    )

    # Test 3.3: Absolute minimum price rule preserved when below-cost is allowed
    rec_clearance = PricingService.calculate_product_recommendation(
        product=mock_tv,
        guardrails={"allow_below_cost": True},
        force_recalculate=True
    )
    assert_test(
        rec_clearance["min_guardrail"] == 0.01,
        "When allow_below_cost=True, min_guardrail defaults to absolute floor ₹0.01",
        f"min_guardrail: ₹{rec_clearance['min_guardrail']:.2f}"
    )

    # Test 3.4: Rejection of invalid margin in calculate_product_recommendation
    rec_invalid_rejected = False
    try:
        PricingService.calculate_product_recommendation(
            product=mock_tv,
            guardrails={"min_margin_pct": 105.0},
            force_recalculate=True
        )
    except ValueError:
        rec_invalid_rejected = True
    assert_test(
        rec_invalid_rejected,
        "calculate_product_recommendation safely rejects invalid margin (105%) with ValueError"
    )

    # ---------------------------------------------------------
    # PART 4: FastAPI Router Validation
    # ---------------------------------------------------------
    print("\n--- 4. HTTP API Router Guardrail & Error Handling ---")

    # Valid recommendation query with 25% margin
    res_valid = client.get("/api/pricing/recommendations?min_margin_pct=25.0")
    assert_test(
        res_valid.status_code == 200,
        "GET /api/pricing/recommendations?min_margin_pct=25.0 succeeds with HTTP 200",
        f"Count: {len(res_valid.json())}"
    )
    tv_rec = next((r for r in res_valid.json() if r.get("sku") == "ELC-8812"), None)
    if tv_rec:
        assert_test(
            tv_rec.get("min_guardrail") == 720.00,
            "API returns min_guardrail ₹720.00 for ELC-8812 with min_margin_pct=25.0",
            f"API min_guardrail: ₹{tv_rec.get('min_guardrail')}"
        )

    # Invalid margin in query parameter returns HTTP 400
    res_invalid_high = client.get("/api/pricing/recommendations?min_margin_pct=100.0")
    assert_test(
        res_invalid_high.status_code == 400,
        "GET /api/pricing/recommendations?min_margin_pct=100.0 returns HTTP 400 Bad Request",
        f"Status: {res_invalid_high.status_code}, Detail: {res_invalid_high.json().get('detail')}"
    )

    res_invalid_neg = client.get("/api/pricing/recommendations?min_margin_pct=-10.0")
    assert_test(
        res_invalid_neg.status_code == 400,
        "GET /api/pricing/recommendations?min_margin_pct=-10.0 returns HTTP 400 Bad Request",
        f"Status: {res_invalid_neg.status_code}, Detail: {res_invalid_neg.json().get('detail')}"
    )

    # Test 4.2: Changing setting is dynamically reflected in subsequent recommendation requests
    # Request 1: 30% margin -> for cost 540, floor = 540 / (1 - 0.30) = 771.43
    res_30 = client.get("/api/pricing/recommendations?min_margin_pct=30.0")
    tv_rec_30 = next((r for r in res_30.json() if r.get("sku") == "ELC-8812"), None)
    assert_test(
        res_30.status_code == 200 and tv_rec_30 is not None and tv_rec_30.get("min_guardrail") == 771.43,
        "Subsequent request with changed setting (30% margin) dynamically updates min_guardrail to ₹771.43",
        f"min_guardrail: ₹{tv_rec_30.get('min_guardrail') if tv_rec_30 else 'N/A'}"
    )

    # Request 2: 15% margin -> for cost 540, floor = 540 / (1 - 0.15) = 635.29
    res_15 = client.get("/api/pricing/recommendations?min_margin_pct=15.0")
    tv_rec_15 = next((r for r in res_15.json() if r.get("sku") == "ELC-8812"), None)
    assert_test(
        res_15.status_code == 200 and tv_rec_15 is not None and tv_rec_15.get("min_guardrail") == 635.29,
        "Subsequent request with changed setting (15% margin) dynamically updates min_guardrail to ₹635.29",
        f"min_guardrail: ₹{tv_rec_15.get('min_guardrail') if tv_rec_15 else 'N/A'}"
    )

    # Test 4.3: POST /api/pricing/generate guardrail propagation & validation
    login_res = client.post("/api/auth/login", json={"identifier": "pradeep.retail@smartprice.ai", "password": "SmartPrice@2026!"})
    token = login_res.json().get("session", {}).get("token") if login_res.status_code == 200 else None
    auth_headers = {"Authorization": f"Bearer {token}"} if token else {}

    gen_invalid = client.post(
        "/api/pricing/generate",
        json={"min_margin_pct": 125.0, "max_price_change_pct": 20.0},
        headers=auth_headers
    )
    assert_test(
        gen_invalid.status_code == 400,
        "POST /api/pricing/generate safely rejects invalid margin (125%) with HTTP 400",
        f"Status: {gen_invalid.status_code}, Detail: {gen_invalid.json().get('detail')}"
    )

    gen_invalid_neg = client.post(
        "/api/pricing/generate",
        json={"min_margin_pct": -5.0, "max_price_change_pct": 20.0},
        headers=auth_headers
    )
    assert_test(
        gen_invalid_neg.status_code == 400,
        "POST /api/pricing/generate safely rejects negative margin (-5%) with HTTP 400",
        f"Status: {gen_invalid_neg.status_code}, Detail: {gen_invalid_neg.json().get('detail')}"
    )

    # Final summary
    print(f"\n=======================================================")
    print(f"TEST SUMMARY: {passed}/{total} TESTS PASSED ({100 * passed / total:.1f}%)")
    print("=======================================================\n")

    if passed == total:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    run_margin_guardrail_tests()
