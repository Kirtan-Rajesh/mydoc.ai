"""LLM provider abstraction.

One interface for chat (streaming + complete), embeddings, and vision
extraction. The active provider and model names come from env config, so
switching to a better/cheaper model later is a config change, not a code
change.

Providers:
- GeminiProvider — Google Gemini REST API via httpx. gemini-2.0-flash is the
  cost floor for a capable multimodal model and handles Indian languages well.
- EchoProvider  — deterministic offline provider so dev/tests/CI need no key.
"""

import asyncio
import base64
import hashlib
import json
import logging
import math
from abc import ABC, abstractmethod
from typing import AsyncIterator

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def chat_stream(
        self, messages: list[dict], system: str | None = None
    ) -> AsyncIterator[str]:
        """messages: [{"role": "user"|"assistant", "content": str}, ...]"""
        ...

    async def complete(self, messages: list[dict], system: str | None = None) -> str:
        out: list[str] = []
        async for token in self.chat_stream(messages, system):
            out.append(token)
        return "".join(out)

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        ...

    @abstractmethod
    async def extract_document(self, data: bytes, mime_type: str, prompt: str) -> str:
        """Vision/multimodal extraction: returns model text output."""
        ...


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self) -> None:
        self._key = settings.GEMINI_API_KEY

    async def chat_stream(
        self, messages: list[dict], system: str | None = None
    ) -> AsyncIterator[str]:
        contents = [
            {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
            for m in messages
        ]
        body: dict = {"contents": contents}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        url = f"{GEMINI_BASE}/models/{settings.CHAT_MODEL}:streamGenerateContent"
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", url, params={"alt": "sse", "key": self._key}, json=body
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    try:
                        chunk = json.loads(line[6:])
                        for part in chunk["candidates"][0]["content"]["parts"]:
                            if part.get("text"):
                                yield part["text"]
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # gemini-embedding-001 exposes embedContent (not batchEmbedContents);
        # call per text with bounded concurrency.
        url = f"{GEMINI_BASE}/models/{settings.EMBED_MODEL}:embedContent"
        sem = asyncio.Semaphore(8)

        async def one(client: httpx.AsyncClient, text: str) -> list[float]:
            async with sem:
                resp = await client.post(
                    url,
                    params={"key": self._key},
                    json={
                        "model": f"models/{settings.EMBED_MODEL}",
                        "content": {"parts": [{"text": text[:8000]}]},
                        "outputDimensionality": settings.EMBED_DIM,
                    },
                )
                resp.raise_for_status()
                return resp.json()["embedding"]["values"]

        async with httpx.AsyncClient(timeout=60) as client:
            return list(await asyncio.gather(*(one(client, t) for t in texts)))

    async def extract_document(self, data: bytes, mime_type: str, prompt: str) -> str:
        url = f"{GEMINI_BASE}/models/{settings.VISION_MODEL}:generateContent"
        body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"inlineData": {"mimeType": mime_type, "data": base64.b64encode(data).decode()}},
                        {"text": prompt},
                    ],
                }
            ]
        }
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(url, params={"key": self._key}, json=body)
            resp.raise_for_status()
            payload = resp.json()
            return payload["candidates"][0]["content"]["parts"][0]["text"]


class EchoProvider(LLMProvider):
    """Offline provider: deterministic outputs, hash-based embeddings.
    Keeps the entire platform runnable and testable with zero API keys."""

    name = "echo"

    async def chat_stream(
        self, messages: list[dict], system: str | None = None
    ) -> AsyncIterator[str]:
        last = messages[-1]["content"] if messages else ""
        reply = (
            "[offline dev mode] I received your message: "
            f"\"{last[:200]}\". Configure GEMINI_API_KEY to enable real AI responses."
        )
        for word in reply.split(" "):
            yield word + " "

    async def embed(self, texts: list[str]) -> list[list[float]]:
        dim = 64
        vectors = []
        for text in texts:
            vec = [0.0] * dim
            for token in text.lower().split():
                h = int.from_bytes(hashlib.md5(token.encode()).digest()[:4], "big")
                vec[h % dim] += 1.0
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            vectors.append([v / norm for v in vec])
        return vectors

    async def extract_document(self, data: bytes, mime_type: str, prompt: str) -> str:
        return json.dumps(
            {
                "document_type": "other",
                "report_date": None,
                "lab_name": None,
                "summary": "[offline dev mode] Document stored; AI extraction requires GEMINI_API_KEY.",
                "key_values": {},
            }
        )


_provider: LLMProvider | None = None


def get_llm() -> LLMProvider:
    global _provider
    if _provider is None:
        choice = settings.LLM_PROVIDER
        if choice == "auto":
            choice = "gemini" if settings.GEMINI_API_KEY else "echo"
        if choice == "gemini":
            _provider = GeminiProvider()
        else:
            _provider = EchoProvider()
        logger.info("LLM provider: %s (chat=%s)", _provider.name, settings.CHAT_MODEL)
    return _provider


def reset_llm() -> None:
    """For tests/config reloads."""
    global _provider
    _provider = None
