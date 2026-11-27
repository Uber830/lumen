"""The school's visible identity: the session branding and the fields
the administrator may write.

Three things are checked here:

- the session carries the school's branding, so the app paints itself
  with the school's colour and logo on the first frame (no flash of the
  default theme);
- the identity is the name, the shield and the colour;
- the four blocks that were removed from the product (the mission, the
  vision, the cover picture and the gallery) are gone from the API:
  they are not accepted and they do not come back.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.support import sign_in

pytestmark = pytest.mark.usefixtures("cleanup_users")


async def _seed_plans(engine) -> None:
    """Seed the plan catalog if it is not there."""
    from sqlalchemy import select

    from app.db.models import Plan

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
    """Create a school with its administrator, the way the platform does.

    The platform team creates the school and the administrator's
    account; the account is pending, and the activation link is what
    lets the administrator set its password. Returns the token of the
    signed-in administrator.
    """
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

    activated = client.post(
        "/v1/auth/reset-password",
        json={
            "token": response.json()["activation_token"],
            "password": "a good password",
        },
    )
    assert activated.status_code == 200, activated.text

    body = sign_in(client, email=email, password="a good password")
    return body["tokens"]["access_token"]


# ---------------------------------------------------------------------------
# The session carries the branding
# ---------------------------------------------------------------------------


async def test_the_session_carries_the_school_branding(client, engine, platform_admin):
    """The session carries the colour and the logo of the school.

    Without them the app would start with the default theme and repaint
    a second later, when the school query answers.
    """
    token = await _admin_with_school(client, engine, platform_admin, "brand")

    updated = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "display_name": "Colegio del Sur",
            "primary_color": "oklch(0.55 0.16 240)",
            "logo_url": "https://example.test/logo.png",
        },
    )
    assert updated.status_code == 200, updated.text

    me = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    school = me.json()["school"]

    assert school is not None
    assert school["display_name"] == "Colegio del Sur"
    assert school["primary_color"] == "oklch(0.55 0.16 240)"
    assert school["logo_url"] == "https://example.test/logo.png"
    assert school["id"] == me.json()["primary_school_id"]


async def test_the_session_has_no_school_without_a_membership(client, engine, make_user):
    """A user without a school gets no branding, and the app is fine."""
    email = f"nosch-{uuid.uuid4().hex[:8]}@example.com"
    make_user(email=email, password="a good password", full_name="Admin")
    body = sign_in(client, email=email, password="a good password")
    token = body["tokens"]["access_token"]

    me = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text
    assert me.json()["school"] is None


async def test_the_login_response_carries_the_branding_too(client, engine, platform_admin):
    """The login response has the same shape, so the app can paint
    itself right after signing in."""
    token = await _admin_with_school(client, engine, platform_admin, "login")

    client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"primary_color": "oklch(0.55 0.14 155)"},
    )

    # The administrator signs in again with the same credentials.
    email = f"relog-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/v1/platform/schools",
        headers=platform_admin,
        json={
            "school_name": f"Colegio {uuid.uuid4().hex[:8]}",
            "short_code": f"RL{uuid.uuid4().hex[:6].upper()}",
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
    assert login.json()["session"]["school"] is not None


# ---------------------------------------------------------------------------
# The four blocks that were removed
# ---------------------------------------------------------------------------


async def test_the_school_profile_has_no_institutional_blocks(client, engine, platform_admin):
    """The mission, the vision, the cover picture and the gallery are gone."""
    token = await _admin_with_school(client, engine, platform_admin, "purged")

    profile = client.get("/v1/schools/me", headers={"Authorization": f"Bearer {token}"})
    assert profile.status_code == 200, profile.text

    body = profile.json()
    for field in ("mission", "vision", "banner_url", "gallery"):
        assert field not in body, f"the school profile still carries {field}"


async def test_the_institutional_blocks_are_not_written(client, engine, platform_admin):
    """A client that sends them does not put them back in the school."""
    token = await _admin_with_school(client, engine, platform_admin, "noblocks")

    response = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mission": "Formar estudiantes críticos y creativos.",
            "vision": "Ser una institución de referencia.",
            "banner_url": "https://example.test/portada.png",
            "gallery": [{"url": "https://example.test/1.png"}],
        },
    )
    assert response.status_code == 200, response.text

    body = response.json()
    for field in ("mission", "vision", "banner_url", "gallery"):
        assert field not in body, f"the school profile still carries {field}"


async def test_the_session_carries_no_institutional_blocks(client, engine, platform_admin):
    """The branding that travels with the session is the visible identity."""
    token = await _admin_with_school(client, engine, platform_admin, "session")

    me = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text

    school = me.json()["school"]
    assert school is not None
    for field in ("mission", "vision", "banner_url", "gallery"):
        assert field not in school, f"the session still carries {field}"


async def test_the_picture_upload_endpoint_is_gone(client, engine, platform_admin):
    """The cover picture and the gallery moved out of the school."""
    token = await _admin_with_school(client, engine, platform_admin, "images")

    response = client.post(
        "/v1/schools/me/images",
        headers={"Authorization": f"Bearer {token}"},
        data={"kind": "banner"},
        files={"file": ("banner.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 404, response.text


async def test_a_teacher_cannot_write_the_identity(client, engine, seeded_school):
    """Only the school's admin changes the identity."""
    from sqlalchemy import update

    from app.db.enums import SchoolRole
    from app.db.models import SchoolMembership
    from tests.conftest import TEST_USER_ID, mint_token

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

    response = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {mint_token()}"},
        json={"display_name": "Hack"},
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# The shield
# ---------------------------------------------------------------------------


async def test_the_shield_is_uploaded_and_saved(client, engine, monkeypatch, platform_admin):
    """The shield of the school is stored on the school."""
    from app.core import storage

    async def fake_upload(**kwargs):
        return f"school-logos/escudo-{uuid.uuid4().hex[:6]}.png"

    monkeypatch.setattr(storage, "upload_school_logo", fake_upload)

    token = await _admin_with_school(client, engine, platform_admin, "escudo")

    response = client.post(
        "/v1/schools/me/logo",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("escudo.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 200, response.text
    # The row keeps the path of the file, never its address: the API
    # serves it and decides who may read it.
    assert response.json()["logo_url"].startswith("school-logos/escudo-")


async def test_the_shield_upload_requires_authentication(client):
    """The upload is not public."""
    response = client.post(
        "/v1/schools/me/logo",
        files={"file": ("escudo.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 401
