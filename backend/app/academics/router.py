"""Academic router: periods, courses, subjects, assignments, enrollments.

This is the CRUD the browser used to do directly against PostgREST,
now behind the API.

The authorization rules are the ones the RLS policies declared:

- **Reads** are for any member of the school. A teacher and a student
  both need to see the courses and the subjects.
- **Writes** are for school admins only. Creating a course, offering a
  subject or enrolling a student is an administrative act.

The school is always resolved from the request context, never from
the request body: a caller can ask about any school id, and the
guard looks up whether they actually belong to it.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.academics import operations
from app.academics.schemas import (
    AcademicPeriodCreate,
    AcademicPeriodOut,
    AcademicPeriodUpdate,
    CourseCreate,
    CourseOut,
    CourseSubjectCreate,
    CourseSubjectOut,
    CourseSubjectSummary,
    CourseSubjectUpdate,
    CourseSummary,
    CourseUpdate,
    SchoolMemberOut,
    StudentEnrollmentCreate,
    StudentEnrollmentOut,
    StudentEnrollmentUpdate,
    StudentTeacherOut,
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
    TeacherAssignmentCreate,
    TeacherAssignmentOut,
    TeacherAssignmentUpdate,
)
from app.core.context import RequestContext
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context

router = APIRouter(prefix="/v1/academics", tags=["academics"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _school_id(context: RequestContext) -> uuid.UUID:
    """The school the caller is working in.

    The caller has to be a member of some school: these endpoints are
    about a school's academic structure.
    """
    return context.require_any_membership().school_id


def _require_admin(context: RequestContext) -> uuid.UUID:
    """The school the caller is working in, if they are an admin."""
    membership = context.require_any_membership()
    if membership.role != SchoolRole.SCHOOL_ADMIN:
        from app.core.errors import ForbiddenError

        raise ForbiddenError(
            "Only school administrators can perform this action.",
            code="insufficient_role",
        )
    return membership.school_id


def _changes(body: BaseModel) -> dict[str, object]:
    """The fields of a partial update that were actually sent.

    Pydantic's `model_dump(exclude_unset=True)` distinguishes "not
    sent" from "sent as null", which matters here: clearing a field
    has to be different from leaving it alone.
    """
    return body.model_dump(exclude_unset=True)


# ---------------------------------------------------------------------------
# Academic periods
# ---------------------------------------------------------------------------


@router.get("/periods", response_model=list[AcademicPeriodOut])
async def list_periods(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[AcademicPeriodOut]:
    """List the school's academic periods, newest first."""
    school_id = _school_id(context)
    periods = await operations.list_periods(session, school_id=school_id)
    return [AcademicPeriodOut.model_validate(p, from_attributes=True) for p in periods]


