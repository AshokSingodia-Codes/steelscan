"""
scan.py — Authenticated Industrial Coil OCR Scan Endpoint
"""

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from slowapi import Limiter
from sqlalchemy.orm import Session

from app.config import SCAN_RATE_LIMIT, UPLOAD_DIR
from app.database import User, get_db
from app.dependencies import get_current_user, get_scan_rate_limit_key, validate_image_upload
from app.schemas import ScanResponse
from app.services.ocr_service import OcrResult, detect_text
from app.state import _ocr_lock, _stats

log = logging.getLogger("coil_api")

limiter = Limiter(key_func=get_scan_rate_limit_key)
router = APIRouter(tags=["scan"])


@router.post("/scan", response_model=ScanResponse)
@limiter.limit(SCAN_RATE_LIMIT)
async def scan(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authenticated OCR endpoint for coil code extraction.
    Performs strict image format, magic bytes, size, and dimension validation.
    Rate-limited per authenticated user ID.
    """
    if not _ocr_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=429,
            detail="OCR engine is busy processing another request. Please retry in a few seconds.",
        )

    suffix = Path(file.filename or "upload.jpg").suffix or ".jpg"
    tmp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"

    try:
        contents = await file.read()
        
        # Comprehensive Pillow & MIME validation (checks dimensions before decode & verifies file structure)
        width, height, img_format = validate_image_upload(file, contents)

        tmp_path.write_bytes(contents)
        log.info(
            f"User '{current_user.username}' submitted {img_format} image ({width}x{height}, {len(contents):,} bytes) → {tmp_path.name}"
        )

        result: OcrResult = await run_in_threadpool(detect_text, str(tmp_path), db)

    except HTTPException:
        raise
    except Exception as exc:
        log.exception(f"OCR pipeline internal error: {exc}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(exc)}")
    finally:
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError as exc:
            log.warning(f"Could not delete temporary image {tmp_path}: {exc}")

        _ocr_lock.release()

    _stats["requests"] += 1
    _stats["total_latency_ms"] += result.latency_ms
    if result.success:
        _stats["success"] += 1

    return ScanResponse(
        success=result.success,
        code=result.code or None,
        confidence=round(result.confidence, 3),
        vote_count=result.vote_count,
        total_votes=result.total_votes,
        latency_ms=round(result.latency_ms, 1),
        pipeline=result.pipeline_used,
        message="OK" if result.success else "No valid coil code detected",
    )
