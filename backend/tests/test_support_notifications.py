"""The bell of the support desk.

What is checked here:

- a case that the school opens reaches the bell of the platform team;
- a message that the school writes in the thread reaches it too;
- the answer of the platform team reaches the administrators of the
  school;
- each side gets a link to the place where it can act.

The notifications are what the user sees when the bell rings, so a
missing one is a case that nobody knows about.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification, SupportCase, SupportMessage, User

pytestmark = pytest.mark.usefixtures("cleanup_users")


async def _auth() -> dict[str, str]:
    from tests.conftest import mint_token

    return {"Authorization": f"Bearer {mint_token()}"}


async def _notifications_of(email: str, engine) -> list[Notification]:
    """The notifications of one user, newest first."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        result = await session.execute(
            select(Notification)
            .join(User, User.id == Notification.recipient_user_id)
            .where(User.email == email)
            .order_by(Notification.created_at.desc())
        )
        return list(result.scalars().all())


async def _clean(engine, school_id: uuid.UUID) -> None:
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            delete(SupportMessage).where(
                SupportMessage.case_id.in_(
                    select(SupportCase.id).where(SupportCase.school_id == school_id)
                )
            )
        )
        await session.execute(delete(SupportCase).where(SupportCase.school_id == school_id))
        await session.execute(
            delete(Notification).where(Notification.school_id == school_id)
        )
        await session.commit()


async def test_the_platform_team_is_told_that_a_case_arrived(
    client, engine, seeded_school, platform_admin
):
    """The bell of the platform rings when a school opens a request."""
    await _clean(engine, seeded_school)

    response = client.post(
        "/v1/school/support/cases",
        headers=await _auth(),
        json={
            "title": "El material de 8° no aparece",
            "category": "duda_acceso",
            "body": "Los docentes de 8° A no ven el material de ciencias.",
        },
    )
    assert response.status_code == 201, response.text
    case = response.json()

    rows = await _notifications_of("platform@example.com", engine)
    assert len(rows) == 1, rows
    notification = rows[0]
    assert notification.kind == "support_case_opened"
    assert notification.title == f"Nuevo caso de soporte: {case['title']}"
    assert case["code"] in (notification.body or "")
    # The notification takes the platform team to the desk.
    assert notification.link == "/super/soporte"
    assert notification.read_at is None

    await _clean(engine, seeded_school)


async def test_the_platform_team_is_told_that_the_school_wrote(
    client, engine, seeded_school, platform_admin
):
    """The thread of a case is written by both sides, and both know."""
    await _clean(engine, seeded_school)

    opened = client.post(
        "/v1/school/support/cases",
        headers=await _auth(),
        json={
            "title": "El material de 8° no aparece",
            "category": "duda_acceso",
            "body": "Los docentes de 8° A no ven el material de ciencias.",
        },
    )
    assert opened.status_code == 201, opened.text
    case_id = opened.json()["id"]

    answer = client.post(
        f"/v1/school/support/cases/{case_id}/messages",
        headers=await _auth(),
        json={"body": "Adjuntamos la captura del error."},
    )
    assert answer.status_code == 200, answer.text

    rows = await _notifications_of("platform@example.com", engine)
    kinds = [row.kind for row in rows]
    assert "support_case_replied" in kinds, rows
    latest = rows[0]
    assert latest.kind == "support_case_replied"
    assert latest.link == "/super/soporte"

    await _clean(engine, seeded_school)


async def test_the_school_is_told_that_the_platform_answered(
    client, engine, seeded_school, platform_admin
):
    """The school hears the bell when the platform answers."""
    await _clean(engine, seeded_school)

    opened = client.post(
        "/v1/school/support/cases",
        headers=await _auth(),
        json={
            "title": "El material de 8° no aparece",
            "category": "duda_acceso",
            "body": "Los docentes de 8° A no ven el material de ciencias.",
        },
    )
    assert opened.status_code == 201, opened.text
    case_id = opened.json()["id"]

    answered = client.post(
        f"/v1/platform/cases/{case_id}/messages",
        headers=platform_admin,
        json={"body": "Ya lo revisamos: era el material sin publicar."},
    )
    assert answered.status_code == 200, answered.text

    rows = await _notifications_of("admin@example.com", engine)
    assert len(rows) == 1, rows
    notification = rows[0]
    assert notification.kind == "support_case_replied"
    assert "respondió tu caso" in notification.title
    # The notification takes the administrator to its own thread.
    assert notification.link == "/admin/soporte"

    await _clean(engine, seeded_school)
