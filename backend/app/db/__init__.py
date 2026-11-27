"""Data layer: engine, session factory and SQLAlchemy models.

The database is Postgres. The backend connects directly with asyncpg:
there is no SDK of a hosted service in the dependencies.

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
