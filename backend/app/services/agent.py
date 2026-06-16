"""Multi-step health agent pipeline.

Flow for every chat message:
  1. Classify intent (symptom / medication / document / general)
  2. Pull medical history: profile + active meds + RAG over documents
  3. Analyse any inline images with vision AI (parallel with step 4)
  4. Web-search authoritative medical sources (symptom/medication queries)
  5. Synthesise and stream a grounded, reasoned response

All steps emit SSE status events so the client shows live progress.
The pipeline degrades gracefully: missing API keys → skip that step, still respond.
"""

import base64
import json
import logging
from typing import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Medication, Profile, User
from app.services.llm import get_llm
from app.services.rag import retrieve
from app.services.websearch import search_medical

logger = logging.getLogger(__name__)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ─── Intent classifier ────────────────────────────────────────────────────────

_CLASSIFY_SYSTEM = """Classify the user health message into exactly one word:
- symptom  — describes physical symptoms, body changes, pain, appearance of a body part
- medication — asks about a medicine, drug, dosage, side effect, or interaction
- document — asks about a specific uploaded report, lab test, prescription
- general  — wellness, diet, lifestyle, or anything else

Reply with ONLY one word. No explanation."""


async def _classify(message: str, has_images: bool) -> str:
    if has_images:
        return "symptom"
    try:
        result = await get_llm().complete(
            [{"role": "user", "content": message[:500]}],
            system=_CLASSIFY_SYSTEM,
        )
        intent = result.strip().lower().split()[0]
        if intent in ("symptom", "medication", "document", "general"):
            return intent
    except Exception:
        logger.debug("Intent classification failed; defaulting to symptom")
    return "symptom"


# ─── Medical history ──────────────────────────────────────────────────────────

async def _build_history(
    user: User, message: str, db: AsyncSession
) -> tuple[str, list[str]]:
    """Returns (formatted context block, list of source document IDs)."""
    parts: list[str] = []
    source_ids: list[str] = []

    profile = (
        await db.execute(select(Profile).where(Profile.user_id == user.id))
    ).scalar_one_or_none()
    if profile:
        pf: list[str] = []
        if profile.date_of_birth:
            pf.append(f"DOB: {profile.date_of_birth}")
        if profile.gender:
            pf.append(f"Gender: {profile.gender}")
        if profile.blood_group:
            pf.append(f"Blood group: {profile.blood_group}")
        if profile.height_cm and profile.weight_kg:
            bmi = profile.weight_kg / ((profile.height_cm / 100) ** 2)
            pf.append(
                f"Height/Weight/BMI: {profile.height_cm}cm / {profile.weight_kg}kg / {bmi:.1f}"
            )
        if profile.medical_conditions:
            pf.append(f"Known conditions: {', '.join(profile.medical_conditions)}")
        if profile.allergies:
            pf.append(f"Allergies: {', '.join(profile.allergies)}")
        if pf:
            parts.append("PATIENT PROFILE: " + "; ".join(pf))

    meds = (
        await db.execute(
            select(Medication).where(
                Medication.user_id == user.id,
                Medication.is_active.is_(True),
            )
        )
    ).scalars().all()
    if meds:
        med_list = "; ".join(
            f"{m.name} {m.dosage}".strip() + (f" ({', '.join(m.times)})" if m.times else "")
            for m in meds
        )
        parts.append(f"CURRENT MEDICATIONS: {med_list}")

    try:
        chunks = await retrieve(db, user.id, message)
    except Exception:
        logger.exception("RAG retrieval failed")
        chunks = []

    if chunks:
        seen: set[str] = set()
        doc_blocks: list[str] = []
        for c in chunks:
            if c["document_id"] not in seen:
                seen.add(c["document_id"])
                source_ids.append(c["document_id"])
            label = c["file_name"]
            if c.get("report_date"):
                label += f" ({c['report_date']})"
            doc_blocks.append(f"[{label}]\n{c['text'][:1000]}")
        parts.append(
            "RELEVANT MEDICAL RECORDS:\n" + "\n\n---\n".join(doc_blocks)
        )

    return "\n\n".join(parts), source_ids


# ─── Image analysis ───────────────────────────────────────────────────────────

_IMAGE_PROMPT = """You are a clinical image analyst assisting a doctor.
The patient has shared this image as part of a health query.

Describe concisely (5–8 sentences):
1. Anatomical region / body part visible
2. Visual characteristics: colour, texture, size, shape, distribution, edges
3. Notable features: lesions, discolouration, swelling, rash, coating, asymmetry
4. What this presentation is commonly associated with (list possibilities — do NOT diagnose)

Be precise and clinical. Never give a definitive diagnosis."""


