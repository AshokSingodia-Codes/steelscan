"""
test_startup_and_config.py — Startup Fail-Fast Validations and Client IP Proxy Header Tests
"""

import os
import pytest
from starlette.datastructures import Headers
from starlette.requests import Request

from app.config import parse_origins
from app.database import User
from app.dependencies import create_default_users, get_real_client_ip


def _mock_request(client_host="192.168.1.50", headers=None):
    scope = {
        "type": "http",
        "client": (client_host, 12345),
        "headers": [(k.lower().encode("latin-1"), v.encode("latin-1")) for k, v in (headers or {}).items()],
    }
    return Request(scope)


def test_startup_fails_in_production_when_frontend_origin_wildcard_or_missing(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    
    with pytest.raises(RuntimeError) as exc_info:
        parse_origins("*")
    assert "Wildcard '*' CORS origin is not permitted in production" in str(exc_info.value)


def test_startup_fails_in_production_when_admin_password_missing(db, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ADMIN_PASSWORD", "")

    # Ensure no admin exists in DB
    db.query(User).filter(User.role == "admin").delete()
    db.commit()

    with pytest.raises(RuntimeError) as exc_info:
        create_default_users(db)
    assert "initial administrator must be configured via ADMIN_PASSWORD" in str(exc_info.value)


def test_client_ip_spoofed_headers_ignored_when_trust_off(monkeypatch):
    from app import config
    monkeypatch.setattr(config, "TRUST_PROXY_HEADERS", False)
    monkeypatch.setattr(config, "TRUST_CF_HEADER", False)

    req = _mock_request(
        client_host="198.51.100.2",
        headers={
            "X-Forwarded-For": "203.0.113.195, 70.41.3.18",
            "CF-Connecting-IP": "198.51.100.99",
            "X-Real-IP": "203.0.113.195",
        },
    )

    ip = get_real_client_ip(req)
    # Untrusted proxy headers must be ignored, returning real socket client host
    assert ip == "198.51.100.2"


def test_client_ip_extracted_when_trust_on(monkeypatch):
    from app import config
    monkeypatch.setattr(config, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(config, "PROXY_HOPS", 1)
    monkeypatch.setattr(config, "TRUST_CF_HEADER", False)

    req = _mock_request(
        client_host="10.0.0.1",
        headers={
            "X-Forwarded-For": "203.0.113.195, 198.51.100.4",
        },
    )

    # PROXY_HOPS=1 takes 1st from the right: 198.51.100.4
    ip = get_real_client_ip(req)
    assert ip == "198.51.100.4"


def test_cf_connecting_ip_when_trust_cf_true(monkeypatch):
    from app import config
    monkeypatch.setattr(config, "TRUST_CF_HEADER", True)

    req = _mock_request(
        client_host="10.0.0.1",
        headers={
            "CF-Connecting-IP": "203.0.113.55",
        },
    )

    ip = get_real_client_ip(req)
    assert ip == "203.0.113.55"
