"""The router of the school administrator.

Endpoints
---------

- GET /v1/school/me: who the caller is, the school it administers,
  its rank and the permissions that come with it.

The school is always the caller's own: it comes from the session
token, never from the request. A caller that does not administer a
school gets a 404, so the endpoint cannot be used to find out which
schools exist.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.admin_permissions import SchoolPermission, permissions_for, require_permission
from app.core.context import Membership, RequestContext
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.db.enums import SchoolAdminRole, SchoolRole
from app.db.session import get_db
from app.deps import get_context
from app.platform import catalog
from app.platform.storage import get_storage
from app.school import community, cycles, icfes, identity, operations, support, team
from app.school.schemas import (
    ActivationCreatedOut,
    ActivationIn,
    AdminInviteIn,
    AdminInviteOut,
    AdminOut,
    AdminRankIn,
    AdminSchoolOut,
    AdminUserOut,
    AssignmentPageOut,
    CourseOut,
    CoursePageOut,
    CurrentPeriodOut,
    IcfesSimulatorsOut,
    MaterialDetailOut,
    MaterialOptionsOut,
    MaterialPage,
    MemberEditIn,
    MemberEditOut,
    MemberPage,
    PeriodClosedOut,
    PeriodCurrentOut,
    PeriodOut,
    SchoolAdminMe,
    SchoolIdentityOut,
    SchoolIdentityUpdate,
    SchoolMaterialCreateIn,
    SchoolMaterialUpdateIn,
    SchoolOverview,
    SimulatorResultsOut,
    SubjectOut,
    SubjectPageOut,
    SupportAttachmentOut,
    SupportCaseIn,
    SupportCaseOut,
    SupportCasePage,
    SupportMessageIn,
    TeacherAssignmentsOut,
)

router = APIRouter(prefix="/v1/school", tags=["school"])


def _pages(total: int, per_page: int) -> int:
    """How many pages a list of that size has."""
    return (total + per_page - 1) // per_page if total else 0


def _require_admin(context: RequestContext) -> Membership:
    """The membership of the administrator, or a refusal.

    The school comes from the session. The caller that belongs to a
    school but not as an administrator gets a 403: it already knows
    the school exists, so there is nothing to hide.
    """
    from app.core.errors import ForbiddenError

    membership = context.require_any_membership()
    if membership.role != SchoolRole.SCHOOL_ADMIN:
        raise ForbiddenError(
            "Only school administrators can see this panel.",
            code="insufficient_role",
        )
    return membership


@router.get("/me", response_model=SchoolAdminMe)
async def school_me(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolAdminMe:
    """Return the context of the administrator.

    The response carries the `permissions` of the rank of the caller:
    the frontend shows what is on the list and disables the rest with
    its reason.
    """
    membership = _require_admin(context)

    school = await operations.get_school(session, membership.school_id)
    if school is None:
        raise NotFoundError("School not found.")

    user = await operations.get_user(session, context.user_id)
    profile = await operations.get_profile(session, context.user_id)
    entitlement = await operations.get_entitlement(session, membership.school_id)
    period = await operations.get_current_period(session, membership.school_id)

    return SchoolAdminMe(
        user=AdminUserOut(
            id=context.user_id,
            email=context.email or (user.email if user else ""),
            full_name=(profile.full_name if profile else None)
            or (user.full_name if user else None),
            phone=profile.phone if profile else None,
            avatar_url=profile.avatar_url if profile else None,
        ),
        admin_role=membership.admin_role.value if membership.admin_role else None,
        school=AdminSchoolOut(
            id=school.id,
            name=school.name,
            display_name=school.display_name,
            short_code=school.short_code,
            status=school.status.value,
            logo_url=school.logo_url,
            primary_color=school.primary_color,
            plan_code=entitlement.plan_code if entitlement else None,
            plan_name=entitlement.plan_name if entitlement else None,
        ),
        permissions=permissions_for(membership.admin_role),
        current_period=(
            CurrentPeriodOut(
                id=period.id,
                name=period.name,
                start_date=period.start_date,
                end_date=period.end_date,
                delivery_modality=(
                    period.delivery_modality.value if period.delivery_modality else None
                ),
                closed_at=period.closed_at,
            )
            if period
            else None
        ),
    )


@router.get("/material", response_model=MaterialPage)
async def list_school_material(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(description="Título, área o ID del material")] = None,
    area: Annotated[str | None, Query(description="El área del material")] = None,
    audience: Annotated[
        str | None, Query(description="A quién va dirigido: all o teachers")
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 6,
) -> MaterialPage:
    """The material enabled for the school.

    Read only: the school consumes the material, it does not publish
    it. The filters and the pagination run in the server.
    """
    membership = _require_admin(context)
    page_data = await operations.list_material(
        session,
        membership.school_id,
        query=q,
        area=area,
        audience=audience,
        page=page,
        per_page=per_page,
    )
    return MaterialPage.model_validate(page_data)


@router.get("/material/options", response_model=MaterialOptionsOut)
async def school_material_options(
    context: Annotated[RequestContext, Depends(get_context)],
) -> MaterialOptionsOut:
    """The closed catalogs of the resources: types, areas and audiences.

    The school does not invent a type or an area: it takes them from
    here, the same way the platform does.
    """
    _require_admin(context)
    return MaterialOptionsOut(
        types=list(catalog.MATERIAL_TYPES),
        areas=list(catalog.MATERIAL_AREAS),
        audiences=list(catalog.VISIBLE_TO),
    )


@router.get("/material/{material_id}", response_model=MaterialDetailOut)
async def get_school_material(
    material_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetailOut:
    """One material of the school, with its access confirmed.

    A material that is not enabled for this school answers 404: the
    endpoint must not confirm that the material of another school
    exists.
    """
    membership = _require_admin(context)
    material = await operations.get_material(session, membership.school_id, material_id)
    if material is None:
        raise NotFoundError("Material not found.")
    return MaterialDetailOut.model_validate(material)


@router.get("/material/{material_id}/file")
async def get_school_material_file(
    material_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """The file of a resource of the school.

    The file is served by the API and shown inside the platform: the
    material is consulted, not downloaded.
    """
    membership = _require_admin(context)
    found = await operations.get_material_file(session, membership.school_id, material_id)
    if found is None:
        raise NotFoundError("Material not found.")
    stored, _material = found

    try:
        content = await get_storage().read(key=stored.storage_key)
    except FileNotFoundError as error:
        raise NotFoundError("The file is not in the storage.") from error

    name = stored.file_name.replace('"', "'").replace("\n", " ").replace("\r", " ")
    return Response(
        content=content,
        media_type=stored.mime_type,
        headers={"Content-Disposition": f'inline; filename="{name}"'},
    )


@router.post("/material/uploads", status_code=status.HTTP_201_CREATED)
async def upload_school_material_file(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File()],
) -> dict[str, object]:
    """Upload the file of a resource of the school.

    The file waits in the pending folder until the piece that carries
    it is created.
    """
    _require_admin(context)
    file_name = file.filename or "archivo"
    mime_type = catalog.mime_type_of(file_name, file.content_type)
    if mime_type not in catalog.ALLOWED_MIME_TYPES:
        raise ValidationError(
            "Ese formato no está admitido. Usa PDF, EPUB, DOCX, MP4, ZIP o una imagen.",
            code="invalid_format",
            extra={"file_name": file_name},
        )

    limit = catalog.size_limit_for(mime_type)
    content = await file.read()
    if len(content) > limit:
        raise ValidationError(
            f"El archivo supera el límite de {limit // (1024 * 1024)} MB de {mime_type}.",
            code="file_too_large",
            extra={"file_name": file_name, "limit_bytes": limit},
        )

    uploaded = await operations.upload_school_file(
        session,
        context.user_id,
        file_name=file_name,
        mime_type=mime_type,
        content=content,
    )
    return {
        "file_id": str(uploaded.id),
        "file_name": uploaded.file_name,
        "size_bytes": uploaded.size_bytes,
        "size_label": catalog.format_size(uploaded.size_bytes),
        "mime_type": uploaded.mime_type,
    }


@router.post("/material", response_model=MaterialDetailOut, status_code=status.HTTP_201_CREATED)
async def create_school_material(
    body: SchoolMaterialCreateIn,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetailOut:
    """Create a resource of the school and enable it for the school.

    The school decides who sees what it loads: everybody, the teachers,
    the students or the administrators.
    """
    membership = _require_admin(context)
    if body.type not in catalog.MATERIAL_TYPES:
        raise ValidationError(
            "Ese tipo de recurso no existe.",
            code="invalid_material_type",
            extra={"type": body.type},
        )
    if body.area not in catalog.MATERIAL_AREAS:
        raise ValidationError(
            "Ese área no existe.",
            code="invalid_material_area",
            extra={"area": body.area},
        )
    if body.visible_to not in catalog.VISIBLE_TO:
        raise ValidationError(
            "Ese destinatario no existe.",
            code="invalid_visible_to",
            extra={"visible_to": body.visible_to},
        )

    material_id = await operations.create_school_material(
        session,
        membership.school_id,
        context.user_id,
        title=body.title.strip(),
        material_type=body.type,
        area=body.area,
        visible_to=body.visible_to,
        description=body.description.strip() if body.description else None,
        file_id=body.file_id,
    )

    created = await operations.get_material(session, membership.school_id, uuid.UUID(material_id))
    if created is None:
        raise NotFoundError("Material not found.")
    return MaterialDetailOut.model_validate(created)


@router.patch("/material/{material_id}", response_model=MaterialDetailOut)
async def update_school_material(
    material_id: uuid.UUID,
    body: SchoolMaterialUpdateIn,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetailOut:
    """Change a resource of the school.

    Only the pieces the school loaded can be changed: the ones of the
    editorial team are not the school's to edit. The file stays the one
    the school uploaded.
    """
    membership = _require_admin(context)

    changes = body.model_dump(exclude_unset=True)
    if "title" in changes and not str(changes["title"]).strip():
        raise ValidationError(
            "El recurso necesita un título.",
            code="invalid_material_title",
            extra={"field": "title"},
        )
    if "type" in changes and changes["type"] not in catalog.MATERIAL_TYPES:
        raise ValidationError(
            "Ese tipo de recurso no existe.",
            code="invalid_material_type",
            extra={"type": changes["type"]},
        )
    if "area" in changes and changes["area"] not in catalog.MATERIAL_AREAS:
        raise ValidationError(
            "Ese área no existe.",
            code="invalid_material_area",
            extra={"area": changes["area"]},
        )
    if "visible_to" in changes and changes["visible_to"] not in catalog.VISIBLE_TO:
        raise ValidationError(
            "Ese destinatario no existe.",
            code="invalid_visible_to",
            extra={"visible_to": changes["visible_to"]},
        )

    await operations.update_school_material(
        session,
        membership.school_id,
        material_id,
        actor_id=context.user_id,
        changes=changes,
    )

    updated = await operations.get_material(session, membership.school_id, material_id)
    if updated is None:
        raise NotFoundError("Material not found.")
    return MaterialDetailOut.model_validate(updated)


@router.delete("/material/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_school_material(
    material_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a resource of the school.

    Only the pieces the school loaded can be removed: the ones of the
    editorial team are not the school's to delete.
    """
    membership = _require_admin(context)
    await operations.delete_school_material(session, membership.school_id, material_id)


