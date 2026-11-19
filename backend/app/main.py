"""FastAPI application entrypoint.

The app is registered with uvicorn via the entry in pyproject.toml:
    lumen-api = "app.main:run"
or directly via:
    uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app import __version__
from app.academics.router import router as academics_router
from app.auth.router import router as auth_router
from app.chat.router import router as chat_router
from app.config import get_settings
from app.content.router import router as content_router
from app.core.errors import AppError, ServiceUnavailableError
from app.db.schema_check import SchemaOutOfDateError, verify_schema
from app.db.session import dispose_engine, get_sessionmaker
from app.evaluations.router import router as evaluations_router
from app.grades.router import router as grades_router
from app.health import router as health_router
from app.icfes.authoring_router import router as icfes_authoring_router
from app.icfes.comparisons import router as icfes_comparisons_router
from app.icfes.router import router as icfes_router
from app.notifications.router import router as notifications_router
from app.plans.router import router as plans_router
from app.schools.router import router as schools_router
from app.site.router import router as site_router
from app.subscriptions.router import router as subscriptions_router
from app.subscriptions.webhooks import router as webhooks_router
from app.tasks.router import router as tasks_router
from app.users.router import router as users_router

logger = logging.getLogger("lumen")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Startup and shutdown hooks.

    On startup the settings are validated (a production deployment
    with the development JWT secret fails fast) and the schema is
    checked. A missing migration stops the process: it is a
    deployment problem, and failing every request with a 500 hides
    it.

    On shutdown the connection pool is closed.
    """
    settings = get_settings()
    settings.assert_production_secrets()

    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    logger.info("Lumen backend starting", extra={"version": __version__})
    try:
        await _check_schema()
        yield
    finally:
        try:
            await dispose_engine()
        except Exception:  # pragma: no cover - best-effort cleanup
            logger.warning("Failed to close the database pool cleanly", exc_info=True)
        logger.info("Lumen backend shutting down")


async def _check_schema() -> None:
    """Verify the database has the schema the backend needs."""
    try:
        async with get_sessionmaker()() as session:
            await verify_schema(session)
    except SchemaOutOfDateError:
        # A missing migration is a deployment problem. Stop the
        # process instead of failing every request with a 500.
        logger.error("The database schema is out of date", exc_info=True)
        raise
    except ServiceUnavailableError as exc:
        # The process stays up so /ready can say what is missing; every
        # request that needs the database answers 503 until then.
        logger.error("%s", exc.detail)
    except Exception:
        # The database being unreachable is not fatal at startup: the
        # readiness probe reports it, and a database that comes back
        # should not require a restart.
        logger.warning("Could not verify the database schema at startup", exc_info=True)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Lumen API",
        version=__version__,
        description=(
            "Backend for Lumen. Owns authentication, authorization "
            "and every business operation; the browser talks only to "
            "this API. Postgres (hosted by Supabase) is the datastore; "
            "Supabase Storage and Realtime remain in use for file "
            "uploads and live chat."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        """Map domain errors to their HTTP representation."""
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload())

    @app.exception_handler(OperationalError)
    async def handle_database_unavailable(_: Request, exc: OperationalError) -> JSONResponse:
        """Turn "Postgres is not answering" into a 503, not a 500.

        A paused Supabase project, an exhausted connection pool or a
        network hiccup is an availability problem; the client should
        retry later instead of treating the request as a bug.
        """
        logger.error("The database is unavailable", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": (
                    "La base de datos no está disponible en este momento. "
                    "Intentá de nuevo en unos segundos."
                ),
                "code": "service_unavailable",
            },
            headers={"Retry-After": "5"},
        )

    app.include_router(health_router)
    app.include_router(site_router)
    app.include_router(auth_router)
    app.include_router(academics_router)
    app.include_router(content_router)
    app.include_router(tasks_router)
    app.include_router(grades_router)
    app.include_router(evaluations_router)
    app.include_router(icfes_authoring_router)
    app.include_router(chat_router)
    app.include_router(notifications_router)
    app.include_router(plans_router)
    app.include_router(schools_router)
    app.include_router(users_router)
    app.include_router(subscriptions_router)
    app.include_router(webhooks_router)
    app.include_router(icfes_router)
    app.include_router(icfes_comparisons_router)

    return app


app = create_app()


def run() -> None:
    """Entry point for the 'lumen-api' script."""
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        # Port 8010, not the usual 8000: the EduSuite stack keeps 8000
        # on this machine and both projects can run at the same time.
        port=8010,
        proxy_headers=True,
    )
