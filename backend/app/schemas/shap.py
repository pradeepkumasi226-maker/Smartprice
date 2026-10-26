from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ShapGlobalFeature(BaseModel):
    feature: str
    importance: float
    category: str
    description: str
    calculation_method: Optional[str] = "empirical_catalog_variance"

class ShapDecompositionPoint(BaseModel):
    name: str
    value: float
    formatted_value: str
    type: str  # base, increase, decrease, total
    raw_feature: Optional[str] = None
    feature_value: Optional[str] = None
    description: str
    causal_status: Optional[str] = "deterministic_rule_weight"

class ShapProductDecomposition(BaseModel):
    product_id: str
    sku: str
    product_name: str
    productName: Optional[str] = None
    base_value: float
    basePrice: Optional[float] = None
    final_recommended_price: float
    finalPrice: Optional[float] = None
    waterfall_points: List[ShapDecompositionPoint]
    features: Optional[List[Dict[str, Any]]] = None
    naturalLanguageExplanation: Optional[str] = None
    explanation_method: Optional[str] = "deterministic_rule_attribution"
    is_genuine_shap: Optional[bool] = False
    method_description: Optional[str] = None
    model_version: Optional[str] = "Deterministic Pricing Rule Attribution v1.0"
    r2_score: Optional[float] = None
    additivity_check: Optional[Dict[str, Any]] = None
