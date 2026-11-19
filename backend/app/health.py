"""Liveness and readiness probes.

`/health` is a liveness probe: it never touches the database, so it
always answers 200 while the process is alive.

`/ready` is a readiness probe: it pings the database and checks that
the schema is the one the backend expects. It answers 503 when
Postgres is unreachable or when a migration was not applied, and it
says which tables are missing. It never answers 500: a probe that
raises is a probe that cannot tell an orchestrator what to do.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.db import session as db_session
from app.db.schema_check import SchemaStatus, schema_status

logger = logging.getLogger("lumen.health")

router = APIRouter(tags=["health"])


def _degraded(
    detail: str,
    *,
    database: bool,
    missing: tuple[str, ...] = (),
) -> JSONResponse:
    """A 503 with the same shape every failure uses."""
    content: dict[str, object] = {
        "status": "degraded",
        "database": database,
        "detail": detail,
    }
    if missing:
        content["missing_tables"] = list(missing)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=content,
        headers={"Cache-Control": "no-store"},
    )


async def _check_schema() -> SchemaStatus:
    """Open a session and ask whether the schema is the expected one."""
    async with db_session.get_sessionmaker()() as session:
        return await schema_status(session)


@router.get("/health", status_code=status.HTTP_200_OK)
def health() -> dict[str, str]:
    """Liveness probe. Always returns 200 if the process is up."""
    return {"status": "ok"}


@router.get("/ready", status_code=status.HTTP_200_OK)
async def ready() -> JSONResponse:
    """Readiness probe.

    Answers 503 when the database is unreachable or when its schema
    is out of date, with a message that says what to do about it.
    """
    database_ok = await db_session.check_database()

    if not database_ok:
        return _degraded(
            "The database is unreachable. Check DATABASE_URL and that "
            "the Supabase project is running.",
            database=False,
        )

    # The database answers; is its schema the one we expect?
    try:
        schema = await _check_schema()
    except Exception:
        # A misconfigured engine or a permission problem: the probe
        # reports it instead of raising, so the orchestrator sees a
        # not-ready instance rather than a broken one.
        logger.exception("Could not check the database schema")
        return _degraded(
            "The database answers, but the schema could not be checked. "
            "See the API logs for the cause.",
            database=True,
        )

    if not schema.ok:
        return _degraded(schema.message(), database=True, missing=schema.missing)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "ok", "database": True, "schema": "ok"},
        headers={"Cache-Control": "no-store"},
    )
