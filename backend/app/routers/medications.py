"""Medication CRUD and adherence logs. Reminders are delivered client-side
via local notifications scheduled from `times`; FCM server push can be added
later without API changes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Medication, MedicationLog, User
from app.schemas import (
    MedicationCreate,
    MedicationLogCreate,
    MedicationLogOut,
    MedicationOut,
    MedicationUpdate,
)
from app.security import get_current_user

router = APIRouter()


async def _get_owned(db: AsyncSession, user: User, medication_id: str) -> Medication:
    med = (
        await db.execute(
            select(Medication).where(
                Medication.id == medication_id, Medication.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if med is None:
        raise HTTPException(status_code=404, detail="Medication not found")
    return med


@router.get("", response_model=list[MedicationOut])
async def list_medications(
    active_only: bool = True,
    member_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Medication).where(Medication.user_id == user.id)
    if active_only:
        query = query.where(Medication.is_active.is_(True))
    if member_id:
        query = query.where(Medication.member_id == member_id)
    return (await db.execute(query.order_by(Medication.created_at.desc()))).scalars().all()


@router.post("", response_model=MedicationOut, status_code=201)
async def create_medication(
    body: MedicationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    med = Medication(user_id=user.id, **body.model_dump())
    db.add(med)
    await db.commit()
    await db.refresh(med)
    return med


@router.patch("/{medication_id}", response_model=MedicationOut)
async def update_medication(
    medication_id: str,
    body: MedicationUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    med = await _get_owned(db, user, medication_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(med, field, value)
    await db.commit()
    await db.refresh(med)
    return med


@router.delete("/{medication_id}", status_code=204)
async def delete_medication(
    medication_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    med = await _get_owned(db, user, medication_id)
    await db.delete(med)
    await db.commit()


@router.post("/{medication_id}/logs", response_model=MedicationLogOut, status_code=201)
async def log_dose(
    medication_id: str,
    body: MedicationLogCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned(db, user, medication_id)
    existing = (
        await db.execute(
            select(MedicationLog).where(
                MedicationLog.medication_id == medication_id,
                MedicationLog.scheduled_for == body.scheduled_for,
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.status = body.status
        await db.commit()
        await db.refresh(existing)
        return existing
    log = MedicationLog(
        medication_id=medication_id, scheduled_for=body.scheduled_for, status=body.status
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/{medication_id}/logs", response_model=list[MedicationLogOut])
async def list_logs(
    medication_id: str,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned(db, user, medication_id)
    rows = await db.execute(
        select(MedicationLog)
        .where(MedicationLog.medication_id == medication_id)
        .order_by(MedicationLog.scheduled_for.desc())
        .limit(min(limit, 365))
    )
    return rows.scalars().all()
