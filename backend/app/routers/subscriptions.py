"""Subscription state and plan limits.

Payment processing (Razorpay) lands later; the API contract is stable now so
clients can build against it. The webhook endpoint is stubbed and safe.
"""

import logging

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models import Conversation, Document, Message, Subscription, User
from app.schemas import SubscriptionOut
from app.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

PLAN_LIMITS = {
    "free": {"documents": None, "daily_chats": None, "family_members": 3},
    "pro": {"documents": 1000, "daily_chats": "unlimited", "family_members": 6},
    "family": {"documents": 5000, "daily_chats": "unlimited", "family_members": 15},
}


@router.get("/me", response_model=SubscriptionOut)
async def my_subscription(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    sub = (
        await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    ).scalar_one_or_none()
    if sub is None:
        sub = Subscription(user_id=user.id)
        db.add(sub)
        await db.commit()
        await db.refresh(sub)

    limits = dict(PLAN_LIMITS.get(sub.plan, PLAN_LIMITS["free"]))
    if sub.plan == "free":
        limits["documents"] = settings.FREE_PLAN_DOC_LIMIT
        limits["daily_chats"] = settings.FREE_PLAN_DAILY_CHAT_LIMIT

    doc_count = (
        await db.execute(
            select(func.count()).select_from(Document).where(
                Document.user_id == user.id, Document.is_deleted.is_(False)
            )
        )
    ).scalar_one()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    chat_count_today = (
        await db.execute(
            select(func.count()).select_from(Message).join(
                Conversation, Message.conversation_id == Conversation.id
            ).where(
                Conversation.user_id == user.id,
                Message.role == "user",
                Message.created_at >= today_start,
            )
        )
    ).scalar_one()

    return SubscriptionOut(
        plan=sub.plan,
        status=sub.status,
        current_period_end=sub.current_period_end,
        limits=limits,
        doc_count=doc_count,
        chat_count_today=chat_count_today,
    )


@router.post("/webhooks/razorpay", include_in_schema=False)
async def razorpay_webhook(request: Request):
    """Stub: acknowledge and log. Signature verification + plan updates come
    with the Razorpay integration."""
    payload = await request.body()
    logger.info("Razorpay webhook received (%d bytes) — not yet processed", len(payload))
    return {"status": "ok"}
