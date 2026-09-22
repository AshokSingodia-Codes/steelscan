"""
config.py — Central Application Configuration and Environment Parsing
"""

import os
import secrets
from pathlib import Path
from typing import List, Set
from dotenv import load_dotenv

load_dotenv()


def env_int(name: str, default: int) -> int:
    """Safely parse integer from environment variable with fallback."""
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


def env_bool(name: str, default: bool) -> bool:
    """Safely parse boolean from environment variable."""
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in {"true", "1", "yes", "on"}


def parse_origins(value: str) -> List[str]:
    """
    Parse comma-separated CORS origins.
    Refuses wildcard '*' in production/hardened environments.
    """
    raw = (value or "").strip()
    if not raw or raw == "*":
        if os.getenv("APP_ENV", "development").strip().lower() == "production":
            raise RuntimeError(
                "CRITICAL SECURITY ERROR: Wildcard '*' CORS origin is not permitted in production! "
                "Set FRONTEND_ORIGIN to your explicit frontend URL (e.g. https://steelscan.vercel.app)."
            )
        return ["http://localhost:3001", "http://127.0.0.1:3001"]
    return [item.strip() for item in raw.split(",") if item.strip()]


APP_ENV: str = os.getenv("APP_ENV", "development").strip().lower()

# =====================================================
# CORS & NETWORKING
# =====================================================

RAW_FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", os.getenv("CORS_ORIGINS", "")).strip()

if APP_ENV == "production" and (not RAW_FRONTEND_ORIGIN or RAW_FRONTEND_ORIGIN == "*"):
    raise RuntimeError(
        "CRITICAL SECURITY ERROR: In production mode, FRONTEND_ORIGIN must be explicitly set "
        "to your authorized frontend domain (e.g. 'https://steelscan.vercel.app'). Wildcards are strictly forbidden."
    )

FRONTEND_ORIGIN: str = RAW_FRONTEND_ORIGIN or "http://localhost:3001,http://127.0.0.1:3001"
ALLOWED_ORIGINS: List[str] = parse_origins(FRONTEND_ORIGIN)

# Reverse Proxy Trust Settings
TRUST_PROXY_HEADERS: bool = env_bool("TRUST_PROXY_HEADERS", False)
PROXY_HOPS: int = env_int("PROXY_HOPS", 1)
TRUST_CF_HEADER: bool = env_bool("TRUST_CF_HEADER", False)

# =====================================================
# SECURITY & JWT CONFIGURATION
# =====================================================

INSECURE_PLACEHOLDER_SECRETS: Set[str] = {
    "",
    "STEELSCAN_LOCAL_DEV_SECRET_CHANGE_BEFORE_DEPLOYMENT",
    "change-this-secret-before-deployment",
    "secret",
    "secretkey",
    "your-secret-key",
    "admin123",
    "password",
    "12345678",
}

RAW_SECRET_KEY: str = os.getenv("SECRET_KEY", "").strip()

if RAW_SECRET_KEY in INSECURE_PLACEHOLDER_SECRETS:
    if APP_ENV in {"test", "testing"}:
        SECRET_KEY: str = "test_only_secret_key_abcdefghijklmnopqrstuvwxyz_0123456789"
    elif APP_ENV == "development":
        import logging
        logging.getLogger("coil_api").warning(
            "WARNING: Insecure or missing SECRET_KEY! Generating an ephemeral random SECRET_KEY for this local development session."
        )
        SECRET_KEY = secrets.token_hex(32)
    else:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY is missing or using an insecure placeholder! "
            "Generate a secure 256-bit secret (e.g. 'openssl rand -hex 32') and configure SECRET_KEY in your environment."
        )
else:
    SECRET_KEY = RAW_SECRET_KEY

ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 60)
REFRESH_TOKEN_EXPIRE_DAYS: int = env_int("REFRESH_TOKEN_EXPIRE_DAYS", 7)

# Rate Limiting & Account Lockout
LOGIN_MAX_ATTEMPTS: int = env_int("LOGIN_MAX_ATTEMPTS", 5)
LOGIN_LOCKOUT_MINUTES: int = env_int("LOGIN_LOCKOUT_MINUTES", 15)
SCAN_RATE_LIMIT: str = os.getenv("SCAN_RATE_LIMIT", "20/minute")

# =====================================================
# ADMIN SEEDING CREDENTIALS (FROM ENV ONLY)
# =====================================================

ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin").strip().lower()
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "").strip()

# Password Blacklist for Weak Passwords
PASSWORD_BLACKLIST: Set[str] = {
    "admin123",
    "admin1234",
    "employee123",
    "password",
    "password123",
    "1234567890",
    "12345678",
    "adminadmin",
    "steelscan123",
    "qwerty1234",
    "steelscan",
}

# =====================================================
# DATABASE CONFIGURATION & URL NORMALIZATION
# =====================================================

def _clean_env_value(val: str | None) -> str:
    """Trim whitespace and strip accidental surrounding quotes."""
    if not val:
        return ""
    cleaned = val.strip()
    if (cleaned.startswith('"') and cleaned.endswith('"')) or (cleaned.startswith("'") and cleaned.endswith("'")):
        cleaned = cleaned[1:-1].strip()
    return cleaned


RAW_DATABASE_URL: str = (
    _clean_env_value(os.getenv("DATABASE_URL"))
    or _clean_env_value(os.getenv("DATABASE_URI"))
    or _clean_env_value(os.getenv("POSTGRES_URL"))
    or _clean_env_value(os.getenv("POSTGRESQL_URL"))
    or _clean_env_value(os.getenv("NEON_DATABASE_URL"))
    or "sqlite:///./steelscan.db"
)


def normalize_database_url(url: str) -> str:
    """Normalize provider URLs for SQLAlchemy + psycopg2 compatibility."""
    cleaned = _clean_env_value(url)
    if cleaned.startswith("postgres://"):
        cleaned = cleaned.replace("postgres://", "postgresql+psycopg2://", 1)
    elif cleaned.startswith("postgresql://") and not cleaned.startswith("postgresql+"):
        cleaned = cleaned.replace("postgresql://", "postgresql+psycopg2://", 1)
    
    # If channel_binding is present in query string, ensure it doesn't break older libpq
    if "channel_binding=" in cleaned and "sslmode=" not in cleaned:
        cleaned = cleaned.replace("channel_binding=require", "sslmode=require")
    return cleaned


DATABASE_URL: str = normalize_database_url(RAW_DATABASE_URL)

# =====================================================
# FILE UPLOAD CONSTRAINTS
# =====================================================

UPLOAD_DIR: Path = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_UPLOAD_BYTES: int = env_int("MAX_UPLOAD_BYTES", 5 * 1024 * 1024)  # 5 MB default
MAX_IMAGE_WIDTH: int = env_int("MAX_IMAGE_WIDTH", 4096)
MAX_IMAGE_HEIGHT: int = env_int("MAX_IMAGE_HEIGHT", 4096)

ALLOWED_MIME_TYPES: Set[str] = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

# =====================================================
# SHIFTS & ROLES
# =====================================================

VALID_SHIFTS: Set[str] = {
    "Shift A",
    "Shift B",
    "Shift C",
    "General Shift",
}

VALID_ROLES: Set[str] = {
    "admin",
    "employee",
}

# =====================================================
# VISION AI CONFIGURATION & QUOTA PROTECTION
# =====================================================

VISION_AI_ENABLED: bool = env_bool("VISION_AI_ENABLED", True)
DAILY_VISION_CALL_CAP: int = env_int("DAILY_VISION_CALL_CAP", 500)

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "").strip()
