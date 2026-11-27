"""The academic cycle of the school: its assignments and its periods.

An assignment ties a teacher to a course subject, and it is what
enables the access to the content. A period is the cycle: it has one
current period at a time, and closing it takes the material of the
cycle out of the active material.

What is checked here:

- the assignments are the ones of the school, and the count of visible
  material is computed, not guessed;
- the periods come with their status, the current one first;
- closing a period closes it and archives the material of the cycle;
- a closed period cannot be closed twice;
- marking a period as current closes the previous one;
- closing a period is the principal's: the API refuses the secondary.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import EnrollmentStatus, SchoolAdminRole, SchoolRole
from app.db.models import (
    AcademicPeriod,
    Course,
    CourseSubject,
    Grade,
    Material,
    MaterialCourse,
    MaterialSchool,
    Profile,
    SchoolMembership,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
    User,
)

pytestmark = pytest.mark.usefixtures("cleanup_users")

# The material of the tests is published and enabled for the school.
MATERIAL_AREA = "Matemáticas"


async def _auth() -> dict[str, str]:
    from tests.conftest import mint_token

    return {"Authorization": f"Bearer {mint_token()}"}


@pytest.fixture
async def cycle(engine, seeded_school):
    """A school with a teacher, a course, a subject and its material.

    The rows are committed: the HTTP client reads through its own
    connection, so a fixture-scoped transaction would be invisible to it.
    """
    school_id = seeded_school
    teacher_id = uuid.uuid4()
    student_id = uuid.uuid4()
    course_id = uuid.uuid4()
    subject_id = uuid.uuid4()
    course_subject_id = uuid.uuid4()
    period_id = uuid.uuid4()
    material_id = uuid.uuid4()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            User(
                id=teacher_id,
                email=f"docente.{teacher_id.hex[:8]}@example.com",
                password_hash="hash",
                full_name="Lucia Ferreyra",
            )
        )
        session.add(
            User(
                id=student_id,
                email=f"estudiante.{student_id.hex[:8]}@example.com",
                password_hash="hash",
                full_name="Mateo Rojas",
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
            Subject(id=subject_id, school_id=school_id, name="Matemáticas", area=MATERIAL_AREA)
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
        session.add(
            Material(
                id=material_id,
                ref=f"C-{uuid.uuid4().hex[:8].upper()}",
                title="Guide de álgebra para 7°",
                area=MATERIAL_AREA,
                kind="pdf",
                state="publicado",
                file_size_bytes=1024,
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
        session.add(
            MaterialCourse(
                id=uuid.uuid4(),
                material_id=material_id,
                course_id=course_id,
            )
        )
        session.add(
            MaterialSchool(
                id=uuid.uuid4(),
                material_id=material_id,
                school_id=school_id,
                enabled=True,
                enabled_at=datetime.now(UTC),
            )
        )
        session.add(
            Grade(
                id=uuid.uuid4(),
                school_id=school_id,
                course_subject_id=course_subject_id,
                student_id=student_id,
                academic_period_id=period_id,
                score=4,
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
        "material_id": material_id,
    }

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(delete(Grade).where(Grade.school_id == school_id))
        await session.execute(delete(MaterialSchool).where(MaterialSchool.school_id == school_id))
        await session.execute(
            delete(MaterialCourse).where(MaterialCourse.material_id == material_id)
        )
        await session.execute(delete(Material).where(Material.id == material_id))
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


async def test_the_assignment_counts_the_material_it_gives_visibility(
    client, engine, seeded_school, cycle
):
    """The count is the published material of the area that applies."""
    response = client.get("/v1/school/assignments", headers=await _auth())
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1

    # The row is the teacher, and the subjects it teaches travel inside.
    row = body["items"][0]
    assert row["teacher_name"] == "Lucia Ferreyra"
    assert len(row["assignments"]) == 1

    assignment = row["assignments"][0]
    assert assignment["course_name"] == "7° A"
    assert assignment["subject_name"] == "Matemáticas"
    assert assignment["visible_materials_count"] == 1
    assert row["visible_materials_count"] == 1


async def test_the_assignment_ignores_the_material_that_is_not_published(
    client, engine, seeded_school, cycle
):
    """A draft is not visible to anybody."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        material = await session.get(Material, cycle["material_id"])
        assert material is not None
        material.state = "borrador"
        await session.commit()

    response = client.get("/v1/school/assignments", headers=await _auth())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["items"][0]["assignments"][0]["visible_materials_count"] == 0


