from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class BatchProductRequest(BaseModel):
    product_ids: List[str]

class ProductBase(BaseModel):
    sku: str
    name: str
    category: str
    current_price: float
    cost_price: float
    competitor_price: Optional[float] = 0.0
    stock_quantity: int = 0
    reorder_level: int = 30
    safety_stock: int = 15
    supplier: Optional[str] = "Global Direct Vendor Ltd."
    rating: Optional[float] = 4.5
    elasticity: Optional[float] = -1.25
    predicted_demand: Optional[int] = 100
    dynamic_pricing: Optional[bool] = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    current_price: Optional[float] = None
    cost_price: Optional[float] = None
    competitor_price: Optional[float] = None
    stock_quantity: Optional[int] = None
    reorder_level: Optional[int] = None
    safety_stock: Optional[int] = None
    supplier: Optional[str] = None
    rating: Optional[float] = None
    elasticity: Optional[float] = None
    predicted_demand: Optional[int] = None
    dynamic_pricing: Optional[bool] = None

class ProductResponse(ProductBase):
    id: str
    status: Optional[str] = "Optimal"  # Optimal, Low Stock, Critical, Overstocked
    recommended_price: Optional[float] = None
    has_active_recommendation: Optional[bool] = False
    has_historical_override: Optional[bool] = False
    historical_override_price: Optional[float] = None
    override_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
