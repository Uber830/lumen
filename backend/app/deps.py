"""FastAPI dependencies.

These are the building blocks every route composes:

- `get_session` — a database session for the request.
- `get_current_user` — the verified identity (from app.auth).
- `get_context` — the identity plus the caller's memberships.
- `require_school_admin` and friends — the role guards.

The role guards take the `school_id` from the *path*, never from the
body. A caller can ask about any school id; the guard looks up
whether they actually belong to it, and refuses if they do not.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, get_current_user
from app.core.context import Membership, RequestContext, load_context
from app.db.enums import SchoolRole
from app.db.session import get_db

# The session dependency. This is `app.db.session.get_db` itself, not
# a wrapper: FastAPI's dependency_overrides keys on the function
# object, so a wrapper would break the test overrides.
get_session = get_db


async def get_context(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> RequestContext:
    """Load the caller's context: identity, memberships and platform role."""
    return await load_context(
        session,
        user_id=uuid.UUID(user.user_id),
        email=user.email,
    )


async def require_school_admin(
    context: Annotated[RequestContext, Depends(get_context)],
    school_id: Annotated[uuid.UUID, Path()],
) -> Membership:
    """Require the caller to be a school_admin of the school in the path."""
    return context.require_role(school_id, SchoolRole.SCHOOL_ADMIN)


async def require_school_member(
    context: Annotated[RequestContext, Depends(get_context)],
    school_id: Annotated[uuid.UUID, Path()],
) -> Membership:
    """Require the caller to belong to the school in the path."""
    return context.require_membership(school_id)


async def require_platform_admin(
    context: Annotated[RequestContext, Depends(get_context)],
) -> RequestContext:
    """Require the caller to be a platform admin."""
    context.require_platform_admin()
    return context


__all__ = [
    "get_context",
    "get_current_user",
    "get_session",
    "require_platform_admin",
    "require_school_admin",
    "require_school_member",
]
