from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SaleBase(BaseModel):
    product_id: str
    store: Optional[str] = "Downtown Flagship (Store #104)"
    sale_date: str
    quantity: int
    selling_price: float
    revenue: float
    cost: float
    profit: float

class SaleCreate(SaleBase):
    pass

class SaleResponse(SaleBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
