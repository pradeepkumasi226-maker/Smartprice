"""
SmartPrice ML Pipeline - Price Elasticity Unit & Econometric Diagnostics Verification
"""
import sys
import os
import math
from pathlib import Path

# Add project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from ml.config.elasticity_config import ElasticityConfig, ELASTICITY_ARTIFACTS_DIR
from ml.optimization.regression import LogLogDemandRegression
from ml.optimization.validator import ElasticityValidator
from ml.optimization.estimator import ElasticityEstimator
from ml.optimization.inference import ElasticityInferenceBridge
from backend.database import SessionLocal
from backend.app.models.product import Product
from backend.app.services.pricing_service import PricingService

def run_elasticity_tests():
    print("\n==================================================")
    print("SMARTPRICE PRICE ELASTICITY PIPELINE VERIFICATION")
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

    # 1. Log-Log Regression: Accurate Coefficient Recovery
    # True relationship: ln(Q) = 5.0 - 1.5 * ln(P)
    sample_prices = [10.0, 15.0, 20.0, 25.0, 30.0, 40.0, 50.0]
    sample_demands = [round(math.exp(5.0 - 1.5 * math.log(p)), 2) for p in sample_prices]
    reg = LogLogDemandRegression()
    reg.fit(sample_prices, sample_demands)

    assert_check(reg.is_fitted is True, "LogLogDemandRegression fits valid series successfully")
    assert_check(abs(reg.elasticity - (-1.5)) < 0.05, "Log-log regression accurately recovers true elasticity parameter (-1.5)", f"Recovered: {reg.elasticity:.3f}")
    assert_check(reg.r_squared > 0.99, "Log-log regression R-squared indicates strong goodness of fit", f"R2: {reg.r_squared:.4f}")
    assert_check(reg.p_value < 0.01, "Elasticity estimate p-value indicates statistical significance", f"p-val: {reg.p_value:.6f}")

    # 2. Input Validation & Edge Cases
    # Non-positive price handling (filtered out)
    reg_zero_p = LogLogDemandRegression()
    reg_zero_p.fit([0.0, -5.0, 20.0], [50, 40, 30])
    assert_check(reg_zero_p.is_fitted is False, "Regression safely handles non-positive prices by dropping and checking sample size", f"Diagnostic: {reg_zero_p.diagnostics.get('error')}")

    # Non-positive quantity handling (filtered out)
    reg_zero_q = LogLogDemandRegression()
    reg_zero_q.fit([10.0, 20.0, 30.0], [0, -10, 30])
    assert_check(reg_zero_q.is_fitted is False, "Regression safely handles zero/negative demand by dropping and checking sample size", f"Diagnostic: {reg_zero_q.diagnostics.get('error')}")

    # Constant price series (Var(ln P) == 0)
    reg_const = LogLogDemandRegression()
    reg_const.fit([20.0, 20.0, 20.0, 20.0], [40, 42, 38, 41])
    assert_check(reg_const.is_fitted is False and reg_const.diagnostics.get("error") == "zero_price_variance", "Regression detects zero price variance and warns of mathematical unidentifiability", f"Message: {reg_const.diagnostics.get('message')}")

    # 3. Econometric Diagnostics & Reliability Criteria
    val = ElasticityValidator()
    # High p-value check
    weak_reg = {"elasticity": -1.2, "p_value": 0.45, "r_squared": 0.15, "std_error": 1.2, "sample_size": 10}
    weak_diag = val.assess_reliability(weak_reg, sku="TEST-01", catalog_fallback=-1.25)
    assert_check(weak_diag["is_reliable"] is False and "INSIGNIFICANT" in weak_diag["reliability_status"], "Validator correctly rejects statistically insignificant estimate", f"Status: {weak_diag['reliability_status']}")

    # Positive elasticity (Giffen/Veblen goods anomaly in standard retail)
    pos_reg = {"elasticity": 0.8, "p_value": 0.01, "r_squared": 0.85, "std_error": 0.1, "sample_size": 15}
    pos_diag = val.assess_reliability(pos_reg, sku="TEST-02", catalog_fallback=-1.25)
    assert_check(pos_diag["is_reliable"] is False and "POSITIVE" in pos_diag["reliability_status"], "Validator flags positive elasticity as economically atypical", f"Status: {pos_diag['reliability_status']}")

    # 4. Catalog Data Diagnostics on SQLite Database
    cfg = ElasticityConfig()
    estimator = ElasticityEstimator(config=cfg)
    cat_eval = estimator.fit_catalog()
    assert_check(len(cat_eval) == 10, "Estimator loads all 10 catalog SKUs from SQLite", f"Evaluated: {len(cat_eval)}")

    # All seeded products have constant shelf price
    unreliable_count = sum(1 for res in cat_eval.values() if res["reliability_status"] == "UNRELIABLE_CONSTANT_PRICE")
    assert_check(unreliable_count == 10, "Estimator honestly identifies 10/10 seeded SKUs as having constant price history", f"Unreliable count: {unreliable_count}/10")

    # 5. Versioned Artifact Consistency
    bridge = ElasticityInferenceBridge()
    assert_check(bridge.is_available() is True, "Elasticity model artifact (model.json) is available on disk")
    model_data = bridge.get_model_data()
    assert_check("sku_estimates" in model_data and "model_version" in model_data, "Model artifact contains required schema keys")

    # 6. Safe Fallback Routing in Inference Bridge
    sku_el = bridge.get_sku_elasticity("ELC-4921", catalog_fallback=-1.25)
    assert_check(sku_el["is_reliable"] is False, "Bridge marks constant-price catalog SKU as non-reliable")
    assert_check(sku_el["source"] == "fallback_catalog", "Bridge safely routes to catalog fallback for unidentifiable series", f"Source: {sku_el['source']}")
    assert_check(sku_el["elasticity"] == -1.25, "Bridge delivers catalog elasticity value (-1.25)", f"Elasticity: {sku_el['elasticity']}")

    # 7. Backend Dynamic Pricing Engine Integration & Transparency
    db = SessionLocal()
    try:
        p_headphone = db.query(Product).filter(Product.sku == "ELC-4921").first()
        rec = PricingService.calculate_product_recommendation(p_headphone)

        assert_check("elasticity_source" in rec, "Pricing recommendation includes 'elasticity_source' field", f"Source: {rec.get('elasticity_source')}")
        assert_check("elasticity_reliable" in rec, "Pricing recommendation includes 'elasticity_reliable' field", f"Reliable: {rec.get('elasticity_reliable')}")
        assert_check("elasticity_status" in rec, "Pricing recommendation includes 'elasticity_status' field", f"Status: {rec.get('elasticity_status')}")
        assert_check(rec["elasticity_source"] == "fallback_catalog", "Pricing recommendation shows 'fallback_catalog' for transparency")
        assert_check(rec["recommended_price"] >= rec["cost_price"], "Recommended price strictly honors cost floor guardrail", f"Rec: ₹{rec['recommended_price']} >= Cost: ₹{rec['cost_price']}")

        # 8. Elasticity Curve Endpoint Metadata
        curve = PricingService.get_elasticity_curve(db, "ELC-4921")
        assert_check("elasticity_source" in curve and "elasticity_reliable" in curve, "Elasticity curve includes ML transparency metadata", f"Source: {curve.get('elasticity_source')}")
        assert_check(len(curve["points"]) == 15, "Elasticity curve computes 15 simulation price intervals")
    finally:
        db.close()

    print("\n==================================================")
    print(f"ELASTICITY TEST SUMMARY: {passed}/{total} TESTS PASSED ({(passed/total)*100:.1f}%)")
    print("==================================================\n")
    return passed == total

if __name__ == "__main__":
    success = run_elasticity_tests()
    sys.exit(0 if success else 1)
