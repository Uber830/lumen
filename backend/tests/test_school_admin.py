"""The school administrator: its rank and the permissions that come
with it.

The panel of a school has two ranks, and the difference has to be
visible in the interface and not only in the backend. The API returns
the list of permissions of the caller in `GET /v1/school/me`, and the
frontend shows or disables from that list. It never decides on its
own.

What is checked here:

- the principal has every permission, the secundario does not have the
  four that belong to the principal;
- the endpoint returns the permissions of the caller and the school it
  administers;
- the school is always the caller's own: the endpoint does not read a
  school id from the request.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_permissions import (
    ROLE_PERMISSIONS,
    SchoolPermission,
    permissions_for,
)
from app.db.enums import SchoolAdminRole, SchoolRole
from app.db.models import SchoolMembership

pytestmark = pytest.mark.usefixtures("cleanup_users")


# ---------------------------------------------------------------------------
# The catalogue of permissions
# ---------------------------------------------------------------------------


def test_the_principal_has_every_permission() -> None:
    """The principal runs the school: nothing is taken away from it."""
    principal = permissions_for(SchoolAdminRole.PRINCIPAL)

    assert set(principal) == {permission.value for permission in SchoolPermission}


def test_the_secondary_does_not_have_the_principal_permissions() -> None:
    """The four actions that belong to the principal are not on the list."""
    secundario = permissions_for(SchoolAdminRole.SECUNDARIO)

    for permission in (
        SchoolPermission.PERIODS_CLOSE,
        SchoolPermission.ADMINS_MANAGE,
        SchoolPermission.CUSTOMIZATION_WRITE,
        SchoolPermission.REPORTS_READ,
    ):
        assert permission.value not in secundario


def test_the_secondary_keeps_the_day_to_day_permissions() -> None:
    """The secondary administers the community and the academic structure."""
    secundario = permissions_for(SchoolAdminRole.SECUNDARIO)

    for permission in (
        SchoolPermission.DASHBOARD_READ,
        SchoolPermission.MATERIAL_READ,
        SchoolPermission.TEACHERS_WRITE,
        SchoolPermission.STUDENTS_WRITE,
        SchoolPermission.COURSES_WRITE,
        SchoolPermission.ASSIGNMENTS_WRITE,
        SchoolPermission.PERIODS_READ,
    ):
        assert permission.value in secundario


def test_the_principal_only_permissions_are_not_shared() -> None:
    """The two lists do not overlap where it matters."""
    principal = set(ROLE_PERMISSIONS[SchoolAdminRole.PRINCIPAL])
    secundario = set(ROLE_PERMISSIONS[SchoolAdminRole.SECUNDARIO])

    assert secundario < principal


# ---------------------------------------------------------------------------
# The endpoint
# ---------------------------------------------------------------------------


async def _rank_of(engine, school_id: uuid.UUID, rank: SchoolAdminRole) -> None:
    """Give the administrators of the seeded school a rank."""
    from sqlalchemy import select

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        result = await session.execute(
            select(SchoolMembership).where(SchoolMembership.school_id == school_id)
        )
        for membership in result.scalars().all():
            membership.admin_role = rank
        await session.commit()


async def test_the_endpoint_returns_the_school_and_the_permissions(client, seeded_school):
    """The panel receives what it needs to render itself."""
    from tests.conftest import mint_token

    response = client.get("/v1/school/me", headers={"Authorization": f"Bearer {mint_token()}"})
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["school"]["id"] == str(seeded_school)
    assert body["admin_role"] == "principal"
    assert body["permissions"]
    assert "periods.close" in body["permissions"]


async def test_the_secondary_receives_the_permissions_of_its_rank(client, engine, seeded_school):
    """The list the frontend receives is the one of the rank."""
    from tests.conftest import mint_token

    await _rank_of(engine, seeded_school, SchoolAdminRole.SECUNDARIO)

    response = client.get("/v1/school/me", headers={"Authorization": f"Bearer {mint_token()}"})
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["admin_role"] == "secundario"
    assert "periods.close" not in body["permissions"]
    assert "admins.manage" not in body["permissions"]
    assert "teachers.write" in body["permissions"]


async def test_the_endpoint_ignores_a_school_id_in_the_query(client, seeded_school):
    """The school comes from the session, never from the request."""
    from tests.conftest import mint_token

    other_school = uuid.uuid4()
    response = client.get(
        f"/v1/school/me?school_id={other_school}",
        headers={"Authorization": f"Bearer {mint_token()}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["school"]["id"] == str(seeded_school)


async def test_the_endpoint_needs_authentication(client):
    """Without a session there is no panel."""
    response = client.get("/v1/school/me")
    assert response.status_code == 401


async def test_a_teacher_does_not_see_the_panel(client, engine, seeded_school):
    """The panel of the school belongs to its administrators."""
    from sqlalchemy import update

    from tests.conftest import TEST_USER_ID, mint_token

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            update(SchoolMembership)
            .where(
                SchoolMembership.user_id == uuid.UUID(TEST_USER_ID),
                SchoolMembership.school_id == seeded_school,
            )
            .values(role=SchoolRole.TEACHER, admin_role=None)
        )
        await session.commit()

    response = client.get("/v1/school/me", headers={"Authorization": f"Bearer {mint_token()}"})
    assert response.status_code == 403


async def test_the_session_carries_the_permissions(client, seeded_school):
    """The session also carries them, so the app knows before it paints."""
    from tests.conftest import mint_token

    response = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {mint_token()}"})
    assert response.status_code == 200, response.text

    body = response.json()
    assert "periods.close" in body["permissions"]
    assert body["memberships"][0]["admin_role"] == "principal"
