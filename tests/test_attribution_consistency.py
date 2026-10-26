"""
SmartPrice Consistency Fix #4 Verification Test Suite
=====================================================
Validates that pricing explanations and attribution calculations align
with the corrected gross-margin guardrails and accurately distinguish
historical executive overrides from ordinary guardrail-enforced recommendations.

Required coverage:
1. A ₹540 cost with a 25% gross-margin floor of ₹720.00.
2. Attribution for an ordinary valid recommendation (e.g. APP-3041).
3. Attribution for the historical ₹500 override on ELC-8812.
4. Consistency between the explained price and the sum of baseline plus contributions (Additivity).
5. Accurate labeling of the explanation method (deterministic rule attribution, not genuine TreeSHAP).
"""

import sys
import os
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app
from ml.explainability.base import ExplanationMethod
from ml.explainability.rule_attribution import PricingRuleAttributionExplainer
from ml.explainability.validator import ExplanationValidator
from backend.database import SessionLocal
from backend.app.models.product import Product

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

class MockProduct:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

print("\n" + "=" * 65)
print("SMARTPRICE EXPLANABILITY & ATTRIBUTION CONSISTENCY VERIFICATION")
print("=" * 65 + "\n")

explainer = PricingRuleAttributionExplainer()
validator = ExplanationValidator()

# -------------------------------------------------------------
# 1. Gross-Margin Floor of ₹720 for Cost ₹540 (25% Margin)
# -------------------------------------------------------------
print("--- 1. ₹540 Cost with 25% Gross-Margin Floor (₹720.00) ---")

tv_clamped = MockProduct(
    id="test-tv-clamp",
    sku="TEST-TV",
    name="Test OLED TV",
    current_price=740.00,
    cost_price=540.00,
    competitor_price=600.00,  # Aggressive competitor undercut
    elasticity=-2.5,          # High price sensitivity
    stock_quantity=60,        # Inventory surplus
    reorder_level=20,
    safety_stock=10,
    rating=4.0
)

# With 25% margin, floor is 540 / (1 - 0.25) = 720.00
decomp_25 = explainer.explain_product(tv_clamped, context={"min_margin_pct": 25.0})

assert_test(
    decomp_25["final_recommended_price"] == 720.00,
    "Target recommendation clamps at exactly ₹720.00 (25% margin floor on ₹540 cost)",
    f"final_recommended_price: ₹{decomp_25['final_recommended_price']}"
)

# Find Cost Floor Guardrail Enforcement point
guardrail_point = next((pt for pt in decomp_25["waterfall_points"] if "Cost Floor" in pt["name"] or "Guardrail" in pt["name"]), None)
assert_test(
    guardrail_point is not None,
    "Waterfall contains guardrail attribution point for clamped recommendation",
    f"Point name: {guardrail_point['name'] if guardrail_point else None}"
)

assert_test(
    "₹720.00" in guardrail_point["description"] and "25%" in guardrail_point["description"],
    "Guardrail description explicitly documents 25% margin and ₹720.00 floor",
    f"Description: {guardrail_point['description']}"
)

assert_test(
    "567" not in guardrail_point["description"] and "1.05" not in guardrail_point["description"],
    "Guardrail description does NOT use obsolete 5% markup calculation (₹567.00)",
    f"Clean description verified"
)

# Verify default 5% margin produces ₹568.42 floor when raw target drops below floor
tv_low = MockProduct(
    id="test-tv-low",
    sku="TEST-TV-LOW",
    name="Test OLED TV Low",
    current_price=600.00,
    cost_price=540.00,
    competitor_price=500.00,  # Aggressive competitor undercut
    elasticity=-2.5,          # High price sensitivity
    stock_quantity=60,        # Inventory surplus
    reorder_level=20,
    safety_stock=10,
    rating=4.0
)
decomp_default = explainer.explain_product(tv_low, context={"min_margin_pct": 5.0})
assert_test(
    decomp_default["final_recommended_price"] == 568.42,
    "Default 5% gross margin produces exact ₹568.42 floor on ₹540 cost",
    f"final_recommended_price: ₹{decomp_default['final_recommended_price']}"
)

