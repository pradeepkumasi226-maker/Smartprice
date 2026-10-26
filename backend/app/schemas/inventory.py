from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class RestockRequest(BaseModel):
    quantity: int = Field(..., gt=0, description="Number of units to restock")
    user: Optional[str] = "Retail Operations Manager"
    notes: Optional[str] = None

class BatchRestockRequest(BaseModel):
    product_ids: List[str]
    quantity: int = Field(..., gt=0)
    user: Optional[str] = "Batch Restock Process"

class InventoryTransactionResponse(BaseModel):
    id: str
    product_id: str
    sku: Optional[str] = None
    product_name: Optional[str] = None
    transaction_type: str
    quantity: int
    previous_stock: int
    new_stock: int
    remaining_stock: Optional[int] = None
    date: Optional[str] = None
    unit_cost: float
    reference: Optional[str] = None
    user: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class InventorySummary(BaseModel):
    total_products: int
    total_units: int
    total_inventory_value: float
    total_cost_value: float
    optimal_count: int
    low_stock_count: int
    critical_count: int
    overstocked_count: int
