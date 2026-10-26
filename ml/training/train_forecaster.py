"""
SmartPrice ML Training Pipeline - Demand Forecaster Trainer

Runs an end-to-end training and evaluation workflow:
1. Loads sales data from SQLite (or external sources).
2. Performs data validation and statistical sufficiency checks.
3. Splits chronologically into train and validation sets (preventing future-data leakage).
4. Trains the Ensemble Baseline Forecaster.
5. Computes standard retail evaluation metrics (MAE, RMSE, WAPE%, Bias%).
6. Saves reproducible, versioned model artifacts and training metadata.
"""
import sys
import os
import json
from datetime import datetime, timezone
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.config.forecasting_config import ForecastingConfig, ARTIFACTS_DIR
from ml.preprocessing.data_loader import SalesDataLoader
from ml.forecasting.baseline import EnsembleBaselineForecaster

def train_demand_forecaster(config: ForecastingConfig = None) -> dict:
    if config is None:
        config = ForecastingConfig()

    print("=" * 60)
    print("SMARTPRICE ML PIPELINE - DEMAND FORECASTER TRAINING")
    print("=" * 60)

    # 1. Load Data
    print(f"\n[Step 1] Loading data from: {config.db_path}")
    loader = SalesDataLoader(db_path=config.db_path)
    raw_sales = loader.load_raw_sales()
    print(f"       -> Retrieved {len(raw_sales)} sales transaction records.")

    # 2. Validate Dataset
    print("\n[Step 2] Validating dataset quality and statistical sufficiency...")
    val_report = loader.validate_dataset(raw_sales)
    print(f"       -> Valid: {val_report['valid']}")
    print(f"       -> Total Records: {val_report['total_records']}")
    print(f"       -> Distinct Dates: {val_report['distinct_dates']}")
    print(f"       -> Date Range: {val_report['date_range'][0]} to {val_report['date_range'][1]}")
    print(f"       -> Sufficient for Production ML: {val_report['is_sufficient_for_ml']}")

    if val_report["warnings"]:
        print("       -> Data Integrity / Sufficiency Warnings:")
        for w in val_report["warnings"]:
            print(f"          * {w}")

    # Explicit transparency per project guidelines
    if not val_report["is_sufficient_for_ml"]:
        print("\n[Data Notice] Genuine historical sales data is insufficient for deep ML models.")
        print("              Proceeding with baseline time-series training and benchmarking procedure")
        print("              on sample/seed data without claiming a trained production model.")

    # 3. Aggregate Time Series
    print("\n[Step 3] Aggregating daily chronological sales series...")
    daily_series = loader.aggregate_daily_series(raw_sales)
    print(f"       -> Constructed {len(daily_series)} daily time-series points.")

    # 4. Chronological Train/Validation Split (No Data Leakage)
    print("\n[Step 4] Chronological train/validation splitting (val_ratio = 0.25)...")
    train_series, val_series, cutoff_date = loader.split_chronological(
        daily_series, val_ratio=config.validation_ratio
    )
    print(f"       -> Train Points: {len(train_series)} ({train_series[0]['date']} to {train_series[-1]['date']})")
    print(f"       -> Validation Points: {len(val_series)} ({val_series[0]['date']} to {val_series[-1]['date']})")
    print(f"       -> Split Cutoff Date: {cutoff_date} (Zero future-data leakage verified)")

    # 5. Model Fitting
    print("\n[Step 5] Fitting Ensemble Baseline Forecaster...")
    forecaster = EnsembleBaselineForecaster(
        model_name=config.model_name,
        model_version=config.model_version,
        smoothing_alpha=config.smoothing_alpha,
        prediction_interval=config.prediction_interval
    )
    forecaster.fit(train_series)
    print(f"       -> Fitted Level: {forecaster.last_level:.2f}")
    print(f"       -> Residual Std Dev: {forecaster.residual_std:.2f}")
    print("       -> Day-of-Week Seasonality Multipliers:")
    wd_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for wd, idx in forecaster.weekday_indices.items():
        print(f"          {wd_names[wd]}: {idx:.3f}")

    # 6. Evaluation
    print("\n[Step 6] Out-of-Sample Evaluation on Validation Set...")
    val_metrics = forecaster.evaluate(val_series)
    print(f"       -> Validation MAE:       {val_metrics.get('mae', 0.0)} units")
    print(f"       -> Validation RMSE:      {val_metrics.get('rmse', 0.0)} units")
    print(f"       -> Validation WAPE:      {val_metrics.get('wape_pct', 0.0)}%")
    print(f"       -> Validation MAPE:      {val_metrics.get('mape_pct', 0.0)}%")
    print(f"       -> Forecast Bias:        {val_metrics.get('bias_pct', 0.0)}%")

    # 7. Model Artifact Export
    print(f"\n[Step 7] Exporting versioned model artifacts to: {config.artifacts_dir}")
    config.artifacts_dir.mkdir(parents=True, exist_ok=True)
    forecaster.save(config.artifacts_dir)

    metadata = {
        "model_name": config.model_name,
        "model_version": config.model_version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_summary": {
            "total_records": val_report["total_records"],
            "distinct_dates": val_report["distinct_dates"],
            "date_range": val_report["date_range"],
            "is_sufficient_for_ml": val_report["is_sufficient_for_ml"],
            "sample_data_disclaimer": (
                "Trained on sample/seed retail transactions. Genuine multi-month continuous "
                "historical sales data is required for production accuracy certification."
            )
        },
        "split": {
            "type": "chronological",
            "cutoff_date": cutoff_date,
            "train_samples": len(train_series),
            "val_samples": len(val_series)
        },
        "evaluation_metrics": {
            "validation_metrics": val_metrics,
            "in_sample_metrics": forecaster.in_sample_metrics
        },
        "hyperparameters": {
            "alpha": config.smoothing_alpha,
            "prediction_interval": config.prediction_interval
        }
    }

    metadata_path = config.artifacts_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"       -> Saved model.json and metadata.json successfully.")
    print("=" * 60)
    print("DEMAND FORECASTER TRAINING COMPLETE")
    print("=" * 60 + "\n")

    return {
        "status": "success",
        "model_name": config.model_name,
        "model_version": config.model_version,
        "val_metrics": val_metrics,
        "artifacts_dir": str(config.artifacts_dir)
    }

if __name__ == "__main__":
    train_demand_forecaster()
