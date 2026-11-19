"""Tests for the academic endpoints.

The authorization rules come from the RLS policies the migrations
declared:

- reads are for any member of the school;
- writes are for school admins only.

And the tenant boundary: everything is scoped to the caller's school,
and the referenced rows have to belong to it too.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Profile
from tests.academic_helpers import (
    seed_course_and_subject,
    seed_course_subject,
    seed_school_with_members,
)
from tests.conftest import mint_token

pytestmark = pytest.mark.usefixtures("cleanup_users")


def _auth(user_id: uuid.UUID) -> dict[str, str]:
    """An Authorization header for a user."""
    return {"Authorization": f"Bearer {mint_token(str(user_id))}"}


# ---------------------------------------------------------------------------
# Academic periods
# ---------------------------------------------------------------------------


async def test_create_and_list_periods(client, engine, session_factory):
    """An admin can create a period and everyone can read it."""
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/periods",
        headers=_auth(school.admin_id),
        json={
            "name": "Primer Trimestre 2026",
            "modality": "trimestre",
            "start_date": "2026-01-15",
            "end_date": "2026-04-15",
            "is_current": True,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "Primer Trimestre 2026"
    assert body["modality"] == "trimestre"
    assert body["is_current"] is True
    assert body["school_id"] == str(school.school_id)

    # A teacher can read it.
    listed = client.get(
        "/v1/academics/periods",
        headers=_auth(school.teacher_id),
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_a_teacher_cannot_create_a_period(client, session_factory):
    """Writes are for school admins only."""
    school = await seed_school_with_members(session_factory)

    response = client.post(
        "/v1/academics/periods",
        headers=_auth(school.teacher_id),
        json={
            "name": "Trimestre",
            "modality": "trimestre",
            "start_date": "2026-01-15",
            "end_date": "2026-04-15",
        },
    )
    assert response.status_code == 403


async def test_a_student_cannot_create_a_period(client, session_factory):
    school = await seed_school_with_members(session_factory)

    response = client.post(
        "/v1/academics/periods",
        headers=_auth(school.student_id),
        json={
            "name": "Trimestre",
            "modality": "trimestre",
            "start_date": "2026-01-15",
            "end_date": "2026-04-15",
        },
    )
    assert response.status_code == 403


async def test_create_period_rejects_a_reversed_date_range(client, session_factory):
    """The end date must be on or after the start date."""
    school = await seed_school_with_members(session_factory)

    response = client.post(
        "/v1/academics/periods",
        headers=_auth(school.admin_id),
        json={
            "name": "Trimestre Invalido",
            "modality": "trimestre",
            "start_date": "2026-04-15",
            "end_date": "2026-01-15",
        },
    )
    assert response.status_code == 422


async def test_marking_a_period_current_clears_the_previous_one(client, session_factory):
    """Only one period per school can be the current one."""
    school = await seed_school_with_members(session_factory)

    first = client.post(
        "/v1/academics/periods",
        headers=_auth(school.admin_id),
        json={
            "name": "Primer Trimestre",
            "modality": "trimestre",
            "start_date": "2026-01-15",
            "end_date": "2026-04-15",
            "is_current": True,
        },
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/v1/academics/periods",
        headers=_auth(school.admin_id),
        json={
            "name": "Segundo Trimestre",
            "modality": "trimestre",
            "start_date": "2026-04-16",
            "end_date": "2026-07-15",
            "is_current": True,
        },
    )
    assert second.status_code == 201, second.text

    listed = client.get(
        "/v1/academics/periods",
        headers=_auth(school.admin_id),
    )
    periods = listed.json()
    current = [p for p in periods if p["is_current"]]
    assert len(current) == 1
    assert current[0]["name"] == "Segundo Trimestre"


async def test_update_period(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/periods",
        headers=_auth(school.admin_id),
        json={
            "name": "Trimestre",
            "modality": "trimestre",
            "start_date": "2026-01-15",
            "end_date": "2026-04-15",
        },
    )
    period_id = created.json()["id"]

    updated = client.patch(
        f"/v1/academics/periods/{period_id}",
        headers=_auth(school.admin_id),
        json={"name": "Trimestre Renombrado"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Trimestre Renombrado"
    # The fields that were not sent are untouched.
    assert updated.json()["modality"] == "trimestre"


async def test_delete_period(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/periods",
        headers=_auth(school.admin_id),
        json={
            "name": "Trimestre",
            "modality": "trimestre",
            "start_date": "2026-01-15",
            "end_date": "2026-04-15",
        },
    )
    period_id = created.json()["id"]

    deleted = client.delete(
        f"/v1/academics/periods/{period_id}",
        headers=_auth(school.admin_id),
    )
    assert deleted.status_code == 204

    listed = client.get(
        "/v1/academics/periods",
        headers=_auth(school.admin_id),
    )
    assert listed.json() == []


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------


async def test_create_and_list_courses(client, session_factory):
    """The course list carries the counts the UI renders."""
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/courses",
        headers=_auth(school.admin_id),
        json={"name": "10mo A", "grade_label": "10"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["name"] == "10mo A"

    listed = client.get("/v1/academics/courses", headers=_auth(school.admin_id))
    assert listed.status_code == 200
    courses = listed.json()
    assert len(courses) == 1
    assert courses[0]["subject_count"] == 0
    assert courses[0]["enrolled_students"] == 0
    assert courses[0]["assigned_teachers"] == 0


async def test_course_name_must_be_unique_per_school(client, session_factory):
    school = await seed_school_with_members(session_factory)

    payload = {"name": "10mo A", "grade_label": "10"}
    first = client.post("/v1/academics/courses", headers=_auth(school.admin_id), json=payload)
    assert first.status_code == 201

    second = client.post("/v1/academics/courses", headers=_auth(school.admin_id), json=payload)
    assert second.status_code == 409


async def test_two_schools_can_have_the_same_course_name(client, session_factory):
    """The uniqueness is per school, not global."""
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    payload = {"name": "10mo A", "grade_label": "10"}
    for school in (school_a, school_b):
        response = client.post(
            "/v1/academics/courses", headers=_auth(school.admin_id), json=payload
        )
        assert response.status_code == 201, response.text


# ---------------------------------------------------------------------------
# Subjects
# ---------------------------------------------------------------------------


async def test_create_subject_with_an_area(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/subjects",
        headers=_auth(school.admin_id),
        json={"name": "Matematicas", "area": "Ciencias Exactas"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["area"] == "Ciencias Exactas"


async def test_an_empty_area_becomes_null(client, session_factory):
    """The frontend sends an empty string for "no area"."""
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/subjects",
        headers=_auth(school.admin_id),
        json={"name": "Educacion Fisica", "area": ""},
    )
    assert created.status_code == 201, created.text
    assert created.json()["area"] is None


# ---------------------------------------------------------------------------
# Course subjects
# ---------------------------------------------------------------------------


async def test_offer_a_subject_in_a_course(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_id, subject_id = await seed_course_and_subject(
        session_factory, school_id=school.school_id
    )

    created = client.post(
        "/v1/academics/course-subjects",
        headers=_auth(school.admin_id),
        json={"course_id": str(course_id), "subject_id": str(subject_id)},
    )
    assert created.status_code == 201, created.text

    listed = client.get("/v1/academics/course-subjects", headers=_auth(school.admin_id))
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) == 1
    # The summary carries the names the UI renders.
    assert rows[0]["course_name"] == "10mo A"
    assert rows[0]["subject_name"] == "Matematicas"
    assert rows[0]["assigned_teachers"] == 0


async def test_cannot_offer_a_subject_using_another_schools_course(client, session_factory):
    """The referenced rows must belong to the caller's school.

    Without this check, a caller could point a row of their own school
    at another school's course, which is a way to read across the
    tenant boundary.
    """
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    course_id, subject_id, _ = await seed_course_subject(
        session_factory, school_id=school_b.school_id
    )

    response = client.post(
        "/v1/academics/course-subjects",
        headers=_auth(school_a.admin_id),
        json={"course_id": str(course_id), "subject_id": str(subject_id)},
    )
    assert response.status_code == 404, response.text


async def test_cannot_offer_a_subject_using_another_schools_subject(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    _course_b, subject_id_b, _ = await seed_course_subject(
        session_factory, school_id=school_b.school_id
    )

    created = client.post(
        "/v1/academics/courses",
        headers=_auth(school_a.admin_id),
        json={"name": "10mo A", "grade_label": "10"},
    )
    course_id_a = created.json()["id"]

    response = client.post(
        "/v1/academics/course-subjects",
        headers=_auth(school_a.admin_id),
        json={"course_id": str(course_id_a), "subject_id": str(subject_id_b)},
    )
    assert response.status_code == 404, response.text


async def test_the_same_subject_cannot_be_offered_twice_in_a_course(client, session_factory):
    school = await seed_school_with_members(session_factory)
    course_id, subject_id = await seed_course_and_subject(
        session_factory, school_id=school.school_id
    )

    payload = {"course_id": str(course_id), "subject_id": str(subject_id)}
    first = client.post(
        "/v1/academics/course-subjects", headers=_auth(school.admin_id), json=payload
    )
    assert first.status_code == 201

    second = client.post(
        "/v1/academics/course-subjects", headers=_auth(school.admin_id), json=payload
    )
    assert second.status_code == 409


# ---------------------------------------------------------------------------
# Teacher assignments
# ---------------------------------------------------------------------------


async def test_assign_a_teacher_to_a_course_subject(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _course_id, _subject_id, course_subject_id = await seed_course_subject(
        session_factory, school_id=school.school_id
    )

    created = client.post(
        "/v1/academics/teacher-assignments",
        headers=_auth(school.admin_id),
        json={
            "course_subject_id": str(course_subject_id),
            "teacher_id": str(school.teacher_id),
        },
    )
    assert created.status_code == 201, created.text

    listed = client.get("/v1/academics/teacher-assignments", headers=_auth(school.admin_id))
    assert len(listed.json()) == 1


async def test_cannot_assign_a_user_who_is_not_a_teacher(client, session_factory):
    """The role of the assigned user is checked."""
    school = await seed_school_with_members(session_factory)
    _course_id, _subject_id, course_subject_id = await seed_course_subject(
        session_factory, school_id=school.school_id
    )

    response = client.post(
        "/v1/academics/teacher-assignments",
        headers=_auth(school.admin_id),
        json={
            "course_subject_id": str(course_subject_id),
            "teacher_id": str(school.student_id),
        },
    )
    assert response.status_code == 404, response.text


async def test_cannot_assign_a_teacher_from_another_school(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    _course_id, _subject_id, course_subject_id = await seed_course_subject(
        session_factory, school_id=school_a.school_id
    )

    response = client.post(
        "/v1/academics/teacher-assignments",
        headers=_auth(school_a.admin_id),
        json={
            "course_subject_id": str(course_subject_id),
            "teacher_id": str(school_b.teacher_id),
        },
    )
    assert response.status_code == 404, response.text


async def test_a_teacher_cannot_be_assigned_twice(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _course_id, _subject_id, course_subject_id = await seed_course_subject(
        session_factory, school_id=school.school_id
    )

    payload = {
        "course_subject_id": str(course_subject_id),
        "teacher_id": str(school.teacher_id),
    }
    first = client.post(
        "/v1/academics/teacher-assignments", headers=_auth(school.admin_id), json=payload
    )
    assert first.status_code == 201

    second = client.post(
        "/v1/academics/teacher-assignments", headers=_auth(school.admin_id), json=payload
    )
    assert second.status_code == 409


# ---------------------------------------------------------------------------
# Student enrollments
# ---------------------------------------------------------------------------


async def test_enroll_a_student_in_a_course(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/courses",
        headers=_auth(school.admin_id),
        json={"name": "10mo A", "grade_label": "10"},
    )
    course_id = created.json()["id"]

    enrolled = client.post(
        "/v1/academics/student-enrollments",
        headers=_auth(school.admin_id),
        json={"course_id": str(course_id), "student_id": str(school.student_id)},
    )
    assert enrolled.status_code == 201, enrolled.text
    assert enrolled.json()["status"] == "active"

    # The course list now shows the enrollment.
    courses = client.get("/v1/academics/courses", headers=_auth(school.admin_id))
    assert courses.json()[0]["enrolled_students"] == 1


async def test_cannot_enroll_a_user_who_is_not_a_student(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/courses",
        headers=_auth(school.admin_id),
        json={"name": "10mo A", "grade_label": "10"},
    )
    course_id = created.json()["id"]

    response = client.post(
        "/v1/academics/student-enrollments",
        headers=_auth(school.admin_id),
        json={"course_id": str(course_id), "student_id": str(school.teacher_id)},
    )
    assert response.status_code == 404, response.text


async def test_cannot_enroll_a_student_from_another_school(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    created = client.post(
        "/v1/academics/courses",
        headers=_auth(school_a.admin_id),
        json={"name": "10mo A", "grade_label": "10"},
    )
    course_id = created.json()["id"]

    response = client.post(
        "/v1/academics/student-enrollments",
        headers=_auth(school_a.admin_id),
        json={"course_id": str(course_id), "student_id": str(school_b.student_id)},
    )
    assert response.status_code == 404, response.text


async def test_a_student_cannot_be_enrolled_twice(client, session_factory):
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/courses",
        headers=_auth(school.admin_id),
        json={"name": "10mo A", "grade_label": "10"},
    )
    course_id = created.json()["id"]
    payload = {"course_id": str(course_id), "student_id": str(school.student_id)}

    first = client.post(
        "/v1/academics/student-enrollments", headers=_auth(school.admin_id), json=payload
    )
    assert first.status_code == 201

    second = client.post(
        "/v1/academics/student-enrollments", headers=_auth(school.admin_id), json=payload
    )
    assert second.status_code == 409


async def test_withdrawing_an_enrollment_sets_the_date(client, session_factory):
    """`withdrawn_at` follows the status."""
    school = await seed_school_with_members(session_factory)

    created = client.post(
        "/v1/academics/courses",
        headers=_auth(school.admin_id),
        json={"name": "10mo A", "grade_label": "10"},
    )
    course_id = created.json()["id"]

    enrolled = client.post(
        "/v1/academics/student-enrollments",
        headers=_auth(school.admin_id),
        json={"course_id": str(course_id), "student_id": str(school.student_id)},
    )
    enrollment_id = enrolled.json()["id"]
    assert enrolled.json()["withdrawn_at"] is None

    withdrawn = client.patch(
        f"/v1/academics/student-enrollments/{enrollment_id}",
        headers=_auth(school.admin_id),
        json={"status": "withdrawn"},
    )
    assert withdrawn.status_code == 200, withdrawn.text
    assert withdrawn.json()["status"] == "withdrawn"
    assert withdrawn.json()["withdrawn_at"] is not None


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


async def test_list_members_joins_the_profile(client, session_factory):
    """The members list carries the display name in one request."""
    school = await seed_school_with_members(session_factory)

    response = client.get("/v1/academics/members", headers=_auth(school.admin_id))
    assert response.status_code == 200, response.text

    members = response.json()
    assert len(members) == 3
    names = {m["full_name"] for m in members}
    assert names == {"Admin", "Teacher", "Student"}
    for member in members:
        assert member["school_id"] == str(school.school_id)
        assert member["email"]


async def test_list_members_filtered_by_role(client, session_factory):
    school = await seed_school_with_members(session_factory)

    response = client.get("/v1/academics/members?role=teacher", headers=_auth(school.admin_id))
    assert response.status_code == 200
    members = response.json()
    assert len(members) == 1
    assert members[0]["role"] == "teacher"


async def test_list_members_carries_the_avatar(client, session_factory):
    """The members list carries the photo of each member.

    The lists show it instead of a generic icon, so the API has to send
    it: it comes from the profile the list already joins.
    """
    school = await seed_school_with_members(session_factory)

    async with session_factory() as session:
        await session.execute(
            update(Profile)
            .where(Profile.id == school.teacher_id)
            .values(avatar_url="https://example.test/docente.png")
        )
        await session.commit()

    response = client.get("/v1/academics/members?role=teacher", headers=_auth(school.admin_id))
    assert response.status_code == 200, response.text
    member = response.json()[0]
    assert member["avatar_url"] == "https://example.test/docente.png"


async def test_list_members_without_a_photo_sends_null(client, session_factory):
    """A member without a photo has no avatar_url, not a broken one."""
    school = await seed_school_with_members(session_factory)

    response = client.get("/v1/academics/members?role=student", headers=_auth(school.admin_id))
    assert response.status_code == 200, response.text
    assert response.json()[0]["avatar_url"] is None


async def test_members_of_another_school_are_not_listed(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    response = client.get("/v1/academics/members", headers=_auth(school_a.admin_id))
    assert response.status_code == 200

    school_ids = {m["school_id"] for m in response.json()}
    assert school_ids == {str(school_a.school_id)}
    assert str(school_b.school_id) not in school_ids


# ---------------------------------------------------------------------------
# The tenant boundary
# ---------------------------------------------------------------------------


async def test_a_caller_sees_only_their_own_school(client, session_factory):
    """Every list is scoped to the caller's school."""
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    # A second school, so the assertion below is meaningful: the
    # caller must not see its rows.
    await seed_school_with_members(session_factory, prefix="BB")

    for path in (
        "/v1/academics/periods",
        "/v1/academics/courses",
        "/v1/academics/subjects",
        "/v1/academics/course-subjects",
        "/v1/academics/teacher-assignments",
        "/v1/academics/student-enrollments",
    ):
        response = client.get(path, headers=_auth(school_a.admin_id))
        assert response.status_code == 200, f"{path}: {response.text}"
        assert response.json() == [], f"{path} leaked rows"