# -------------------------------------------------------------
# 2. Attribution for an Ordinary Valid Recommendation (APP-3041)
# -------------------------------------------------------------
print("\n--- 2. Ordinary Valid Recommendation Attribution (APP-3041) ---")

res_app = client.get("/api/shap/APP-3041")
assert_test(res_app.status_code == 200, "GET /api/shap/APP-3041 returns HTTP 200")
data_app = res_app.json()

assert_test(
    data_app["base_value"] == 64.50,
    "APP-3041 baseline shelf price is ₹64.50",
    f"base_value: ₹{data_app['base_value']}"
)

assert_test(
    data_app["final_recommended_price"] == 69.66,
    "APP-3041 final recommended target is ₹69.66",
    f"final_recommended_price: ₹{data_app['final_recommended_price']}"
)

assert_test(
    len(data_app["waterfall_points"]) >= 5,
    "Waterfall includes all expected decision drivers (competitor, elasticity, inventory, rating)",
    f"Points count: {len(data_app['waterfall_points'])}"
)

# Verify market drivers are present
point_names = [pt["name"] for pt in data_app["waterfall_points"]]
assert_test(
    any("Competitor" in n for n in point_names),
    "Competitor price driver present in decomposition"
)
assert_test(
    any("Elasticity" in n for n in point_names),
    "Demand elasticity driver present in decomposition"
)
assert_test(
    any("Inventory" in n for n in point_names),
    "Inventory buffer driver present in decomposition"
)

# -------------------------------------------------------------
# 3. Attribution for Historical ₹500 Override on ELC-8812
# -------------------------------------------------------------
print("\n--- 3. Historical Below-Cost Override Attribution (ELC-8812) ---")

res_elc = client.get("/api/shap/ELC-8812")
assert_test(res_elc.status_code == 200, "GET /api/shap/ELC-8812 returns HTTP 200")
data_elc = res_elc.json()

assert_test(
    data_elc["base_value"] == 947.58,
    "ELC-8812 baseline shelf price is ₹947.58",
    f"base_value: ₹{data_elc['base_value']}"
)

assert_test(
    data_elc["final_recommended_price"] == 500.00,
    "ELC-8812 target price matches historical override ₹500.00",
    f"final_recommended_price: ₹{data_elc['final_recommended_price']}"
)

# Find override attribution point
override_pt = next((pt for pt in data_elc["waterfall_points"] if "Override" in pt["name"]), None)
assert_test(
    override_pt is not None,
    "ELC-8812 attribution includes explicit 'Executive Below-Cost Override Authorization' point",
    f"Point name: {override_pt['name'] if override_pt else None}"
)

assert_test(
    "Cost Floor Guardrail Enforcement" not in [pt["name"] for pt in data_elc["waterfall_points"]],
    "Below-cost override is NOT falsely described as 'Cost Floor Guardrail Enforcement'",
    "False guardrail claim successfully eliminated"
)

assert_test(
    "Marcus Vance" in override_pt["description"] or "Executive" in override_pt["description"],
    "Override description documents executive authorization audit trail",
    f"Description: {override_pt['description'][:80]}..."
)

assert_test(
    "Historical executive override" in data_elc["naturalLanguageExplanation"],
    "Natural language explanation distinguishes historical override from ordinary recommendations",
    f"Explanation excerpt: {data_elc['naturalLanguageExplanation'][:100]}..."
)

# -------------------------------------------------------------
# 4. Consistency & Mathematical Additivity
# -------------------------------------------------------------
print("\n--- 4. Mathematical Additivity (Reconciliation) ---")

