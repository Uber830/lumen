"""Auth router: login, refresh, logout and the password flows.

These endpoints replace Supabase Auth. The frontend migrates to them
in Phase 4; until then it keeps using Supabase Auth and
`app.auth.verify_access_token` accepts both kinds of token.

The response shape is the one the frontend's `SessionContext` already
expects, so the frontend migration is a matter of swapping the
transport, not the contract.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import operations
from app.auth.attempts import (
    OUTCOME_INVALID,
    OUTCOME_LOCKED,
    OUTCOME_SUCCESS,
    count_failures,
    hash_email,
    is_locked,
    lock_account,
    record_attempt,
)
from app.auth.cookies import clear_auth_cookies, set_auth_cookies
from app.auth.dependencies import REFRESH_COOKIE
from app.auth.operations import (
    IssuedSession,
    UserSession,
    authenticate,
    find_user_by_email,
    issue_password_reset_token,
    issue_session,
    load_session_context,
    reset_password,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.auth.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    ResetPasswordRequest,
    SessionInfo,
    TokenPair,
    UpdateProfileRequest,
)
from app.config import get_settings
from app.core import supabase_storage
from app.core.admin_permissions import permissions_for
from app.core.context import RequestContext
from app.core.errors import (
    AccountLockedError,
    AuthenticationError,
    NotFoundError,
    RateLimitedError,
)
from app.core.supabase_tokens import SUPABASE_TOKEN_TTL
from app.db.enums import SchoolRole
from app.db.models import SchoolMembership
from app.db.session import get_db
from app.deps import get_context

logger = logging.getLogger("lumen.auth")

router = APIRouter(prefix="/v1/auth", tags=["auth"])


def _client_context(request: Request) -> tuple[str | None, str | None]:
    """Extract the user agent and IP address of the caller."""
    user_agent = request.headers.get("user-agent")
    forwarded = request.headers.get("x-forwarded-for")
    ip_address = forwarded.split(",")[0].strip() if forwarded else None
    return user_agent, ip_address


def _permissions_of(memberships: list[SchoolMembership]) -> list[str]:
    """The permissions of the caller's rank in its primary school.

    A teacher or a student gets an empty list: the panel of the school
    is not theirs.
    """
    if not memberships:
        return []
    primary = next((m for m in memberships if m.is_primary), None)
    membership = primary or memberships[0]
    if membership.role != SchoolRole.SCHOOL_ADMIN:
        return []
    return permissions_for(membership.admin_role)


def _session_info(context: UserSession) -> SessionInfo:
    """Turn the operation-level context into the API response shape."""
    profile = context.profile
    return SessionInfo(
        user={"id": str(context.user_id), "email": context.email},
        profile=(
            {
                "id": profile.id,
                "full_name": profile.full_name,
                "given_name": profile.given_name,
                "family_name": profile.family_name,
                "phone": profile.phone,
                "locale": profile.locale,
                "avatar_url": profile.avatar_url,
            }
            if profile is not None
            else None
        ),
        memberships=[
            {
                "id": membership.id,
                "school_id": membership.school_id,
                "role": membership.role.value,
                "admin_role": membership.admin_role.value if membership.admin_role else None,
                "is_primary": membership.is_primary,
                "joined_at": membership.joined_at,
            }
            for membership in context.memberships
        ],
        platform_role=context.platform_role,
        primary_school_id=context.primary_school_id,
        # The school's branding travels with the session: the app paints
        # itself with it on the first frame, with no flash of the default
        # theme.
        school=(
            {
                "id": context.school.id,
                "name": context.school.name,
                "display_name": context.school.display_name,
                "logo_url": context.school.logo_url,
                "primary_color": context.school.primary_color,
            }
            if context.school is not None
            else None
        ),
        # The permissions travel with the session: the panel shows and
        # disables what the rank may and may not do. A caller that is
        # not an administrator of its school gets none.
        permissions=_permissions_of(context.memberships),
        current_period=context.current_period,
    )


def _token_pair(issued: IssuedSession) -> TokenPair:
    """Turn the issued session into the token response shape."""
    # `expires_at` is absolute; the lifetime itself is a configuration
    # value, so it is read from the settings rather than derived.
    from app.config import get_settings

    return TokenPair(
        access_token=issued.access_token.access_token,
        refresh_token=issued.refresh_token,
        token_type=issued.access_token.token_type,
        expires_at=issued.access_token.expires_at,
        expires_in=get_settings().access_token_ttl_seconds,
    )


def _mint_supabase_token(user: object) -> str | None:
    """Mint the short-lived token the browser needs for Storage and Realtime.

    Returns None when the project JWT secret is not configured: the
    rest of the API keeps working, only Storage and Realtime do not.
    """
    from app.core.supabase_tokens import (
        SupabaseTokenUnavailable,
        mint_supabase_token,
    )

    try:
        return mint_supabase_token(
            user_id=user.id,  # type: ignore[attr-defined]
            email=getattr(user, "email", None),
        )
    except SupabaseTokenUnavailable:
        logger.warning(
            "SUPABASE_JWT_SECRET is not configured; Storage and Realtime "
            "will not work for this user."
        )
        return None


@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Exchange a password for a session.

    The response carries the access token, the refresh token and the
    session context (profile, memberships, platform role).

    Three things guard the door: the rate limit, the lock of the
    account and the message. The message is the same for a wrong
    password and for an email that does not exist, so this endpoint
    cannot be used to find out who has an account.
    """
    settings = get_settings()
    user_agent, ip_address = _client_context(request)
    email_hash = hash_email(body.email, settings.jwt_secret.get_secret_value())

    # The rate limit comes first: it has to stop the work, not just
    # the answer.
    failures = await count_failures(
        session,
        email_hash=email_hash,
        ip_address=ip_address,
        window=timedelta(seconds=settings.login_rate_limit_window_seconds),
    )
    if failures >= settings.login_rate_limit_attempts:
        await record_attempt(
            session,
            email_hash=email_hash,
            ip_address=ip_address,
            outcome=OUTCOME_INVALID,
        )
        await session.commit()
        retry_after = settings.login_rate_limit_window_seconds
        raise RateLimitedError(
            "Demasiados intentos.",
            extra={"retry_after": retry_after},
            headers={"Retry-After": str(retry_after)},
        )

    try:
        user = await authenticate(session, email=body.email, password=body.password)
    except AuthenticationError:
        await record_attempt(
            session,
            email_hash=email_hash,
            ip_address=ip_address,
            outcome=OUTCOME_INVALID,
        )
        await _lock_if_needed(
            session, email=body.email, email_hash=email_hash, ip_address=ip_address
        )
        await session.commit()
        raise AuthenticationError(
            "El correo o la contraseña no coinciden.",
            code="invalid_credentials",
        ) from None

    # The lock is checked after the password: answering "locked" to a
    # wrong password would confirm that the account exists.
    if is_locked(user):
        await record_attempt(
            session,
            email_hash=email_hash,
            ip_address=ip_address,
            outcome=OUTCOME_LOCKED,
        )
        await session.commit()
        raise AccountLockedError("La cuenta está bloqueada.")

    await record_attempt(
        session,
        email_hash=email_hash,
        ip_address=ip_address,
        outcome=OUTCOME_SUCCESS,
    )

    issued = await issue_session(
        session,
        user,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    await session.commit()

    set_auth_cookies(
        response,
        access_token=issued.access_token.access_token,
        refresh_token=issued.refresh_token,
        remember_me=body.remember_me,
    )

    context = await load_session_context(session, user.id)
    return AuthResponse(
        tokens=_token_pair(issued),
        session=_session_info(context),
        supabase_token=_mint_supabase_token(user),
    )


async def _lock_if_needed(
    session: AsyncSession,
    *,
    email: str,
    email_hash: str,
    ip_address: str | None,
) -> None:
    """Lock an account that failed too many times."""
    settings = get_settings()
    user = await find_user_by_email(session, email)
    if user is None or is_locked(user):
        return

    failures = await count_failures(
        session,
        email_hash=email_hash,
        ip_address=ip_address,
        window=timedelta(minutes=settings.login_lock_minutes),
    )
    if failures >= settings.login_lock_threshold:
        await lock_account(session, user, minutes=settings.login_lock_minutes)


@router.post("/refresh")
async def refresh(
    body: RefreshRequest,
    request: Request,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """Exchange a refresh token for a new pair.

    The old token is revoked. A revoked token presented again revokes
    every session of that user, because it means either a stale
    client or a replayed stolen token.

    The token comes from the body, or from the refresh cookie when the
    body is empty. The browser uses the cookie: it cannot read it.
    """
    token = body.refresh_token or request.cookies.get(REFRESH_COOKIE) or ""
    if not token:
        raise AuthenticationError("Invalid or expired refresh token.")

    user_agent, ip_address = _client_context(request)
    try:
        issued = await rotate_refresh_token(
            session,
            token,
            user_agent=user_agent,
            ip_address=ip_address,
        )
    except AuthenticationError:
        # `rotate_refresh_token` revokes every session of the user
        # when it sees a replayed token. That revocation has to be
        # committed: rolling it back would leave the stolen token
        # usable.
        await session.commit()
        raise

    await session.commit()

    set_auth_cookies(
        response,
        access_token=issued.access_token.access_token,
        refresh_token=issued.refresh_token,
    )

    context = await load_session_context(session, issued.user_id)
    return AuthResponse(
        tokens=_token_pair(issued),
        session=_session_info(context),
        supabase_token=_mint_supabase_token(await operations.get_user(session, issued.user_id)),
    )


@router.post("/logout")
async def logout(
    body: LogoutRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Revoke a refresh token.

    Logging out without a valid token is not an error: the goal is
    that the token stops working, and it already does.
    """
    if body.refresh_token:
        await revoke_refresh_token(session, body.refresh_token)
        await session.commit()
    clear_auth_cookies(response)
    return MessageResponse(message="Sesion cerrada.")


@router.get("/me")
async def me(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SessionInfo:
    """Return the session context of the caller.

    The frontend calls this on every page load to rebuild the signed-in
    state: the profile, the memberships and the platform role.
    """
    return _session_info(
        await load_session_context(session, context.user_id),
    )


@router.patch("/me")
async def update_me(
    body: UpdateProfileRequest,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SessionInfo:
    """Update the caller's profile (and optionally their email).

    Only the fields sent are changed. Changing the email to one that
    another account already uses returns 409 (the frontend turns that
    into "Ya existe una cuenta con ese correo").
    """
    changes = body.model_dump(exclude_unset=True)
    await operations.update_profile(session, context.user_id, changes)
    await session.commit()
    return _session_info(
        await load_session_context(session, context.user_id),
    )


@router.post("/me/avatar")
async def upload_avatar_me(
    file: Annotated[UploadFile, File()],
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SessionInfo:
    """Upload the caller's profile photo and store its URL.

    The browser posts the image here (multipart) and the backend writes
    it to Supabase Storage with the service-role key, then records the
    public URL on the profile. This avoids needing the browser to hold
    a Storage-signable token, which newer (ES256) Supabase projects do
    not allow the backend to mint.
    """
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded file is empty.",
        )
    avatar_url = await supabase_storage.upload_avatar(
        user_id=str(context.user_id),
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )
    await operations.update_profile(session, context.user_id, {"avatar_url": avatar_url})
    await session.commit()
    return _session_info(
        await load_session_context(session, context.user_id),
    )


@router.get("/supabase-token")
async def supabase_token(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str | None]:
    """Mint a short-lived token for Supabase Storage and Realtime.

    Storage and Realtime stay on Supabase, and their RLS policies
    call `auth.uid()`. This token carries the caller's id in the
    `sub` claim, so those policies work unchanged.

    The token is not an authentication token: the API does not accept
    it. It lasts an hour.
    """
    user = await operations.get_user(session, context.user_id)
    if user is None:
        raise NotFoundError("User not found.")

    token = _mint_supabase_token(user)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Storage and Realtime are not configured.",
        )
    return {
        "token": token,
        "expires_in": str(int(SUPABASE_TOKEN_TTL.total_seconds())),
    }


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Start the password-reset flow.

    The response is the same whether or not the email is registered:
    revealing that would turn this endpoint into an account
    enumerator.
    """
    user = await find_user_by_email(session, body.email)
    if user is not None:
        await issue_password_reset_token(session, user.id)
        await session.commit()
        # A deployment with an email provider sends the token here.
        logger.info("Password reset requested for %s", user.email)

    return MessageResponse(
        message=(
            "Si el correo esta registrado, te enviaremos un enlace para restablecer la contrasena."
        )
    )


@router.post("/reset-password")
async def reset_password_endpoint(
    body: ResetPasswordRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Set a new password with a reset token.

    Every session of the user is revoked, so a reset really does lock
    out whoever held the old password.
    """
    await reset_password(session, body.token, body.password)
    await session.commit()
    return MessageResponse(message="Contrasena actualizada.")


__all__ = ["router"]
