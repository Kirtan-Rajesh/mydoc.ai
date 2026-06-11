"""In-memory sliding-window rate limiter.

Per-instance state is fine on Cloud Run: each instance enforces the limit for
the traffic it serves, which bounds aggregate throughput per user. Move to
Redis only if exact global limits become a requirement.
"""

import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import settings

_hits: dict[str, deque] = defaultdict(deque)
_EXEMPT = ("/health", "/api/docs", "/api/openapi.json", "/api/redoc")


async def rate_limit_middleware(request: Request, call_next):
    if not settings.RATE_LIMIT_ENABLED or request.url.path.startswith(_EXEMPT):
        return await call_next(request)

    # Key by bearer token when present (per user), else client IP.
    auth = request.headers.get("Authorization", "")
    key = auth[-40:] if auth else (request.client.host if request.client else "unknown")

    now = time.monotonic()
    window = _hits[key]
    cutoff = now - settings.RATE_LIMIT_WINDOW_SECS
    while window and window[0] < cutoff:
        window.popleft()
    if len(window) >= settings.RATE_LIMIT_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests, slow down."},
            headers={"Retry-After": str(settings.RATE_LIMIT_WINDOW_SECS)},
        )
    window.append(now)

    # Opportunistic cleanup so the map doesn't grow unbounded.
    if len(_hits) > 10000:
        stale = [k for k, dq in _hits.items() if not dq or dq[-1] < cutoff]
        for k in stale:
            del _hits[k]

    return await call_next(request)
