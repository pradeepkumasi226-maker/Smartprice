from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ...database import get_db
from ..schemas.inventory import RestockRequest, BatchRestockRequest, InventoryTransactionResponse, InventorySummary
from ..services.inventory_service import InventoryService
from ..services.product_service import ProductService
from ..models.user import User
from ..core.deps import get_current_user, require_role

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])

INVENTORY_ROLES = ["Retail Operations Manager", "Store Operations Director", "Retail Pricing Manager", "Admin"]

@router.get("", response_model=Dict[str, Any])
def get_inventory_overview(db: Session = Depends(get_db)):
    summary = InventoryService.get_summary(db)
    products = ProductService.get_products(db)
    transactions = InventoryService.get_transactions(db, limit=50)
    return {
        "summary": summary,
        "products": products,
        "logs": transactions
    }

@router.get("/summary", response_model=InventorySummary)
def get_inventory_summary(db: Session = Depends(get_db)):
    return InventoryService.get_summary(db)

@router.get("/transactions", response_model=List[InventoryTransactionResponse])
def get_inventory_transactions(limit: int = 50, db: Session = Depends(get_db)):
    return InventoryService.get_transactions(db, limit=limit)

@router.get("/{sku}")
def get_product_inventory(sku: str, db: Session = Depends(get_db)):
    product = ProductService.get_product_by_sku(db, sku)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product with SKU '{sku}' not found.")
    return product

@router.post("/{sku}/restock")
def restock_product(
    sku: str,
    payload: RestockRequest,
    current_user: User = Depends(require_role(INVENTORY_ROLES)),
    db: Session = Depends(get_db)
):
    try:
        acting_user = current_user.name or current_user.identifier
        return InventoryService.restock(
            db=db,
            sku_or_id=sku,
            quantity=payload.quantity,
            user=acting_user,
            notes=payload.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Restock failed: {str(e)}")

@router.post("/batch-restock")
def batch_restock_products(
    payload: BatchRestockRequest,
    current_user: User = Depends(require_role(INVENTORY_ROLES)),
    db: Session = Depends(get_db)
):
    try:
        acting_user = current_user.name or current_user.identifier
        return InventoryService.batch_restock(
            db=db,
            product_ids=payload.product_ids,
            quantity=payload.quantity,
            user=acting_user
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Batch restock failed: {str(e)}")

@router.delete("/transactions/{tx_id}")
def delete_inventory_transaction(
    tx_id: str,
    reconcile_stock: bool = True,
    current_user: User = Depends(require_role(INVENTORY_ROLES)),
    db: Session = Depends(get_db)
):
    acting_user = current_user.name or current_user.identifier
    result = InventoryService.delete_transaction(
        db=db,
        tx_id=tx_id,
        user=acting_user,
        reconcile_stock=reconcile_stock
    )
    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Transaction '{tx_id}' not found.")
    return result
