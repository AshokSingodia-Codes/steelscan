"""
auth.py — Authentication, Rate Limiting, Temporary Lockout, Token Rotation & Revocation
"""

import logging
from datetime import timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from slowapi import Limiter
from sqlalchemy.orm import Session

from app.config import LOGIN_LOCKOUT_MINUTES, LOGIN_MAX_ATTEMPTS
from app.database import User, get_db, india_now
from app.dependencies import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_real_client_ip,
    hash_password,
    revoke_all_user_refresh_tokens,
    user_to_response,
    validate_password,
    verify_and_rotate_refresh_token,
    verify_password,
)
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    UserResponse,
)

log = logging.getLogger("coil_api")

limiter = Limiter(key_func=get_real_client_ip)
router = APIRouter(prefix="/auth", tags=["auth"])

# Dummy hash for timing attack mitigation when username is not found
DUMMY_HASH = "$2b$12$e8Yh9Y6t2kGvjD3mO7c4ZuX6Z3oI4mQ6Jp8hV9f0b5d9Y6t2kGvjD"
try:
    DUMMY_HASH = hash_password("dummy_constant_time_salt_password_123!")
except Exception:
    pass


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    data: LoginRequest = Body(...),
    db: Session = Depends(get_db),
):
    """
    Authenticates user, checks temporary lockout, logs attempts, and issues
    a short-lived access token plus a DB-hashed rotating refresh token.
    """
    username = data.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()

    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password.",
    )

    if not user:
        # Prevent username enumeration via timing analysis
        verify_password(data.password, DUMMY_HASH)
        raise auth_error

    # Check for temporary account lockout
    if user.locked_until and user.locked_until > india_now():
        remaining = int((user.locked_until - india_now()).total_seconds() // 60) + 1
        log.warning(f"Login attempt on locked account '{username}' from {get_real_client_ip(request)}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account is temporarily locked due to excessive failed attempts. Please retry in {remaining} minute(s).",
        )

    if not verify_password(data.password, user.hashed_password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= LOGIN_MAX_ATTEMPTS:
            user.locked_until = india_now() + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
            db.commit()
            log.warning(f"Account '{username}' locked for {LOGIN_LOCKOUT_MINUTES}m after {LOGIN_MAX_ATTEMPTS} failed attempts.")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed login attempts. Account is locked for {LOGIN_LOCKOUT_MINUTES} minutes.",
            )
        db.commit()
        raise auth_error

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact your system administrator.",
        )

    # Reset lockout counters and record timestamp
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = india_now()
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user, db)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        must_change_password=bool(user.must_change_password),
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
@limiter.limit("20/minute")
def refresh_token(
    request: Request,
    data: RefreshTokenRequest = Body(...),
    db: Session = Depends(get_db),
):
    """
    Exchanges a valid refresh token for a fresh access token and rotated refresh token.
    Detects token reuse and invalidates compromised token families.
    """
    user, new_access_token, new_refresh_token = verify_and_rotate_refresh_token(data.refresh_token, db)

    return RefreshTokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revokes all active refresh tokens for the authenticated user session."""
    revoke_all_user_refresh_tokens(current_user.id, db)
    log.info(f"User '{current_user.username}' logged out. Revoked all active refresh tokens.")
    return {"success": True, "message": "Logged out successfully. All refresh tokens revoked."}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user's profile details."""
    return user_to_response(current_user)


@router.patch("/change-password", response_model=UserResponse)
def change_own_password(
    data: ChangePasswordRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allows an authenticated user to change their password, clearing must_change_password and revoking old refresh tokens."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect.",
        )

    new_password = validate_password(data.new_password)

    if verify_password(new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password.",
        )

    current_user.hashed_password = hash_password(new_password)
    current_user.must_change_password = False

    # Revoke all existing refresh tokens for security
    revoke_all_user_refresh_tokens(current_user.id, db)

    db.commit()
    db.refresh(current_user)

    log.info(f"User '{current_user.username}' successfully changed password. Revoked old refresh tokens.")
    return user_to_response(current_user)
