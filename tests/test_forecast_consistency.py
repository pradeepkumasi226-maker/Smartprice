"""
SmartPrice Consistency Fix #5 Verification Test Suite
=====================================================
Validates mathematical consistency between demand forecast headline totals,
timeline chart points, and product-level forecast summaries across all
forecast horizons (7d, 30d, 90d), product scopes, and retail categories.

Required coverage:
1. Exact reconciliation for 7d catalog forecast: Headline == Sum(points) == Sum(product rows) == 2,755 units.
2. Exact reconciliation for 30d catalog forecast: Headline == Sum(points) == Sum(product rows) == 11,571 units.
3. Exact reconciliation for 90d catalog forecast: Headline == Sum(points) == Sum(product rows) == 34,437 units.
4. Exact reconciliation for SKU filter (ELC-8812): Headline == Sum(points) == 140 units.
5. Exact reconciliation for Category filter (Electronics): Headline == Sum(points) == Sum(product rows) == 460 units.
6. Unified horizon definition (7d=daily, 30d=weekly, 90d=monthly) and query param aliases (time_range & horizon).
7. Elimination of fictitious model claims: truthful reporting of forecaster engine.
8. Validation metrics integrity (WAPE 48.1%, MAE 31.26 units).
"""

import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

passed = 0
failed = 0

def assert_test(cond, title, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"[PASS] [{passed:02d}]: {title}")
        if detail:
            print(f"       -> {detail}")
    else:
        failed += 1
        print(f"[FAIL] [XX]: {title}")
        if detail:
            print(f"       -> ERROR: {detail}")

