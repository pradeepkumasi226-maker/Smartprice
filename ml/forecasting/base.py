"""
SmartPrice ML Forecasting - Base Forecaster Abstract Interface
"""
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Any, Optional

class BaseForecaster(ABC):
    """Abstract base class for all SmartPrice time-series forecasters."""

    def __init__(self, model_name: str, model_version: str):
        self.model_name = model_name
        self.model_version = model_version
        self.is_fitted = False
        self.training_metadata: Dict[str, Any] = {}

    @abstractmethod
    def fit(self, train_series: List[Dict[str, Any]]) -> "BaseForecaster":
        """Fits the model on a chronologically ordered training series."""
        pass

    @abstractmethod
    def predict(
        self, horizon_days: int, start_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generates point forecasts and confidence bounds for the specified horizon.
        Returns a list of point dictionaries:
        [{
            "date": str,
            "predicted_demand": int,
            "lower_bound": int,
            "upper_bound": int
        }]
        """
        pass

    @abstractmethod
    def evaluate(self, val_series: List[Dict[str, Any]]) -> Dict[str, float]:
        """Evaluates model performance against validation actuals."""
        pass

    @abstractmethod
    def save(self, directory: Path) -> None:
        """Serializes model parameters and versioned metadata to disk."""
        pass

    @classmethod
    @abstractmethod
    def load(cls, directory: Path) -> "BaseForecaster":
        """Deserializes a fitted model from an artifact directory."""
        pass
