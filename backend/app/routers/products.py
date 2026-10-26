from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ...database import get_db
from ..schemas.product import ProductResponse, ProductCreate, ProductUpdate, BatchProductRequest
from ..services.product_service import ProductService
from ..models.user import User
from ..core.deps import get_current_user, require_role

router = APIRouter(prefix="/api/products", tags=["Products"])

from ..models.product import Product
from ..models.pricing_decision import PricingDecision
from sqlalchemy import or_

PRODUCT_EDIT_ROLES = ["Retail Pricing Manager", "Store Operations Director", "Admin"]
PRODUCT_DELETE_ROLES = ["Store Operations Director", "Admin"]

@router.get("", response_model=List[ProductResponse])
def get_products(
    search: Optional[str] = Query(None, description="Search by name, SKU or category"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by stock status"),
    min_margin_pct: Optional[float] = Query(None, description="Configured minimum gross margin percentage"),
    db: Session = Depends(get_db)
):
    try:
        return ProductService.get_products(
            db, search=search, category=category, status=status, min_margin_pct=min_margin_pct
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/batch-delete")
def batch_delete_products(
    payload: BatchProductRequest,
    current_user: User = Depends(require_role(PRODUCT_DELETE_ROLES)),
    db: Session = Depends(get_db)
):
    deleted = ProductService.batch_delete_products(db, payload.product_ids)
    return {"success": True, "deleted_count": len(deleted), "deleted_skus": deleted}

@router.post("/batch-apply-ai-prices")
def batch_apply_ai_prices(
    payload: BatchProductRequest,
    current_user: User = Depends(require_role(PRODUCT_EDIT_ROLES)),
    db: Session = Depends(get_db)
):
    updated = ProductService.batch_apply_ai_prices(db, payload.product_ids)
    return {"success": True, "updated_count": len(updated), "products": updated}

@router.get("/{sku}/decisions")
def get_product_pricing_decisions(sku: str, db: Session = Depends(get_db)):
    """Inspect complete historical pricing decisions and executive overrides for a product."""
    product = db.query(Product).filter(or_(Product.sku == sku, Product.id == sku)).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with SKU or ID '{sku}' not found.")
    decisions = (
        db.query(PricingDecision)
        .filter(PricingDecision.product_id == product.id)
        .order_by(PricingDecision.created_at.desc())
        .all()
    )
    return [
        {
            "id": d.id,
            "product_id": d.product_id,
            "sku": product.sku,
            "previous_price": d.previous_price,
            "approved_price": d.approved_price,
            "decision": d.decision,
            "user": d.user,
            "created_at": d.created_at
        }
        for d in decisions
    ]

@router.get("/{sku}", response_model=ProductResponse)
def get_product(
    sku: str,
    min_margin_pct: Optional[float] = Query(None, description="Configured minimum gross margin percentage"),
    db: Session = Depends(get_db)
):
    try:
        product = ProductService.get_product_by_sku(db, sku, min_margin_pct=min_margin_pct)
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with SKU or ID '{sku}' not found.")
        return product
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    current_user: User = Depends(require_role(PRODUCT_EDIT_ROLES)),
    db: Session = Depends(get_db)
):
    return ProductService.create_product(db, payload)

@router.put("/{sku}", response_model=ProductResponse)
def update_product(
    sku: str,
    payload: ProductUpdate,
    current_user: User = Depends(require_role(PRODUCT_EDIT_ROLES)),
    db: Session = Depends(get_db)
):
    updated = ProductService.update_product(db, sku, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with SKU or ID '{sku}' not found.")
    return updated

@router.delete("/{sku}")
def delete_product(
    sku: str,
    current_user: User = Depends(require_role(PRODUCT_DELETE_ROLES)),
    db: Session = Depends(get_db)
):
    deleted = ProductService.delete_product(db, sku)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with SKU or ID '{sku}' not found.")
    return {"success": True, "message": f"Product '{sku}' deleted successfully."}
