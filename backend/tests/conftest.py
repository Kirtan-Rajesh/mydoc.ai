"""Test fixtures: temp SQLite DB, temp upload dir, offline echo LLM."""

import itertools
import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="mydoc-test-")
os.environ.update(
    {
        "DATABASE_URL": f"sqlite+aiosqlite:///{_tmp}/test.db",
        "UPLOAD_DIR": f"{_tmp}/uploads",
        "LLM_PROVIDER": "echo",
        "SMS_PROVIDER": "console",
        "DEBUG": "true",
        "RATE_LIMIT_ENABLED": "false",
        "STORAGE_BACKEND": "local",
    }
)

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402

_phone_counter = itertools.count(1)


@pytest.fixture
async def client():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
async def auth_client(client: AsyncClient):
    """Client with a fresh authenticated user (new phone per test)."""
    phone = f"+9198765{next(_phone_counter):05d}"
    resp = await client.post("/api/v1/auth/request-otp", json={"phone": phone})
    assert resp.status_code == 200, resp.text
    otp = resp.json()["dev_otp"]
    assert otp, "dev_otp should be returned in DEBUG + console mode"
    resp = await client.post(
        "/api/v1/auth/verify-otp", json={"phone": phone, "otp": otp, "name": "Test User"}
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
