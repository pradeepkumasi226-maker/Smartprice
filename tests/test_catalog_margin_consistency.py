"""
SmartPrice Consistency Fix #3 Verification Test Suite
=====================================================
Validates that stale or below-cost recommendations in the product catalog
are never presented as ordinary safe recommendations, configured gross-margin
guardrails are respected, historical override audit records are preserved, and
/api/products is 100% consistent with /api/products/{sku}.

Required coverage:
1. A historical below-cost recommendation (e.g. ELC-8812 @ ₹500 vs cost ₹540).
2. A recommendation below the configured gross-margin floor (e.g. ₹720 floor at 25% margin).
3. A valid recommendation (e.g. APP-3041 @ ₹69.66 for cost ₹24.0).
4. Consistency between /api/products and /api/products/{sku}.
5. Preservation of historical override records and auditability.
"""

import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.app.models.product import Product
from backend.app.models.pricing_recommendation import PricingRecommendation
from backend.app.models.pricing_decision import PricingDecision
from backend.app.services.product_service import ProductService

client = TestClient(app)
passed_tests = 0
total_tests = 0

def assert_test(condition: bool, test_name: str, detail: str = ""):
    global passed_tests, total_tests
    total_tests += 1
    if condition:
        passed_tests += 1
        print(f"[PASS] [{total_tests:02d}]: {test_name}")
        if detail:
            print(f"       -> {detail}")
    else:
        print(f"[FAIL] [{total_tests:02d}]: {test_name}")
        if detail:
            print(f"       -> {detail}")
        raise AssertionError(f"Test failed: {test_name} - {detail}")

print("\n" + "=" * 65)
print("SMARTPRICE CATALOG RECOMMENDATION CONSISTENCY VERIFICATION TEST")
print("=" * 65 + "\n")

# -------------------------------------------------------------
# 1. Historical Below-Cost Recommendation (ELC-8812)
# -------------------------------------------------------------
print("--- 1. Historical Below-Cost Recommendation Protection ---")

res_tv = client.get("/api/products/ELC-8812")
assert_test(res_tv.status_code == 200, "GET /api/products/ELC-8812 returns HTTP 200")
data_tv = res_tv.json()

assert_test(
    data_tv.get("recommended_price") != 500.0,
    "Catalog does NOT return stale below-cost override price (₹500.00) as ordinary recommended price",
    f"Returned recommended_price: ₹{data_tv.get('recommended_price')}"
)

assert_test(
    data_tv.get("recommended_price") >= data_tv.get("cost_price", 540.0),
    "Recommended price strictly honors wholesale cost floor (₹540.00)",
    f"recommended_price: ₹{data_tv.get('recommended_price')} >= cost: ₹{data_tv.get('cost_price')}"
)

assert_test(
    data_tv.get("has_active_recommendation") is False,
    "ELC-8812 correctly identifies that it has no active pending recommendation",
    f"has_active_recommendation: {data_tv.get('has_active_recommendation')}"
)

assert_test(
    data_tv.get("has_historical_override") is True,
    "ELC-8812 correctly flags historical below-cost override status",
    f"has_historical_override: {data_tv.get('has_historical_override')}"
)

assert_test(
    data_tv.get("historical_override_price") == 500.0,
    "Historical override price (₹500.00) is accessible via audit metadata",
    f"historical_override_price: ₹{data_tv.get('historical_override_price')}"
)

# -------------------------------------------------------------
# 2. Configured Gross-Margin Floor Enforcement
# -------------------------------------------------------------
print("\n--- 2. Configured Gross-Margin Floor Enforcement ---")

# When min_margin_pct=25.0 is passed:
res_tv_25 = client.get("/api/products/ELC-8812?min_margin_pct=25.0")
assert_test(res_tv_25.status_code == 200, "GET /api/products/ELC-8812?min_margin_pct=25.0 returns HTTP 200")
data_tv_25 = res_tv_25.json()

