"""The platform module: what the platform team can do.

Nobody signs up on their own. A school asks the platform team for
access, and the team creates the school, its administrator and the
activation link that lets the administrator set their password.

- `operations` — the provisioning flow.
- `router`    — the HTTP endpoints.
- `schemas`   — the request and response models.
"""

from __future__ import annotations

from app.platform.operations import ProvisionedSchool, provision_school

__all__ = [
    "ProvisionedSchool",
    "provision_school",
]
