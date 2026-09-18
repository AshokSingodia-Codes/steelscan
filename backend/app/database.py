"""
database.py — Engine, models, session factory, and FastAPI dependency.
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    create_engine,
)
from sqlalchemy.orm import Session, sessionmaker, declarative_base


# =====================================================
# ENVIRONMENT
# =====================================================

load_dotenv()

LOCAL_DATABASE_URL = "mysql+pymysql://root:Ashok%40123@localhost/number_detection"

DATABASE_URL = os.getenv("DATABASE_URL", LOCAL_DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()

IST = timezone(timedelta(hours=5, minutes=30))


def india_now():
    """
    Returns current India time as timezone-naive datetime.

    MySQL DATETIME usually stores timezone-naive values,
    so we remove tzinfo before saving.
    """
    return datetime.now(IST).replace(tzinfo=None)


# =====================================================
# USER TABLE — ADMIN / EMPLOYEE AUTHENTICATION
# =====================================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    username = Column(
        String(80),
        unique=True,
        nullable=False,
        index=True,
    )

    full_name = Column(
        String(120),
        nullable=True,
    )

    email = Column(
        String(160),
        nullable=True,
    )

    hashed_password = Column(
        String(255),
        nullable=False,
    )

    role = Column(
        String(30),
        nullable=False,
        default="employee",
        index=True,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    must_change_password = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=india_now,
    )

    last_login_at = Column(
        DateTime,
        nullable=True,
    )


# =====================================================
# COIL SCANS TABLE
# =====================================================

class CoilScan(Base):
    __tablename__ = "coil_scans"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    coil_code = Column(
        String(128),
        nullable=True,
        index=True,
    )

    success = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    confidence = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    vote_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    total_votes = Column(
        Integer,
        nullable=False,
        default=0,
    )

    latency_ms = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    pipeline = Column(
        String(64),
        nullable=True,
    )

    message = Column(
        String(256),
        nullable=True,
    )

    raw_image_url = Column(
        String(512),
        nullable=True,
    )

    processed_image_url = Column(
        String(512),
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=india_now,
        index=True,
    )

    shift = Column(
        String(50),
        nullable=False,
        default="General Shift",
    )

    created_by_username = Column(
        String(80),
        nullable=True,
        index=True,
    )

    source_type = Column(
        String(50),
        nullable=True,
        index=True,
    )

    source_file_name = Column(
        String(255),
        nullable=True,
    )

    source_record_id = Column(
        String(80),
        nullable=True,
    )

    uploaded_by = Column(
        String(80),
        nullable=True,
        index=True,
    )

    uploaded_at = Column(
        DateTime,
        nullable=True,
    )


# =====================================================
# OCR FEEDBACK MEMORY — SELF-LEARNING REINFORCEMENT
# =====================================================

class OCRFeedbackMemory(Base):
    __tablename__ = "ocr_feedback_memory"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    raw_char = Column(
        String(10),
        nullable=False,
        index=True,
    )

    corrected_char = Column(
        String(10),
        nullable=False,
        index=True,
    )

    frequency_count = Column(
        Integer,
        nullable=False,
        default=1,
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        default=india_now,
    )


# =====================================================
# HELPERS
# =====================================================

def create_tables() -> None:
    """
    Creates missing tables only.

    Important:
    create_all creates new tables, but it does not add missing columns
    to existing tables. For existing DB, run ALTER TABLE manually.
    """
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()