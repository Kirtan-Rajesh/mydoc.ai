"""Per-user RAG: chunking, embedding storage, and retrieval.

Retrieval is always scoped to one user's documents — typically tens to a few
hundred chunks — so an in-process cosine scan beats running a vector database.
If a future use case needs cross-user search, swap this module for pgvector
without touching callers.
"""

import math

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Document, DocumentChunk
from app.services.llm import get_llm


def chunk_text(text: str) -> list[str]:
    size, overlap = settings.CHUNK_SIZE_CHARS, settings.CHUNK_OVERLAP_CHARS
    text = text.strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        # Prefer to break at a newline/sentence boundary near the end.
        if end < len(text):
            window = text.rfind("\n", start + size // 2, end)
            if window == -1:
                window = text.rfind(". ", start + size // 2, end)
            if window != -1:
                end = window + 1
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return [c for c in chunks if c]


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


async def index_document(db: AsyncSession, document: Document, text: str) -> int:
    """Chunk + embed extracted text and persist. Returns chunk count."""
    chunks = chunk_text(text)
    if not chunks:
        return 0
    embeddings = await get_llm().embed(chunks)
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        db.add(
            DocumentChunk(
                document_id=document.id,
                user_id=document.user_id,
                chunk_index=i,
                text=chunk,
                embedding=emb,
            )
        )
    await db.commit()
    return len(chunks)


async def retrieve(
    db: AsyncSession, user_id: str, query: str, top_k: int | None = None
) -> list[dict]:
    """Top-k chunks from this user's documents with doc metadata attached."""
    top_k = top_k or settings.RAG_TOP_K
    query_emb = (await get_llm().embed([query]))[0]

    rows = (
        await db.execute(
            select(DocumentChunk, Document.file_name, Document.document_type, Document.report_date)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(DocumentChunk.user_id == user_id, Document.is_deleted.is_(False))
            .order_by(DocumentChunk.id)
            .limit(3000)
        )
    ).all()

    scored = [
        {
            "document_id": chunk.document_id,
            "file_name": file_name,
            "document_type": doc_type,
            "report_date": str(report_date) if report_date else None,
            "text": chunk.text,
            "score": _cosine(query_emb, chunk.embedding or []),
        }
        for chunk, file_name, doc_type, report_date in rows
    ]
    scored.sort(key=lambda c: c["score"], reverse=True)
    return [c for c in scored[:top_k] if c["score"] > 0.05]
