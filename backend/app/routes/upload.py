"""
upload.py — Authenticated Legacy OCR Endpoint (Deprecated: Use POST /scan)
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR
from app.database import User, get_db
from app.dependencies import get_current_user, validate_image_upload
from app.schemas import ScanResponse
from app.services.ocr_service import OcrResult, detect_text
from app.state import _ocr_lock, _stats

log = logging.getLogger("coil_api")

router = APIRouter(tags=["legacy-upload"])


@router.post("/upload", response_model=ScanResponse, deprecated=True)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deprecated legacy upload endpoint.
    Protected under authentication and strict validation. Directs clients to use /scan.
    """
    if not _ocr_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=429,
            detail="OCR engine is busy. Please retry in a few seconds.",
        )

    suffix = Path(file.filename or "upload.jpg").suffix or ".jpg"
    tmp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"

    try:
        contents = await file.read()
        width, height, img_format = validate_image_upload(file, contents)
        tmp_path.write_bytes(contents)

        log.info(
            f"[legacy-upload] User '{current_user.username}' submitted {img_format} image ({width}x{height}) → {tmp_path.name}"
        )

        result: OcrResult = await run_in_threadpool(detect_text, str(tmp_path), db)

    except HTTPException:
        raise
    except Exception as exc:
        log.exception(f"[legacy-upload] OCR pipeline error: {exc}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(exc)}")
    finally:
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError as exc:
            log.warning(f"[legacy-upload] Could not delete temp file {tmp_path}: {exc}")

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
        message="OK (legacy endpoint; please migrate to /scan)" if result.success else "No valid code detected",
    )