from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel


class ScanResponse(BaseModel):
    success: bool
    code: Optional[str] = None
    confidence: float = 0.0
    vote_count: int = 0
    total_votes: int = 0
    latency_ms: float = 0.0
    pipeline: str = ""
    message: str = ""


class SaveRecordRequest(BaseModel):
    code: Optional[str] = None
    success: bool = False
    confidence: float = 0.0
    vote_count: int = 0
    total_votes: int = 0
    latency_ms: float = 0.0
    pipeline: Optional[str] = None
    shift: Optional[str] = "General Shift"
    message: Optional[str] = None


class RecordResponse(BaseModel):
    id: int
    code: Optional[str] = None
    success: bool
    confidence: float = 0.0
    vote_count: int = 0
    total_votes: int = 0
    latency_ms: float = 0.0
    pipeline: Optional[str] = None
    shift: str = "General Shift"
    created_by_username: Optional[str] = None
    message: Optional[str] = None
    created_at: Optional[datetime] = None
    raw_image_url: Optional[str] = None
    processed_image_url: Optional[str] = None

    source_type: Optional[str] = None
    source_file_name: Optional[str] = None
    source_record_id: Optional[str] = None
    uploaded_by: Optional[str] = None
    uploaded_at: Optional[datetime] = None


class HealthResponse(BaseModel):
    status: str
    uptime_s: float


class MetricsResponse(BaseModel):
    requests: int
    success: int
    success_rate: float
    avg_latency_ms: float


class DeleteMonthResponse(BaseModel):
    success: bool
    deleted: int
    year: int
    month: int
    message: str


class DeleteDateResponse(BaseModel):
    success: bool
    deleted: int
    date: date
    message: str


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    full_name: Optional[str] = None
    role: str
    must_change_password: bool = False


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    is_active: bool
    must_change_password: bool = False


class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str = "employee"


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class ResetUserPasswordRequest(BaseModel):
    new_password: str
    force_change: bool = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
