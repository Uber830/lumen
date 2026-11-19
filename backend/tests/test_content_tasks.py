"""Tests for the content and tasks endpoints.

These modules have finer-grained permissions than the academic one:
the access depends on the *course subject*, not just on the school.

The rules under test, from the RLS policies the migrations declared:

- reads: a school admin, the assigned teacher, or an enrolled student;
- writes: the assigned teacher;
- a submission belongs to the student who made it.
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


async def _seed_course_subject_with_teacher(
    session_factory,
    school: SchoolFixture,
    *,
    course_name: str = "10mo A",
    subject_name: str = "Matematicas",
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """A course subject the school's teacher is assigned to."""
    course_id, subject_id, course_subject_id = await seed_course_subject(
        session_factory,
        school_id=school.school_id,
        course_name=course_name,
        subject_name=subject_name,
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
# Content
# ===========================================================================


async def test_a_teacher_posts_content(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    created = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Clase 1: Introduccion",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido de la primera clase.",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["title"] == "Clase 1: Introduccion"


async def test_a_student_cannot_post_content(client, session_factory):
    """Only the assigned teacher posts content."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    response = client.post(
        "/v1/content/items",
        headers=_auth(school.student_id),
        json={
            "title": "Contenido no autorizado",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "No deberia funcionar.",
        },
    )
    assert response.status_code == 403


async def test_a_school_admin_cannot_post_content(client, session_factory):
    """The write policy allows the assigned teacher, not the admin.

    This is what the RLS policy said: `is_course_subject_teacher`,
    without the school_admin branch. An admin can delete content, but
    not author it.
    """
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    response = client.post(
        "/v1/content/items",
        headers=_auth(school.admin_id),
        json={
            "title": "Contenido del admin",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "No deberia funcionar.",
        },
    )
    assert response.status_code == 403


async def test_an_enrolled_student_reads_the_content(client, session_factory):
    """A student sees the material of the courses they are enrolled in."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Material visible",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido.",
        },
    )
    assert posted.status_code == 201, posted.text

    # Enroll the student in the course behind the course subject.
    async with session_factory() as session:
        from app.db.models import CourseSubject, StudentEnrollment

        course_subject = await session.get(CourseSubject, course_subject_id)
        session.add(
            StudentEnrollment(
                id=uuid.uuid4(),
                school_id=school.school_id,
                course_id=course_subject.course_id,
                student_id=school.student_id,
                status="active",
            )
        )
        await session.commit()

    listed = client.get("/v1/content/items", headers=_auth(school.student_id))
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_a_student_of_another_course_does_not_read_the_content(client, session_factory):
    """A student who is not enrolled sees nothing."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Material restringido",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido.",
        },
    )

    # The student is a member of the school but is not enrolled.
    listed = client.get("/v1/content/items", headers=_auth(school.student_id))
    assert listed.status_code == 200
    assert listed.json() == []


async def test_content_requires_the_field_of_its_kind(client, session_factory):
    """Each kind needs its own field."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    # A text item without a body.
    response = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Sin cuerpo",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
        },
    )
    assert response.status_code == 422

    # A link without a URL.
    response = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Sin url",
            "kind": "link",
            "course_subject_id": str(course_subject_id),
        },
    )
    assert response.status_code == 422


async def test_a_student_marks_content_as_completed(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Lectura",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido.",
        },
    )
    content_id = posted.json()["id"]

    marked = client.post(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(school.student_id),
    )
    # The student is not enrolled, so they cannot reach it.
    assert marked.status_code == 403


async def test_marking_content_completed_is_idempotent(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Lectura",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido.",
        },
    )
    content_id = posted.json()["id"]

    # The teacher can reach it, and the teacher is the author.
    first = client.post(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(school.teacher_id),
    )
    assert first.status_code == 201, first.text

    second = client.post(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(school.teacher_id),
    )
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]


async def test_the_teacher_sees_who_completed_the_content(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Lectura",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido.",
        },
    )
    content_id = posted.json()["id"]

    client.post(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(school.teacher_id),
    )

    progress = client.get(
        f"/v1/content/items/{content_id}/progress",
        headers=_auth(school.teacher_id),
    )
    assert progress.status_code == 200
    assert len(progress.json()) == 1


async def test_a_school_admin_deletes_content(client, session_factory):
    """The delete policy allows the admin, even though the write
    policy does not."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/content/items",
        headers=_auth(school.teacher_id),
        json={
            "title": "Material",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido.",
        },
    )
    content_id = posted.json()["id"]

    deleted = client.delete(
        f"/v1/content/items/{content_id}",
        headers=_auth(school.admin_id),
    )
    assert deleted.status_code == 204


async def test_content_from_another_school_is_invisible(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school_b)

    posted = client.post(
        "/v1/content/items",
        headers=_auth(school_b.teacher_id),
        json={
            "title": "Material de B",
            "kind": "text",
            "course_subject_id": str(course_subject_id),
            "body": "Contenido.",
        },
    )
    content_id = posted.json()["id"]

    # A's teacher cannot see it.
    listed = client.get("/v1/content/items", headers=_auth(school_a.teacher_id))
    assert listed.status_code == 200
    assert listed.json() == []

    # Nor update it.
    updated = client.patch(
        f"/v1/content/items/{content_id}",
        headers=_auth(school_a.teacher_id),
        json={"title": "Secuestrado"},
    )
    assert updated.status_code == 404


# ===========================================================================
# Tasks
# ===========================================================================


async def test_a_teacher_posts_a_task(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    created = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={
            "title": "TP Ecuaciones",
            "course_subject_id": str(course_subject_id),
            "max_score": 100,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["title"] == "TP Ecuaciones"


async def test_a_student_cannot_post_a_task(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    response = client.post(
        "/v1/tasks",
        headers=_auth(school.student_id),
        json={
            "title": "Tarea no autorizada",
            "course_subject_id": str(course_subject_id),
        },
    )
    assert response.status_code == 403


async def test_a_student_submits_a_task(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

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
    # The student is not enrolled in the course.
    assert submitted.status_code == 403


async def test_the_teacher_grades_a_submission(client, session_factory):
    """The teacher sets the grade and the feedback."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    submitted = client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.teacher_id),
        params={"task_id": task_id},
        json={"body": "Mi respuesta", "status": "submitted"},
    )
    assert submitted.status_code == 201, submitted.text
    submission_id = submitted.json()["id"]

    graded = client.patch(
        f"/v1/tasks/submissions/{submission_id}",
        headers=_auth(school.teacher_id),
        json={"grade": 85, "feedback": "Bien hecho", "status": "graded"},
    )
    assert graded.status_code == 200, graded.text
    body = graded.json()
    assert str(body["grade"]) == "85"
    assert body["status"] == "graded"
    assert body["graded_by"] == str(school.teacher_id)
    assert body["graded_at"] is not None


