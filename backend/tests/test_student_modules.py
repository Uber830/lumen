"""Tests for the modules a student uses.

The student is the most restricted role: everything they read is
scoped to their own courses, and everything they write is scoped to
their own work. These tests cover the endpoints the student's screens
rely on, and the boundaries around them:

- the teachers they may write to;
- the member directory they may not read;
- their own progress on the material, and the progress of the other
  students they may not read;
- the answers of their own attempts, and the answers they may not
  touch.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

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


async def _seed_course_subject_with_teacher(
    session_factory,
    school: SchoolFixture,
) -> uuid.UUID:
    """A course subject the teacher teaches and the student takes."""
    course_id, _subject_id, course_subject_id = await seed_course_subject(
        session_factory,
        school_id=school.school_id,
    )

    async with session_factory() as session:
        from app.db.models import StudentEnrollment, TeacherAssignment

        session.add(
            TeacherAssignment(
                id=uuid.uuid4(),
                school_id=school.school_id,
                course_subject_id=course_subject_id,
                teacher_id=school.teacher_id,
            )
        )
        session.add(
            StudentEnrollment(
                id=uuid.uuid4(),
                school_id=school.school_id,
                course_id=course_id,
                student_id=school.student_id,
                status="active",
                enrolled_at=datetime.now(UTC),
            )
        )
        await session.commit()

    return course_subject_id


async def _add_student(session_factory, school: SchoolFixture) -> uuid.UUID:
    """A second student in the same school."""
    student_id = uuid.uuid4()

    async with session_factory() as session:
        from app.db.enums import SchoolRole
        from app.db.models import Profile, SchoolMembership, User

        session.add(
            User(
                id=student_id,
                email=f"other-{student_id.hex[:8]}@example.com",
                password_hash="",
                full_name="Other Student",
            )
        )
        session.add(Profile(id=student_id, full_name="Other Student"))
        session.add(
            SchoolMembership(
                id=uuid.uuid4(),
                school_id=school.school_id,
                user_id=student_id,
                role=SchoolRole.STUDENT,
                is_primary=True,
                joined_at=datetime.now(UTC),
            )
        )
        await session.commit()

    return student_id


async def _seed_evaluation(client, session_factory, school: SchoolFixture) -> tuple[str, str]:
    """A published evaluation with one question. Returns their ids."""
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    evaluation = client.post(
        "/v1/evaluations",
        headers=_auth(school.teacher_id),
        json={
            "title": "Evaluacion de prueba",
            "course_subject_id": str(course_subject_id),
            "duration_minutes": 30,
            "is_published": True,
        },
    )
    assert evaluation.status_code == 201, evaluation.text
    evaluation_id = evaluation.json()["id"]

    question = client.post(
        f"/v1/evaluations/{evaluation_id}/questions",
        headers=_auth(school.teacher_id),
        json={
            "kind": "multiple_choice",
            "prompt": "¿Cuanto es 2 + 2?",
            "options": ["3", "4", "5"],
        },
    )
    assert question.status_code == 201, question.text

    return evaluation_id, question.json()["id"]


# ===========================================================================
# The teachers of a student
# ===========================================================================


async def test_a_student_lists_the_teachers_of_their_courses(client, session_factory):
    school = await seed_school_with_members(session_factory)
    await _seed_course_subject_with_teacher(session_factory, school)

    response = client.get("/v1/academics/my-teachers", headers=_auth(school.student_id))
    assert response.status_code == 200, response.text

    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["user_id"] == str(school.teacher_id)
    assert rows[0]["subjects"] == ["Matematicas"]


async def test_a_student_without_courses_has_no_teachers(client, session_factory):
    school = await seed_school_with_members(session_factory)

    response = client.get("/v1/academics/my-teachers", headers=_auth(school.student_id))
    assert response.status_code == 200, response.text
    assert response.json() == []


async def test_only_a_student_lists_their_teachers(client, session_factory):
    school = await seed_school_with_members(session_factory)
    await _seed_course_subject_with_teacher(session_factory, school)

    response = client.get("/v1/academics/my-teachers", headers=_auth(school.teacher_id))
    assert response.status_code == 403


async def test_a_student_cannot_list_the_members_of_the_school(client, session_factory):
    """The member directory carries the email and the phone of
    everybody: a student does not get it."""
    school = await seed_school_with_members(session_factory)

    response = client.get("/v1/academics/members", headers=_auth(school.student_id))
    assert response.status_code == 403


async def test_the_admin_still_lists_the_members(client, session_factory):
    school = await seed_school_with_members(session_factory)

    response = client.get("/v1/academics/members", headers=_auth(school.admin_id))
    assert response.status_code == 200, response.text
    assert len(response.json()) == 3


async def test_a_student_starts_a_conversation_with_their_teacher(client, session_factory):
    school = await seed_school_with_members(session_factory)
    await _seed_course_subject_with_teacher(session_factory, school)

    created = client.post(
        "/v1/chat/conversations",
        headers=_auth(school.student_id),
        json={
            "title": "Consulta de Matematicas",
            "kind": "direct",
            "member_ids": [str(school.teacher_id)],
        },
    )
    assert created.status_code == 201, created.text

    messages = client.get(
        f"/v1/chat/conversations/{created.json()['id']}/messages",
        headers=_auth(school.teacher_id),
    )
    assert messages.status_code == 200, messages.text


# ===========================================================================
# The progress on the material
# ===========================================================================


async def _seed_content(client, session_factory, school: SchoolFixture) -> str:
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Lectura 1",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido de la lectura.",
        },
    )
    assert posted.status_code == 201, posted.text
    return posted.json()["id"]


async def test_a_student_reads_their_own_progress(client, session_factory):
    school = await seed_school_with_members(session_factory)
    content_id = await _seed_content(client, session_factory, school)

    marked = client.post(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(school.student_id),
    )
    assert marked.status_code == 201, marked.text

    progress = client.get("/v1/content/progress", headers=_auth(school.student_id))
    assert progress.status_code == 200, progress.text

    rows = progress.json()
    assert len(rows) == 1
    assert rows[0]["content_item_id"] == content_id
    assert rows[0]["student_id"] == str(school.student_id)


async def test_a_student_does_not_read_the_progress_of_the_other_students(client, session_factory):
    school = await seed_school_with_members(session_factory)
    other_student_id = await _add_student(session_factory, school)
    content_id = await _seed_content(client, session_factory, school)

    # The other student completes the material.
    client.post(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(other_student_id),
    )

    # The student does not see that row.
    progress = client.get("/v1/content/progress", headers=_auth(school.student_id))
    assert progress.status_code == 200, progress.text
    assert progress.json() == []

    # And they cannot read the list of who completed it either.
    listing = client.get(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(school.student_id),
    )
    assert listing.status_code == 403


async def test_the_teacher_still_reads_who_completed_the_content(client, session_factory):
    school = await seed_school_with_members(session_factory)
    content_id = await _seed_content(client, session_factory, school)

    client.post(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(school.student_id),
    )

    listing = client.get(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(school.teacher_id),
    )
    assert listing.status_code == 200, listing.text
    assert len(listing.json()) == 1


# ===========================================================================
# The answers of an attempt
# ===========================================================================


async def test_a_student_clears_their_own_answer(client, session_factory):
    school = await seed_school_with_members(session_factory)
    evaluation_id, question_id = await _seed_evaluation(client, session_factory, school)

    attempt = client.post(
        f"/v1/evaluations/{evaluation_id}/attempts",
        headers=_auth(school.student_id),
    )
    assert attempt.status_code == 201, attempt.text
    attempt_id = attempt.json()["id"]

    saved = client.post(
        f"/v1/evaluations/attempts/{attempt_id}/answers",
        headers=_auth(school.student_id),
        json={"question_id": question_id, "closed_answer": 1},
    )
    assert saved.status_code == 201, saved.text

    cleared = client.delete(
        f"/v1/evaluations/attempts/{attempt_id}/answers/{question_id}",
        headers=_auth(school.student_id),
    )
    assert cleared.status_code == 204, cleared.text

    answers = client.get(
        f"/v1/evaluations/attempts/{attempt_id}/answers",
        headers=_auth(school.student_id),
    )
    assert answers.status_code == 200, answers.text
    assert answers.json() == []


async def test_a_student_cannot_clear_the_answer_of_another_student(client, session_factory):
    school = await seed_school_with_members(session_factory)
    other_student_id = await _add_student(session_factory, school)
    evaluation_id, question_id = await _seed_evaluation(client, session_factory, school)

    attempt = client.post(
        f"/v1/evaluations/{evaluation_id}/attempts",
        headers=_auth(school.student_id),
    )
    assert attempt.status_code == 201, attempt.text
    attempt_id = attempt.json()["id"]

    client.post(
        f"/v1/evaluations/attempts/{attempt_id}/answers",
        headers=_auth(school.student_id),
        json={"question_id": question_id, "closed_answer": 1},
    )

    cleared = client.delete(
        f"/v1/evaluations/attempts/{attempt_id}/answers/{question_id}",
        headers=_auth(other_student_id),
    )
    assert cleared.status_code == 403


async def test_a_teacher_cannot_clear_the_answer_of_a_student(client, session_factory):
    school = await seed_school_with_members(session_factory)
    evaluation_id, question_id = await _seed_evaluation(client, session_factory, school)

    attempt = client.post(
        f"/v1/evaluations/{evaluation_id}/attempts",
        headers=_auth(school.student_id),
    )
    attempt_id = attempt.json()["id"]

    client.post(
        f"/v1/evaluations/attempts/{attempt_id}/answers",
        headers=_auth(school.student_id),
        json={"question_id": question_id, "closed_answer": 1},
    )

    cleared = client.delete(
        f"/v1/evaluations/attempts/{attempt_id}/answers/{question_id}",
        headers=_auth(school.teacher_id),
    )
    assert cleared.status_code == 403
