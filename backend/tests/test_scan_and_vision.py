"""
test_scan_and_vision.py — /scan Rate Limiting, Vision AI Daily Quota Enforcement, and must_change_password Gate
"""

import io
from PIL import Image
import pytest
from app.database import VisionDailyUsage, india_now
from app.services.vision_ai_service import _check_and_increment_daily_vision_call, run_vision_ai_ocr


def _create_mock_image_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (300, 300), color="white").save(buf, format="JPEG")
    return buf.getvalue()


def test_must_change_password_blocks_scan(client, must_change_token):
    img_bytes = _create_mock_image_bytes()
    res = client.post(
        "/scan",
        headers={"Authorization": f"Bearer {must_change_token}"},
        files={"file": ("test.jpg", img_bytes, "image/jpeg")},
    )
    assert res.status_code == 403
    assert "Password change required" in res.json()["detail"]


def test_vision_daily_cap_records_and_falls_back(db):
    today = india_now().date()
    
    # 1. First call creates usage record with count=1
    allowed = _check_and_increment_daily_vision_call(db)
    assert allowed is True

    record = db.query(VisionDailyUsage).filter(VisionDailyUsage.usage_date == today).first()
    assert record is not None
    assert record.call_count >= 1

    # 2. Simulate cap reached
    record.call_count = 500
    db.commit()

    # 3. Subsequent check returns False (bypasses cloud and falls back to local)
    cap_reached = _check_and_increment_daily_vision_call(db)
    assert cap_reached is False

    # 4. run_vision_ai_ocr returns None to allow local pipeline fallback
    vision_res = run_vision_ai_ocr("nonexistent.jpg", db=db)
    assert vision_res is None


def test_scan_rate_limit_per_user(client, employee_token, monkeypatch):
    from app.services.ocr_service import OcrResult
    import app.routes.scan

    # Fast mock for detect_text to avoid slow PaddleOCR/EasyOCR initialization in rate limit test
    monkeypatch.setattr(
        app.routes.scan,
        "detect_text",
        lambda img_path, db=None: OcrResult(success=True, code="12345678", confidence=0.99, pipeline_used="test"),
    )

    img_bytes = _create_mock_image_bytes()

    responses = []
    for _ in range(25):
        res = client.post(
            "/scan",
            headers={"Authorization": f"Bearer {employee_token}"},
            files={"file": ("test.jpg", img_bytes, "image/jpeg")},
        )
        responses.append(res.status_code)

    assert 429 in responses, f"Expected 429 in response status codes, got: {responses}"
