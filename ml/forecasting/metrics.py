"""
SmartPrice ML Forecasting - Time Series Evaluation Metrics

Provides standard retail demand forecasting evaluation metrics:
- Mean Absolute Error (MAE)
- Root Mean Squared Error (RMSE)
- Weighted Absolute Percentage Error (WAPE) - Recommended for retail inventory
- Mean Absolute Percentage Error (MAPE) with epsilon protection
- Forecast Bias (Mean Error) - Tracks systematic over- or under-forecasting
"""
import math
from typing import List, Dict, Union

def mean_absolute_error(y_true: List[float], y_pred: List[float]) -> float:
    """Computes MAE = (1/n) * sum(|y_true - y_pred|)."""
    if not y_true or not y_pred or len(y_true) != len(y_pred):
        return 0.0
    return sum(abs(t - p) for t, p in zip(y_true, y_pred)) / len(y_true)

def root_mean_squared_error(y_true: List[float], y_pred: List[float]) -> float:
    """Computes RMSE = sqrt((1/n) * sum((y_true - y_pred)^2))."""
    if not y_true or not y_pred or len(y_true) != len(y_pred):
        return 0.0
    mse = sum((t - p) ** 2 for t, p in zip(y_true, y_pred)) / len(y_true)
    return math.sqrt(mse)

def weighted_absolute_percentage_error(y_true: List[float], y_pred: List[float]) -> float:
    """
    Computes WAPE = sum(|y_true - y_pred|) / sum(y_true).
    Standard metric for retail demand forecasting where individual time intervals
    may have zero or low sales, making standard MAPE undefined or distorted.
    """
    if not y_true or not y_pred or len(y_true) != len(y_pred):
        return 0.0
    total_actual = sum(y_true)
    if total_actual <= 0:
        return 0.0
    total_abs_error = sum(abs(t - p) for t, p in zip(y_true, y_pred))
    return (total_abs_error / total_actual) * 100.0

def mean_absolute_percentage_error(y_true: List[float], y_pred: List[float], epsilon: float = 1e-4) -> float:
    """
    Computes MAPE = (100/n) * sum(|y_true - y_pred| / max(y_true, epsilon)).
    """
    if not y_true or not y_pred or len(y_true) != len(y_pred):
        return 0.0
    errors = [abs(t - p) / max(abs(t), epsilon) for t, p in zip(y_true, y_pred)]
    return (sum(errors) / len(errors)) * 100.0

def forecast_bias(y_true: List[float], y_pred: List[float]) -> float:
    """
    Computes Forecast Bias = sum(y_pred - y_true) / sum(y_true).
    Positive indicates over-forecasting; negative indicates under-forecasting.
    """
    if not y_true or not y_pred or len(y_true) != len(y_pred):
        return 0.0
    total_actual = sum(y_true)
    if total_actual <= 0:
        return 0.0
    return ((sum(y_pred) - total_actual) / total_actual) * 100.0

def compute_all_metrics(y_true: List[float], y_pred: List[float]) -> Dict[str, float]:
    """Computes a comprehensive dictionary of all evaluation metrics."""
    return {
        "mae": round(mean_absolute_error(y_true, y_pred), 3),
        "rmse": round(root_mean_squared_error(y_true, y_pred), 3),
        "wape_pct": round(weighted_absolute_percentage_error(y_true, y_pred), 2),
        "mape_pct": round(mean_absolute_percentage_error(y_true, y_pred), 2),
        "bias_pct": round(forecast_bias(y_true, y_pred), 2),
        "sample_size": len(y_true)
    }
