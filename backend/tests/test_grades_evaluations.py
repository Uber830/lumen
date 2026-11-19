"""Tests for the grades and evaluations endpoints.

The sensitive property under test: **a student never receives the
answer keys**. The keys are what the scoring depends on, so they have
to stay on the server.
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
    *,
    enroll_student: bool = True,
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """A course subject the school's teacher is assigned to.

    The student is enrolled in the course by default, so they can reach
    the material of it.
    """
    course_id, subject_id, course_subject_id = await seed_course_subject(
        session_factory, school_id=school.school_id
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

    return course_id, subject_id, course_subject_id


async def _seed_period(session_factory, school_id: uuid.UUID) -> uuid.UUID:
    """An academic period for the school."""
    from app.db.models import AcademicPeriod

    period_id = uuid.uuid4()
    async with session_factory() as session:
        session.add(
            AcademicPeriod(
                id=period_id,
                school_id=school_id,
                name=f"Trimestre {period_id.hex[:6]}",
                modality="trimestre",
                start_date=__import__("datetime").date(2026, 1, 15),
                end_date=__import__("datetime").date(2026, 4, 15),
                is_current=True,
            )
        )
        await session.commit()
    return period_id


# ===========================================================================
# Grades
# ===========================================================================


async def test_a_teacher_records_a_grade(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    period_id = await _seed_period(session_factory, school.school_id)

    created = client.post(
        "/v1/grades",
        headers=_auth(school.teacher_id),
        json={
            "course_subject_id": str(course_subject_id),
            "student_id": str(school.student_id),
            "academic_period_id": str(period_id),
            "score": 4.5,
            "notes": "Buen trabajo",
        },
    )
    assert created.status_code == 201, created.text
    assert str(created.json()["score"]) == "4.5"
    assert created.json()["recorded_by"] == str(school.teacher_id)


async def test_a_student_cannot_record_a_grade(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    period_id = await _seed_period(session_factory, school.school_id)

    response = client.post(
        "/v1/grades",
        headers=_auth(school.student_id),
        json={
            "course_subject_id": str(course_subject_id),
            "student_id": str(school.student_id),
            "academic_period_id": str(period_id),
            "score": 5,
        },
    )
    assert response.status_code == 403


async def test_a_grade_is_unique_per_student_subject_period(client, session_factory):
    """Recording the same grade twice updates it."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    period_id = await _seed_period(session_factory, school.school_id)

    payload = {
        "course_subject_id": str(course_subject_id),
        "student_id": str(school.student_id),
        "academic_period_id": str(period_id),
        "score": 3,
    }
    first = client.post("/v1/grades", headers=_auth(school.teacher_id), json=payload)
    assert first.status_code == 201, first.text

    second = client.post(
        "/v1/grades",
        headers=_auth(school.teacher_id),
        json={**payload, "score": 4},
    )
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]
    assert str(second.json()["score"]) == "4"


async def test_a_grade_out_of_the_scale_is_refused(client, session_factory):
    """The Colombian scale runs from 0 to 5."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    period_id = await _seed_period(session_factory, school.school_id)

    response = client.post(
        "/v1/grades",
        headers=_auth(school.teacher_id),
        json={
            "course_subject_id": str(course_subject_id),
            "student_id": str(school.student_id),
            "academic_period_id": str(period_id),
            "score": 7,
        },
    )
    assert response.status_code == 422


async def test_a_student_reads_their_own_grades(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    period_id = await _seed_period(session_factory, school.school_id)

    client.post(
        "/v1/grades",
        headers=_auth(school.teacher_id),
        json={
            "course_subject_id": str(course_subject_id),
            "student_id": str(school.student_id),
            "academic_period_id": str(period_id),
            "score": 4,
        },
    )

    listed = client.get("/v1/grades", headers=_auth(school.student_id))
    assert listed.status_code == 200
    assert len(listed.json()) == 1


async def test_a_student_cannot_read_another_students_grades(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    period_id = await _seed_period(session_factory, school.school_id)

    client.post(
        "/v1/grades",
        headers=_auth(school.teacher_id),
        json={
            "course_subject_id": str(course_subject_id),
            "student_id": str(school.student_id),
            "academic_period_id": str(period_id),
            "score": 4,
        },
    )

    # The teacher asks for a student id that is not theirs.
    response = client.get(
        "/v1/grades",
        headers=_auth(school.teacher_id),
        params={"student_id": str(uuid.uuid4())},
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_the_grade_sheet_groups_by_subject(client, session_factory):
    """The student grade sheet is built server-side."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    period_id = await _seed_period(session_factory, school.school_id)

    client.post(
        "/v1/grades",
        headers=_auth(school.teacher_id),
        json={
            "course_subject_id": str(course_subject_id),
            "student_id": str(school.student_id),
            "academic_period_id": str(period_id),
            "score": 4.2,
        },
    )

    sheet = client.get(
        f"/v1/grades/students/{school.student_id}",
        headers=_auth(school.student_id),
    )
    assert sheet.status_code == 200, sheet.text
    body = sheet.json()
    assert len(body["rows"]) == 1
    assert body["rows"][0]["subject_name"] == "Matematicas"
    assert str(body["rows"][0]["average"]) == "4.20"
    assert len(body["periods"]) == 1


