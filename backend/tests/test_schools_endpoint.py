"""HTTP-level tests for the school bootstrap endpoint."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import SchoolRole, SubscriptionStatus
from app.db.models import (
    Entitlement,
    Plan,
    SchoolMembership,
    Subscription,
)

pytestmark = pytest.mark.usefixtures("cleanup_users")


async def _seed_plans(engine) -> None:
    """Seed the plan catalog if it is not there."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        existing = await session.execute(select(Plan.code))
        present = set(existing.scalars().all())
        catalog = [
            Plan(
                code="basico",
                name="Basico",
                price_cents=49000,
                currency="COP",
                interval="monthly",
                max_students=200,
                max_teachers=15,
                max_storage_gb=10,
                includes_icfes=False,
                is_active=True,
            ),
            Plan(
                code="estandar",
                name="Estandar",
                price_cents=129000,
                currency="COP",
                interval="monthly",
                max_students=1500,
                max_teachers=None,
                max_storage_gb=100,
                includes_icfes=True,
                is_active=True,
            ),
        ]
        session.add_all([plan for plan in catalog if plan.code not in present])
        await session.commit()


def _register_and_get_token(client, email: str) -> str:
    """Register a user and return their access token."""
    response = client.post(
        "/v1/auth/register",
        json={"email": email, "password": "a good password", "full_name": "Admin"},
    )
    assert response.status_code == 201, response.text
    return response.json()["tokens"]["access_token"]


def test_bootstrap_requires_authentication(client):
    """The endpoint is not public."""
    response = client.post(
        "/v1/schools/bootstrap",
        json={
            "school_name": "Colegio Nuevo",
            "short_code": "nuevo",
            "plan_code": "basico",
        },
    )
    assert response.status_code == 401


async def test_bootstrap_creates_the_school(client, engine):
    """A signed-up user can create their school."""
    await _seed_plans(engine)
    token = _register_and_get_token(client, f"boot-{uuid.uuid4().hex[:8]}@example.com")
    short_code = f"NB{uuid.uuid4().hex[:6].upper()}"

    response = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": short_code,
            "plan_code": "basico",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["school_id"]
    assert body["membership_id"]
    assert body["subscription_id"]
    assert body["already_existed"] is False


async def test_bootstrap_makes_the_caller_the_school_admin(client, engine):
    """The caller becomes the school's admin, with a primary membership."""
    await _seed_plans(engine)
    token = _register_and_get_token(client, f"admin-{uuid.uuid4().hex[:8]}@example.com")

    response = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": f"AD{uuid.uuid4().hex[:6].upper()}",
            "plan_code": "estandar",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        membership = await session.execute(
            select(SchoolMembership).where(SchoolMembership.id == uuid.UUID(body["membership_id"]))
        )
        row = membership.scalar_one()
        assert row.role == SchoolRole.SCHOOL_ADMIN
        assert row.is_primary is True

        subscription = await session.execute(
            select(Subscription).where(Subscription.id == uuid.UUID(body["subscription_id"]))
        )
        sub = subscription.scalar_one()
        assert sub.status == SubscriptionStatus.TRIAL

        entitlement = await session.execute(
            select(Entitlement).where(Entitlement.school_id == uuid.UUID(body["school_id"]))
        )
        ent = entitlement.scalar_one()
        assert ent.plan_code == "estandar"
        assert ent.includes_icfes is True


async def test_bootstrap_is_idempotent(client, engine):
    """Calling it twice returns the same school."""
    await _seed_plans(engine)
    token = _register_and_get_token(client, f"idem-{uuid.uuid4().hex[:8]}@example.com")
    payload = {
        "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
        "short_code": f"ID{uuid.uuid4().hex[:6].upper()}",
        "plan_code": "basico",
    }

    first = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert second.status_code == 201, second.text
    assert second.json()["school_id"] == first.json()["school_id"]
    assert second.json()["already_existed"] is True


async def test_bootstrap_rejects_an_unknown_plan(client, engine):
    """An unknown plan is a 404."""
    await _seed_plans(engine)
    token = _register_and_get_token(client, f"plan-{uuid.uuid4().hex[:8]}@example.com")

    response = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": f"NP{uuid.uuid4().hex[:6].upper()}",
            "plan_code": "does-not-exist",
        },
    )
    assert response.status_code == 404


async def test_bootstrap_rejects_a_taken_short_code(client, engine):
    """A short code that is already in use is a 409."""
    await _seed_plans(engine)
    shared_code = f"SC{uuid.uuid4().hex[:6].upper()}"

    first_token = _register_and_get_token(client, f"first-{uuid.uuid4().hex[:8]}@example.com")
    first = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {first_token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": shared_code,
            "plan_code": "basico",
        },
    )
    assert first.status_code == 201, first.text

    second_token = _register_and_get_token(client, f"second-{uuid.uuid4().hex[:8]}@example.com")
    second = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {second_token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": shared_code,
            "plan_code": "basico",
        },
    )
    assert second.status_code == 409


def test_bootstrap_validates_the_payload(client):
    """A short school name is rejected."""
    token = _register_and_get_token(client, f"val-{uuid.uuid4().hex[:8]}@example.com")

    response = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={"school_name": "A", "short_code": "x", "plan_code": "basico"},
    )
    assert response.status_code == 422


