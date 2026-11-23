"""Academic operations.

The business logic behind the academic router: periods, courses,
subjects, the course-subject join, teacher assignments and student
enrollments.

Two rules run through all of it:

- **Every query is scoped to a school.** The school comes from the
  request context, never from the request body.

- **Every referenced row must belong to the same school.** Creating a
  course subject that points at another school's course would be a
  way to leak data across the tenant boundary, so the referenced rows
  are looked up with the school filter applied.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any, Protocol, cast

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.academics.study_plan import STUDY_PLANS, find_plan
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.db.enums import AcademicPeriodModality, EnrollmentStatus, SchoolRole
from app.db.models import (
    AcademicPeriod,
    Course,
    CourseSubject,
    Profile,
    SchoolMembership,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
    User,
)


class _ScopedRow(Protocol):
    """A row with an id and a school_id.

    The academic models all have those two columns, and the lookup
    helper needs both. The protocol keeps the helper generic without
    losing the type of the row it returns.
    """

    id: uuid.UUID
    school_id: uuid.UUID


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _conflict(detail: str) -> ConflictError:
    """A conflict with a message the user can act on."""
    return ConflictError(detail)


async def _count(session: AsyncSession, statement: Select[tuple[int]]) -> int:
    """Run a count query and return the integer."""
    result = await session.execute(statement)
    return int(result.scalar_one())


async def _get_scoped(
    session: AsyncSession,
    model: type[Any],
    row_id: uuid.UUID,
    school_id: uuid.UUID,
    *,
    label: str,
) -> Any:
    """Load a row by id, scoped to the school.

    Raises NotFoundError when the row does not exist *or* belongs to
    another school. The two cases are deliberately indistinguishable.

    The model is typed loosely because SQLAlchemy's mapped attributes
    are not visible to the type checker through a generic parameter.
    The callers annotate their own return types.
    """
    result = await session.execute(
        select(model).where(model.id == row_id, model.school_id == school_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError(f"{label} not found.")
    return row


def _scoped[T](row: Any, _expected: type[T]) -> T:
    """Narrow the loosely-typed row the lookup helper returns.

    The second argument is the expected model class; it is only there
    to give the type checker something to bind `T` to.
    """
    return cast(T, row)


# ---------------------------------------------------------------------------
# Academic periods
# ---------------------------------------------------------------------------


async def list_periods(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
) -> list[AcademicPeriod]:
    """List the school's periods, newest first."""
    result = await session.execute(
        select(AcademicPeriod)
        .where(AcademicPeriod.school_id == school_id)
        .order_by(AcademicPeriod.start_date.desc())
    )
    return list(result.scalars().all())


async def get_period(
    session: AsyncSession,
    *,
    period_id: uuid.UUID,
    school_id: uuid.UUID,
) -> AcademicPeriod:
    """Load one period."""
    return _scoped(
        await _get_scoped(session, AcademicPeriod, period_id, school_id, label="Academic period"),
        AcademicPeriod,
    )


async def create_period(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    name: str,
    modality: AcademicPeriodModality,
    start_date: date,
    end_date: date,
    is_current: bool,
) -> AcademicPeriod:
    """Create a period.

    Only one period per school can be the current one, which the
    database enforces with a partial unique index. Marking a period
    as current clears the flag on the others first, so the write
    succeeds instead of failing on the constraint.
    """
    if end_date < start_date:
        raise ValidationError("end_date must be on or after start_date.")

    if is_current:
        await _clear_current_period(session, school_id=school_id)

    period = AcademicPeriod(
        id=uuid.uuid4(),
        school_id=school_id,
        name=name,
        modality=modality,
        start_date=start_date,
        end_date=end_date,
        is_current=is_current,
    )
    session.add(period)
    await _flush_or_conflict(
        session,
        "A period with that name already exists in this school.",
    )
    return period


