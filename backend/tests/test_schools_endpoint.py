"""HTTP-level tests for the school profile endpoints.

The school itself is created by the platform team (see
`test_platform_schools.py`); these tests cover what a school can do
with its own profile.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Plan

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
            )
        ]
        session.add_all([plan for plan in catalog if plan.code not in present])
        await session.commit()


async def _admin_with_school(client, engine, platform_admin, prefix: str) -> str:
    """Create a school with its administrator and return their token."""
    await _seed_plans(engine)
    email = f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/v1/platform/schools",
        headers=platform_admin,
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": f"{prefix.upper()}{uuid.uuid4().hex[:6].upper()}",
            "plan_code": "basico",
            "admin_email": email,
            "admin_name": "Admin",
        },
    )
    assert response.status_code == 201, response.text

    client.post(
        "/v1/auth/reset-password",
        json={
            "token": response.json()["activation_token"],
            "password": "a good password",
        },
    )
    login = client.post(
        "/v1/auth/login",
        json={"email": email, "password": "a good password"},
    )
    assert login.status_code == 200, login.text
    return login.json()["tokens"]["access_token"]


# ---------------------------------------------------------------------------
# School profile / branding (GET & PATCH /v1/schools/me)
# ---------------------------------------------------------------------------


async def test_get_my_school_returns_branding_fields(client, engine, platform_admin):
    """A member can read their school, including the branding fields."""
    token = await _admin_with_school(client, engine, platform_admin, "br")

    response = client.get("/v1/schools/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["display_name"] is None
    assert body["logo_url"] is None
    assert body["primary_color"] is None


async def test_admin_updates_branding(client, engine, platform_admin):
    """A school_admin can set the display name and primary colour."""
    token = await _admin_with_school(client, engine, platform_admin, "brw")

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
