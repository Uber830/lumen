"""Core primitives: the permission layer, passwords, tokens and errors.

- `context`     — the RequestContext: who is calling and what they
                  may do.
- `permissions` — the permission checks (the port of the SQL helper
                  functions).
- `security`    — Argon2id password hashing.
- `tokens`      — access and refresh token issuance.
- `errors`      — the domain exception hierarchy and its HTTP mapping.
"""

from __future__ import annotations

from app.core.context import Membership, RequestContext, load_context
from app.core.errors import (
    AppError,
    AuthenticationError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.permissions import (
    has_any_school_role,
    has_school_role,
    is_course_student,
    is_course_subject_teacher,
    is_platform_admin,
    is_school_member,
    school_has_icfes,
)
from app.core.security import hash_password, needs_rehash, verify_password
from app.core.tokens import (
    IssuedToken,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_refresh_token,
)

__all__ = [
    "AppError",
    "AuthenticationError",
    "ConflictError",
    "ForbiddenError",
    "IssuedToken",
    "Membership",
    "NotFoundError",
    "RequestContext",
    "ValidationError",
    "create_access_token",
    "decode_access_token",
    "generate_refresh_token",
    "has_any_school_role",
    "has_school_role",
    "hash_password",
    "hash_refresh_token",
    "is_course_student",
    "is_course_subject_teacher",
    "is_platform_admin",
    "is_school_member",
    "load_context",
    "needs_rehash",
    "school_has_icfes",
    "verify_password",
]
