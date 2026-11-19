"""Thin HTTP client for the Wompi API.

The backend talks to Wompi with the private key (Bearer authorization).
The checkouts the client performs are:

- GET /merchants/{public_key}: returns the merchant info, including the
  events.secret used to verify webhook signatures. We cache this value
  per process.
- POST /transactions: charge a non-registered card (one-off payment).
- POST /payment_sources: tokenize a card so the frontend can use it
  for a subscription or a one-off charge.
- GET /transactions/{id}: fetch a transaction's status (used by the
  webhook idler job that pokes the API for any events missed during
  downtime).
- GET /subscriptions/{id}: fetch a subscription's status.
- POST /subscriptions: create a subscription.

The client is intentionally small. Anything more elaborate (retries,
backoff, circuit breaker) is added on top of this in subsequent Phase 5
commits.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger("lumen.wompi")


class WompiError(RuntimeError):
    """Raised when Wompi returns a non-2xx response."""

    def __init__(self, status_code: int, body: Any) -> None:
        self.status_code = status_code
        self.body = body
        super().__init__(f"Wompi error {status_code}: {body!r}")


class WompiClient:
    """HTTP client for Wompi. Credentials are read from the Settings."""

    def __init__(self, settings: Settings, *, timeout: float = 30.0) -> None:
        self._settings = settings

        private_key = settings.wompi_private_key
        if private_key is None:
            raise WompiError(
                500,
                "WOMPI_PRIVATE_KEY is not configured; the Wompi client cannot authenticate.",
            )

        base_url = settings.wompi_api_base
        if not base_url:
            base_url = (
                "https://sandbox.wompi.co/v1"
                if settings.wompi_environment == "sandbox"
                else "https://production.wompi.co/v1"
            )

        self._client = httpx.Client(
            base_url=base_url,
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {private_key.get_secret_value()}",
                "Content-Type": "application/json",
            },
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> WompiClient:
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _request(self, method: str, path: str, *, json: Any | None = None) -> dict[str, Any]:
        logger.debug("Wompi %s %s", method, path)
        response = self._client.request(method, path, json=json)
        if response.status_code >= 400:
            try:
                body: Any = response.json()
            except Exception:
                body = response.text
            raise WompiError(response.status_code, body)
        if not response.content:
            return {}
        parsed: Any = response.json()
        if not isinstance(parsed, dict):
            return {"data": parsed}
        return parsed

    # ------------------------------------------------------------------
    # Merchants
    # ------------------------------------------------------------------
    def get_merchant(self) -> dict[str, Any]:
        return self._request("GET", f"merchants/{self._settings.wompi_public_key}")

    # ------------------------------------------------------------------
    # Transactions
    # ------------------------------------------------------------------
    def create_transaction(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "transactions", json=payload)

    def get_transaction(self, transaction_id: str) -> dict[str, Any]:
        return self._request("GET", f"transactions/{transaction_id}")

    # ------------------------------------------------------------------
    # Payment sources
    # ------------------------------------------------------------------
    def create_payment_source(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "payment_sources", json=payload)

    # ------------------------------------------------------------------
    # Subscriptions
    # ------------------------------------------------------------------
    def create_subscription(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "subscriptions", json=payload)

    def get_subscription(self, subscription_id: str) -> dict[str, Any]:
        return self._request("GET", f"subscriptions/{subscription_id}")

    def cancel_subscription(self, subscription_id: str) -> dict[str, Any]:
        return self._request("DELETE", f"subscriptions/{subscription_id}")
