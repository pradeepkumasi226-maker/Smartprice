from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ...database import get_db
from ..schemas.shap import ShapGlobalFeature, ShapProductDecomposition
from ..services.shap_service import ShapService

router = APIRouter(tags=["Explainable AI / SHAP"])

@router.get("/api/ai-insights", response_model=List[ShapGlobalFeature])
def get_ai_insights_global(db: Session = Depends(get_db)):
    return ShapService.get_global_features(db)

@router.get("/api/ai-insights/{sku}", response_model=ShapProductDecomposition)
def get_ai_insights_product(
    sku: str,
    target_price: Optional[float] = Query(None, description="Optional target price to explain"),
    min_margin_pct: Optional[float] = Query(None, description="Configured minimum gross margin percentage"),
    db: Session = Depends(get_db)
):
    return ShapService.get_product_shap(db, sku, target_price=target_price, min_margin_pct=min_margin_pct)

@router.get("/api/shap/{sku}", response_model=ShapProductDecomposition)
def get_shap_decomposition(
    sku: str,
    target_price: Optional[float] = Query(None, description="Optional target price to explain"),
    min_margin_pct: Optional[float] = Query(None, description="Configured minimum gross margin percentage"),
    db: Session = Depends(get_db)
):
    return ShapService.get_product_shap(db, sku, target_price=target_price, min_margin_pct=min_margin_pct)