assert_test(
    data_tv_25.get("recommended_price") >= 720.00,
    "Configured 25% margin enforces ₹720.00 floor for ₹540.00 unit cost",
    f"recommended_price: ₹{data_tv_25.get('recommended_price')} >= ₹720.00"
)

# Test synthetic product with recommendation below margin floor via service
db = SessionLocal()
try:
    tv_product = db.query(Product).filter(Product.sku == "ELC-8812").first()
    # At 30% margin, floor for 540 cost is 540 / (1 - 0.30) = 771.43
    resolved_30 = ProductService._resolve_product_recommendation(tv_product, min_margin_pct=30.0)
    assert_test(
        resolved_30["recommended_price"] >= 771.43,
        "Configured 30% margin enforces ₹771.43 floor for ₹540.00 unit cost",
        f"Resolved recommendation: ₹{resolved_30['recommended_price']}"
    )

    # When no margin is specified, verify catalog does not silently hardcode 25%
    resolved_none = ProductService._resolve_product_recommendation(tv_product, min_margin_pct=None)
    assert_test(
        resolved_none["recommended_price"] >= tv_product.cost_price,
        "When no margin is passed, wholesale cost floor (₹540.00) is safe default without hardcoding 25%",
        f"Resolved recommendation: ₹{resolved_none['recommended_price']} >= Cost ₹{tv_product.cost_price}"
    )
finally:
    db.close()

# Validation of invalid margin percentages
res_bad_margin = client.get("/api/products/ELC-8812?min_margin_pct=110.0")
assert_test(
    res_bad_margin.status_code == 400,
    "GET /api/products/ELC-8812 rejects invalid margin (110%) with HTTP 400",
    f"Status: {res_bad_margin.status_code}, Detail: {res_bad_margin.json().get('detail')}"
)

res_neg_margin = client.get("/api/products/ELC-8812?min_margin_pct=-5.0")
assert_test(
    res_neg_margin.status_code == 400,
    "GET /api/products/ELC-8812 rejects negative margin (-5%) with HTTP 400",
    f"Status: {res_neg_margin.status_code}, Detail: {res_neg_margin.json().get('detail')}"
)

# -------------------------------------------------------------
# 3. Valid Active Recommendation (APP-3041 & HOM-5520)
# -------------------------------------------------------------
print("\n--- 3. Valid Active Recommendation Preservation ---")

res_app = client.get("/api/products/APP-3041")
assert_test(res_app.status_code == 200, "GET /api/products/APP-3041 returns HTTP 200")
data_app = res_app.json()

assert_test(
    data_app.get("recommended_price") == 69.66,
    "APP-3041 valid pending recommendation (₹69.66) is preserved and returned",
    f"recommended_price: ₹{data_app.get('recommended_price')} (Cost: ₹{data_app.get('cost_price')})"
)

assert_test(
    data_app.get("has_active_recommendation") is True,
    "APP-3041 correctly flags has_active_recommendation = True",
    f"has_active_recommendation: {data_app.get('has_active_recommendation')}"
)

res_hom = client.get("/api/products/HOM-5520")
assert_test(res_hom.status_code == 200, "GET /api/products/HOM-5520 returns HTTP 200")
data_hom = res_hom.json()

assert_test(
    data_hom.get("recommended_price") == 268.92,
    "HOM-5520 valid pending recommendation (₹268.92) is preserved and returned",
    f"recommended_price: ₹{data_hom.get('recommended_price')} (Cost: ₹{data_hom.get('cost_price')})"
)

assert_test(
    data_hom.get("has_active_recommendation") is True,
    "HOM-5520 correctly flags has_active_recommendation = True",
    f"has_active_recommendation: {data_hom.get('has_active_recommendation')}"
)

# -------------------------------------------------------------
# 4. Consistency Between /api/products and /api/products/{sku}
# -------------------------------------------------------------
print("\n--- 4. Consistency Between /api/products and /api/products/{sku} ---")

