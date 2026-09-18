import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import ALLOWED_TYPES, UPLOAD_DIR
from app.database import User, get_db
from app.dependencies import get_current_user
from app.schemas import ScanResponse
from app.services.ocr_service import OcrResult, detect_text
from app.state import _ocr_lock, _stats

log = logging.getLogger("coil_api")

router = APIRouter(tags=["scan"])

@router.post("/scan", response_model=ScanResponse)
async def scan(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ct = (file.content_type or "").lower().split(";")[0].strip()
    if ct not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: '{ct}'. Accepted: {', '.join(sorted(ALLOWED_TYPES))}",
        )

    if not _ocr_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=429,
            detail="OCR engine is busy. Another scan is currently being processed. Please wait and try again.",
        )

    suffix = Path(file.filename or "upload.jpg").suffix or ".jpg"
    tmp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(contents) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large. Max 20 MB.")

        tmp_path.write_bytes(contents)

        log.info(f"User={current_user.username} acquired OCR lock → {tmp_path.name} ({len(contents):,} bytes)")

        result: OcrResult = await run_in_threadpool(detect_text, str(tmp_path), db)

    except HTTPException:
        raise
    except Exception as exc:
        log.exception(f"OCR pipeline error: {exc}")
        raise HTTPException(status_code=500, detail=f"OCR error: {str(exc)}")
    finally:
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError as exc:
            log.warning(f"Could not delete temp file {tmp_path}: {exc}")
        
        _ocr_lock.release()
        log.info(f"User={current_user.username} released OCR lock")

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
        message="OK" if result.success else "No valid code detected",
    )
