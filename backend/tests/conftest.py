"""pytest fixtures for the Lumen backend.

Phase 0 replaced the Supabase SDK with SQLAlchemy, so the tests no
longer mock a PostgREST client. They now run against a real Postgres
through the `db_session` fixture.

The database used by the test suite is configured by TEST_DATABASE_URL
(or DATABASE_URL). When it is not set, the tests that need it are
skipped rather than failing, so `pytest` stays useful for the
pure-logic tests (scoring, token issuance, schema drift).

To run the full suite against a real database:

    createdb lumen_test
    TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/lumen_test \\
        uv run pytest

Isolation model: the whole session-scoped schema is created once, and
each test runs inside a transaction that is rolled back at the end.
The HTTP client, however, uses its own connection pool, so writes it
performs are committed and survive the rollback. Tests that call the
API therefore use unique values (emails, short codes) so they do not
collide with each other.
"""

from __future__ import annotations

import os
import time
import uuid
from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-secret-key")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://localhost:8080")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-with-enough-entropy-for-hs256")
# The project JWT secret, used to mint the Storage/Realtime tokens.
os.environ.setdefault("SUPABASE_JWT_SECRET", "supabase-project-secret-for-testing-1234")

# The application builds its own engine from DATABASE_URL at startup
# (the schema check). Point it at the same database the fixtures use,
# so the startup check exercises the real path instead of logging a
# "not configured" warning on every TestClient boot.
if "DATABASE_URL" not in os.environ and os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]

TEST_JWT_SECRET = os.environ["JWT_SECRET"]
TEST_USER_ID = "11111111-1111-1111-1111-111111111111"
TEST_USER_EMAIL = "admin@example.com"
TEST_SCHOOL_ID = "22222222-2222-2222-2222-222222222222"


def mint_token(
    user_id: str = TEST_USER_ID,
    email: str = TEST_USER_EMAIL,
    *,
    secret: str | None = None,
    expires_in: int = 600,
    issuer: str = "lumen-api",
    audience: str = "lumen-frontend",
) -> str:
    """Create an access token signed the way the backend signs them.

    The keyword arguments make it possible to mint a token that is
    wrong in one specific way, which is what the rejection tests
    need.
    """
    now = int(time.time())
    return jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "aud": audience,
            "iss": issuer,
            "iat": now,
            "exp": now + expires_in,
            "jti": uuid.uuid4().hex,
        },
        secret or TEST_JWT_SECRET,
        algorithm="HS256",
    )


def mint_backend_token(
    user_id: str = TEST_USER_ID,
    email: str = TEST_USER_EMAIL,
    **kwargs: object,
) -> str:
    """Create an access token issued by the backend itself."""
    return mint_token(user_id, email, **kwargs)  # type: ignore[arg-type]


@pytest.fixture
def settings():
    """A real Settings instance from the env vars set above."""
    from app.config import get_settings

    get_settings.cache_clear()
    return get_settings()


@pytest.fixture(scope="session")
def database_url() -> str:
    """The Postgres URL the test suite runs against.

    Overridable with the TEST_DATABASE_URL environment variable.
    """
    url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip(
            "No database configured. Set TEST_DATABASE_URL (or DATABASE_URL) to "
            "run the database-backed tests."
        )
    # The engine is created with the asyncpg driver; a bare
    # postgresql:// URL would select the sync driver.
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


@pytest.fixture(scope="session")
def engine(database_url: str):
    """A session-scoped async engine bound to the test database.

    The engine is created without a pool: every session gets its own
    connection. That matters because the suite runs the HTTP client
    (a sync TestClient, driven from its own thread and event loop)
    and the async fixtures (pytest-asyncio's loop) against the same
    database. Sharing pooled connections across event loops makes
    asyncpg raise "another operation is in progress".

    The schema is created once and kept. Dropping it at the end of
    the run would leave the database empty for the next one, which
    makes the suite depend on the order in which the test files are
    run. The rows the tests create are removed by the fixtures that
    own them.
    """
    import asyncio

    from app.db.models import Base

    test_engine = create_async_engine(
        database_url,
        echo=False,
        poolclass=NullPool,
    )

    async def _create_schema() -> None:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # create_all must run inside an event loop; the fixture is
    # synchronous, so drive it with its own loop.
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_create_schema())
    finally:
        loop.close()

    yield test_engine


@pytest.fixture(scope="session")
def session_factory(engine) -> async_sessionmaker[AsyncSession]:
    """A session factory bound to the test engine."""
    return async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


@pytest.fixture
async def db_session(session_factory) -> AsyncIterator[AsyncSession]:
    """A database session for direct assertions in a test.

    Rows written through this session are rolled back at the end of
    the test, so they never leak into other tests.
    """
    async with session_factory() as session:
        transaction = await session.begin()
        try:
            yield session
        finally:
            await transaction.rollback()


