"""
SmartPrice ML Forecasting - Time Series Baseline Models

Implements statistical demand forecasting baselines:
- Exponential Smoothing (SES with residual error tracking)
- Seasonal Day-of-Week profiling
- Ensemble Baseline Forecaster with prediction intervals (lower_bound, upper_bound)
"""
import json
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

from .base import BaseForecaster
from .metrics import compute_all_metrics

class EnsembleBaselineForecaster(BaseForecaster):
    """
    Time-Series Baseline Forecaster combining Exponential Smoothing (level estimation)
    and Day-of-Week Seasonality indices with empirical prediction intervals.
    """

    def __init__(
        self,
        model_name: str = "SmartPrice Baseline Demand Forecaster",
        model_version: str = "v1.0.0-baseline",
        smoothing_alpha: float = 0.35,
        prediction_interval: float = 0.80
    ):
        super().__init__(model_name=model_name, model_version=model_version)
        self.alpha = smoothing_alpha
        self.prediction_interval = prediction_interval
        
        # Fitted parameters
        self.last_level: float = 0.0
        self.weekday_indices: Dict[int, float] = {i: 1.0 for i in range(7)}
        self.residual_std: float = 1.0
        self.in_sample_metrics: Dict[str, float] = {}
        self.last_date: Optional[str] = None
        self.training_series_count: int = 0

    def fit(self, train_series: List[Dict[str, Any]]) -> "EnsembleBaselineForecaster":
        """
        Fits baseline parameters on chronologically ordered training records:
        train_series = [{"date": "YYYY-MM-DD", "units": int, ...}]
        """
        if not train_series:
            raise ValueError("Cannot fit forecaster on empty training series.")

        # Sort chronologically to guarantee no leakage
        sorted_series = sorted(train_series, key=lambda x: x["date"])
        self.training_series_count = len(sorted_series)
        self.last_date = sorted_series[-1]["date"]

        actuals = [float(item["units"]) for item in sorted_series]
        mean_actual = sum(actuals) / max(1, len(actuals))

        # 1. Day-of-Week Seasonality Decomposition
        weekday_buckets: Dict[int, List[float]] = {i: [] for i in range(7)}
        for item in sorted_series:
            dt = datetime.strptime(item["date"], "%Y-%m-%d")
            weekday_buckets[dt.weekday()].append(float(item["units"]))

        for wd, vals in weekday_buckets.items():
            if vals and mean_actual > 0:
                avg_wd = sum(vals) / len(vals)
                self.weekday_indices[wd] = max(0.2, min(2.5, avg_wd / mean_actual))
            else:
                self.weekday_indices[wd] = 1.0

        # Normalize weekday indices to average to 1.0
        avg_index = sum(self.weekday_indices.values()) / 7.0
        if avg_index > 0:
            for wd in self.weekday_indices:
                self.weekday_indices[wd] = round(self.weekday_indices[wd] / avg_index, 4)

        # 2. Exponential Smoothing (SES) Level Estimation
        level = actuals[0]
        fitted_values = [level]
        residuals = []

        for i in range(1, len(actuals)):
            level = (self.alpha * actuals[i]) + ((1.0 - self.alpha) * level)
            # In-sample one-step-ahead prediction with seasonal factor
            dt = datetime.strptime(sorted_series[i]["date"], "%Y-%m-%d")
            seas_factor = self.weekday_indices.get(dt.weekday(), 1.0)
            pred = max(1.0, level * seas_factor)
            fitted_values.append(pred)
            residuals.append(actuals[i] - pred)

        self.last_level = level

        # 3. Residual Variance & Uncertainty Bound Estimation
        if residuals:
            variance = sum(r ** 2 for r in residuals) / len(residuals)
            self.residual_std = max(1.0, math.sqrt(variance))
        else:
            self.residual_std = max(1.0, mean_actual * 0.15)

        # 4. In-Sample Evaluation Metrics
        if len(actuals) > 1:
            self.in_sample_metrics = compute_all_metrics(actuals[1:], fitted_values[1:])
        else:
            self.in_sample_metrics = {"mae": 0.0, "rmse": 0.0, "wape_pct": 0.0}

        self.is_fitted = True
        return self

    def predict(
        self, horizon_days: int = 7, start_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generates day-by-day forecast timeline with confidence bounds.
        """
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predict() is called.")

        if start_date:
            curr_dt = datetime.strptime(start_date, "%Y-%m-%d")
        elif self.last_date:
            curr_dt = datetime.strptime(self.last_date, "%Y-%m-%d") + timedelta(days=1)
        else:
            curr_dt = datetime.utcnow()

        # Z-multiplier for prediction intervals (80% interval ≈ 1.28)
        z_multiplier = 1.28

        predictions: List[Dict[str, Any]] = []
        for step in range(horizon_days):
            date_str = curr_dt.strftime("%Y-%m-%d")
            weekday = curr_dt.weekday()
            seasonal_factor = self.weekday_indices.get(weekday, 1.0)

            # Expected demand
            point_pred = max(1.0, self.last_level * seasonal_factor)
            
            # Prediction interval expands slightly with forecast horizon h
            step_uncertainty = self.residual_std * math.sqrt(1.0 + (step * 0.05))
            lower_bound = max(0, round(point_pred - (z_multiplier * step_uncertainty)))
            upper_bound = max(lower_bound + 1, round(point_pred + (z_multiplier * step_uncertainty)))

            predictions.append({
                "date": date_str,
                "weekday": curr_dt.strftime("%a"),
                "predicted_demand": round(point_pred),
                "lower_bound": lower_bound,
                "upper_bound": upper_bound
            })
            curr_dt += timedelta(days=1)

        return predictions

    def evaluate(self, val_series: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Evaluates predictions against out-of-sample validation actuals.
        """
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before evaluation.")
        if not val_series:
            return {"error": "Validation series is empty."}

        actuals = [float(item["units"]) for item in val_series]
        predictions = []

        for item in val_series:
            dt = datetime.strptime(item["date"], "%Y-%m-%d")
            s_factor = self.weekday_indices.get(dt.weekday(), 1.0)
            pred = max(1.0, self.last_level * s_factor)
            predictions.append(pred)

        return compute_all_metrics(actuals, predictions)

    def save(self, directory: Path) -> None:
        """Saves model parameters and metadata to the artifact directory."""
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)

        model_params = {
            "model_name": self.model_name,
            "model_version": self.model_version,
            "alpha": self.alpha,
            "prediction_interval": self.prediction_interval,
            "last_level": round(self.last_level, 4),
            "weekday_indices": {str(k): round(v, 4) for k, v in self.weekday_indices.items()},
            "residual_std": round(self.residual_std, 4),
            "last_date": self.last_date,
            "training_series_count": self.training_series_count,
            "in_sample_metrics": self.in_sample_metrics,
            "saved_at": datetime.utcnow().isoformat()
        }

        model_file = directory / "model.json"
        with open(model_file, "w", encoding="utf-8") as f:
            json.dump(model_params, f, indent=2)

    @classmethod
    def load(cls, directory: Path) -> "EnsembleBaselineForecaster":
        """Loads fitted model from artifact directory."""
        directory = Path(directory)
        model_file = directory / "model.json"

        if not model_file.exists():
            raise FileNotFoundError(f"No model artifact found at {model_file}")

        with open(model_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        instance = cls(
            model_name=data.get("model_name", "SmartPrice Baseline Demand Forecaster"),
            model_version=data.get("model_version", "v1.0.0-baseline"),
            smoothing_alpha=data.get("alpha", 0.35),
            prediction_interval=data.get("prediction_interval", 0.80)
        )
        instance.last_level = data.get("last_level", 0.0)
        instance.weekday_indices = {int(k): v for k, v in data.get("weekday_indices", {}).items()}
        instance.residual_std = data.get("residual_std", 1.0)
        instance.last_date = data.get("last_date")
        instance.training_series_count = data.get("training_series_count", 0)
        instance.in_sample_metrics = data.get("in_sample_metrics", {})
        instance.is_fitted = True

        return instance
