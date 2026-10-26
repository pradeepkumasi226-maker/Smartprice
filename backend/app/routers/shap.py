from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ..schemas.shap import ShapGlobalFeature, ShapProductDecomposition
from ..services.shap_service import ShapService

router = APIRouter(tags=["Explainable AI / SHAP"])

@router.get("/api/ai-insights", response_model=List[ShapGlobalFeature])
def get_ai_insights_global(db: Session = Depends(get_db)):
    return ShapService.get_global_features(db)

@router.get("/api/ai-insights/{sku}", response_model=ShapProductDecomposition)
def get_ai_insights_product(sku: str, db: Session = Depends(get_db)):
    return ShapService.get_product_shap(db, sku)

@router.get("/api/shap/{sku}", response_model=ShapProductDecomposition)
def get_shap_decomposition(sku: str, db: Session = Depends(get_db)):
    return ShapService.get_product_shap(db, sku)