@pytest.fixture
async def seeded_school(engine) -> AsyncIterator[UUID]:
    """A school plus a school_admin membership for the test user.

    The rows are committed, because the HTTP client reads through its
    own connection: a fixture-scoped transaction would be invisible to
    it. They are removed at the end of the test.
    """
    from app.db.enums import SchoolAdminRole, SchoolRole
    from app.db.models import School, SchoolMembership, User

    school_id = uuid.uuid4()
    user_id = UUID(TEST_USER_ID)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            School(
                id=school_id,
                name=f"Colegio {school_id.hex[:8]}",
                short_code=f"T{school_id.hex[:6].upper()}",
                status="active",
            )
        )
        # The test user is shared across tests, so it is created once
        # and reused. `on_conflict_do_nothing` keeps the fixture
        # idempotent when several tests run in sequence.
        await session.execute(
            pg_insert(User)
            .values(
                id=user_id,
                email=TEST_USER_EMAIL,
                password_hash="",
                full_name="Admin",
            )
            .on_conflict_do_nothing(index_elements=[User.id])
        )
        session.add(
            SchoolMembership(
                id=uuid.uuid4(),
                school_id=school_id,
                user_id=user_id,
                role=SchoolRole.SCHOOL_ADMIN,
                admin_role=SchoolAdminRole.PRINCIPAL,
                is_primary=True,
                joined_at=datetime.now(UTC),
            )
        )
        await session.commit()

    yield school_id

    # Clean up: the membership and the user are shared across tests,
    # so only the school-scoped rows are removed here.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            delete(SchoolMembership).where(SchoolMembership.school_id == school_id)
        )
        await session.execute(delete(School).where(School.id == school_id))
        await session.commit()


@pytest.fixture
def test_app(engine):
    """A FastAPI app whose database dependency yields the test engine.

    The routes open their own connections from the engine, so writes
    are committed for real. That mirrors production behaviour and is
    what the endpoint tests exercise.

    The engine uses a NullPool, so each request gets its own
    connection. That is required because the sync TestClient runs the
    app in its own thread and event loop, while the async fixtures
    run in pytest-asyncio's loop; a shared pooled connection would
    be used concurrently by two event loops.
    """
    from app.db.session import get_db
    from app.main import create_app

    app = create_app()

    async def _override_get_db():
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    return app


@pytest.fixture
def cleanup_users(engine):
    """A fixture that removes the rows the API endpoints create.

    The endpoints commit their writes, which is the production
    behaviour. Without this cleanup the rows leak from one test to the
    next and collide on the unique constraints.

    The cleanup runs both before and after the test: before, so that
    rows left by a previous run do not break the test; after, so that
    the next test starts clean.

    Only rows the tests created are removed. The tests use the
    `@example.com` domain for their email addresses, and the schools
    they create carry a name that starts with a known prefix.
    """
    from app.db.models import LoginAttempt, Plan, School, User

    async def _delete() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            # The schools first: they own the memberships, the
            # subscriptions and the entitlements.
            school_ids = (
                (
                    await session.execute(
                        select(School.id).where(
                            School.name.like("Colegio %")
                            | School.name.like("Context School %")
                            | School.name.like("Two School %")
                            | School.name.like("Same Name %")
                            | School.name.like("First School%")
                            | School.name.like("Second School%")
                            | School.name.like("Trial School%")
                            | School.name.like("Trial Range School%")
                            | School.name.like("Idempotent School%")
                            | School.name.like("A Different Name%")
                            | School.name.like("E2E Colegio %")
                        )
                    )
                )
                .scalars()
                .all()
            )

            if school_ids:
                await session.execute(delete(School).where(School.id.in_(school_ids)))

            await session.execute(delete(User).where(User.email.like("%@example.com")))
            # The trail of the sign-ins: the rows of one test would
            # rate-limit the next one.
            await session.execute(delete(LoginAttempt))
            # The plan catalog is reference data the tests seed
            # themselves.
            await session.execute(delete(Plan).where(Plan.code.like("p-%")))
            await session.commit()

    import asyncio

    def _run() -> None:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_delete())
        finally:
            loop.close()

    _run()
    yield
    _run()


@pytest.fixture
def client(test_app) -> Iterator[Any]:
    """A TestClient bound to the app."""
    with TestClient(test_app) as test_client:
        yield test_client


@pytest.fixture
def make_user(engine):
    """Create a user with a password, straight in the database.

    Nobody signs up on their own anymore, so the tests do not go
    through an endpoint that would create accounts.
    """
    from tests.support import create_test_user

    def _create(
        email: str,
        password: str = "a good password",
        full_name: str = "Test User",
    ) -> str:
        return create_test_user(
            engine,
            email=email,
            password=password,
            full_name=full_name,
        )

    return _create


@pytest.fixture
def platform_admin(engine) -> dict[str, str]:
    """An Authorization header for a platform admin.

    The platform team is the one that creates the schools, so the tests
    of that flow need a caller with the platform role.
    """
    import asyncio

    from app.db.enums import PlatformRoleKind
    from app.db.models import PlatformRole
    from tests.support import create_test_user

    email = "platform@example.com"
    user_id = create_test_user(
        engine,
        email=email,
        password="a good password",
        full_name="Platform Admin",
    )

    async def _grant() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            session.add(
                PlatformRole(
                    user_id=UUID(user_id),
                    role=PlatformRoleKind.PLATFORM_ADMIN,
                )
            )
            await session.commit()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_grant())
    finally:
        loop.close()

    return {"Authorization": f"Bearer {mint_token(user_id, email)}"}


@pytest.fixture
def auth_header() -> dict[str, str]:
    """A valid Authorization header for the test user."""
    return {"Authorization": f"Bearer {mint_token()}"}


@pytest.fixture
def backend_auth_header() -> dict[str, str]:
    """A valid Authorization header carrying a backend-issued token."""
    return {"Authorization": f"Bearer {mint_backend_token()}"}


@pytest.fixture
def test_user_id() -> UUID:
    """The uuid of the test user."""
    return UUID(TEST_USER_ID)


@pytest.fixture
def test_school_id() -> UUID:
    """The uuid of the test school."""
    return UUID(TEST_SCHOOL_ID)
