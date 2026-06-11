"""Current user, health profile, family members, push tokens."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import FamilyMember, Profile, PushToken, User
from app.schemas import (
    FamilyMemberCreate,
    FamilyMemberOut,
    ProfileOut,
    ProfileUpdate,
    PushTokenRegister,
    UserOut,
    UserUpdate,
)
from app.security import get_current_user

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/me/profile", response_model=ProfileOut)
async def get_profile(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    profile = (
        await db.execute(select(Profile).where(Profile.user_id == user.id))
    ).scalar_one_or_none()
    if profile is None:
        profile = Profile(user_id=user.id, medical_conditions=[], allergies=[])
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


@router.put("/me/profile", response_model=ProfileOut)
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = (
        await db.execute(select(Profile).where(Profile.user_id == user.id))
    ).scalar_one_or_none()
    if profile is None:
        profile = Profile(user_id=user.id, medical_conditions=[], allergies=[])
        db.add(profile)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return profile


# ---------- Family ----------

@router.get("/me/family", response_model=list[FamilyMemberOut])
async def list_family(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = await db.execute(
        select(FamilyMember).where(FamilyMember.user_id == user.id).order_by(FamilyMember.created_at)
    )
    return rows.scalars().all()


@router.post("/me/family", response_model=FamilyMemberOut, status_code=201)
async def add_family_member(
    body: FamilyMemberCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = FamilyMember(user_id=user.id, **body.model_dump())
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/me/family/{member_id}", status_code=204)
async def remove_family_member(
    member_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = (
        await db.execute(
            select(FamilyMember).where(
                FamilyMember.id == member_id, FamilyMember.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Family member not found")
    await db.delete(member)
    await db.commit()


# ---------- Push tokens ----------

@router.post("/me/push-tokens", status_code=204)
async def register_push_token(
    body: PushTokenRegister,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(PushToken).where(PushToken.user_id == user.id, PushToken.token == body.token)
    )
    db.add(PushToken(user_id=user.id, token=body.token, platform=body.platform))
    await db.commit()
