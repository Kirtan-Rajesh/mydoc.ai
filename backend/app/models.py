"""SQLAlchemy ORM models — single Postgres/SQLite schema for the whole app."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)  # E.164
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    language_pref: Mapped[str] = mapped_column(String(10), default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Profile(Base):
    """Health profile, 1:1 with user."""

    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(20))
    blood_group: Mapped[str | None] = mapped_column(String(5))
    height_cm: Mapped[float | None] = mapped_column(Float)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    medical_conditions: Mapped[list] = mapped_column(JSON, default=list)
    allergies: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class FamilyMember(Base):
    """A person the account owner manages records for (child, parent, etc.).
    May optionally be linked to a real user account."""

    __tablename__ = "family_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    relation: Mapped[str] = mapped_column(String(50))  # self, spouse, child, parent, other
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(20))
    linked_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Document(Base):
    """Document metadata + extraction output. Bytes live in storage backend."""

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    member_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("family_members.id"))
    file_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    storage_path: Mapped[str] = mapped_column(String(512))
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    # uploaded -> processing -> ready | failed
    status: Mapped[str] = mapped_column(String(20), default="uploaded", index=True)
    error: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)  # user-provided context hint at upload time
    document_type: Mapped[str | None] = mapped_column(String(50), index=True)
    report_date: Mapped[date | None] = mapped_column(Date)
    lab_name: Mapped[str | None] = mapped_column(String(255))
    summary: Mapped[str | None] = mapped_column(Text)
    raw_text: Mapped[str | None] = mapped_column(Text)
    structured_data: Mapped[dict | None] = mapped_column(JSON)
    extraction_model: Mapped[str | None] = mapped_column(String(100))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class DocumentChunk(Base):
    """RAG chunk with embedding stored inline (JSON list of floats).
    Retrieval is per-user, so a vector index is unnecessary at this scale."""

    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list | None] = mapped_column(JSON)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="New conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    sources: Mapped[list | None] = mapped_column(JSON)  # document ids used as RAG context
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    member_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("family_members.id"))
    name: Mapped[str] = mapped_column(String(255))
    dosage: Mapped[str] = mapped_column(String(255), default="")
    instructions: Mapped[str] = mapped_column(Text, default="")
    times: Mapped[list] = mapped_column(JSON, default=list)  # ["08:00", "20:00"]
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class MedicationLog(Base):
    __tablename__ = "medication_logs"
    __table_args__ = (UniqueConstraint("medication_id", "scheduled_for", name="uq_med_schedule"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    medication_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("medications.id", ondelete="CASCADE"), index=True
    )
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="taken")  # taken | skipped | missed
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Subscription(Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    plan: Mapped[str] = mapped_column(String(50), default="free")  # free | pro | family
    status: Mapped[str] = mapped_column(String(20), default="active")
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String(255))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class PushToken(Base):
    __tablename__ = "push_tokens"
    __table_args__ = (UniqueConstraint("user_id", "token", name="uq_user_token"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token: Mapped[str] = mapped_column(String(512))
    platform: Mapped[str] = mapped_column(String(20), default="android")  # android | ios | web
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
