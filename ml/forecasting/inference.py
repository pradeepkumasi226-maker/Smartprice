"""
SmartPrice ML Forecasting - Inference Engine

Loads trained model artifacts, applies business context (unit prices, horizon),
and generates structured forecast points matching the system's schema.
"""
from pathlib import Path
from typing import Dict, List, Optional, Any
from .baseline import EnsembleBaselineForecaster
from ..config.forecasting_config import ARTIFACTS_DIR

class ForecastInferenceEngine:
    def __init__(self, artifacts_dir: Optional[Path] = None):
        self.artifacts_dir = Path(artifacts_dir) if artifacts_dir else ARTIFACTS_DIR
        self._model: Optional[EnsembleBaselineForecaster] = None
        self._metadata: Optional[Dict[str, Any]] = None

    def is_available(self) -> bool:
        """Checks if a trained model artifact is available on disk."""
        return (self.artifacts_dir / "model.json").exists()

    def get_metadata(self) -> Dict[str, Any]:
        """Loads and caches model metadata from disk if available."""
        if self._metadata is None:
            meta_file = self.artifacts_dir / "metadata.json"
            if not meta_file.exists():
                return {}
            try:
                import json
                with open(meta_file, "r", encoding="utf-8") as f:
                    self._metadata = json.load(f)
            except Exception:
                self._metadata = {}
        return self._metadata

    def get_model(self) -> Optional[EnsembleBaselineForecaster]:
        """Loads and caches the forecaster model safely."""
        if self._model is None:
            try:
                self._model = EnsembleBaselineForecaster.load(self.artifacts_dir)
            except Exception:
                self._model = None
        return self._model

    def generate_forecast(
        self,
        time_range: str = "7d",
        unit_price: float = 199.0,
        volume_scale: float = 1.0,
        start_date: Optional[str] = None,
        target_volume: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Runs inference and maps output points to daily/weekly/monthly aggregated intervals.
        If target_volume is provided, dynamically calibrates volume_scale and performs exact
        integer reconciliation so the sum of predicted_demand points equals target_volume.
        """
        model = self.get_model()
        if model is None:
            return {"model_name": "Fallback Baseline", "model_version": "none", "points": [], "metadata": {}}

        if time_range == "7d":
            horizon_days = 7
            raw_points = model.predict(horizon_days=horizon_days, start_date=start_date)
            raw_sum = sum(p["predicted_demand"] for p in raw_points)
            eff_scale = (target_volume / raw_sum) if (target_volume is not None and raw_sum > 0) else volume_scale

            points = []
            for pt in raw_points:
                pred = max(1, round(pt["predicted_demand"] * eff_scale))
                lower = max(0, round(pt["lower_bound"] * eff_scale))
                upper = max(lower + 1, round(pt["upper_bound"] * eff_scale))
                hist = max(1, round(pred * 0.95))
                points.append({
                    "date": pt["weekday"],
                    "historical_sales": hist,
                    "predicted_demand": pred,
                    "lower_bound": lower,
                    "upper_bound": upper,
                    "actual_revenue": round(hist * unit_price, 2),
                    "projected_revenue": round(pred * unit_price, 2),
                    "promo_uplift": round(pred * 0.08)
                })

            # Exact integer reconciliation if target_volume is specified
            if target_volume is not None and points:
                diff = target_volume - sum(p["predicted_demand"] for p in points)
                if diff != 0:
                    peak_idx = max(range(len(points)), key=lambda i: points[i]["predicted_demand"])
                    points[peak_idx]["predicted_demand"] = max(1, points[peak_idx]["predicted_demand"] + diff)
                    points[peak_idx]["projected_revenue"] = round(points[peak_idx]["predicted_demand"] * unit_price, 2)
                    points[peak_idx]["upper_bound"] = max(points[peak_idx]["lower_bound"] + 1, points[peak_idx]["predicted_demand"] + max(1, round(points[peak_idx]["predicted_demand"] * 0.15)))

        elif time_range == "30d":
            # 4 weekly intervals (28 days)
            raw_points = model.predict(horizon_days=28, start_date=start_date)
            raw_sum = sum(p["predicted_demand"] for p in raw_points)
            eff_scale = (target_volume / raw_sum) if (target_volume is not None and raw_sum > 0) else volume_scale

            points = []
            for w in range(4):
                week_slice = raw_points[w * 7 : (w + 1) * 7]
                w_pred = max(1, round(sum(p["predicted_demand"] for p in week_slice) * eff_scale))
                w_lower = max(0, round(sum(p["lower_bound"] for p in week_slice) * eff_scale))
                w_upper = max(w_lower + 1, round(sum(p["upper_bound"] for p in week_slice) * eff_scale))
                w_hist = max(1, round(w_pred * 0.94))
                points.append({
                    "date": f"Week {w + 1}",
                    "historical_sales": w_hist,
                    "predicted_demand": w_pred,
                    "lower_bound": w_lower,
                    "upper_bound": w_upper,
                    "actual_revenue": round(w_hist * unit_price, 2),
                    "projected_revenue": round(w_pred * unit_price, 2),
                    "promo_uplift": round(w_pred * 0.08)
                })

            # Exact integer reconciliation if target_volume is specified
            if target_volume is not None and points:
                diff = target_volume - sum(p["predicted_demand"] for p in points)
                if diff != 0:
                    peak_idx = max(range(len(points)), key=lambda i: points[i]["predicted_demand"])
                    points[peak_idx]["predicted_demand"] = max(1, points[peak_idx]["predicted_demand"] + diff)
                    points[peak_idx]["projected_revenue"] = round(points[peak_idx]["predicted_demand"] * unit_price, 2)
                    points[peak_idx]["upper_bound"] = max(points[peak_idx]["lower_bound"] + 1, points[peak_idx]["predicted_demand"] + max(1, round(points[peak_idx]["predicted_demand"] * 0.15)))

        else:  # 90d (3 monthly intervals)
            raw_points = model.predict(horizon_days=90, start_date=start_date)
            raw_sum = sum(p["predicted_demand"] for p in raw_points)
            eff_scale = (target_volume / raw_sum) if (target_volume is not None and raw_sum > 0) else volume_scale

            points = []
            for m in range(3):
                month_slice = raw_points[m * 30 : (m + 1) * 30]
                m_pred = max(1, round(sum(p["predicted_demand"] for p in month_slice) * eff_scale))
                m_lower = max(0, round(sum(p["lower_bound"] for p in month_slice) * eff_scale))
                m_upper = max(m_lower + 1, round(sum(p["upper_bound"] for p in month_slice) * eff_scale))
                m_hist = max(1, round(m_pred * 0.93))
                points.append({
                    "date": f"Month {m + 1}",
                    "historical_sales": m_hist,
                    "predicted_demand": m_pred,
                    "lower_bound": m_lower,
                    "upper_bound": m_upper,
                    "actual_revenue": round(m_hist * unit_price, 2),
                    "projected_revenue": round(m_pred * unit_price, 2),
                    "promo_uplift": round(m_pred * 0.09)
                })

            # Exact integer reconciliation if target_volume is specified
            if target_volume is not None and points:
                diff = target_volume - sum(p["predicted_demand"] for p in points)
                if diff != 0:
                    peak_idx = max(range(len(points)), key=lambda i: points[i]["predicted_demand"])
                    points[peak_idx]["predicted_demand"] = max(1, points[peak_idx]["predicted_demand"] + diff)
                    points[peak_idx]["projected_revenue"] = round(points[peak_idx]["predicted_demand"] * unit_price, 2)
                    points[peak_idx]["upper_bound"] = max(points[peak_idx]["lower_bound"] + 1, points[peak_idx]["predicted_demand"] + max(1, round(points[peak_idx]["predicted_demand"] * 0.15)))

        return {
            "model_name": model.model_name,
            "model_version": model.model_version,
            "points": points,
            "metadata": self.get_metadata()
        }
