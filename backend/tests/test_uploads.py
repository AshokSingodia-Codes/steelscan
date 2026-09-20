"""
test_uploads.py — Image Upload Validation & Pillow Security Tests
"""

import io
from PIL import Image
import pytest


def test_upload_validator_valid_jpeg(client, admin_token):
    img_buf = io.BytesIO()
    Image.new("RGB", (200, 200), color="blue").save(img_buf, format="JPEG")
    img_bytes = img_buf.getvalue()

    from app.dependencies import validate_image_upload
    from fastapi import UploadFile

    mock_file = UploadFile(filename="coil.jpg", file=io.BytesIO(img_bytes), headers={"content-type": "image/jpeg"})
    w, h, fmt = validate_image_upload(mock_file, img_bytes)
    assert (w, h) == (200, 200)
    assert fmt == "JPEG"


def test_upload_validator_rejects_corrupted_file():
    from app.dependencies import validate_image_upload
    from fastapi import HTTPException, UploadFile

    bad_file = UploadFile(filename="fake.jpg", file=io.BytesIO(b"NOT_A_REAL_IMAGE"), headers={"content-type": "image/jpeg"})
    with pytest.raises(HTTPException) as exc_info:
        validate_image_upload(bad_file, b"NOT_A_REAL_IMAGE")
    assert exc_info.value.status_code == 400
    assert "Corrupted or invalid image file" in exc_info.value.detail


def test_upload_validator_rejects_invalid_mime():
    from app.dependencies import validate_image_upload
    from fastapi import HTTPException, UploadFile

    bad_file = UploadFile(filename="script.sh", file=io.BytesIO(b"echo 1"), headers={"content-type": "application/x-sh"})
    with pytest.raises(HTTPException) as exc_info:
        validate_image_upload(bad_file, b"echo 1")
    assert exc_info.value.status_code == 415


def test_oversized_file_upload_rejected():
    from app.dependencies import validate_image_upload
    from fastapi import HTTPException, UploadFile

    # 6 MB of dummy data
    oversized_bytes = b"0" * (6 * 1024 * 1024)
    file_obj = UploadFile(filename="huge.jpg", file=io.BytesIO(oversized_bytes), headers={"content-type": "image/jpeg"})
    with pytest.raises(HTTPException) as exc_info:
        validate_image_upload(file_obj, oversized_bytes)
    assert exc_info.value.status_code == 413
    assert "File too large" in exc_info.value.detail


def test_oversized_image_dimensions_rejected():
    from app.dependencies import validate_image_upload
    from fastapi import HTTPException, UploadFile

    # Create image with dimensions 5000x5000 (exceeds default 4096px limit)
    img_buf = io.BytesIO()
    Image.new("RGB", (5000, 5000), color="white").save(img_buf, format="JPEG")
    img_bytes = img_buf.getvalue()

    file_obj = UploadFile(filename="dimensions.jpg", file=io.BytesIO(img_bytes), headers={"content-type": "image/jpeg"})
    with pytest.raises(HTTPException) as exc_info:
        validate_image_upload(file_obj, img_bytes)
    assert exc_info.value.status_code == 400
    assert "exceed maximum allowed dimensions" in exc_info.value.detail


def test_unauthenticated_scan_rejected(client):
    res = client.post("/scan")
    assert res.status_code in {401, 403}
