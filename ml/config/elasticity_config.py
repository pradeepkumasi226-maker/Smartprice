"""
SmartPrice ML Pipeline - Price Elasticity Estimation Configuration
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ML_DIR = PROJECT_ROOT / "ml"
ELASTICITY_ARTIFACTS_DIR = ML_DIR / "artifacts" / "elasticity"
DEFAULT_DB_PATH = PROJECT_ROOT / "backend" / "data" / "smartprice.db"

@dataclass
class ElasticityConfig:
    # Model Metadata
    model_name: str = "SmartPrice Log-Log Price Elasticity Estimator"
    model_version: str = "v1.0.0-elasticity"
    description: str = (
        "Econometric price elasticity estimation pipeline using log-log ordinary least squares (OLS) "
        "regression: ln(Q) = alpha + epsilon * ln(P) + controls. Includes strict data sufficiency diagnostics, "
        "price variation testing, economic plausibility guardrails, and safe empirical fallback mechanisms."
    )

    # Storage Paths
    db_path: Path = DEFAULT_DB_PATH
    artifacts_dir: Path = ELASTICITY_ARTIFACTS_DIR

    # Reliability & Data Sufficiency Thresholds
    min_observations: int = 15                 # Minimum non-zero sales observations required
    min_distinct_prices: int = 2               # At least 2 distinct price points needed
    min_price_cv: float = 0.04                 # Minimum coefficient of variation in prices: std(P) / mean(P)
    max_p_value: float = 0.10                  # Statistical significance threshold for elasticity coefficient
    max_std_err_ratio: float = 0.60            # Maximum allowed SE(epsilon) / |epsilon|

    # Economic Plausibility Bounds for Standard Retail Goods
    min_plausible_elasticity: float = -6.0     # Extremely elastic threshold
    max_plausible_elasticity: float = -0.05    # Near zero (inelastic threshold)
    reject_positive_elasticity: bool = True    # Demand curve must slope downward (epsilon < 0)

    # Chronological Validation
    validation_ratio: float = 0.25             # Out-of-sample chronological test split

    # Default catalog fallbacks
    default_fallback_elasticity: float = -1.25