async def test_updating_another_schools_course_is_a_404(client, session_factory):
    """A row from another school is invisible, not merely forbidden."""
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    created = client.post(
        "/v1/academics/courses",
        headers=_auth(school_b.admin_id),
        json={"name": "10mo B", "grade_label": "10"},
    )
    course_id = created.json()["id"]

    response = client.patch(
        f"/v1/academics/courses/{course_id}",
        headers=_auth(school_a.admin_id),
        json={"name": "Secuestrada"},
    )
    assert response.status_code == 404, response.text


async def test_deleting_another_schools_course_is_a_404(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    created = client.post(
        "/v1/academics/courses",
        headers=_auth(school_b.admin_id),
        json={"name": "10mo B", "grade_label": "10"},
    )
    course_id = created.json()["id"]

    response = client.delete(
        f"/v1/academics/courses/{course_id}",
        headers=_auth(school_a.admin_id),
    )
    assert response.status_code == 404, response.text


async def test_a_user_without_a_membership_cannot_read_the_structure(client, engine):
    """A user with no school has nothing to read."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        from app.db.models import User

        user = User(
            id=uuid.uuid4(),
            email=f"lonely-{uuid.uuid4().hex[:8]}@example.com",
            password_hash="",
            full_name="Lonely",
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    response = client.get("/v1/academics/courses", headers=_auth(user_id))
    assert response.status_code == 403, response.text
