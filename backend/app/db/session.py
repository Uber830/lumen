"""Async engine and session factory.

The database is Postgres. The backend connects
directly with asyncpg through SQLAlchemy's async engine — the
PostgREST SDK is gone as of Phase 0.

Two important details for a hosted Postgres:

1. Prefer the *pooler* host over the direct host. The direct host
   usually accepts a handful of concurrent connections and is, in some
   projects, IPv6-only. The
   pooler runs in transaction mode, which suits a request/response
   backend: each request takes a connection, uses it for one
   transaction, and returns it.

2. `statement_cache_size=0`. PgBouncer (which fronts the pooler) does
   not support the extended-query protocol's named prepared statements.
   asyncpg's statement cache relies on named prepared statements, so it
   must be disabled or queries fail with "prepared statement already
   exists" on the second use of a connection.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import Settings, get_settings


def _build_engine(settings: Settings) -> AsyncEngine:
    """Create the async engine from settings."""
    url = settings.effective_database_url
    return create_async_engine(
        url,
        echo=settings.database_echo,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        pool_timeout=settings.database_pool_timeout,
        pool_pre_ping=True,
        connect_args={
            # Required for the transaction-mode pooler.
            "statement_cache_size": 0,
            "server_settings": {
                "application_name": "lumen-api",
            },
        },
    )


@lru_cache(maxsize=1)
def get_engine() -> AsyncEngine:
    """Return the process-wide async engine."""
    return _build_engine(get_settings())


@lru_cache(maxsize=1)
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """Return the process-wide session factory."""
    return async_sessionmaker(
        bind=get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields a database session.

    The session is rolled back on error and closed when the request
    finishes. Commits are explicit: the caller decides when a
    transaction ends, which matters for the endpoints that must write
    several rows atomically (attempt finalization, webhook processing).
    """
    session_factory = get_sessionmaker()
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def dispose_engine() -> None:
    """Close every pooled connection. Called from the app lifespan."""
    # The engine is built lazily. When it was never built there is
    # nothing to dispose, and building one just to close it would
    # raise if the database URL is not configured.
    if get_engine.cache_info().currsize == 0:
        get_sessionmaker.cache_clear()
        return

    engine = get_engine()
    get_sessionmaker.cache_clear()
    get_engine.cache_clear()
    await engine.dispose()


async def check_database() -> bool:
    """Return True if the database answers a trivial query.

    Used by the /ready probe. It never raises: an unconfigured or
    unreachable database is reported as "not ready", not as a crash.
    """
    from sqlalchemy import text

    try:
        engine = get_engine()
        async with engine.connect() as conn:
            await conn.execute(text("select 1"))
        return True
    except Exception:  # pragma: no cover - depends on live infrastructure
        return False