@router.get("/overview", response_model=SchoolOverview)
async def school_overview(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolOverview:
    """Return the dashboard of the school in a single call.

    The dashboard is the view that suffers the most in mobile, so it
    asks for everything at once instead of four round trips: the
    indicators, the material by area, the state of the school and the
    recent activity.

    Every number is counted from the rows of the caller's own school.
    """
    membership = _require_admin(context)
    overview = await operations.get_overview(session, membership.school_id)
    return SchoolOverview.model_validate(overview)


@router.get("/teachers", response_model=MemberPage)
async def list_school_teachers(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(description="Nombre o correo del docente")] = None,
    status: Annotated[str | None, Query(description="activo o inactivo")] = None,
    course_id: Annotated[uuid.UUID | None, Query(description="Curso del filtro")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 10,
) -> MemberPage:
    """The teachers of the school, with their access to the content.

    The search, the filters and the pagination run in the server: the
    list of a school with hundreds of teachers is never pulled into the
    browser to be filtered there.
    """
    membership = _require_admin(context)
    page_data = await community.list_teachers(
        session,
        membership.school_id,
        query=q,
        status=status,
        course_id=course_id,
        page=page,
        per_page=per_page,
    )
    return MemberPage.model_validate(page_data)


@router.get("/students", response_model=MemberPage)
async def list_school_students(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(description="Nombre o correo del estudiante")] = None,
    status: Annotated[str | None, Query(description="activo o inactivo")] = None,
    course_id: Annotated[uuid.UUID | None, Query(description="Curso del filtro")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 10,
) -> MemberPage:
    """The students of the school, with their course and their average.

    The average is `null` when the student has no grades: it is not a
    zero.
    """
    membership = _require_admin(context)
    page_data = await community.list_students(
        session,
        membership.school_id,
        query=q,
        status=status,
        course_id=course_id,
        page=page,
        per_page=per_page,
    )
    return MemberPage.model_validate(page_data)


@router.patch("/members/{membership_id}", response_model=MemberEditOut)
async def update_school_member(
    membership_id: uuid.UUID,
    body: MemberEditIn,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MemberEditOut:
    """Edit a teacher or a student of the school.

    The form of the admin sends the name, the email and the courses (of a
    student) or the course subjects (of a teacher). What is not sent is
    left alone.
    """
    membership = _require_admin(context)
    updated = await community.update_member(
        session,
        membership.school_id,
        membership_id,
        full_name=body.full_name,
        email=body.email,
        course_ids=body.course_ids,
        course_subject_ids=body.course_subject_ids,
    )
    await session.commit()
    return MemberEditOut.model_validate(updated)


@router.get("/courses", response_model=CoursePageOut)
async def list_school_courses(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1, description="Página que se pide")] = 1,
    per_page: Annotated[int, Query(ge=1, le=50, description="Cursos por página")] = 10,
) -> CoursePageOut:
    """The courses of the school, with how much structure they hold.

    The page is cut in the server: the browser only asks for the page it
    is going to show.
    """
    membership = _require_admin(context)
    courses, total = await community.list_courses(
        session, membership.school_id, page=page, per_page=per_page
    )
    return CoursePageOut(
        items=[CourseOut.model_validate(course) for course in courses],
        total=total,
        page=page,
        per_page=per_page,
        pages=_pages(total, per_page),
    )


