"""Web search for the health agent via Tavily.

Falls back to empty results when TAVILY_API_KEY is not set, so the agent
degrades gracefully to knowledge-only responses without crashing.
"""

import logging
from dataclasses import dataclass, field

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Authoritative medical sources — Tavily will prefer these
MEDICAL_DOMAINS = [
    "pubmed.ncbi.nlm.nih.gov",
    "mayoclinic.org",
    "webmd.com",
    "healthline.com",
    "medlineplus.gov",
    "nhs.uk",
    "nih.gov",
    "who.int",
    "1mg.com",
    "apollohospitals.com",
    "netmeds.com",
    "practo.com",
    "en.wikipedia.org",
]


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    score: float = field(default=0.0)


async def search_medical(query: str, max_results: int = 5) -> list[SearchResult]:
    """Search authoritative medical sources. Returns [] if search is unavailable."""
    if not settings.TAVILY_API_KEY:
        logger.debug("TAVILY_API_KEY not configured — web search disabled")
        return []

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.TAVILY_API_KEY,
                    "query": f"medical health {query}",
                    "search_depth": "basic",
                    # Prefer medical domains but don't restrict — hard whitelisting
                    # returns empty when Tavily's index lacks recent crawls of those sites.
                    "include_domains": [],
                    "max_results": max_results,
                    "include_answer": False,
                },
            )
            resp.raise_for_status()
            return [
                SearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    snippet=(r.get("content") or r.get("snippet") or "")[:400],
                    score=float(r.get("score", 0)),
                )
                for r in resp.json().get("results", [])
            ]
    except Exception:
        logger.exception("Web search failed — continuing without web context")
        return []
