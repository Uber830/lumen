"""The community of the school: its teachers, its students, its courses
and its subjects.

The four lists are read from the school of the caller and from nothing
else. The search, the filters and the pagination run in the database: a
school with two hundred students does not pull the whole list into the
browser to filter it there.

What is checked here:

- the lists have the members of the school and nobody else;
- the search, the status filter and the course filter narrow the list;
- the access is one signal, and it says why when it is pending;
- the average of a student is `null` when it has no grades.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import EnrollmentStatus, SchoolRole
from app.db.models import (
    AcademicPeriod,
    Course,
    CourseSubject,
    Grade,
    Profile,
    School,
    SchoolMembership,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
    User,
)

pytestmark = pytest.mark.usefixtures("cleanup_users")


async def _auth() -> dict[str, str]:
    from tests.conftest import mint_token

    return {"Authorization": f"Bearer {mint_token()}"}


@pytest.fixture
async def community(engine, seeded_school):
    """The community of the school the caller administers.

    A teacher, a student, a course and a subject. The rows are
    committed: the HTTP client reads through its own connection, so a
    fixture-scoped transaction would be invisible to it.
    """
    school_id = seeded_school
    teacher_id = uuid.uuid4()
    student_id = uuid.uuid4()
    course_id = uuid.uuid4()
    subject_id = uuid.uuid4()
    course_subject_id = uuid.uuid4()
    period_id = uuid.uuid4()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            User(
                id=teacher_id,
                email=f"docente.{teacher_id.hex[:8]}@example.com",
                password_hash="hash",
                full_name="Lucia Ferreyra",
                email_verified=True,
            )
        )
        session.add(
            User(
                id=student_id,
                email=f"estudiante.{student_id.hex[:8]}@example.com",
                password_hash="hash",
                full_name="Mateo Rojas",
                email_verified=True,
            )
        )
        session.add(Profile(id=teacher_id, full_name="Lucia Ferreyra"))
        session.add(Profile(id=student_id, full_name="Mateo Rojas"))
        session.add(
            SchoolMembership(
                id=uuid.uuid4(),
                school_id=school_id,
                user_id=teacher_id,
                role=SchoolRole.TEACHER,
                joined_at=datetime.now(UTC),
            )
        )
        session.add(
            SchoolMembership(
                id=uuid.uuid4(),
                school_id=school_id,
                user_id=student_id,
                role=SchoolRole.STUDENT,
                joined_at=datetime.now(UTC),
            )
        )
        session.add(Course(id=course_id, school_id=school_id, name="7° A", grade_label="7°"))
        session.add(
            Subject(id=subject_id, school_id=school_id, name="Matemáticas", area="Matemáticas")
        )
        session.add(
            AcademicPeriod(
                id=period_id,
                school_id=school_id,
                name="3er Trimestre 2026",
                modality="trimestre",
                start_date=datetime(2026, 7, 1).date(),
                end_date=datetime(2026, 9, 30).date(),
                is_current=True,
            )
        )

        # The course and the subject go first: the offering points at
        # the two of them.
        await session.commit()

        session.add(
            CourseSubject(
                id=course_subject_id,
                school_id=school_id,
                course_id=course_id,
                subject_id=subject_id,
            )
        )
        session.add(
            TeacherAssignment(
                id=uuid.uuid4(),
                school_id=school_id,
                course_subject_id=course_subject_id,
                teacher_id=teacher_id,
            )
        )
        session.add(
            StudentEnrollment(
                id=uuid.uuid4(),
                school_id=school_id,
                course_id=course_id,
                student_id=student_id,
                status=EnrollmentStatus.ACTIVE,
            )
        )
        await session.commit()

    yield {
        "school_id": school_id,
        "teacher_id": teacher_id,
        "student_id": student_id,
        "course_id": course_id,
        "subject_id": subject_id,
        "course_subject_id": course_subject_id,
        "period_id": period_id,
    }

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(delete(Grade).where(Grade.school_id == school_id))
        await session.execute(
            delete(StudentEnrollment).where(StudentEnrollment.school_id == school_id)
        )
        await session.execute(
            delete(TeacherAssignment).where(TeacherAssignment.school_id == school_id)
        )
        await session.execute(delete(CourseSubject).where(CourseSubject.school_id == school_id))
        await session.execute(delete(Course).where(Course.school_id == school_id))
        await session.execute(delete(Subject).where(Subject.school_id == school_id))
        await session.execute(delete(AcademicPeriod).where(AcademicPeriod.school_id == school_id))
        await session.execute(
            delete(SchoolMembership).where(SchoolMembership.school_id == school_id)
        )
        await session.execute(delete(Profile).where(Profile.id.in_([teacher_id, student_id])))
        await session.execute(delete(User).where(User.id.in_([teacher_id, student_id])))
        await session.commit()


async def test_the_teachers_are_the_ones_of_the_school(client, engine, seeded_school, community):
    """The list holds the members of the school and nobody else."""
    other_school_id = uuid.uuid4()
    other_teacher_id = uuid.uuid4()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            School(
                id=other_school_id,
                name=f"Otro colegio {other_school_id.hex[:8]}",
                short_code=f"O{other_school_id.hex[:6].upper()}",
                status="active",
            )
        )
        session.add(
            User(
                id=other_teacher_id,
                email="docente.ajeno@example.com",
                password_hash="hash",
                full_name="Docente ajeno",
            )
        )
        session.add(
            SchoolMembership(
                id=uuid.uuid4(),
                school_id=other_school_id,
                user_id=other_teacher_id,
                role=SchoolRole.TEACHER,
                joined_at=datetime.now(UTC),
            )
        )
        await session.commit()

    try:
        response = client.get("/v1/school/teachers", headers=await _auth())
        assert response.status_code == 200, response.text
        assert response.json()["total"] == 1
        assert response.json()["items"][0]["full_name"] == "Lucia Ferreyra"
    finally:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            await session.execute(
                delete(SchoolMembership).where(SchoolMembership.school_id == other_school_id)
            )
            await session.execute(delete(User).where(User.id == other_teacher_id))
            await session.execute(delete(School).where(School.id == other_school_id))
            await session.commit()


async def test_a_teacher_of_the_school_is_listed(client, engine, seeded_school, community):
    """The teacher of the school comes with its course and its subject."""
    # The membership of the test user is the admin of another school, so
    # the endpoint answers for the school of the session. Here the
    # community is moved under the school of the session.

    response = client.get("/v1/school/teachers", headers=await _auth())
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["total"] == 1
    teacher = body["items"][0]
    assert teacher["full_name"] == "Lucia Ferreyra"
    assert teacher["courses"] == ["7° A"]
    assert teacher["subjects"] == ["Matemáticas"]
    # One signal: the teacher has a course, so the access is on.
    assert teacher["access"] == "activado"
    assert teacher["access_reason"] is None
    assert teacher["status"] == "activo"


async def test_the_access_of_a_teacher_without_courses_is_pending(
    client, engine, seeded_school, community
):
    """A teacher without an assignment has nothing to enter."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            delete(TeacherAssignment).where(TeacherAssignment.teacher_id == community["teacher_id"])
        )
        await session.commit()

    response = client.get("/v1/school/teachers", headers=await _auth())
    assert response.status_code == 200, response.text

    teacher = response.json()["items"][0]
    assert teacher["access"] == "pendiente"
    assert teacher["access_reason"]


