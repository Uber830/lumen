"""Unit tests for the Wompi webhook helpers.

The signature algorithm follows the Wompi event documentation:

1. Resolve each path in `signature.properties` inside the event's
   `data` object, in order.
2. Concatenate the values as text.
3. Concatenate the event's `timestamp`.
4. Concatenate the merchant's events secret.
5. SHA-256 the result and compare with `signature.checksum`,
   case-insensitively.
"""

from __future__ import annotations

import hashlib
from typing import Any

from app.subscriptions.webhooks import (
    _event_id,
    _reference_to_school_id,
    _verify_signature,
)

SECRET = "prod_events_7b193c8afd7b47949f90d443cb1e1742"


def _lookup(value: Any, path: str) -> Any:
    for segment in path.split("."):
        if not isinstance(value, dict) or segment not in value:
            return ""
        value = value[segment]
    return value or ""


def _sign(payload: dict[str, Any], properties: list[str], secret: str) -> str:
    """Compute the checksum the way Wompi documents it."""
    values = "".join(str(_lookup(payload.get("data", {}), path)) for path in properties)
    text = f"{values}{payload.get('timestamp', '')}{secret}"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _event(status: str = "APPROVED") -> dict[str, Any]:
    return {
        "event": "transaction.updated",
        "timestamp": 1530291411,
        "data": {
            "transaction": {
                "id": "1234-1610641025-49201",
                "status": status,
                "amount_in_cents": 4490000,
            }
        },
        "signature": {
            "properties": [
                "transaction.id",
                "transaction.status",
                "transaction.amount_in_cents",
            ],
            "checksum": "",
        },
    }


def test_verify_signature_accepts_valid():
    secret = SECRET
    payload = _event()
    properties = payload["signature"]["properties"]
    payload["signature"]["checksum"] = _sign(payload, properties, secret)
    assert _verify_signature(properties, payload["signature"]["checksum"], payload, secret)


def test_verify_signature_accepts_uppercase_checksum():
    """Wompi sends the checksum in uppercase; comparison is case-insensitive."""
    payload = _event()
    properties = payload["signature"]["properties"]
    payload["signature"]["checksum"] = _sign(payload, properties, SECRET).upper()
    assert _verify_signature(properties, payload["signature"]["checksum"], payload, SECRET)


def test_verify_signature_rejects_tampered_payload():
    payload = _event()
    properties = payload["signature"]["properties"]
    checksum = _sign(payload, properties, SECRET)
    tampered = _event(status="DECLINED")
    assert not _verify_signature(properties, checksum, tampered, SECRET)


def test_verify_signature_rejects_wrong_secret():
    payload = _event()
    properties = payload["signature"]["properties"]
    checksum = _sign(payload, properties, "secretA")
    assert not _verify_signature(properties, checksum, payload, "secretB")


def test_verify_signature_rejects_tampered_timestamp():
    """Changing the timestamp invalidates the checksum."""
    payload = _event()
    properties = payload["signature"]["properties"]
    checksum = _sign(payload, properties, SECRET)
    tampered = _event()
    tampered["timestamp"] = 9999999999
    assert not _verify_signature(properties, checksum, tampered, SECRET)


def test_verify_signature_rejects_missing_data():
    """A payload without a data object cannot be verified."""
    payload = _event()
    properties = payload["signature"]["properties"]
    checksum = _sign(payload, properties, SECRET)
    assert not _verify_signature(properties, checksum, {"timestamp": 1}, SECRET)


def test_verify_signature_handles_missing_path():
    """If a listed property is absent, the value is treated as ''."""
    secret = SECRET
    payload = {
        "timestamp": 1530291411,
        "data": {"transaction": {"id": "tx-1"}},
    }
    properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
    checksum = _sign(payload, properties, secret)
    assert _verify_signature(properties, checksum, payload, secret)


def test_event_id_is_stable():
    body = {"event": "transaction.updated", "timestamp": "2026-08-12T12:00:00Z"}
    assert _event_id(body) == "transaction.updated:2026-08-12T12:00:00Z"


def test_reference_to_school_id_parses():
    assert _reference_to_school_id("school-abc-12345-plan-basico") == "abc"
    assert _reference_to_school_id("garbage") is None
    assert _reference_to_school_id(None) is None


def test_reference_to_school_id_rejects_too_few_parts():
    assert _reference_to_school_id("school-only") is None
    assert _reference_to_school_id("school-") is None
