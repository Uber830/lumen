"""The endpoints of the editorial catalog.

They are the only ones the platform team uses to fill the catalog: the
material is loaded here, the access is decided here and the state of
every piece is changed here.

Every endpoint requires the platform role. A caller without it gets a
403, whatever the body says.
"""

from __future__ import annotations

import hashlib
import uuid
from contextlib import suppress
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import (
    ConflictError,
    NotFoundError,
    ServiceUnavailableError,
    ValidationError,
)
from app.db.models import Material, MaterialFile, MaterialSchool, Plan, Profile, School, User
from app.db.session import get_db
from app.deps import require_platform_admin
from app.platform import catalog
from app.platform.catalog_schemas import (
    AuditEntryOut,
    AuditPage,
    CatalogOptions,
    CatalogPage,
    CreateMaterialRequest,
    HistoryEntryOut,
    MaterialDetail,
    MaterialFileOut,
    MaterialSchoolOut,
    MaterialSummary,
    MetricsResponse,
    PatchMaterialRequest,
    SchoolCatalogItem,
    SchoolDetail,
    SchoolMaterialAccessRequest,
    SchoolPage,
    SchoolRef,
    SchoolSummary,
    SetSchoolsRequest,
    StatusRequest,
    UploadResponse,
)
from app.platform.storage import build_storage_key, get_storage

