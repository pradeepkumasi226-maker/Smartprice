from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PricingRecommendationResponse(BaseModel):
    id: str
    product_id: str
    sku: Optional[str] = None
    product_name: Optional[str] = None
    current_price: float
    recommended_price: float
    cost_price: Optional[float] = None
    competitor_price: Optional[float] = None
    price_delta: Optional[str] = None
    price_delta_val: Optional[float] = 0.0
    price_change_pct: Optional[str] = "+0.0%"
    price_change_pct_val: Optional[float] = 0.0
    stock_quantity: Optional[int] = None
    reorder_level: Optional[int] = None
    safety_stock: Optional[int] = None
    stock_status: Optional[str] = "Optimal"
    cost_floor: Optional[float] = None
    min_guardrail: Optional[float] = None
    max_guardrail: Optional[float] = None
    guardrail_details: Optional[str] = None
    pricing_drivers: Optional[dict] = None
    baseline_demand: Optional[int] = None
    expected_demand: int
    demand_delta: Optional[str] = "+8.4%"
    current_revenue: Optional[float] = None
    expected_revenue: Optional[float] = None
    revenue_lift_val: Optional[float] = 0.0
    revenue_lift: Optional[str] = "+11.2%"
    current_profit: Optional[float] = None
    expected_profit: Optional[float] = None
    profit_lift_val: Optional[float] = 0.0
    profit_lift: Optional[str] = None
    current_margin: Optional[str] = None
    expected_margin: Optional[str] = None
    margin_delta: Optional[str] = "+3.1%"
    elasticity_score: Optional[float] = -1.25
    elasticity_label: Optional[str] = "Moderately Elastic"
    elasticity_source: Optional[str] = "fallback_catalog"
    elasticity_reliable: Optional[bool] = False
    elasticity_status: Optional[str] = None
    rationale: Optional[str] = None
    status: str
    is_stale: bool = False
    stale_reason: Optional[str] = None
    guardrail_status: Optional[str] = "Pass"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PricingEngineGenerateRequest(BaseModel):
    min_margin_pct: Optional[float] = 5.0
    max_price_change_pct: Optional[float] = 30.0
    allow_below_cost: Optional[bool] = False
    category: Optional[str] = None

class PriceApprovalRequest(BaseModel):
    approved_price: Optional[float] = None
    user: Optional[str] = None
    override_reason: Optional[str] = None

class PriceDecisionResponse(BaseModel):
    id: str
    product_id: str
    previous_price: float
    approved_price: float
    decision: str
    user: str
    created_at: datetime

    class Config:
        from_attributes = True

class ElasticityPoint(BaseModel):
    price: float
    demand: int
    revenue: float
    profit: Optional[float] = None
    margin: str
    isOptimal: Optional[bool] = False

class ElasticityCurveResponse(BaseModel):
    product_id: str
    sku: str
    base_price: float
    optimal_price: float
    points: List[ElasticityPoint]
