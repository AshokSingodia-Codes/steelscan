"""
upload.py — legacy OCR-only upload endpoint.

Workflow:
- /upload runs OCR only
- /upload does NOT save to database
- Database saving happens only from POST /records
  when frontend user clicks Save & Continue
"""

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, Depends
from sqlalchemy.orm import Session

from app.services.ocr_service import OcrResult, detect_text
from app.database import get_db

log = logging.getLogger("coil_api")

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024

ALLOWED_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


@router.post("/upload")
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    ct = (file.content_type or "").lower().split(";")[0].strip()

    if ct not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported media type: '{ct}'. "
                f"Accepted: {', '.join(sorted(ALLOWED_TYPES))}"
            ),
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB).")

    ext = Path(file.filename or "upload.jpg").suffix or ".jpg"
    tmp_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"

    try:
        tmp_path.write_bytes(contents)
        log.info(f"[upload] Saved temp → {tmp_path.name} ({len(contents):,} bytes)")

        result: OcrResult = detect_text(str(tmp_path), db=db)

    except Exception as exc:
        log.exception(f"[upload] OCR pipeline error: {exc}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(exc)}")

    finally:
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError as exc:
            log.warning(f"[upload] Could not delete temp file {tmp_path}: {exc}")

    return {
        "success": result.success,
        "code": result.code or None,
        "confidence": round(result.confidence, 3),
        "vote_count": result.vote_count,
        "total_votes": result.total_votes,
        "latency_ms": round(result.latency_ms, 1),
        "pipeline": result.pipeline_used,
        "message": "OK" if result.success else "No valid code detected",
    }