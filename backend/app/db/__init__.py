"""Data layer: engine, session factory and SQLAlchemy models.

The database is Postgres hosted by Supabase. Since Phase 0 the backend
connects directly with asyncpg instead of going through the PostgREST
SDK, so the Supabase Python client was removed from the dependencies.

Layout:

- `base`    — the DeclarativeBase and shared column helpers.
- `enums`   — Python enums mirroring the Postgres enum types.
- `models`  — one module per domain, all models registered on `Base`.
- `session` — the async engine, the session factory and the FastAPI
               dependency that yields a session.
"""

from __future__ import annotations

from app.db.base import Base
from app.db.session import (
    check_database,
    dispose_engine,
    get_db,
    get_engine,
    get_sessionmaker,
)

__all__ = [
    "Base",
    "check_database",
    "dispose_engine",
    "get_db",
    "get_engine",
    "get_sessionmaker",
]
