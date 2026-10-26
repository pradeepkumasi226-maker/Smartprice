from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ...database import get_db
from ..schemas.forecast import ForecastResponse, SeasonalityDriver, ProductForecastSummary
from ..services.forecast_service import ForecastService

router = APIRouter(prefix="/api/forecast", tags=["Demand Forecasting"])

@router.get("", response_model=ForecastResponse)
def get_demand_forecast(
    time_range: str = Query("7d", description="Time range: 7d, 30d, 90d"),
    sku: Optional[str] = Query(None, description="Optional product SKU filter"),
    db: Session = Depends(get_db)
):
    return ForecastService.get_demand_forecast(db, time_range=time_range, sku=sku)

@router.get("/products", response_model=List[ProductForecastSummary])
def get_product_forecast_summaries(
    time_range: str = Query("7d", description="Time range: 7d, 30d, 90d"),
    db: Session = Depends(get_db)
):
    return ForecastService.get_product_forecast_summaries(db, time_range=time_range)

@router.get("/seasonality", response_model=List[SeasonalityDriver])
def get_seasonality_drivers():
    return ForecastService.get_seasonality_drivers()

