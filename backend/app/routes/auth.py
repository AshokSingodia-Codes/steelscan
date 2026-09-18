from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import User, get_db, india_now
from app.schemas import LoginRequest, LoginResponse, UserResponse, ChangePasswordRequest
from app.dependencies import (
    get_current_user,
    verify_password,
    hash_password,
    validate_password,
    create_access_token,
    user_to_response,
)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=LoginResponse)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    username = data.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    user.last_login_at = india_now()
    db.commit()
    db.refresh(user)

    token = create_access_token(user)

    return LoginResponse(
        access_token=token,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        must_change_password=bool(user.must_change_password),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return user_to_response(current_user)


@router.patch("/change-password", response_model=UserResponse)
def change_own_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect",
        )

    new_password = validate_password(data.new_password)

    if verify_password(new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password",
        )

    current_user.hashed_password = hash_password(new_password)
    current_user.must_change_password = False

    db.commit()
    db.refresh(current_user)

    return user_to_response(current_user)
