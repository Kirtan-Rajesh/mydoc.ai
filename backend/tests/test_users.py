"""Users, profile, family members."""

from httpx import AsyncClient


async def test_me(auth_client: AsyncClient):
    resp = await auth_client.get("/api/v1/users/me")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test User"


async def test_update_me(auth_client: AsyncClient):
    resp = await auth_client.patch(
        "/api/v1/users/me", json={"name": "Updated", "language_pref": "hi"}
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated"
    assert resp.json()["language_pref"] == "hi"

    resp = await auth_client.patch("/api/v1/users/me", json={"language_pref": "xx"})
    assert resp.status_code == 422


async def test_profile_roundtrip(auth_client: AsyncClient):
    resp = await auth_client.get("/api/v1/users/me/profile")
    assert resp.status_code == 200

    resp = await auth_client.put(
        "/api/v1/users/me/profile",
        json={
            "date_of_birth": "1985-03-12",
            "gender": "female",
            "blood_group": "O+",
            "height_cm": 162.5,
            "weight_kg": 58,
            "medical_conditions": ["diabetes type 2"],
            "allergies": ["penicillin"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["blood_group"] == "O+"
    assert body["medical_conditions"] == ["diabetes type 2"]


async def test_family_crud(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/users/me/family",
        json={"name": "Ravi", "relation": "parent", "date_of_birth": "1955-01-01"},
    )
    assert resp.status_code == 201
    member_id = resp.json()["id"]

    resp = await auth_client.get("/api/v1/users/me/family")
    assert any(m["id"] == member_id for m in resp.json())

    resp = await auth_client.delete(f"/api/v1/users/me/family/{member_id}")
    assert resp.status_code == 204

    resp = await auth_client.get("/api/v1/users/me/family")
    assert not any(m["id"] == member_id for m in resp.json())


async def test_push_token(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/users/me/push-tokens",
        json={"token": "fcm-token-abcdef123456", "platform": "android"},
    )
    assert resp.status_code == 204
