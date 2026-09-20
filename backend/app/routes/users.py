"""
users.py — User Management, Account Status Controls, and RBAC Administration
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import User, get_db
from app.dependencies import (
    hash_password,
    normalize_role,
    require_admin,
    revoke_all_user_refresh_tokens,
    user_to_response,
    validate_password,
)
from app.schemas import (
    CreateUserRequest,
    ResetUserPasswordRequest,
    UpdateUserRequest,
    UpdateUserStatusRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth/users", tags=["users"])


@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all registered user accounts (Admin Only)."""
    users = db.query(User).order_by(User.id.asc()).all()
    return [user_to_response(user) for user in users]


@router.post("", response_model=UserResponse)
def create_user(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Create a new user account with temporary password (Admin Only)."""
    username = data.username.strip().lower()
    password = validate_password(data.password)
    role = normalize_role(data.role)

    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    if " " in username:
        raise HTTPException(status_code=400, detail="Username must not contain spaces")

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    # Check for duplicate username
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    # Check for duplicate email if provided
    email = data.email.strip() if data.email else None
    if email:
        existing_email = db.query(User).filter(User.email == email).first()
        if existing_email:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        username=username,
        full_name=data.full_name.strip() if data.full_name else None,
        email=email,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
        must_change_password=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user_to_response(user)


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    data: UpdateUserStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Activate or deactivate a user account (Admin Only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id and data.is_active is False:
        raise HTTPException(status_code=400, detail="Admin cannot deactivate own account")

    # Safeguard: prevent deactivation of the last active administrator
    if user.role == "admin" and data.is_active is False:
        active_admin_count = (
            db.query(User).filter(User.role == "admin", User.is_active == True).count()
        )
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot deactivate the last remaining active administrator account.",
            )

    user.is_active = data.is_active

    # Deactivating user revokes all their active sessions
    if data.is_active is False:
        revoke_all_user_refresh_tokens(user.id, db)

    db.commit()
    db.refresh(user)

    return user_to_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user_details(
    user_id: int,
    data: UpdateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update user profile information or role (Admin Only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.full_name is not None:
        user.full_name = data.full_name.strip() or None

    if data.email is not None:
        email = data.email.strip() or None
        if email:
            existing_email = db.query(User).filter(User.email == email, User.id != user_id).first()
            if existing_email:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        user.email = email

    if data.role is not None:
        role = normalize_role(data.role)
        if user.id == current_user.id and role != "admin":
            raise HTTPException(status_code=400, detail="Admin cannot remove own admin role")

        # Safeguard: prevent demoting the last active administrator
        if user.role == "admin" and role != "admin":
            active_admin_count = (
                db.query(User).filter(User.role == "admin", User.is_active == True).count()
            )
            if active_admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot demote the last remaining active administrator account.",
                )

        user.role = role

    db.commit()
    db.refresh(user)

    return user_to_response(user)


@router.patch("/{user_id}/password", response_model=UserResponse)
def reset_user_password(
    user_id: int,
    data: ResetUserPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Reset a user's password and force password change on next login (Admin Only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_password = validate_password(data.new_password)

    user.hashed_password = hash_password(new_password)
    user.must_change_password = bool(data.force_change)

    # Invalidate all active sessions for the reset user
    revoke_all_user_refresh_tokens(user.id, db)

    db.commit()
    db.refresh(user)

    return user_to_response(user)
