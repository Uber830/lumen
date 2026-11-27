"""The channel between the school and the support team.

What is checked here:

- the school sees only its own cases;
- opening a request creates the case and starts the thread;
- adding information appends to the thread of the case;
- a case of another school answers 404, not 403;
- the school cannot resolve a case: there is no endpoint for that.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import School, SupportCase, SupportMessage

pytestmark = pytest.mark.usefixtures("cleanup_users")


async def _auth() -> dict[str, str]:
    from tests.conftest import mint_token

    return {"Authorization": f"Bearer {mint_token()}"}


@pytest.fixture
async def other_school(engine) -> AsyncGenerator[uuid.UUID, None]:
    """A second school, so the tests can look at a case that is not the
    caller's."""
    school_id = uuid.uuid4()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            School(
                id=school_id,
                name=f"Otro colegio {school_id.hex[:8]}",
                short_code=f"O{school_id.hex[:6].upper()}",
                status="active",
            )
        )
        await session.commit()

    yield school_id

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


@pytest.fixture
async def cases(engine, seeded_school, other_school):
    """One case of the school and one of another school."""
    school_id = seeded_school
    own_case_id = uuid.uuid4()
    foreign_case_id = uuid.uuid4()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            SupportCase(
                id=own_case_id,
                school_id=school_id,
                code=f"SOL-{uuid.uuid4().hex[:6].upper()}",
                title="Los docentes no ven el material de ciencias",
                category="problema_tecnico",
                channel="formulario_colegio",
                level="aviso",
                status="abierto",
                opened_at=datetime.now(UTC),
            )
        )
        session.add(
            SupportCase(
                id=foreign_case_id,
                school_id=other_school,
                code=f"SOL-{uuid.uuid4().hex[:6].upper()}",
                title="Caso de otro colegio",
                category="otro",
                channel="correo",
                level="info",
                status="abierto",
                opened_at=datetime.now(UTC),
            )
        )
        await session.commit()

    yield {
        "school_id": school_id,
        "own_case_id": own_case_id,
        "foreign_case_id": foreign_case_id,
    }

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            delete(SupportMessage).where(SupportMessage.case_id.in_([own_case_id, foreign_case_id]))
        )
        await session.execute(delete(SupportCase).where(SupportCase.school_id == school_id))
        await session.commit()


async def test_the_school_sees_only_its_own_cases(
    client, engine, seeded_school, other_school, cases
):
    """The list is filtered by the school of the session."""
    response = client.get("/v1/school/support/cases", headers=await _auth())
    assert response.status_code == 200, response.text

    ids = [case["id"] for case in response.json()["items"]]
    assert str(cases["own_case_id"]) in ids
    assert str(cases["foreign_case_id"]) not in ids


async def test_the_list_is_cut_in_pages(client, engine, seeded_school, cases):
    """The requests come in pages, like the courses and the assignments."""
    response = client.get("/v1/school/support/cases?page=1&per_page=1", headers=await _auth())
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["per_page"] == 1
    assert len(body["items"]) == 1
    assert body["total"] >= 1
    assert body["pages"] == body["total"]


async def test_the_search_runs_in_the_server(client, engine, seeded_school, cases):
    """The text looks for the title or the code of the request.

    The search does not run in the browser: it has to reach the cases of
    the school that are not on the page.
    """
    response = client.get("/v1/school/support/cases?q=ciencias", headers=await _auth())
    assert response.status_code == 200, response.text

    body = response.json()
    ids = [case["id"] for case in body["items"]]
    assert str(cases["own_case_id"]) in ids
    assert str(cases["foreign_case_id"]) not in ids
    assert body["total"] >= 1

    # A code also finds its request.
    own_case = await _case_code(engine, cases["own_case_id"])
    by_code = client.get(f"/v1/school/support/cases?q={own_case}", headers=await _auth())
    assert by_code.status_code == 200, by_code.text
    assert [case["id"] for case in by_code.json()["items"]] == [str(cases["own_case_id"])]

    # A word that is not there does not bring anything.
    empty = client.get("/v1/school/support/cases?q=zzzsincoincidencia", headers=await _auth())
    assert empty.status_code == 200, empty.text
    assert empty.json()["items"] == []
    assert empty.json()["total"] == 0


async def _case_code(engine, case_id) -> str:
    """The code of a case, to look for it with the search."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        case = await session.get(SupportCase, case_id)
        assert case is not None
        return case.code


async def test_the_open_cases_are_counted_for_the_bell(client, engine, seeded_school, cases):
    """The counter of the rail counts every case of the school."""
    response = client.get("/v1/school/support/open-count", headers=await _auth())
    assert response.status_code == 200, response.text
    assert response.json()["count"] >= 1


async def test_the_detail_carries_the_thread(client, engine, seeded_school, cases):
    """The case comes with its messages and who wrote them."""
    response = client.get(
        f"/v1/school/support/cases/{cases['own_case_id']}",
        headers=await _auth(),
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["title"] == "Los docentes no ven el material de ciencias"
    assert body["category"] == "problema_tecnico"
    assert body["status"] == "abierto"
    assert body["messages"] == []


async def test_opening_a_request_starts_the_thread(client, engine, seeded_school, cases):
    """The first message of the thread is the one of the administrator."""
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

    body = response.json()
    assert body["title"] == "El material de 8° no aparece"
    assert body["status"] == "abierto"
    assert body["channel"] == "formulario_colegio"
    assert len(body["messages"]) == 1
    assert body["messages"][0]["author_role"] == "colegio"
    assert body["messages"][0]["body"] == "Los docentes de 8° A no ven el material de ciencias."
    # The code follows the ones already in use.
    assert body["code"].startswith("SOL-")


async def test_a_request_without_a_message_is_refused(client, engine, seeded_school, cases):
    """The thread cannot start empty."""
    response = client.post(
        "/v1/school/support/cases",
        headers=await _auth(),
        json={"title": "Solo el asunto", "category": "otro", "body": "   "},
    )
    assert response.status_code == 422, response.text


async def test_adding_information_appends_to_the_thread(client, engine, seeded_school, cases):
    """The school adds information to the thread of its case."""
    response = client.post(
        f"/v1/school/support/cases/{cases['own_case_id']}/messages",
        headers=await _auth(),
        json={"body": "Añadimos el reporte de los docentes de 7° A."},
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert len(body["messages"]) == 1
    assert body["messages"][0]["author_role"] == "colegio"
    assert body["messages"][0]["body"] == "Añadimos el reporte de los docentes de 7° A."


async def test_a_case_of_another_school_answers_404(
    client, engine, seeded_school, other_school, cases
):
    """A 404, not a 403: the case of another school does not exist."""
    detail = client.get(
        f"/v1/school/support/cases/{cases['foreign_case_id']}",
        headers=await _auth(),
    )
    assert detail.status_code == 404, detail.text

    reply = client.post(
        f"/v1/school/support/cases/{cases['foreign_case_id']}/messages",
        headers=await _auth(),
        json={"body": "Hola"},
    )
    assert reply.status_code == 404, reply.text


async def test_the_school_cannot_resolve_a_case(client, engine, seeded_school, cases):
    """Resolving is the platform team's decision: there is no endpoint.

    The API does not offer the action, so the only way to mark a case as
    resolved is to write in the database, which the school cannot do.
    """
    response = client.patch(
        f"/v1/school/support/cases/{cases['own_case_id']}",
        headers=await _auth(),
        json={"status": "resuelto"},
    )
    assert response.status_code in (404, 405), response.text

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        case = await session.get(SupportCase, cases["own_case_id"])
        assert case is not None
        assert case.status == "abierto"