# Validate APP-3041 additivity
val_app = validator.validate_additivity(data_app)
assert_test(
    val_app["is_additive"] is True,
    "APP-3041 satisfies exact additivity (Base + Deltas == Final)",
    f"Base: ₹{val_app['base_value']} + Deltas: ₹{val_app['sum_of_deltas']} == Final: ₹{val_app['computed_final']}"
)
assert_test(
    val_app["difference"] <= 0.01,
    "APP-3041 additivity difference within ₹0.01 tolerance",
    f"Delta diff: {val_app['difference']}"
)

# Validate ELC-8812 additivity
val_elc = validator.validate_additivity(data_elc)
assert_test(
    val_elc["is_additive"] is True,
    "ELC-8812 satisfies exact additivity despite massive override drop (-₹447.58)",
    f"Base: ₹{val_elc['base_value']} + Deltas: ₹{val_elc['sum_of_deltas']} == Final: ₹{val_elc['computed_final']}"
)
assert_test(
    val_elc["difference"] <= 0.01,
    "ELC-8812 additivity difference within ₹0.01 tolerance",
    f"Delta diff: {val_elc['difference']}"
)

# Validate clamped 25% margin additivity
val_25 = validator.validate_additivity(decomp_25)
assert_test(
    val_25["is_additive"] is True,
    "Clamped 25% margin recommendation satisfies exact additivity",
    f"Base: ₹{val_25['base_value']} + Deltas: ₹{val_25['sum_of_deltas']} == Final: ₹{val_25['computed_final']}"
)

# -------------------------------------------------------------
# 5. Accurate Labeling of Explanation Method
# -------------------------------------------------------------
print("\n--- 5. Accurate Labeling of Explanation Method ---")

assert_test(
    data_app["explanation_method"] == "deterministic_rule_attribution",
    "APP-3041 declares explanation_method: deterministic_rule_attribution",
    f"explanation_method: {data_app['explanation_method']}"
)

assert_test(
    data_app["is_genuine_shap"] is False,
    "APP-3041 honestly declares is_genuine_shap: false",
    f"is_genuine_shap: {data_app['is_genuine_shap']}"
)

assert_test(
    data_elc["explanation_method"] == "deterministic_rule_attribution",
    "ELC-8812 declares explanation_method: deterministic_rule_attribution",
    f"explanation_method: {data_elc['explanation_method']}"
)

assert_test(
    data_elc["is_genuine_shap"] is False,
    "ELC-8812 honestly declares is_genuine_shap: false",
    f"is_genuine_shap: {data_elc['is_genuine_shap']}"
)

assert_test(
    "Not a fitted TreeSHAP" in (data_app.get("method_description") or ""),
    "Method description clarifies absence of genuine TreeSHAP ensemble",
    f"Description: {data_app.get('method_description')}"
)

# -------------------------------------------------------------
# 6. Global Decision Drivers
# -------------------------------------------------------------
print("\n--- 6. Global Decision Drivers Verification ---")

res_global = client.get("/api/ai-insights")
assert_test(res_global.status_code == 200, "GET /api/ai-insights returns HTTP 200")
features_list = res_global.json()
guardrail_feat = next((f for f in features_list if "Cost Floor" in f["feature"] or "Guardrail" in f["feature"]), None)
assert_test(
    guardrail_feat is not None,
    "Global decision drivers include Cost Floor & Margin Guardrails"
)
assert_test(
    "markup" not in guardrail_feat["description"].lower() and "gross-margin" in guardrail_feat["description"].lower(),
    "Global guardrail feature description uses gross-margin phrasing (not cost markup)",
    f"Description: {guardrail_feat['description']}"
)

# -------------------------------------------------------------
# Summary
# -------------------------------------------------------------
print("\n" + "=" * 65)
print(f"TEST SUMMARY: {passed_tests}/{total_tests} TESTS PASSED ({(passed_tests/total_tests)*100:.1f}%)")
print("=" * 65 + "\n")