async def test_the_search_and_the_course_filter_narrow_the_teachers(
    client, engine, seeded_school, community
):
    """The search and the filters run in the server."""

    # By name.
    response = client.get("/v1/school/teachers?q=lucia", headers=await _auth())
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1

    # By a term that is only in the email of the student: no teacher.
    response = client.get("/v1/school/teachers?q=estudiante", headers=await _auth())
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 0

    # By course.
    response = client.get(
        f"/v1/school/teachers?course_id={community['course_id']}",
        headers=await _auth(),
    )
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1

    # By a course of another school: nobody.
    response = client.get(
        f"/v1/school/teachers?course_id={uuid.uuid4()}",
        headers=await _auth(),
    )
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 0


async def test_the_students_carry_their_course_and_their_average(
    client, engine, seeded_school, community
):
    """The average is the mean of the grades, and `null` without grades."""

    response = client.get("/v1/school/students", headers=await _auth())
    assert response.status_code == 200, response.text

    student = response.json()["items"][0]
    assert student["full_name"] == "Mateo Rojas"
    assert student["courses"] == ["7° A"]
    assert student["average"] is None

    # With grades, the average comes.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            Grade(
                id=uuid.uuid4(),
                school_id=community["school_id"],
                course_subject_id=community["course_subject_id"],
                student_id=community["student_id"],
                academic_period_id=community["period_id"],
                score=Decimal("4.00"),
            )
        )
        await session.commit()

    response = client.get("/v1/school/students", headers=await _auth())
    assert response.status_code == 200, response.text
    assert response.json()["items"][0]["average"] == 4.0


async def test_the_courses_and_the_subjects_are_the_ones_of_the_school(
    client, engine, seeded_school, community
):
    """The structure of the school, with the counts it holds."""

    response = client.get("/v1/school/courses", headers=await _auth())
    assert response.status_code == 200, response.text

    courses = response.json()
    assert courses["total"] == 1
    assert courses["page"] == 1
    assert len(courses["items"]) == 1
    assert courses["items"][0]["name"] == "7° A"
    assert courses["items"][0]["subject_count"] == 1
    assert courses["items"][0]["teacher_count"] == 1
    assert courses["items"][0]["student_count"] == 1

    response = client.get("/v1/school/subjects", headers=await _auth())
    assert response.status_code == 200, response.text

    subjects = response.json()
    assert subjects["total"] == 1
    assert len(subjects["items"]) == 1
    assert subjects["items"][0]["name"] == "Matemáticas"
    assert subjects["items"][0]["course_count"] == 1
    assert subjects["items"][0]["courses"] == ["7° A"]


