from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...database import get_db
from ..schemas.reports import ReportsSummaryResponse
from ..services.report_service import ReportService

router = APIRouter(prefix="/api/reports", tags=["Reports & Analytics"])

@router.get("/summary", response_model=ReportsSummaryResponse)
def get_reports_summary(db: Session = Depends(get_db)):
    return ReportService.get_summary(db)

@router.get("/sales")
def get_reports_sales(db: Session = Depends(get_db)):
    summary = ReportService.get_summary(db)
    return {
        "store_breakdown": summary["store_breakdown"],
        "category_breakdown": summary["category_breakdown"]
    }

@router.get("/pricing")
def get_reports_pricing(db: Session = Depends(get_db)):
    summary = ReportService.get_summary(db)
    return summary["pricing_compliance"]

@router.get("/inventory")
def get_reports_inventory(db: Session = Depends(get_db)):
    summary = ReportService.get_summary(db)
    return summary["inventory_health"]
