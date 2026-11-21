"""The simulators of the school: what the platform enabled and what it
activated.

The catalog lives in three layers and the school only touches the last
one. What is checked here:

- the school sees only the simulators the platform enabled for it;
- a draft simulator does not exist for the school;
- activating a simulator creates the activation of the chosen courses;
- the result counts the students of the activated courses;
- a simulator of another school answers 404, not 403;
- a simulator that is not published cannot be activated.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import EnrollmentStatus
from app.db.models import (
    Course,
    CourseSubject,
    IcfesActivation,
    IcfesAttempt,
    IcfesSimulation,
    IcfesSimulator,
    IcfesSimulatorSchool,
    School,
    StudentEnrollment,
    Subject,
    User,
)

pytestmark = pytest.mark.usefixtures("cleanup_users")


async def _auth() -> dict[str, str]:
    from tests.conftest import mint_token

    return {"Authorization": f"Bearer {mint_token()}"}


@pytest.fixture
async def other_school(engine) -> uuid.UUID:
    """A second school, so the tests can look at what is not the caller's."""
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
            delete(IcfesSimulatorSchool).where(IcfesSimulatorSchool.school_id == school_id)
        )
        await session.execute(delete(School).where(School.id == school_id))
        await session.commit()


@pytest.fixture
async def simulators(engine, seeded_school, other_school):
    """Two courses, two simulators of the school and one of another school.

    The rows are committed: the HTTP client reads through its own
    connection, so a fixture-scoped transaction would be invisible to it.
    """
    school_id = seeded_school
    course_id = uuid.uuid4()
    other_course_id = uuid.uuid4()
    simulator_id = uuid.uuid4()
    draft_id = uuid.uuid4()
    foreign_id = uuid.uuid4()
    student_id = uuid.uuid4()
    subject_id = uuid.uuid4()
    course_subject_id = uuid.uuid4()
    simulation_id = uuid.uuid4()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(Course(id=course_id, school_id=school_id, name="7° A", grade_label="7°"))
        session.add(Course(id=other_course_id, school_id=school_id, name="8° A", grade_label="8°"))
        session.add(
            User(
                id=student_id,
                email=f"estudiante.{student_id.hex[:8]}@example.com",
                password_hash="hash",
                full_name="Mateo Rojas",
            )
        )
        session.add(
            Subject(id=subject_id, school_id=school_id, name="Matemáticas", area="Matemáticas")
        )
        await session.commit()

        # The offering points at the course and the subject, and the
        # exam points at the offering: they go in that order.
        session.add(
            CourseSubject(
                id=course_subject_id,
                school_id=school_id,
                course_id=course_id,
                subject_id=subject_id,
            )
        )
        session.add(
            IcfesSimulation(
                id=simulation_id,
                school_id=school_id,
                course_subject_id=course_subject_id,
                posted_by=student_id,
                title="Simulacro 7° — Matemáticas",
                duration_minutes=120,
                is_published=True,
                status="cerrado",
            )
        )
        await session.commit()

        # The simulator the platform enabled for the school.
        session.add(
            IcfesSimulator(
                id=simulator_id,
                code=f"SIM-{uuid.uuid4().hex[:8].upper()}",
                name="Simulacro 7° — Saber 11",
                grade="7°",
                question_count=32,
                duration_min=120,
                scheduled_at=datetime(2026, 9, 14).date(),
                status="publicado",
                average_score=312,
                simulation_id=simulation_id,
            )
        )
        # A draft one: the platform never sends it to the school.
        session.add(
            IcfesSimulator(
                id=draft_id,
                code=f"SIM-{uuid.uuid4().hex[:8].upper()}",
                name="Simulacro 9° en borrador",
                grade="9°",
                question_count=28,
                duration_min=90,
                status="borrador",
            )
        )
        # One that belongs to another school.
        session.add(
            IcfesSimulator(
                id=foreign_id,
                code=f"SIM-{uuid.uuid4().hex[:8].upper()}",
                name="Simulacro de otro colegio",
                grade="7°",
                question_count=20,
                duration_min=60,
                status="publicado",
            )
        )
        await session.commit()

        session.add(
            IcfesSimulatorSchool(
                id=uuid.uuid4(),
                simulator_id=simulator_id,
                school_id=school_id,
                enabled_at=datetime.now(UTC),
            )
        )
        session.add(
            IcfesSimulatorSchool(
                id=uuid.uuid4(),
                simulator_id=draft_id,
                school_id=school_id,
                enabled_at=datetime.now(UTC),
            )
        )
        session.add(
            IcfesSimulatorSchool(
                id=uuid.uuid4(),
                simulator_id=foreign_id,
                school_id=other_school,
                enabled_at=datetime.now(UTC),
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
        "simulation_id": simulation_id,
        "course_id": course_id,
        "other_course_id": other_course_id,
        "simulator_id": simulator_id,
        "draft_id": draft_id,
        "foreign_id": foreign_id,
        "student_id": student_id,
    }

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(delete(IcfesAttempt).where(IcfesAttempt.student_id == student_id))
        await session.execute(delete(IcfesSimulation).where(IcfesSimulation.school_id == school_id))
        await session.execute(delete(IcfesActivation).where(IcfesActivation.school_id == school_id))
        await session.execute(
            delete(IcfesSimulatorSchool).where(IcfesSimulatorSchool.school_id == school_id)
        )
        await session.execute(
            delete(StudentEnrollment).where(StudentEnrollment.school_id == school_id)
        )
        await session.execute(
            delete(IcfesSimulator).where(IcfesSimulator.id.in_([simulator_id, draft_id]))
        )
        await session.execute(delete(CourseSubject).where(CourseSubject.school_id == school_id))
        await session.execute(delete(Subject).where(Subject.school_id == school_id))
        await session.execute(delete(Course).where(Course.school_id == school_id))
        await session.execute(delete(User).where(User.id == student_id))
        await session.commit()


async def test_the_school_sees_only_what_the_platform_enabled(
    client, engine, seeded_school, other_school, simulators
):
    """A simulator of another school does not exist for this one."""
    response = client.get("/v1/school/icfes", headers=await _auth())
    assert response.status_code == 200, response.text

    codes = [item["code"] for item in response.json()["items"]]
    assert len(codes) == 1
    # The draft is not shown either: it never reached the school.
    assert codes != [simulators["draft_id"]]


async def test_the_draft_simulator_does_not_reach_the_school(
    client, engine, seeded_school, simulators
):
    """A simulator in draft is not in the list of the school."""
    response = client.get("/v1/school/icfes", headers=await _auth())
    assert response.status_code == 200, response.text

    ids = [item["id"] for item in response.json()["items"]]
    assert str(simulators["draft_id"]) not in ids
    assert str(simulators["simulator_id"]) in ids


async def test_the_indicators_count_the_simulators_of_the_school(
    client, engine, seeded_school, simulators
):
    """The numbers come from the rows of the school."""
    response = client.get("/v1/school/icfes", headers=await _auth())
    assert response.status_code == 200, response.text

    kpis = response.json()["kpis"]
    assert kpis["available"] == 1
    assert kpis["activated"] == 0
    assert kpis["not_activated"] == 1
    assert kpis["averages_by_grade"] == [{"grade": "7°", "average_score": 312.0}]


async def test_activating_a_simulator_registers_the_courses(
    client, engine, seeded_school, simulators
):
    """The school decides the courses and the deadline."""
    response = client.post(
        f"/v1/school/icfes/{simulators['simulator_id']}/activations",
        headers=await _auth(),
        json={
            "course_ids": [str(simulators["course_id"]), str(simulators["other_course_id"])],
            "deadline": "2026-12-10",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["courses"] == ["7° A", "8° A"]

    listing = client.get("/v1/school/icfes", headers=await _auth())
    item = listing.json()["items"][0]
    assert item["activated"] is True
    assert [run["course_name"] for run in item["activations"]] == ["7° A", "8° A"]


async def test_activating_twice_updates_the_deadline(client, engine, seeded_school, simulators):
    """The same simulator in the same course updates its deadline."""
    body = {"course_ids": [str(simulators["course_id"])], "deadline": "2026-12-10"}
    first = client.post(
        f"/v1/school/icfes/{simulators['simulator_id']}/activations",
        headers=await _auth(),
        json=body,
    )
    assert first.status_code == 200, first.text

    body["deadline"] = "2026-12-20"
    second = client.post(
        f"/v1/school/icfes/{simulators['simulator_id']}/activations",
        headers=await _auth(),
        json=body,
    )
    assert second.status_code == 200, second.text

    listing = client.get("/v1/school/icfes", headers=await _auth())
    item = listing.json()["items"][0]
    assert item["activations"][0]["deadline"] == "2026-12-20"
    assert len(item["activations"]) == 1


async def test_the_activation_needs_at_least_one_course(client, engine, seeded_school, simulators):
    """A simulator without a course does not run anywhere."""
    response = client.post(
        f"/v1/school/icfes/{simulators['simulator_id']}/activations",
        headers=await _auth(),
        json={"course_ids": [], "deadline": "2026-12-10"},
    )
    assert response.status_code == 422, response.text


async def test_a_simulator_of_another_school_answers_404(
    client, engine, seeded_school, other_school, simulators
):
    """A 404, not a 403: the simulator of another school does not exist."""
    response = client.post(
        f"/v1/school/icfes/{simulators['foreign_id']}/activations",
        headers=await _auth(),
        json={"course_ids": [str(simulators["course_id"])], "deadline": "2026-12-10"},
    )
    assert response.status_code == 404, response.text

    detail = client.get(
        f"/v1/school/icfes/{simulators['foreign_id']}/results",
        headers=await _auth(),
    )
    assert detail.status_code == 404, detail.text


async def test_a_simulator_that_is_not_published_cannot_be_activated(
    client, engine, seeded_school, simulators
):
    """The school cannot activate what the platform did not publish."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        simulator = await session.get(IcfesSimulator, simulators["simulator_id"])
        assert simulator is not None
        simulator.status = "en_revision"
        await session.commit()

    response = client.post(
        f"/v1/school/icfes/{simulators['simulator_id']}/activations",
        headers=await _auth(),
        json={"course_ids": [str(simulators["course_id"])], "deadline": "2026-12-10"},
    )
    assert response.status_code == 409, response.text


async def test_the_result_counts_the_students_of_the_course(
    client, engine, seeded_school, simulators
):
    """The result is the one of the students of the activated courses."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            IcfesAttempt(
                id=uuid.uuid4(),
                school_id=simulators["school_id"],
                simulation_id=simulators["simulation_id"],
                student_id=simulators["student_id"],
                status="graded",
                global_score=340,
                max_score=500,
            )
        )
        await session.commit()

    activated = client.post(
        f"/v1/school/icfes/{simulators['simulator_id']}/activations",
        headers=await _auth(),
        json={"course_ids": [str(simulators["course_id"])], "deadline": "2026-12-10"},
    )
    assert activated.status_code == 200, activated.text

    response = client.get(
        f"/v1/school/icfes/{simulators['simulator_id']}/results",
        headers=await _auth(),
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["max_score"] == 500
    assert body["average_score"] == 312.0
    assert body["courses"][0]["course_name"] == "7° A"
    assert body["courses"][0]["deadline"] == "2026-12-10"
    # The student of the course took the exam: one answer, and its score.
    assert body["courses"][0]["students"] == 1
    assert body["courses"][0]["average_score"] == 340.0