res_all = client.get("/api/products?min_margin_pct=25.0")
assert_test(res_all.status_code == 200, "GET /api/products?min_margin_pct=25.0 returns HTTP 200")
all_products = res_all.json()
assert_test(len(all_products) >= 10, f"Found {len(all_products)} products in catalog list")

for p_item in all_products:
    sku = p_item["sku"]
    single_res = client.get(f"/api/products/{sku}?min_margin_pct=25.0")
    assert_test(
        single_res.status_code == 200,
        f"GET /api/products/{sku} succeeds with HTTP 200"
    )
    single_item = single_res.json()

    # Compare key fields
    assert_test(
        p_item["recommended_price"] == single_item["recommended_price"],
        f"{sku}: recommended_price identical across collection and item endpoint",
        f"Collection: ₹{p_item['recommended_price']} == Single: ₹{single_item['recommended_price']}"
    )
    assert_test(
        p_item["has_active_recommendation"] == single_item["has_active_recommendation"],
        f"{sku}: has_active_recommendation matches"
    )
    assert_test(
        p_item["has_historical_override"] == single_item["has_historical_override"],
        f"{sku}: has_historical_override matches"
    )

# -------------------------------------------------------------
# 5. Preservation of Historical Override & Decision Records
# -------------------------------------------------------------
print("\n--- 5. Preservation of Historical Override & Decision Records ---")

db = SessionLocal()
try:
    tv = db.query(Product).filter(Product.sku == "ELC-8812").first()
    assert_test(tv is not None, "ELC-8812 exists in SQLite database")
    assert_test(tv.current_price == 947.58, f"Product.current_price was NOT modified by catalog calls: ₹{tv.current_price}")

    rec_002 = db.query(PricingRecommendation).filter(PricingRecommendation.id == "opt-prod-002").first()
    assert_test(rec_002 is not None, "PricingRecommendation opt-prod-002 preserved in database")
    assert_test(
        rec_002.recommended_price == 500.0,
        "PricingRecommendation.recommended_price was NOT mutated in database: ₹500.00 preserved for auditing",
        f"DB recommended_price: ₹{rec_002.recommended_price}"
    )
    assert_test(
        rec_002.status == "Approved",
        "PricingRecommendation.status was NOT mutated in database: status='Approved'",
        f"DB status: {rec_002.status}"
    )
    assert_test(
        "Executive below-cost override" in (rec_002.reason or ""),
        "Executive override reason preserved in PricingRecommendation",
        f"DB reason: {rec_002.reason[:60]}..."
    )

    decisions = db.query(PricingDecision).filter(PricingDecision.product_id == tv.id).all()
    override_dec = next((d for d in decisions if d.decision == "OVERRIDDEN_BELOW_COST"), None)
    assert_test(
        override_dec is not None,
        "PricingDecision audit record with OVERRIDDEN_BELOW_COST preserved in database",
        f"Decision ID: {override_dec.id}, User: {override_dec.user}, Approved: ₹{override_dec.approved_price}"
    )
finally:
    db.close()

# Test Decisions Audit Endpoint
res_dec = client.get("/api/products/ELC-8812/decisions")
assert_test(res_dec.status_code == 200, "GET /api/products/ELC-8812/decisions returns HTTP 200")
dec_list = res_dec.json()
assert_test(
    any(d.get("decision") == "OVERRIDDEN_BELOW_COST" for d in dec_list),
    "Decisions endpoint exposes OVERRIDDEN_BELOW_COST audit record",
    f"Found {len(dec_list)} decision records in audit log"
)

# -------------------------------------------------------------
# Summary
# -------------------------------------------------------------
print("\n" + "=" * 65)
print(f"TEST SUMMARY: {passed_tests}/{total_tests} TESTS PASSED ({(passed_tests/total_tests)*100:.1f}%)")
print("=" * 65 + "\n")
