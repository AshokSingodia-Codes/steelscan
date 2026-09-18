import csv
import io
import logging
from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.database import CoilScan, User, get_db, india_now
from app.dependencies import (
    csv_get, get_current_user, normalize_csv_header, normalize_pipeline,
    normalize_shift, parse_csv_confidence, parse_csv_datetime,
    record_to_response, require_admin
)
from app.schemas import (
    DeleteDateResponse, DeleteMonthResponse, RecordResponse, SaveRecordRequest
)

log = logging.getLogger("coil_api")

router = APIRouter(tags=["records"])

@router.post("/admin/upload-records")
async def upload_records_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    filename = file.filename or "uploaded_records.csv"
    lower_name = filename.lower()

    if not lower_name.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV file upload is allowed for record import.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="CSV file too large. Max 10 MB.")

    try:
        text = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV encoding error. Please save CSV as UTF-8.")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file has no header row.")

    normalized_headers = {normalize_csv_header(header) for header in reader.fieldnames}
    has_code = bool({"coil code", "code", "coil_code"} & normalized_headers)
    has_date = "date" in normalized_headers
    has_time = "time" in normalized_headers

    if not has_code or not has_date or not has_time:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain required columns: Coil Code, Date, Time. Optional columns: ID, Employee ID, Method, Shift, Confidence.",
        )

    imported_count = 0
    skipped_count = 0
    errors = []
    uploaded_at_value = india_now()

    try:
        for row_index, raw_row in enumerate(reader, start=2):
            row = {normalize_csv_header(key): value for key, value in raw_row.items()}
            source_record_id = csv_get(row, "id", "ID")
            coil_code = csv_get(row, "coil code", "code", "coil_code")
            employee_id = csv_get(row, "employee id", "employee", "created_by_username")
            original_method = csv_get(row, "method")
            shift = csv_get(row, "shift")
            date_value = csv_get(row, "date")
            time_value = csv_get(row, "time")
            confidence_value = csv_get(row, "confidence")

            coil_code = coil_code.strip()
            if not coil_code:
                skipped_count += 1
                errors.append(f"Row {row_index}: Coil Code is missing.")
                continue

            if len(coil_code) < 4 or len(coil_code) > 32:
                skipped_count += 1
                errors.append(f"Row {row_index}: Coil Code length should be 4 to 32 characters.")
                continue

            created_at_value = parse_csv_datetime(date_value, time_value)
            if not created_at_value:
                skipped_count += 1
                errors.append(f"Row {row_index}: Invalid Date/Time. Use DD/MM/YYYY or YYYY-MM-DD with HH:MM:SS.")
                continue

            employee_id = employee_id.strip()
            if not employee_id or employee_id in {"—", "-"}:
                employee_id = current_user.username

            final_shift = normalize_shift(shift)
            confidence = parse_csv_confidence(confidence_value)
            message_parts = ["Imported old industrial record by admin"]
            if original_method:
                message_parts.append(f"Original method: {original_method}")
            if source_record_id:
                message_parts.append(f"Source CSV ID: {source_record_id}")

            record = CoilScan(
                coil_code=coil_code,
                success=True,
                confidence=confidence,
                vote_count=0,
                total_votes=0,
                latency_ms=0.0,
                pipeline="csv-upload",
                shift=final_shift,
                created_by_username=employee_id,
                message=". ".join(message_parts),
                created_at=created_at_value,
                source_type="CSV_UPLOAD",
                source_file_name=filename,
                source_record_id=source_record_id or None,
                uploaded_by=current_user.username,
                uploaded_at=uploaded_at_value,
            )
            db.add(record)
            imported_count += 1

        db.commit()
    except Exception as exc:
        db.rollback()
        log.exception(f"CSV import failed: {exc}")
        raise HTTPException(status_code=500, detail=f"CSV import failed: {str(exc)}")

    return {
        "success": True,
        "message": "CSV records imported successfully.",
        "file_name": filename,
        "required_columns": ["Coil Code", "Date", "Time"],
        "optional_columns": ["ID", "Employee ID", "Method", "Shift", "Confidence"],
        "imported_count": imported_count,
        "skipped_count": skipped_count,
        "errors": errors[:50],
    }

@router.post("/records")
def save_record(
    data: SaveRecordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = (data.code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Code is required.")

    record = CoilScan(
        coil_code=code,
        success=data.success,
        confidence=data.confidence,
        vote_count=data.vote_count,
        total_votes=data.total_votes,
        latency_ms=data.latency_ms,
        pipeline=normalize_pipeline(data.pipeline),
        shift=normalize_shift(data.shift),
        created_by_username=current_user.username,
        message=data.message,
        source_type="DAILY_RECORD",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "id": record.id,
        "shift": record.shift,
        "saved_by": record.created_by_username,
    }

@router.get("/records", response_model=List[RecordResponse])
def get_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(CoilScan).order_by(CoilScan.id.desc()).all()
    return [record_to_response(r) for r in rows]

@router.delete("/records/month", response_model=DeleteMonthResponse)
def delete_records_by_month(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(CoilScan).filter(
        extract("year", CoilScan.created_at) == year,
        extract("month", CoilScan.created_at) == month,
    )
    deleted_count = query.count()
    if deleted_count == 0:
        return DeleteMonthResponse(
            success=True, deleted=0, year=year, month=month,
            message=f"No records found for {year}-{month:02d}.",
        )
    query.delete(synchronize_session=False)
    db.commit()
    return DeleteMonthResponse(
        success=True, deleted=deleted_count, year=year, month=month,
        message=f"Deleted {deleted_count} records from {year}-{month:02d}.",
    )

@router.delete("/records/date", response_model=DeleteDateResponse)
def delete_records_by_date(
    target_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = datetime.combine(target_date, datetime.max.time())

    query = db.query(CoilScan).filter(
        CoilScan.created_at >= start_dt,
        CoilScan.created_at <= end_dt,
    )
    deleted_count = query.count()
    if deleted_count == 0:
        return DeleteDateResponse(
            success=True, deleted=0, date=target_date,
            message=f"No records found for {target_date}.",
        )
    query.delete(synchronize_session=False)
    db.commit()
    return DeleteDateResponse(
        success=True, deleted=deleted_count, date=target_date,
        message=f"Deleted {deleted_count} records from {target_date}.",
    )

@router.delete("/records/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(CoilScan).filter(CoilScan.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if current_user.role != "admin":
        if record.created_by_username != current_user.username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can delete only records created by your own account.",
            )

    db.delete(record)
    db.commit()

    return {
        "success": True,
        "deleted_id": record_id,
        "deleted_by": current_user.username,
    }
