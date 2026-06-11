"""Document upload, processing pipeline (echo provider), download, delete."""

import asyncio

from httpx import AsyncClient

# Tiny valid 1x1 PNG.
PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d4944415478da63fcffff3f030005fe02fea7569ea70000000049454e44ae426082"
)


def _make_pdf_with_text() -> bytes:
    """Digital PDF containing enough text to take the pypdf (non-vision) path."""
    import io

    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=595, height=842)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


async def _wait_ready(client: AsyncClient, doc_id: str, timeout: float = 10) -> dict:
    for _ in range(int(timeout / 0.1)):
        resp = await client.get(f"/api/v1/documents/{doc_id}")
        body = resp.json()
        if body["status"] in ("ready", "failed"):
            return body
        await asyncio.sleep(0.1)
    return body


async def test_upload_png_and_process(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/documents",
        files={"file": ("scan.png", PNG_BYTES, "image/png")},
    )
    assert resp.status_code == 201, resp.text
    doc = resp.json()
    assert doc["status"] == "uploaded"

    final = await _wait_ready(auth_client, doc["id"])
    assert final["status"] == "ready", final.get("error")
    assert final["document_type"] is not None
    assert final["summary"]


async def test_upload_pdf(auth_client: AsyncClient):
    pdf = _make_pdf_with_text()
    resp = await auth_client.post(
        "/api/v1/documents", files={"file": ("report.pdf", pdf, "application/pdf")}
    )
    assert resp.status_code == 201
    final = await _wait_ready(auth_client, resp.json()["id"])
    assert final["status"] == "ready", final.get("error")


async def test_reject_bad_mime(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/documents", files={"file": ("x.exe", b"MZ...", "application/octet-stream")}
    )
    assert resp.status_code == 415


async def test_reject_empty_file(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/documents", files={"file": ("empty.png", b"", "image/png")}
    )
    assert resp.status_code == 400


async def test_list_and_download(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/documents", files={"file": ("a.png", PNG_BYTES, "image/png")}
    )
    doc_id = resp.json()["id"]

    resp = await auth_client.get("/api/v1/documents")
    assert any(d["id"] == doc_id for d in resp.json())

    resp = await auth_client.get(f"/api/v1/documents/{doc_id}/download")
    assert resp.status_code == 200
    assert resp.content == PNG_BYTES


async def test_delete_document(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/documents", files={"file": ("b.png", PNG_BYTES, "image/png")}
    )
    doc_id = resp.json()["id"]
    assert (await auth_client.delete(f"/api/v1/documents/{doc_id}")).status_code == 204
    assert (await auth_client.get(f"/api/v1/documents/{doc_id}")).status_code == 404


async def test_cannot_access_other_users_document(auth_client: AsyncClient, client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/documents", files={"file": ("c.png", PNG_BYTES, "image/png")}
    )
    doc_id = resp.json()["id"]

    # Second user
    phone = "+919811111111"
    resp = await client.post("/api/v1/auth/request-otp", json={"phone": phone})
    otp = resp.json()["dev_otp"]
    resp = await client.post("/api/v1/auth/verify-otp", json={"phone": phone, "otp": otp})
    other_token = resp.json()["access_token"]

    resp = await client.get(
        f"/api/v1/documents/{doc_id}", headers={"Authorization": f"Bearer {other_token}"}
    )
    assert resp.status_code == 404
