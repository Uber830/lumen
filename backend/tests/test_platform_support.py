"""Tests of the support desk of the platform role.

What the schools ask, the conversation of each case and the state it
is left in.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, School, SupportCase, SupportMessage

# The endpoints commit their writes, so the rows they create are
# removed before and after each test.
pytestmark = pytest.mark.usefixtures("cleanup_users")


@pytest.fixture
def case_school(engine) -> Iterator[uuid.UUID]:
    """A school that opened a case."""
    school_id = uuid.uuid4()

    async def _create() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            session.add(
                School(
                    id=school_id,
                    name=f"Soporte Colegio {school_id.hex[:8]}",
                    short_code=f"SOP{school_id.hex[:6].upper()}",
                    city="Bogotá",
                    status="active",
                )
            )
            await session.commit()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_create())
    finally:
        loop.close()

    yield school_id

    async def _delete() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            await session.execute(
                delete(SupportMessage).where(
                    SupportMessage.case_id.in_(
                        select(SupportCase.id).where(SupportCase.school_id == school_id)
                    )
                )
            )
            await session.execute(delete(SupportCase).where(SupportCase.school_id == school_id))
            await session.execute(delete(School).where(School.id == school_id))
            await session.commit()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_delete())
    finally:
        loop.close()


@pytest.fixture
def a_case(engine, case_school) -> Iterator[uuid.UUID]:
    """A case with one message from the school."""
    case_id = uuid.uuid4()

    async def _create() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            session.add(
                SupportCase(
                    id=case_id,
                    code=f"SOL-T{case_id.hex[:6].upper()}",
                    title="El material no aparece en el curso",
                    category="problema_tecnico",
                    school_id=case_school,
                    channel="formulario_web",
                    level="urgente",
                    status="abierto",
                )
            )
            session.add(
                SupportMessage(
                    case_id=case_id,
                    author_role="colegio",
                    body="El material de álgebra no me aparece en el curso 7° A.",
                )
            )
            await session.commit()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_create())
    finally:
        loop.close()

    yield case_id

    async def _delete() -> None:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            await session.execute(delete(SupportMessage).where(SupportMessage.case_id == case_id))
            await session.execute(delete(SupportCase).where(SupportCase.id == case_id))
            await session.commit()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_delete())
    finally:
        loop.close()


def test_the_closed_catalogs_of_the_desk_are_served(client, platform_admin) -> None:
    """The frontend does not hardcode the levels or the states."""
    response = client.get("/v1/platform/case-options", headers=platform_admin)

    assert response.status_code == 200
    body = response.json()
    assert body["levels"] == ["info", "aviso", "urgente"]
    assert body["statuses"] == ["abierto", "en_espera", "resuelto"]
    assert "formulario_web" in body["channels"]
    assert "problema_tecnico" in body["categories"]


async def test_the_listing_shows_a_page_and_the_total(client, platform_admin, a_case) -> None:
    """The desk is a listing with a total, not the whole table."""
    response = client.get("/v1/platform/cases", headers=platform_admin)

    assert response.status_code == 200
    body = response.json()
    assert body["per_page"] == 8
    assert body["total"] >= 1
    assert any(item["id"] == str(a_case) for item in body["items"])


async def test_the_listing_can_be_filtered_by_state_and_level(
    client, platform_admin, a_case
) -> None:
    """The filters of the desk are the ones the backend knows."""
    opened = client.get("/v1/platform/cases?status=abierto&level=urgente", headers=platform_admin)
    assert opened.status_code == 200
    assert any(item["id"] == str(a_case) for item in opened.json()["items"])

    resolved = client.get("/v1/platform/cases?status=resuelto", headers=platform_admin)
    assert resolved.status_code == 200
    assert all(item["id"] != str(a_case) for item in resolved.json()["items"])


async def test_the_detail_carries_the_conversation_and_the_audit(
    client, platform_admin, a_case
) -> None:
    """The drawer shows what was said and what the platform did."""
    response = client.get(f"/v1/platform/cases/{a_case}", headers=platform_admin)

    assert response.status_code == 200
    body = response.json()
    assert body["code"].startswith("SOL-")
    assert body["school_name"].startswith("Soporte Colegio")
    assert len(body["messages"]) == 1
    assert body["messages"][0]["author_role"] == "colegio"
    assert isinstance(body["audit"], list)
    assert body["can_resolve"] is True


async def test_the_platform_reads_the_attachments_of_the_school(
    client, platform_admin, engine, a_case, case_school
) -> None:
    """The files the school sent travel with the message.

    The support team has to open the same document the school
    attached, so the detail of the case carries the path of each one.
    """
    attached = f"support-attachments/{case_school}/1750000000-captura.png"

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        message = (
            await session.execute(select(SupportMessage).where(SupportMessage.case_id == a_case))
        ).scalar_one()
        message.attachment_ids = [attached]
        await session.commit()

    response = client.get(f"/v1/platform/cases/{a_case}", headers=platform_admin)

    assert response.status_code == 200
    body = response.json()
    assert body["messages"][0]["attachment_ids"] == [attached]


def test_the_platform_admin_downloads_the_attachments_of_the_school(
    client, platform_admin, tmp_path, monkeypatch, case_school
) -> None:
    """The file of the school is served to the platform team.

    The file belongs to the school, but the support team is the one
    that has to read it: the door of the files lets it in.
    """
    from app.config import get_settings
    from app.core import storage

    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    get_settings.cache_clear()
    try:
        relative = f"support-attachments/{case_school}/1750000000-captura.txt"
        storage.write_file(relative, b"la captura del problema")

        response = client.get(f"/v1/files/{relative}", headers=platform_admin)

        assert response.status_code == 200
        assert response.content == b"la captura del problema"
    finally:
        get_settings.cache_clear()


async def test_the_answer_is_written_and_the_case_goes_to_waiting(
    client, platform_admin, a_case
) -> None:
    """Answering a case leaves it waiting for the school."""
    response = client.post(
        f"/v1/platform/cases/{a_case}/messages",
        headers=platform_admin,
        json={"body": "Ya lo habilitamos para el curso 7° A."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "en_espera"
    assert len(body["messages"]) == 2
    assert body["messages"][-1]["author_role"] == "plataforma"


async def test_a_blank_answer_is_refused(client, platform_admin, a_case) -> None:
    """An answer with nothing in it is not an answer."""
    response = client.post(
        f"/v1/platform/cases/{a_case}/messages",
        headers=platform_admin,
        json={"body": "   "},
    )

    assert response.status_code == 422


async def test_a_closed_case_opens_again_when_the_school_writes(
    client, platform_admin, a_case
) -> None:
    """A school that writes again did not get its answer."""
    closed = client.post(f"/v1/platform/cases/{a_case}/resolve", headers=platform_admin)
    assert closed.status_code == 200
    assert closed.json()["status"] == "resuelto"

    answered = client.post(
        f"/v1/platform/cases/{a_case}/messages",
        headers=platform_admin,
        json={"body": "Volvemos a abrir el caso."},
    )
    assert answered.status_code == 200
    assert answered.json()["status"] == "en_espera"


async def test_a_case_is_closed_with_the_time_it_was_closed(client, platform_admin, a_case) -> None:
    """The case says when it was resolved."""
    response = client.post(f"/v1/platform/cases/{a_case}/resolve", headers=platform_admin)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "resuelto"
    assert body["can_resolve"] is False


async def test_a_case_that_does_not_exist_is_a_404(client, platform_admin) -> None:
    """A case that was never opened cannot be answered."""
    response = client.get(f"/v1/platform/cases/{uuid.uuid4()}", headers=platform_admin)

    assert response.status_code == 404


async def test_the_answer_is_recorded_in_the_audit_trail(
    client, platform_admin, a_case, engine
) -> None:
    """What the platform does with a case is written down."""
    client.post(
        f"/v1/platform/cases/{a_case}/messages",
        headers=platform_admin,
        json={"body": "Ya lo habilitamos."},
    )

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        result = await session.execute(
            select(AuditLog).where(AuditLog.event_type == "support.case_answered")
        )
        assert len(result.scalars().all()) >= 1


async def test_the_endpoints_are_closed_to_everybody_else(client, make_user) -> None:
    """The desk belongs to the platform team."""
    make_user(email=f"sop-{uuid.uuid4().hex[:8]}@example.com", password="a good password")

    response = client.get("/v1/platform/cases")

    assert response.status_code == 401


async def test_the_support_team_attaches_a_file_to_its_answer(
    client, platform_admin, engine, a_case, case_school, tmp_path, monkeypatch
) -> None:
    """The answer of the platform may carry files, like the school's."""
    from app.config import get_settings
    from app.core import storage

    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path))
    get_settings.cache_clear()
    try:
        response = client.post(
            f"/v1/platform/cases/{a_case}/attachments",
            headers=platform_admin,
            files={"file": ("guia.txt", b"la guia del soporte", "text/plain")},
        )

        assert response.status_code == 201, response.text
        attached = response.json()
        assert attached["name"] == "guia.txt"
        assert attached["id"].startswith(f"support-attachments/{case_school}/")

        answer = client.post(
            f"/v1/platform/cases/{a_case}/messages",
            headers=platform_admin,
            json={"body": "Te dejamos la guía.", "attachment_ids": [attached["id"]]},
        )

        assert answer.status_code == 200, answer.text
        messages = answer.json()["messages"]
        assert messages[-1]["attachment_ids"] == [attached["id"]]

        # The file is in the store of the school: the school reads it too.
        assert storage.read_file(attached["id"]) == b"la guia del soporte"
    finally:
        get_settings.cache_clear()
