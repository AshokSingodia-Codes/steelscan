"""
test_rbac.py — Role-Based Access Control, Last Admin Protection, and User Creation Tests
"""

import pytest
from app.database import User
from app.dependencies import hash_password


def test_employee_forbidden_on_admin_user_list(client, employee_token):
    res = client.get("/auth/users", headers={"Authorization": f"Bearer {employee_token}"})
    assert res.status_code == 403
    assert "Administrator privileges required" in res.json()["detail"]


def test_admin_allowed_on_admin_user_list(client, admin_token):
    res = client.get("/auth/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_employee_forbidden_on_csv_upload(client, employee_token):
    res = client.post(
        "/admin/upload-records",
        headers={"Authorization": f"Bearer {employee_token}"},
        files={"file": ("test.csv", b"Coil Code,Date,Time\n12345678,2026-09-20,12:00:00", "text/csv")},
    )
    assert res.status_code == 403


def test_must_change_password_blocks_operational_routes(client, must_change_token):
    # GET /records should be blocked
    res = client.get("/records", headers={"Authorization": f"Bearer {must_change_token}"})
    assert res.status_code == 403
    assert "Password change required" in res.json()["detail"]

    # GET /auth/me should be allowed
    res_me = client.get("/auth/me", headers={"Authorization": f"Bearer {must_change_token}"})
    assert res_me.status_code == 200


def test_deactivated_user_token_immediately_rejected(client, db, employee_user, employee_token):
    # 1. Active user can query /auth/me
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {employee_token}"})
    assert res.status_code == 200

    # 2. Deactivate user in database
    employee_user.is_active = False
    db.commit()

    # 3. Same token should now be rejected with 403 immediately
    res_after = client.get("/auth/me", headers={"Authorization": f"Bearer {employee_token}"})
    assert res_after.status_code == 403
    assert "inactive" in res_after.json()["detail"].lower()


def test_admin_cannot_deactivate_self(client, admin_user, admin_token):
    res = client.patch(
        f"/auth/users/{admin_user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False},
    )
    assert res.status_code == 400
    assert "Admin cannot deactivate own account" in res.json()["detail"]


def test_admin_cannot_demote_self(client, admin_user, admin_token):
    res = client.patch(
        f"/auth/users/{admin_user.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "employee"},
    )
    assert res.status_code == 400
    assert "Admin cannot remove own admin role" in res.json()["detail"]


def test_last_active_admin_cannot_be_deactivated_or_demoted(client, db, admin_user, admin_token):
    # Create a secondary admin who performs the action
    admin2 = User(
        username="admin_two",
        full_name="Admin Two",
        email="admin2@steelscan.local",
        hashed_password=hash_password("AdminTwoPass123!"),
        role="admin",
        is_active=True,
        must_change_password=False,
    )
    db.add(admin2)
    db.commit()
    db.refresh(admin2)

    # Deactivate admin2 so admin_user is now the LAST active admin
    admin2.is_active = False
    db.commit()

    # Try to deactivate admin_user -> Should fail (last remaining active admin)
    # Even if admin2 token was used, admin_user is the sole active admin
    res_deact = client.patch(
        f"/auth/users/{admin_user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False},
    )
    assert res_deact.status_code == 400

    # Try to demote admin_user -> Should fail
    res_demote = client.patch(
        f"/auth/users/{admin_user.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "employee"},
    )
    assert res_demote.status_code == 400


def test_duplicate_username_returns_409(client, admin_token, employee_user):
    res = client.post(
        "/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": employee_user.username,
            "password": "ValidNewPassword123!",
            "role": "employee",
        },
    )
    assert res.status_code == 409
    assert "Username already exists" in res.json()["detail"]


def test_duplicate_email_returns_409(client, admin_token, employee_user):
    res = client.post(
        "/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "username": "brand_new_unique_user",
            "password": "ValidNewPassword123!",
            "email": employee_user.email,
            "role": "employee",
        },
    )
    assert res.status_code == 409
    assert "Email already registered" in res.json()["detail"]
