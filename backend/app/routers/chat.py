"""AI chat with per-user RAG context, streamed over SSE.

POST /chat returns text/event-stream:
  data: {"type": "meta", "conversation_id": ...}
  data: {"type": "token", "content": "..."}   (repeated)
  data: {"type": "done", "message_id": ..., "sources": [...]}
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import SessionLocal, get_db
from app.models import Conversation, Message, Profile, Subscription, User
from app.schemas import ChatRequest, ConversationOut, MessageOut
from app.security import get_current_user
from app.services.llm import get_llm
from app.services.rag import retrieve

logger = logging.getLogger(__name__)
router = APIRouter()

SYSTEM_PROMPT = """You are MyDoc, a careful health assistant for Indian families. You help users understand their medical documents, lab values, prescriptions, and general health questions.

Rules:
- Be clear and use plain language; explain medical terms simply.
- When document context is provided, ground your answer in it and mention which report you used.
- Never diagnose or prescribe. For anything concerning, advise consulting a doctor.
- If asked about an emergency (chest pain, stroke signs, severe bleeding), tell the user to call 112 / go to the nearest emergency room immediately.
- Reply in the user's language ({language}).

{profile_block}{context_block}"""


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _check_daily_limit(db: AsyncSession, user: User) -> None:
    sub = (
        await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    ).scalar_one_or_none()
    if sub and sub.plan != "free":
        return
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = (
        await db.execute(
            select(func.count(Message.id))
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(
                Conversation.user_id == user.id,
                Message.role == "user",
                Message.created_at >= today_start,
            )
        )
    ).scalar_one()
    if count >= settings.FREE_PLAN_DAILY_CHAT_LIMIT:
        raise HTTPException(
            status_code=402,
            detail=f"Free plan allows {settings.FREE_PLAN_DAILY_CHAT_LIMIT} messages per day. Upgrade for unlimited chat.",
        )


@router.post("")
async def chat(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_daily_limit(db, user)

    # Resolve or create the conversation up front (before streaming starts).
    if body.conversation_id:
        conv = (
            await db.execute(
                select(Conversation).where(
                    Conversation.id == body.conversation_id, Conversation.user_id == user.id
                )
            )
        ).scalar_one_or_none()
        if conv is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = Conversation(user_id=user.id, title=body.message[:60])
        db.add(conv)
        await db.flush()

    user_msg = Message(conversation_id=conv.id, role="user", content=body.message)
    db.add(user_msg)
    await db.commit()

    # Snapshot everything the generator needs; it runs after this session closes.
    conv_id, user_id, language = conv.id, user.id, user.language_pref

    profile = (
        await db.execute(select(Profile).where(Profile.user_id == user_id))
    ).scalar_one_or_none()
    profile_block = ""
    if profile and (profile.medical_conditions or profile.allergies or profile.date_of_birth):
        parts = []
        if profile.date_of_birth:
            parts.append(f"DOB: {profile.date_of_birth}")
        if profile.gender:
            parts.append(f"Gender: {profile.gender}")
        if profile.medical_conditions:
            parts.append(f"Known conditions: {', '.join(profile.medical_conditions)}")
        if profile.allergies:
            parts.append(f"Allergies: {', '.join(profile.allergies)}")
        profile_block = "USER HEALTH PROFILE: " + "; ".join(parts) + "\n\n"

    # RAG retrieval over the user's documents.
    try:
        context_chunks = await retrieve(db, user_id, body.message)
    except Exception:
        logger.exception("RAG retrieval failed; continuing without context")
        context_chunks = []

    context_block = ""
    source_ids: list[str] = []
    if context_chunks:
        seen = set()
        blocks = []
        for c in context_chunks:
            if c["document_id"] not in seen:
                seen.add(c["document_id"])
                source_ids.append(c["document_id"])
            blocks.append(
                f"[{c['file_name']}" + (f", {c['report_date']}" if c["report_date"] else "") + f"]\n{c['text']}"
            )
        context_block = "RELEVANT EXTRACTS FROM THE USER'S MEDICAL DOCUMENTS:\n\n" + "\n\n---\n\n".join(blocks)

    system = SYSTEM_PROMPT.format(
        language=language, profile_block=profile_block, context_block=context_block
    )

    # Last few turns for conversational continuity.
    history_rows = (
        await db.execute(
            select(Message)
            .where(Message.conversation_id == conv_id)
            .order_by(Message.created_at.desc())
            .limit(12)
        )
    ).scalars().all()
    history = [{"role": m.role, "content": m.content} for m in reversed(history_rows)]

    async def stream():
        yield _sse({"type": "meta", "conversation_id": conv_id})
        full: list[str] = []
        try:
            async for token in get_llm().chat_stream(history, system):
                full.append(token)
                yield _sse({"type": "token", "content": token})
        except Exception:
            logger.exception("LLM stream failed")
            fallback = "Sorry, I ran into a problem answering that. Please try again."
            full = [fallback]
            yield _sse({"type": "token", "content": fallback})

        # Persist the assistant message with a fresh session (request session is closed).
        async with SessionLocal() as save_db:
            msg = Message(
                conversation_id=conv_id,
                role="assistant",
                content="".join(full),
                sources=source_ids or None,
            )
            save_db.add(msg)
            await save_db.commit()
            yield _sse({"type": "done", "message_id": msg.id, "sources": source_ids})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    limit: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(min(limit, 100))
    )
    return rows.scalars().all()


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = (
        await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id, Conversation.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    rows = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )
    return rows.scalars().all()
