"""Verify the configured Postgres + S3 storage are reachable (reads backend/.env).

Run from backend/:  python scripts/verify_supabase.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402


async def test_db() -> bool:
    from sqlalchemy import text

    from app.db import engine

    try:
        async with engine.connect() as conn:
            version = (await conn.execute(text("select version()"))).scalar_one()
        print("DB OK:", version[:60])
        return True
    except Exception as exc:
        print(f"DB FAIL: {type(exc).__name__}: {exc}")
        return False


async def test_storage() -> bool:
    from app.services.storage import get_storage

    try:
        storage = get_storage()
        await storage.save("_healthcheck.txt", b"ok", "text/plain")
        data = await storage.read("_healthcheck.txt")
        await storage.delete("_healthcheck.txt")
        print(f"Storage OK ({settings.STORAGE_BACKEND}): roundtrip {data!r}")
        return True
    except Exception as exc:
        print(f"Storage FAIL: {type(exc).__name__}: {exc}")
        return False


async def main() -> int:
    db_ok = await test_db()
    st_ok = await test_storage()
    return 0 if (db_ok and st_ok) else 1


sys.exit(asyncio.run(main()))
