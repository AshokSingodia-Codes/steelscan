"""
image_record.py — Deprecated legacy model.

This project now uses:
    app.database.CoilScan

Correct workflow:
    POST /scan     -> OCR only
    POST /records  -> save confirmed scan
    GET /records   -> fetch saved scans

Do not import ImageRecord in new code.
"""

from app.database import CoilScan

ImageRecord = CoilScan