async def test_the_session_context_reflects_the_new_school(client, engine):
    """After bootstrapping, /auth/me reports the membership."""
    await _seed_plans(engine)
    token = _register_and_get_token(client, f"ctx-{uuid.uuid4().hex[:8]}@example.com")

    bootstrap = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": f"CT{uuid.uuid4().hex[:6].upper()}",
            "plan_code": "basico",
        },
    )
    assert bootstrap.status_code == 201, bootstrap.text
    school_id = bootstrap.json()["school_id"]

    me = client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200
    body = me.json()
    assert len(body["memberships"]) == 1
    assert body["memberships"][0]["school_id"] == school_id
    assert body["memberships"][0]["role"] == "school_admin"
    assert body["primary_school_id"] == school_id


# ---------------------------------------------------------------------------
# The stranded-signup bug
# ---------------------------------------------------------------------------


async def test_register_resumes_after_a_failed_bootstrap(client, engine):
    """The bug: a failed school step must not strand the account.

    Reproduce the report: register, try to bootstrap a school whose
    name/code is already taken (fails with 409), then retry the whole
    signup with the same email. The retry must succeed and let the
    user create the school, instead of answering "that email already
    exists".
    """
    await _seed_plans(engine)
    taken_code = f"TK{uuid.uuid4().hex[:6].upper()}"

    # Someone else already owns this short code.
    other_token = _register_and_get_token(client, f"owner-{uuid.uuid4().hex[:8]}@example.com")
    owned = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {other_token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": taken_code,
            "plan_code": "basico",
        },
    )
    assert owned.status_code == 201, owned.text

    email = f"stranded-{uuid.uuid4().hex[:8]}@example.com"
    password = "a good password"

    # First attempt: account created, then the school step fails.
    first_register = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Admin"},
    )
    assert first_register.status_code == 201, first_register.text
    first_token = first_register.json()["tokens"]["access_token"]

    failed = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {first_token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": taken_code,
            "plan_code": "basico",
        },
    )
    assert failed.status_code == 409

    # Second attempt: the frontend calls register again first.
    retry_register = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Admin"},
    )
    assert retry_register.status_code == 201, retry_register.text
    retry_token = retry_register.json()["tokens"]["access_token"]

    # And now the school with a free code goes through.
    retry_bootstrap = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {retry_token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": f"OK{uuid.uuid4().hex[:6].upper()}",
            "plan_code": "basico",
        },
    )
    assert retry_bootstrap.status_code == 201, retry_bootstrap.text
    assert retry_bootstrap.json()["already_existed"] is False


async def test_register_still_rejects_a_completed_signup(client, engine):
    """Once the signup is complete, the email is really taken.

    A user who already has a school must not be able to re-register,
    even with the right password: the resume path is only for signups
    that never finished.
    """
    await _seed_plans(engine)
    email = f"done-{uuid.uuid4().hex[:8]}@example.com"
    password = "a good password"

    token = _register_and_get_token(client, email)
    done = client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": f"DN{uuid.uuid4().hex[:6].upper()}",
            "plan_code": "basico",
        },
    )
    assert done.status_code == 201, done.text

    retry = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Admin"},
    )
    assert retry.status_code == 409


# ---------------------------------------------------------------------------
# School profile / branding (GET & PATCH /v1/schools/me)
# ---------------------------------------------------------------------------


async def test_get_my_school_returns_branding_fields(client, engine):
    """A member can read their school, including the branding fields."""
    await _seed_plans(engine)
    token = _register_and_get_token(client, f"br-{uuid.uuid4().hex[:8]}@example.com")
    client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": f"BR{uuid.uuid4().hex[:6].upper()}",
            "plan_code": "basico",
        },
    )

    response = client.get("/v1/schools/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["display_name"] is None
    assert body["logo_url"] is None
    assert body["primary_color"] is None


async def test_admin_updates_branding(client, engine):
    """A school_admin can set the display name and primary colour."""
    await _seed_plans(engine)
    token = _register_and_get_token(client, f"brw-{uuid.uuid4().hex[:8]}@example.com")
    client.post(
        "/v1/schools/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": f"BW{uuid.uuid4().hex[:6].upper()}",
            "plan_code": "basico",
        },
    )

    response = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"display_name": "Nombre Visible", "primary_color": "oklch(0.55 0.16 240)"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["display_name"] == "Nombre Visible"
    assert body["primary_color"] == "oklch(0.55 0.16 240)"


def test_get_my_school_requires_auth(client):
    """Reading the school is not public."""
    assert client.get("/v1/schools/me").status_code == 401


async def test_non_admin_cannot_update_branding(client, engine, seeded_school):
    """A teacher cannot change the school branding."""
    from sqlalchemy import update

    from app.db.enums import SchoolRole
    from app.db.models import SchoolMembership
    from tests.conftest import TEST_USER_ID

    # Demote the seeded admin to teacher and commit so the API sees it.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            update(SchoolMembership)
            .where(
                SchoolMembership.user_id == uuid.UUID(TEST_USER_ID),
                SchoolMembership.school_id == seeded_school,
            )
            .values(role=SchoolRole.TEACHER)
        )
        await session.commit()

    from tests.conftest import mint_token

    response = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {mint_token()}"},
        json={"display_name": "Hack"},
    )
    assert response.status_code == 403
