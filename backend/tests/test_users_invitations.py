"""User invitation endpoint tests.

These run against a real Postgres (see the fixtures in conftest.py).
They are skipped when no database is configured.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Profile
from tests.conftest import TEST_USER_ID

pytestmark = pytest.mark.usefixtures("cleanup_users")


def test_invitation_creates_user_when_admin(client, auth_header, seeded_school):
    """A school_admin can invite a new teacher to their school."""
    response = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={
            "email": "newteacher@example.com",
            "full_name": "New Teacher",
            "role": "teacher",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "newteacher@example.com"
    assert body["role"] == "teacher"
    assert body["school_id"] == str(seeded_school)
    assert body["user_id"]
    assert body["membership_id"]


def test_invitation_rejects_duplicate_email(client, auth_header, seeded_school):
    """Re-inviting an existing email returns 409."""
    payload = {
        "email": "taken@example.com",
        "full_name": "Taken",
        "role": "teacher",
    }
    first = client.post("/v1/users/invitations", headers=auth_header, json=payload)
    assert first.status_code == 201, first.text

    second = client.post("/v1/users/invitations", headers=auth_header, json=payload)
    assert second.status_code == 409


def test_invitation_returns_an_activation_token(client, auth_header, seeded_school):
    """The invitation response carries a token the new user redeems."""
    response = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={
            "email": "activate@example.com",
            "full_name": "To Activate",
            "role": "teacher",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["activation_token"]


def test_invited_teacher_can_activate_and_log_in(client, auth_header, seeded_school):
    """The full loop: invite a teacher, activate with the token, log in.

    This is the gap the admin flow had: an invited user is created with
    no password and could never sign in. The activation token lets them
    set their first password and get in.
    """
    email = "newteacher-login@example.com"

    invite = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={"email": email, "full_name": "New Teacher", "role": "teacher"},
    )
    assert invite.status_code == 201, invite.text
    token = invite.json()["activation_token"]
    assert token

    # Before activation, the account has no password and cannot log in.
    before = client.post(
        "/v1/auth/login",
        json={"email": email, "password": "a chosen password"},
    )
    assert before.status_code == 401

    # Redeem the activation token to set the first password.
    activate = client.post(
        "/v1/auth/reset-password",
        json={"token": token, "password": "a chosen password"},
    )
    assert activate.status_code == 200, activate.text

    # Now the teacher can log in.
    after = client.post(
        "/v1/auth/login",
        json={"email": email, "password": "a chosen password"},
    )
    assert after.status_code == 200, after.text
    assert after.json()["tokens"]["access_token"]


def test_invitation_validates_payload(client, auth_header):
    """Bad payload returns 422 with validation error."""
    response = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={
            "email": "not-an-email",
            "full_name": "",
            "role": "wizard",
        },
    )
    assert response.status_code == 422


async def test_invitation_forbidden_when_not_school_admin(
    client, auth_header, engine, seeded_school
):
    """A teacher cannot invite new users."""
    from sqlalchemy import update

    from app.db.enums import SchoolRole
    from app.db.models import SchoolMembership

    # Demote the seeded admin to teacher. The change is committed so
    # the API (which reads through its own connection) sees it.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            update(SchoolMembership)
            .where(
                SchoolMembership.user_id == uuid.UUID(TEST_USER_ID),
                SchoolMembership.school_id == seeded_school,
            )
            .values(role=SchoolRole.TEACHER)
        )
        await session.commit()

    response = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={
            "email": "new@example.com",
            "full_name": "New",
            "role": "student",
        },
    )
    assert response.status_code == 403


async def test_invitation_forbidden_without_membership(client, auth_header, engine):
    """A user with no membership cannot invite anyone."""
    from sqlalchemy import delete

    from app.db.models import SchoolMembership

    # Revoke every membership the test user has.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            delete(SchoolMembership).where(SchoolMembership.user_id == uuid.UUID(TEST_USER_ID))
        )
        await session.commit()

    response = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={
            "email": "new@example.com",
            "full_name": "New",
            "role": "student",
        },
    )
    assert response.status_code == 403


def test_bulk_upload_creates_all_users(client, auth_header, seeded_school):
    """A school_admin can bulk-upload multiple teachers at once."""
    response = client.post(
        "/v1/users/bulk-upload",
        headers=auth_header,
        json={
            "invitations": [
                {"email": "t1@example.com", "full_name": "Teacher One", "role": "teacher"},
                {"email": "t2@example.com", "full_name": "Teacher Two", "role": "teacher"},
                {"email": "t3@example.com", "full_name": "Teacher Three", "role": "teacher"},
            ]
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert len(body["created"]) == 3
    assert body["failures"] == []
    emails = sorted(c["email"] for c in body["created"])
    assert emails == ["t1@example.com", "t2@example.com", "t3@example.com"]


async def test_bulk_upload_partial_failure_returns_per_row_errors(
    client, auth_header, engine, seeded_school
):
    """If one row fails (e.g. duplicate email), the rest still run."""
    from app.db.models import User

    # Seed one of the three emails so the second row collides. The
    # row is committed so the API (a separate connection) sees it.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            User(
                id=uuid.uuid4(),
                email="t2@example.com",
                password_hash="",
                full_name="Existing",
            )
        )
        await session.commit()

    response = client.post(
        "/v1/users/bulk-upload",
        headers=auth_header,
        json={
            "invitations": [
                {"email": "t1@example.com", "full_name": "Teacher One", "role": "teacher"},
                {"email": "t2@example.com", "full_name": "Teacher Two", "role": "teacher"},
                {"email": "t3@example.com", "full_name": "Teacher Three", "role": "teacher"},
            ]
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert len(body["created"]) == 2
    assert len(body["failures"]) == 1
    assert body["failures"][0]["email"] == "t2@example.com"
    assert "already exists" in body["failures"][0]["error"]


def test_bulk_upload_empty_list_returns_422(client, auth_header):
    """An empty invitations array is rejected."""
    response = client.post(
        "/v1/users/bulk-upload",
        headers=auth_header,
        json={"invitations": []},
    )
    assert response.status_code == 422


def test_bulk_upload_rejects_duplicate_email_within_the_file(client, auth_header, seeded_school):
    """Two rows with the same email: the first wins, the second fails.

    The duplicate is caught before it reaches the database, so it does
    not abort the batch it rides in.
    """
    response = client.post(
        "/v1/users/bulk-upload",
        headers=auth_header,
        json={
            "invitations": [
                {"email": "dup@example.com", "full_name": "First", "role": "teacher"},
                {"email": "DUP@example.com", "full_name": "Second", "role": "teacher"},
                {"email": "unique@example.com", "full_name": "Third", "role": "teacher"},
            ]
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert len(body["created"]) == 2
    assert len(body["failures"]) == 1
    assert body["failures"][0]["email"] == "DUP@example.com"
    assert body["failures"][0]["index"] == "1"
    assert "Duplicate" in body["failures"][0]["error"]
    created_emails = sorted(c["email"] for c in body["created"])
    assert created_emails == ["dup@example.com", "unique@example.com"]


def test_bulk_upload_handles_more_rows_than_one_batch(client, auth_header, seeded_school):
    """A load larger than the batch size still creates every row.

    This crosses the _BULK_BATCH_SIZE boundary (multiple commits), so
    it exercises the batching loop rather than a single batch.
    """
    count = 120
    invitations = [
        {"email": f"bulk{i}@example.com", "full_name": f"Teacher {i}", "role": "teacher"}
        for i in range(count)
    ]

    response = client.post(
        "/v1/users/bulk-upload",
        headers=auth_header,
        json={"invitations": invitations},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert len(body["created"]) == count
    assert body["failures"] == []
    assert len({c["email"] for c in body["created"]}) == count


async def test_bulk_upload_failure_in_one_batch_does_not_lose_other_batches(
    client, auth_header, engine, seeded_school
):
    """A conflict in a later batch leaves earlier batches committed.

    Seed a duplicate that lands past the first batch boundary and
    confirm the rows around it (and in other batches) still persist.
    """
    from app.db.models import User

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            User(
                id=uuid.uuid4(),
                email="batchdup@example.com",
                password_hash="",
                full_name="Existing",
            )
        )
        await session.commit()

    count = 80
    invitations = [
        {"email": f"batch{i}@example.com", "full_name": f"Teacher {i}", "role": "teacher"}
        for i in range(count)
    ]
    # Drop the collision at index 60, which is in the second batch.
    invitations[60] = {
        "email": "batchdup@example.com",
        "full_name": "Collides",
        "role": "teacher",
    }

    response = client.post(
        "/v1/users/bulk-upload",
        headers=auth_header,
        json={"invitations": invitations},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert len(body["created"]) == count - 1
    assert len(body["failures"]) == 1
    assert body["failures"][0]["email"] == "batchdup@example.com"
    assert body["failures"][0]["index"] == "60"


async def test_created_user_has_a_profile(
    client, auth_header, db_session: AsyncSession, seeded_school
):
    """An invitation creates the profile row alongside the user."""
    response = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={
            "email": "profiled@example.com",
            "full_name": "Profiled",
            "role": "student",
        },
    )
    assert response.status_code == 201, response.text
    user_id = uuid.UUID(response.json()["user_id"])

    profile = await db_session.execute(select(Profile).where(Profile.id == user_id))
    assert profile.scalar_one_or_none() is not None


def test_invited_user_email_is_normalized(client, auth_header, seeded_school):
    """Emails are stored lowercased so logins are case-insensitive."""
    response = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={
            "email": "MixedCase@Example.COM",
            "full_name": "Mixed",
            "role": "student",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["email"] == "mixedcase@example.com"


# ---------------------------------------------------------------------------
# Membership management: activate / deactivate
# ---------------------------------------------------------------------------


def _invite_teacher(client, auth_header, email: str) -> dict[str, Any]:
    """Invite a teacher and return the parsed response."""
    response = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={"email": email, "full_name": "A Teacher", "role": "teacher"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_members_list_reports_activation_state(client, auth_header, seeded_school):
    """A freshly invited teacher shows as not-yet-activated and active."""
    _invite_teacher(client, auth_header, "state@example.com")

    members = client.get("/v1/academics/members", headers=auth_header, params={"role": "teacher"})
    assert members.status_code == 200, members.text
    row = next(m for m in members.json() if m["full_name"] == "A Teacher")
    assert row["account_activated"] is False
    assert row["revoked_at"] is None


def test_deactivate_and_reactivate_a_teacher(client, auth_header, seeded_school):
    """Deactivating hides the teacher; reactivating brings them back."""
    invited = _invite_teacher(client, auth_header, "toggle@example.com")
    membership_id = invited["membership_id"]

    # Deactivate.
    off = client.patch(
        f"/v1/users/memberships/{membership_id}",
        headers=auth_header,
        json={"revoked": True},
    )
    assert off.status_code == 200, off.text
    assert off.json()["revoked"] is True

    # The default members list no longer shows them.
    active = client.get("/v1/academics/members", headers=auth_header, params={"role": "teacher"})
    assert all(m["membership_id"] != membership_id for m in active.json())

    # But include_revoked shows them as revoked.
    allrows = client.get(
        "/v1/academics/members",
        headers=auth_header,
        params={"role": "teacher", "include_revoked": "true"},
    )
    revoked_row = next(m for m in allrows.json() if m["membership_id"] == membership_id)
    assert revoked_row["revoked_at"] is not None

    # Reactivate.
    on = client.patch(
        f"/v1/users/memberships/{membership_id}",
        headers=auth_header,
        json={"revoked": False},
    )
    assert on.status_code == 200, on.text
    assert on.json()["revoked"] is False

    back = client.get("/v1/academics/members", headers=auth_header, params={"role": "teacher"})
    assert any(m["membership_id"] == membership_id for m in back.json())


async def _own_membership_id(engine, school_id) -> str:
    """The acting test user's membership id in the school."""
    from app.db.models import SchoolMembership

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        result = await session.execute(
            select(SchoolMembership).where(
                SchoolMembership.user_id == uuid.UUID(TEST_USER_ID),
                SchoolMembership.school_id == school_id,
            )
        )
        return str(result.scalar_one().id)


