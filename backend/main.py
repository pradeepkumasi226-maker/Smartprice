from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .config import settings
from .database import engine, Base
from .app import models
from .app.seed.seed_data import seed_database
from .app.routers import (
    auth_router,
    dashboard_router,
    products_router,
    inventory_router,
    pricing_router,
    what_if_router,
    forecast_router,
    shap_router,
    reports_router
)

@asynccontextmanager
async def lifespan(app):
    # Enforce safe startup: fail safely if production secrets are missing/insecure
    settings.validate_production_secrets()

    # Startup: create tables and seed
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(products)")).fetchall()]
            if "dynamic_pricing" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN dynamic_pricing BOOLEAN DEFAULT 1"))
                conn.commit()
            user_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
            if "password_hash" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
                conn.commit()
            if "password_changed_at" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_changed_at DATETIME"))
                conn.commit()
    except Exception as e:
        print(f"[Startup Warning] database migration check: {e}")
    seed_database(force=False)
    yield
    # Shutdown (nothing needed)

import logging
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("smartprice.app")

docs_url = None if settings.ENVIRONMENT == "production" else "/docs"
redoc_url = None if settings.ENVIRONMENT == "production" else "/redoc"
openapi_url = None if settings.ENVIRONMENT == "production" else "/openapi.json"

app = FastAPI(
    title="SmartPrice Explainable AI Retail Engine API",
    description="Real-time dynamic pricing, inventory tracking, demand forecasting, and TreeSHAP explainability engine.",
    version="3.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
    lifespan=lifespan
)

# Exception handling: Avoid exposing internal exception tracebacks in production
@app.exception_handler(Exception)
async def production_exception_handler(request: Request, exc: Exception):
    logger.error(f"[Unhandled Error] {request.method} {request.url.path}: {exc}", exc_info=True)
    if settings.ENVIRONMENT == "production":
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal error occurred while processing the request."}
        )
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# CORS configuration: Restrict production to configured trusted origins
if settings.ENVIRONMENT == "production":
    origins = [settings.FRONTEND_URL]
    if settings.ALLOWED_ORIGINS:
        origins.extend([o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()])
else:
    origins = [
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Register routers
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(pricing_router)
app.include_router(what_if_router)
app.include_router(forecast_router)
app.include_router(shap_router)
app.include_router(reports_router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "SmartPrice AI Retail Backend",
        "version": "3.0.0",
        "docs": "/docs" if settings.ENVIRONMENT != "production" else None
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "database": "sqlite"
    }

@app.get("/api/health")
def api_health_check():
    return {
        "status": "ok",
        "service": "SmartPrice API"
    }
