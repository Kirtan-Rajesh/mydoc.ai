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

SYSTEM_PROMPT = """You are MyDoc — the user's personal AI health companion. You know their health profile, their medical reports, and their medications, and you stay with them for the long term. Act like a warm, attentive family doctor's assistant: proactive, practical, and personal.

How you help:
- Explain lab reports and prescriptions in plain language; flag values outside normal ranges and trends across reports when the context shows older results.
- Help manage medications: what each medicine is for, common side effects to watch, the importance of timing/adherence. Suggest they set reminders in the app.
- Give practical diet and lifestyle guidance suited to Indian households (vegetarian options, common foods) tailored to their conditions and lab values.
- Ask one short follow-up question when it would genuinely help you advise better.
- Be concise: short paragraphs or tight bullet lists, no walls of text.

Safety rules (always):
- You inform and coach — you never diagnose conditions or prescribe/change medication doses. For those, tell them exactly what to ask their doctor.
- Red-flag symptoms (chest pain, stroke signs, breathing difficulty, severe bleeding, suicidal thoughts): tell them to call 112 or go to an emergency room NOW, before anything else.
- If a report is unclear or low quality, say what's missing rather than guessing.
- Reply in the user's language ({language}).

{profile_block}{attached_block}{context_block}"""


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

    # Explicitly attached report (e.g. just scanned in chat) gets prime context.
    attached_block = ""
    attached_id: str | None = None
    if body.document_id:
        from app.models import Document

        doc = (
            await db.execute(
                select(Document).where(
                    Document.id == body.document_id,
                    Document.user_id == user_id,
                    Document.is_deleted.is_(False),
                )
            )
        ).scalar_one_or_none()
        if doc is None:
            raise HTTPException(status_code=404, detail="Attached document not found")
        attached_id = doc.id
        if doc.status != "ready":
            attached_block = (
                f"THE USER JUST ATTACHED A DOCUMENT ({doc.file_name}) that is still being "
                "processed. Tell them you're reading it and they can ask again in a moment.\n\n"
            )
        else:
            details = [f"file: {doc.file_name}", f"type: {doc.document_type}"]
            if doc.report_date:
                details.append(f"date: {doc.report_date}")
            if doc.structured_data:
                details.append(f"key values: {json.dumps(doc.structured_data, ensure_ascii=False)}")
            text_excerpt = (doc.raw_text or doc.summary or "")[:6000]
            attached_block = (
                "THE USER ATTACHED THIS REPORT TO THE CURRENT MESSAGE — analyse it first:\n"
                + "; ".join(details)
                + f"\ncontent:\n{text_excerpt}\n\n"
            )

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

    if attached_id and attached_id not in source_ids:
        source_ids.insert(0, attached_id)

    system = SYSTEM_PROMPT.format(
        language=language,
        profile_block=profile_block,
        attached_block=attached_block,
        context_block=context_block,
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
