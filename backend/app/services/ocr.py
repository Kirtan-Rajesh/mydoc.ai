"""Document processing pipeline (runs as a FastAPI background task).

Steps: load bytes -> extract text (pypdf for digital PDFs, LLM vision for
scans/images) -> structured extraction (type, date, summary, key values) ->
chunk + embed for RAG -> mark ready.

Runs in-process today; the entrypoint signature is queue-shaped so it can move
behind Cloud Tasks/Pub/Sub without changes to callers.
"""

import io
import json
import logging
import re
from datetime import date, datetime

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Document
from app.services.llm import get_llm
from app.services.rag import index_document
from app.services.storage import get_storage

logger = logging.getLogger(__name__)

# Below this many characters of extractable text, treat a PDF as a scan and
# fall through to vision extraction.
MIN_DIGITAL_TEXT_CHARS = 200

EXTRACTION_PROMPT = """You are a medical document analyst. Read this document and return ONLY a JSON object (no markdown fences) with:
{
  "document_type": one of "blood_report" | "urine_report" | "prescription" | "scan" | "vaccination" | "discharge_summary" | "other",
  "report_date": "YYYY-MM-DD" or null,
  "lab_name": string or null,
  "summary": 2-4 sentence plain-language summary a patient can understand,
  "key_values": object mapping test/medicine names to values with units, e.g. {"Hemoglobin": "13.2 g/dL"},
  "full_text": the complete text content of the document
}
If the document is not medical, still fill the fields as best you can."""


def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        logger.warning("pypdf failed to parse document", exc_info=True)
        return ""


def _parse_extraction(raw: str) -> dict:
    """LLM output -> dict, tolerating markdown fences and trailing prose."""
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return {"document_type": "other", "summary": cleaned[:1000], "key_values": {}}


def _parse_date(value) -> date | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


async def process_document(document_id: str) -> None:
    """Background entrypoint. Owns its own DB session; never raises."""
    async with SessionLocal() as db:
        doc = (
            await db.execute(select(Document).where(Document.id == document_id))
        ).scalar_one_or_none()
        if doc is None:
            logger.error("process_document: %s not found", document_id)
            return
        doc.status = "processing"
        await db.commit()

        try:
            llm = get_llm()
            data = await get_storage().read(doc.storage_path)

            digital_text = _pdf_text(data) if doc.mime_type == "application/pdf" else ""

            # Prepend user note to help the model classify ambiguous files
            # (e.g. "weight loss progress photo, June 2024")
            note_hint = f"USER NOTE: {doc.note}\n\n" if doc.note else ""
            prompt_with_note = note_hint + EXTRACTION_PROMPT

            if len(digital_text.strip()) >= MIN_DIGITAL_TEXT_CHARS:
                raw_out = await llm.complete(
                    [{"role": "user", "content": f"{prompt_with_note}\n\nDOCUMENT TEXT:\n{digital_text[:30000]}"}]
                )
                extracted = _parse_extraction(raw_out)
                full_text = digital_text
            else:
                raw_out = await llm.extract_document(data, doc.mime_type, prompt_with_note)
                extracted = _parse_extraction(raw_out)
                full_text = extracted.get("full_text") or extracted.get("summary") or ""

            doc.document_type = extracted.get("document_type") or "other"
            doc.report_date = _parse_date(extracted.get("report_date"))
            doc.lab_name = (extracted.get("lab_name") or None) and str(extracted["lab_name"])[:255]
            doc.summary = extracted.get("summary")
            doc.raw_text = full_text[:200000] if full_text else None
            doc.structured_data = extracted.get("key_values") or {}
            doc.extraction_model = llm.name
            await db.commit()

            if full_text:
                await index_document(db, doc, full_text)

            doc.status = "ready"
            doc.error = None
            await db.commit()
            logger.info("Document %s processed (%s)", doc.id, doc.document_type)
        except Exception as exc:
            logger.exception("Document %s processing failed", document_id)
            await db.rollback()
            doc.status = "failed"
            doc.error = str(exc)[:1000]
            await db.commit()
