"""
SmartPrice ML Explainability - Base Interfaces & Data Contracts

Defines standard schemas and contracts for model and rule explainability:
- Distinguishes genuine SHAP from deterministic rule attribution.
- Enforces distinction between observed correlations, rule weights, and unsupported causal claims.
"""
from enum import Enum
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from abc import ABC, abstractmethod

class ExplanationMethod(str, Enum):
    DETERMINISTIC_RULE_ATTRIBUTION = "deterministic_rule_attribution"
    TREE_SHAP = "tree_shap"
    KERNEL_SHAP = "kernel_shap"
    BASELINE_SEASONALITY = "baseline_seasonality"
    FALLBACK_RULE = "fallback_rule"

class CausalStatus(str, Enum):
    DETERMINISTIC_RULE_WEIGHT = "deterministic_rule_weight"
    OBSERVATIONAL_CORRELATION = "observational_correlation"
    CAUSAL_CLAIM_UNSUPPORTED = "causal_claim_unsupported"

@dataclass
class FeatureContribution:
    name: str
    value: float
    formatted_value: str
    type: str  # "base", "increase", "decrease", "total"
    raw_feature: Optional[str] = None
    feature_value: Optional[str] = None
    description: str = ""
    causal_status: str = CausalStatus.DETERMINISTIC_RULE_WEIGHT.value

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": round(self.value, 2),
            "formatted_value": self.formatted_value,
            "type": self.type,
            "raw_feature": self.raw_feature,
            "feature_value": self.feature_value,
            "description": self.description,
            "causal_status": self.causal_status
        }

    def to_frontend_feature(self) -> Dict[str, Any]:
        """Maps to frontend ShapWaterfallChart expected shape."""
        is_base = self.type == "base"
        is_pos = self.type == "increase" or (self.value > 0 and not is_base)
        return {
            "name": self.name,
            "impact": round(self.value, 2),
            "delta": round(self.value, 2) if not is_base else 0.0,
            "type": "base" if is_base else "positive" if is_pos else "negative",
            "reason": self.description
        }

@dataclass
class GlobalFeatureImportance:
    feature: str
    importance: float
    category: str
    description: str
    calculation_method: str = "empirical_catalog_variance"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "feature": self.feature,
            "importance": round(self.importance, 4),
            "category": self.category,
            "description": self.description,
            "calculation_method": self.calculation_method
        }

class BaseExplainer(ABC):
    @abstractmethod
    def explain_product(self, product: Any, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Computes feature attribution for a single product price recommendation."""
        pass

    @abstractmethod
    def compute_global_importance(self, catalog: List[Any]) -> List[Dict[str, Any]]:
        """Computes global feature attribution across catalog items."""
        pass
