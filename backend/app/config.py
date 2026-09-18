import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default

def parse_origins(value: str) -> list[str]:
    raw = (value or "").strip()
    if not raw or raw == "*":
        return ["*"]
    return [item.strip() for item in raw.split(",") if item.strip()]

SECRET_KEY = os.getenv("SECRET_KEY", "STEELSCAN_LOCAL_DEV_SECRET_CHANGE_BEFORE_DEPLOYMENT")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_HOURS = env_int("ACCESS_TOKEN_EXPIRE_HOURS", 8)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")
ALLOWED_ORIGINS = parse_origins(FRONTEND_ORIGIN)

DEFAULT_ADMIN_USERNAME = os.getenv("DEFAULT_ADMIN_USERNAME", "admin").strip().lower()
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
DEFAULT_EMPLOYEE_USERNAME = os.getenv("DEFAULT_EMPLOYEE_USERNAME", "employee").strip().lower()
DEFAULT_EMPLOYEE_PASSWORD = os.getenv("DEFAULT_EMPLOYEE_PASSWORD", "employee123")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}

VALID_SHIFTS = {
    "Shift A",
    "Shift B",
    "Shift C",
    "General Shift",
}

VALID_ROLES = {
    "admin",
    "employee",
}
