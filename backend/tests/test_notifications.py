"""Tests for the notifications module.

Two things are under test:

- the **triggers**: the domain modules create the notification when
  something happens, and address it to the right person;
- the **endpoints**: the bell reads the notifications of the caller
  and nobody else's.

The rules, in one line each:

- a task posted goes to the students enrolled in the course;
- a submission goes to the teachers of the course subject;
- a grading goes to the student who submitted;
- new material goes to the students enrolled in the course;
- a chat message goes to the other members of the conversation.
"""

from __future__ import annotations

import uuid
from typing import Any

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
    *,
    enroll_student: bool = True,
) -> uuid.UUID:
    """A course subject, with the school's teacher assigned to it.

    When `enroll_student` is true the school's student is enrolled in
    the course behind it, which is what makes them a recipient.
    """
    course_id, _subject_id, course_subject_id = await seed_course_subject(
        session_factory,
        school_id=school.school_id,
    )

    from app.db.models import StudentEnrollment, TeacherAssignment

    async with session_factory() as session:
        session.add(
            TeacherAssignment(
                id=uuid.uuid4(),
                school_id=school.school_id,
                course_subject_id=course_subject_id,
                teacher_id=school.teacher_id,
            )
        )
        if enroll_student:
            session.add(
                StudentEnrollment(
                    id=uuid.uuid4(),
                    school_id=school.school_id,
                    course_id=course_id,
                    student_id=school.student_id,
                    status="active",
                )
            )
        await session.commit()

    return course_subject_id


def _notifications(client, user_id: uuid.UUID) -> list[dict[str, Any]]:
    """The notifications the user can see."""
    response = client.get("/v1/notifications", headers=_auth(user_id))
    assert response.status_code == 200, response.text
    return response.json()


# ===========================================================================
# The triggers
# ===========================================================================


async def test_a_posted_task_notifies_the_enrolled_students(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    created = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP Ecuaciones", "course_subject_id": str(course_subject_id)},
    )
    assert created.status_code == 201, created.text

    rows = _notifications(client, school.student_id)
    assert len(rows) == 1
    assert rows[0]["kind"] == "task_assigned"
    assert "TP Ecuaciones" in rows[0]["title"]
    assert rows[0]["read_at"] is None
    assert rows[0]["link"] == "/estudiante/tareas"


async def test_a_posted_task_does_not_notify_a_student_that_is_not_enrolled(
    client, session_factory
):
    """Only the students of the course are told."""
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(
        session_factory, school, enroll_student=False
    )

    client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )

    assert _notifications(client, school.student_id) == []


async def test_a_posted_task_does_not_notify_the_teacher(client, session_factory):
    """The teacher wrote the task; they are not a recipient."""
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )

    assert _notifications(client, school.teacher_id) == []


async def test_a_submitted_task_notifies_the_teacher(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    submitted = client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.student_id),
        params={"task_id": task_id},
        json={"body": "Mi respuesta", "status": "submitted"},
    )
    assert submitted.status_code == 201, submitted.text

    rows = _notifications(client, school.teacher_id)
    assert len(rows) == 1
    assert rows[0]["kind"] == "task_submitted"
    assert rows[0]["link"] == "/docente/materia"


async def test_a_draft_submission_does_not_notify_the_teacher(client, session_factory):
    """A draft is not news yet."""
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )

    client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.student_id),
        params={"task_id": posted.json()["id"]},
        json={"body": "Borrador", "status": "draft"},
    )

    assert _notifications(client, school.teacher_id) == []


async def test_a_graded_task_notifies_the_student(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    submitted = client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.student_id),
        params={"task_id": task_id},
        json={"body": "Mi respuesta", "status": "submitted"},
    )
    submission_id = submitted.json()["id"]

    graded = client.patch(
        f"/v1/tasks/submissions/{submission_id}",
        headers=_auth(school.teacher_id),
        json={"grade": 85, "feedback": "Bien hecho", "status": "graded"},
    )
    assert graded.status_code == 200, graded.text

    rows = _notifications(client, school.student_id)
    kinds = [row["kind"] for row in rows]
    assert "task_graded" in kinds
    graded_row = next(row for row in rows if row["kind"] == "task_graded")
    assert "85" in graded_row["body"]


async def test_grading_twice_notifies_once(client, session_factory):
    """The student is told when the grading happens, not on every edit."""
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )

    submitted = client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.student_id),
        params={"task_id": posted.json()["id"]},
        json={"body": "Mi respuesta", "status": "submitted"},
    )
    submission_id = submitted.json()["id"]

    client.patch(
        f"/v1/tasks/submissions/{submission_id}",
        headers=_auth(school.teacher_id),
        json={"grade": 85, "status": "graded"},
    )
    client.patch(
        f"/v1/tasks/submissions/{submission_id}",
        headers=_auth(school.teacher_id),
        json={"feedback": "Corregido", "status": "graded"},
    )

    rows = _notifications(client, school.student_id)
    assert len([row for row in rows if row["kind"] == "task_graded"]) == 1


