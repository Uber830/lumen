"""Files router: the uploads of the app and their download.

The files live on the disk of the server (see `app/core/storage.py`).
This router is the door: the browser sends a file to it and it gives
back the path, and it serves the files back to whoever is allowed to
see them.

The rules of access are the ones the buckets had:

- the avatars and the shields of the schools are public;
- the material of a class and the deliveries of a task belong to the
  school: only its members may read them, and a delivery only its
  owner and the teachers of the school.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import optional_current_user
from app.core import storage
from app.core.context import RequestContext, load_context
from app.core.errors import NotFoundError
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context

router = APIRouter(prefix="/v1/files", tags=["files"])


async def optional_context(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[object, Depends(optional_current_user)],
) -> RequestContext | None:
    """The context of the caller, when the request carries a session."""
    if user is None:
        return None
    return await load_context(
        session,
        user_id=uuid.UUID(user.user_id),  # type: ignore[attr-defined]
        email=user.email,  # type: ignore[attr-defined]
    )


# The biggest file the app accepts (50 MB).
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

# The buckets anyone can read.
PUBLIC_BUCKETS = ("avatars", "school-logos")

# The extension of a file the browser may upload.
_ALLOWED_EXTENSIONS = {
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "txt",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "mp4",
    "mp3",
    "zip",
}


def _extension_of(name: str) -> str:
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def _check_extension(name: str) -> None:
    if _extension_of(name) not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Ese tipo de archivo no se puede subir.",
        )


@router.post("/task-submissions/{task_id}")
async def upload_task_submission(
    task_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    file: Annotated[UploadFile, File()],
) -> dict[str, str]:
    """Upload the delivery of a task.

    Only a student of the school may deliver a task, and the file is
    written under their own id, so a delivery of one student is never
    the delivery of another.
    """
    membership = context.require_any_membership()
    if membership.role != SchoolRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un estudiante puede entregar una tarea.",
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el límite de 50 MB.",
        )
    _check_extension(file.filename or "")

    filename = storage.safe_name(file.filename or "archivo")
    path = storage.replace_file(
        bucket="task-submissions",
        owner=f"{membership.school_id}/{task_id}/{context.user_id}",
        filename=filename,
        content=content,
        content_type=file.content_type,
    )
    return {"path": path, "url": storage.public_path(path)}


@router.post("/class-content/{course_subject_id}")
async def upload_class_content(
    course_subject_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    file: Annotated[UploadFile, File()],
) -> dict[str, str]:
    """Upload the material of a class.

    Only a teacher of the school may upload material, and the file is
    written under the school, so every member of the school sees the
    same copy.
    """
    membership = context.require_any_membership()
    if membership.role not in (SchoolRole.TEACHER, SchoolRole.SCHOOL_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un docente puede subir material.",
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el límite de 50 MB.",
        )
    _check_extension(file.filename or "")

    filename = storage.safe_name(file.filename or "archivo")
    path = storage.replace_file(
        bucket="class-content",
        owner=f"{membership.school_id}/{course_subject_id}",
        filename=filename,
        content=content,
        content_type=file.content_type,
    )
    return {"path": path, "url": storage.public_path(path)}


@router.get("/{bucket}/{path:path}")
async def get_file(
    bucket: str,
    path: str,
    context: Annotated[RequestContext | None, Depends(optional_context)],
) -> Response:
    """Serve a file of the store.

    The avatars and the shields are public. The material of a class and
    the deliveries of a task belong to the school named in the path:
    only its members read them.
    """
    if bucket not in storage.BUCKETS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El archivo no existe.",
        )

    relative = f"{bucket}/{path}"

    if bucket not in PUBLIC_BUCKETS:
        # The file belongs to a school: only its members read it.
        if context is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Necesitás iniciar sesión para ver este archivo.",
            )
        school_id = _school_of(relative)
        if school_id is not None:
            membership = context.membership_for(school_id)
            if membership is None and not context.is_platform_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tenés acceso a este archivo.",
                )

    try:
        content = storage.read_file(relative)
    except FileNotFoundError as error:
        raise NotFoundError("El archivo no existe.") from error

    return Response(
        content=content,
        media_type=storage.content_type_for(relative),
        headers={"Cache-Control": "public, max-age=300"},
    )


def _school_of(relative: str) -> uuid.UUID | None:
    """The school a file belongs to, read from its path."""
    parts = relative.split("/")
    if len(parts) < 2:
        return None
    try:
        return uuid.UUID(parts[1])
    except ValueError:
        return None