@router.post("/periods", response_model=AcademicPeriodOut, status_code=status.HTTP_201_CREATED)
async def create_period(
    body: AcademicPeriodCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AcademicPeriodOut:
    """Create an academic period."""
    school_id = _require_admin(context)
    period = await operations.create_period(
        session,
        school_id=school_id,
        name=body.name,
        modality=body.modality,
        start_date=body.start_date,
        end_date=body.end_date,
        is_current=body.is_current,
    )
    await session.commit()
    return AcademicPeriodOut.model_validate(period, from_attributes=True)


@router.patch("/periods/{period_id}", response_model=AcademicPeriodOut)
async def update_period(
    body: AcademicPeriodUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    period_id: Annotated[uuid.UUID, Path()],
) -> AcademicPeriodOut:
    """Update an academic period."""
    school_id = _require_admin(context)
    period = await operations.update_period(
        session,
        period_id=period_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return AcademicPeriodOut.model_validate(period, from_attributes=True)


@router.delete("/periods/{period_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_period(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    period_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete an academic period."""
    school_id = _require_admin(context)
    await operations.delete_period(session, period_id=period_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------


@router.get("/courses", response_model=list[CourseSummary])
async def list_courses(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[CourseSummary]:
    """List the school's courses, with the counts the UI shows."""
    school_id = _school_id(context)
    courses = await operations.list_courses(session, school_id=school_id)
    return [
        CourseSummary(
            **CourseOut.model_validate(course, from_attributes=True).model_dump(),
            subject_count=await _count_course_subjects(session, school_id, course.id),
            enrolled_students=await _count_enrollments(session, school_id, course.id),
            assigned_teachers=await _count_course_teachers(session, school_id, course.id),
        )
        for course in courses
    ]


async def _count_course_subjects(
    session: AsyncSession, school_id: uuid.UUID, course_id: uuid.UUID
) -> int:
    from sqlalchemy import func, select

    from app.db.models import CourseSubject

    result = await session.execute(
        select(func.count(CourseSubject.id)).where(
            CourseSubject.school_id == school_id,
            CourseSubject.course_id == course_id,
        )
    )
    return int(result.scalar_one())


async def _count_enrollments(
    session: AsyncSession, school_id: uuid.UUID, course_id: uuid.UUID
) -> int:
    from sqlalchemy import func, select

    from app.db.enums import EnrollmentStatus
    from app.db.models import StudentEnrollment

    result = await session.execute(
        select(func.count(StudentEnrollment.id)).where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.course_id == course_id,
            StudentEnrollment.status == EnrollmentStatus.ACTIVE,
        )
    )
    return int(result.scalar_one())


async def _count_course_teachers(
    session: AsyncSession, school_id: uuid.UUID, course_id: uuid.UUID
) -> int:
    from sqlalchemy import func, select

    from app.db.models import CourseSubject, TeacherAssignment

    result = await session.execute(
        select(func.count(TeacherAssignment.id))
        .join(CourseSubject, CourseSubject.id == TeacherAssignment.course_subject_id)
        .where(
            TeacherAssignment.school_id == school_id,
            CourseSubject.course_id == course_id,
        )
    )
    return int(result.scalar_one())


@router.post("/courses", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
async def create_course(
    body: CourseCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CourseOut:
    """Create a course."""
    school_id = _require_admin(context)
    course = await operations.create_course(
        session,
        school_id=school_id,
        name=body.name,
        grade_label=body.grade_label,
    )
    await session.commit()
    return CourseOut.model_validate(course, from_attributes=True)


@router.patch("/courses/{course_id}", response_model=CourseOut)
async def update_course(
    body: CourseUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    course_id: Annotated[uuid.UUID, Path()],
) -> CourseOut:
    """Update a course."""
    school_id = _require_admin(context)
    course = await operations.update_course(
        session,
        course_id=course_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return CourseOut.model_validate(course, from_attributes=True)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    course_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete a course."""
    school_id = _require_admin(context)
    await operations.delete_course(session, course_id=course_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Subjects
# ---------------------------------------------------------------------------


@router.get("/subjects", response_model=list[SubjectOut])
async def list_subjects(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[SubjectOut]:
    """List the school's subjects."""
    school_id = _school_id(context)
    subjects = await operations.list_subjects(session, school_id=school_id)
    return [SubjectOut.model_validate(s, from_attributes=True) for s in subjects]


@router.post("/subjects", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
async def create_subject(
    body: SubjectCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SubjectOut:
    """Create a subject."""
    school_id = _require_admin(context)
    subject = await operations.create_subject(
        session,
        school_id=school_id,
        name=body.name,
        area=body.area,
    )
    await session.commit()
    return SubjectOut.model_validate(subject, from_attributes=True)


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
async def update_subject(
    body: SubjectUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    subject_id: Annotated[uuid.UUID, Path()],
) -> SubjectOut:
    """Update a subject."""
    school_id = _require_admin(context)
    subject = await operations.update_subject(
        session,
        subject_id=subject_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return SubjectOut.model_validate(subject, from_attributes=True)


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    subject_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete a subject."""
    school_id = _require_admin(context)
    await operations.delete_subject(session, subject_id=subject_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Course subjects
# ---------------------------------------------------------------------------


@router.get("/course-subjects", response_model=list[CourseSubjectSummary])
async def list_course_subjects(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[CourseSubjectSummary]:
    """List the school's course subjects, with the names the UI shows."""
    school_id = _school_id(context)
    rows = await operations.list_course_subjects(session, school_id=school_id)
    if not rows:
        return []

    # Resolve the names in one query each rather than one per row.
    from sqlalchemy import select

    from app.db.models import Course, Subject, TeacherAssignment

    course_ids = {row.course_id for row in rows}
    subject_ids = {row.subject_id for row in rows}

    courses_result = await session.execute(select(Course).where(Course.id.in_(course_ids)))
    course_names = {course.id: course.name for course in courses_result.scalars().all()}

    subjects_result = await session.execute(select(Subject).where(Subject.id.in_(subject_ids)))
    subject_rows = {subject.id: subject for subject in subjects_result.scalars().all()}

    assignments_result = await session.execute(
        select(TeacherAssignment.course_subject_id).where(
            TeacherAssignment.school_id == school_id,
            TeacherAssignment.course_subject_id.in_([row.id for row in rows]),
        )
    )
    teacher_counts: dict[uuid.UUID, int] = {}
    for course_subject_id in assignments_result.scalars().all():
        teacher_counts[course_subject_id] = teacher_counts.get(course_subject_id, 0) + 1

    summaries: list[CourseSubjectSummary] = []
    for row in rows:
        subject = subject_rows.get(row.subject_id)
        summaries.append(
            CourseSubjectSummary(
                **CourseSubjectOut.model_validate(row, from_attributes=True).model_dump(),
                course_name=course_names.get(row.course_id, ""),
                subject_name=subject.name if subject else "",
                subject_area=subject.area if subject else None,
                assigned_teachers=teacher_counts.get(row.id, 0),
            )
        )
    return summaries


@router.post(
    "/course-subjects",
    response_model=CourseSubjectOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_course_subject(
    body: CourseSubjectCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CourseSubjectOut:
    """Offer a subject in a course."""
    school_id = _require_admin(context)
    row = await operations.create_course_subject(
        session,
        school_id=school_id,
        course_id=body.course_id,
        subject_id=body.subject_id,
    )
    await session.commit()
    return CourseSubjectOut.model_validate(row, from_attributes=True)


@router.patch("/course-subjects/{course_subject_id}", response_model=CourseSubjectOut)
async def update_course_subject(
    body: CourseSubjectUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    course_subject_id: Annotated[uuid.UUID, Path()],
) -> CourseSubjectOut:
    """Update a course subject."""
    school_id = _require_admin(context)
    row = await operations.update_course_subject(
        session,
        course_subject_id=course_subject_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return CourseSubjectOut.model_validate(row, from_attributes=True)


@router.delete(
    "/course-subjects/{course_subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_course_subject(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    course_subject_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Remove a subject from a course."""
    school_id = _require_admin(context)
    await operations.delete_course_subject(
        session, course_subject_id=course_subject_id, school_id=school_id
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Teacher assignments
# ---------------------------------------------------------------------------


@router.get("/teacher-assignments", response_model=list[TeacherAssignmentOut])
async def list_teacher_assignments(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[TeacherAssignmentOut]:
    """List the school's teacher assignments."""
    school_id = _school_id(context)
    rows = await operations.list_teacher_assignments(session, school_id=school_id)
    return [TeacherAssignmentOut.model_validate(r, from_attributes=True) for r in rows]


@router.post(
    "/teacher-assignments",
    response_model=TeacherAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_teacher_assignment(
    body: TeacherAssignmentCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TeacherAssignmentOut:
    """Assign a teacher to a course subject."""
    school_id = _require_admin(context)
    row = await operations.create_teacher_assignment(
        session,
        school_id=school_id,
        course_subject_id=body.course_subject_id,
        teacher_id=body.teacher_id,
    )
    await session.commit()
    return TeacherAssignmentOut.model_validate(row, from_attributes=True)


@router.patch(
    "/teacher-assignments/{assignment_id}",
    response_model=TeacherAssignmentOut,
)
async def update_teacher_assignment(
    body: TeacherAssignmentUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    assignment_id: Annotated[uuid.UUID, Path()],
) -> TeacherAssignmentOut:
    """Update a teacher assignment."""
    school_id = _require_admin(context)
    row = await operations.update_teacher_assignment(
        session,
        assignment_id=assignment_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return TeacherAssignmentOut.model_validate(row, from_attributes=True)


@router.delete(
    "/teacher-assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_teacher_assignment(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    assignment_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Remove a teacher from a course subject."""
    school_id = _require_admin(context)
    await operations.delete_teacher_assignment(
        session, assignment_id=assignment_id, school_id=school_id
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Student enrollments
# ---------------------------------------------------------------------------


@router.get("/student-enrollments", response_model=list[StudentEnrollmentOut])
async def list_student_enrollments(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[StudentEnrollmentOut]:
    """List the school's enrollments."""
    school_id = _school_id(context)
    rows = await operations.list_student_enrollments(session, school_id=school_id)
    return [StudentEnrollmentOut.model_validate(r, from_attributes=True) for r in rows]


@router.post(
    "/student-enrollments",
    response_model=StudentEnrollmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_student_enrollment(
    body: StudentEnrollmentCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> StudentEnrollmentOut:
    """Enroll a student in a course."""
    school_id = _require_admin(context)
    row = await operations.create_student_enrollment(
        session,
        school_id=school_id,
        course_id=body.course_id,
        student_id=body.student_id,
        status=body.status,
    )
    await session.commit()
    return StudentEnrollmentOut.model_validate(row, from_attributes=True)


@router.patch(
    "/student-enrollments/{enrollment_id}",
    response_model=StudentEnrollmentOut,
)
async def update_student_enrollment(
    body: StudentEnrollmentUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    enrollment_id: Annotated[uuid.UUID, Path()],
) -> StudentEnrollmentOut:
    """Update an enrollment."""
    school_id = _require_admin(context)
    row = await operations.update_student_enrollment(
        session,
        enrollment_id=enrollment_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return StudentEnrollmentOut.model_validate(row, from_attributes=True)


@router.delete(
    "/student-enrollments/{enrollment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_student_enrollment(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    enrollment_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Remove an enrollment."""
    school_id = _require_admin(context)
    await operations.delete_student_enrollment(
        session, enrollment_id=enrollment_id, school_id=school_id
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


@router.get("/members", response_model=list[SchoolMemberOut])
async def list_members(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    role: Annotated[SchoolRole | None, Query()] = None,
    include_revoked: Annotated[bool, Query()] = False,
) -> list[SchoolMemberOut]:
    """List the school's members, joined with their profile.

    The frontend used to do this join in the browser. It is a
    server-side join now, so the page needs one request instead of
    two, and the join is scoped to the school in SQL.

    A student does not get the member directory: it carries the email
    and the phone of every member of the school. A student asks for
    their own teachers through `/v1/academics/my-teachers` instead.

    Pass ``include_revoked=true`` to also list deactivated members,
    which the admin management view uses to reactivate them.
    """
    school_id = _school_id(context)

    if context.role_in(school_id) == SchoolRole.STUDENT:
        from app.core.errors import ForbiddenError

        raise ForbiddenError(
            "Only the school's staff can list its members.",
            code="insufficient_role",
        )

    rows = await operations.list_members(
        session, school_id=school_id, role=role, include_revoked=include_revoked
    )

    # The activation link is not part of the list: it is rotated every
    # time the admin asks for it, so there is nothing stored to show.
    return [
        SchoolMemberOut(
            membership_id=membership.id,
            school_id=membership.school_id,
            user_id=membership.user_id,
            role=membership.role.value,
            is_primary=membership.is_primary,
            joined_at=membership.joined_at,
            full_name=profile.full_name,
            email=email,
            phone=profile.phone,
            avatar_url=profile.avatar_url,
            revoked_at=membership.revoked_at,
            account_activated=account_activated,
        )
        for membership, profile, email, account_activated in rows
    ]


@router.get("/my-teachers", response_model=list[StudentTeacherOut])
async def list_my_teachers(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[StudentTeacherOut]:
    """The teachers of the courses the caller is enrolled in.

    A student uses this to start a conversation with one of their
    teachers. It is deliberately narrower than the member directory:
    only the teachers they actually have.
    """
    school_id = _school_id(context)

    if context.role_in(school_id) != SchoolRole.STUDENT:
        from app.core.errors import ForbiddenError

        raise ForbiddenError(
            "Only a student can list their teachers.",
            code="insufficient_role",
        )

    rows = await operations.list_teachers_for_student(
        session, school_id=school_id, student_id=context.user_id
    )
    return [
        StudentTeacherOut(
            user_id=teacher_id,
            full_name=full_name,
            email=email,
            subjects=subjects,
        )
        for teacher_id, full_name, email, subjects in rows
    ]


__all__ = ["router"]
