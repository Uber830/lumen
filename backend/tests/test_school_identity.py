"""The school's institutional identity: the session branding and the
mission, vision and pictures of the school.

Two things are checked here:

- the session carries the school's branding, so the app paints itself
  with the school's colour and logo on the first frame (no flash of the
  default theme);
- the admin can write the mission, the vision and the gallery, and they
  come back in the school's profile.
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
# Mission, vision and gallery
# ---------------------------------------------------------------------------


async def test_the_admin_writes_the_mission_and_the_vision(client, engine, platform_admin):
    """The identity is saved and comes back in the school's profile."""
    token = await _admin_with_school(client, engine, platform_admin, "ident")

    response = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "mission": "Formar estudiantes críticos y creativos.",
            "vision": "Ser una institución de referencia.",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["mission"] == "Formar estudiantes críticos y creativos."
    assert body["vision"] == "Ser una institución de referencia."

    profile = client.get("/v1/schools/me", headers={"Authorization": f"Bearer {token}"})
    assert profile.json()["mission"] == body["mission"]
    assert profile.json()["vision"] == body["vision"]


async def test_an_empty_mission_clears_it(client, engine, platform_admin):
    """A blank mission clears the field instead of saving a blank."""
    token = await _admin_with_school(client, engine, platform_admin, "clear")

    client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"mission": "Una misión"},
    )
    response = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"mission": "   "},
    )
    assert response.status_code == 200, response.text
    assert response.json()["mission"] is None


async def test_the_gallery_is_saved_and_cleared(client, engine, platform_admin):
    """The pictures of the gallery travel with the school."""
    token = await _admin_with_school(client, engine, platform_admin, "gal")

    gallery = [
        {"url": "https://example.test/1.png", "caption": "El patio"},
        {"url": "https://example.test/2.png", "caption": None},
    ]
    response = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"gallery": gallery},
    )
    assert response.status_code == 200, response.text
    assert response.json()["gallery"] == gallery

    cleared = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"gallery": []},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["gallery"] == []


async def test_the_gallery_holds_at_most_five_pictures(client, engine, platform_admin):
    """A longer list is rejected: the dashboard shows them in one row."""
    token = await _admin_with_school(client, engine, platform_admin, "many")

    gallery = [{"url": f"https://example.test/{i}.png"} for i in range(6)]
    response = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"gallery": gallery},
    )
    assert response.status_code == 422, response.text


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
        json={"mission": "Hack"},
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# The picture uploads
# ---------------------------------------------------------------------------


async def test_the_banner_is_uploaded_and_saved(client, engine, monkeypatch, platform_admin):
    """The cover of the dashboard is stored on the school."""
    from app.core import supabase_storage

    async def fake_upload(**kwargs):
        return f"https://example.test/banner-{uuid.uuid4().hex[:6]}.png"

    monkeypatch.setattr(supabase_storage, "upload_school_image", fake_upload)

    token = await _admin_with_school(client, engine, platform_admin, "banner")

    response = client.post(
        "/v1/schools/me/images",
        headers={"Authorization": f"Bearer {token}"},
        data={"kind": "banner"},
        files={"file": ("banner.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["banner_url"].startswith("https://example.test/banner-")


async def test_a_gallery_picture_is_added_to_the_list(client, engine, monkeypatch, platform_admin):
    """Each uploaded picture joins the gallery."""
    from app.core import supabase_storage

    async def fake_upload(**kwargs):
        return f"https://example.test/gallery-{uuid.uuid4().hex[:6]}.png"

    monkeypatch.setattr(supabase_storage, "upload_school_image", fake_upload)

    token = await _admin_with_school(client, engine, platform_admin, "galu")

    response = client.post(
        "/v1/schools/me/images",
        headers={"Authorization": f"Bearer {token}"},
        data={"kind": "gallery"},
        files={"file": ("one.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 200, response.text
    gallery = response.json()["gallery"]
    assert len(gallery) == 1
    assert gallery[0]["caption"] is None


async def test_the_gallery_refuses_to_grow_past_five(client, engine, monkeypatch, platform_admin):
    """The sixth picture is refused with a 409."""
    from app.core import supabase_storage

    async def fake_upload(**kwargs):
        return f"https://example.test/gallery-{uuid.uuid4().hex[:6]}.png"

    monkeypatch.setattr(supabase_storage, "upload_school_image", fake_upload)

    token = await _admin_with_school(client, engine, platform_admin, "full")

    gallery = [{"url": f"https://example.test/{i}.png"} for i in range(5)]
    filled = client.patch(
        "/v1/schools/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"gallery": gallery},
    )
    assert filled.status_code == 200, filled.text

    response = client.post(
        "/v1/schools/me/images",
        headers={"Authorization": f"Bearer {token}"},
        data={"kind": "gallery"},
        files={"file": ("seven.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 409, response.text


async def test_an_unknown_image_kind_is_rejected(client, engine, platform_admin):
    """Only the banner and the gallery are accepted."""
    token = await _admin_with_school(client, engine, platform_admin, "kind")

    response = client.post(
        "/v1/schools/me/images",
        headers={"Authorization": f"Bearer {token}"},
        data={"kind": "mural"},
        files={"file": ("x.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 422, response.text


def test_the_image_upload_requires_authentication(client):
    """The upload is not public."""
    response = client.post(
        "/v1/schools/me/images",
        data={"kind": "banner"},
        files={"file": ("x.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 401
