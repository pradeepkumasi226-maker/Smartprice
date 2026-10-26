from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ...database import get_db
from ..schemas.pricing import (
    PricingRecommendationResponse,
    PriceApprovalRequest,
    ElasticityCurveResponse,
    PricingEngineGenerateRequest
)
from ..services.pricing_service import PricingService
from ..models.user import User
from ..core.deps import get_current_user, require_role

router = APIRouter(prefix="/api/pricing", tags=["Pricing Optimization"])

EXECUTIVE_ROLES = ["Store Operations Director", "Admin", "Executive VP"]
PRICING_ROLES = ["Retail Pricing Manager", "Store Operations Director", "Admin", "Executive VP"]
ANALYST_AND_PRICING_ROLES = ["Retail Pricing Manager", "Senior Merchandising Analyst", "Store Operations Director", "Admin", "Executive VP"]

@router.get("/recommendations", response_model=List[PricingRecommendationResponse])
def get_pricing_recommendations(
    include_all: bool = Query(False, description="Whether to include recommendations for all products in catalog"),
    min_margin_pct: Optional[float] = Query(None, description="Minimum margin guardrail percentage"),
    max_price_change_pct: Optional[float] = Query(None, description="Maximum price shift percentage"),
    allow_below_cost: Optional[bool] = Query(False, description="Explicit rule to allow selling below cost"),
    db: Session = Depends(get_db)
):
    guardrails = {}
    if min_margin_pct is not None:
        guardrails["min_margin_pct"] = min_margin_pct
    if max_price_change_pct is not None:
        guardrails["max_price_change_pct"] = max_price_change_pct
    if allow_below_cost is not None:
        guardrails["allow_below_cost"] = allow_below_cost

    try:
        return PricingService.get_recommendations(db, include_all=include_all, guardrails=guardrails)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/generate", response_model=List[PricingRecommendationResponse])
def generate_pricing_recommendations(
    payload: PricingEngineGenerateRequest = PricingEngineGenerateRequest(),
    current_user: User = Depends(require_role(PRICING_ROLES)),
    db: Session = Depends(get_db)
):
    """
    Run Dynamic Pricing Engine across all catalog products using configured guardrails.
    Protected operation: requires authenticated pricing manager or executive session.
    """
    if payload.allow_below_cost and current_user.role not in EXECUTIVE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Configuring below-cost pricing generation requires executive authorization (Store Operations Director or Admin)."
        )

    try:
        guardrails = {
            "min_margin_pct": payload.min_margin_pct if payload.min_margin_pct is not None else 5.0,
            "max_price_change_pct": payload.max_price_change_pct if payload.max_price_change_pct is not None else 30.0,
            "allow_below_cost": payload.allow_below_cost or False
        }
        return PricingService.generate_all_recommendations(db, guardrails=guardrails)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Dynamic Pricing Engine execution failed: {str(e)}")

@router.get("/{sku}/elasticity", response_model=ElasticityCurveResponse)
def get_elasticity_curve(sku: str, db: Session = Depends(get_db)):
    return PricingService.get_elasticity_curve(db, sku)

@router.post("/{sku}/approve")
def approve_pricing_recommendation(
    sku: str,
    payload: PriceApprovalRequest = PriceApprovalRequest(),
    allow_below_cost: bool = Query(False, description="Whether explicit business rule permits approving below cost"),
    current_user: User = Depends(require_role(PRICING_ROLES)),
    db: Session = Depends(get_db)
):
    """
    Approve pricing recommendation.
    Standard approval allowed for Retail Pricing Manager, Store Operations Director, Admin.
    Overrides below product cost strictly require Executive authorization (Store Operations Director or Admin).
    Actor identity is strictly bound to the authenticated server-side session.
    """
    if allow_below_cost and current_user.role not in EXECUTIVE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Below-cost pricing override requires executive authorization (Store Operations Director or Admin)."
        )

    try:
        acting_user = current_user.name or current_user.identifier
        return PricingService.approve_recommendation(
            db=db,
            sku_or_id=sku,
            approved_price=payload.approved_price,
            user=acting_user,
            allow_below_cost=allow_below_cost,
            override_reason=payload.override_reason
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Price approval failed: {str(e)}")

@router.post("/{sku}/reject")
def reject_pricing_recommendation(
    sku: str,
    payload: PriceApprovalRequest = PriceApprovalRequest(),
    current_user: User = Depends(require_role(PRICING_ROLES)),
    db: Session = Depends(get_db)
):
    try:
        acting_user = current_user.name or current_user.identifier
        return PricingService.reject_recommendation(
            db=db,
            sku_or_id=sku,
            user=acting_user
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Price rejection failed: {str(e)}")

@router.post("/{sku}/recalculate")
def recalculate_pricing_recommendation(
    sku: str,
    payload: Optional[PricingEngineGenerateRequest] = None,
    current_user: User = Depends(require_role(ANALYST_AND_PRICING_ROLES)),
    db: Session = Depends(get_db)
):
    if payload and payload.allow_below_cost and current_user.role not in EXECUTIVE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Below-cost recalculation requires executive authorization (Store Operations Director or Admin)."
        )

    try:
        guardrails = None
        if payload:
            guardrails = {
                "min_margin_pct": payload.min_margin_pct if payload.min_margin_pct is not None else 5.0,
                "max_price_change_pct": payload.max_price_change_pct if payload.max_price_change_pct is not None else 30.0,
                "allow_below_cost": payload.allow_below_cost or False
            }
        return PricingService.recalculate_recommendation(db=db, sku_or_id=sku, guardrails=guardrails)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Price recalculation failed: {str(e)}")
