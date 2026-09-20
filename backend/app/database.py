"""
database.py — Database Engine, SQLAlchemy Models, Session Dependency, and Table Migrations
"""

import os
from datetime import datetime, timezone, timedelta, date
from typing import Generator

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    text,
)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker
from app.config import DATABASE_URL

# =====================================================
# ENGINE & SESSION CONFIGURATION
# =====================================================

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()

IST = timezone(timedelta(hours=5, minutes=30))


def india_now() -> datetime:
    """
    Returns current India Standard Time as a timezone-naive datetime.
    Compatible with SQLite, MySQL, and PostgreSQL DATETIME columns.
    """
    return datetime.now(IST).replace(tzinfo=None)


# =====================================================
# USER TABLE — RBAC & SECURITY
# =====================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=True)
    email = Column(String(160), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, default="employee", index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    must_change_password = Column(Boolean, nullable=False, default=True)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=india_now)
    last_login_at = Column(DateTime, nullable=True)

    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


# =====================================================
# REFRESH TOKENS TABLE — ROTATION & REUSE DETECTION
# =====================================================

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    family_id = Column(String(64), nullable=False, index=True)
    is_revoked = Column(Boolean, nullable=False, default=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=india_now)
    revoked_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="refresh_tokens")


# =====================================================
# VISION AI DAILY USAGE TRACKER (PERSISTENT & ATOMIC)
# =====================================================

class VisionDailyUsage(Base):
    __tablename__ = "vision_daily_usage"

    usage_date = Column(Date, primary_key=True, index=True)
    call_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False, default=india_now)


# =====================================================
# COIL SCANS TABLE
# =====================================================

class CoilScan(Base):
    __tablename__ = "coil_scans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    coil_code = Column(String(128), nullable=True, index=True)
    success = Column(Boolean, nullable=False, default=False)
    confidence = Column(Float, nullable=False, default=0.0)
    vote_count = Column(Integer, nullable=False, default=0)
    total_votes = Column(Integer, nullable=False, default=0)
    latency_ms = Column(Float, nullable=False, default=0.0)
    pipeline = Column(String(64), nullable=True)
    message = Column(String(256), nullable=True)
    raw_image_url = Column(String(512), nullable=True)
    processed_image_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, nullable=False, default=india_now, index=True)
    shift = Column(String(50), nullable=False, default="General Shift")
    created_by_username = Column(String(80), nullable=True, index=True)
    source_type = Column(String(50), nullable=True, index=True)
    source_file_name = Column(String(255), nullable=True)
    source_record_id = Column(String(80), nullable=True)
    uploaded_by = Column(String(80), nullable=True, index=True)
    uploaded_at = Column(DateTime, nullable=True)


# =====================================================
# OCR FEEDBACK MEMORY — SELF-LEARNING REINFORCEMENT
# =====================================================

class OCRFeedbackMemory(Base):
    __tablename__ = "ocr_feedback_memory"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    raw_char = Column(String(10), nullable=False, index=True)
    corrected_char = Column(String(10), nullable=False, index=True)
    frequency_count = Column(Integer, nullable=False, default=1)
    updated_at = Column(DateTime, nullable=False, default=india_now)


# =====================================================
# SCHEMA CREATION HELPER
# =====================================================

def create_tables() -> None:
    """Creates all database tables defined in metadata."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()