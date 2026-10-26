"""
SmartPrice ML Optimization - Price Elasticity Estimator Engine

Coordinates data extraction, econometric log-log modeling, chronological validation,
reliability assessment, and reproducible versioned artifact storage.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any

from .regression import LogLogDemandRegression
from .validator import ElasticityValidator
from ..config.elasticity_config import ElasticityConfig, ELASTICITY_ARTIFACTS_DIR
from ..preprocessing.data_loader import SalesDataLoader

class ElasticityEstimator:
    def __init__(self, config: Optional[ElasticityConfig] = None):
        self.config = config or ElasticityConfig()
        self.validator = ElasticityValidator(self.config)
        self.data_loader = SalesDataLoader(db_path=self.config.db_path)
        self.fitted_results: Dict[str, Dict[str, Any]] = {}
        self.training_metadata: Dict[str, Any] = {}

    def fit_product_elasticity(
        self,
        sku: str,
        catalog_fallback: float = -1.25,
        sales_records: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Estimates price elasticity for a specific SKU using log-log regression.
        If data is insufficient or prices are constant, safely defaults to fallback.
        """
        if sales_records is None:
            raw_sales = self.data_loader.load_raw_sales()
            sku_sales = [r for r in raw_sales if r.get("sku") == sku or r.get("product_id") == sku]
        else:
            sku_sales = sales_records

        prices = [float(r["selling_price"]) for r in sku_sales]
        quantities = [float(r["quantity"]) for r in sku_sales]

        # 1. Pre-regression data validation
        data_val = self.validator.validate_raw_data(prices, quantities)

        # 2. Fit regression if initial checks pass
        reg = LogLogDemandRegression()
        reg.fit(prices, quantities)

        # 3. Assess statistical & economic reliability
        reg_diag = {
            "elasticity": reg.elasticity,
            "intercept": reg.intercept,
            "std_error": reg.std_error,
            "r_squared": reg.r_squared,
            "t_statistic": reg.t_stat,
            "p_value": reg.p_value,
            "conf_interval_95": reg.conf_interval_95,
            "sample_size": reg.sample_size,
            **reg.diagnostics
        }

        assessment = self.validator.assess_reliability(
            regression_diagnostics=reg_diag,
            sku=sku,
            catalog_fallback=catalog_fallback
        )

        result = {
            "sku": sku,
            "effective_elasticity": assessment["recommended_elasticity"],
            "fitted_elasticity": assessment.get("fitted_elasticity"),
            "elasticity_source": assessment["source"],
            "reliability_status": assessment["reliability_status"],
            "is_reliable": assessment["is_reliable"],
            "explanation": assessment["explanation"],
            "data_summary": data_val,
            "regression_diagnostics": reg_diag,
            "observational_limitations": assessment["observational_limitations"]
        }

        self.fitted_results[sku] = result
        return result

    def fit_catalog(self) -> Dict[str, Dict[str, Any]]:
        """
        Iterates across all products in the catalog and fits SKU-level elasticity.
        """
        raw_sales = self.data_loader.load_raw_sales()
        
        # Group by SKU
        sku_groups: Dict[str, List[Dict[str, Any]]] = {}
        for r in raw_sales:
            sku = r.get("sku") or r.get("product_id")
            if sku not in sku_groups:
                sku_groups[sku] = []
            sku_groups[sku].append(r)

        results: Dict[str, Dict[str, Any]] = {}
        for sku, records in sku_groups.items():
            results[sku] = self.fit_product_elasticity(
                sku=sku,
                catalog_fallback=self.config.default_fallback_elasticity,
                sales_records=records
            )

        self.fitted_results = results
        return results

    def save(self, directory: Optional[Path] = None) -> None:
        """Saves fitted models, diagnostics, and reproducibility metadata."""
        target_dir = Path(directory) if directory else self.config.artifacts_dir
        target_dir.mkdir(parents=True, exist_ok=True)

        model_file = target_dir / "model.json"
        metadata_file = target_dir / "metadata.json"

        # Serialize model output
        model_payload = {
            "model_name": self.config.model_name,
            "model_version": self.config.model_version,
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "sku_estimates": self.fitted_results
        }

        with open(model_file, "w", encoding="utf-8") as f:
            json.dump(model_payload, f, indent=2)

        # Count reliable vs fallback
        total_skus = len(self.fitted_results)
        reliable_count = sum(1 for res in self.fitted_results.values() if res.get("is_reliable"))
        constant_price_count = sum(1 for res in self.fitted_results.values() if res.get("reliability_status") == "UNRELIABLE_CONSTANT_PRICE")

        metadata_payload = {
            "model_name": self.config.model_name,
            "model_version": self.config.model_version,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "dataset_summary": {
                "total_skus_evaluated": total_skus,
                "reliable_fitted_skus": reliable_count,
                "constant_price_skus": constant_price_count,
                "fallback_skus": total_skus - reliable_count
            },
            "findings": (
                f"Evaluated {total_skus} SKUs. {constant_price_count} SKUs exhibited zero price variation "
                "in historical sales records. For these SKUs, econometric slope estimation is mathematically "
                "unidentifiable; established catalog elasticity fallbacks are safely retained."
            ),
            "hyperparameters": {
                "min_observations": self.config.min_observations,
                "min_price_cv": self.config.min_price_cv,
                "max_p_value": self.config.max_p_value,
                "min_plausible_elasticity": self.config.min_plausible_elasticity,
                "max_plausible_elasticity": self.config.max_plausible_elasticity
            }
        }

        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata_payload, f, indent=2)
