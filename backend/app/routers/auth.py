"""Phone OTP authentication."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Subscription, User
from app.schemas import OtpRequest, OtpRequestResponse, OtpVerify, TokenResponse
from app.security import create_access_token
from app.services.otp import issue_otp, verify_otp

router = APIRouter()


@router.post("/request-otp", response_model=OtpRequestResponse)
async def request_otp(body: OtpRequest, db: AsyncSession = Depends(get_db)):
    dev_otp = await issue_otp(db, body.phone)
    return OtpRequestResponse(message="OTP sent", dev_otp=dev_otp)


@router.post("/verify-otp", response_model=TokenResponse)
async def verify(body: OtpVerify, db: AsyncSession = Depends(get_db)):
    if not await verify_otp(db, body.phone, body.otp):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    user = (await db.execute(select(User).where(User.phone == body.phone))).scalar_one_or_none()
    is_new = user is None
    if is_new:
        user = User(phone=body.phone, name=body.name or "")
        db.add(user)
        await db.flush()
        db.add(Subscription(user_id=user.id))
        await db.commit()
    elif body.name and not user.name:
        user.name = body.name
        await db.commit()

    return TokenResponse(access_token=create_access_token(user.id), is_new_user=is_new)
