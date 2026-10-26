from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...database import get_db
from ..schemas.what_if import (
    WhatIfSimulationRequest,
    WhatIfSimulationResponse,
    WhatIfScenarioCreate,
    WhatIfScenarioResponse
)
from ..services.what_if_service import WhatIfService
from ..models.user import User
from ..core.deps import get_current_user, require_role

router = APIRouter(prefix="/api/what-if", tags=["What-If Simulation"])

SCENARIO_ROLES = ["Retail Pricing Manager", "Senior Merchandising Analyst", "Store Operations Director", "Admin"]

@router.post("/simulate", response_model=WhatIfSimulationResponse)
def simulate_pricing(payload: WhatIfSimulationRequest, db: Session = Depends(get_db)):
    try:
        return WhatIfService.simulate(
            db=db,
            sku_or_id=payload.sku or payload.product_id,
            simulated_price=payload.simulated_price,
            competitor_offset=payload.competitor_offset or 0.0,
            elasticity_multiplier=payload.elasticity_multiplier or 1.0,
            promo_discount=payload.promo_discount or 0.0
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Simulation error: {str(e)}")

@router.get("/scenarios", response_model=List[WhatIfScenarioResponse])
def get_saved_scenarios(db: Session = Depends(get_db)):
    return WhatIfService.get_scenarios(db)

@router.post("/scenarios", response_model=WhatIfScenarioResponse, status_code=status.HTTP_201_CREATED)
def save_scenario(
    payload: WhatIfScenarioCreate,
    current_user: User = Depends(require_role(SCENARIO_ROLES)),
    db: Session = Depends(get_db)
):
    try:
        return WhatIfService.create_scenario(db, payload)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save scenario: {str(e)}")

@router.delete("/scenarios/{scenario_id}")
def delete_scenario(
    scenario_id: str,
    current_user: User = Depends(require_role(SCENARIO_ROLES)),
    db: Session = Depends(get_db)
):
    deleted = WhatIfService.delete_scenario(db, scenario_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scenario with ID '{scenario_id}' not found.")
    return {"success": True, "message": "Scenario deleted successfully."}