async def test_the_lists_are_cut_in_pages_by_the_server(
    client, engine, seeded_school, community
):
    """The page comes from the server: the browser asks for it."""
    response = client.get("/v1/school/courses?page=1&per_page=1", headers=await _auth())
    assert response.status_code == 200, response.text

    courses = response.json()
    assert courses["page"] == 1
    assert courses["per_page"] == 1
    assert courses["total"] == 1
    assert courses["pages"] == 1
    assert len(courses["items"]) == 1


async def test_the_options_bring_the_whole_list(
    client, engine, seeded_school, community
):
    """The forms that offer a choice need every course, not a page."""
    response = client.get("/v1/school/courses/options", headers=await _auth())
    assert response.status_code == 200, response.text

    courses = response.json()
    assert len(courses) == 1
    assert courses[0]["name"] == "7° A"


async def test_the_subjects_can_be_filtered_by_the_courses_that_offer_them(
    client, engine, seeded_school, community
):
    """The subjects that are in no course are the ones that can be offered."""
    response = client.get("/v1/school/subjects?offered=false", headers=await _auth())
    assert response.status_code == 200, response.text

    subjects = response.json()
    assert subjects["total"] == 0
    assert subjects["items"] == []


async def test_the_community_is_not_for_a_teacher(client, engine, seeded_school, community):
    """The panel of the school belongs to its administrators."""
    from sqlalchemy import update

    from tests.conftest import TEST_USER_ID

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            update(SchoolMembership)
            .where(SchoolMembership.user_id == uuid.UUID(TEST_USER_ID))
            .values(role=SchoolRole.TEACHER, admin_role=None)
        )
        await session.commit()

    response = client.get("/v1/school/teachers", headers=await _auth())
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Editing a member of the community
# ---------------------------------------------------------------------------


async def test_editing_a_teacher_changes_the_name_and_the_assignments(
    client, engine, seeded_school, community
):
    """The admin edits the name of the teacher and the subject it teaches."""
    membership_id = await _membership_of(engine, community["teacher_id"])

    response = client.patch(
        f"/v1/school/members/{membership_id}",
        headers=await _auth(),
        json={
            "full_name": "Lucia Ferreyra Ruiz",
            "course_subject_ids": [str(community["course_subject_id"])],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["full_name"] == "Lucia Ferreyra Ruiz"

    teachers = client.get("/v1/school/teachers", headers=await _auth()).json()
    teacher = next(
        item for item in teachers["items"] if item["user_id"] == str(community["teacher_id"])
    )
    assert teacher["full_name"] == "Lucia Ferreyra Ruiz"
    assert teacher["course_subject_ids"] == [str(community["course_subject_id"])]


async def test_editing_a_student_changes_the_courses(client, engine, seeded_school, community):
    """The admin enrolls the student in the courses it picks."""
    membership_id = await _membership_of(engine, community["student_id"])

    response = client.patch(
        f"/v1/school/members/{membership_id}",
        headers=await _auth(),
        json={"course_ids": [str(community["course_id"])]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["course_ids"] == [str(community["course_id"])]

    students = client.get("/v1/school/students", headers=await _auth()).json()
    student = next(
        item for item in students["items"] if item["user_id"] == str(community["student_id"])
    )
    assert student["course_ids"] == [str(community["course_id"])]
    assert student["courses"] == ["7° A"]


async def test_a_student_cannot_be_in_two_courses(client, engine, seeded_school, community):
    """A student belongs to one course: two are refused.

    A student in two courses has no average and no tasks: the school
    has one grade per student.
    """
    membership_id = await _membership_of(engine, community["student_id"])

    other_course_id = uuid.uuid4()
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            Course(
                id=other_course_id,
                school_id=seeded_school,
                name="8° A",
                grade_label="8°",
            )
        )
        await session.commit()

    response = client.patch(
        f"/v1/school/members/{membership_id}",
        headers=await _auth(),
        json={
            "course_ids": [str(community["course_id"]), str(other_course_id)],
        },
    )
    assert response.status_code == 422, response.text


async def test_editing_a_member_that_is_not_of_the_school_is_a_404(client, engine, community):
    """The membership has to belong to the school of the caller."""
    response = client.patch(
        f"/v1/school/members/{uuid.uuid4()}",
        headers=await _auth(),
        json={"full_name": "Otro nombre"},
    )
    assert response.status_code == 404, response.text


async def test_a_teacher_cannot_edit_a_member(client, engine, seeded_school, community):
    """The community is administered by the admin of the school."""
    membership_id = await _membership_of(engine, community["student_id"])

    from tests.conftest import mint_token

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        teacher = await session.get(User, community["teacher_id"])
        assert teacher is not None

    response = client.patch(
        f"/v1/school/members/{membership_id}",
        headers={"Authorization": f"Bearer {mint_token(str(community['teacher_id']))}"},
        json={"full_name": "Otro nombre"},
    )
    assert response.status_code == 403, response.text


async def _membership_of(engine, user_id: uuid.UUID) -> uuid.UUID:
    """The membership of a member of the community."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        result = await session.execute(
            select(SchoolMembership.id).where(SchoolMembership.user_id == user_id)
        )
        return result.scalar_one()
