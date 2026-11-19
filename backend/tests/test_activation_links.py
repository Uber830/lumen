"""The activation link an admin shares with an invited member.

The admin creates a teacher or a student and the API mails them a link to
set their password. The link is not stored in readable form: it is
rotated every time the admin asks for it, so the previous one stops
working and there is nothing to read in the database.

These run against a real Postgres (see the fixtures in conftest.py).
They are skipped when no database is configured.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from tests.academic_helpers import SchoolFixture, seed_school_with_members
from tests.conftest import mint_token

pytestmark = pytest.mark.usefixtures("cleanup_users")


def _auth(user_id: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {mint_token(str(user_id))}"}


async def _invite_teacher(client, school: SchoolFixture, email: str) -> dict[str, Any]:
    """Invite a teacher to the school and return the invitation body."""
    response = client.post(
        "/v1/users/invitations",
        headers=_auth(school.admin_id),
        json={"email": email, "full_name": "Pending Teacher", "role": "teacher"},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _member(client, school: SchoolFixture, user_id: uuid.UUID) -> dict[str, Any]:
    """One member of the school, as the admin sees them."""
    response = client.get("/v1/academics/members", headers=_auth(school.admin_id))
    assert response.status_code == 200, response.text
    for member in response.json():
        if member["user_id"] == str(user_id):
            return member
    raise AssertionError("the member is not in the list")


async def test_the_member_list_does_not_carry_the_link(client, session_factory):
    """The link is not kept, so there is nothing for the list to show."""
    school = await seed_school_with_members(session_factory)
    invitation = await _invite_teacher(client, school, "pending-link@example.com")

    member = await _member(client, school, uuid.UUID(invitation["user_id"]))

    assert member["account_activated"] is False
    assert "activation_token" not in member


async def test_the_admin_can_issue_a_new_link(client, session_factory):
    """A new link is issued on demand, for a member that never activated."""
    school = await seed_school_with_members(session_factory)
    invitation = await _invite_teacher(client, school, "pending-renew@example.com")

    response = client.post(
        f"/v1/users/memberships/{invitation['membership_id']}/activation-link",
        headers=_auth(school.admin_id),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["activation_token"]
    assert body["activation_token"] != invitation["activation_token"]

    # And it works: the member can set their password with it.
    activate = client.post(
        "/v1/auth/reset-password",
        json={"token": body["activation_token"], "password": "a chosen password"},
    )
    assert activate.status_code == 200, activate.text


async def test_the_previous_link_stops_working(client, session_factory):
    """The link is rotated: the one the admin shared first is dead."""
    school = await seed_school_with_members(session_factory)
    invitation = await _invite_teacher(client, school, "pending-rotate@example.com")

    response = client.post(
        f"/v1/users/memberships/{invitation['membership_id']}/activation-link",
        headers=_auth(school.admin_id),
    )
    assert response.status_code == 201, response.text

    # The first link (the one that was mailed) no longer works.
    stale = client.post(
        "/v1/auth/reset-password",
        json={"token": invitation["activation_token"], "password": "a chosen password"},
    )
    assert stale.status_code == 401, stale.text


async def test_the_link_stops_working_once_the_account_is_activated(client, session_factory):
    """A redeemed link cannot be used a second time."""
    school = await seed_school_with_members(session_factory)
    invitation = await _invite_teacher(client, school, "pending-done@example.com")

    activate = client.post(
        "/v1/auth/reset-password",
        json={"token": invitation["activation_token"], "password": "a chosen password"},
    )
    assert activate.status_code == 200, activate.text

    member = await _member(client, school, uuid.UUID(invitation["user_id"]))
    assert member["account_activated"] is True

    again = client.post(
        "/v1/auth/reset-password",
        json={"token": invitation["activation_token"], "password": "another password"},
    )
    assert again.status_code == 401, again.text


async def test_the_new_link_lives_longer_than_a_password_reset(client, session_factory):
    """An activation link is not lost after an hour: the member may take a day."""
    school = await seed_school_with_members(session_factory)
    invitation = await _invite_teacher(client, school, "pending-ttl@example.com")

    response = client.post(
        f"/v1/users/memberships/{invitation['membership_id']}/activation-link",
        headers=_auth(school.admin_id),
    )
    assert response.status_code == 201, response.text

    expires_at = datetime.fromisoformat(response.json()["expires_at"])
    assert expires_at > datetime.now(UTC) + timedelta(days=1)


async def test_no_new_link_for_an_account_that_is_already_active(client, session_factory):
    """An active account has no activation link to issue."""
    school = await seed_school_with_members(session_factory)
    invitation = await _invite_teacher(client, school, "pending-active@example.com")

    activate = client.post(
        "/v1/auth/reset-password",
        json={"token": invitation["activation_token"], "password": "a chosen password"},
    )
    assert activate.status_code == 200, activate.text

    response = client.post(
        f"/v1/users/memberships/{invitation['membership_id']}/activation-link",
        headers=_auth(school.admin_id),
    )
    assert response.status_code == 409


async def test_only_an_admin_can_issue_a_link(client, session_factory):
    """A teacher cannot mint an activation link for somebody."""
    school = await seed_school_with_members(session_factory)
    invitation = await _invite_teacher(client, school, "pending-teacher@example.com")

    response = client.post(
        f"/v1/users/memberships/{invitation['membership_id']}/activation-link",
        headers=_auth(school.teacher_id),
    )
    assert response.status_code == 403


async def test_a_link_for_a_member_of_another_school_is_not_found(client, session_factory):
    """The membership has to belong to the admin's own school."""
    school = await seed_school_with_members(session_factory)
    other = await seed_school_with_members(session_factory, prefix="OT")
    invitation = await _invite_teacher(client, other, "pending-other@example.com")

    response = client.post(
        f"/v1/users/memberships/{invitation['membership_id']}/activation-link",
        headers=_auth(school.admin_id),
    )
    assert response.status_code == 404
