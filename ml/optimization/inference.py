"""
SmartPrice ML Optimization - Price Elasticity Inference Bridge

Connects trained elasticity artifacts to the backend Dynamic Pricing Engine.
Guarantees safe fallback when artifacts are missing or marked unreliable.
"""
import json
from pathlib import Path
from typing import Dict, Optional, Any
from ..config.elasticity_config import ELASTICITY_ARTIFACTS_DIR

class ElasticityInferenceBridge:
    def __init__(self, artifacts_dir: Optional[Path] = None):
        self.artifacts_dir = Path(artifacts_dir) if artifacts_dir else ELASTICITY_ARTIFACTS_DIR
        self._cached_model: Optional[Dict[str, Any]] = None

    def is_available(self) -> bool:
        """Checks if a trained elasticity artifact exists on disk."""
        return (self.artifacts_dir / "model.json").exists()

    def get_model_data(self) -> Dict[str, Any]:
        """Loads and caches the elasticity model artifact."""
        if self._cached_model is None:
            model_file = self.artifacts_dir / "model.json"
            if not model_file.exists():
                return {}
            with open(model_file, "r", encoding="utf-8") as f:
                self._cached_model = json.load(f)
        return self._cached_model

    def get_sku_elasticity(self, sku: str, catalog_fallback: float = -1.25) -> Dict[str, Any]:
        """
        Retrieves elasticity for a SKU.
        Only returns fitted elasticity if marked RELIABLE_FITTED;
        otherwise provides catalog fallback with explicit transparency.
        """
        data = self.get_model_data()
        estimates = data.get("sku_estimates", {})
        
        # Check by SKU or ID
        sku_entry = estimates.get(sku)
        if not sku_entry:
            return {
                "sku": sku,
                "elasticity": catalog_fallback,
                "source": "fallback_catalog",
                "is_reliable": False,
                "reliability_status": "NO_MODEL_ARTIFACT",
                "explanation": "No trained econometric model artifact found for this SKU; using catalog fallback."
            }

        is_reliable = sku_entry.get("is_reliable", False)
        if is_reliable:
            return {
                "sku": sku,
                "elasticity": sku_entry["effective_elasticity"],
                "source": "fitted_log_log_model",
                "is_reliable": True,
                "reliability_status": sku_entry.get("reliability_status", "RELIABLE_FITTED"),
                "explanation": sku_entry.get("explanation", "Fitted log-log econometric estimate."),
                "diagnostics": sku_entry.get("regression_diagnostics", {})
            }
        else:
            return {
                "sku": sku,
                "elasticity": catalog_fallback,
                "source": "fallback_catalog",
                "is_reliable": False,
                "reliability_status": sku_entry.get("reliability_status", "UNRELIABLE"),
                "explanation": sku_entry.get("explanation", "Model estimate did not pass reliability criteria; using catalog fallback."),
                "diagnostics": sku_entry.get("regression_diagnostics", {})
            }
