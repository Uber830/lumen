"""Health endpoint tests.

`/health` is a liveness probe: it never touches the database, so it
always answers 200 while the process is alive.

`/ready` is a readiness probe: it pings the database and checks that
the schema is the one the backend expects, so it answers 503 when
Postgres is unreachable, when a migration was not applied, or when
the schema cannot be checked at all.
"""

from __future__ import annotations

from app.db.schema_check import SchemaStatus


def test_health_returns_200(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body == {"status": "ok"}


def test_ready_reports_the_database_status(client, monkeypatch):
    """`/ready` reflects the database reachability without raising."""
    from app.db import session as session_module

    async def _ok() -> bool:
        return True

    async def _status() -> SchemaStatus:
        return SchemaStatus(ok=True)

    monkeypatch.setattr(session_module, "check_database", _ok)
    monkeypatch.setattr("app.health._check_schema", _status)

    response = client.get("/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] is True
    assert body["schema"] == "ok"


def test_ready_returns_503_when_the_database_is_down(client, monkeypatch):
    """An unreachable database makes the instance not-ready, not broken."""
    from app.db import session as session_module

    async def _down() -> bool:
        return False

    monkeypatch.setattr(session_module, "check_database", _down)

    response = client.get("/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["database"] is False


def test_ready_reports_a_missing_migration(client, monkeypatch):
    """A database without the migrations is not ready.

    This is the failure the user hits when a migration was not
    applied: the endpoints answer 500 with
    `relation "public.users" does not exist`. The readiness probe has
    to say so plainly.
    """
    from app.db import session as session_module

    async def _ok() -> bool:
        return True

    async def _status() -> SchemaStatus:
        return SchemaStatus(ok=False, missing=("users", "refresh_tokens"))

    monkeypatch.setattr(session_module, "check_database", _ok)
    monkeypatch.setattr("app.health._check_schema", _status)

    response = client.get("/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["database"] is True
    assert body["missing_tables"] == ["users", "refresh_tokens"]
    assert "The SQL migrations have not been applied" in body["detail"]


def test_ready_never_raises_when_the_schema_check_fails(client, monkeypatch):
    """A probe that raises cannot tell an orchestrator what to do."""
    from app.db import session as session_module

    async def _ok() -> bool:
        return True

    async def _boom() -> SchemaStatus:
        raise RuntimeError("the engine is misconfigured")

    monkeypatch.setattr(session_module, "check_database", _ok)
    monkeypatch.setattr("app.health._check_schema", _boom)

    response = client.get("/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["database"] is True


def test_a_missing_database_url_is_a_503_not_a_500():
    """An unconfigured server is unavailable, and says what to set.

    This was the bug behind a bare 500 on `POST /v1/auth/register`:
    `DATABASE_URL` was empty, and the failure surfaced as "Internal
    Server Error" with nothing to act on.
    """
    import pytest

    from app.config import Settings
    from app.core.errors import ServiceUnavailableError

    settings = Settings(database_url="", database_url_override=None)
    with pytest.raises(ServiceUnavailableError) as caught:
        _ = settings.effective_database_url

    assert caught.value.status_code == 503
    assert "DATABASE_URL" in caught.value.detail


def test_a_database_outage_is_a_503_with_a_retry_hint():
    """Postgres not answering is an availability problem, not a bug."""
    from fastapi.testclient import TestClient
    from sqlalchemy.exc import OperationalError

    from app.main import create_app

    app = create_app()

    @app.get("/boom")
    def _boom() -> None:
        raise OperationalError("select 1", {}, Exception("connection refused"))

    with TestClient(app) as test_client:
        response = test_client.get("/boom")

    assert response.status_code == 503
    assert response.headers["retry-after"] == "5"
    assert response.json()["code"] == "service_unavailable"