async def test_a_student_cannot_read_another_students_grade_sheet(client, session_factory):
    school = await seed_school_with_members(session_factory)

    response = client.get(
        f"/v1/grades/students/{uuid.uuid4()}",
        headers=_auth(school.student_id),
    )
    assert response.status_code == 403


async def test_grades_from_another_school_are_invisible(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school_b)
    period_id = await _seed_period(session_factory, school_b.school_id)

    client.post(
        "/v1/grades",
        headers=_auth(school_b.teacher_id),
        json={
            "course_subject_id": str(course_subject_id),
            "student_id": str(school_b.student_id),
            "academic_period_id": str(period_id),
            "score": 4,
        },
    )

    listed = client.get("/v1/grades", headers=_auth(school_a.teacher_id))
    assert listed.status_code == 200
    assert listed.json() == []


# ===========================================================================
# Evaluations
# ===========================================================================


async def _seed_evaluation(
    client,
    school: SchoolFixture,
    course_subject_id: uuid.UUID,
    *,
    published: bool = True,
) -> str:
    """Create an evaluation and return its id."""
    created = client.post(
        "/v1/evaluations",
        headers=_auth(school.teacher_id),
        json={
            "title": "Evaluacion 1",
            "course_subject_id": str(course_subject_id),
            "is_published": published,
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


async def test_a_teacher_creates_an_evaluation(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    created = client.post(
        "/v1/evaluations",
        headers=_auth(school.teacher_id),
        json={
            "title": "Evaluacion 1",
            "course_subject_id": str(course_subject_id),
            "duration_minutes": 60,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["title"] == "Evaluacion 1"


async def test_a_student_cannot_create_an_evaluation(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    response = client.post(
        "/v1/evaluations",
        headers=_auth(school.student_id),
        json={
            "title": "Evaluacion no autorizada",
            "course_subject_id": str(course_subject_id),
        },
    )
    assert response.status_code == 403


async def test_a_student_does_not_see_an_unpublished_evaluation(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    await _seed_evaluation(client, school, course_subject_id, published=False)

    listed = client.get("/v1/evaluations", headers=_auth(school.student_id))
    assert listed.status_code == 200
    assert listed.json() == []

    # The teacher does see it.
    listed = client.get("/v1/evaluations", headers=_auth(school.teacher_id))
    assert len(listed.json()) == 1


async def test_a_student_cannot_read_the_answer_keys(client, session_factory):
    """The keys are what the scoring depends on. They stay here."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    evaluation_id = await _seed_evaluation(client, school, course_subject_id)

    question = client.post(
        f"/v1/evaluations/{evaluation_id}/questions",
        headers=_auth(school.teacher_id),
        json={
            "kind": "multiple_choice",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4", "5", "6"],
            "points": 1,
        },
    )
    assert question.status_code == 201, question.text
    question_id = question.json()["id"]

    key = client.put(
        f"/v1/evaluations/{evaluation_id}/answer-keys",
        headers=_auth(school.teacher_id),
        json={"question_id": question_id, "closed_answer": 1},
    )
    assert key.status_code == 201, key.text

    # The student is refused.
    response = client.get(
        f"/v1/evaluations/{evaluation_id}/answer-keys",
        headers=_auth(school.student_id),
    )
    assert response.status_code == 403


async def test_the_teacher_reads_the_answer_keys(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    evaluation_id = await _seed_evaluation(client, school, course_subject_id)
    question = client.post(
        f"/v1/evaluations/{evaluation_id}/questions",
        headers=_auth(school.teacher_id),
        json={
            "kind": "multiple_choice",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4", "5", "6"],
        },
    )
    question_id = question.json()["id"]

    client.put(
        f"/v1/evaluations/{evaluation_id}/answer-keys",
        headers=_auth(school.teacher_id),
        json={"question_id": question_id, "closed_answer": 1},
    )

    keys = client.get(
        f"/v1/evaluations/{evaluation_id}/answer-keys",
        headers=_auth(school.teacher_id),
    )
    assert keys.status_code == 200
    assert len(keys.json()) == 1
    assert keys.json()[0]["closed_answer"] == 1


async def test_the_question_the_student_receives_has_no_key(client, session_factory):
    """The question response never carries the answer."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    evaluation_id = await _seed_evaluation(client, school, course_subject_id)
    question = client.post(
        f"/v1/evaluations/{evaluation_id}/questions",
        headers=_auth(school.teacher_id),
        json={
            "kind": "multiple_choice",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4", "5", "6"],
        },
    )
    question_id = question.json()["id"]
    client.put(
        f"/v1/evaluations/{evaluation_id}/answer-keys",
        headers=_auth(school.teacher_id),
        json={"question_id": question_id, "closed_answer": 1},
    )

    questions = client.get(
        f"/v1/evaluations/{evaluation_id}/questions",
        headers=_auth(school.student_id),
    )
    assert questions.status_code == 200, questions.text
    body = questions.json()[0]
    assert "closed_answer" not in body
    assert "correct_answer" not in body
    assert "model_answer" not in body


async def test_the_attempt_is_scored_against_the_keys(client, session_factory):
    """Submitting an attempt scores it on the server."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    evaluation_id = await _seed_evaluation(client, school, course_subject_id)
    question = client.post(
        f"/v1/evaluations/{evaluation_id}/questions",
        headers=_auth(school.teacher_id),
        json={
            "kind": "multiple_choice",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4", "5", "6"],
            "points": 2,
        },
    )
    question_id = question.json()["id"]
    client.put(
        f"/v1/evaluations/{evaluation_id}/answer-keys",
        headers=_auth(school.teacher_id),
        json={"question_id": question_id, "closed_answer": 1, "points": 2},
    )

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

    submitted = client.post(
        f"/v1/evaluations/attempts/{attempt_id}/submit",
        headers=_auth(school.student_id),
    )
    assert submitted.status_code == 200, submitted.text
    body = submitted.json()
    assert str(body["score"]) == "2.00"
    assert str(body["max_score"]) == "2.00"
    assert body["status"] == "submitted"


async def test_a_wrong_answer_scores_zero(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)

    evaluation_id = await _seed_evaluation(client, school, course_subject_id)
    question = client.post(
        f"/v1/evaluations/{evaluation_id}/questions",
        headers=_auth(school.teacher_id),
        json={
            "kind": "multiple_choice",
            "prompt": "Cuanto es 2+2?",
            "options": ["3", "4", "5", "6"],
            "points": 1,
        },
    )
    question_id = question.json()["id"]
    client.put(
        f"/v1/evaluations/{evaluation_id}/answer-keys",
        headers=_auth(school.teacher_id),
        json={"question_id": question_id, "closed_answer": 1},
    )

    attempt = client.post(
        f"/v1/evaluations/{evaluation_id}/attempts",
        headers=_auth(school.student_id),
    )
    attempt_id = attempt.json()["id"]

    client.post(
        f"/v1/evaluations/attempts/{attempt_id}/answers",
        headers=_auth(school.student_id),
        json={"question_id": question_id, "closed_answer": 0},
    )

    submitted = client.post(
        f"/v1/evaluations/attempts/{attempt_id}/submit",
        headers=_auth(school.student_id),
    )
    assert str(submitted.json()["score"]) == "0"


async def test_starting_an_attempt_is_idempotent(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    evaluation_id = await _seed_evaluation(client, school, course_subject_id)

    first = client.post(
        f"/v1/evaluations/{evaluation_id}/attempts",
        headers=_auth(school.student_id),
    )
    second = client.post(
        f"/v1/evaluations/{evaluation_id}/attempts",
        headers=_auth(school.student_id),
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]


async def test_a_student_cannot_answer_another_students_attempt(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    evaluation_id = await _seed_evaluation(client, school, course_subject_id)

    question = client.post(
        f"/v1/evaluations/{evaluation_id}/questions",
        headers=_auth(school.teacher_id),
        json={
            "kind": "multiple_choice",
            "prompt": "Pregunta",
            "options": ["a", "b"],
        },
    )
    question_id = question.json()["id"]

    attempt = client.post(
        f"/v1/evaluations/{evaluation_id}/attempts",
        headers=_auth(school.teacher_id),
    )
    attempt_id = attempt.json()["id"]

    response = client.post(
        f"/v1/evaluations/attempts/{attempt_id}/answers",
        headers=_auth(school.student_id),
        json={"question_id": question_id, "closed_answer": 0},
    )
    assert response.status_code == 403


async def test_an_unpublished_evaluation_cannot_be_started(client, session_factory):
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    evaluation_id = await _seed_evaluation(client, school, course_subject_id, published=False)

    response = client.post(
        f"/v1/evaluations/{evaluation_id}/attempts",
        headers=_auth(school.student_id),
    )
    assert response.status_code == 403


async def test_the_teacher_grades_an_open_answer(client, session_factory):
    """An open question needs a teacher, so it is not auto-scored."""
    school = await seed_school_with_members(session_factory)
    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school)
    evaluation_id = await _seed_evaluation(client, school, course_subject_id)

    question = client.post(
        f"/v1/evaluations/{evaluation_id}/questions",
        headers=_auth(school.teacher_id),
        json={"kind": "open", "prompt": "Explica tu respuesta", "points": 5},
    )
    question_id = question.json()["id"]

    client.put(
        f"/v1/evaluations/{evaluation_id}/answer-keys",
        headers=_auth(school.teacher_id),
        json={"question_id": question_id, "model_answer": "Una respuesta aceptable", "points": 5},
    )

    attempt = client.post(
        f"/v1/evaluations/{evaluation_id}/attempts",
        headers=_auth(school.student_id),
    )
    attempt_id = attempt.json()["id"]

    client.post(
        f"/v1/evaluations/attempts/{attempt_id}/answers",
        headers=_auth(school.student_id),
        json={"question_id": question_id, "text_answer": "Mi respuesta"},
    )

    submitted = client.post(
        f"/v1/evaluations/attempts/{attempt_id}/submit",
        headers=_auth(school.student_id),
    )
    assert submitted.status_code == 200, submitted.text
    # The open question counts towards the maximum but is not scored.
    assert str(submitted.json()["score"]) == "0"
    assert str(submitted.json()["max_score"]) == "5.00"

    answers = client.get(
        f"/v1/evaluations/attempts/{attempt_id}/answers",
        headers=_auth(school.teacher_id),
    )
    answer_id = answers.json()[0]["id"]

    graded = client.patch(
        f"/v1/evaluations/answers/{answer_id}/grade",
        headers=_auth(school.teacher_id),
        json={"points_awarded": 4, "feedback": "Bien"},
    )
    assert graded.status_code == 200, graded.text
    assert str(graded.json()["points_awarded"]) == "4"
    assert graded.json()["graded_by"] == str(school.teacher_id)


async def test_evaluations_from_another_school_are_invisible(client, session_factory):
    school_a = await seed_school_with_members(session_factory, prefix="AA")
    school_b = await seed_school_with_members(session_factory, prefix="BB")

    _c, _s, course_subject_id = await _seed_with_teacher(session_factory, school_b)
    evaluation_id = await _seed_evaluation(client, school_b, course_subject_id)

    listed = client.get("/v1/evaluations", headers=_auth(school_a.teacher_id))
    assert listed.status_code == 200
    assert listed.json() == []

    updated = client.patch(
        f"/v1/evaluations/{evaluation_id}",
        headers=_auth(school_a.teacher_id),
        json={"title": "Secuestrada"},
    )
    assert updated.status_code == 404
