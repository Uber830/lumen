"""The domain triggers that create notifications.

The other modules call these when something happens the user should
know about: a task is posted, a submission arrives, a submission is
graded, content is published, a chat message is sent.

Each trigger resolves *who* has to be told, and writes one row per
recipient. The wording is part of the row, so the frontend only has to
render what it reads.

The triggers take part in the transaction of the operation that caused
them: a notification exists exactly when the event does.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import course_subject_course_id
from app.core.events import Event, queue_events
from app.db.enums import EnrollmentStatus, NotificationKind, SchoolRole
from app.db.models import (
    ChatMember,
    ChatMessage,
    ContentItem,
    Notification,
    NotificationPreference,
    Profile,
    SchoolMembership,
    StudentEnrollment,
    Task,
    TaskSubmission,
    TeacherAssignment,
    User,
)

# How much of a chat message the notification body shows.
_PREVIEW_LIMIT = 120

# Picks the place in the app a recipient has to go to, given the role
# they hold in the school.
LinkBuilder = Callable[[SchoolRole | None], str | None]


# ---------------------------------------------------------------------------
# The triggers
# ---------------------------------------------------------------------------


async def notify_task_assigned(session: AsyncSession, *, task: Task) -> int:
    """Tell the enrolled students that a task was posted.

    The teacher who posted it is not a recipient: they wrote it.
    """
    recipients = await _enrolled_student_ids(
        session,
        school_id=task.school_id,
        course_subject_id=task.course_subject_id,
    )
    if not recipients:
        return 0

    actor = await _display_name(session, user_id=task.posted_by)
    return await _insert_notifications(
        session,
        school_id=task.school_id,
        recipients=recipients,
        kind=NotificationKind.TASK_ASSIGNED,
        title=f"Nueva tarea: {task.title}",
        body=f"{actor} asignó esta tarea.",
        link_for=_student_task_link,
        payload={
            "task_id": str(task.id),
            "course_subject_id": str(task.course_subject_id),
            "due_at": task.due_at.isoformat() if task.due_at else None,
        },
    )


async def notify_task_submitted(
    session: AsyncSession,
    *,
    task: Task,
    submission: TaskSubmission,
) -> int:
    """Tell the teachers of the course subject that a submission arrived."""
    recipients = await _assigned_teacher_ids(
        session,
        school_id=task.school_id,
        course_subject_id=task.course_subject_id,
    )
    if not recipients:
        return 0

    actor = await _display_name(session, user_id=submission.student_id)
    return await _insert_notifications(
        session,
        school_id=task.school_id,
        recipients=recipients,
        kind=NotificationKind.TASK_SUBMITTED,
        title=f"{actor} entregó una tarea",
        body=f"Entrega de {task.title}, pendiente de calificar.",
        link_for=_teacher_material_link,
        payload={
            "task_id": str(task.id),
            "submission_id": str(submission.id),
            "student_id": str(submission.student_id),
        },
    )


async def notify_task_graded(
    session: AsyncSession,
    *,
    task: Task,
    submission: TaskSubmission,
) -> int:
    """Tell the student that their submission was graded."""
    grade = submission.grade
    grade_text = f"{grade:g}" if grade is not None else "sin nota"

    return await _insert_notifications(
        session,
        school_id=task.school_id,
        recipients=[submission.student_id],
        kind=NotificationKind.TASK_GRADED,
        title=f"Tarea calificada: {task.title}",
        body=f"Recibiste una nota de {grade_text}.",
        link_for=_student_task_link,
        payload={
            "task_id": str(task.id),
            "submission_id": str(submission.id),
            "grade": str(grade) if grade is not None else None,
        },
    )


async def notify_content_published(
    session: AsyncSession,
    *,
    item: ContentItem,
) -> int:
    """Tell the enrolled students that new material was posted."""
    recipients = await _enrolled_student_ids(
        session,
        school_id=item.school_id,
        course_subject_id=item.course_subject_id,
    )
    if not recipients:
        return 0

    actor = await _display_name(session, user_id=item.posted_by)
    return await _insert_notifications(
        session,
        school_id=item.school_id,
        recipients=recipients,
        kind=NotificationKind.CONTENT_PUBLISHED,
        title=f"Nuevo contenido: {item.title}",
        body=f"{actor} publicó material nuevo en tu materia.",
        link_for=_student_home_link,
        payload={
            "content_item_id": str(item.id),
            "course_subject_id": str(item.course_subject_id),
        },
    )


async def notify_chat_message(
    session: AsyncSession,
    *,
    message: ChatMessage,
    conversation_title: str | None = None,
) -> int:
    """Tell the other members of the conversation that a message arrived.

    The sender is not a recipient: they wrote it.
    """
    result = await session.execute(
        select(ChatMember.user_id).where(
            ChatMember.conversation_id == message.conversation_id,
            ChatMember.user_id != message.sender_id,
        )
    )
    recipients = list(result.scalars().all())
    if not recipients:
        return 0

    actor = await _display_name(session, user_id=message.sender_id)
    return await _insert_notifications(
        session,
        school_id=message.school_id,
        recipients=recipients,
        kind=NotificationKind.CHAT_MESSAGE,
        title=f"{actor} te envió un mensaje",
        body=_preview(message.body),
        link_for=_chat_link,
        payload={
            "conversation_id": str(message.conversation_id),
            "message_id": str(message.id),
            "conversation_title": conversation_title,
        },
    )


# ---------------------------------------------------------------------------
# The audience
# ---------------------------------------------------------------------------


async def _enrolled_student_ids(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> list[uuid.UUID]:
    """The students enrolled in the course the course subject belongs to.

    Withdrawn and completed enrollments do not count: those students
    are not in the class anymore.
    """
    course_id = await course_subject_course_id(session, course_subject_id=course_subject_id)
    if course_id is None:
        return []

    result = await session.execute(
        select(StudentEnrollment.student_id).where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.course_id == course_id,
            StudentEnrollment.status == EnrollmentStatus.ACTIVE,
        )
    )
    return list(result.scalars().all())


async def _assigned_teacher_ids(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> list[uuid.UUID]:
    """The teachers assigned to a course subject."""
    result = await session.execute(
        select(TeacherAssignment.teacher_id).where(
            TeacherAssignment.school_id == school_id,
            TeacherAssignment.course_subject_id == course_subject_id,
        )
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Writing the rows
# ---------------------------------------------------------------------------


async def _insert_notifications(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    recipients: list[uuid.UUID],
    kind: NotificationKind,
    title: str,
    body: str | None,
    link_for: LinkBuilder,
    payload: dict[str, object],
) -> int:
    """Write one notification per recipient.

    The link depends on the role of the recipient, so the roles are
    resolved in one query before the rows go in.
    """
    unique_recipients = list(dict.fromkeys(recipients))
    if not unique_recipients:
        return 0

    # The recipients that do not want this kind inside the app are left
    # out: the preference is what the user asked for.
    wanted = await _in_app_recipients(session, user_ids=unique_recipients, kind=kind)
    if not wanted:
        return 0

    roles = await _roles_in_school(session, school_id=school_id, user_ids=wanted)

    now = datetime.now(UTC)
    rows = [
        {
            "id": uuid.uuid4(),
            "school_id": school_id,
            "recipient_user_id": recipient_id,
            "kind": kind,
            "title": title,
            "body": body,
            "link": link_for(roles.get(recipient_id)),
            "payload": payload,
            "read_at": None,
            "created_at": now,
            "updated_at": now,
        }
        for recipient_id in wanted
    ]

    await session.execute(insert(Notification), rows)

    # The browser is told there is something new. The event says what
    # happened, not what it is: the client asks the API for the rows.
    # It leaves when the transaction commits.
    queue_events(
        session,
        event=Event("notification", {"kind": kind.value, "count": len(rows)}),
        user_ids=list(wanted),
    )

    return len(rows)


async def _in_app_recipients(
    session: AsyncSession,
    *,
    user_ids: list[uuid.UUID],
    kind: NotificationKind,
) -> list[uuid.UUID]:
    """The recipients that want this kind inside the app.

    A user who never touched their preferences wants everything in the
    app, so only the rows that say otherwise are looked for.
    """
    result = await session.execute(
        select(NotificationPreference.user_id).where(
            NotificationPreference.user_id.in_(user_ids),
            NotificationPreference.kind == kind,
            NotificationPreference.in_app.is_(False),
        )
    )
    turned_off = set(result.scalars().all())
    return [user_id for user_id in user_ids if user_id not in turned_off]


async def _roles_in_school(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    user_ids: list[uuid.UUID],
) -> dict[uuid.UUID, SchoolRole]:
    """The role each user holds in a school."""
    if not user_ids:
        return {}

    result = await session.execute(
        select(SchoolMembership.user_id, SchoolMembership.role).where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.user_id.in_(user_ids),
            SchoolMembership.revoked_at.is_(None),
        )
    )
    return {row[0]: row[1] for row in result.all()}


async def _display_name(session: AsyncSession, *, user_id: uuid.UUID) -> str:
    """The name to show for a user.

    Falls back to the email, and to a generic word when neither is
    known: a notification without an actor reads badly.
    """
    result = await session.execute(
        select(Profile.full_name, User.email)
        .join(Profile, Profile.id == User.id, isouter=True)
        .where(User.id == user_id)
    )
    row = result.first()
    if row is None:
        return "Alguien"
    return row[0] or row[1] or "Alguien"


def _preview(text: str) -> str:
    """The beginning of a message, for the notification body."""
    collapsed = " ".join(text.split())
    if len(collapsed) <= _PREVIEW_LIMIT:
        return collapsed
    return f"{collapsed[:_PREVIEW_LIMIT]}…"


# ---------------------------------------------------------------------------
# The links
# ---------------------------------------------------------------------------


def _student_task_link(role: SchoolRole | None) -> str | None:
    """Where a student goes to see their tasks."""
    return "/estudiante/tareas" if role == SchoolRole.STUDENT else None


def _teacher_material_link(role: SchoolRole | None) -> str | None:
    """Where a teacher goes to see the submissions."""
    return "/docente/materia" if role == SchoolRole.TEACHER else None


def _student_home_link(role: SchoolRole | None) -> str | None:
    """Where a student goes to see the new material."""
    return "/estudiante" if role == SchoolRole.STUDENT else None


def _chat_link(role: SchoolRole | None) -> str | None:
    """Where the recipient goes to read the message.

    Only the teacher and the student roles have a chat page; a school
    admin in the conversation has nowhere to go, so the notification
    carries no link.
    """
    if role == SchoolRole.TEACHER:
        return "/docente/chat"
    if role == SchoolRole.STUDENT:
        return "/estudiante/chat"
    return None


__all__ = [
    "notify_chat_message",
    "notify_content_published",
    "notify_task_assigned",
    "notify_task_graded",
    "notify_task_submitted",
]
