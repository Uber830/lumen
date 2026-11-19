"""HTTP-level tests for the platform endpoint that creates a school.

The schools are onboarded by the platform team, not by the users:
there is no public signup. The endpoint creates the school, the
administrator's account and the activation link that lets the
administrator set its password.
"""

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
    User,
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


def _payload(**overrides) -> dict[str, object]:
    """The body of a school creation, with unique values."""
    payload: dict[str, object] = {
        "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
        "short_code": f"PL{uuid.uuid4().hex[:6].upper()}",
        "plan_code": "basico",
        "admin_email": f"platform-{uuid.uuid4().hex[:8]}@example.com",
        "admin_name": "Admin",
    }
    payload.update(overrides)
    return payload


def test_the_endpoint_requires_authentication(client):
    """It is not public."""
    response = client.post("/v1/platform/schools", json=_payload())
    assert response.status_code == 401


async def test_the_endpoint_requires_the_platform_role(client, engine, make_user):
    """A school administrator cannot create schools."""
    await _seed_plans(engine)
    make_user(email=f"admin-{uuid.uuid4().hex[:8]}@example.com", password="a good password")

    response = client.post(
        "/v1/platform/schools",
        json=_payload(),
        headers={"Authorization": "Bearer not-a-platform-admin"},
    )
    assert response.status_code in (401, 403)


async def test_it_creates_the_school_with_its_administrator(client, engine, platform_admin):
    """The school, the membership, the subscription and the entitlements."""
    await _seed_plans(engine)

    response = client.post(
        "/v1/platform/schools",
        headers=platform_admin,
        json=_payload(plan_code="estandar"),
    )
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["school_id"]
    assert body["admin_user_id"]
    assert body["admin_email"].endswith("@example.com")
    assert body["activation_token"]

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        membership = await session.execute(
            select(SchoolMembership).where(
                SchoolMembership.school_id == uuid.UUID(body["school_id"])
            )
        )
        row = membership.scalar_one()
        assert row.role == SchoolRole.SCHOOL_ADMIN
        assert row.is_primary is True
        assert row.user_id == uuid.UUID(body["admin_user_id"])

        subscription = await session.execute(
            select(Subscription).where(Subscription.school_id == uuid.UUID(body["school_id"]))
        )
        assert subscription.scalar_one().status == SubscriptionStatus.TRIAL

        entitlement = await session.execute(
            select(Entitlement).where(Entitlement.school_id == uuid.UUID(body["school_id"]))
        )
        ent = entitlement.scalar_one()
        assert ent.plan_code == "estandar"
        assert ent.includes_icfes is True


async def test_the_administrator_account_starts_pending(client, engine, platform_admin):
    """The account has no password until the activation link is used."""
    await _seed_plans(engine)
    payload = _payload()

    response = client.post("/v1/platform/schools", headers=platform_admin, json=payload)
    assert response.status_code == 201, response.text

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await session.execute(select(User).where(User.email == str(payload["admin_email"])))
        row = user.scalar_one()
        assert row.password_hash == ""


async def test_the_activation_link_lets_the_administrator_sign_in(client, engine, platform_admin):
    """The flow: the platform creates the school, the admin activates and signs in."""
    await _seed_plans(engine)
    payload = _payload()

    response = client.post("/v1/platform/schools", headers=platform_admin, json=payload)
    assert response.status_code == 201, response.text
    token = response.json()["activation_token"]

    activated = client.post(
        "/v1/auth/reset-password",
        json={"token": token, "password": "a good password"},
    )
    assert activated.status_code == 200, activated.text

    login = client.post(
        "/v1/auth/login",
        json={"email": payload["admin_email"], "password": "a good password"},
    )
    assert login.status_code == 200, login.text
    session_body = login.json()["session"]
    assert session_body["primary_school_id"] == response.json()["school_id"]
    assert session_body["memberships"][0]["role"] == "school_admin"


async def test_it_rejects_an_unknown_plan(client, engine, platform_admin):
    """An unknown plan is a 404."""
    await _seed_plans(engine)

    response = client.post(
        "/v1/platform/schools",
        headers=platform_admin,
        json=_payload(plan_code="does-not-exist"),
    )
    assert response.status_code == 404


async def test_it_rejects_a_taken_short_code(client, engine, platform_admin):
    """A short code that is already in use is a 409."""
    await _seed_plans(engine)
    shared_code = f"SC{uuid.uuid4().hex[:6].upper()}"

    first = client.post(
        "/v1/platform/schools",
        headers=platform_admin,
        json=_payload(short_code=shared_code),
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/v1/platform/schools",
        headers=platform_admin,
        json=_payload(short_code=shared_code),
    )
    assert second.status_code == 409


async def test_it_rejects_a_taken_admin_email(client, engine, platform_admin, make_user):
    """An email that is already registered cannot be the administrator."""
    await _seed_plans(engine)
    email = f"taken-{uuid.uuid4().hex[:8]}@example.com"
    make_user(email=email, password="a good password")

    response = client.post(
        "/v1/platform/schools",
        headers=platform_admin,
        json=_payload(admin_email=email),
    )
    assert response.status_code == 409


def test_it_validates_the_payload(client, platform_admin):
    """A short school name is rejected."""
    response = client.post(
        "/v1/platform/schools",
        headers=platform_admin,
        json={"school_name": "A", "short_code": "x", "plan_code": "basico"},
    )
    assert response.status_code == 422
