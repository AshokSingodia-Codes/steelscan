"""
main.py — FastAPI application entry point

Local run:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Render start command:
uvicorn app.main:app --host 0.0.0.0 --port $PORT
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables, get_db
from app.dependencies import create_default_users
from app.config import ALLOWED_ORIGINS
from app.schemas import HealthResponse, MetricsResponse
from app.state import _start_time, _stats

# Import routers
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.scan import router as scan_router
from app.routes.records import router as records_router
from app.routes.upload import router as upload_router


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
    log.info("Coil OCR service starting up")
    create_tables()
    db = next(get_db())
    try:
        create_default_users(db)
    finally:
        db.close()
    yield
    log.info("Coil OCR service shutting down")


app = FastAPI(
    title="Industrial Coil OCR API",
    version="5.0.0",
    description="Factory-grade OCR for steel coil identification codes",
    lifespan=lifespan,
)

cors_kwargs = {
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

if ALLOWED_ORIGINS == ["*"]:
    cors_kwargs["allow_origins"] = ["*"]
    cors_kwargs["allow_credentials"] = False
else:
    cors_kwargs["allow_origins"] = ALLOWED_ORIGINS
    cors_kwargs["allow_credentials"] = True

app.add_middleware(
    CORSMiddleware,
    **cors_kwargs,
)

# Include routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(scan_router)
app.include_router(records_router)
app.include_router(upload_router)

# =====================================================
# BASIC ROUTES — PUBLIC
# =====================================================

@app.get("/")
def root():
    return {
        "status": "running",
        "version": "5.0.0",
        "auth": "enabled",
        "roles": ["admin", "employee"],
        "record_traceability": "created_by_username + source_type enabled",
        "cors": ALLOWED_ORIGINS,
    }

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        uptime_s=round(time.time() - _start_time, 1),
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