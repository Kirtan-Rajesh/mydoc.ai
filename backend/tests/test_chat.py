"""Chat SSE streaming with the offline echo provider."""

import json

from httpx import AsyncClient


def _parse_sse(text: str) -> list[dict]:
    events = []
    for line in text.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


async def test_chat_stream_new_conversation(auth_client: AsyncClient):
    resp = await auth_client.post("/api/v1/chat", json={"message": "What is hemoglobin?"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")

    events = _parse_sse(resp.text)
    types = [e["type"] for e in events]
    assert types[0] == "meta"
    assert "token" in types
    assert types[-1] == "done"

    conv_id = events[0]["conversation_id"]
    full_reply = "".join(e["content"] for e in events if e["type"] == "token")
    assert "hemoglobin" in full_reply.lower() or len(full_reply) > 0

    # Continue the same conversation
    resp = await auth_client.post(
        "/api/v1/chat", json={"message": "And what is normal range?", "conversation_id": conv_id}
    )
    assert resp.status_code == 200
    assert _parse_sse(resp.text)[0]["conversation_id"] == conv_id

    # History persisted: 2 user + 2 assistant messages
    resp = await auth_client.get(f"/api/v1/chat/conversations/{conv_id}/messages")
    roles = [m["role"] for m in resp.json()]
    assert roles.count("user") == 2
    assert roles.count("assistant") == 2


async def test_list_conversations(auth_client: AsyncClient):
    await auth_client.post("/api/v1/chat", json={"message": "Hello"})
    resp = await auth_client.get("/api/v1/chat/conversations")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_chat_unknown_conversation(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/v1/chat", json={"message": "hi", "conversation_id": "does-not-exist"}
    )
    assert resp.status_code == 404


async def test_empty_message_rejected(auth_client: AsyncClient):
    resp = await auth_client.post("/api/v1/chat", json={"message": ""})
    assert resp.status_code == 422
