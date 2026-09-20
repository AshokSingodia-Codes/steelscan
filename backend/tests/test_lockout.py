"""
test_lockout.py — Brute Force Account Lockout Tests
"""

import pytest


def test_brute_force_lockout(client, employee_user):
    username = employee_user.username

    # 4 incorrect attempts
    for _ in range(4):
        res = client.post("/auth/login", json={"username": username, "password": "WrongPassword!"})
        assert res.status_code == 401

    # 5th incorrect attempt triggers lockout (or SlowAPI rate limit 429)
    res = client.post("/auth/login", json={"username": username, "password": "WrongPassword!"})
    assert res.status_code == 429
    data = res.json()
    assert "detail" in data
    assert (
        "temporarily locked" in data["detail"].lower()
        or "too many failed" in data["detail"].lower()
        or "rate limit" in data["detail"].lower()
    )

    # Even with the correct password, login is blocked during lockout
    res_correct = client.post("/auth/login", json={"username": username, "password": "EmpPass123!"})
    assert res_correct.status_code == 429
