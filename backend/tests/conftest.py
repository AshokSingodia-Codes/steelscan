"""
conftest.py — Pytest Configuration, In-Memory DB Fixtures, and Test Clients
"""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test_secret_key_0123456789abcdef0123456789abcdef"

from app.database import Base, User, get_db
from app.dependencies import hash_password, create_access_token, create_refresh_token
from app.main import app

from app.routes.auth import limiter as auth_limiter
from app.routes.scan import limiter as scan_limiter

# Test Engine & Session
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def reset_rate_limits():
    try:
        auth_limiter._storage.reset()
    except Exception:
        pass
    try:
        scan_limiter._storage.reset()
    except Exception:
        pass
    yield
    try:
        auth_limiter._storage.reset()
    except Exception:
        pass
    try:
        scan_limiter._storage.reset()
    except Exception:
        pass


@pytest.fixture
def db():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db):
    user = User(
        username="admin_test",
        full_name="Admin Test",
        email="admin_test@steelscan.local",
        hashed_password=hash_password("AdminPass123!"),
        role="admin",
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def employee_user(db):
    user = User(
        username="emp_test",
        full_name="Employee Test",
        email="emp_test@steelscan.local",
        hashed_password=hash_password("EmpPass123!"),
        role="employee",
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def must_change_user(db):
    user = User(
        username="forced_user",
        full_name="Forced User",
        email="forced@steelscan.local",
        hashed_password=hash_password("TemporaryPass123!"),
        role="employee",
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    return create_access_token(admin_user)


@pytest.fixture
def employee_token(employee_user):
    return create_access_token(employee_user)


@pytest.fixture
def must_change_token(must_change_user):
    return create_access_token(must_change_user)
