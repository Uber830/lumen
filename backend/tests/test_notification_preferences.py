"""Tests for the notification preferences.

The preferences say what a user wants to be told about, and how. Two
things are under test:

- the **endpoints**: the caller reads and changes their own
  preferences, and never anybody else's;
- the **effect**: a user who turned a kind off inside the app does not
  get that notification.

The email channel is stored but has no provider behind it yet, so it
is only checked as a value, never as a delivery.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest

from tests.academic_helpers import SchoolFixture, seed_school_with_members
from tests.conftest import mint_token

pytestmark = pytest.mark.usefixtures("cleanup_users")


def _auth(user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {mint_token(str(user_id))}"}


async def _seed_course_subject_with_teacher(
    session_factory,
    school: SchoolFixture,
) -> uuid.UUID:
    """A course subject with the school's teacher and student in it."""
    from app.db.models import StudentEnrollment, TeacherAssignment

    course_id, _subject_id, course_subject_id = await _seed_course(session_factory, school)

    async with session_factory() as session:
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
            )
        )
        await session.commit()

    return course_subject_id


async def _seed_course(session_factory, school: SchoolFixture):
    from tests.academic_helpers import seed_course_subject

    return await seed_course_subject(session_factory, school_id=school.school_id)


async def _preferences(client, user_id: uuid.UUID) -> list[dict[str, Any]]:
    response = client.get("/v1/notifications/preferences", headers=_auth(user_id))
    assert response.status_code == 200, response.text
    return response.json()["preferences"]


async def _set_preferences(
    client, user_id: uuid.UUID, changes: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    response = client.patch(
        "/v1/notifications/preferences",
        headers=_auth(user_id),
        json={"preferences": changes},
    )
    assert response.status_code == 200, response.text
    return response.json()["preferences"]


def _find(preferences: list[dict[str, Any]], kind: str) -> dict[str, Any]:
    return next(preference for preference in preferences if preference["kind"] == kind)


# ===========================================================================
# The endpoints
# ===========================================================================


async def test_a_new_user_gets_the_defaults(client, session_factory):
    """Every kind is answered, even the ones never touched."""
    school = await seed_school_with_members(session_factory)

    preferences = await _preferences(client, school.student_id)
    kinds = {preference["kind"] for preference in preferences}
    assert kinds == {
        "task_assigned",
        "task_submitted",
        "task_graded",
        "content_published",
        "chat_message",
        "support_case_opened",
        "support_case_replied",
    }
    for preference in preferences:
        assert preference["in_app"] is True
        assert preference["email"] is False


async def test_a_change_is_kept(client, session_factory):
    school = await seed_school_with_members(session_factory)

    await _set_preferences(client, school.student_id, [{"kind": "task_graded", "in_app": False}])

    preferences = await _preferences(client, school.student_id)
    assert _find(preferences, "task_graded")["in_app"] is False
    # The kinds that were not mentioned keep the default.
    assert _find(preferences, "task_assigned")["in_app"] is True


async def test_a_change_only_touches_the_channel_that_was_sent(client, session_factory):
    """Turning the app off leaves the email alone, and the other way."""
    school = await seed_school_with_members(session_factory)

    await _set_preferences(client, school.student_id, [{"kind": "chat_message", "email": True}])
    await _set_preferences(client, school.student_id, [{"kind": "chat_message", "in_app": False}])

    preference = _find(await _preferences(client, school.student_id), "chat_message")
    assert preference["in_app"] is False
    assert preference["email"] is True


async def test_a_change_that_mentions_nothing_is_refused(client, session_factory):
    school = await seed_school_with_members(session_factory)

    response = client.patch(
        "/v1/notifications/preferences",
        headers=_auth(school.student_id),
        json={"preferences": [{"kind": "chat_message"}]},
    )
    assert response.status_code == 422


async def test_an_unknown_kind_is_refused(client, session_factory):
    school = await seed_school_with_members(session_factory)

    response = client.patch(
        "/v1/notifications/preferences",
        headers=_auth(school.student_id),
        json={"preferences": [{"kind": "not_a_kind", "in_app": False}]},
    )
    assert response.status_code == 422


async def test_the_preferences_are_personal(client, session_factory):
    """One user turning something off does not turn it off for another."""
    school = await seed_school_with_members(session_factory)

    await _set_preferences(client, school.student_id, [{"kind": "task_assigned", "in_app": False}])

    student = _find(await _preferences(client, school.student_id), "task_assigned")
    teacher = _find(await _preferences(client, school.teacher_id), "task_assigned")
    assert student["in_app"] is False
    assert teacher["in_app"] is True


# ===========================================================================
# The effect
# ===========================================================================


async def test_a_kind_turned_off_does_not_reach_the_user(client, session_factory):
    """The preference is what the user asked for, and it is honoured."""
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    await _set_preferences(client, school.student_id, [{"kind": "task_assigned", "in_app": False}])

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    assert posted.status_code == 201, posted.text

    listed = client.get("/v1/notifications", headers=_auth(school.student_id))
    assert listed.status_code == 200
    assert listed.json() == []


async def test_a_kind_turned_on_still_reaches_the_user(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    assert posted.status_code == 201, posted.text

    listed = client.get("/v1/notifications", headers=_auth(school.student_id))
    assert len(listed.json()) == 1


async def test_turning_one_kind_off_leaves_the_others_alone(client, session_factory):
    """The preference is per kind, not a master switch."""
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    await _set_preferences(client, school.student_id, [{"kind": "task_assigned", "in_app": False}])

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    assert posted.status_code == 201, posted.text

    # The content still arrives.
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

    listed = client.get("/v1/notifications", headers=_auth(school.student_id))
    kinds = [row["kind"] for row in listed.json()]
    assert kinds == ["content_published"]


async def test_one_users_preference_does_not_silence_the_other(client, session_factory):
    """A preference is personal: it never silences somebody else."""
    school = await seed_school_with_members(session_factory)
    course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    await _set_preferences(client, school.student_id, [{"kind": "task_submitted", "in_app": False}])

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )

    client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.student_id),
        params={"task_id": posted.json()["id"]},
        json={"body": "Mi respuesta", "status": "submitted"},
    )

    # The student turned the submission notifications off, but the
    # teacher did not: the teacher still hears about the submission.
    teacher_rows = client.get("/v1/notifications", headers=_auth(school.teacher_id))
    assert teacher_rows.status_code == 200
    assert len(teacher_rows.json()) == 1
