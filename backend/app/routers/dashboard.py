from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ..schemas.dashboard import DashboardSummary, MonthlyTrendPoint, AlertItem
from ..services.dashboard_service import DashboardService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    return DashboardService.get_summary(db)

@router.get("/sales", response_model=List[MonthlyTrendPoint])
def get_sales_trends(db: Session = Depends(get_db)):
    return DashboardService.get_sales_trends(db)

@router.get("/inventory")
def get_dashboard_inventory(db: Session = Depends(get_db)):
    from ..services.inventory_service import InventoryService
    return InventoryService.get_summary(db)

@router.get("/insights", response_model=List[AlertItem])
def get_dashboard_insights(db: Session = Depends(get_db)):
    return DashboardService.get_insights(db)
