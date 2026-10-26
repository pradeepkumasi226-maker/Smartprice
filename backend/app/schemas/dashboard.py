from pydantic import BaseModel
from typing import List, Optional

class DashboardSummary(BaseModel):
    revenue: float
    revenue_target: float = 1600000.0
    units_sold: int
    average_price: float
    gross_margin: float
    inventory_value: float
    cost_of_goods_sold: float
    total_profit: float
    ai_revenue_lift: float = 13.1

class MonthlyTrendPoint(BaseModel):
    month: str
    revenue: float
    cost: float
    profit: float
    margin: str
    units: int

class CategoryPerformance(BaseModel):
    category: str
    revenue: float
    units: int
    profit: float
    margin: str

class AlertItem(BaseModel):
    id: str
    type: str  # danger, warning, info
    title: str
    message: str
    timestamp: str
    target_page: Optional[str] = None
    link_text: Optional[str] = None
