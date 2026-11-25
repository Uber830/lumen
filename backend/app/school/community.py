"""The community of the school: its teachers, its students, its courses
and its subjects.

The four lists are read from the school of the caller and from nothing
else. The search, the filters and the pagination run in the database:
the panel of a school with two hundred students does not pull the whole
list into the browser to filter it there.

Two signals describe a member of the community, and they say different
things:

- **status**   whether the member belongs to the school right now
               (`activo` or `inactivo`, a revoked membership).
- **access**   whether the member can reach the content of the school
               (`activado` or `pendiente`). A teacher without an
               assignment has no course, and a course without an
               assignment has no content to see.

The access carries the reason when it is pending: the person administering
the school reads why the account cannot be used yet.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Select, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.db.enums import SchoolRole
from app.db.models import (
    Course,
    CourseSubject,
    Grade,
    Profile,
    SchoolMembership,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
    User,
)

# The rows a page brings by default. The content list shows six; the
# community lists are longer, so they bring ten.
DEFAULT_PER_PAGE = 10
MAX_PER_PAGE = 50


def _member_rows(
    school_id: uuid.UUID,
    role: SchoolRole,
    *,
    query: str | None = None,
    status: str | None = None,
) -> Select[tuple[Any, ...]]:
    """The members of a role, with the filters already applied."""
    statement = (
        select(
            SchoolMembership.id,
            SchoolMembership.user_id,
            # The name lives in the profile when the account has one,
            # and in the user otherwise: a member invited by the
            # platform has a user row but no profile yet.
            func.coalesce(Profile.full_name, User.full_name),
            User.email,
            User.password_hash,
            SchoolMembership.joined_at,
            SchoolMembership.revoked_at,
        )
        .outerjoin(Profile, Profile.id == SchoolMembership.user_id)
        .join(User, User.id == SchoolMembership.user_id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == role,
        )
    )

    if status == "activo":
        statement = statement.where(SchoolMembership.revoked_at.is_(None))
    elif status == "inactivo":
        statement = statement.where(SchoolMembership.revoked_at.is_not(None))

    if query:
        pattern = f"%{query.strip().lower()}%"
        statement = statement.where(
            func.lower(func.coalesce(Profile.full_name, User.full_name, "")).like(pattern)
            | func.lower(func.coalesce(User.email, "")).like(pattern)
        )

    return statement


async def _count(session: AsyncSession, statement: Select[tuple[Any, ...]]) -> int:
    """How many rows a statement would bring."""
    result = await session.execute(select(func.count()).select_from(statement.subquery()))
    return int(result.scalar() or 0)


def _access(
    *,
    activated: bool,
    revoked: bool,
    has_assignment: bool,
    is_student: bool,
) -> tuple[str, str | None]:
    """The access of a member, and why it is pending when it is.

    A teacher reaches the content through an assignment: without one
    there is no course, and without a course there is nothing to see. A
    student reaches it through the enrollment in a course.
    """
    if revoked:
        return (
            "pendiente",
            "El acceso está revocado mientras el docente o estudiante siga inactivo.",
        )
    if not activated:
        return "pendiente", "La cuenta todavía no activó su contraseña."
    if not has_assignment:
        return (
            "pendiente",
            "No tiene asignaciones: sin curso no hay material al que entrar."
            if is_student
            else "No tiene cursos asignados: sin asignación no hay material al que entrar.",
        )
    return "activado", None


async def list_teachers(
    session: AsyncSession,
    school_id: uuid.UUID,
    *,
    query: str | None = None,
    status: str | None = None,
    course_id: uuid.UUID | None = None,
    page: int = 1,
    per_page: int = DEFAULT_PER_PAGE,
) -> dict[str, Any]:
    """The teachers of the school, filtered and paginated."""
    page = max(1, page)
    per_page = max(1, min(per_page, MAX_PER_PAGE))

    statement = _member_rows(school_id, SchoolRole.TEACHER, query=query, status=status)

    if course_id is not None:
        # Only the teachers who teach in that course.
        statement = statement.where(
            SchoolMembership.user_id.in_(
                select(TeacherAssignment.teacher_id)
                .join(
                    CourseSubject,
                    CourseSubject.id == TeacherAssignment.course_subject_id,
                )
                .where(
                    TeacherAssignment.school_id == school_id,
                    CourseSubject.course_id == course_id,
                )
            )
        )

    total = await _count(session, statement)

    result = await session.execute(
        statement.order_by(func.lower(func.coalesce(Profile.full_name, User.full_name, "")).asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = result.all()

    assignments = await _assignments_of(session, school_id, [row[1] for row in rows])
    assignment_ids = await _assignment_ids_of(session, school_id, [row[1] for row in rows])

    items = []
    for membership_id, user_id, full_name, email, password_hash, joined_at, revoked_at in rows:
        teacher_courses = assignments.get(user_id, {})
        course_names = list(teacher_courses.keys())
        subject_names: list[str] = []
        for names in teacher_courses.values():
            for name in names:
                if name not in subject_names:
                    subject_names.append(name)

        access, reason = _access(
            activated=bool(password_hash),
            revoked=revoked_at is not None,
            has_assignment=bool(course_names),
            is_student=False,
        )

        items.append(
            {
                "membership_id": str(membership_id),
                "user_id": str(user_id),
                "full_name": full_name,
                "email": email,
                "joined_at": joined_at,
                "revoked_at": revoked_at,
                "account_activated": bool(password_hash),
                "courses": course_names,
                "subjects": subject_names,
                "course_subject_ids": assignment_ids.get(user_id, []),
                "access": access,
                "access_reason": reason,
                "status": "inactivo" if revoked_at is not None else "activo",
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def _assignments_of(
    session: AsyncSession,
    school_id: uuid.UUID,
    teacher_ids: list[uuid.UUID],
) -> dict[uuid.UUID, dict[str, list[str]]]:
    """The courses and subjects each teacher is assigned to."""
    if not teacher_ids:
        return {}

    result = await session.execute(
        select(
            TeacherAssignment.teacher_id,
            Course.name,
            Subject.name,
        )
        .join(CourseSubject, CourseSubject.id == TeacherAssignment.course_subject_id)
        .join(Course, Course.id == CourseSubject.course_id)
        .join(Subject, Subject.id == CourseSubject.subject_id)
        .where(
            TeacherAssignment.school_id == school_id,
            TeacherAssignment.teacher_id.in_(teacher_ids),
        )
        .order_by(Course.name, Subject.name)
    )

    assignments: dict[uuid.UUID, dict[str, list[str]]] = {}
    for teacher_id, course_name, subject_name in result.all():
        courses = assignments.setdefault(teacher_id, {})
        subjects = courses.setdefault(course_name, [])
        if subject_name not in subjects:
            subjects.append(subject_name)

    return assignments


async def _assignment_ids_of(
    session: AsyncSession,
    school_id: uuid.UUID,
    teacher_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[str]]:
    """The course subjects each teacher is assigned to.

    The edit form needs the ids, not the names: it works with the
    course subjects the school offers.
    """
    if not teacher_ids:
        return {}

    result = await session.execute(
        select(TeacherAssignment.teacher_id, TeacherAssignment.course_subject_id).where(
            TeacherAssignment.school_id == school_id,
            TeacherAssignment.teacher_id.in_(teacher_ids),
        )
    )

    assignments: dict[uuid.UUID, list[str]] = {}
    for teacher_id, course_subject_id in result.all():
        ids = assignments.setdefault(teacher_id, [])
        if str(course_subject_id) not in ids:
            ids.append(str(course_subject_id))

    return assignments


async def list_students(
    session: AsyncSession,
    school_id: uuid.UUID,
    *,
    query: str | None = None,
    status: str | None = None,
    course_id: uuid.UUID | None = None,
    page: int = 1,
    per_page: int = DEFAULT_PER_PAGE,
) -> dict[str, Any]:
    """The students of the school, filtered and paginated."""
    page = max(1, page)
    per_page = max(1, min(per_page, MAX_PER_PAGE))

    statement = _member_rows(school_id, SchoolRole.STUDENT, query=query, status=status)

    if course_id is not None:
        statement = statement.where(
            SchoolMembership.user_id.in_(
                select(StudentEnrollment.student_id).where(
                    StudentEnrollment.school_id == school_id,
                    StudentEnrollment.course_id == course_id,
                )
            )
        )

    total = await _count(session, statement)

    result = await session.execute(
        statement.order_by(func.lower(func.coalesce(Profile.full_name, User.full_name, "")).asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = result.all()

    student_ids = [row[1] for row in rows]
    courses = await _courses_of(session, school_id, student_ids)
    course_ids = await _course_ids_of(session, school_id, student_ids)
    averages = await _averages_of(session, school_id, student_ids, course_id)

    items = []
    for membership_id, user_id, full_name, email, password_hash, joined_at, revoked_at in rows:
        course_names = courses.get(user_id, [])
        access, reason = _access(
            activated=bool(password_hash),
            revoked=revoked_at is not None,
            has_assignment=bool(course_names),
            is_student=True,
        )

        items.append(
            {
                "membership_id": str(membership_id),
                "user_id": str(user_id),
                "full_name": full_name,
                "email": email,
                "joined_at": joined_at,
                "revoked_at": revoked_at,
                "account_activated": bool(password_hash),
                "courses": course_names,
                "course_ids": course_ids.get(user_id, []),
                "average": averages.get(user_id),
                "access": access,
                "access_reason": reason,
                "status": "inactivo" if revoked_at is not None else "activo",
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }


async def _courses_of(
    session: AsyncSession,
    school_id: uuid.UUID,
    student_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[str]]:
    """The courses each student is enrolled in."""
    if not student_ids:
        return {}

    result = await session.execute(
        select(StudentEnrollment.student_id, Course.name)
        .join(Course, Course.id == StudentEnrollment.course_id)
        .where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.student_id.in_(student_ids),
            StudentEnrollment.status == "active",
        )
        .order_by(Course.name)
    )

    courses: dict[uuid.UUID, list[str]] = {}
    for student_id, course_name in result.all():
        names = courses.setdefault(student_id, [])
        if course_name not in names:
            names.append(course_name)

    return courses


async def _course_ids_of(
    session: AsyncSession,
    school_id: uuid.UUID,
    student_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[str]]:
    """The courses each student is enrolled in, by id.

    The edit form needs the ids, not the names.
    """
    if not student_ids:
        return {}

    result = await session.execute(
        select(StudentEnrollment.student_id, StudentEnrollment.course_id).where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.student_id.in_(student_ids),
            StudentEnrollment.status == "active",
        )
    )

    courses: dict[uuid.UUID, list[str]] = {}
    for student_id, course_id in result.all():
        ids = courses.setdefault(student_id, [])
        if str(course_id) not in ids:
            ids.append(str(course_id))

    return courses


async def _averages_of(
    session: AsyncSession,
    school_id: uuid.UUID,
    student_ids: list[uuid.UUID],
    course_id: uuid.UUID | None = None,
) -> dict[uuid.UUID, Decimal]:
    """The average of each student, over the grades of the school.

    When the list is filtered by course, the average is the one of that
    course: the number on the screen has to answer the filter that is
    on the screen.

    A student without grades has no average: it is `null`, not a zero.
    """
    if not student_ids:
        return {}

    statement = select(Grade.student_id, func.round(func.avg(Grade.score), 2)).where(
        Grade.school_id == school_id,
        Grade.student_id.in_(student_ids),
    )

    if course_id is not None:
        statement = statement.join(
            CourseSubject, CourseSubject.id == Grade.course_subject_id
        ).where(
            CourseSubject.course_id == course_id,
        )

    result = await session.execute(statement.group_by(Grade.student_id))

    return {student_id: average for student_id, average in result.all() if average is not None}


async def list_courses(session: AsyncSession, school_id: uuid.UUID) -> list[dict[str, Any]]:
    """The courses of the school, with how much of the structure they hold.

    A course is active when it has students enrolled in it: a course
    without students is a course that is not running.
    """
    subject_count = (
        select(func.count(distinct(CourseSubject.id)))
        .where(CourseSubject.course_id == Course.id)
        .correlate(Course)
        .scalar_subquery()
    )
    teacher_count = (
        select(func.count(distinct(TeacherAssignment.teacher_id)))
        .join(CourseSubject, CourseSubject.id == TeacherAssignment.course_subject_id)
        .where(CourseSubject.course_id == Course.id)
        .correlate(Course)
        .scalar_subquery()
    )
    student_count = (
        select(func.count(distinct(StudentEnrollment.student_id)))
        .where(
            StudentEnrollment.course_id == Course.id,
            StudentEnrollment.status == "active",
        )
        .correlate(Course)
        .scalar_subquery()
    )

    result = await session.execute(
        select(
            Course.id,
            Course.name,
            Course.grade_label,
            subject_count,
            teacher_count,
            student_count,
        )
        .where(Course.school_id == school_id)
        .order_by(Course.grade_label, Course.name)
    )

    return [
        {
            "id": str(course_id),
            "name": name,
            "grade_label": grade_label,
            "subject_count": int(subjects),
            "teacher_count": int(teachers),
            "student_count": int(students),
            "status": "activo" if students and students > 0 else "inactivo",
        }
        for course_id, name, grade_label, subjects, teachers, students in result.all()
    ]


async def list_subjects(session: AsyncSession, school_id: uuid.UUID) -> list[dict[str, Any]]:
    """The subjects of the school, with the courses they are taught in."""
    result = await session.execute(
        select(
            Subject.id,
            Subject.name,
            Subject.area,
            func.count(distinct(CourseSubject.course_id)),
        )
        .outerjoin(
            CourseSubject,
            (CourseSubject.subject_id == Subject.id) & (CourseSubject.school_id == school_id),
        )
        .where(Subject.school_id == school_id)
        .group_by(Subject.id, Subject.name, Subject.area)
        .order_by(Subject.name)
    )

    subjects = [
        {
            "id": str(subject_id),
            "name": name,
            "area": area,
            "course_count": int(course_count),
        }
        for subject_id, name, area, course_count in result.all()
    ]

    if not subjects:
        return subjects

    courses_result = await session.execute(
        select(CourseSubject.subject_id, Course.name)
        .join(Course, Course.id == CourseSubject.course_id)
        .where(
            CourseSubject.school_id == school_id,
            CourseSubject.subject_id.in_([uuid.UUID(subject["id"]) for subject in subjects]),
        )
        .order_by(Course.name)
    )

    courses_by_subject: dict[uuid.UUID, list[str]] = {}
    for subject_id, course_name in courses_result.all():
        names = courses_by_subject.setdefault(subject_id, [])
        if course_name not in names:
            names.append(course_name)

    for subject in subjects:
        subject["courses"] = courses_by_subject.get(uuid.UUID(subject["id"]), [])

    return subjects


# ---------------------------------------------------------------------------
# Editing a member of the community
# ---------------------------------------------------------------------------


async def update_member(
    session: AsyncSession,
    school_id: uuid.UUID,
    membership_id: uuid.UUID,
    *,
    full_name: str | None = None,
    email: str | None = None,
    course_ids: list[uuid.UUID] | None = None,
    course_subject_ids: list[uuid.UUID] | None = None,
) -> dict[str, Any]:
    """Edit a teacher or a student of the school.

    The name and the email are the person's. The courses (of a student) or
    the course subjects (of a teacher) are what the admin edits from the
    form: the list is replaced by the one that comes in, so what the form
    shows is what the member has.

    A student is in **one** course: more than one is refused, because a
    student in two courses has no average and no tasks. A teacher can
    teach many course subjects.

    The membership has to belong to the school: an admin of another school
    does not get to edit this one.
    """
    result = await session.execute(
        select(SchoolMembership, User)
        .join(User, User.id == SchoolMembership.user_id)
        .where(
            SchoolMembership.id == membership_id,
            SchoolMembership.school_id == school_id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise NotFoundError("Member not found.")
    membership, user = row

    if full_name is not None:
        name = full_name.strip()
        if not name:
            raise ValidationError("The name must not be blank.")
        profile = await session.get(Profile, user.id)
        if profile is None:
            profile = Profile(id=user.id, full_name=name)
            session.add(profile)
        profile.full_name = name
        # The name lives in the profile, but the user row keeps it too
        # for the moments before the profile exists.
        user.full_name = name

    if email is not None:
        new_email = email.strip().lower()
        if new_email and new_email != user.email:
            existing = await session.execute(
                select(User.id).where(User.email == new_email, User.id != user.id)
            )
            if existing.scalar_one_or_none() is not None:
                raise ConflictError("A user with that email already exists.")
            user.email = new_email

    if membership.role == SchoolRole.STUDENT and course_ids is not None:
        # A student is in **one** course: the school has one grade per
        # student, and a student in two courses has no average, no tasks
        # and no idea of what he is studying.
        if len(course_ids) > 1:
            raise ValidationError("A student belongs to one course.")
        await _sync_enrollments(session, school_id, user.id, course_ids)

    if membership.role == SchoolRole.TEACHER and course_subject_ids is not None:
        await _sync_assignments(session, school_id, user.id, course_subject_ids)

    await session.flush()

    return {
        "membership_id": str(membership.id),
        "user_id": str(user.id),
        "role": membership.role.value,
        "full_name": full_name.strip() if full_name is not None else user.full_name,
        "email": user.email,
        "course_ids": [str(course_id) for course_id in (course_ids or [])],
        "course_subject_ids": [str(item) for item in (course_subject_ids or [])],
    }


async def _sync_enrollments(
    session: AsyncSession,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
    course_ids: list[uuid.UUID],
) -> None:
    """Make the enrollments of a student be exactly these courses."""
    result = await session.execute(
        select(StudentEnrollment).where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.status == "active",
        )
    )
    current = {row.course_id: row for row in result.scalars().all()}

    for course_id, enrollment in current.items():
        if course_id not in course_ids:
            await session.delete(enrollment)

    for course_id in course_ids:
        if course_id in current:
            continue
        course = await session.get(Course, course_id)
        if course is None or course.school_id != school_id:
            raise ValidationError("That course is not part of this school.")
        session.add(
            StudentEnrollment(
                id=uuid.uuid4(),
                school_id=school_id,
                course_id=course_id,
                student_id=student_id,
                status="active",
                enrolled_at=datetime.now(UTC),
            )
        )


async def _sync_assignments(
    session: AsyncSession,
    school_id: uuid.UUID,
    teacher_id: uuid.UUID,
    course_subject_ids: list[uuid.UUID],
) -> None:
    """Make the assignments of a teacher be exactly these course subjects."""
    result = await session.execute(
        select(TeacherAssignment).where(
            TeacherAssignment.school_id == school_id,
            TeacherAssignment.teacher_id == teacher_id,
        )
    )
    current = {row.course_subject_id: row for row in result.scalars().all()}

    for course_subject_id, assignment in current.items():
        if course_subject_id not in course_subject_ids:
            await session.delete(assignment)

    for course_subject_id in course_subject_ids:
        if course_subject_id in current:
            continue
        course_subject = await session.get(CourseSubject, course_subject_id)
        if course_subject is None or course_subject.school_id != school_id:
            raise ValidationError("That course subject is not part of this school.")
        session.add(
            TeacherAssignment(
                id=uuid.uuid4(),
                school_id=school_id,
                course_subject_id=course_subject_id,
                teacher_id=teacher_id,
            )
        )


__all__ = ["list_courses", "list_students", "list_subjects", "list_teachers", "update_member"]
