"""Phone OTP issue/verify with a pluggable SMS provider.

Dev default is the console provider: the OTP is logged and (in DEBUG)
returned in the API response so the full flow works without an SMS account.
Production: set SMS_PROVIDER=msg91 (cheapest for India) or twilio.
"""

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import OtpCode

logger = logging.getLogger(__name__)


def _hash(code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


async def _send_sms(phone: str, code: str) -> None:
    provider = settings.SMS_PROVIDER
    message = f"Your mydoc.ai verification code is {code}. Valid for {settings.OTP_EXPIRE_MINUTES} minutes."
    if provider == "console":
        logger.info("DEV OTP for %s: %s", phone, code)
        return
    if provider == "msg91":
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                "https://control.msg91.com/api/v5/otp",
                params={
                    "template_id": settings.MSG91_TEMPLATE_ID,
                    "mobile": phone.lstrip("+"),
                    "otp": code,
                },
                headers={"authkey": settings.MSG91_AUTH_KEY},
            )
        return
    if provider == "twilio":
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                data={"To": phone, "From": settings.TWILIO_PHONE, "Body": message},
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            )
        return
    raise ValueError(f"Unknown SMS_PROVIDER: {provider}")


async def issue_otp(db: AsyncSession, phone: str) -> str | None:
    """Create and send an OTP. Returns the code only in DEBUG mode."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    # Invalidate previous outstanding codes for this phone.
    await db.execute(
        update(OtpCode).where(OtpCode.phone == phone, OtpCode.used.is_(False)).values(used=True)
    )
    db.add(
        OtpCode(
            phone=phone,
            code_hash=_hash(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        )
    )
    await db.commit()
    await _send_sms(phone, code)
    return code if settings.DEBUG and settings.SMS_PROVIDER == "console" else None


async def verify_otp(db: AsyncSession, phone: str, code: str) -> bool:
    row = (
        await db.execute(
            select(OtpCode)
            .where(OtpCode.phone == phone, OtpCode.used.is_(False))
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if row is None:
        return False

    expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc) or row.attempts >= settings.OTP_MAX_ATTEMPTS:
        return False

    row.attempts += 1
    if hmac.compare_digest(row.code_hash, _hash(code)):
        row.used = True
        await db.commit()
        return True
    await db.commit()
    return False
