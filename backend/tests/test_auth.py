"""Auth flow: OTP request/verify, token validation."""

from httpx import AsyncClient


async def test_health(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


async def test_otp_signup_flow(client: AsyncClient):
    phone = "+919800000001"
    resp = await client.post("/api/v1/auth/request-otp", json={"phone": phone})
    assert resp.status_code == 200
    otp = resp.json()["dev_otp"]
    assert len(otp) == 6

    resp = await client.post(
        "/api/v1/auth/verify-otp", json={"phone": phone, "otp": otp, "name": "Asha"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["is_new_user"] is True

    # Same phone again -> existing user
    resp = await client.post("/api/v1/auth/request-otp", json={"phone": phone})
    otp2 = resp.json()["dev_otp"]
    resp = await client.post("/api/v1/auth/verify-otp", json={"phone": phone, "otp": otp2})
    assert resp.json()["is_new_user"] is False


async def test_wrong_otp_rejected(client: AsyncClient):
    phone = "+919800000002"
    await client.post("/api/v1/auth/request-otp", json={"phone": phone})
    resp = await client.post("/api/v1/auth/verify-otp", json={"phone": phone, "otp": "000000"})
    assert resp.status_code == 401


async def test_otp_single_use(client: AsyncClient):
    phone = "+919800000003"
    resp = await client.post("/api/v1/auth/request-otp", json={"phone": phone})
    otp = resp.json()["dev_otp"]
    assert (await client.post("/api/v1/auth/verify-otp", json={"phone": phone, "otp": otp})).status_code == 200
    assert (await client.post("/api/v1/auth/verify-otp", json={"phone": phone, "otp": otp})).status_code == 401


async def test_invalid_phone_format(client: AsyncClient):
    resp = await client.post("/api/v1/auth/request-otp", json={"phone": "12345"})
    assert resp.status_code == 422


async def test_protected_route_requires_token(client: AsyncClient):
    client.headers.pop("Authorization", None)
    resp = await client.get("/api/v1/users/me")
    assert resp.status_code == 401

    resp = await client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert resp.status_code == 401
