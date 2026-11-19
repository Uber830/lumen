"""Helpers shared by the test suite.

Nobody signs up on their own anymore: the accounts are created by the
platform team. The tests create them straight in the database, the
same way the platform module does, and sign in through the real
endpoint.
"""

from __future__ import annotations

import asyncio
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.models import Profile, User


def create_test_user(
    engine: Any,
    *,
    email: str,
    password: str,
    full_name: str = "Test User",
) -> str:
    """Create a user with a password and return its id.

    The rows are committed, because the HTTP client reads them through
    its own connection.

    The helper works both inside and outside of an event loop: a test
    that is already async cannot run a nested loop, so the work moves
    to a thread with its own.
    """
    normalized = email.strip().lower()

    async def _create() -> str:
        async with AsyncSession(bind=engine, expire_on_commit=False) as session:
            user = User(
                id=uuid.uuid4(),
                email=normalized,
                password_hash=hash_password(password),
                full_name=full_name,
                email_verified=True,
            )
            session.add(user)
            session.add(
                Profile(
                    id=user.id,
                    full_name=full_name,
                    locale="es-CO",
                )
            )
            await session.commit()
            return str(user.id)

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_create())
        finally:
            loop.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(lambda: asyncio.run(_create())).result()


def sign_in(client: Any, *, email: str, password: str) -> dict[str, Any]:
    """Sign in and return the parsed response."""
    response = client.post(
        "/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()


__all__ = [
    "create_test_user",
    "sign_in",
]
