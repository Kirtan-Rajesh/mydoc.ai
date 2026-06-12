"""Medication CRUD + dose logs."""

from httpx import AsyncClient


async def test_medication_crud(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/medications",
        json={
            "name": "Metformin",
            "dosage": "500mg",
            "instructions": "After food",
            "times": ["08:00", "20:00"],
            "start_date": "2026-06-01",
        },
    )
    assert resp.status_code == 201, resp.text
    med = resp.json()
    assert med["times"] == ["08:00", "20:00"]

    resp = await auth_client.get("/api/v1/medications")
    assert any(m["id"] == med["id"] for m in resp.json())

    resp = await auth_client.patch(
        f"/api/v1/medications/{med['id']}", json={"dosage": "850mg", "is_active": False}
    )
    assert resp.json()["dosage"] == "850mg"

    # Inactive meds hidden by default
    resp = await auth_client.get("/api/v1/medications")
    assert not any(m["id"] == med["id"] for m in resp.json())
    resp = await auth_client.get("/api/v1/medications?active_only=false")
    assert any(m["id"] == med["id"] for m in resp.json())

    assert (await auth_client.delete(f"/api/v1/medications/{med['id']}")).status_code == 204


async def test_invalid_time_format(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/medications", json={"name": "X", "times": ["25:99"]}
    )
    assert resp.status_code == 422


async def test_dose_logging(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/medications", json={"name": "Vitamin D", "times": ["09:00"]}
    )
    med_id = resp.json()["id"]

    resp = await auth_client.post(
        f"/api/v1/medications/{med_id}/logs",
        json={"scheduled_for": "2026-06-11T09:00:00Z", "status": "taken"},
    )
    assert resp.status_code == 201

    # Idempotent: same slot updates instead of duplicating
    resp = await auth_client.post(
        f"/api/v1/medications/{med_id}/logs",
        json={"scheduled_for": "2026-06-11T09:00:00Z", "status": "skipped"},
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "skipped"

    resp = await auth_client.get(f"/api/v1/medications/{med_id}/logs")
    assert len(resp.json()) == 1


async def test_todays_doses(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/medications",
        json={"name": "Telmisartan", "dosage": "40mg", "times": ["08:00", "21:00"]},
    )
    med_id = resp.json()["id"]

    resp = await auth_client.get("/api/v1/medications/today")
    assert resp.status_code == 200
    doses = [d for d in resp.json() if d["medication_id"] == med_id]
    assert [d["time"] for d in doses] == ["08:00", "21:00"]
    assert all(d["status"] == "pending" for d in doses)

    # Mark the morning dose taken -> reflected in /today
    sched = doses[0]["scheduled_for"]
    await auth_client.post(
        f"/api/v1/medications/{med_id}/logs",
        json={"scheduled_for": sched, "status": "taken"},
    )
    resp = await auth_client.get("/api/v1/medications/today")
    statuses = {d["time"]: d["status"] for d in resp.json() if d["medication_id"] == med_id}
    assert statuses["08:00"] == "taken"
    assert statuses["21:00"] == "pending"


async def test_subscription_endpoint(auth_client: AsyncClient):
    resp = await auth_client.get("/api/v1/subscriptions/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["plan"] == "free"
    assert body["limits"]["documents"] == 25
