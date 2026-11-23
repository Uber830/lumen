"""Users router: privileged operations on identities and memberships.

Routes in this module assume the requester has already authenticated
(Authorization: Bearer <token>) and that the backend has identified
their school_id and role. The auth dependency verifies the token; the
route itself verifies that the requester is authorised to act on
that school.

Phase 2: the membership lookup goes through the request context, which
loads the caller's memberships once per request. The school is always
derived from the caller's own memberships, never from the request
body.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.academics.operations import create_student_enrollment, create_teacher_assignment
from app.auth.operations import issue_activation_token
from app.core.context import RequestContext
from app.core.errors import ConflictError, NotFoundError
from app.db.enums import EnrollmentStatus
from app.db.enums import SchoolRole as SchoolRoleEnum
from app.db.session import get_db
from app.deps import get_context
from app.users.operations import (
    create_invited_user,
    find_user_by_email,
    get_membership,
    get_user,
    set_membership_revoked,
)
from app.users.schemas import (
    ActivationLinkResponse,
    BulkInvitationsRequest,
    BulkInvitationsResponse,
    MembershipResponse,
    MembershipUpdate,
    UserInvitationRequest,
    UserInvitationResponse,
)

router = APIRouter(prefix="/v1/users", tags=["users"])

# How many invitations share a single database transaction. One commit
# per batch instead of one per row turns N round-trips to the database
# into N / _BULK_BATCH_SIZE, which is what made large CSV uploads slow.
# Each row still runs inside its own SAVEPOINT, so a single bad row is
# rolled back on its own without losing the rest of the batch.
_BULK_BATCH_SIZE = 50


def _require_school_admin(context: RequestContext) -> uuid.UUID:
    """Resolve the school the caller is school_admin of.

    The school is derived from the caller's own memberships, never
    from the request body.
    """
    membership = context.require_any_membership()
    if membership.role != SchoolRoleEnum.SCHOOL_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only school_admin can perform this action.",
        )
    return membership.school_id


@router.post("/bulk-upload", status_code=status.HTTP_201_CREATED)
async def bulk_invite(
    body: BulkInvitationsRequest,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> BulkInvitationsResponse:
    """Create N users in a single call (CSV bulk upload).

    The frontend parses the CSV and posts an array of
    `{email, full_name, role}` records. Each invitation is processed
    independently; a failure on one row does not abort the rest of
    the batch. Caller must be school_admin of the target school.

    Performance: rows are grouped into batches of ``_BULK_BATCH_SIZE``
    that share one COMMIT. Within a batch each row runs inside its own
    SAVEPOINT, so a bad row is rolled back to the savepoint and the
    other rows in the batch still commit. This keeps the per-row error
    isolation the frontend relies on while cutting the number of
    commits (and their network round-trips) by the batch size.
    """
    school_id = _require_school_admin(context)
    if not body.invitations:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invitations must be a non-empty array.",
        )

    created: list[UserInvitationResponse] = []
    failures: list[dict[str, str | None]] = []
    # Catch duplicates that appear within the CSV itself, before they
    # reach the database. Two rows with the same email would otherwise
    # make the second one fail on the unique constraint; rejecting it
    # here keeps the error message clear and avoids a wasted round-trip.
    seen_emails: set[str] = set()

    rows = list(enumerate(body.invitations))
    for start in range(0, len(rows), _BULK_BATCH_SIZE):
        batch = rows[start : start + _BULK_BATCH_SIZE]
        batch_created = await _process_batch(
            session,
            school_id,
            batch,
            seen_emails,
            failures,
        )
        created.extend(batch_created)

    return BulkInvitationsResponse(created=created, failures=failures)


async def _process_batch(
    session: AsyncSession,
    school_id: uuid.UUID,
    batch: list[tuple[int, UserInvitationRequest]],
    seen_emails: set[str],
    failures: list[dict[str, str | None]],
) -> list[UserInvitationResponse]:
    """Process one batch of invitations under a single commit.

    Each row runs in a SAVEPOINT so its failure is isolated; the whole
    batch is committed once at the end. If the final commit itself
    fails (a connection drop, say), every row in the batch is reported
    as failed rather than silently lost.
    """
    created: list[UserInvitationResponse] = []
    staged: list[tuple[int, UserInvitationRequest]] = []

    for index, row in batch:
        normalized_email = (row.email or "").strip().lower()
        if normalized_email in seen_emails:
            failures.append(
                {
                    "index": str(index),
                    "email": row.email,
                    "error": "Duplicate email within the uploaded file.",
                }
            )
            continue

        try:
            # create_invited_user wraps its writes in a SAVEPOINT, so a
            # conflicting row rolls back to that savepoint on its own
            # and the rest of the batch (committed together below) is
            # unaffected. The duplicate check before it is read-only.
            result = await _create_one_invitation(session, school_id, row)
            created.append(result)
            staged.append((index, row))
            seen_emails.add(normalized_email)
        except HTTPException as exc:
            failures.append(
                {
                    "index": str(index),
                    "email": row.email,
                    "error": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
                }
            )
        except Exception as exc:
            failures.append(
                {
                    "index": str(index),
                    "email": row.email,
                    "error": str(exc),
                }
            )

    try:
        await session.commit()
    except Exception as exc:
        # The batch commit failed as a whole: nothing in it persisted.
        # Move its successes into the failure list and undo the emails
        # we optimistically marked as seen.
        await session.rollback()
        created = []
        for index, row in staged:
            seen_emails.discard((row.email or "").strip().lower())
            failures.append(
                {
                    "index": str(index),
                    "email": row.email,
                    "error": f"Batch commit failed: {exc}",
                }
            )

    return created


@router.post("/invitations", status_code=status.HTTP_201_CREATED)
async def create_invitation(
    body: UserInvitationRequest,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserInvitationResponse:
    """Create a user, a profile row, and a school_memberships row.

    Caller must be a school_admin of the target school. The created
    user has no password yet: they set one through the password-reset
    flow.
    """
    school_id = _require_school_admin(context)
    result = await _create_one_invitation(session, school_id, body)
    await session.commit()
    return result


@router.get("/memberships")
async def list_my_memberships(
    context: Annotated[RequestContext, Depends(get_context)],
) -> list[dict[str, object]]:
    """Return the caller's active memberships.

    The frontend uses this to pick the active school and to render the
    role switcher.
    """
    return [
        {
            "id": str(membership.id),
            "school_id": str(membership.school_id),
            "role": membership.role.value,
            "is_primary": membership.is_primary,
            "joined_at": membership.joined_at.isoformat(),
        }
        for membership in context.memberships
    ]


@router.patch("/memberships/{membership_id}", response_model=MembershipResponse)
async def update_membership(
    body: MembershipUpdate,
    membership_id: Annotated[uuid.UUID, Path()],
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MembershipResponse:
    """Deactivate or reactivate a member of the school.

    Caller must be a school_admin. Deactivating sets the membership's
    ``revoked_at`` (a soft-revoke that keeps the history); reactivating
    clears it. An admin cannot deactivate themselves, and the last
    active admin of a school cannot be deactivated.
    """
    school_id = _require_school_admin(context)
    try:
        membership = await set_membership_revoked(
            session,
            membership_id=membership_id,
            school_id=school_id,
            acting_user_id=context.user_id,
            revoked=body.revoked,
        )
    except NotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=exc.detail,
        ) from exc
    except ConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.detail,
        ) from exc

    await session.commit()
    return MembershipResponse(
        membership_id=membership.id,
        school_id=membership.school_id,
        user_id=membership.user_id,
        role=SchoolRoleEnum(membership.role.value),
        revoked=membership.revoked_at is not None,
    )


@router.post(
    "/memberships/{membership_id}/activation-link",
    response_model=ActivationLinkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_activation_link(
    membership_id: Annotated[uuid.UUID, Path()],
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ActivationLinkResponse:
    """Issue a fresh activation link for a member who has not activated yet.

    The admin shares it from the member's "Gestionar" card. A member
    whose account is already active has no link to share.
    """
    school_id = _require_school_admin(context)
    membership = await get_membership(session, membership_id=membership_id, school_id=school_id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found.",
        )

    user = await get_user(session, membership.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    if user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account is already active.",
        )

    token, expires_at = await issue_activation_token(session, user.id)
    await session.commit()

    return ActivationLinkResponse(
        membership_id=membership.id,
        user_id=user.id,
        email=user.email,
        activation_token=token,
        expires_at=expires_at,
    )


async def _create_one_invitation(
    session: AsyncSession,
    school_id: uuid.UUID,
    body: UserInvitationRequest,
) -> UserInvitationResponse:
    """The shared per-row logic used by /invitations and /bulk-upload."""
    if body.school_id is not None and body.school_id != school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=("Cannot invite to a different school from the requester's primary school."),
        )

    # Reject duplicates so the route returns a sensible 409 instead
    # of leaking a database error.
    if await find_user_by_email(session, body.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with that email already exists.",
        )

    try:
        user, membership = await create_invited_user(
            session,
            email=body.email,
            full_name=body.full_name,
            role=SchoolRoleEnum(body.role.value),
            school_id=school_id,
            is_primary=body.is_primary,
        )
    except ConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.detail,
        ) from exc

    # Issue a single-use activation token so the new user can set their
    # first password. Without an email provider, it is returned to the
    # admin, who passes the activation link to the user. It is not
    # stored: the admin asks for a new one when they need it, and the
    # previous link stops working.
    activation_token, _expires_at = await issue_activation_token(session, user.id)
    await session.flush()

    # A student is created in a course: the admin picks it in the form,
    # and a student without a course has no material to see.
    if body.course_ids:
        if body.role.value != SchoolRoleEnum.STUDENT.value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only a student can be enrolled in a course.",
            )
        for course_id in body.course_ids:
            await create_student_enrollment(
                session,
                school_id=school_id,
                course_id=course_id,
                student_id=user.id,
                status=EnrollmentStatus.ACTIVE,
            )

    # A teacher is assigned to a course subject: that assignment is what
    # gives them access to the material of the subject. A teacher without
    # an assignment waits with the access pending.
    if body.course_subject_ids:
        if body.role.value != SchoolRoleEnum.TEACHER.value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only a teacher can be assigned to a course subject.",
            )
        for course_subject_id in body.course_subject_ids:
            await create_teacher_assignment(
                session,
                school_id=school_id,
                course_subject_id=course_subject_id,
                teacher_id=user.id,
            )

    return UserInvitationResponse(
        user_id=user.id,
        email=user.email,
        role=body.role,
        school_id=school_id,
        membership_id=membership.id,
        activation_token=activation_token,
    )
