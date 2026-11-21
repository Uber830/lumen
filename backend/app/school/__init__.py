"""The school administrator's API.

The panel of a school is served from here: `/v1/school`. The prefix is
the one the project already uses (`/v1/...`), not the `/api/school`
of the design document.

Every endpoint of this module works on **the caller's own school**.
The `school_id` is never read from the request: it is deduced from
the session token, and a caller that asks about another school gets a
404, not a 403, so the endpoints cannot be used to find out which
schools exist.

This first module carries the context of the administrator:

- `GET /v1/school/me`: who the caller is, which school it
  administers, its rank, and the permissions that come with it.
"""

from __future__ import annotations

from app.school.router import router

__all__ = ["router"]
