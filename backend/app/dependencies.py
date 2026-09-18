from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import CoilScan, User, get_db, india_now
from app.config import (
    VALID_SHIFTS, VALID_ROLES, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS,
    DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD,
    DEFAULT_EMPLOYEE_USERNAME, DEFAULT_EMPLOYEE_PASSWORD
)
from app.schemas import UserResponse, RecordResponse

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def normalize_shift(shift: Optional[str]) -> str:
    value = (shift or "General Shift").strip()
    if value not in VALID_SHIFTS:
        return "General Shift"
    return value

def normalize_pipeline(pipeline: Optional[str]) -> str:
    value = (pipeline or "ocr").strip().lower()
    if value in {"manual", "edited", "roi-hybrid", "roi_hybrid", "roi hybrid", "csv-upload", "csv_upload", "csv import", "csv-import"}:
        return value.replace("_", "-").replace(" ", "-")
    if value in {"fast", "ocr", "paddle", "easyocr", "roi"}:
        return value
    return value or "ocr"

def normalize_role(role: Optional[str]) -> str:
    value = (role or "employee").strip().lower()
    if value not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Role must be admin or employee")
    return value

def validate_password(password: str) -> str:
    value = (password or "").strip()
    if len(value) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    return value

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)

def create_access_token(user: User) -> str:
    expire = india_now() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        must_change_password=bool(getattr(user, "must_change_password", False)),
    )

def create_default_users(db: Session) -> None:
    if DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD:
        admin = db.query(User).filter(User.username == DEFAULT_ADMIN_USERNAME).first()
        if not admin:
            db.add(
                User(
                    username=DEFAULT_ADMIN_USERNAME,
                    full_name="System Administrator",
                    email="admin@steelscan.local",
                    hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
                    role="admin",
                    is_active=True,
                    must_change_password=False,
                )
            )

    if DEFAULT_EMPLOYEE_USERNAME and DEFAULT_EMPLOYEE_PASSWORD:
        employee = db.query(User).filter(User.username == DEFAULT_EMPLOYEE_USERNAME).first()
        if not employee:
            db.add(
                User(
                    username=DEFAULT_EMPLOYEE_USERNAME,
                    full_name="Plant Operator",
                    email="employee@steelscan.local",
                    hashed_password=hash_password(DEFAULT_EMPLOYEE_PASSWORD),
                    role="employee",
                    is_active=True,
                    must_change_password=False,
                )
            )
    db.commit()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise auth_error
    except JWTError:
        raise auth_error

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise auth_error
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user

def record_to_response(record: CoilScan) -> RecordResponse:
    return RecordResponse(
        id=record.id,
        code=record.coil_code,
        success=record.success,
        confidence=record.confidence,
        vote_count=record.vote_count,
        total_votes=record.total_votes,
        latency_ms=record.latency_ms,
        pipeline=record.pipeline,
        shift=record.shift or "General Shift",
        created_by_username=record.created_by_username,
        message=record.message,
        created_at=record.created_at,
        raw_image_url=record.raw_image_url,
        processed_image_url=record.processed_image_url,
        source_type=getattr(record, "source_type", None),
        source_file_name=getattr(record, "source_file_name", None),
        source_record_id=getattr(record, "source_record_id", None),
        uploaded_by=getattr(record, "uploaded_by", None),
        uploaded_at=getattr(record, "uploaded_at", None),
    )

def normalize_csv_header(value: Optional[str]) -> str:
    return str(value or "").strip().lower().replace("_", " ")

def csv_get(row: dict, *names: str) -> str:
    for name in names:
        key = normalize_csv_header(name)
        if key in row:
            value = row.get(key)
            return "" if value is None else str(value).strip()
    return ""

def parse_csv_datetime(date_value: str, time_value: str) -> Optional[datetime]:
    date_value = str(date_value or "").strip()
    time_value = str(time_value or "").strip()
    if not date_value or not time_value:
        return None
    combined = f"{date_value} {time_value}"
    formats = [
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
        "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M",
        "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M",
        "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(combined, fmt)
        except ValueError:
            pass
    return None

def parse_csv_confidence(value: str) -> float:
    text = str(value or "").strip()
    if not text or text in {"—", "-", "null", "None"}:
        return 0.0
    text = text.replace("%", "").strip()
    try:
        number = float(text)
    except ValueError:
        return 0.0
    if number > 1:
        number = number / 100.0
    if number < 0:
        return 0.0
    if number > 1:
        return 1.0
    return round(number, 4)
