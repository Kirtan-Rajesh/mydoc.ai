"""Async database engine and session management.

SQLite (aiosqlite) for local dev, Postgres (asyncpg) in production —
the same code path serves both.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import settings


class Base(DeclarativeBase):
    pass


_is_sqlite = settings.DATABASE_URL.startswith("sqlite")


def _connect_args() -> dict:
    if _is_sqlite or not settings.DB_SSL:
        return {}
    # Encrypt-without-verify: RDS signs with the Amazon CA, which isn't in
    # the default trust store. Ship the RDS CA bundle and verify when
    # compliance requires it.
    import ssl

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return {"ssl": ctx}


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    connect_args=_connect_args(),
    # SQLite: NullPool avoids event-loop affinity issues and connects are cheap.
    # Postgres: small pool — many app instances share one DB.
    **(
        {"poolclass": NullPool}
        if _is_sqlite
        else {"pool_pre_ping": True, "pool_size": 5, "max_overflow": 5}
    ),
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create tables on startup. Fine for MVP; move to Alembic when the
    schema starts changing under live traffic."""
    from app import models  # noqa: F401  (register models with Base)

    async with engine.begin() as conn:
        if _is_sqlite:
            from sqlalchemy import text

            await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.run_sync(Base.metadata.create_all)
