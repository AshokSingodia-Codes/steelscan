"""
main.py — FastAPI application entry point, CORS configuration, and route registrations.
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import ALLOWED_ORIGINS
from app.database import create_tables, get_db
from app.dependencies import create_default_users
from app.routes.auth import limiter, router as auth_router
from app.routes.records import router as records_router
from app.routes.scan import router as scan_router
from app.routes.upload import router as upload_router
from app.routes.users import router as users_router
from app.schemas import HealthResponse, MetricsResponse
from app.state import _start_time, _stats

# =====================================================
# LOGGING
# =====================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("coil_api")


# =====================================================
# APP LIFESPAN
# =====================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.config import DATABASE_URL
    target = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else "local sqlite"
    log.info("Coil OCR service starting up (Database target: %s)", target)
    create_tables()
    db = next(get_db())
    try:
        create_default_users(db)
    finally:
        db.close()
    yield
    log.info("Coil OCR service shutting down")


app = FastAPI(
    title="STEELSCAN — Industrial Coil OCR API",
    version="5.1.0",
    description="Factory-grade OCR API for steel coil identification codes",
    lifespan=lifespan,
)

# Custom Rate Limiter Exception Handler
def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
    )

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_exceeded_handler)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(scan_router)
app.include_router(records_router)
app.include_router(upload_router)


# =====================================================
# BASIC PUBLIC ROUTES
# =====================================================

@app.get("/")
def root():
    return {
        "status": "running",
        "system": "STEELSCAN",
        "version": "5.1.0",
        "auth": "enabled",
        "roles": ["admin", "employee"],
        "cors_origins": ALLOWED_ORIGINS,
    }


@app.get("/health", response_model=HealthResponse)
def health():
    db_status = "connected"
    try:
        db = next(get_db())
        dialect = db.bind.dialect.name
        db.execute(text("SELECT 1"))
        db.close()
        
        # Check how DATABASE_URL was discovered
        env_raw = os.getenv("DATABASE_URL")
        if env_raw:
            masked = env_raw.split("@")[-1] if "@" in env_raw else "set"
            db_status = f"connected ({dialect} -> {masked})"
        else:
            db_status = f"connected ({dialect} - WARNING: DATABASE_URL env var not found in OS env)"
    except Exception as exc:
        db_status = f"error: {str(exc)}"

    return HealthResponse(
        status="ok" if db_status.startswith("connected") else "degraded",
        uptime_s=round(time.time() - _start_time, 1),
        database=db_status,
    )


@app.get("/metrics", response_model=MetricsResponse)
def metrics():
    n = _stats["requests"]
    s = _stats["success"]
    avg = (_stats["total_latency_ms"] / n) if n else 0.0

    return MetricsResponse(
        requests=n,
        success=s,
        success_rate=round(s / n, 3) if n else 0.0,
        avg_latency_ms=round(avg, 1),
    )