def run_tests():
    print("=" * 65)
    print("SMARTPRICE DEMAND FORECAST CONSISTENCY VERIFICATION (FIX #5)")
    print("=" * 65)

    # -------------------------------------------------------------
    # 1. 7-Day Horizon Catalog-Level Reconciliation
    # -------------------------------------------------------------
    print("\n--- 1. 7-Day Horizon Catalog-Level Reconciliation ---")
    res_7d = client.get("/api/forecast?time_range=7d")
    assert_test(res_7d.status_code == 200, "GET /api/forecast?time_range=7d returns HTTP 200")
    fc_7d = res_7d.json()

    res_p7 = client.get("/api/forecast/products?time_range=7d")
    assert_test(res_p7.status_code == 200, "GET /api/forecast/products?time_range=7d returns HTTP 200")
    products_7d = res_p7.json()

    sum_p7 = sum(p["predicted_demand_units"] for p in products_7d)
    sum_pts7 = sum(pt["predicted_demand"] for pt in fc_7d.get("points", []))
    head_7d = fc_7d.get("total_predicted_demand")

    assert_test(
        sum_p7 == 2755,
        "Sum of product-level 7-day forecast rows equals 2,755 units",
        f"Sum across 10 products: {sum_p7}"
    )
    assert_test(
        head_7d == 2755,
        "Headline total_predicted_demand equals 2,755 units (no 358 unscaled mismatch)",
        f"Headline total: {head_7d}"
    )
    assert_test(
        sum_pts7 == 2755,
        "Sum of 7 daily forecast timeline points equals 2,755 units",
        f"Timeline points sum: {sum_pts7}"
    )
    assert_test(
        head_7d == sum_p7 == sum_pts7,
        "Perfect 3-way mathematical additivity for 7-day catalog forecast",
        f"Headline ({head_7d}) == Products ({sum_p7}) == Timeline ({sum_pts7})"
    )
    assert_test(
        len(fc_7d.get("points", [])) == 7,
        "7-day horizon produces exactly 7 daily interval points",
        f"Points count: {len(fc_7d.get('points', []))}"
    )

    # -------------------------------------------------------------
    # 2. 30-Day Horizon Catalog-Level Reconciliation
    # -------------------------------------------------------------
    print("\n--- 2. 30-Day Horizon Catalog-Level Reconciliation ---")
    res_30d = client.get("/api/forecast?time_range=30d")
    assert_test(res_30d.status_code == 200, "GET /api/forecast?time_range=30d returns HTTP 200")
    fc_30d = res_30d.json()

    res_p30 = client.get("/api/forecast/products?time_range=30d")
    assert_test(res_p30.status_code == 200, "GET /api/forecast/products?time_range=30d returns HTTP 200")
    products_30d = res_p30.json()

    sum_p30 = sum(p["predicted_demand_units"] for p in products_30d)
    sum_pts30 = sum(pt["predicted_demand"] for pt in fc_30d.get("points", []))
    head_30d = fc_30d.get("total_predicted_demand")

    assert_test(
        sum_p30 == 11571,
        "Sum of product-level 30-day forecast rows equals 11,571 units",
        f"Sum across products: {sum_p30}"
    )
    assert_test(
        head_30d == 11571,
        "Headline total_predicted_demand for 30d equals 11,571 units",
        f"Headline total: {head_30d}"
    )
    assert_test(
        sum_pts30 == 11571,
        "Sum of 4 weekly forecast timeline points equals 11,571 units",
        f"Timeline points sum: {sum_pts30}"
    )
    assert_test(
        head_30d == sum_p30 == sum_pts30,
        "Perfect 3-way mathematical additivity for 30-day catalog forecast",
        f"Headline ({head_30d}) == Products ({sum_p30}) == Timeline ({sum_pts30})"
    )
    assert_test(
        len(fc_30d.get("points", [])) == 4,
        "30-day horizon produces exactly 4 weekly interval points",
        f"Points count: {len(fc_30d.get('points', []))}"
    )

    # -------------------------------------------------------------
    # 3. 90-Day Horizon Catalog-Level Reconciliation
    # -------------------------------------------------------------
    print("\n--- 3. 90-Day Horizon Catalog-Level Reconciliation ---")
    res_90d = client.get("/api/forecast?time_range=90d")
    assert_test(res_90d.status_code == 200, "GET /api/forecast?time_range=90d returns HTTP 200")
    fc_90d = res_90d.json()

    res_p90 = client.get("/api/forecast/products?time_range=90d")
    assert_test(res_p90.status_code == 200, "GET /api/forecast/products?time_range=90d returns HTTP 200")
    products_90d = res_p90.json()

    sum_p90 = sum(p["predicted_demand_units"] for p in products_90d)
    sum_pts90 = sum(pt["predicted_demand"] for pt in fc_90d.get("points", []))
    head_90d = fc_90d.get("total_predicted_demand")

    assert_test(
        sum_p90 == 34437,
        "Sum of product-level 90-day forecast rows equals 34,437 units",
        f"Sum across products: {sum_p90}"
    )
    assert_test(
        head_90d == 34437,
        "Headline total_predicted_demand for 90d equals 34,437 units",
        f"Headline total: {head_90d}"
    )
    assert_test(
        sum_pts90 == 34437,
        "Sum of 3 monthly forecast timeline points equals 34,437 units",
        f"Timeline points sum: {sum_pts90}"
    )
    assert_test(
        head_90d == sum_p90 == sum_pts90,
        "Perfect 3-way mathematical additivity for 90-day catalog forecast",
        f"Headline ({head_90d}) == Products ({sum_p90}) == Timeline ({sum_pts90})"
    )
    assert_test(
        len(fc_90d.get("points", [])) == 3,
        "90-day horizon produces exactly 3 monthly interval points",
        f"Points count: {len(fc_90d.get('points', []))}"
    )

    # -------------------------------------------------------------
    # 4. Single Product SKU Filtering (ELC-8812)
    # -------------------------------------------------------------
    print("\n--- 4. Single SKU Filtering (ELC-8812) ---")
    res_sku = client.get("/api/forecast?time_range=7d&sku=ELC-8812")
    assert_test(res_sku.status_code == 200, "GET /api/forecast?sku=ELC-8812 returns HTTP 200")
    fc_sku = res_sku.json()

    sku_head = fc_sku.get("total_predicted_demand")
    sku_pts = sum(pt["predicted_demand"] for pt in fc_sku.get("points", []))

    assert_test(
        sku_head == 140,
        "ELC-8812 headline total matches product baseline (140 units, not 36)",
        f"Headline: {sku_head}"
    )
    assert_test(
        sku_pts == 140,
        "ELC-8812 timeline points sum matches product baseline (140 units)",
        f"Points sum: {sku_pts}"
    )
    assert_test(
        fc_sku.get("sku") == "ELC-8812",
        "Forecast response identifies SKU correctly",
        f"SKU: {fc_sku.get('sku')}"
    )

    # -------------------------------------------------------------
    # 5. Category Filtering (Electronics)
    # -------------------------------------------------------------
    print("\n--- 5. Category Filtering (Electronics) ---")
    res_cat = client.get("/api/forecast?time_range=7d&category=Electronics")
    assert_test(res_cat.status_code == 200, "GET /api/forecast?category=Electronics returns HTTP 200")
    fc_cat = res_cat.json()

    res_pcat = client.get("/api/forecast/products?time_range=7d&category=Electronics")
    assert_test(res_pcat.status_code == 200, "GET /api/forecast/products?category=Electronics returns HTTP 200")
    products_cat = res_pcat.json()

    cat_p = sum(p["predicted_demand_units"] for p in products_cat)
    cat_pts = sum(pt["predicted_demand"] for pt in fc_cat.get("points", []))
    cat_head = fc_cat.get("total_predicted_demand")

    assert_test(
        len(products_cat) == 2,
        "Category Electronics contains exactly 2 SKUs (ELC-4921 & ELC-8812)",
        f"SKUs: {[p['sku'] for p in products_cat]}"
    )
    assert_test(
        cat_p == 460,
        "Electronics product rows sum to 460 units (320 + 140)",
        f"Sum: {cat_p}"
    )
    assert_test(
        cat_head == 460,
        "Electronics headline total equals 460 units",
        f"Headline: {cat_head}"
    )
    assert_test(
        cat_pts == 460,
        "Electronics timeline points sum to 460 units",
        f"Points sum: {cat_pts}"
    )

    # -------------------------------------------------------------
    # 6. Horizon Parameter Aliases & Fallback Resilience
    # -------------------------------------------------------------
    print("\n--- 6. Horizon Aliases & Fallbacks ---")
    res_alias = client.get("/api/forecast?horizon=30d")
    assert_test(
        res_alias.status_code == 200 and res_alias.json().get("total_predicted_demand") == 11571,
        "Query param alias '?horizon=30d' produces identical 11,571 unit forecast"
    )

    res_prod_alias = client.get("/api/forecast/products?horizon=90d")
    assert_test(
        res_prod_alias.status_code == 200 and sum(p["predicted_demand_units"] for p in res_prod_alias.json()) == 34437,
        "Products query param alias '?horizon=90d' produces identical 34,437 unit total"
    )

    res_missing = client.get("/api/forecast?sku=NON-EXISTENT-SKU")
    assert_test(
        res_missing.status_code == 200 and len(res_missing.json().get("points", [])) == 7,
        "Non-existent SKU falls back gracefully without 500 error"
    )

    # -------------------------------------------------------------
    # 7. Model Transparency & Validation Metrics
    # -------------------------------------------------------------
    print("\n--- 7. Model Transparency & Validation Metrics ---")
    model_name = fc_7d.get("model_name", "")
    assert_test(
        "NeuralProphet" not in model_name and "XGBoost" not in model_name,
        "Model name honestly avoids fictitious 'NeuralProphet + XGBoost Ensemble v2.4'",
        f"Model: {model_name}"
    )
    assert_test(
        "Baseline" in model_name or "Empirical" in model_name,
        "Model name transparently declares baseline methodology",
        f"Model: {model_name}"
    )
    accuracy_metric = fc_7d.get("accuracy_metric", "")
    assert_test(
        "48.1%" in accuracy_metric and "31.26" in accuracy_metric,
        "Accuracy metric declares backtested validation WAPE (48.1%) and MAE (31.26 units)",
        f"Accuracy Metric: {accuracy_metric}"
    )
    assert_test(
        fc_7d.get("projected_change_pct") is not None,
        "Forecast payload includes projected_change_pct",
        f"Projected Change: +{fc_7d.get('projected_change_pct')}%"
    )

    print("\n" + "=" * 65)
    print(f"TEST SUMMARY: {passed}/{passed + failed} TESTS PASSED ({(passed/(passed+failed))*100:.1f}%)")
    print("=" * 65)
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
