"""
SmartPrice ML Pipeline - Explainability & Rule Attribution Verification Test Suite
"""
import sys
import os
from pathlib import Path

# Add project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from ml.explainability.base import (
    ExplanationMethod,
    CausalStatus,
    FeatureContribution,
    GlobalFeatureImportance
)
from ml.explainability.rule_attribution import PricingRuleAttributionExplainer
from ml.explainability.validator import ExplanationValidator
from ml.explainability.inference import ExplainabilityEngine
from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

class MockProduct:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

def run_explainability_tests():
    print("\n==================================================")
    print("SMARTPRICE ML EXPLAINABILITY PIPELINE VERIFICATION")
    print("==================================================\n")

    passed = 0
    total = 0

    def assert_check(cond, name, details=""):
        nonlocal passed, total
        total += 1
        if cond:
            print(f"[PASS] [{total:02d}]: {name}")
            if details:
                print(f"       -> {details}")
            passed += 1
        else:
            print(f"[FAIL] [{total:02d}]: {name}")
            if details:
                print(f"       -> {details}")

    # 1. Base FeatureContribution Data Contract
    fc = FeatureContribution(
        name="Competitor Price Gap (₹215.00)",
        value=14.80,
        formatted_value="+₹14.80",
        type="increase",
        raw_feature="competitor_price",
        feature_value="₹215.00",
        description="Competitor creates price leverage"
    )
    fe_dict = fc.to_frontend_feature()
    assert_check(fe_dict["type"] == "positive" and fe_dict["delta"] == 14.80, "FeatureContribution maps correctly to frontend waterfall format", f"Type: {fe_dict['type']}, Delta: {fe_dict['delta']}")

    # 2. Rule Attribution Explainer Decomposition
    p = MockProduct(
        id="test-prod-01",
        sku="TEST-SKU",
        name="Wireless Audio Pro",
        current_price=200.00,
        cost_price=90.00,
        competitor_price=220.00,
        elasticity=-1.10,
        stock_quantity=12,
        reorder_level=30,
        safety_stock=15,
        rating=4.7
    )

    explainer = PricingRuleAttributionExplainer()
    decomp = explainer.explain_product(p)

    assert_check(decomp["is_genuine_shap"] is False, "Explainer honestly declares is_genuine_shap = False")
    assert_check(decomp["explanation_method"] == ExplanationMethod.DETERMINISTIC_RULE_ATTRIBUTION.value, "Explainer identifies method as deterministic_rule_attribution")
    assert_check(decomp["r2_score"] is None, "Explainer does not fabricate artificial R2 accuracy metrics")
    assert_check(decomp["model_version"] == "Deterministic Pricing Rule Attribution v1.0", "Explainer version is transparently labeled")

    # 3. Additivity Check: Base + Sum(Deltas) == Final
    val = ExplanationValidator()
    add_res = val.validate_additivity(decomp)
    assert_check(add_res["is_additive"] is True, "Rule attribution satisfies exact additivity (Base + Deltas == Final)", f"Base: ₹{add_res['base_value']} + Deltas: ₹{add_res['sum_of_deltas']} == Final: ₹{add_res['computed_final']}")

    # 4. Currency Verification (Indian Rupee ₹)
    has_rupee = all("₹" in pt["formatted_value"] for pt in decomp["waterfall_points"])
    assert_check(has_rupee, "All decomposition waterfall points use Indian Rupee (₹) currency symbol")

    # 5. Causal Integrity Guard
    causal_res = val.validate_causal_integrity(decomp)
    assert_check(causal_res["is_valid"] is True, "Explanations preserve distinction between correlation, rules, and causal claims")

    # 6. Authenticity Guard: Reject Fabricated TreeSHAP Claims
    auth_check_dishonest = val.verify_shap_authenticity(is_genuine_shap=True, model_object=None)
    assert_check(auth_check_dishonest["is_honest"] is False, "Validator rejects TreeSHAP claims when tree model object is missing")

    auth_check_honest = val.verify_shap_authenticity(is_genuine_shap=False)
    assert_check(auth_check_honest["is_honest"] is True, "Validator approves rule-based attribution declaration")

    # 7. Global Feature Importance Aggregation
    catalog = [
        p,
        MockProduct(
            id="test-prod-02",
            sku="TEST-SKU-2",
            name="Smart Screen 4K",
            current_price=800.00,
            cost_price=400.00,
            competitor_price=750.00,
            elasticity=-2.10,
            stock_quantity=60,
            reorder_level=20,
            safety_stock=10,
            rating=4.2
        )
    ]
    global_imp = explainer.compute_global_importance(catalog)
    assert_check(len(global_imp) >= 4, "Global feature importance evaluates multiple catalog decision drivers", f"Drivers: {len(global_imp)}")

    imp_sum = sum(g["importance"] for g in global_imp)
    assert_check(abs(imp_sum - 1.0) < 0.05, "Global feature weights are normalized to sum to 1.0 (100%)", f"Sum: {imp_sum:.4f}")

    # 8. High-Level ExplainabilityEngine Facade
    engine = ExplainabilityEngine()
    assert_check(engine.is_tree_shap_available() is False, "Engine accurately reports TreeSHAP is not available without a real tree model")

    eng_decomp = engine.explain_product_pricing(p)
    assert_check("additivity_check" in eng_decomp and eng_decomp["additivity_check"]["is_additive"] is True, "Engine automatically validates additivity on dispatch")

    # Safe handling of null/missing product
    empty_decomp = engine.explain_product_pricing(None)
    assert_check(empty_decomp["base_value"] == 0.0, "Engine safely handles null product inputs without unhandled exceptions")

    # 9. Live Backend API Integration
    # GET /api/ai-insights
    r_global = client.get("/api/ai-insights")
    assert_check(r_global.status_code == 200 and len(r_global.json()) >= 4, "GET /api/ai-insights returns catalog decision drivers", f"Features: {len(r_global.json())}")

    # GET /api/shap/ELC-4921
    r_prod = client.get("/api/shap/ELC-4921")
    data = r_prod.json()
    assert_check(r_prod.status_code == 200, "GET /api/shap/ELC-4921 returns 200 OK")
    assert_check(data.get("is_genuine_shap") is False, "API response clearly declares is_genuine_shap = False")
    assert_check("waterfall_points" in data and len(data["waterfall_points"]) >= 5, "API response returns complete waterfall points array", f"Points: {len(data.get('waterfall_points', []))}")
    assert_check("features" in data and len(data["features"]) >= 4, "API response provides normalized frontend features array")
    assert_check("naturalLanguageExplanation" in data and len(data["naturalLanguageExplanation"]) > 20, "API response provides readable executive summary")

    # Verify Indian Rupee ₹ symbol in API output
    has_inr_api = any("₹" in pt.get("formatted_value", "") for pt in data.get("waterfall_points", []))
    assert_check(has_inr_api, "API response formatted values use Indian Rupee (₹) symbol")

    print("\n==================================================")
    print(f"EXPLAINABILITY TEST SUMMARY: {passed}/{total} TESTS PASSED ({(passed/total)*100:.1f}%)")
    print("==================================================\n")
    return passed == total

if __name__ == "__main__":
    success = run_explainability_tests()
    sys.exit(0 if success else 1)
