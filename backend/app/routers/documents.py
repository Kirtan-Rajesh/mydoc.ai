"""Document upload, listing, detail, download, delete.

Upload is multipart straight to the API (simple, works everywhere); the file
is persisted via the storage backend and processed in the background.
"""

import os

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.responses import RedirectResponse, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models import Document, Subscription, User
from app.schemas import DocumentDetail, DocumentOut
from app.security import get_current_user
from app.services.ocr import process_document
from app.services.storage import get_storage

router = APIRouter()


async def _get_owned_document(db: AsyncSession, user: User, document_id: str) -> Document:
    doc = (
        await db.execute(
            select(Document).where(
                Document.id == document_id,
                Document.user_id == user.id,
                Document.is_deleted.is_(False),
            )
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    member_id: str | None = Form(default=None),
    note: str | None = Form(default=None, max_length=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in settings.ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type {file.content_type}. Allowed: PDF, JPEG, PNG, WebP.",
        )
    data = await file.read()
    if len(data) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    # Free-plan document cap.
    sub = (
        await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    ).scalar_one_or_none()
    if sub is None or sub.plan == "free":
        count = (
            await db.execute(
                select(func.count(Document.id)).where(
                    Document.user_id == user.id, Document.is_deleted.is_(False)
                )
            )
        ).scalar_one()
        if count >= settings.FREE_PLAN_DOC_LIMIT:
            raise HTTPException(
                status_code=402,
                detail=f"Free plan allows {settings.FREE_PLAN_DOC_LIMIT} documents. Upgrade to add more.",
            )

    doc = Document(
        user_id=user.id,
        member_id=member_id,
        note=note,
        file_name=file.filename or "document",
        mime_type=file.content_type,
        file_size_bytes=len(data),
        storage_path="",
    )
    db.add(doc)
    await db.flush()

    ext = os.path.splitext(file.filename or "")[1][:10] or ""
    doc.storage_path = await get_storage().save(f"{user.id}/{doc.id}{ext}", data, file.content_type)
    await db.commit()
    await db.refresh(doc)

    background.add_task(process_document, doc.id)
    return doc


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    member_id: str | None = None,
    document_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Document)
        .where(Document.user_id == user.id, Document.is_deleted.is_(False))
        .order_by(Document.created_at.desc())
        .limit(min(limit, 100))
        .offset(offset)
    )
    if member_id:
        query = query.where(Document.member_id == member_id)
    if document_type:
        query = query.where(Document.document_type == document_type)
    return (await db.execute(query)).scalars().all()


@router.get("/{document_id}", response_model=DocumentDetail)
async def get_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_owned_document(db, user, document_id)


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await _get_owned_document(db, user, document_id)
    storage = get_storage()
    url = await storage.download_url(doc.storage_path)
    if url:
        return RedirectResponse(url, status_code=307)
    data = await storage.read(doc.storage_path)
    return Response(
        content=data,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'inline; filename="{doc.file_name}"'},
    )


@router.post("/{document_id}/reprocess", response_model=DocumentOut)
async def reprocess_document(
    document_id: str,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await _get_owned_document(db, user, document_id)
    doc.status = "uploaded"
    await db.commit()
    await db.refresh(doc)
    background.add_task(process_document, doc.id)
    return doc


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await _get_owned_document(db, user, document_id)
    doc.is_deleted = True
    await db.commit()