async def test_the_periods_come_with_their_status(client, engine, seeded_school, cycle):
    """The current period comes first and says so."""
    response = client.get("/v1/school/periods", headers=await _auth())
    assert response.status_code == 200, response.text

    periods = response.json()
    assert periods[0]["status"] == "vigente"
    assert periods[0]["is_current"] is True
    assert periods[0]["name"] == "3er Trimestre 2026"


async def test_closing_a_period_archives_the_material_of_the_cycle(
    client, engine, seeded_school, cycle
):
    """The material of the cycle leaves the active material."""
    response = client.post(
        f"/v1/school/periods/{cycle['period_id']}/close",
        headers=await _auth(),
    )
    assert response.status_code == 200, response.text
    assert response.json()["archived_materials"] == 1

    # The period is closed and it is not the current one any more.
    response = client.get("/v1/school/periods", headers=await _auth())
    periods = response.json()
    assert periods[0]["status"] == "cerrado"
    assert periods[0]["closed_at"] is not None

    # The material of the cycle is history: it is not the active
    # material of the school any more.
    response = client.get("/v1/school/material", headers=await _auth())
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 0


async def test_a_closed_period_cannot_be_closed_twice(client, engine, seeded_school, cycle):
    """Closing a closed period says that it is already closed."""
    first = client.post(
        f"/v1/school/periods/{cycle['period_id']}/close",
        headers=await _auth(),
    )
    assert first.status_code == 200, first.text

    second = client.post(
        f"/v1/school/periods/{cycle['period_id']}/close",
        headers=await _auth(),
    )
    assert second.status_code == 409
    assert "cerrado" in second.json()["detail"].lower()


async def test_marking_a_period_current_closes_the_previous_one(
    client, engine, seeded_school, cycle
):
    """A school has one current period at a time."""
    other_period_id = uuid.uuid4()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            AcademicPeriod(
                id=other_period_id,
                school_id=cycle["school_id"],
                name="4to Trimestre 2026",
                modality="trimestre",
                start_date=datetime(2026, 10, 1).date(),
                end_date=datetime(2026, 12, 31).date(),
                is_current=False,
            )
        )
        await session.commit()

    response = client.post(
        f"/v1/school/periods/{other_period_id}/set-current",
        headers=await _auth(),
    )
    assert response.status_code == 200, response.text
    assert response.json()["closed_previous"] == [str(cycle["period_id"])]

    response = client.get("/v1/school/periods", headers=await _auth())
    periods = response.json()
    assert periods[0]["id"] == str(other_period_id)
    assert periods[0]["status"] == "vigente"


async def test_closing_a_period_is_the_principal_s(client, engine, seeded_school, cycle):
    """The secondary does not close periods."""
    # The administrator of the test is demoted to the secondary rank.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        from tests.conftest import TEST_USER_ID

        for membership in (
            await session.execute(select_memberships(cycle["school_id"], uuid.UUID(TEST_USER_ID)))
        ).scalars():
            membership.admin_role = SchoolAdminRole.SECUNDARIO
        await session.commit()

    response = client.post(
        f"/v1/school/periods/{cycle['period_id']}/close",
        headers=await _auth(),
    )
    assert response.status_code == 403


def select_memberships(school_id: uuid.UUID, user_id: uuid.UUID):
    """The memberships of the caller in the school."""
    from sqlalchemy import select

    return select(SchoolMembership).where(
        SchoolMembership.school_id == school_id,
        SchoolMembership.user_id == user_id,
    )