async def _analyze_images(images: list[dict]) -> str:
    """images: list of {mime_type, data} where data is raw base64."""
    llm = get_llm()
    findings: list[str] = []
    for i, img in enumerate(images[:3], 1):
        try:
            raw = base64.b64decode(img["data"])
            text = await llm.extract_document(raw, img["mime_type"], _IMAGE_PROMPT)
            findings.append(f"Image {i} — {text.strip()[:700]}")
        except Exception:
            logger.exception("Image %d analysis failed", i)
    return "\n\n".join(findings)


# ─── Synthesis ────────────────────────────────────────────────────────────────

_SYNTHESIS_SYSTEM = """You are MyDoc — a warm, expert AI health companion built for Indian users.

The patient has come to you with a health concern. You have been given their medical history, image findings (if any), and relevant findings from authoritative medical literature.

Structure your response with these sections (use emoji headers):

🩺 **What I observed** (if images were shared — describe what you see clinically)
🔍 **What this could be** (2–3 differentials in order of likelihood; connect each to their specific history)
⚠️ **Urgency level** (one of: "Go to ER now", "See a doctor within 1–3 days", "Can manage at home for now")
👨‍⚕️ **Which specialist to see** (if a doctor visit is recommended)
✅ **What to do right now** (2–4 practical, specific actions — diet, home care, what to avoid)
📚 **Sources** (list the references you used with their URLs)

RULES:
- Never diagnose definitively. Use "may suggest", "is often associated with", "could indicate"
- If the message contains chest pain, stroke signs (FAST), severe breathing difficulty, heavy uncontrolled bleeding, or suicidal thoughts: put ⚠️ CALL 112 / GO TO ER IMMEDIATELY as the very first line, before anything else
- Tailor advice to India: suggest foods available in Indian households, mention that 1mg/PharmEasy have the medicines if relevant
- Be warm and personal — reference their specific conditions and medications by name
- End with: "This information is for educational purposes only. Please consult a qualified doctor for diagnosis and treatment."
- Reply in {language}

{history_block}

{image_block}

{web_block}"""


# ─── Public entry point ───────────────────────────────────────────────────────

async def run_health_agent(
    message: str,
    user: User,
    images: list[dict],  # [{mime_type: str, data: str}] raw base64
    attached_doc_block: str,
    db: AsyncSession,
) -> AsyncIterator[str]:
    """
    Yields SSE-formatted strings. Caller is responsible for saving the
    assembled response to DB.

    Special events emitted:
      {"type": "status", "text": "..."}   — progress update for UI
      {"type": "token", "content": "..."}  — streaming response chunk
      {"type": "references", "data": [...]} — [{title, url}] at end
      {"type": "agent_done", "sources": [...], "intent": "..."}
    """
    # Step 1: classify
    intent = await _classify(message, bool(images))

    # Step 2: medical history
    yield _sse({"type": "status", "text": "Reviewing your medical history…"})
    history_text, source_ids = await _build_history(user, message, db)

    # Step 3: image analysis
    image_findings = ""
    if images:
        yield _sse({"type": "status", "text": "Analysing your images…"})
        image_findings = await _analyze_images(images)

    # Step 4: web search (skip for pure document questions)
    web_results = []
    if intent in ("symptom", "general", "medication") and settings.WEB_SEARCH_ENABLED:
        yield _sse({"type": "status", "text": "Searching medical literature…"})
        # Build a focused query: symptom keywords + top conditions from profile
        search_q = message[:200]
        for line in history_text.split("\n"):
            if "Known conditions:" in line:
                search_q += " " + line.split("Known conditions:")[-1].strip()
                break
        web_results = await search_medical(search_q[:300])

    # Step 5: synthesise
    yield _sse({"type": "status", "text": "Analysing and preparing your response…"})

    history_block = f"PATIENT CONTEXT:\n{history_text}" if history_text else ""

    image_block = ""
    if attached_doc_block:
        image_block = attached_doc_block
    if image_findings:
        image_block = (image_block + "\n\nINLINE IMAGE FINDINGS:\n" + image_findings).strip()

    web_block = ""
    if web_results:
        lines = [
            f"- {r.title}\n  URL: {r.url}\n  {r.snippet}"
            for r in web_results
        ]
        web_block = "MEDICAL LITERATURE:\n" + "\n\n".join(lines)

    system = _SYNTHESIS_SYSTEM.format(
        language=user.language_pref or "en",
        history_block=history_block,
        image_block=image_block,
        web_block=web_block,
    )

    full: list[str] = []
    try:
        async for token in get_llm().chat_stream(
            [{"role": "user", "content": message}], system
        ):
            full.append(token)
            yield _sse({"type": "token", "content": token})
    except Exception:
        logger.exception("Agent synthesis stream failed")
        fallback = "I ran into an issue analysing your query. Please try again in a moment."
        full = [fallback]
        yield _sse({"type": "token", "content": fallback})

    if web_results:
        yield _sse({
            "type": "references",
            "data": [{"title": r.title, "url": r.url} for r in web_results],
        })

    yield _sse({
        "type": "agent_done",
        "sources": source_ids,
        "intent": intent,
        "full_text": "".join(full),
    })