async def test_admin_cannot_deactivate_their_own_membership(
    client, auth_header, engine, seeded_school
):
    """The acting admin cannot revoke themselves."""
    membership_id = await _own_membership_id(engine, seeded_school)

    response = client.patch(
        f"/v1/users/memberships/{membership_id}",
        headers=auth_header,
        json={"revoked": True},
    )
    assert response.status_code == 409
    assert "your own" in response.json()["detail"].lower()


async def test_cannot_deactivate_the_last_admin(client, auth_header, engine, seeded_school):
    """The last remaining admin cannot be deactivated.

    After the acting admin revokes a second admin, they are the only
    admin left; the self-guard then also prevents removing the last one.
    """
    second = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={"email": "admin2@example.com", "full_name": "Admin Two", "role": "school_admin"},
    )
    assert second.status_code == 201, second.text

    # Allowed: the actor remains as an admin.
    off = client.patch(
        f"/v1/users/memberships/{second.json()['membership_id']}",
        headers=auth_header,
        json={"revoked": True},
    )
    assert off.status_code == 200, off.text

    # The actor is now the last admin; revoking themselves is refused.
    membership_id = await _own_membership_id(engine, seeded_school)
    response = client.patch(
        f"/v1/users/memberships/{membership_id}",
        headers=auth_header,
        json={"revoked": True},
    )
    assert response.status_code == 409


async def test_update_membership_requires_admin(client, auth_header, engine, seeded_school):
    """A non-admin cannot manage memberships."""
    from sqlalchemy import update

    from app.db.enums import SchoolRole
    from app.db.models import SchoolMembership

    invited = client.post(
        "/v1/users/invitations",
        headers=auth_header,
        json={"email": "victim@example.com", "full_name": "Victim", "role": "teacher"},
    )
    assert invited.status_code == 201, invited.text
    membership_id = invited.json()["membership_id"]

    # Demote the acting user to teacher and commit so the API sees it.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await session.execute(
            update(SchoolMembership)
            .where(
                SchoolMembership.user_id == uuid.UUID(TEST_USER_ID),
                SchoolMembership.school_id == seeded_school,
            )
            .values(role=SchoolRole.TEACHER)
        )
        await session.commit()

    response = client.patch(
        f"/v1/users/memberships/{membership_id}",
        headers=auth_header,
        json={"revoked": True},
    )
    assert response.status_code == 403
