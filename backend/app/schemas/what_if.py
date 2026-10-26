from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class WhatIfSimulationRequest(BaseModel):
    sku: Optional[str] = None
    product_id: Optional[str] = None
    simulated_price: float = Field(..., gt=0)
    competitor_offset: Optional[float] = 0.0  # percentage -15% to +15%
    elasticity_multiplier: Optional[float] = 1.0
    promo_discount: Optional[float] = 0.0

class WhatIfSimulationResponse(BaseModel):
    product_id: str
    sku: str
    product_name: str
    simulated_price: float
    baseline_price: float
    price_delta: float
    price_percent_delta: float
    simulated_demand: int
    baseline_demand: int
    demand_delta: int
    demand_percent_delta: float
    simulated_revenue: float
    baseline_revenue: float
    revenue_delta: float
    revenue_percent_delta: float
    simulated_profit: float
    baseline_profit: float
    profit_delta: float
    simulated_margin: str
    baseline_margin: str
    competitor_price: float
    is_price_higher_than_competitor: bool

class WhatIfScenarioCreate(BaseModel):
    product_id: str
    name: str
    current_price: float
    simulated_price: float
    expected_demand: int
    expected_revenue: float
    expected_margin: str
    expected_gross_profit: float
    status: Optional[str] = "Staged Draft"

class WhatIfScenarioResponse(WhatIfScenarioCreate):
    id: str
    sku: Optional[str] = None
    product_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