router = APIRouter(prefix="/v1/platform", tags=["platform"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _actor_names(
    session: AsyncSession,
    user_ids: set[uuid.UUID],
) -> dict[uuid.UUID, str]:
    """The name of each actor, as it is shown in the history."""
    if not user_ids:
        return {}

    result = await session.execute(
        select(User.id, Profile.full_name, User.email)
        .join(Profile, Profile.id == User.id, isouter=True)
        .where(User.id.in_(user_ids))
    )
    return {
        user_id: (full_name or email or "Alguien") for user_id, full_name, email in result.all()
    }


async def _actor_name(session: AsyncSession, user_id: uuid.UUID | None) -> str | None:
    """The name of the caller."""
    if user_id is None:
        return None
    names = await _actor_names(session, {user_id})
    return names.get(user_id)


async def _load_material(session: AsyncSession, material_id: uuid.UUID) -> Material:
    """One material, or a 404."""
    material = await catalog.get_material(session, material_id)
    if material is None:
        raise NotFoundError("The material does not exist.")
    return material


def _summary(row: catalog.MaterialRow) -> MaterialSummary:
    """One row of the listing."""
    visible = row.school_names[: catalog.SCHOOLS_VISIBLE]
    return MaterialSummary(
        id=row.material.id,
        code=row.material.ref,
        title=row.material.title,
        type=row.material.type,
        area=row.material.area,
        grades=list(row.material.grades),
        status=catalog.status_of(row.material.state),
        origin=row.material.origin,
        visible_to=row.material.visible_to,
        size_label=row.size_label,
        updated_at=row.material.updated_at,
        schools=[
            SchoolRef(id=school_id, name=name)
            for school_id, name in zip(row.school_ids, row.school_names, strict=False)
        ][: catalog.SCHOOLS_VISIBLE],
        schools_extra=max(0, len(row.school_names) - len(visible)),
    )


async def _detail(
    session: AsyncSession,
    material: Material,
) -> MaterialDetail:
    """The whole material, as the side panel shows it."""
    schools = await session.execute(
        select(School, MaterialSchool.enabled_at)
        .join(MaterialSchool, MaterialSchool.school_id == School.id)
        .where(MaterialSchool.material_id == material.id)
        # A school that lost the access keeps the row, but it is not
        # one of the schools that see the piece.
        .where(MaterialSchool.enabled.is_(True))
        .order_by(MaterialSchool.enabled_at, School.name)
    )
    school_rows = schools.all()
    figures = await catalog.school_figures(session, [school.id for school, _ in school_rows])

    history = sorted(material.history, key=lambda entry: entry.created_at)
    names = await _actor_names(
        session,
        {entry.actor_id for entry in history if entry.actor_id is not None},
    )

    size_bytes = sum(file.size_bytes for file in material.files)

    return MaterialDetail(
        id=material.id,
        code=material.ref,
        title=material.title,
        type=material.type,
        area=material.area,
        grades=list(material.grades),
        visible_to=material.visible_to,
        publication_year=material.publication_year,
        description=material.description,
        origin=material.origin,
        external_url=material.external_url,
        status=catalog.status_of(material.state),
        created_at=material.created_at,
        updated_at=material.updated_at,
        published_at=material.published_at,
        archived_at=material.archived_at,
        size_label=catalog.format_size(size_bytes),
        files=[
            MaterialFileOut(
                id=file.id,
                file_name=file.file_name,
                mime_type=file.mime_type,
                size_bytes=file.size_bytes,
                size_label=catalog.format_size(file.size_bytes),
                is_primary=file.is_primary,
                created_at=file.created_at,
            )
            for file in material.files
        ],
        schools=[
            MaterialSchoolOut(
                id=school.id,
                name=school.name,
                short_code=school.short_code,
                plan=figures.get(school.id, {}).get("plan"),
                students=figures.get(school.id, {}).get("students", 0),
            )
            for school, _ in school_rows
        ],
        history=[
            HistoryEntryOut(
                id=entry.id,
                action=entry.action,
                detail=entry.detail,
                actor_id=entry.actor_id,
                actor_name=names.get(entry.actor_id) if entry.actor_id else None,
                created_at=entry.created_at,
            )
            for entry in history
        ],
        available_transitions=catalog.available_transitions(catalog.status_of(material.state)),
        missing=catalog.publication_gaps(material, len(school_rows)),
    )


# ---------------------------------------------------------------------------
# The figures of the network
# ---------------------------------------------------------------------------


@router.get("/metrics", response_model=MetricsResponse)
async def read_metrics(
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MetricsResponse:
    """The figures of the global panel.

    Every number comes from the database.
    """
    return MetricsResponse.model_validate(await catalog.metrics(session))


@router.get("/catalog-options", response_model=CatalogOptions)
async def read_catalog_options(
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CatalogOptions:
    """The closed catalogs: types, areas, grades and plans.

    The frontend takes them from here instead of carrying them as
    constants.
    """
    plans = await session.execute(
        select(Plan.code, Plan.name).where(Plan.is_active.is_(True)).order_by(Plan.name)
    )
    return CatalogOptions(
        types=list(catalog.MATERIAL_TYPES),
        areas=list(catalog.MATERIAL_AREAS),
        grades=list(catalog.MATERIAL_GRADES),
        statuses=list(catalog.MATERIAL_STATUSES),
        visible_to=list(catalog.VISIBLE_TO),
        plans=[{"code": code, "name": name} for code, name in plans.all()],
    )


# ---------------------------------------------------------------------------
# The catalog
# ---------------------------------------------------------------------------


@router.get("/catalog", response_model=CatalogPage)
async def list_catalog(
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=120)] = None,
    type: Annotated[str | None, Query(max_length=32)] = None,
    status: Annotated[str | None, Query(max_length=16)] = None,
    school_id: Annotated[uuid.UUID | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=catalog.MAX_PER_PAGE)] = catalog.DEFAULT_PER_PAGE,
) -> CatalogPage:
    """The catalog, filtered and paginated.

    The filters travel in the query: the listing asks for one page, not
    for the whole catalog.
    """
    rows, total = await catalog.list_materials(
        session,
        query=q,
        material_type=type,
        status=status,
        school_id=school_id,
        page=page,
        per_page=per_page,
    )
    return CatalogPage(
        items=[_summary(row) for row in rows],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/catalog/{material_id}", response_model=MaterialDetail)
async def read_catalog_material(
    material_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetail:
    """One material with its files, its access and its history."""
    material = await _load_material(session, material_id)
    return await _detail(session, material)


@router.post(
    "/catalog",
    response_model=MaterialDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_material(
    body: CreateMaterialRequest,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetail:
    """Create a material in "draft".

    The piece starts as a draft: it is published when the platform team
    says so, with the rules of the module.
    """
    if body.origin == "link" and not (body.external_url or "").strip():
        raise ValidationError(
            "An external material needs its address.",
            code="missing_external_url",
        )
    if body.origin == "link" and not body.title.strip():
        # A link has no file to propose a name, so the title is its own.
        raise ValidationError(
            "An external material needs a visible name.",
            code="missing_title",
        )
    if body.origin == "upload" and body.file_id is None:
        raise ValidationError(
            "An uploaded material needs the file that was uploaded.",
            code="missing_file",
        )

    # The schools that will have access must exist.
    known_schools: list[School] = []
    if body.school_ids:
        result = await session.execute(select(School).where(School.id.in_(body.school_ids)))
        known_schools = list(result.scalars().all())
        known_ids = {school.id for school in known_schools}
        unknown = [str(school_id) for school_id in body.school_ids if school_id not in known_ids]
        if unknown:
            raise ValidationError(
                "Some schools do not exist.",
                code="unknown_schools",
                extra={"unknown_school_ids": unknown},
            )

    # The file that was uploaded before the piece existed.
    uploaded: MaterialFile | None = None
    if body.file_id is not None:
        uploaded = await session.get(MaterialFile, body.file_id)
        if uploaded is None:
            raise NotFoundError("The uploaded file does not exist.")
        if uploaded.material_id is not None:
            raise ConflictError(
                "That file already belongs to a material.",
                code="file_already_attached",
            )

    position = await session.execute(select(func.max(Material.position)))
    highest = position.scalar_one_or_none()

    material = Material(
        ref=await catalog.next_code(session),
        title=body.title,
        type=body.type,
        area=body.area,
        kind=catalog.kind_of(uploaded.mime_type) if uploaded is not None else "pdf",
        grades=list(body.grades),
        visible_to=body.visible_to,
        publication_year=body.publication_year,
        description=body.description,
        origin=body.origin,
        external_url=body.external_url,
        state=catalog.state_of("draft"),
        position=(highest or 0) + 1,
        created_by=context.user_id,
    )
    session.add(material)
    await session.flush()

    if uploaded is not None:
        uploaded.material_id = material.id
        uploaded.is_primary = True
        # The name of the file proposes the title when the platform
        # team did not write one.
        if not material.title:
            material.title = uploaded.file_name
        # The file leaves the "pending" folder and joins the one of
        # its material.
        final_key = build_storage_key(
            file_name=uploaded.file_name,
            material_code=material.ref,
        )
        await get_storage().move(key=uploaded.storage_key, new_key=final_key)
        uploaded.storage_key = final_key

    for school in known_schools:
        session.add(
            MaterialSchool(
                material_id=material.id,
                school_id=school.id,
                enabled_by=context.user_id,
            )
        )

    await catalog.record_history(
        session,
        material=material,
        action="created",
        actor_id=context.user_id,
        detail={
            "title": material.title,
            "type": material.type,
            "area": material.area,
            "schools": [str(school.id) for school in known_schools],
        },
    )
    await catalog.record_audit(
        session,
        event_type="material.created",
        actor_id=context.user_id,
        actor_name=await _actor_name(session, context.user_id),
        subject_type="material",
        subject_id=material.id,
        detail={"code": material.ref, "title": material.title},
    )

    await session.commit()
    return await _detail(session, await _load_material(session, material.id))


@router.patch("/catalog/{material_id}", response_model=MaterialDetail)
async def patch_material(
    material_id: uuid.UUID,
    body: PatchMaterialRequest,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetail:
    """Edit the metadata of a material.

    The state and the access are not touched here: they have their own
    endpoints, so that the history says exactly what changed.
    """
    material = await _load_material(session, material_id)

    changes: list[dict[str, Any]] = []
    for field in (
        "title",
        "type",
        "area",
        "grades",
        "visible_to",
        "publication_year",
        "description",
    ):
        new_value = getattr(body, field)
        if new_value is None:
            continue
        old_value = getattr(material, field)
        if old_value == new_value:
            continue
        changes.append({"field": field, "before": old_value, "after": new_value})
        setattr(material, field, new_value)

    if changes:
        await catalog.record_history(
            session,
            material=material,
            action="metadata_changed",
            actor_id=context.user_id,
            detail={"changes": changes},
        )
        await catalog.record_audit(
            session,
            event_type="material.updated",
            actor_id=context.user_id,
            actor_name=await _actor_name(session, context.user_id),
            subject_type="material",
            subject_id=material.id,
            detail={"code": material.ref, "fields": [c["field"] for c in changes]},
        )

    await session.commit()
    return await _detail(session, await _load_material(session, material.id))


@router.post("/catalog/{material_id}/status", response_model=MaterialDetail)
async def change_material_status(
    material_id: uuid.UUID,
    body: StatusRequest,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetail:
    """Move a material to another state.

    The transition has to be one of the valid ones, and a material that
    goes to "published" needs a title, a type, an area, grades and at
    least one school.
    """
    material = await _load_material(session, material_id)
    previous = catalog.status_of(material.state)

    if previous == body.status:
        raise ConflictError(
            "The material is already in that state.",
            code="same_status",
        )
    if not catalog.can_transition(previous, body.status):
        raise ConflictError(
            f"A material in '{previous}' cannot go to '{body.status}'.",
            code="invalid_transition",
            extra={"available_transitions": catalog.available_transitions(previous)},
        )

    if body.status == "published":
        gaps = catalog.publication_gaps(material, len(material.schools))
        if gaps:
            raise ValidationError(
                "No se puede publicar",
                code="incomplete_material",
                extra={"missing": gaps},
            )
        material.published_at = catalog.now_utc()
        material.archived_at = None

    if body.status == "archived":
        material.archived_at = catalog.now_utc()

    if body.status == "draft":
        material.published_at = None
        material.archived_at = None

    material.state = catalog.state_of(body.status)

    await catalog.record_history(
        session,
        material=material,
        action="status_changed",
        actor_id=context.user_id,
        detail={"from": previous, "to": body.status},
    )
    event_type = {
        "published": "material.published",
        "archived": "material.archived",
        "draft": "material.unpublished",
        "review": "material.reviewed",
    }.get(body.status, "material.status_changed")
    await catalog.record_audit(
        session,
        event_type=event_type,
        actor_id=context.user_id,
        actor_name=await _actor_name(session, context.user_id),
        subject_type="material",
        subject_id=material.id,
        level="info",
        detail={"code": material.ref, "from": previous, "to": body.status},
    )

    await session.commit()
    return await _detail(session, await _load_material(session, material.id))


@router.post("/catalog/{material_id}/schools", response_model=MaterialDetail)
async def grant_material_schools(
    material_id: uuid.UUID,
    body: SetSchoolsRequest,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetail:
    """Give access to a material to more schools.

    Nobody loses access here: the schools that already had it keep it.
    It is what the panel does when the platform team enables a piece
    for several schools at once.
    """
    material = await _load_material(session, material_id)

    current_rows = await session.execute(
        select(MaterialSchool.school_id).where(MaterialSchool.material_id == material.id)
    )
    current_ids = [school_id for (school_id,) in current_rows.all()]

    await _replace_schools(
        session,
        material=material,
        wanted=[*current_ids, *body.school_ids],
        confirm=body.confirm,
        actor_id=context.user_id,
    )
    await session.commit()
    return await _detail(session, await _load_material(session, material.id))


@router.put("/catalog/{material_id}/schools", response_model=MaterialDetail)
async def set_material_schools(
    material_id: uuid.UUID,
    body: SetSchoolsRequest,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetail:
    """Replace the schools that can see a material.

    The operation is idempotent: only the difference is written to the
    history. A published material that loses a school asks for a
    confirmation first, and the answer says which schools are affected.
    """
    material = await _load_material(session, material_id)

    await _replace_schools(
        session,
        material=material,
        wanted=body.school_ids,
        confirm=body.confirm,
        actor_id=context.user_id,
    )
    await session.commit()
    return await _detail(session, await _load_material(session, material.id))


async def _replace_schools(
    session: AsyncSession,
    *,
    material: Material,
    wanted: list[uuid.UUID],
    confirm: bool,
    actor_id: uuid.UUID | None,
) -> None:
    """Write the access of a material: the schools that change, and only those."""
    wanted = list(dict.fromkeys(wanted))
    known_schools: list[School] = []
    if wanted:
        result = await session.execute(select(School).where(School.id.in_(wanted)))
        known_schools = list(result.scalars().all())
        known_ids = {school.id for school in known_schools}
        unknown = [str(school_id) for school_id in wanted if school_id not in known_ids]
        if unknown:
            raise ValidationError(
                "Some schools do not exist.",
                code="unknown_schools",
                extra={"unknown_school_ids": unknown},
            )

    current_rows = await session.execute(
        select(School, MaterialSchool)
        .join(MaterialSchool, MaterialSchool.school_id == School.id)
        .where(MaterialSchool.material_id == material.id)
    )
    # The rows keep the history of the access: a school that lost the
    # access is archived, not forgotten. The result is read once: the
    # rows are the access of each school, with the flag that says
    # whether it is still on.
    access_rows = current_rows.all()
    access_by_school = {school.id: access for school, access in access_rows}
    current = {school.id: school for school, access in access_rows if access.enabled}

    added = [school for school in known_schools if school.id not in current]
    removed = [school for school in current.values() if school.id not in set(wanted)]

    if removed and catalog.status_of(material.state) == "published" and not confirm:
        raise ConflictError(
            f"Se quitará el acceso de {len(removed)} colegio(s). ¿Confirmas?",
            code="access_revoked",
            extra={"affected": [{"id": str(school.id), "name": school.name} for school in removed]},
        )

    if removed and catalog.status_of(material.state) == "published" and not wanted:
        raise ValidationError(
            "A published material needs at least one school with access.",
            code="no_schools_left",
            extra={"missing": ["schools"]},
        )

    for school in removed:
        await session.execute(
            update(MaterialSchool)
            .where(
                MaterialSchool.material_id == material.id,
                MaterialSchool.school_id == school.id,
            )
            .values(enabled=False, archived_at=catalog.now_utc())
        )

    for school in added:
        archived = access_by_school.get(school.id)
        if archived is not None:
            # The school had the access and lost it: the row comes
            # back, with its history.
            await session.execute(
                update(MaterialSchool)
                .where(MaterialSchool.id == archived.id)
                .values(
                    enabled=True,
                    archived_at=None,
                    enabled_at=catalog.now_utc(),
                    enabled_by=actor_id,
                )
            )
            continue
        session.add(
            MaterialSchool(
                material_id=material.id,
                school_id=school.id,
                enabled=True,
                enabled_by=actor_id,
            )
        )

    if added or removed:
        await catalog.record_history(
            session,
            material=material,
            action="access_changed",
            actor_id=actor_id,
            detail={
                "added": [{"id": str(school.id), "name": school.name} for school in added],
                "removed": [{"id": str(school.id), "name": school.name} for school in removed],
            },
        )

    actor_name = await _actor_name(session, actor_id)
    for school in added:
        await catalog.record_audit(
            session,
            event_type="school.access_granted",
            actor_id=actor_id,
            actor_name=actor_name,
            school_id=school.id,
            subject_type="material",
            subject_id=material.id,
            detail={"code": material.ref, "school": school.name},
        )
    for school in removed:
        await catalog.record_audit(
            session,
            event_type="school.access_revoked",
            actor_id=actor_id,
            actor_name=actor_name,
            school_id=school.id,
            subject_type="material",
            subject_id=material.id,
            level="warning",
            detail={"code": material.ref, "school": school.name},
        )


@router.delete("/catalog/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material(
    material_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a material.

    Only a draft can be deleted: a published piece stays in the
    history, and an archived one is desarchived instead.
    """
    material = await _load_material(session, material_id)
    if catalog.status_of(material.state) != "draft":
        raise ConflictError(
            "Only a draft can be deleted.",
            code="not_deletable",
            extra={"status": catalog.status_of(material.state)},
        )

    for file in material.files:
        # The object of the storage may already be gone, and a draft
        # that cannot reach the storage is still a draft: the row goes
        # away either way.
        with suppress(ServiceUnavailableError):
            await get_storage().delete(key=file.storage_key)

    await session.delete(material)
    await catalog.record_audit(
        session,
        event_type="material.deleted",
        actor_id=context.user_id,
        actor_name=await _actor_name(session, context.user_id),
        subject_type="material",
        subject_id=material_id,
        level="warning",
        detail={"code": material.ref, "title": material.title},
    )
    await session.commit()


# ---------------------------------------------------------------------------
# The uploads
# ---------------------------------------------------------------------------


@router.post("/uploads", response_model=UploadResponse)
async def upload_file(
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File()],
) -> UploadResponse:
    """Upload a file of the catalog.

    The format and the size are checked against the format, and the
    digest of the content tells whether the file is already in the
    catalog.
    """
    file_name = file.filename or "archivo"
    mime_type = catalog.mime_type_of(file_name, file.content_type)
    if mime_type not in catalog.ALLOWED_MIME_TYPES:
        raise ValidationError(
            "That format is not admitted by the catalog. Use PDF, EPUB, DOCX, MP4 or ZIP.",
            code="invalid_format",
            extra={"file_name": file_name},
        )

    limit = catalog.size_limit_for(mime_type)
    content = await file.read()
    if len(content) > limit:
        raise ValidationError(
            f"The file is larger than the {limit // (1024 * 1024)} MB limit of {mime_type}.",
            code="file_too_large",
            extra={"file_name": file_name, "limit_bytes": limit},
        )

    digest = hashlib.sha256(content).hexdigest()
    duplicate = await catalog.find_duplicate(session, digest)
    if duplicate is not None:
        owner = (
            await catalog.get_material(session, duplicate.material_id)
            if duplicate.material_id
            else None
        )
        return UploadResponse(
            file_id=duplicate.id,
            file_name=duplicate.file_name,
            size_bytes=duplicate.size_bytes,
            size_label=catalog.format_size(duplicate.size_bytes),
            mime_type=duplicate.mime_type,
            duplicate_of={
                "id": str(owner.id) if owner else "",
                "code": owner.ref if owner else "",
            },
        )

    storage_key = build_storage_key(file_name=file_name)
    await get_storage().save(key=storage_key, content=content, content_type=mime_type)

    uploaded = MaterialFile(
        storage_key=storage_key,
        file_name=file_name,
        mime_type=mime_type,
        size_bytes=len(content),
        is_primary=False,
        content_hash=digest,
        uploaded_by=context.user_id,
    )
    session.add(uploaded)
    await session.commit()

    return UploadResponse(
        file_id=uploaded.id,
        file_name=uploaded.file_name,
        size_bytes=uploaded.size_bytes,
        size_label=catalog.format_size(uploaded.size_bytes),
        mime_type=uploaded.mime_type,
    )


@router.get("/files/{file_id}")
async def download_file(
    file_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """The content of a file of the catalog.

    The file is served by the API: the catalog keeps the key of the
    object and never a public address, so the copy that is downloaded
    is the one the platform team uploaded.
    """
    stored = await session.get(MaterialFile, file_id)
    if stored is None:
        raise NotFoundError("The file does not exist.")

    try:
        content = await get_storage().read(key=stored.storage_key)
    except FileNotFoundError as error:
        raise NotFoundError("The file is not in the storage.") from error

    name = stored.file_name.replace('"', "'").replace("\n", " ").replace("\r", " ")
    return Response(
        content=content,
        media_type=stored.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.delete("/uploads/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_upload(
    file_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a file that was uploaded and is not part of a material yet."""
    uploaded = await session.get(MaterialFile, file_id)
    if uploaded is None:
        raise NotFoundError("The uploaded file does not exist.")
    if uploaded.material_id is not None:
        raise ConflictError(
            "That file already belongs to a material.",
            code="file_already_attached",
        )

    with suppress(ServiceUnavailableError):
        await get_storage().delete(key=uploaded.storage_key)
    await session.delete(uploaded)
    await session.commit()


# ---------------------------------------------------------------------------
# The schools and the audit trail
# ---------------------------------------------------------------------------


@router.get("/schools", response_model=SchoolPage)
async def list_schools(
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=120)] = None,
    plan: Annotated[str | None, Query(max_length=64)] = None,
    status: Annotated[str | None, Query(max_length=16)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=catalog.MAX_PER_PAGE)] = catalog.DEFAULT_PER_PAGE,
) -> SchoolPage:
    """The schools of the network, with how much of the catalog they see."""
    rows, total = await catalog.list_schools(
        session,
        query=q,
        plan=plan,
        status=status,
        page=page,
        per_page=per_page,
    )
    return SchoolPage(
        items=[SchoolSummary.model_validate(row) for row in rows],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/schools/{school_id}", response_model=SchoolDetail)
async def read_school(
    school_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolDetail:
    """One school with its figures and its coverage of the catalog.

    The drawer of the school lists the whole catalog and says, piece
    by piece, whether the school can see it.
    """
    school = await session.get(School, school_id)
    if school is None:
        raise NotFoundError("The school does not exist.")

    figures = await catalog.school_figures(session, [school.id])
    row = figures.get(school.id, {})
    total = await catalog.total_materials(session)
    access = await catalog.school_catalog_access(session, school.id)

    return SchoolDetail(
        id=school.id,
        name=school.name,
        short_code=school.short_code,
        city=school.city,
        status=school.status,
        plan=row.get("plan"),
        students=row.get("students", 0),
        teachers=row.get("teachers", 0),
        covered=row.get("covered", 0),
        total=total,
        catalog=[SchoolCatalogItem(**item) for item in access],
    )


@router.put("/schools/{school_id}/materials/{material_id}", response_model=SchoolDetail)
async def set_school_material_access(
    school_id: uuid.UUID,
    material_id: uuid.UUID,
    body: SchoolMaterialAccessRequest,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolDetail:
    """Enable or disable one material for one school.

    It is the switch of the sheet of a school: the piece enters or
    leaves the catalog the institution sees. A published piece that
    leaves a school asks for a confirmation first.
    """
    school = await session.get(School, school_id)
    if school is None:
        raise NotFoundError("The school does not exist.")
    material = await _load_material(session, material_id)

    current_rows = await session.execute(
        select(MaterialSchool.school_id).where(MaterialSchool.material_id == material.id)
    )
    current = [school_id for (school_id,) in current_rows.all()]

    wanted = [*current, school_id] if body.enabled else [id for id in current if id != school_id]
    await _replace_schools(
        session,
        material=material,
        wanted=wanted,
        confirm=body.confirm,
        actor_id=context.user_id,
    )
    await session.commit()

    refreshed = await session.get(School, school_id)
    assert refreshed is not None
    figures = await catalog.school_figures(session, [refreshed.id])
    row = figures.get(refreshed.id, {})
    total = await catalog.total_materials(session)
    access = await catalog.school_catalog_access(session, refreshed.id)

    return SchoolDetail(
        id=refreshed.id,
        name=refreshed.name,
        short_code=refreshed.short_code,
        city=refreshed.city,
        status=refreshed.status,
        plan=row.get("plan"),
        students=row.get("students", 0),
        teachers=row.get("teachers", 0),
        covered=row.get("covered", 0),
        total=total,
        catalog=[SchoolCatalogItem(**item) for item in access],
    )


@router.get("/audit", response_model=AuditPage)
async def read_audit(
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
    level: Annotated[str | None, Query(max_length=16)] = None,
    school_id: Annotated[uuid.UUID | None, Query()] = None,
    event_type: Annotated[str | None, Query(max_length=64)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=catalog.MAX_PER_PAGE)] = catalog.DEFAULT_PER_PAGE,
) -> AuditPage:
    """The audit trail of the critical events."""
    entries, total = await catalog.list_audit(
        session,
        level=level,
        school_id=school_id,
        event_type=event_type,
        page=page,
        per_page=per_page,
    )
    return AuditPage(
        items=[
            AuditEntryOut(
                id=entry.id,
                event_type=entry.event_type,
                level=entry.level,
                actor_id=entry.actor_id,
                actor_name=entry.actor_name,
                school_id=entry.school_id,
                subject_type=entry.subject_type,
                subject_id=entry.subject_id,
                detail=entry.detail,
                created_at=entry.created_at,
            )
            for entry in entries
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


__all__ = ["router"]
