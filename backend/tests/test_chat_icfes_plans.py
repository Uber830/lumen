"""Tests for the chat, ICFES authoring and plans endpoints.

The properties under test:

- a conversation is visible to its members, and to nobody else;
- a member of another school cannot join it;
- the ICFES answer keys are for the school admins only;
- the plan catalog is public, because the landing page shows it
  before anyone signs in.
"""

from __future__ import annotations

import uuid

import pytest

from tests.academic_helpers import (
    SchoolFixture,
    seed_course_subject,
    seed_school_with_members,
)
from tests.conftest import mint_token

pytestmark = pytest.mark.usefixtures("cleanup_users")


def _auth(user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {mint_token(str(user_id))}"}


async def _seed_with_teacher(
    session_factory,
    school: SchoolFixture,
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """A course subject the school's teacher is assigned to."""
    course_id, subject_id, course_subject_id = await seed_course_subject(
        session_factory, school_id=school.school_id
    )

    async with session_factory() as session:
        from app.db.models import TeacherAssignment

        session.add(
            TeacherAssignment(
                id=uuid.uuid4(),
                school_id=school.school_id,
                course_subject_id=course_subject_id,
                teacher_id=school.teacher_id,
            )
        )
        await session.commit()

    return course_id, subject_id, course_subject_id


# ===========================================================================
# Chat
# ===========================================================================


async def test_a_member_creates_a_conversation(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/chat/conversations",
        headers=_auth(school.teacher_id),
        json={
            "title": "Docentes de 10mo",
            "kind": "group",
            "member_ids": [str(school.admin_id)],
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["title"] == "Docentes de 10mo"

    members = client.get(
        f"/v1/chat/conversations/{created.json()['id']}/members",
        headers=_auth(school.teacher_id),
    )
    assert members.status_code == 200
    assert len(members.json()) == 2


async def test_a_non_member_does_not_see_the_conversation(client, session_factory):
    """A student who is not in the conversation sees nothing."""
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/chat/conversations",
        headers=_auth(school.teacher_id),
        json={"title": "Privada", "kind": "direct"},
    )
    conversation_id = created.json()["id"]

    listed = client.get("/v1/chat/conversations", headers=_auth(school.student_id))
    assert listed.status_code == 200
    assert listed.json() == []

    messages = client.get(
        f"/v1/chat/conversations/{conversation_id}/messages",
        headers=_auth(school.student_id),
    )
    assert messages.status_code == 403


async def test_a_member_sends_and_reads_messages(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/chat/conversations",
        headers=_auth(school.teacher_id),
        json={"title": "Grupo", "member_ids": [str(school.student_id)]},
    )
    conversation_id = created.json()["id"]

    sent = client.post(
        f"/v1/chat/conversations/{conversation_id}/messages",
        headers=_auth(school.teacher_id),
        json={"body": "Hola a todos"},
    )
    assert sent.status_code == 201, sent.text
    assert sent.json()["body"] == "Hola a todos"
    assert sent.json()["sender_name"] == "Teacher"

    listed = client.get(
        f"/v1/chat/conversations/{conversation_id}/messages",
        headers=_auth(school.student_id),
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_a_member_from_another_school_cannot_be_added(client, session_factory):
    """A member has to belong to the school."""
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    created = client.post(
        "/v1/chat/conversations",
        headers=_auth(school_a.teacher_id),
        json={"title": "Grupo de A"},
    )
    assert created.status_code == 201, created.text

    response = client.post(
        f"/v1/chat/conversations/{created.json()['id']}/members",
        headers=_auth(school_a.teacher_id),
        params={"user_id": str(school_b.teacher_id)},
    )
    assert response.status_code == 404, response.text


async def test_the_school_admin_sees_every_conversation(client, session_factory):
    school = await seed_school_with_members(session_factory)

    client.post(
        "/v1/chat/conversations",
        headers=_auth(school.teacher_id),
        json={"title": "Docentes"},
    )

    listed = client.get("/v1/chat/conversations", headers=_auth(school.admin_id))
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_marking_a_conversation_as_read(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/chat/conversations",
        headers=_auth(school.teacher_id),
        json={"title": "Grupo", "member_ids": [str(school.student_id)]},
    )
    conversation_id = created.json()["id"]

    response = client.post(
        f"/v1/chat/conversations/{conversation_id}/read",
        headers=_auth(school.student_id),
    )
    assert response.status_code == 204


async def test_a_conversation_from_another_school_is_invisible(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    created = client.post(
        "/v1/chat/conversations",
        headers=_auth(school_b.teacher_id),
        json={"title": "Grupo de B"},
    )
    conversation_id = created.json()["id"]

    listed = client.get("/v1/chat/conversations", headers=_auth(school_a.teacher_id))
    assert listed.status_code == 200
    assert listed.json() == []

    messages = client.get(
        f"/v1/chat/conversations/{conversation_id}/messages",
        headers=_auth(school_a.teacher_id),
    )
    assert messages.status_code == 404


# ===========================================================================
# ICFES authoring
# ===========================================================================


async def test_the_admin_fills_the_question_bank(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/icfes/questions",
        headers=_auth(school.admin_id),
        json={
            "area": "Matematicas",
            "grado": "11º",
            "difficulty": "Medio",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4", "5", "6"],
            "points": 1,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["options"] == ["3", "4", "5", "6"]


async def test_a_question_needs_exactly_four_options(client, session_factory):
    school = await seed_school_with_members(session_factory)

    response = client.post(
        "/v1/icfes/questions",
        headers=_auth(school.admin_id),
        json={
            "area": "Matematicas",
            "grado": "11º",
            "difficulty": "Medio",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4"],
        },
    )
    assert response.status_code == 422


async def test_a_teacher_cannot_fill_the_question_bank(client, session_factory):
    """The bank is for the admins: the policy allowed only them."""
    school = await seed_school_with_members(session_factory)

    response = client.post(
        "/v1/icfes/questions",
        headers=_auth(school.teacher_id),
        json={
            "area": "Matematicas",
            "grado": "11º",
            "difficulty": "Medio",
            "prompt": "Pregunta",
            "options": ["a", "b", "c", "d"],
        },
    )
    assert response.status_code == 403


async def test_a_student_cannot_read_the_question_bank(client, session_factory):
    school = await seed_school_with_members(session_factory)

    response = client.get("/v1/icfes/questions", headers=_auth(school.student_id))
    assert response.status_code == 200
    # The policy restricted the bank to the admins and the teachers.
    # The list is empty for a student because they have no assignment.
    assert response.json() == []


async def test_a_student_cannot_read_the_icfes_answer_keys(client, session_factory):
    """The keys are what the scoring depends on."""
    school = await seed_school_with_members(session_factory)

    question = client.post(
        "/v1/icfes/questions",
        headers=_auth(school.admin_id),
        json={
            "area": "Matematicas",
            "grado": "11º",
            "difficulty": "Medio",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4", "5", "6"],
        },
    )
    question_id = question.json()["id"]

    key = client.put(
        "/v1/icfes/answer-keys",
        headers=_auth(school.admin_id),
        json={"question_id": question_id, "correct_index": 1},
    )
    assert key.status_code == 201, key.text

    response = client.get("/v1/icfes/answer-keys", headers=_auth(school.student_id))
    assert response.status_code == 403


async def test_the_admin_reads_the_icfes_answer_keys(client, session_factory):
    school = await seed_school_with_members(session_factory)

    question = client.post(
        "/v1/icfes/questions",
        headers=_auth(school.admin_id),
        json={
            "area": "Matematicas",
            "grado": "11º",
            "difficulty": "Medio",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4", "5", "6"],
        },
    )
    question_id = question.json()["id"]
    client.put(
        "/v1/icfes/answer-keys",
        headers=_auth(school.admin_id),
        json={"question_id": question_id, "correct_index": 1},
    )

    keys = client.get("/v1/icfes/answer-keys", headers=_auth(school.admin_id))
    assert keys.status_code == 200
    assert len(keys.json()) == 1
    assert keys.json()[0]["correct_index"] == 1


async def test_a_teacher_creates_a_simulation(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    question = client.post(
        "/v1/icfes/questions",
        headers=_auth(school.admin_id),
        json={
            "area": "Matematicas",
            "grado": "11º",
            "difficulty": "Medio",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4", "5", "6"],
        },
    )
    question_id = question.json()["id"]

    created = client.post(
        "/v1/icfes/simulations",
        headers=_auth(school.teacher_id),
        json={
            "title": "Simulacro Saber 11",
            "course_subject_id": str(course_subject_id),
            "question_ids": [question_id],
            "is_published": True,
        },
    )
    assert created.status_code == 201, created.text

    listed = client.get("/v1/icfes/simulations", headers=_auth(school.teacher_id))
    assert listed.status_code == 200
    assert listed.json()[0]["question_count"] == 1


async def test_a_simulation_cannot_use_another_schools_question(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school_a)

    question = client.post(
        "/v1/icfes/questions",
        headers=_auth(school_b.admin_id),
        json={
            "area": "Matematicas",
            "grado": "11º",
            "difficulty": "Medio",
            "prompt": "Pregunta de B",
            "options": ["3", "4", "5", "6"],
        },
    )
    question_id = question.json()["id"]

    response = client.post(
        "/v1/icfes/simulations",
        headers=_auth(school_a.teacher_id),
        json={
            "title": "Simulacro",
            "course_subject_id": str(course_subject_id),
            "question_ids": [question_id],
        },
    )
    assert response.status_code == 404, response.text


async def test_a_student_does_not_see_an_unpublished_simulation(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    client.post(
        "/v1/icfes/simulations",
        headers=_auth(school.teacher_id),
        json={
            "title": "Borrador",
            "course_subject_id": str(course_subject_id),
            "is_published": False,
        },
    )

    listed = client.get("/v1/icfes/simulations", headers=_auth(school.student_id))
    assert listed.status_code == 200
    assert listed.json() == []


# ===========================================================================
# Plans
# ===========================================================================


async def test_the_plan_catalog_is_public(client, session_factory):
    """The landing page shows the catalog before anyone signs in."""
    code = f"p-{uuid.uuid4().hex[:8]}"
    async with session_factory() as session:
        from app.db.models import Plan

        session.add(
            Plan(
                id=uuid.uuid4(),
                code=code,
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
        )
        await session.commit()

    response = client.get("/v1/plans")
    assert response.status_code == 200, response.text
    plans = response.json()
    # The seeded catalog may be there too; the plan just created has
    # to be among them.
    matching = [plan for plan in plans if plan["code"] == code]
    assert len(matching) == 1
    assert matching[0]["price_cents"] == 49000
    assert matching[0]["includes_icfes"] is False


async def test_an_inactive_plan_is_hidden_by_default(client, session_factory):
    code = f"p-{uuid.uuid4().hex[:8]}"
    async with session_factory() as session:
        from app.db.models import Plan

        session.add(
            Plan(
                id=uuid.uuid4(),
                code=code,
                name="Retirado",
                price_cents=1000,
                currency="COP",
                interval="monthly",
                is_active=False,
            )
        )
        await session.commit()

    listed = client.get("/v1/plans")
    assert listed.status_code == 200
    assert all(plan["code"] != code for plan in listed.json())
