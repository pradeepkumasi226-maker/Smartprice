from .auth import router as auth_router
from .dashboard import router as dashboard_router
from .products import router as products_router
from .inventory import router as inventory_router
from .pricing import router as pricing_router
from .what_if import router as what_if_router
from .forecast import router as forecast_router
from .shap import router as shap_router
from .reports import router as reports_router

__all__ = [
    "auth_router",
    "dashboard_router",
    "products_router",
    "inventory_router",
    "pricing_router",
    "what_if_router",
    "forecast_router",
    "shap_router",
    "reports_router"
]
