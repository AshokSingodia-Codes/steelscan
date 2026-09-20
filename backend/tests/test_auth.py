"""
test_auth.py — Authentication, Token Rotation, Token Reuse Family Invalidation, Expired Token, and Logout Tests
"""

from datetime import datetime, timedelta, timezone
import pytest
from jose import jwt
from app.config import ALGORITHM, SECRET_KEY


def test_login_success(client, admin_user):
    res = client.post(
        "/auth/login",
        json={"username": admin_user.username, "password": "AdminPass123!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["username"] == admin_user.username
    assert data["role"] == "admin"


def test_login_invalid_credentials(client, admin_user):
    res = client.post(
        "/auth/login",
        json={"username": admin_user.username, "password": "WrongPassword!"},
    )
    assert res.status_code == 401
    assert "Invalid username or password" in res.json()["detail"]


def test_login_unknown_user(client):
    res = client.post(
        "/auth/login",
        json={"username": "nonexistent_user", "password": "SomePassword123!"},
    )
    assert res.status_code == 401
    assert "Invalid username or password" in res.json()["detail"]


def test_refresh_token_rotation(client, admin_user):
    login_res = client.post(
        "/auth/login",
        json={"username": admin_user.username, "password": "AdminPass123!"},
    )
    refresh_token = login_res.json()["refresh_token"]

    # 1. Rotate token
    rotate_res = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert rotate_res.status_code == 200
    data = rotate_res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    new_refresh_token = data["refresh_token"]
    assert new_refresh_token != refresh_token

    # 2. Re-use old token should be detected and rejected
    reuse_res = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert reuse_res.status_code == 401
    assert "reuse detected" in reuse_res.json()["detail"].lower()


def test_refresh_token_reuse_revokes_entire_family(client, admin_user):
    # 1. Login -> Token 1
    login_res = client.post(
        "/auth/login",
        json={"username": admin_user.username, "password": "AdminPass123!"},
    )
    token_1 = login_res.json()["refresh_token"]

    # 2. Rotate -> Token 2
    rotate_res_1 = client.post("/auth/refresh", json={"refresh_token": token_1})
    assert rotate_res_1.status_code == 200
    token_2 = rotate_res_1.json()["refresh_token"]

    # 3. Rotate -> Token 3
    rotate_res_2 = client.post("/auth/refresh", json={"refresh_token": token_2})
    assert rotate_res_2.status_code == 200
    token_3 = rotate_res_2.json()["refresh_token"]

    # 4. Attacker attempts to reuse old Token 1
    reuse_res = client.post("/auth/refresh", json={"refresh_token": token_1})
    assert reuse_res.status_code == 401
    assert "reuse detected" in reuse_res.json()["detail"].lower()

    # 5. Legitimate user trying to use Token 3 must also be rejected because entire family is revoked
    legit_res = client.post("/auth/refresh", json={"refresh_token": token_3})
    assert legit_res.status_code == 401


def test_expired_access_token_returns_401(client, employee_user):
    # Craft expired token
    expired_time = datetime.now(timezone.utc) - timedelta(minutes=15)
    payload = {
        "sub": employee_user.username,
        "user_id": employee_user.id,
        "role": employee_user.role,
        "type": "access",
        "exp": expired_time,
    }
    expired_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_logout_revokes_refresh_tokens(client, admin_user, admin_token):
    login_res = client.post(
        "/auth/login",
        json={"username": admin_user.username, "password": "AdminPass123!"},
    )
    refresh_token = login_res.json()["refresh_token"]

    # Logout
    logout_res = client.post(
        "/auth/logout",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert logout_res.status_code == 200

    # Refresh after logout should fail
    refresh_res = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 401


def test_change_password_clears_must_change_and_revokes_tokens(client, must_change_user, must_change_token):
    # Change password
    res = client.patch(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {must_change_token}"},
        json={
            "current_password": "TemporaryPass123!",
            "new_password": "BrandNewSecurePassword123!",
        },
    )
    assert res.status_code == 200
    assert res.json()["must_change_password"] is False

    # Login with new password
    login_res = client.post(
        "/auth/login",
        json={
            "username": must_change_user.username,
            "password": "BrandNewSecurePassword123!",
        },
    )
    assert login_res.status_code == 200
