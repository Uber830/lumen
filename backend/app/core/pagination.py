"""Generic list responses.

Every list endpoint returns the same envelope, so the frontend can
paginate and count without special-casing each resource.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class Page[T](BaseModel):
    """A page of results.

    The frontend used to get everything at once from PostgREST. That
    does not scale: a school with a few thousand enrollments would
    pull the whole table into the browser. Every list endpoint is
    paginated now.
    """

    items: list[T]
    total: int = Field(description="Total number of rows matching the filter.")
    page: int = Field(ge=1, description="1-based page number.")
    page_size: int = Field(ge=1)
    pages: int = Field(ge=0, description="Total number of pages.")

    @classmethod
    def build(
        cls,
        items: list[T],
        *,
        total: int,
        page: int,
        page_size: int,
    ) -> Page[T]:
        """Build a page, computing the page count."""
        pages = (total + page_size - 1) // page_size if page_size else 0
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )


# The default and maximum page sizes.
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


__all__ = [
    "DEFAULT_PAGE_SIZE",
    "MAX_PAGE_SIZE",
    "Page",
]
