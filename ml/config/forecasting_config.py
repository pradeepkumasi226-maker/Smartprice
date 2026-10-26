"""
SmartPrice ML Pipeline - Demand Forecasting Configuration
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

# Project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ML_DIR = PROJECT_ROOT / "ml"
ARTIFACTS_DIR = ML_DIR / "artifacts" / "forecaster"
DEFAULT_DB_PATH = PROJECT_ROOT / "backend" / "data" / "smartprice.db"

@dataclass
class ForecastingConfig:
    # Model Metadata
    model_name: str = "SmartPrice Baseline Demand Forecaster"
    model_version: str = "v1.0.0-baseline"
    description: str = (
        "Time-series baseline forecaster combining Exponential Smoothing (SES) "
        "and Day-of-Week Seasonality profiling with empirical residual uncertainty bounds."
    )

    # Data & Paths
    db_path: Path = DEFAULT_DB_PATH
    artifacts_dir: Path = ARTIFACTS_DIR
    min_required_observations: int = 14  # Minimum sales observations per SKU
    recommended_observations: int = 60  # Minimum for high-confidence time series

    # Train / Validation Split
    validation_ratio: float = 0.25  # Last 25% of chronological data used for validation
    
    # Model Hyperparameters
    smoothing_alpha: float = 0.35   # Level smoothing factor for Exponential Smoothing
    trend_damping: float = 0.90     # Trend damping factor
    prediction_interval: float = 0.80  # 80% confidence interval (approx. ±1.28 std dev)
    
    # Horizons
    horizon_days_map: Dict[str, int] = field(default_factory=lambda: {
        "7d": 7,
        "30d": 30,
        "90d": 90
    })

    # Day-of-week baseline weights (Monday=0 to Sunday=6)
    default_weekday_weights: List[float] = field(default_factory=lambda: [
        0.11,  # Mon
        0.10,  # Tue
        0.12,  # Wed
        0.13,  # Thu
        0.17,  # Fri
        0.21,  # Sat
        0.16   # Sun
    ])