@router.get("/courses/options", response_model=list[CourseOut])
async def list_school_course_options(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[CourseOut]:
    """Every course of the school, for the forms that offer a choice."""
    membership = _require_admin(context)
    courses, _ = await community.list_courses(session, membership.school_id)
    return [CourseOut.model_validate(course) for course in courses]


@router.get("/subjects", response_model=SubjectPageOut)
async def list_school_subjects(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1, description="Página que se pide")] = 1,
    per_page: Annotated[int, Query(ge=1, le=50, description="Materias por página")] = 10,
    offered: Annotated[
        bool | None,
        Query(description="Solo las que se ofrecen en un curso, o solo las que no"),
    ] = None,
) -> SubjectPageOut:
    """The subjects of the school, with the courses they are taught in."""
    membership = _require_admin(context)
    subjects, total = await community.list_subjects(
        session,
        membership.school_id,
        offered=offered,
        page=page,
        per_page=per_page,
    )
    return SubjectPageOut(
        items=[SubjectOut.model_validate(subject) for subject in subjects],
        total=total,
        page=page,
        per_page=per_page,
        pages=_pages(total, per_page),
    )


@router.get("/subjects/options", response_model=list[SubjectOut])
async def list_school_subject_options(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[SubjectOut]:
    """Every subject of the school, for the forms that offer a choice."""
    membership = _require_admin(context)
    subjects, _ = await community.list_subjects(session, membership.school_id)
    return [SubjectOut.model_validate(subject) for subject in subjects]


@router.get("/assignments", response_model=AssignmentPageOut)
async def list_school_assignments(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    teacher_id: Annotated[uuid.UUID | None, Query(description="Docente del filtro")] = None,
    course_id: Annotated[uuid.UUID | None, Query(description="Curso del filtro")] = None,
    page: Annotated[int, Query(ge=1, description="Página que se pide")] = 1,
    per_page: Annotated[int, Query(ge=1, le=50, description="Docentes por página")] = 10,
) -> AssignmentPageOut:
    """The assignments of the school, with the material each one sees.

    The count of visible material is computed in the server: it is the
    published material of the area of the subject, enabled for the
    school, that applies to the course of the assignment.

    The rows are the teachers: each one carries the subjects it teaches.
    """
    membership = _require_admin(context)
    rows, total = await cycles.list_assignments(
        session,
        membership.school_id,
        teacher_id=teacher_id,
        course_id=course_id,
        page=page,
        per_page=per_page,
    )
    return AssignmentPageOut(
        items=[TeacherAssignmentsOut.model_validate(row) for row in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=_pages(total, per_page),
    )


@router.get("/periods", response_model=list[PeriodOut])
async def list_school_periods(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[PeriodOut]:
    """The periods of the school, the current one first."""
    membership = _require_admin(context)
    periods = await cycles.list_periods(session, membership.school_id)
    return [PeriodOut.model_validate(period) for period in periods]


@router.post("/periods/{period_id}/close", response_model=PeriodClosedOut)
async def close_school_period(
    period_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PeriodClosedOut:
    """Close a period of the school.

    Only the principal does it: closing a period takes the material of
    the cycle out of the active material, and that is a decision of the
    school, not of its helper.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.PERIODS_CLOSE)
    closed = await cycles.close_period(session, membership.school_id, period_id)
    return PeriodClosedOut.model_validate(closed)


@router.post("/periods/{period_id}/set-current", response_model=PeriodCurrentOut)
async def set_current_school_period(
    period_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PeriodCurrentOut:
    """Mark a period as the current one.

    The previous current period is closed in the same transaction: a
    school has one current period at a time.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.PERIODS_CLOSE)
    current = await cycles.set_current_period(session, membership.school_id, period_id)
    return PeriodCurrentOut.model_validate(current)


@router.get("/settings", response_model=SchoolIdentityOut)
async def school_identity(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolIdentityOut:
    """The visible identity of the school, with the contrast of its colour.

    Any administrator reads it. Changing it is the principal's.
    """
    membership = _require_admin(context)
    identity_data = await identity.get_identity(session, membership.school_id)
    return SchoolIdentityOut.model_validate(identity_data)


@router.patch("/settings", response_model=SchoolIdentityOut)
async def update_school_identity(
    body: SchoolIdentityUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolIdentityOut:
    """Change the name and the colour of the school.

    The colour is validated in the backend: a colour below 4.5:1 of
    contrast is refused, and the refusal carries the ratio so the
    interface can say how far it is from the minimum.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.CUSTOMIZATION_WRITE)
    identity_data = await identity.update_identity(
        session,
        membership.school_id,
        display_name=body.display_name,
        primary_color=body.primary_color,
    )
    return SchoolIdentityOut.model_validate(identity_data)


@router.post("/logo", response_model=SchoolIdentityOut)
async def upload_school_logo(
    file: Annotated[UploadFile, File()],
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolIdentityOut:
    """Upload the shield of the school.

    The type is read from the content and not from what the browser
    says: PNG, SVG or JPEG, and no more than 2 MB.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.CUSTOMIZATION_WRITE)

    content = await file.read()
    content_type = identity.validate_logo(content, file.content_type or "")

    from app.core import storage

    logo_path = await storage.upload_school_logo(
        school_id=str(membership.school_id),
        content=content,
        content_type=content_type,
    )

    await identity.set_logo(session, membership.school_id, logo_path)

    identity_data = await identity.get_identity(session, membership.school_id)
    return SchoolIdentityOut.model_validate(identity_data)


@router.get("/admins", response_model=list[AdminOut])
async def list_school_admins(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[AdminOut]:
    """The team of administrators of the school, with its rank."""
    membership = _require_admin(context)
    admins = await team.list_admins(session, membership.school_id)
    return [AdminOut.model_validate(admin) for admin in admins]


@router.post("/admins/invite", response_model=AdminInviteOut, status_code=201)
async def invite_school_admin(
    body: AdminInviteIn,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AdminInviteOut:
    """Invite an administrator to the team.

    Only the principal does it: inviting a colleague is a decision of
    the school, not of its helper.

    The school has a single principal, so the invitation always
    creates a secondary: the rank is handed over later, from the file
    of the team.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.ADMINS_MANAGE)

    from app.auth.operations import issue_activation_token
    from app.db.enums import SchoolAdminRole, SchoolRole
    from app.users.operations import create_invited_user

    rank = SchoolAdminRole(body.admin_role)

    if rank == SchoolAdminRole.PRINCIPAL:
        principals = await team.count_principals(session, membership.school_id)
        if principals > 0:
            raise ConflictError(
                "El colegio tiene un solo administrador principal. "
                "Los administradores nuevos entran como secundarios: "
                "cede el rango desde la ficha del equipo.",
                code="only_one_principal",
            )

    try:
        user, admin_membership = await create_invited_user(
            session,
            email=body.email,
            full_name=body.full_name,
            role=SchoolRole.SCHOOL_ADMIN,
            school_id=membership.school_id,
        )
    except ConflictError as error:
        raise ConflictError(
            "Ya existe un administrador con ese correo en tu colegio.",
            code="duplicate_email",
        ) from error

    # The invitation chooses the rank: the school decides who runs it.
    admin_membership.admin_role = rank

    # The activation link: there is no email provider yet, and the
    # administrator passes it to the colleague.
    activation_token, _expires_at = await issue_activation_token(session, user.id)
    await session.commit()

    return AdminInviteOut(
        user_id=str(user.id),
        email=user.email,
        membership_id=str(admin_membership.id),
        admin_role=rank.value,
        activation_token=activation_token,
    )


@router.patch("/admins/{membership_id}", response_model=AdminOut)
async def update_school_admin(
    membership_id: uuid.UUID,
    body: AdminRankIn,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AdminOut:
    """Change the rank of an administrator.

    The last principal cannot be demoted.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.ADMINS_MANAGE)

    rank = SchoolAdminRole(body.admin_role)
    await team.set_rank(session, membership.school_id, membership_id, rank)

    admins = await team.list_admins(session, membership.school_id)
    for admin in admins:
        if admin["membership_id"] == str(membership_id):
            return AdminOut.model_validate(admin)

    raise NotFoundError("Administrator not found.")


@router.post("/admins/{membership_id}/transfer", response_model=AdminOut)
async def transfer_principal_role(
    membership_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AdminOut:
    """Hand the principal rank over to another administrator.

    The school has a single principal: the rank moves from one person
    to another in a single step, so the school is never left without
    one. The administrator who gives it away stays in the team, as a
    secondary.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.ADMINS_MANAGE)

    await team.transfer_principal(session, membership.school_id, membership.id, membership_id)

    admins = await team.list_admins(session, membership.school_id)
    for admin in admins:
        if admin["membership_id"] == str(membership_id):
            return AdminOut.model_validate(admin)

    raise NotFoundError("Administrator not found.")


@router.delete("/admins/{membership_id}", status_code=204)
async def remove_school_admin(
    membership_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Remove an administrator from the team.

    The last principal cannot be removed.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.ADMINS_MANAGE)

    await team.remove(session, membership.school_id, membership_id)
    return Response(status_code=204)


@router.get("/icfes", response_model=IcfesSimulatorsOut)
async def list_school_simulators(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> IcfesSimulatorsOut:
    """The simulators the platform team enabled for the school.

    The school sees only what it received: a simulator that is not
    enabled for it does not exist here, not even as a draft.
    """
    membership = _require_admin(context)
    data = await icfes.list_simulators(session, membership.school_id)
    return IcfesSimulatorsOut.model_validate(data)


@router.post("/icfes/{simulator_id}/activations", response_model=ActivationCreatedOut)
async def activate_school_simulator(
    simulator_id: uuid.UUID,
    body: ActivationIn,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ActivationCreatedOut:
    """Activate a simulator in some courses of the school.

    The school activates what the platform enabled: it cannot create,
    edit or enable a simulator. The courses and the deadline are the
    only things it decides.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.ICFES_ACTIVATE)
    created = await icfes.activate(
        session,
        membership.school_id,
        simulator_id,
        body.course_ids,
        body.deadline,
    )
    return ActivationCreatedOut.model_validate(created)


@router.get("/icfes/{simulator_id}/results", response_model=SimulatorResultsOut)
async def school_simulator_results(
    simulator_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SimulatorResultsOut:
    """The result of a simulator in each course it runs in."""
    membership = _require_admin(context)
    results = await icfes.simulator_results(session, membership.school_id, simulator_id)
    return SimulatorResultsOut.model_validate(results)


@router.get("/support/cases", response_model=SupportCasePage)
async def list_school_support_cases(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 10,
    q: Annotated[str | None, Query(description="Título o código de la solicitud")] = None,
) -> SupportCasePage:
    """The requests of the school to the support team.

    The list is cut in the server, like the courses and the assignments.
    """
    membership = _require_admin(context)
    page_data = await support.list_cases(
        session, membership.school_id, query=q, page=page, per_page=per_page
    )
    return SupportCasePage.model_validate(page_data)


@router.get("/support/open-count")
async def school_support_open_count(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, int]:
    """How many requests of the school are still open.

    The bell of the panel shows this number, and it counts every case of
    the school: not only the ones of the first page.
    """
    membership = _require_admin(context)
    count = await support.open_case_count(session, membership.school_id)
    return {"count": count}


@router.get("/support/cases/{case_id}", response_model=SupportCaseOut)
async def get_school_support_case(
    case_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SupportCaseOut:
    """One request of the school, with its thread.

    A case of another school answers 404: the endpoint must not confirm
    that it exists.
    """
    membership = _require_admin(context)
    case = await support.get_case(session, membership.school_id, case_id)
    return SupportCaseOut.model_validate(case)


@router.post("/support/cases", response_model=SupportCaseOut, status_code=201)
async def open_school_support_case(
    body: SupportCaseIn,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SupportCaseOut:
    """Open a request to the support team.

    The thread starts with the message of the administrator. The school
    does not resolve the case: that is the platform team's decision.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.SUPPORT_WRITE)
    case = await support.create_case(
        session,
        membership.school_id,
        context.user_id,
        title=body.title,
        category=body.category,
        body=body.body,
        attachment_ids=body.attachment_ids,
    )
    return SupportCaseOut.model_validate(case)


@router.post("/support/cases/{case_id}/messages", response_model=SupportCaseOut)
async def add_school_support_message(
    case_id: uuid.UUID,
    body: SupportMessageIn,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SupportCaseOut:
    """Add information to the thread of a request.

    The case has to belong to the school of the session: a school
    never writes in the thread of another one.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.SUPPORT_WRITE)
    case = await support.add_message(
        session,
        membership.school_id,
        case_id,
        context.user_id,
        body.body,
        attachment_ids=body.attachment_ids,
    )
    return SupportCaseOut.model_validate(case)


@router.post("/support/attachments", response_model=SupportAttachmentOut, status_code=201)
async def upload_support_attachment(
    file: Annotated[UploadFile, File()],
    context: Annotated[RequestContext, Depends(get_context)],
) -> SupportAttachmentOut:
    """Upload a file to attach to a support request.

    The file belongs to the school: it goes to the store under the id of
    the school and only the members of the school read it. It is up to
    10 MB.
    """
    membership = _require_admin(context)
    require_permission(membership.admin_role, SchoolPermission.SUPPORT_WRITE)

    content = await file.read()
    if len(content) > storage.MAX_SUPPORT_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el límite de 10 MB.",
        )

    path = storage.upload_support_attachment(
        school_id=str(membership.school_id),
        filename=file.filename or "archivo",
        content=content,
        content_type=file.content_type,
    )
    return SupportAttachmentOut(
        id=path,
        name=file.filename or "archivo",
        size=len(content),
        url=storage.public_path(path),
    )


__all__ = ["router"]
