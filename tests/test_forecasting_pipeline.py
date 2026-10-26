"""
SmartPrice ML Pipeline - Demand Forecasting Unit & Leakage Verification Test
"""
import sys
import os
from pathlib import Path

# Add project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.preprocessing.data_loader import SalesDataLoader
from ml.forecasting.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    weighted_absolute_percentage_error,
    forecast_bias,
    compute_all_metrics
)
from ml.forecasting.baseline import EnsembleBaselineForecaster
from ml.forecasting.inference import ForecastInferenceEngine

def run_ml_forecasting_tests():
    print("\n==================================================")
    print("SMARTPRICE ML FORECASTING PIPELINE VERIFICATION")
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

    # 1. Metrics Zero and Standard Cases
    y_true = [10.0, 20.0, 30.0]
    y_pred = [12.0, 18.0, 33.0]
    mae = mean_absolute_error(y_true, y_pred)
    assert_check(abs(mae - 2.333) < 0.01, "MAE metric computes correctly", f"MAE: {mae:.3f}")

    wape = weighted_absolute_percentage_error(y_true, y_pred)
    # sum(|err|) = 2 + 2 + 3 = 7, sum(y) = 60 => 7/60 * 100 = 11.667%
    assert_check(abs(wape - 11.667) < 0.01, "WAPE metric computes correctly", f"WAPE: {wape:.2f}%")

    bias = forecast_bias(y_true, y_pred)
    # sum(pred - true) = 3 / 60 = 5.0%
    assert_check(abs(bias - 5.0) < 0.01, "Forecast bias metric computes correctly", f"Bias: {bias:.2f}%")

    # 2. Data Loader & Validation
    loader = SalesDataLoader()
    raw_sales = loader.load_raw_sales()
    assert_check(len(raw_sales) >= 160, "SalesDataLoader extracts records from SQLite", f"Count: {len(raw_sales)}")

    report = loader.validate_dataset(raw_sales)
    assert_check(report["valid"] is True, "Dataset validation completes successfully")
    assert_check(report["is_sufficient_for_ml"] is False, "Validation correctly identifies seed data as insufficient for deep ML", f"Distinct dates: {report['distinct_dates']}")

    # 3. Chronological Split (Data Leakage Verification)
    daily_series = loader.aggregate_daily_series(raw_sales)
    train_s, val_s, cutoff = loader.split_chronological(daily_series, val_ratio=0.25)
    train_max_date = max(s["date"] for s in train_s)
    val_min_date = min(s["date"] for s in val_s)
    assert_check(train_max_date < val_min_date, "Strict chronological split prevents data leakage", f"Train Max: {train_max_date} < Val Min: {val_min_date}")

    # 4. Forecaster Fitting & In-Sample
    forecaster = EnsembleBaselineForecaster()
    forecaster.fit(train_s)
    assert_check(forecaster.is_fitted is True, "EnsembleBaselineForecaster fits on training series", f"Level: {forecaster.last_level:.2f}")

    # 5. Out-of-Sample Evaluation
    val_metrics = forecaster.evaluate(val_s)
    assert_check("mae" in val_metrics and "wape_pct" in val_metrics, "Forecaster evaluation produces retail metrics", f"Val WAPE: {val_metrics['wape_pct']}%")

    # 6. Predict Horizon & Bound Validity
    pred_7d = forecaster.predict(horizon_days=7)
    assert_check(len(pred_7d) == 7, "Predict generates 7-day point trajectory", f"Points: {len(pred_7d)}")
    bounds_valid = all(p["lower_bound"] <= p["predicted_demand"] <= p["upper_bound"] for p in pred_7d)
    assert_check(bounds_valid, "Forecast prediction intervals maintain lower_bound <= point <= upper_bound")

    # 7. Inference Engine & Backend Compatibility
    inf_engine = ForecastInferenceEngine()
    assert_check(inf_engine.is_available() is True, "Inference engine detects trained model artifact")
    inf_res = inf_engine.generate_forecast("7d", 199.0, 1.0)
    assert_check(len(inf_res["points"]) == 7, "Inference engine generates schema-compliant 7d points")

    print(f"\n==================================================")
    print(f"ML TEST SUMMARY: {passed}/{total} TESTS PASSED ({(passed/total)*100:.1f}%)")
    print("==================================================\n")

if __name__ == "__main__":
    run_ml_forecasting_tests()