async def update_period(
    session: AsyncSession,
    *,
    period_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> AcademicPeriod:
    """Apply a partial update to a period."""
    period = await get_period(session, period_id=period_id, school_id=school_id)

    if changes.get("is_current") is True:
        await _clear_current_period(session, school_id=school_id, except_id=period_id)

    for field, value in changes.items():
        if value is not None:
            setattr(period, field, value)

    start = period.start_date
    end = period.end_date
    if end < start:
        raise ValidationError("end_date must be on or after start_date.")

    await _flush_or_conflict(
        session,
        "A period with that name already exists in this school.",
    )
    return period


async def delete_period(
    session: AsyncSession,
    *,
    period_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete a period."""
    period = await get_period(session, period_id=period_id, school_id=school_id)
    await session.delete(period)
    await session.flush()


async def _clear_current_period(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    except_id: uuid.UUID | None = None,
) -> None:
    """Clear the current flag on the school's other periods."""
    statement = select(AcademicPeriod).where(
        AcademicPeriod.school_id == school_id,
        AcademicPeriod.is_current.is_(True),
    )
    if except_id is not None:
        statement = statement.where(AcademicPeriod.id != except_id)

    result = await session.execute(statement)
    for period in result.scalars().all():
        period.is_current = False
    await session.flush()


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------


async def list_courses(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
) -> list[Course]:
    """List the school's courses."""
    result = await session.execute(
        select(Course)
        .where(Course.school_id == school_id)
        .order_by(Course.grade_label.asc(), Course.name.asc())
    )
    return list(result.scalars().all())


async def get_course(
    session: AsyncSession,
    *,
    course_id: uuid.UUID,
    school_id: uuid.UUID,
) -> Course:
    """Load one course."""
    return _scoped(
        await _get_scoped(session, Course, course_id, school_id, label="Course"),
        Course,
    )


async def create_course(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    name: str,
    grade_label: str,
) -> Course:
    """Create a course."""
    course = Course(
        id=uuid.uuid4(),
        school_id=school_id,
        name=name,
        grade_label=grade_label,
    )
    session.add(course)
    await _flush_or_conflict(session, "A course with that name already exists in this school.")
    return course


async def update_course(
    session: AsyncSession,
    *,
    course_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> Course:
    """Apply a partial update to a course."""
    course = await get_course(session, course_id=course_id, school_id=school_id)
    for field, value in changes.items():
        if value is not None:
            setattr(course, field, value)
    await _flush_or_conflict(session, "A course with that name already exists in this school.")
    return course


async def delete_course(
    session: AsyncSession,
    *,
    course_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete a course."""
    course = await get_course(session, course_id=course_id, school_id=school_id)
    await session.delete(course)
    await session.flush()


# ---------------------------------------------------------------------------
# Subjects
# ---------------------------------------------------------------------------


async def list_subjects(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
) -> list[Subject]:
    """List the school's subjects."""
    result = await session.execute(
        select(Subject).where(Subject.school_id == school_id).order_by(Subject.name.asc())
    )
    return list(result.scalars().all())


async def get_subject(
    session: AsyncSession,
    *,
    subject_id: uuid.UUID,
    school_id: uuid.UUID,
) -> Subject:
    """Load one subject."""
    return _scoped(
        await _get_scoped(session, Subject, subject_id, school_id, label="Subject"),
        Subject,
    )


async def create_subject(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    name: str,
    area: str | None,
) -> Subject:
    """Create a subject."""
    subject = Subject(
        id=uuid.uuid4(),
        school_id=school_id,
        name=name,
        area=area,
    )
    session.add(subject)
    await _flush_or_conflict(session, "A subject with that name already exists in this school.")
    return subject


async def update_subject(
    session: AsyncSession,
    *,
    subject_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> Subject:
    """Apply a partial update to a subject."""
    subject = await get_subject(session, subject_id=subject_id, school_id=school_id)
    for field, value in changes.items():
        if value is not None:
            setattr(subject, field, value)
    await _flush_or_conflict(session, "A subject with that name already exists in this school.")
    return subject


async def delete_subject(
    session: AsyncSession,
    *,
    subject_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete a subject."""
    subject = await get_subject(session, subject_id=subject_id, school_id=school_id)
    await session.delete(subject)
    await session.flush()


# ---------------------------------------------------------------------------
# Course subjects
# ---------------------------------------------------------------------------


async def list_course_subjects(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
) -> list[CourseSubject]:
    """List the school's course subjects."""
    result = await session.execute(
        select(CourseSubject)
        .where(CourseSubject.school_id == school_id)
        .order_by(CourseSubject.created_at.asc())
    )
    return list(result.scalars().all())


async def get_course_subject(
    session: AsyncSession,
    *,
    course_subject_id: uuid.UUID,
    school_id: uuid.UUID,
) -> CourseSubject:
    """Load one course subject."""
    return _scoped(
        await _get_scoped(
            session, CourseSubject, course_subject_id, school_id, label="Course subject"
        ),
        CourseSubject,
    )


async def create_course_subject(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    course_id: uuid.UUID,
    subject_id: uuid.UUID,
) -> CourseSubject:
    """Offer a subject in a course.

    Both the course and the subject must belong to the school.
    """
    await get_course(session, course_id=course_id, school_id=school_id)
    await get_subject(session, subject_id=subject_id, school_id=school_id)

    course_subject = CourseSubject(
        id=uuid.uuid4(),
        school_id=school_id,
        course_id=course_id,
        subject_id=subject_id,
    )
    session.add(course_subject)
    await _flush_or_conflict(session, "That subject is already offered in this course.")
    return course_subject


async def update_course_subject(
    session: AsyncSession,
    *,
    course_subject_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> CourseSubject:
    """Apply a partial update to a course subject."""
    course_subject = await get_course_subject(
        session, course_subject_id=course_subject_id, school_id=school_id
    )

    new_course_id = changes.get("course_id") or course_subject.course_id
    new_subject_id = changes.get("subject_id") or course_subject.subject_id

    await get_course(session, course_id=new_course_id, school_id=school_id)  # type: ignore[arg-type]
    await get_subject(session, subject_id=new_subject_id, school_id=school_id)  # type: ignore[arg-type]

    for field, value in changes.items():
        if value is not None:
            setattr(course_subject, field, value)

    await _flush_or_conflict(session, "That subject is already offered in this course.")
    return course_subject


async def delete_course_subject(
    session: AsyncSession,
    *,
    course_subject_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Remove a subject from a course."""
    course_subject = await get_course_subject(
        session, course_subject_id=course_subject_id, school_id=school_id
    )
    await session.delete(course_subject)
    await session.flush()


# ---------------------------------------------------------------------------
# Teacher assignments
# ---------------------------------------------------------------------------


async def list_teacher_assignments(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
) -> list[TeacherAssignment]:
    """List the school's teacher assignments."""
    result = await session.execute(
        select(TeacherAssignment)
        .where(TeacherAssignment.school_id == school_id)
        .order_by(TeacherAssignment.assigned_at.desc())
    )
    return list(result.scalars().all())


async def get_teacher_assignment(
    session: AsyncSession,
    *,
    assignment_id: uuid.UUID,
    school_id: uuid.UUID,
) -> TeacherAssignment:
    """Load one teacher assignment."""
    return _scoped(
        await _get_scoped(
            session,
            TeacherAssignment,
            assignment_id,
            school_id,
            label="Teacher assignment",
        ),
        TeacherAssignment,
    )


async def create_teacher_assignment(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
    teacher_id: uuid.UUID,
) -> TeacherAssignment:
    """Assign a teacher to a course subject.

    The course subject must belong to the school, and the teacher must
    be a member of it with the teacher role.
    """
    await get_course_subject(session, course_subject_id=course_subject_id, school_id=school_id)
    await _require_role_in_school(
        session,
        user_id=teacher_id,
        school_id=school_id,
        role=SchoolRole.TEACHER,
        label="The user is not a teacher in this school.",
    )

    assignment = TeacherAssignment(
        id=uuid.uuid4(),
        school_id=school_id,
        course_subject_id=course_subject_id,
        teacher_id=teacher_id,
    )
    session.add(assignment)
    await _flush_or_conflict(session, "That teacher is already assigned to this course subject.")
    return assignment


async def update_teacher_assignment(
    session: AsyncSession,
    *,
    assignment_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> TeacherAssignment:
    """Apply a partial update to a teacher assignment."""
    assignment = await get_teacher_assignment(
        session, assignment_id=assignment_id, school_id=school_id
    )

    new_course_subject_id = changes.get("course_subject_id") or assignment.course_subject_id
    new_teacher_id = changes.get("teacher_id") or assignment.teacher_id

    await get_course_subject(
        session,
        course_subject_id=new_course_subject_id,  # type: ignore[arg-type]
        school_id=school_id,
    )
    await _require_role_in_school(
        session,
        user_id=new_teacher_id,  # type: ignore[arg-type]
        school_id=school_id,
        role=SchoolRole.TEACHER,
        label="The user is not a teacher in this school.",
    )

    for field, value in changes.items():
        if value is not None:
            setattr(assignment, field, value)

    await _flush_or_conflict(session, "That teacher is already assigned to this course subject.")
    return assignment


async def delete_teacher_assignment(
    session: AsyncSession,
    *,
    assignment_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Remove a teacher from a course subject."""
    assignment = await get_teacher_assignment(
        session, assignment_id=assignment_id, school_id=school_id
    )
    await session.delete(assignment)
    await session.flush()


# ---------------------------------------------------------------------------
# Student enrollments
# ---------------------------------------------------------------------------


async def list_student_enrollments(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
) -> list[StudentEnrollment]:
    """List the school's enrollments."""
    result = await session.execute(
        select(StudentEnrollment)
        .where(StudentEnrollment.school_id == school_id)
        .order_by(StudentEnrollment.enrolled_at.desc())
    )
    return list(result.scalars().all())


async def get_student_enrollment(
    session: AsyncSession,
    *,
    enrollment_id: uuid.UUID,
    school_id: uuid.UUID,
) -> StudentEnrollment:
    """Load one enrollment."""
    return _scoped(
        await _get_scoped(
            session,
            StudentEnrollment,
            enrollment_id,
            school_id,
            label="Enrollment",
        ),
        StudentEnrollment,
    )


async def create_student_enrollment(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    course_id: uuid.UUID,
    student_id: uuid.UUID,
    status: EnrollmentStatus,
) -> StudentEnrollment:
    """Enroll a student in a course.

    The course must belong to the school, and the student must be a
    member of it with the student role.
    """
    await get_course(session, course_id=course_id, school_id=school_id)
    await _require_role_in_school(
        session,
        user_id=student_id,
        school_id=school_id,
        role=SchoolRole.STUDENT,
        label="The user is not a student in this school.",
    )

    enrollment = StudentEnrollment(
        id=uuid.uuid4(),
        school_id=school_id,
        course_id=course_id,
        student_id=student_id,
        status=status,
        enrolled_at=datetime.now(UTC),
        withdrawn_at=(datetime.now(UTC) if status == EnrollmentStatus.WITHDRAWN else None),
    )
    session.add(enrollment)
    await _flush_or_conflict(session, "That student is already enrolled in this course.")
    return enrollment


async def update_student_enrollment(
    session: AsyncSession,
    *,
    enrollment_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> StudentEnrollment:
    """Apply a partial update to an enrollment."""
    enrollment = await get_student_enrollment(
        session, enrollment_id=enrollment_id, school_id=school_id
    )

    new_course_id = changes.get("course_id") or enrollment.course_id
    new_student_id = changes.get("student_id") or enrollment.student_id

    await get_course(session, course_id=new_course_id, school_id=school_id)  # type: ignore[arg-type]
    await _require_role_in_school(
        session,
        user_id=new_student_id,  # type: ignore[arg-type]
        school_id=school_id,
        role=SchoolRole.STUDENT,
        label="The user is not a student in this school.",
    )

    for field, value in changes.items():
        if value is not None:
            setattr(enrollment, field, value)

    # Keep `withdrawn_at` consistent with the status.
    if enrollment.status == EnrollmentStatus.WITHDRAWN:
        if enrollment.withdrawn_at is None:
            enrollment.withdrawn_at = datetime.now(UTC)
    else:
        enrollment.withdrawn_at = None

    await _flush_or_conflict(session, "That student is already enrolled in this course.")
    return enrollment


async def delete_student_enrollment(
    session: AsyncSession,
    *,
    enrollment_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Remove an enrollment."""
    enrollment = await get_student_enrollment(
        session, enrollment_id=enrollment_id, school_id=school_id
    )
    await session.delete(enrollment)
    await session.flush()


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


async def list_members(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    role: SchoolRole | None = None,
    include_revoked: bool = False,
) -> list[tuple[SchoolMembership, Profile, str | None, bool]]:
    """List the school's members, joined with their profile.

    The frontend used to build this with a PostgREST join. Doing it
    server-side means one request instead of two, and the join is
    scoped to the school in SQL rather than in the browser.

    Returns, per member, the membership, the profile, the email and
    whether the account has a password yet (so the UI can show who
    still needs to activate). Revoked memberships are excluded unless
    ``include_revoked`` is set, which the admin management view uses to
    show deactivated members too.
    """
    statement = (
        select(SchoolMembership, Profile, User.email, User.password_hash)
        .join(Profile, Profile.id == SchoolMembership.user_id)
        .join(User, User.id == SchoolMembership.user_id)
        .where(SchoolMembership.school_id == school_id)
        .order_by(SchoolMembership.joined_at.desc())
    )
    if not include_revoked:
        statement = statement.where(SchoolMembership.revoked_at.is_(None))
    if role is not None:
        statement = statement.where(SchoolMembership.role == role)

    result = await session.execute(statement)
    # The account is "activated" once it has a non-empty password hash.
    return [(row[0], row[1], row[2], bool(row[3])) for row in result.all()]


async def list_teachers_for_student(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
) -> list[tuple[uuid.UUID, str, str | None, list[str]]]:
    """The teachers of the courses the student is enrolled in.

    Only the teachers of the student's own courses: a student does not
    get the staff directory of the school. Each teacher comes with the
    subjects they teach that student.
    """
    result = await session.execute(
        select(
            TeacherAssignment.teacher_id,
            Profile.full_name,
            User.email,
            Subject.name,
        )
        .join(CourseSubject, CourseSubject.id == TeacherAssignment.course_subject_id)
        .join(
            StudentEnrollment,
            (StudentEnrollment.course_id == CourseSubject.course_id)
            & (StudentEnrollment.student_id == student_id),
        )
        .join(Subject, Subject.id == CourseSubject.subject_id)
        .join(Profile, Profile.id == TeacherAssignment.teacher_id)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .where(
            TeacherAssignment.school_id == school_id,
            CourseSubject.school_id == school_id,
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.status == "active",
        )
        .order_by(Subject.name)
    )

    names: dict[uuid.UUID, str] = {}
    emails: dict[uuid.UUID, str | None] = {}
    subjects: dict[uuid.UUID, list[str]] = {}

    for teacher_id, full_name, email, subject_name in result.all():
        names.setdefault(teacher_id, full_name)
        emails.setdefault(teacher_id, email)
        subject_list = subjects.setdefault(teacher_id, [])
        if subject_name not in subject_list:
            subject_list.append(subject_name)

    return [
        (teacher_id, names[teacher_id], emails[teacher_id], subjects[teacher_id])
        for teacher_id in names
    ]


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


async def _require_role_in_school(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
    role: SchoolRole,
    label: str,
) -> SchoolMembership:
    """Require the user to have the given role in the school."""
    result = await session.execute(
        select(SchoolMembership).where(
            SchoolMembership.user_id == user_id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == role,
            SchoolMembership.revoked_at.is_(None),
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError(label)
    return membership


async def _flush_or_conflict(session: AsyncSession, detail: str) -> None:
    """Flush, turning a unique violation into a readable conflict."""
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise _conflict(detail) from exc


# ---------------------------------------------------------------------------
# Study plan
# ---------------------------------------------------------------------------


async def list_study_plans(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """The study plan, with what the school already has of it.

    Each plan says whether its course exists already and how many
    students are enrolled in it, so the admin sees what the import
    would add before picking it.
    """
    courses = {course.name: course for course in await list_courses(session, school_id=school_id)}

    plans: list[dict[str, Any]] = []
    for plan in STUDY_PLANS:
        course = courses.get(plan.course_name)
        students = 0
        if course is not None:
            students = await _count(
                session,
                select(func.count(StudentEnrollment.id)).where(
                    StudentEnrollment.school_id == school_id,
                    StudentEnrollment.course_id == course.id,
                    StudentEnrollment.status == EnrollmentStatus.ACTIVE,
                ),
            )
        plans.append(
            {
                "course_name": plan.course_name,
                "grade_label": plan.grade_label,
                "subjects": [name for name, _area in plan.subjects],
                "subject_count": len(plan.subjects),
                "enrolled_students": students,
                "exists": course is not None,
            }
        )

    return plans


async def import_study_plans(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    course_names: list[str],
) -> dict[str, Any]:
    """Create the courses of the picked plans, with their subjects.

    The import is idempotent: a course that already exists is left
    alone, and the subjects that the school already has are reused
    instead of duplicated.
    """
    created_courses: list[str] = []
    skipped_courses: list[str] = []
    created_subjects = 0
    offered_subjects = 0

    for name in course_names:
        plan = find_plan(name)
        if plan is None:
            raise ValidationError(f"“{name}” no es un curso del plan de estudios.")

        existing = await _find_course_by_name(session, school_id=school_id, name=plan.course_name)
        if existing is not None:
            skipped_courses.append(plan.course_name)
            continue

        course = await create_course(
            session,
            school_id=school_id,
            name=plan.course_name,
            grade_label=plan.grade_label,
        )
        created_courses.append(plan.course_name)

        for subject_name, area in plan.subjects:
            subject = await _find_subject_by_name(session, school_id=school_id, name=subject_name)
            if subject is None:
                subject = await create_subject(
                    session,
                    school_id=school_id,
                    name=subject_name,
                    area=area,
                )
                created_subjects += 1

            offered = await session.execute(
                select(CourseSubject.id).where(
                    CourseSubject.course_id == course.id,
                    CourseSubject.subject_id == subject.id,
                )
            )
            if offered.scalar_one_or_none() is None:
                await create_course_subject(
                    session,
                    school_id=school_id,
                    course_id=course.id,
                    subject_id=subject.id,
                )
                offered_subjects += 1

    return {
        "created_courses": created_courses,
        "skipped_courses": skipped_courses,
        "created_subjects": created_subjects,
        "offered_subjects": offered_subjects,
    }


async def _find_course_by_name(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    name: str,
) -> Course | None:
    """The course of a school with that name, or None."""
    result = await session.execute(
        select(Course).where(Course.school_id == school_id, Course.name == name)
    )
    return result.scalar_one_or_none()


async def _find_subject_by_name(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    name: str,
) -> Subject | None:
    """The subject of a school with that name, or None."""
    result = await session.execute(
        select(Subject).where(Subject.school_id == school_id, Subject.name == name)
    )
    return result.scalar_one_or_none()


__all__ = [
    "create_course",
    "create_course_subject",
    "create_period",
    "create_student_enrollment",
    "create_subject",
    "create_teacher_assignment",
    "delete_course",
    "delete_course_subject",
    "delete_period",
    "delete_student_enrollment",
    "delete_subject",
    "delete_teacher_assignment",
    "get_course",
    "get_course_subject",
    "get_period",
    "get_student_enrollment",
    "get_subject",
    "get_teacher_assignment",
    "import_study_plans",
    "list_course_subjects",
    "list_courses",
    "list_members",
    "list_periods",
    "list_study_plans",
    "list_student_enrollments",
    "list_subjects",
    "list_teacher_assignments",
    "update_course",
    "update_course_subject",
    "update_period",
    "update_student_enrollment",
    "update_subject",
    "update_teacher_assignment",
]