async def test_a_student_cannot_grade_their_own_submission(client, session_factory):
    """The student cannot set their own grade."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    submitted = client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.teacher_id),
        params={"task_id": task_id},
        json={"body": "Mi respuesta", "status": "submitted"},
    )
    submission_id = submitted.json()["id"]

    # The teacher submits; the student tries to grade it.
    response = client.patch(
        f"/v1/tasks/submissions/{submission_id}",
        headers=_auth(school.student_id),
        json={"grade": 100, "status": "graded"},
    )
    # The student is neither the owner nor the teacher.
    assert response.status_code == 403


async def test_a_graded_submission_needs_a_grade(client, session_factory):
    """The consistency check the database has, as a readable error."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    submitted = client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.teacher_id),
        params={"task_id": task_id},
        json={"body": "Mi respuesta", "status": "submitted"},
    )
    submission_id = submitted.json()["id"]

    response = client.patch(
        f"/v1/tasks/submissions/{submission_id}",
        headers=_auth(school.teacher_id),
        json={"status": "graded"},
    )
    assert response.status_code == 422
    assert "grade" in response.json()["detail"].lower()


async def test_returning_a_submission_clears_the_grade(client, session_factory):
    """Returning a submission resets its grading."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    submitted = client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.teacher_id),
        params={"task_id": task_id},
        json={"body": "Mi respuesta", "status": "submitted"},
    )
    submission_id = submitted.json()["id"]

    client.patch(
        f"/v1/tasks/submissions/{submission_id}",
        headers=_auth(school.teacher_id),
        json={"grade": 85, "status": "graded"},
    )

    returned = client.patch(
        f"/v1/tasks/submissions/{submission_id}",
        headers=_auth(school.teacher_id),
        json={"status": "returned"},
    )
    assert returned.status_code == 200, returned.text
    body = returned.json()
    assert body["status"] == "returned"
    assert body["grade"] is None
    assert body["graded_at"] is None
    assert body["submitted_at"] is None


async def test_a_student_sees_only_their_own_submissions(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.teacher_id),
        params={"task_id": task_id},
        json={"body": "Del profesor", "status": "submitted"},
    )

    listed = client.get("/v1/tasks/submissions", headers=_auth(school.student_id))
    assert listed.status_code == 200
    assert listed.json() == []


async def test_the_school_admin_sees_every_submission(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.teacher_id),
        params={"task_id": task_id},
        json={"body": "Entrega", "status": "submitted"},
    )

    listed = client.get("/v1/tasks/submissions", headers=_auth(school.admin_id))
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_the_task_list_carries_the_submission_counts(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.teacher_id),
        params={"task_id": task_id},
        json={"body": "Entrega", "status": "submitted"},
    )

    listed = client.get("/v1/tasks", headers=_auth(school.teacher_id))
    assert listed.status_code == 200
    tasks = listed.json()
    assert len(tasks) == 1
    assert tasks[0]["total_submissions"] == 1
    assert tasks[0]["pending_submissions"] == 1
    assert tasks[0]["course_subject_label"]


async def test_a_submission_is_unique_per_student_and_task(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school.teacher_id),
        json={"title": "TP", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    first = client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.teacher_id),
        params={"task_id": task_id},
        json={"body": "Primera", "status": "submitted"},
    )
    assert first.status_code == 201

    second = client.post(
        "/v1/tasks/submissions",
        headers=_auth(school.teacher_id),
        params={"task_id": task_id},
        json={"body": "Segunda", "status": "submitted"},
    )
    assert second.status_code == 409


async def test_a_task_from_another_school_is_invisible(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    _c, _s, course_subject_id = await _seed_course_subject_with_teacher(session_factory, school_b)

    posted = client.post(
        "/v1/tasks",
        headers=_auth(school_b.teacher_id),
        json={"title": "Tarea de B", "course_subject_id": str(course_subject_id)},
    )
    task_id = posted.json()["id"]

    listed = client.get("/v1/tasks", headers=_auth(school_a.teacher_id))
    assert listed.status_code == 200
    assert listed.json() == []

    updated = client.patch(
        f"/v1/tasks/{task_id}",
        headers=_auth(school_a.teacher_id),
        json={"title": "Secuestrada"},
    )
    assert updated.status_code == 404