async def test_new_content_notifies_the_enrolled_students(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Clase 1",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido.",
        },
    )
    assert posted.status_code == 201, posted.text

    rows = _notifications(client, school.student_id)
    assert len(rows) == 1
    assert rows[0]["kind"] == "content_published"
    assert "Clase 1" in rows[0]["title"]


async def test_a_chat_message_notifies_the_other_members(client, session_factory):
    school = await seed_school_with_members(session_factory)

    conversation = client.post(
        "/v1/chat/conversations",
        headers=_auth(school.teacher_id),
        json={
            "title": "Grupo del grado",
            "kind": "group",
            "member_ids": [str(school.student_id)],
        },
    )
    assert conversation.status_code == 201, conversation.text
    conversation_id = conversation.json()["id"]

    sent = client.post(
        f"/v1/chat/conversations/{conversation_id}/messages",
        headers=_auth(school.teacher_id),
        json={"body": "Hola, revisen la tarea"},
    )
    assert sent.status_code == 201, sent.text

    rows = _notifications(client, school.student_id)
    assert len(rows) == 1
    assert rows[0]["kind"] == "chat_message"
    assert "Hola" in rows[0]["body"]
    assert rows[0]["link"] == "/estudiante/chat"

    # The sender is not a recipient of their own message.
    assert _notifications(client, school.teacher_id) == []


# ===========================================================================
# The endpoints
# ===========================================================================


async def test_the_list_only_shows_the_notifications_of_the_caller(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )

    # The student has one; the teacher has none.
    assert len(_notifications(client, school.student_id)) == 1
    assert _notifications(client, school.teacher_id) == []


async def test_the_unread_count_counts_what_is_left_to_read(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )

    counted = client.get("/v1/notifications/unread-count", headers=_auth(school.student_id))
    assert counted.status_code == 200, counted.text
    assert counted.json()["unread"] == 1

    rows = _notifications(client, school.student_id)
    client.post(f"/v1/notifications/{rows[0]['id']}/read", headers=_auth(school.student_id))

    counted = client.get("/v1/notifications/unread-count", headers=_auth(school.student_id))
    assert counted.json()["unread"] == 0


async def test_marking_one_notification_as_read(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    notification_id = _notifications(client, school.student_id)[0]["id"]

    marked = client.post(
        f"/v1/notifications/{notification_id}/read",
        headers=_auth(school.student_id),
    )
    assert marked.status_code == 200, marked.text
    assert marked.json()["read_at"] is not None


async def test_marking_everything_as_read(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Clase 1",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido.",
        },
    )

    marked = client.post("/v1/notifications/read-all", headers=_auth(school.student_id))
    assert marked.status_code == 200, marked.text
    assert marked.json()["updated"] == 2

    counted = client.get("/v1/notifications/unread-count", headers=_auth(school.student_id))
    assert counted.json()["unread"] == 0


async def test_only_the_unread_notifications_can_be_listed(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    notification_id = _notifications(client, school.student_id)[0]["id"]
    client.post(f"/v1/notifications/{notification_id}/read", headers=_auth(school.student_id))

    response = client.get(
        "/v1/notifications",
        headers=_auth(school.student_id),
        params={"unread_only": "true"},
    )
    assert response.status_code == 200, response.text
    assert response.json() == []


async def test_a_notification_of_somebody_else_is_not_found(client, session_factory):
    """The ids of the other users cannot be probed.

    A notification that belongs to somebody else is a 404, not a 403:
    the caller should not be able to confirm that the id exists.
    """
    school_a = await seed_school_with_members(session_factory, prefix="NA")
    school_b = await seed_school_with_members(session_factory, prefix="NB")

    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school_a)
    client.post(
        "/v1/tasks",
        headers=_auth(school_a.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    notification_id = _notifications(client, school_a.student_id)[0]["id"]

    # Another user cannot read it, nor mark it as read, nor delete it.
    assert (
        client.post(
            f"/v1/notifications/{notification_id}/read",
            headers=_auth(school_b.student_id),
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/v1/notifications/{notification_id}",
            headers=_auth(school_b.student_id),
        ).status_code
        == 404
    )


async def test_a_notification_is_dismissed(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    notification_id = _notifications(client, school.student_id)[0]["id"]

    dismissed = client.delete(
        f"/v1/notifications/{notification_id}",
        headers=_auth(school.student_id),
    )
    assert dismissed.status_code == 204, dismissed.text
    assert _notifications(client, school.student_id) == []


async def test_the_list_is_bounded(client, session_factory):
    """The bell asks for a limited list, not the whole history."""
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    for index in range(3):
        client.post(
            "/v1/tasks",
            headers=_auth(school.teacher_id),
            json={
                "title": f"TP {index}",
                "course_subject_id": str(course_subject_id),
            },
        )

    response = client.get(
        "/v1/notifications",
        headers=_auth(school.student_id),
        params={"limit": 2},
    )
    assert response.status_code == 200, response.text
    assert len(response.json()) == 2
