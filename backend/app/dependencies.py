"""
dependencies.py — Security Utilities, Token Management with Rotation & Hashing, RBAC, and Image Validation
"""

import hashlib
import io
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional, Tuple

from fastapi import Depends, HTTPException, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ADMIN_PASSWORD,
    ADMIN_USERNAME,
    ALGORITHM,
    ALLOWED_MIME_TYPES,
    APP_ENV,
    MAX_IMAGE_HEIGHT,
    MAX_IMAGE_WIDTH,
    MAX_UPLOAD_BYTES,
    PASSWORD_BLACKLIST,
    PROXY_HOPS,
    REFRESH_TOKEN_EXPIRE_DAYS,
    SECRET_KEY,
    TRUST_CF_HEADER,
    TRUST_PROXY_HEADERS,
    VALID_ROLES,
    VALID_SHIFTS,
)
from app.database import CoilScan, RefreshToken, User, get_db, india_now
from app.schemas import RecordResponse, UserResponse

log = logging.getLogger("coil_api")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Prevent Pillow decompression bomb denial-of-service attacks
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_WIDTH * MAX_IMAGE_HEIGHT * 2


# =====================================================
# CLIENT IP EXTRACTION (REVERSE PROXY AWARE & SECURED)
# =====================================================

def get_real_client_ip(request: Request) -> str:
    """
    Extract client IP address respecting configured reverse proxy trust settings.
    - If TRUST_CF_HEADER is true, reads CF-Connecting-IP.
    - If TRUST_PROXY_HEADERS is true, extracts the entry from X-Forwarded-For counting from the right by PROXY_HOPS.
    - Otherwise, falls back strictly to request.client.host (ignoring untrusted forwarded headers).
    """
    from app import config

    if getattr(config, "TRUST_CF_HEADER", False):
        cf_ip = request.headers.get("CF-Connecting-IP")
        if cf_ip and cf_ip.strip():
            return cf_ip.strip()

    if getattr(config, "TRUST_PROXY_HEADERS", False):
        xff = request.headers.get("X-Forwarded-For")
        if xff and xff.strip():
            ips = [item.strip() for item in xff.split(",") if item.strip()]
            if ips:
                hops = getattr(config, "PROXY_HOPS", 1)
                target_idx = max(0, len(ips) - hops)
                return ips[target_idx]

        x_real_ip = request.headers.get("X-Real-IP")
        if x_real_ip and x_real_ip.strip():
            return x_real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def get_scan_rate_limit_key(request: Request) -> str:
    """
    Returns user ID as the rate limit key for authenticated /scan requests.
    Falls back to client IP if unauthenticated.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("user_id") or payload.get("sub")
            if user_id:
                return f"user:{user_id}"
        except Exception:
            pass

    return f"ip:{get_real_client_ip(request)}"


# =====================================================
# PASSWORD & AUTH UTILITIES
# =====================================================

def validate_password(password: str) -> str:
    """
    Validate password strength:
    - Minimum 10 characters long.
    - Refuses common weak/blacklisted passwords.
    """
    value = (password or "").strip()
    if len(value) < 10:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 10 characters long.",
        )
    if value.lower() in PASSWORD_BLACKLIST:
        raise HTTPException(
            status_code=400,
            detail="Password is too common and weak. Please choose a more complex password.",
        )
    return value


def hash_password(password: str) -> str:
    """Hash plaintext password with bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time bcrypt password verification."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def hash_token(raw_token: str) -> str:
    """Computes SHA-256 hash for database token storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# =====================================================
# TOKEN GENERATION, ROTATION & REVOCATION
# =====================================================

def create_access_token(user: User) -> str:
    """Generate short-lived JWT access token."""
    expire = india_now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user.username,
        "user_id": user.id,
        "role": user.role,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user: User, db: Session, family_id: Optional[str] = None) -> str:
    """
    Generate cryptographically secure refresh token, store SHA-256 hash in DB,
    and associate with a family_id for rotation & reuse detection.
    """
    raw_token = secrets.token_urlsafe(48)
    token_digest = hash_token(raw_token)
    token_family = family_id or str(uuid.uuid4())
    expires_at = india_now() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    token_record = RefreshToken(
        user_id=user.id,
        token_hash=token_digest,
        family_id=token_family,
        is_revoked=False,
        expires_at=expires_at,
        created_at=india_now(),
    )
    db.add(token_record)
    db.commit()

    return raw_token


def verify_and_rotate_refresh_token(raw_token: str, db: Session) -> Tuple[User, str, str]:
    """
    Verify refresh token against DB hashes:
    - If token is revoked: Trigger reuse detection, revoke all tokens in family, and raise 401.
    - If valid: Revoke old token and issue new rotated access + refresh token pair.
    """
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token. Please log in again.",
    )

    if not raw_token or not raw_token.strip():
        raise auth_error

    token_digest = hash_token(raw_token.strip())
    token_record = db.query(RefreshToken).filter(RefreshToken.token_hash == token_digest).first()

    if not token_record:
        raise auth_error

    # REUSE DETECTION: Old revoked token was submitted!
    if token_record.is_revoked:
        log.warning(
            f"SECURITY ALERT: Refresh token reuse detected for user_id={token_record.user_id}, family={token_record.family_id}. "
            "Invalidating all tokens in family chain."
        )
        db.query(RefreshToken).filter(
            RefreshToken.family_id == token_record.family_id,
            RefreshToken.is_revoked == False,
        ).update({"is_revoked": True, "revoked_at": india_now()})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session security violation: token reuse detected. All active sessions in this family were revoked. Please log in again.",
        )

    # Check expiration
    if token_record.expires_at < india_now():
        token_record.is_revoked = True
        token_record.revoked_at = india_now()
        db.commit()
        raise auth_error

    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user or not user.is_active:
        raise auth_error

    # Revoke used refresh token (Rotation)
    token_record.is_revoked = True
    token_record.revoked_at = india_now()
    db.commit()

    # Issue fresh access token and rotated refresh token within the same family
    new_access_token = create_access_token(user)
    new_refresh_token = create_refresh_token(user, db, family_id=token_record.family_id)

    return user, new_access_token, new_refresh_token


def revoke_all_user_refresh_tokens(user_id: int, db: Session) -> None:
    """Revokes all active refresh tokens for a user (used upon logout, deactivation, or password change)."""
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.is_revoked == False,
    ).update({"is_revoked": True, "revoked_at": india_now()})
    db.commit()


def user_to_response(user: User) -> UserResponse:
    """Convert User ORM instance to UserResponse schema."""
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        must_change_password=bool(getattr(user, "must_change_password", False)),
    )


# =====================================================
# INITIAL USER SEEDING (ENV ONLY)
# =====================================================

def create_default_users(db: Session) -> None:
    """
    Seeds the initial admin account strictly from environment variables,
    and only if no administrator exists in the database.
    In production mode, raises a RuntimeError if no admin exists and ADMIN_PASSWORD is missing.
    """
    admin_exists = db.query(User).filter(User.role == "admin").first() is not None
    if admin_exists:
        return

    admin_pwd = os.getenv("ADMIN_PASSWORD", ADMIN_PASSWORD).strip()
    admin_user = os.getenv("ADMIN_USERNAME", ADMIN_USERNAME).strip().lower()
    app_env = os.getenv("APP_ENV", APP_ENV).strip().lower()

    if not admin_pwd:
        if app_env == "production":
            raise RuntimeError(
                "CRITICAL STARTUP ERROR: In production mode, an initial administrator must be configured "
                "via ADMIN_PASSWORD environment variable because no admin account exists in the database."
            )
        log.warning(
            "ADMIN_PASSWORD environment variable is not set and no administrator exists in database. "
            "Set ADMIN_USERNAME and ADMIN_PASSWORD in environment to provision initial administrator."
        )
        return

    # Validate password strength for initial admin
    try:
        validated_pwd = validate_password(admin_pwd)
    except HTTPException as exc:
        raise RuntimeError(
            f"CRITICAL STARTUP ERROR: Configured ADMIN_PASSWORD does not meet security requirements: {exc.detail}"
        )

    db.add(
        User(
            username=admin_user,
            full_name="System Administrator",
            email="admin@steelscan.local",
            hashed_password=hash_password(validated_pwd),
            role="admin",
            is_active=True,
            must_change_password=True,
        )
    )
    db.commit()
    log.info(f"Initialized administrator account '{admin_user}' (password change required on first login).")


# =====================================================
# AUTHENTICATION & RBAC DEPENDENCIES
# =====================================================

ALLOWED_UNVERIFIED_PATHS = {
    "/auth/change-password",
    "/auth/logout",
    "/auth/me",
}

def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Extracts and validates JWT Bearer access token.
    Enforces that the user is active in the database on EVERY request.
    Enforces server-side must_change_password check on all operational routes.
    """
    token = credentials.credentials
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token. Please log in again.",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") not in {None, "access"}:
            raise auth_error
        username = payload.get("sub")
        if not username:
            raise auth_error
    except JWTError:
        raise auth_error

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise auth_error

    # Rejection of deactivated/inactive users on EVERY request
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact your system administrator.",
        )

    # Server-side enforcement of password change requirement
    path = request.url.path
    if user.must_change_password and path not in ALLOWED_UNVERIFIED_PATHS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required: You must change your default/temporary password before accessing system resources.",
        )

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Enforce Administrator role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator privileges required.",
        )
    return current_user


# =====================================================
# IMAGE UPLOAD VALIDATION (SECURITY & PILLOW)
# =====================================================

def validate_image_upload(file: UploadFile, contents: bytes) -> Tuple[int, int, str]:
    """
    Validates uploaded image file against size, MIME, magic bytes, dimensions, and decompression bombs.
    Returns (width, height, format).
    """
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(contents):,} bytes). Maximum permitted size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type '{content_type}'. Allowed types: {', '.join(sorted(ALLOWED_MIME_TYPES))}",
        )

    try:
        # Inspect dimensions from header before decoding full image stream
        with Image.open(io.BytesIO(contents)) as img:
            width, height = img.size
            img_format = str(img.format)

            if width > MAX_IMAGE_WIDTH or height > MAX_IMAGE_HEIGHT:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image dimensions ({width}x{height}) exceed maximum allowed dimensions ({MAX_IMAGE_WIDTH}x{MAX_IMAGE_HEIGHT}).",
                )

            # Verify image structural integrity
            img.verify()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Corrupted or invalid image file. Please upload a valid JPEG, PNG, or WebP image.",
        ) from exc

    return width, height, img_format


# =====================================================
# DOMAIN NORMALIZERS
# =====================================================

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
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'employee'")
    return value


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
