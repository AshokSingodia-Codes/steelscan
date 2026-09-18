from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import User, get_db
from app.schemas import (
    UserResponse, CreateUserRequest, UpdateUserStatusRequest,
    UpdateUserRequest, ResetUserPasswordRequest
)
from app.dependencies import (
    require_admin,
    hash_password,
    validate_password,
    normalize_role,
    user_to_response,
)

router = APIRouter(prefix="/auth/users", tags=["users"])

@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    users = db.query(User).order_by(User.id.asc()).all()
    return [user_to_response(user) for user in users]


@router.post("", response_model=UserResponse)
def create_user(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    username = data.username.strip().lower()
    password = validate_password(data.password)
    role = normalize_role(data.role)

    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    if " " in username:
        raise HTTPException(status_code=400, detail="Username must not contain spaces")

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Username already exists")

    user = User(
        username=username,
        full_name=data.full_name.strip() if data.full_name else None,
        email=data.email.strip() if data.email else None,
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
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id and data.is_active is False:
        raise HTTPException(status_code=400, detail="Admin cannot deactivate own account")

    user.is_active = data.is_active
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
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.full_name is not None:
        user.full_name = data.full_name.strip() or None

    if data.email is not None:
        user.email = data.email.strip() or None

    if data.role is not None:
        role = normalize_role(data.role)
        if user.id == current_user.id and role != "admin":
            raise HTTPException(status_code=400, detail="Admin cannot remove own admin role")
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
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_password = validate_password(data.new_password)

    user.hashed_password = hash_password(new_password)
    user.must_change_password = bool(data.force_change)

    db.commit()
    db.refresh(user)

    return user_to_response(user)
