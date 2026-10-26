from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class StoreSalesBreakdown(BaseModel):
    store: str
    revenue: float
    units: int
    profit: float
    margin: str
    orders: int

class CategorySalesBreakdown(BaseModel):
    category: str
    revenue: float
    units: int
    profit: float
    margin: str
    cost: Optional[float] = None
    reconciliation_status: Optional[str] = "reconciled"

class PricingComplianceSummary(BaseModel):
    total_recommendations: int
    approved_count: int
    pending_count: int
    declined_count: int
    compliance_rate: float
    avg_price_increase: str
    avg_revenue_lift: str

class InventoryHealthSummary(BaseModel):
    total_skus: int
    total_units: int
    stock_value: float
    critical_stock_count: int
    low_stock_count: int
    optimal_stock_count: int
    overstock_count: int
    inventory_turnover_rate: float

class ReportsSummaryResponse(BaseModel):
    total_revenue: float
    total_profit: float
    average_gross_margin: float
    total_units_sold: int
    total_products_managed: int
    ai_adopted_revenue_lift: str
    cost_of_goods_sold: Optional[float] = None
    average_selling_price: Optional[float] = None
    unallocated_cost: Optional[float] = 0.0
    reconciliation_status: Optional[str] = "reconciled"
    sum_category_revenue: Optional[float] = None
    sum_category_profit: Optional[float] = None
    profit_formula: Optional[str] = "revenue - cost"
    margin_formula: Optional[str] = "(profit / revenue) * 100"
    store_breakdown: List[StoreSalesBreakdown]
    category_breakdown: List[CategorySalesBreakdown]
    pricing_compliance: PricingComplianceSummary
    inventory_health: InventoryHealthSummary
