from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ForecastTimelinePoint(BaseModel):
    date: str
    historical_sales: Optional[int] = None
    predicted_demand: int
    lower_bound: int
    upper_bound: int
    actual_revenue: Optional[float] = None
    projected_revenue: Optional[float] = None
    promo_uplift: Optional[int] = 0

class ProductForecastSummary(BaseModel):
    product_id: str
    sku: str
    name: str
    category: str
    current_price: float
    cost_price: float
    stock_quantity: int
    reorder_level: int
    safety_stock: int
    historical_sales_units: int
    historical_revenue: float
    predicted_demand_units: int
    projected_revenue: float
    lower_bound_units: int
    upper_bound_units: int
    stockout_risk: str
    days_of_supply: float
    sales_velocity: str
    elasticity: float

class ForecastResponse(BaseModel):
    time_range: str
    model_name: str = "SmartPrice Baseline Demand Forecaster"
    model_version: Optional[str] = "v1.0.0-baseline"
    accuracy_metric: str = "Backtest Baseline: Day-of-week seasonality calibration"
    data_source: str = "SQLite Database (Historical Sales & Product Catalog)"
    methodology_note: str = "Projections calculated from historical store sales, price elasticity factors, and calendar seasonal multipliers."
    is_production_certified: Optional[bool] = False
    currency: str = "INR"
    currency_symbol: str = "₹"
    sku: Optional[str] = None
    category: Optional[str] = None
    product_name: Optional[str] = None
    total_historical_sales: Optional[int] = None
    total_predicted_demand: Optional[int] = None
    total_actual_revenue: Optional[float] = None
    total_projected_revenue: Optional[float] = None
    projected_change_pct: Optional[float] = None
    points: List[ForecastTimelinePoint]

class SeasonalityDriver(BaseModel):
    factor: str
    impact: str
    category: str
    coefficient: float
    description: str

