"""Pydantic request/response schemas."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

PHONE_PATTERN = r"^\+[1-9]\d{7,14}$"  # E.164


# ---------- Auth ----------

class OtpRequest(BaseModel):
    phone: str = Field(pattern=PHONE_PATTERN)


class OtpRequestResponse(BaseModel):
    message: str
    dev_otp: str | None = None  # only populated in DEBUG + console SMS mode


class OtpVerify(BaseModel):
    phone: str = Field(pattern=PHONE_PATTERN)
    otp: str = Field(min_length=4, max_length=8)
    name: str | None = None  # used when this verify creates the account


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool = False


# ---------- Users / profile ----------

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    phone: str | None
    email: str | None
    name: str
    language_pref: str
    created_at: datetime


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    email: str | None = None
    language_pref: str | None = None

    @field_validator("language_pref")
    @classmethod
    def _lang(cls, v):
        allowed = {"en", "hi", "ta", "te", "kn", "ml", "mr", "gu", "bn", "pa", "or"}
        if v is not None and v not in allowed:
            raise ValueError(f"language must be one of {sorted(allowed)}")
        return v


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    date_of_birth: date | None
    gender: str | None
    blood_group: str | None
    height_cm: float | None
    weight_kg: float | None
    medical_conditions: list
    allergies: list


class ProfileUpdate(BaseModel):
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    height_cm: float | None = Field(default=None, gt=0, lt=300)
    weight_kg: float | None = Field(default=None, gt=0, lt=500)
    medical_conditions: list[str] | None = None
    allergies: list[str] | None = None


# ---------- Family ----------

class FamilyMemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    relation: str = Field(pattern="^(self|spouse|child|parent|sibling|other)$")
    date_of_birth: date | None = None
    gender: str | None = None


class FamilyMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    relation: str
    date_of_birth: date | None
    gender: str | None


# ---------- Documents ----------

class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    file_name: str
    mime_type: str
    file_size_bytes: int
    status: str
    document_type: str | None
    report_date: date | None
    lab_name: str | None
    summary: str | None
    member_id: str | None
    created_at: datetime


class DocumentDetail(DocumentOut):
    structured_data: dict | None
    raw_text: str | None
    error: str | None


# ---------- Chat ----------

class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    sources: list | None
    created_at: datetime


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = None  # omit to start a new conversation


# ---------- Medications ----------

class MedicationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    dosage: str = ""
    instructions: str = ""
    times: list[str] = Field(default_factory=list)
    start_date: date | None = None
    end_date: date | None = None
    member_id: str | None = None

    @field_validator("times")
    @classmethod
    def _times(cls, v):
        import re

        for t in v:
            if not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", t):
                raise ValueError(f"invalid time {t!r}, expected HH:MM")
        return v


class MedicationUpdate(BaseModel):
    name: str | None = None
    dosage: str | None = None
    instructions: str | None = None
    times: list[str] | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class MedicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    dosage: str
    instructions: str
    times: list
    start_date: date | None
    end_date: date | None
    is_active: bool
    member_id: str | None


class MedicationLogCreate(BaseModel):
    scheduled_for: datetime
    status: str = Field(default="taken", pattern="^(taken|skipped)$")


class MedicationLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    medication_id: str
    scheduled_for: datetime
    status: str
    logged_at: datetime


# ---------- Subscription ----------

class SubscriptionOut(BaseModel):
    plan: str
    status: str
    current_period_end: datetime | None
    limits: dict


# ---------- Push ----------

class PushTokenRegister(BaseModel):
    token: str = Field(min_length=10, max_length=512)
    platform: str = Field(default="android", pattern="^(android|ios|web)$")
