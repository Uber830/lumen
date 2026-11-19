"""The public router: what the landing page reads.

Everything here is public. No authentication, no tenant: the site is
the shop window of the platform.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.site.operations import build_site_response
from app.site.schemas import SiteResponse

router = APIRouter(prefix="/v1/public", tags=["public"])

# The landing changes when the platform team edits it, not every minute.
CACHE_CONTROL = "public, max-age=300"


@router.get("/site", response_model=SiteResponse)
async def site(
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SiteResponse:
    """The whole content of the public site.

    One call fills the page: the copy, the figures and the catalog all
    come from here, so the landing never waits on a second request.
    """
    payload = await build_site_response(session)
    response.headers["Cache-Control"] = CACHE_CONTROL
    return payload


__all__ = ["router"]
